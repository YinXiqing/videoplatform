"""视频浏览相关：列表、详情、搜索建议、我的视频 CRUD"""

import asyncio
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, or_, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.deps import get_db, get_current_user, get_optional_user
from app.models import Video, User
from app.routes.video.helpers import _check_url, _delete_video, paginate

router = APIRouter(tags=["video"])


@router.get("/list")
async def list_videos(
    page: int = 1, per_page: int = Query(12, le=100), search: str = "", tag: str = "",
    sort: str = "newest", status: Optional[str] = None, db: AsyncSession = Depends(get_db),
):
    q = select(Video).options(selectinload(Video.author_rel))
    q = q.where(Video.status == status) if status else q.where(Video.status == "approved")
    if search:
        pat = f"%{search}%"
        q = q.join(User).where(or_(Video.title.ilike(pat), User.username.ilike(pat)))
    if tag:
        q = q.where(Video.tags.ilike(f"%{tag}%"))
    order = Video.view_count.desc() if sort == "popular" else Video.created_at.asc() if sort == "oldest" else Video.created_at.desc()
    items, total, pages = await paginate(db, q.order_by(order), page, per_page)
    return {"videos": [v.to_dict() for v in items], "total": total,
            "pages": pages, "current_page": page, "per_page": per_page}


@router.get("/suggest")
async def suggest_videos(q: str = "", limit: int = Query(5, le=10), db: AsyncSession = Depends(get_db)):
    """搜索建议：返回匹配的视频标题"""
    if not q.strip():
        return {"suggestions": []}
    pat = f"%{q}%"
    items = (await db.execute(
        select(Video.title).where(Video.status == "approved", Video.title.ilike(pat))
        .distinct().limit(limit)
    )).scalars().all()
    return {"suggestions": items}


@router.get("/detail/{video_id}")
async def get_video_detail(video_id: int, db: AsyncSession = Depends(get_db),
                           user: Optional[User] = Depends(get_optional_user)):
    video = await db.get(Video, video_id, options=[selectinload(Video.author_rel)])
    if not video:
        raise HTTPException(404, "视频不存在")
    if video.status != "approved":
        if not user or (user.id != video.user_id and user.role != "admin"):
            raise HTTPException(404, "视频不存在")
    if video.is_scraped and video.page_url and video.source_url:
        if not await _check_url(video.source_url):
            from app.tasks import refresh_video_url
            asyncio.create_task(refresh_video_url(video_id, video.page_url))
    return {"video": video.to_dict()}


@router.get("/my-videos")
async def get_my_videos(page: int = 1, per_page: int = Query(10, le=100),
                        db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    q = (select(Video).options(selectinload(Video.author_rel))
         .where(Video.user_id == user.id).order_by(Video.created_at.desc()))
    items, total, pages = await paginate(db, q, page, per_page)
    return {"videos": [v.to_dict() for v in items], "total": total,
            "pages": pages, "current_page": page, "per_page": per_page}


class VideoUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[str | list] = None


@router.put("/my-videos/{video_id}/edit")
async def update_user_video(video_id: int, data: VideoUpdate,
                            db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    video = await db.get(Video, video_id)
    if not video or video.user_id != user.id:
        raise HTTPException(403, "访问被拒绝")
    if data.title:
        if len(data.title) > 255:
            raise HTTPException(400, "title max length is 255")
        video.title = data.title
    if data.description is not None:
        if len(data.description) > 5000:
            raise HTTPException(400, "description max length is 5000")
        video.description = data.description
    if data.tags is not None:
        video.tags = ",".join(data.tags) if isinstance(data.tags, list) else data.tags
    await db.commit()
    await db.refresh(video)
    return {"message": "Video updated successfully", "video": video.to_dict()}


@router.delete("/my-videos/{video_id}/delete")
async def delete_user_video(video_id: int, db: AsyncSession = Depends(get_db),
                            user: User = Depends(get_current_user)):
    video = await db.get(Video, video_id)
    if not video or video.user_id != user.id:
        raise HTTPException(403, "访问被拒绝")
    await _delete_video(db, video)
    await db.commit()
    return {"message": "Video deleted successfully"}
