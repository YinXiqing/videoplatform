"""视频上传"""

import uuid, asyncio, hashlib, time as _time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
import aiofiles
from app.deps import get_db, get_current_user
from app.models import Video, User
from app.logger import logger
from config import settings
from app.routes.video.helpers import (
    _ext, _check_video_magic, _check_image_magic,
    _get_duration, _extract_cover, _upload_cache,
)

router = APIRouter(tags=["video"])


@router.post("/upload", status_code=201)
async def upload_video(
    title: str = Form(..., max_length=255), description: str = Form("", max_length=5000),
    tags: str = Form(""), video: UploadFile = File(...),
    cover: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user),
):
    ext = _ext(video.filename)
    if ext not in settings.ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(400, "无效的视频格式")

    first_chunk = await video.read(64 * 1024)  # 扩展首块到 64KB 检测
    if not first_chunk or not _check_video_magic(first_chunk):
        raise HTTPException(400, "文件内容与视频格式不匹配")

    filename = f"{uuid.uuid4().hex}.{ext}"
    video_path = settings.UPLOAD_FOLDER / filename
    total = len(first_chunk)
    hash_bytes = bytearray(first_chunk[:1024 * 1024])
    try:
        async with aiofiles.open(video_path, "wb") as f:
            await f.write(first_chunk)
            while chunk := await video.read(64 * 1024):
                total += len(chunk)
                if total > settings.MAX_UPLOAD_SIZE:
                    raise HTTPException(413, "文件太大")
                await f.write(chunk)
                if len(hash_bytes) < 1024 * 1024:
                    hash_bytes.extend(chunk[:1024 * 1024 - len(hash_bytes)])
    except HTTPException:
        if video_path.exists():
            video_path.unlink()
        raise
    except Exception:
        if video_path.exists():
            video_path.unlink()
        raise HTTPException(500, "上传失败")

    # ffprobe 二次校验：确认是合法视频文件
    try:
        import subprocess as _sp
        result = await asyncio.get_running_loop().run_in_executor(
            None, lambda: _sp.run(
                ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", str(video_path)],
                capture_output=True, text=True, timeout=15,
            )
        )
        if result.returncode != 0 or not result.stdout.strip():
            video_path.unlink()
            raise HTTPException(400, "无效的视频文件")
    except HTTPException:
        raise
    except Exception:
        video_path.unlink()
        raise HTTPException(400, "无效的视频文件")

    # 防重复提交（5 分钟 TTL，自动淘汰）
    content_hash = hashlib.md5(bytes(hash_bytes)).hexdigest()
    dedup_key = (user.id, content_hash)
    if dedup_key in _upload_cache:
        video_path.unlink()
        raise HTTPException(429, "请勿重复提交，5 分钟内已上传相同文件")
    _upload_cache[dedup_key] = True

    cover_content = None
    if cover and cover.filename:
        if _ext(cover.filename) not in settings.ALLOWED_IMAGE_EXTENSIONS:
            video_path.unlink()
            raise HTTPException(400, "无效的封面图片格式")
        cover_content = await cover.read()
        if not cover_content or not _check_image_magic(cover_content):
            video_path.unlink()
            raise HTTPException(400, "无效的封面图片内容")
        if len(cover_content) > 10 * 1024 * 1024:
            video_path.unlink()
            raise HTTPException(413, "封面图片太大")

    cover_filename = None
    if cover_content:
        cover_filename = f"cover_{uuid.uuid4().hex}.{_ext(cover.filename)}"
        async with aiofiles.open(settings.UPLOAD_FOLDER / cover_filename, "wb") as f:
            await f.write(cover_content)
        duration = await _get_duration(video_path)
    else:
        auto_cover = f"cover_{uuid.uuid4().hex}.jpg"
        duration, cover_ok = await asyncio.gather(
            _get_duration(video_path),
            _extract_cover(video_path, auto_cover),
        )
        if cover_ok:
            cover_filename = auto_cover

    try:
        record = Video(title=title.strip(), description=description.strip(), tags=tags.strip(),
                       filename=filename, cover_image=cover_filename, file_size=total,
                       duration=duration, user_id=user.id, status="pending")
        db.add(record)
        await db.commit()
        await db.refresh(record)
    except Exception:
        for f in [filename, cover_filename]:
            if f:
                p = settings.UPLOAD_FOLDER / f
                if p.exists():
                    p.unlink()
        raise HTTPException(500, "上传失败，请重试")

    from app.tasks import transcode_hls
    task = asyncio.create_task(transcode_hls(record.id, str(settings.UPLOAD_FOLDER / filename)))
    task.add_done_callback(lambda t: logger.warning("transcode_task_failed", error=str(t.exception())) if t.exception() else None)
    return {"message": "Video uploaded successfully. Awaiting admin approval.", "video": record.to_dict()}
