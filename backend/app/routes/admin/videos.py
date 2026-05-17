"""管理后台：视频管理 + 批量操作"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, or_, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.deps import get_db, require_admin
from app.models import User, Video
from app.routes.video.helpers import _delete_video, paginate

router = APIRouter(tags=["admin"])


@router.get("/videos")
async def get_all_videos(page: int = 1, per_page: int = Query(20, le=100), status: str = "all", search: str = "",
                         db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    q = select(Video).options(selectinload(Video.author_rel))
    if status != "all" and status in ("pending", "approved", "rejected"):
        q = q.where(Video.status == status)
    if search:
        pat = f"%{search}%"
        q = q.join(User).where(or_(Video.title.ilike(pat), Video.description.ilike(pat), User.username.ilike(pat)))
    items, total, pages = await paginate(db, q.order_by(Video.created_at.desc()), page, per_page)
    return {"videos": [v.to_dict() for v in items], "total": total,
            "pages": pages, "current_page": page, "per_page": per_page}


class VideoAdminUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[str | list] = None
    status: Optional[str] = None


@router.put("/videos/{video_id}")
async def update_video(video_id: int, data: VideoAdminUpdate,
                       db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(404)
    if data.title: video.title = data.title.strip()
    if data.description is not None: video.description = data.description.strip()
    if data.tags is not None:
        video.tags = ",".join(data.tags) if isinstance(data.tags, list) else data.tags.strip()
    if data.status and data.status in ("pending", "approved", "rejected"):
        video.status = data.status
    await db.commit()
    await db.refresh(video)
    return {"message": "Video updated successfully", "video": video.to_dict()}


@router.delete("/videos/{video_id}")
async def delete_video(video_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    video = await db.get(Video, video_id)
    if not video:
        raise HTTPException(404)
    await _delete_video(db, video)
    await db.commit()
    return {"message": "Video deleted successfully"}


class BulkIds(BaseModel):
    video_ids: list[int]
    status: Optional[str] = None


@router.post("/videos/bulk-update")
async def bulk_update_videos(data: BulkIds, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    if not data.status or data.status not in ("pending", "approved", "rejected"):
        raise HTTPException(400, "无效的状态")
    result = await db.execute(update(Video).where(Video.id.in_(data.video_ids)).values(status=data.status))
    await db.commit()
    return {"message": f"{result.rowcount} videos updated", "updated_count": result.rowcount}


@router.post("/videos/bulk-delete")
async def bulk_delete_videos(data: BulkIds, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    videos = (await db.execute(select(Video).where(Video.id.in_(data.video_ids)))).scalars().all()
    for v in videos:
        await _delete_video(db, v)
    await db.commit()
    return {"message": f"{len(videos)} videos deleted", "deleted_count": len(videos)}
