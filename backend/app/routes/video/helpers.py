"""视频模块共享工具函数（被 routes/video 子模块、admin、tasks 导入）"""

from imageio_ffmpeg import get_ffmpeg_exe
import re, asyncio, json
from app.logger import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models import Video
from config import settings
import aiohttp


def _ext(fn):
    return fn.rsplit(".", 1)[-1].lower() if "." in fn else ""


# 音视频/图片魔术字节校验
_VIDEO_MAGIC = [
    lambda d: d[4:8] == b"ftyp" if len(d) > 8 else False,
    lambda d: d[:4] == b"RIFF" and d[8:12] == b"AVI " if len(d) > 12 else False,
    lambda d: d[:4] == b"\x1a\x45\xdf\xa3" if len(d) > 4 else False,
    lambda d: d[:4] == b"0\x26\xb2\x75" if len(d) > 4 else False,
    lambda d: d[:3] == b"FLV" if len(d) > 3 else False,
]
_IMAGE_MAGIC = [
    lambda d: d[:3] == b"\xff\xd8\xff" if len(d) > 3 else False,
    lambda d: d[:4] == b"\x89PNG" if len(d) > 4 else False,
    lambda d: d[:4] in (b"GIF8",) if len(d) > 4 else False,
    lambda d: d[:4] == b"RIFF" and d[8:12] == b"WEBP" if len(d) > 12 else False,
]


def _check_video_magic(data: bytes) -> bool:
    return any(check(data) for check in _VIDEO_MAGIC)


def _check_image_magic(data: bytes) -> bool:
    return any(check(data) for check in _IMAGE_MAGIC)


async def _get_duration(path) -> int:
    try:
        import subprocess as _subprocess, re as _re
        loop = asyncio.get_running_loop()

        def _run():
            r = _subprocess.run(
                [get_ffmpeg_exe(), "-i", str(path)],
                capture_output=True, text=True, timeout=10,
            )
            m = _re.search(r"Duration: (\d+):(\d+):(\d+)", r.stderr)
            if m:
                return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + int(m.group(3))
            return 0

        return await loop.run_in_executor(None, _run)
    except Exception:
        return 0


async def _extract_cover(video_path, cover_filename) -> bool:
    try:
        import subprocess
        loop = asyncio.get_running_loop()

        def _run():
            r = subprocess.run(
                [get_ffmpeg_exe(), "-y", "-i", str(video_path), "-ss", "00:00:01",
                 "-vframes", "1", "-q:v", "2", str(settings.UPLOAD_FOLDER / cover_filename)],
                capture_output=True, timeout=15,
            )
            return r.returncode == 0

        return await loop.run_in_executor(None, _run)
    except Exception:
        return False


async def _transcode_hls(video_id: int, src_path):
    """后台异步将视频转码为 HLS"""
    try:
        import subprocess
        from app.database import AsyncSessionLocal
        hls_dir = settings.UPLOAD_FOLDER / "hls" / str(video_id)
        hls_dir.mkdir(parents=True, exist_ok=True)
        m3u8_path = hls_dir / "index.m3u8"
        loop = asyncio.get_running_loop()
        is_mp4 = str(src_path).lower().endswith(".mp4")

        def _run():
            codec_args = ["-c", "copy"] if is_mp4 else ["-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart"]
            r = subprocess.run([
                get_ffmpeg_exe(), "-y", "-i", str(src_path),
                *codec_args,
                "-start_number", "0",
                "-hls_time", "10",
                "-hls_list_size", "0",
                "-hls_segment_filename", str(hls_dir / "seg%03d.ts"),
                "-f", "hls", str(m3u8_path),
            ], capture_output=True, timeout=600)
            return r.returncode == 0

        ok = await loop.run_in_executor(None, _run)
        async with AsyncSessionLocal() as db:
            await db.execute(update(Video).where(Video.id == video_id).values(hls_ready=ok))
            await db.commit()
        if ok:
            logger.info("hls_ready", video_id=video_id)
        else:
            logger.warning("hls_transcode_failed", video_id=video_id)
    except Exception as e:
        logger.error("hls_transcode_error", video_id=video_id, error=str(e))


