"""视频模块共享工具函数（被 routes/video 子模块、admin、tasks 导入）"""

import shutil
import re, asyncio, json, time, hashlib
from app.logger import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from app.models import Video
from config import settings
import aiohttp, aiofiles
import cachetools

# 共享的 aiohttp session，复用连接池
_shared_session: aiohttp.ClientSession | None = None


def _get_session() -> aiohttp.ClientSession:
    global _shared_session
    if _shared_session is None or _shared_session.closed:
        _shared_session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
        )
    return _shared_session


async def async_close_session():
    global _shared_session
    if _shared_session and not _shared_session.closed:
        await _shared_session.close()
        _shared_session = None


async def paginate(db: AsyncSession, base_stmt, page: int, per_page: int) -> tuple[list, int, int]:
    """分页工具：返回 (items, total, total_pages)。合并 count + data 为一个子查询，减少样板代码。"""
    subq = base_stmt.order_by(None).subquery()
    total = (await db.execute(select(func.count()).select_from(subq))).scalar_one()
    items = (await db.execute(
        base_stmt.offset((page - 1) * per_page).limit(per_page)
    )).scalars().all()
    return items, total, -(-total // per_page)


def get_ffmpeg_exe() -> str:
    exe = shutil.which("ffmpeg")
    if not exe:
        raise RuntimeError("ffmpeg 未找到，请安装 ffmpeg 并确保其在 PATH 中")
    return exe


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
        async with _get_session().head(url, timeout=aiohttp.ClientTimeout(total=5), ssl=False) as r:
            return r.status < 400
    except Exception as e:
        logger.warning("check_url_failed", url=url[:120], error=str(e))
        return False


def _ydlp_extract(url: str, format_str: str = "", extractor_args: dict | None = None):
    """共享的 yt-dlp 信息提取（同步函数，需在线程池中运行）。
    返回 (title, cover_url, duration, video_url, http_headers, is_m3u8) 元组。
    """
    import yt_dlp
    ydl_opts = {
        "quiet": True, "no_warnings": True, "skip_download": True,
        "noplaylist": True, "socket_timeout": 20,
    }
    if format_str:
        ydl_opts["format"] = format_str
    if extractor_args:
        ydl_opts["extractor_args"] = extractor_args
    if settings.YT_PROXY:
        ydl_opts["proxy"] = settings.YT_PROXY
    if settings.YT_COOKIES_FILE:
        ydl_opts["cookiefile"] = settings.YT_COOKIES_FILE

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)

    title = re.sub(r"\s*\(\d+\)$", "", info.get("title", "") or "").strip() or "Untitled"
    cover_url = info.get("thumbnail", "")
    duration = int(info.get("duration") or 0)
    fmts = info.get("formats", [])
    m3u8 = [f for f in fmts if f.get("protocol") in ("m3u8", "m3u8_native") and f.get("url") and f.get("vcodec") != "none"]
    direct = [f for f in fmts if f.get("url") and f.get("vcodec") not in (None, "none")]

    best = (max(m3u8, key=lambda f: (f.get("height") or 0, f.get("tbr") or 0)) if m3u8
            else max(direct, key=lambda f: (f.get("height") or 0, f.get("tbr") or 0)) if direct
            else {})
    video_url = best.get("url") or info.get("url", "")
    if video_url.endswith(".m3u") and not video_url.endswith(".m3u8"):
        video_url += "8"

    http_headers = dict(best.get("http_headers") or {})
    if url not in http_headers.get("Referer", ""):
        http_headers["Referer"] = url

    return title, cover_url, duration, video_url, http_headers, bool(m3u8)


async def _get_fresh_url(page_url: str) -> tuple[str, dict]:
    """返回 (video_url, http_headers) —— 用于 URL 刷新"""
    if not page_url:
        return "", {}
    try:
        _, _, _, url, headers, _ = await asyncio.get_running_loop().run_in_executor(
            None, _ydlp_extract, page_url,
        )
        return url, headers
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


import ipaddress

BLOCKED = re.compile(
    r"^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.0\.0\.0|\[::\]|::1|fc[0-9a-f]{2}:|fd[0-9a-f]{2}:)",
    re.I,
)

def _is_private_ip(hostname: str) -> bool:
    """用 ipaddress 模块二次校验，防止十六进制/十进制 IP 绕过正则"""
    try:
        ip = ipaddress.ip_address(hostname)
        return ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_unspecified
    except ValueError:
        return False

# 未登录用户播放量去重：{(ip, video_id): timestamp}，1 小时 TTL，自动淘汰
_ip_view_cache = cachetools.TTLCache(maxsize=10000, ttl=3600)

# 上传防重复：{(user_id, content_hash): timestamp}，5 分钟 TTL，自动淘汰
_upload_cache = cachetools.TTLCache(maxsize=5000, ttl=300)

# 远程封面图本地缓存：{url_hash: 本地文件名}，24h 过期
_cover_disk_cache = cachetools.TTLCache(maxsize=2000, ttl=86400)


async def _cache_remote_cover(cover_url: str, referer: str) -> str:
    """首次下载远端封面到本地，后续直接返回本地路径避免重复下载"""
    cache_key = cover_url.split("?")[0]
    if cache_key in _cover_disk_cache:
        cached = _cover_disk_cache[cache_key]
        if (settings.UPLOAD_FOLDER / cached).exists():
            return cached
    try:
        ext = cache_key.rsplit(".", 1)[-1].lower()
        if ext not in ("jpg", "jpeg", "png", "webp"):
            ext = "jpg"
        fname = f"cached_cover_{hashlib.md5(cache_key.encode()).hexdigest()}.{ext}"
        fpath = settings.UPLOAD_FOLDER / fname
        if fpath.exists():
            _cover_disk_cache[cache_key] = fname
            return fname
        async with _get_session().get(cover_url,
                headers={"User-Agent": "Mozilla/5.0", "Referer": referer},
                ssl=False, timeout=aiohttp.ClientTimeout(total=10)) as r:
            if r.status >= 400:
                return cover_url
            content = await r.read()
        async with aiofiles.open(fpath, "wb") as f:
            await f.write(content)
        _cover_disk_cache[cache_key] = fname
        return fname
    except Exception:
        return cover_url
