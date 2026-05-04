"""管理后台：用户 CRUD"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.deps import get_db, require_admin
from app.models import User
from app.routes.video.helpers import _delete_video_files

router = APIRouter(tags=["admin"])


@router.get("/users")
async def get_users(page: int = 1, per_page: int = Query(20, le=100), search: str = "",
                    db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    q = select(User)
    if search:
        pat = f"%{search}%"
        q = q.where(or_(User.username.ilike(pat), User.email.ilike(pat)))
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    items = (await db.execute(q.order_by(User.created_at.desc()).offset((page - 1) * per_page).limit(per_page))).scalars().all()
    return {"users": [u.to_dict() for u in items], "total": total,
            "pages": -(-total // per_page), "current_page": page, "per_page": per_page}


class UserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None


@router.put("/users/{user_id}")
async def update_user(user_id: int, data: UserUpdate,
                      db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404)
    if data.role and data.role in ("user", "admin"):
        if user_id == admin.id:
            raise HTTPException(400, "不能修改自己的角色")
        user.role = data.role
    if data.is_active is not None:
        if user_id == admin.id and not data.is_active:
            raise HTTPException(400, "不能禁用自已的账户")
        user.is_active = data.is_active
    await db.commit()
    await db.refresh(user)
    return {"message": "User updated successfully", "user": user.to_dict()}


@router.delete("/users/{user_id}")
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    if user_id == admin.id:
        raise HTTPException(400, "不能删除自己的账户")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404)
    from app.models import ScrapedVideoInfo, WatchHistory, Favorite, Video
    from sqlalchemy import delete as sa_delete

    videos = (await db.execute(select(Video).where(Video.user_id == user_id))).scalars().all()
    video_ids = [v.id for v in videos]

    if video_ids:
        await db.execute(sa_delete(ScrapedVideoInfo).where(ScrapedVideoInfo.video_id.in_(video_ids)))
        await db.execute(sa_delete(WatchHistory).where(WatchHistory.video_id.in_(video_ids)))
        await db.execute(sa_delete(Favorite).where(Favorite.video_id.in_(video_ids)))
        for v in videos:
            await _delete_video_files(v)
        await db.execute(sa_delete(Video).where(Video.id.in_(video_ids)))
    await db.delete(user)
    await db.commit()
    return {"message": "User deleted successfully"}