async def _delete_video_files(video: Video):
    """删除视频关联的本地文件（跳过外链）"""
    loop = asyncio.get_running_loop()
    for f in [video.filename, video.cover_image]:
        if f and not f.startswith("http"):
            p = settings.UPLOAD_FOLDER / f
            if p.exists():
                await loop.run_in_executor(None, p.unlink)
    hls_dir = settings.UPLOAD_FOLDER / "hls" / str(video.id)
    if hls_dir.exists():
        import shutil
        await loop.run_in_executor(None, shutil.rmtree, hls_dir)


async def _delete_video(db: AsyncSession, video: Video):
    """删除视频：本地文件 + scraped记录 + watch_history + 数据库记录"""
    from sqlalchemy import delete as sa_delete
    from app.models import ScrapedVideoInfo, WatchHistory, Favorite
    await _delete_video_files(video)
    await db.execute(sa_delete(ScrapedVideoInfo).where(ScrapedVideoInfo.video_id == video.id))
    if video.page_url:
        await db.execute(sa_delete(ScrapedVideoInfo).where(ScrapedVideoInfo.source_url == video.page_url))
    await db.execute(sa_delete(WatchHistory).where(WatchHistory.video_id == video.id))
    await db.execute(sa_delete(Favorite).where(Favorite.video_id == video.id))
    await db.delete(video)


async def _check_url(url):
    try:
        async with aiohttp.ClientSession() as s:
            async with s.head(url, timeout=aiohttp.ClientTimeout(total=5), ssl=False) as r:
                return r.status < 400
    except Exception:
        return False


async def _get_fresh_url(page_url: str) -> tuple[str, dict]:
    """返回 (video_url, http_headers)"""
    if not page_url:
        return "", {}
    try:
        import yt_dlp
        ydl_opts = {"quiet": True, "no_warnings": True, "skip_download": True, "noplaylist": True, "socket_timeout": 20}
        if settings.YT_PROXY:
            ydl_opts["proxy"] = settings.YT_PROXY
        if settings.YT_COOKIES_FILE:
            ydl_opts["cookiefile"] = settings.YT_COOKIES_FILE

        def _run():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(page_url, download=False)
            fmts = info.get("formats", [])
            m3u8 = [f for f in fmts if f.get("protocol") in ("m3u8", "m3u8_native") and f.get("url") and f.get("vcodec") != "none"]
            direct = [f for f in fmts if f.get("url") and f.get("vcodec") not in (None, "none")]
            best = (max(m3u8, key=lambda f: (f.get("height") or 0, f.get("tbr") or 0)) if m3u8
                    else max(direct, key=lambda f: (f.get("height") or 0, f.get("tbr") or 0)) if direct
                    else {})
            url = best.get("url") or info.get("url", "")
            if url.endswith(".m3u") and not url.endswith(".m3u8"):
                url += "8"
            headers = dict(best.get("http_headers") or {})
            if page_url not in headers.get("Referer", ""):
                headers["Referer"] = page_url
            return url, headers

        return await asyncio.get_running_loop().run_in_executor(None, _run)
    except Exception:
        return "", {}


async def _refresh_url_bg(video_id, page_url):
    try:
        from app.database import AsyncSessionLocal
        new_url, new_headers = await _get_fresh_url(page_url)
        if new_url:
            async with AsyncSessionLocal() as db:
                await db.execute(update(Video).where(Video.id == video_id).values(
                    source_url=new_url,
                    http_headers=json.dumps(new_headers) if new_headers else None,
                ))
                await db.commit()
    except Exception as e:
        logger.warning("url_refresh_failed", video_id=video_id, error=str(e))


BLOCKED = re.compile(
    r"^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.0\.0\.0|\[::\]|::1|fc[0-9a-f]{2}:|fd[0-9a-f]{2}:)",
    re.I,
)

# 未登录用户播放量去重：{(ip, video_id): timestamp}
_ip_view_cache: dict[tuple, float] = {}

# 上传防重复：{(user_id, content_hash): timestamp}
_upload_cache: dict[tuple, float] = {}
