"""后台任务定义（转码、下载、URL 刷新）"""

from imageio_ffmpeg import get_ffmpeg_exe
import asyncio
import json
import shutil
import subprocess
from pathlib import Path

from taskiq import InMemoryBroker

from app.logger import logger
from config import settings

broker = InMemoryBroker()


@broker.task(retry_on_error=True, max_retries=3)
async def transcode_hls(video_id: int, src_path: str):
    """后台将视频转码为 HLS"""
    from app.database import AsyncSessionLocal
    from sqlalchemy import update
    from app.models import Video

    hls_dir = settings.UPLOAD_FOLDER / "hls" / str(video_id)
    hls_dir.mkdir(parents=True, exist_ok=True)
    m3u8_path = hls_dir / "index.m3u8"

    is_mp4 = src_path.lower().endswith(".mp4")
    codec_args = (
        ["-c", "copy"]
        if is_mp4
        else ["-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart"]
    )

    loop = asyncio.get_running_loop()

    def _run():
        return subprocess.run(
            [
                get_ffmpeg_exe(),
                "-y",
                "-i",
                src_path,
                *codec_args,
                "-start_number",
                "0",
                "-hls_time",
                "10",
                "-hls_list_size",
                "0",
                "-hls_segment_filename",
                str(hls_dir / "seg%03d.ts"),
                "-f",
                "hls",
                str(m3u8_path),
            ],
            capture_output=True,
            timeout=600,
        )

    try:
        result = await loop.run_in_executor(None, _run)
        ok = result.returncode == 0
    except Exception as e:
        logger.error("hls_transcode_error", video_id=video_id, error=str(e))
        ok = False

    async with AsyncSessionLocal() as db:
        await db.execute(update(Video).where(Video.id == video_id).values(hls_ready=ok))
        await db.commit()

    if ok:
        logger.info("hls_ready", video_id=video_id)
    else:
        logger.warning("hls_transcode_failed", video_id=video_id)


@broker.task(retry_on_error=True, max_retries=2)
async def refresh_video_url(video_id: int, page_url: str):
    """后台刷新抓取视频的播放地址"""
    if not page_url:
        return

    from app.database import AsyncSessionLocal
    from sqlalchemy import update
    from app.models import Video
    from app.routes.video import _get_fresh_url

    new_url, new_headers = await _get_fresh_url(page_url)
    if new_url:
        async with AsyncSessionLocal() as db:
            await db.execute(
                update(Video)
                .where(Video.id == video_id)
                .values(
                    source_url=new_url,
                    http_headers=json.dumps(new_headers) if new_headers else None,
                )
            )
            await db.commit()
    else:
        logger.warning("url_refresh_failed", video_id=video_id)


async def download_scraped_video(scraped_id: int, source_url: str):
    """下载抓取的视频到本地（目前保持原实现，通过 asyncio.create_task 调用）"""
    from app.routes.admin import _do_download

    # _do_download 内部已有完整的状态管理和错误处理
    await _do_download(scraped_id, source_url)
