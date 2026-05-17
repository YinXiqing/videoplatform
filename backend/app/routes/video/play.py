"""视频播放、流媒体、HLS、封面、下载、代理"""

import re, asyncio, json
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
import aiohttp
from app.deps import get_db, get_current_user, get_optional_user
from app.models import Video, WatchHistory, User
from config import settings
from app.routes.video.helpers import (
    _check_url, _get_fresh_url, _ip_view_cache, BLOCKED, _get_session,
    _is_private_ip, _cache_remote_cover,
)
from app.logger import logger

router = APIRouter(tags=["video"])


@router.get("/stream/{video_id}")
async def stream_video(request: Request, video_id: int, db: AsyncSession = Depends(get_db),
                       user: Optional[User] = Depends(get_optional_user)):
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(404)
    if video.status not in ("approved", "pending"):
        if not user or (user.id != video.user_id and user.role != "admin"):
            raise HTTPException(403, "访问被拒绝")
    import time as _time
    should_count = True
    if user:
        recent = (await db.execute(
            select(WatchHistory).where(
                WatchHistory.user_id == user.id,
                WatchHistory.video_id == video_id,
                WatchHistory.watched_at >= datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=1),
            )
        )).scalars().first()
        if recent:
            should_count = False
    else:
        forwarded = request.headers.get("X-Forwarded-For", "")
        ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
        key = (ip, video_id)
        if key in _ip_view_cache:
            should_count = False
        else:
            _ip_view_cache[key] = True
    if should_count:
        await db.execute(update(Video).where(Video.id == video_id).values(view_count=Video.view_count + 1))
        await db.commit()
    if video.hls_ready:
        return {"is_hls": True, "video_url": f"/api/video/hls/{video_id}/index.m3u8"}
    if not video.is_scraped:
        path = settings.UPLOAD_FOLDER / video.filename
        if path.exists():
            return {"is_hls": False, "video_url": f"/api/video/file/{video_id}"}
    raise HTTPException(503, "视频正在处理中，请稍后再试")


@router.get("/file/{video_id}")
async def serve_file(video_id: int, db: AsyncSession = Depends(get_db),
                     user: Optional[User] = Depends(get_optional_user)):
    video = await db.get(Video, video_id)
    if not video or video.is_scraped:
        raise HTTPException(404)
    if video.status not in ("approved", "pending"):
        if not user or (user.id != video.user_id and user.role != "admin"):
            raise HTTPException(403)
    path = settings.UPLOAD_FOLDER / video.filename
    if not path.exists():
        raise HTTPException(404)
    return FileResponse(path, media_type="video/mp4",
                        headers={"Cache-Control": "public, max-age=86400"})


@router.get("/hls/{video_id}/{filename}")
async def serve_hls(video_id: int, filename: str, db: AsyncSession = Depends(get_db),
                    user: Optional[User] = Depends(get_optional_user)):
    video = await db.get(Video, video_id)
    if not video or not video.hls_ready:
        raise HTTPException(404)
    if video.status not in ("approved", "pending"):
        if not user or (user.id != video.user_id and user.role != "admin"):
            raise HTTPException(403)
    path = settings.UPLOAD_FOLDER / "hls" / str(video_id) / filename
    if not path.exists():
        raise HTTPException(404)
    ct = "application/vnd.apple.mpegurl" if filename.endswith(".m3u8") else "video/mp2t"
    return FileResponse(path, media_type=ct,
                        headers={"Cache-Control": "public, max-age=31536000, immutable"})


@router.get("/cover/{video_id}")
async def get_cover(video_id: int, db: AsyncSession = Depends(get_db),
                    user: Optional[User] = Depends(get_optional_user)):
    video = await db.get(Video, video_id)
    if not video or not video.cover_image:
        raise HTTPException(404)
    if video.status != "approved":
        if not user or (user.id != video.user_id and user.role != "admin"):
            raise HTTPException(404)
    if video.cover_image.startswith("http"):
        local = await _cache_remote_cover(video.cover_image, video.page_url or video.cover_image)
        if not local.startswith("http"):
            return FileResponse(settings.UPLOAD_FOLDER / local,
                                headers={"Cache-Control": "public, max-age=86400"})
        async def _gen():
            try:
                referer = video.page_url or video.cover_image
                async with _get_session().get(video.cover_image,
                                     headers={"User-Agent": "Mozilla/5.0", "Referer": referer},
                                     ssl=False, timeout=aiohttp.ClientTimeout(total=10)) as r:
                        if r.status >= 400:
                            return
                        async for chunk in r.content.iter_chunked(8192):
                            yield chunk
            except Exception as e:
                logger.warning("cover_stream_failed", video_id=video_id, error=str(e))
                return
        ct = "image/jpeg"
        if video.cover_image.split("?")[0].endswith(".png"):
            ct = "image/png"
        elif video.cover_image.split("?")[0].endswith(".webp"):
            ct = "image/webp"
        return StreamingResponse(_gen(), media_type=ct)
    path = settings.UPLOAD_FOLDER / video.cover_image
    if not path.exists():
        raise HTTPException(404)
    return FileResponse(path, headers={"Cache-Control": "public, max-age=86400"})


