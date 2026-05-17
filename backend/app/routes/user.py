"""作者主页：公开资料、视频、关注、收藏"""

import uuid, aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy import select, func, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from typing import Optional
from pydantic import BaseModel
from app.deps import get_db, get_current_user, get_optional_user
from app.models import User, Video, Follow, Favorite
from config import settings
from app.routes.video.helpers import _check_image_magic, _ext, paginate

router = APIRouter(prefix="/api/user", tags=["user"])


@router.get("/{user_id}")
async def get_user_profile(user_id: int, db: AsyncSession = Depends(get_db),
                           current_user: Optional[User] = Depends(get_optional_user)):
    """公开的用户主页信息"""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "用户不存在")

    video_count = (await db.execute(
        select(func.count(Video.id)).where(Video.user_id == user_id, Video.status == "approved")
    )).scalar_one()

    follower_count = (await db.execute(
        select(func.count(Follow.id)).where(Follow.followed_id == user_id)
    )).scalar_one()

    following_count = (await db.execute(
        select(func.count(Follow.id)).where(Follow.follower_id == user_id)
    )).scalar_one()

    # 当前用户是否已关注该作者
    is_following = False
    if current_user:
        exists = (await db.execute(
            select(Follow).where(Follow.follower_id == current_user.id, Follow.followed_id == user_id)
        )).scalar_one_or_none()
        is_following = exists is not None

    return {
        "user": {
            "id": user.id,
            "username": user.username,
            "avatar": user.avatar,
            "bio": user.bio,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        },
        "video_count": video_count,
        "follower_count": follower_count,
        "following_count": following_count,
        "is_following": is_following,
    }


@router.get("/{user_id}/videos")
async def get_user_videos(user_id: int, page: int = 1, per_page: int = Query(12, le=100),
                          db: AsyncSession = Depends(get_db)):
    """作者的作品列表（按时间排序）"""
    q = (select(Video).options(selectinload(Video.author_rel))
         .where(Video.user_id == user_id, Video.status == "approved")
         .order_by(Video.created_at.desc()))
    items, total, pages = await paginate(db, q, page, per_page)
    return {"videos": [v.to_dict() for v in items], "total": total,
            "pages": pages, "current_page": page, "per_page": per_page}


@router.get("/{user_id}/following")
async def get_user_following(user_id: int, db: AsyncSession = Depends(get_db)):
    """该作者关注了哪些人"""
    followed_ids = (await db.execute(
        select(Follow.followed_id).where(Follow.follower_id == user_id)
        .order_by(Follow.created_at.desc())
    )).scalars().all()

    if not followed_ids:
        return {"users": []}

    users = (await db.execute(
        select(User.id, User.username, User.avatar).where(User.id.in_(followed_ids))
    )).all()
    id_order = {uid: i for i, uid in enumerate(followed_ids)}
    result = sorted(
        [{"id": uid, "username": uname, "avatar": avatar} for uid, uname, avatar in users],
        key=lambda x: id_order.get(x["id"], 9999),
    )
    return {"users": result}


@router.get("/{user_id}/favorites")
async def get_user_favorites(user_id: int, page: int = 1, per_page: int = Query(20, le=100),
                             db: AsyncSession = Depends(get_db)):
    """作者收藏的视频"""
    q = (select(Favorite).options(selectinload(Favorite.video).selectinload(Video.author_rel))
         .where(Favorite.user_id == user_id)
         .order_by(Favorite.created_at.desc()))
    items, total, pages = await paginate(db, q, page, per_page)
    return {
        "favorites": [{"created_at": h.created_at.isoformat(), "video": h.video.to_dict()}
                      for h in items if h.video],
        "total": total, "pages": pages, "current_page": page,
    }


class ProfileUpdate(BaseModel):
    bio: Optional[str] = None


@router.put("/profile")
async def update_profile(data: ProfileUpdate,
                         db: AsyncSession = Depends(get_db),
                         user: User = Depends(get_current_user)):
    """修改个人简介"""
    if data.bio is not None:
        user.bio = data.bio.strip()
    await db.commit()
    return {"message": "Profile updated", "user": {"id": user.id, "bio": user.bio, "avatar": user.avatar}}


@router.post("/profile/avatar", status_code=201)
async def upload_avatar(avatar: UploadFile = File(...),
                        db: AsyncSession = Depends(get_db),
                        user: User = Depends(get_current_user)):
    """上传/修改头像"""
    ext = _ext(avatar.filename)
    if ext not in ("jpg", "jpeg", "png", "gif", "webp"):
        raise HTTPException(400, "不支持的头像格式")

    content = await avatar.read()
    if not content or not _check_image_magic(content):
        raise HTTPException(400, "无效的图片内容")
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(413, "头像文件太大")

    filename = f"avatar_{user.id}_{uuid.uuid4().hex}.{ext}"
    async with aiofiles.open(settings.UPLOAD_FOLDER / filename, "wb") as f:
        await f.write(content)

    # 删除旧头像
    if user.avatar:
        old = settings.UPLOAD_FOLDER / user.avatar
        if old.exists():
            old.unlink()

    user.avatar = filename
    await db.commit()
    return {"message": "Avatar updated", "avatar": filename}