@router.get("/download/{video_id}")
async def download_video(video_id: int, db: AsyncSession = Depends(get_db),
                         user: User = Depends(get_current_user)):
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(404)
    if video.status != "approved":
        if not user or (user.id != video.user_id and user.role != "admin"):
            raise HTTPException(403)
    path = settings.UPLOAD_FOLDER / video.filename
    if not path.exists():
        raise HTTPException(404)
    safe_title = re.sub(r'[\\/:*?"<>|]', '', video.title).strip() or f'video_{video_id}'
    filename = f"{safe_title}.mp4"
    from urllib.parse import quote
    disposition = f"attachment; filename*=UTF-8''{quote(filename)}"
    return FileResponse(path, media_type="video/mp4",
                        headers={"Content-Disposition": disposition,
                                 "Cache-Control": "public, max-age=86400"})


@router.get("/refresh-url/{video_id}")
async def refresh_video_url(video_id: int, db: AsyncSession = Depends(get_db),
                            user: User = Depends(get_current_user)):
    video = await db.get(Video, video_id)
    if not video or not video.is_scraped or not video.page_url:
        return {"video_url": video.source_url if video else None}
    new_url, new_headers = await _get_fresh_url(video.page_url)
    if new_url:
        await db.execute(update(Video).where(Video.id == video_id).values(
            source_url=new_url,
            http_headers=json.dumps(new_headers) if new_headers else video.http_headers,
        ))
        await db.commit()
    return {"video_url": new_url or video.source_url}


@router.get("/proxy")
async def proxy_stream(url: str, referer: str = "", db: AsyncSession = Depends(get_db)):
    from urllib.parse import urlparse, urljoin, urlunparse
    try:
        p = urlparse(url)
        if not p.hostname or p.scheme not in ("http", "https"):
            raise HTTPException(403, "已阻止")
        if BLOCKED.match(p.hostname) or _is_private_ip(p.hostname):
            raise HTTPException(403, "已阻止")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, "无效的 URL")

    stored_headers: dict = {}
    try:
        video = (await db.execute(select(Video).where(Video.source_url == url))).scalars().first()
        if video and video.http_headers:
            stored_headers = json.loads(video.http_headers)
    except Exception as e:
        logger.warning("proxy_headers_parse_failed", url=url[:120], error=str(e))

    effective_referer = referer or stored_headers.get("Referer") or f"{p.scheme}://{p.netloc}/"
    user_agent = stored_headers.get("User-Agent") or \
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"
    req_headers = {**stored_headers, "Referer": effective_referer, "User-Agent": user_agent, "Origin": f"{p.scheme}://{p.netloc}"}

    async def _gen():
        try:
            async with _get_session().get(url, headers=req_headers, ssl=False) as r:
                    if r.status >= 400:
                        return
                    ct = r.headers.get("Content-Type", "")
                    if "m3u8" in ct or ".m3u8" in url:
                        text = await r.text()
                        base = urlunparse((p.scheme, p.netloc, p.path, "", "", "")).rsplit("/", 1)[0] + "/"
                        lines = []
                        for l in text.splitlines():
                            stripped = l.strip()
                            if stripped and not stripped.startswith("#"):
                                seg_url = urljoin(base, stripped)
                                lines.append(f"/api/video/proxy?url={seg_url}&referer={effective_referer}")
                            else:
                                lines.append(l)
                        yield "\n".join(lines).encode()
                    else:
                        async for chunk in r.content.iter_chunked(8192):
                            yield chunk
        except Exception as e:
            logger.warning("proxy_stream_failed", url=url[:120], error=str(e))
            return

    ct = "application/vnd.apple.mpegurl" if ".m3u8" in url else "application/octet-stream"
    return StreamingResponse(_gen(), media_type=ct, headers={"Access-Control-Allow-Origin": "*"})
