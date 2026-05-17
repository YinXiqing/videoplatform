from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.deps import get_db, get_current_user, get_optional_user
from app.models import Follow, User, Video
from app.logger import logger
from app.routes.video.helpers import paginate

router = APIRouter(prefix="/api/follow", tags=["follow"])


@router.post("/{user_id}")
async def toggle_follow(user_id: int, db: AsyncSession = Depends(get_db),
                        user: User = Depends(get_current_user)):
    """关注/取消关注用户"""
    if user_id == user.id:
        raise HTTPException(400, "不能关注自己")

    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(404, "用户不存在")

    existing = (await db.execute(
        select(Follow).where(Follow.follower_id == user.id, Follow.followed_id == user_id)
    )).scalar_one_or_none()

    if existing:
        await db.delete(existing)
        await db.commit()
        return {"following": False}
    else:
        db.add(Follow(follower_id=user.id, followed_id=user_id))
        await db.commit()
        return {"following": True}


@router.get("/{user_id}/status")
async def check_follow(user_id: int, db: AsyncSession = Depends(get_db),
                       user: User = Depends(get_current_user)):
    """检查是否已关注"""
    existing = (await db.execute(
        select(Follow).where(Follow.follower_id == user.id, Follow.followed_id == user_id)
    )).scalar_one_or_none()
    return {"following": existing is not None}


@router.get("/{user_id}/count")
async def follow_count(user_id: int, db: AsyncSession = Depends(get_db)):
    """获取用户的关注数和粉丝数"""
    following = (await db.execute(
        select(func.count(Follow.id)).where(Follow.follower_id == user_id)
    )).scalar_one()
    followers = (await db.execute(
        select(func.count(Follow.id)).where(Follow.followed_id == user_id)
    )).scalar_one()
    return {"following": following, "followers": followers}


@router.get("/list")
async def list_following(db: AsyncSession = Depends(get_db),
                          user: User = Depends(get_current_user)):
    """获取当前用户关注的作者列表"""
    followed_ids = (await db.execute(
        select(Follow.followed_id).where(Follow.follower_id == user.id)
        .order_by(Follow.created_at.desc())
    )).scalars().all()

    if not followed_ids:
        return {"users": []}

    users = (await db.execute(
        select(User.id, User.username).where(User.id.in_(followed_ids))
    )).all()
    id_order = {uid: i for i, uid in enumerate(followed_ids)}
    result = sorted(
        [{"id": uid, "username": uname} for uid, uname in users],
        key=lambda x: id_order.get(x["id"], 9999),
    )
    return {"users": result}


@router.get("/feed")
async def subscription_feed(page: int = 1, per_page: int = 12,
                            db: AsyncSession = Depends(get_db),
                            user: User = Depends(get_current_user)):
    """获取已关注作者的视频流"""
    # 查询关注的作者 ID
    follows = (await db.execute(
        select(Follow.followed_id).where(Follow.follower_id == user.id)
    )).scalars().all()

    if not follows:
        return {"videos": [], "total": 0, "pages": 0, "current_page": page}

    q = (select(Video).options(selectinload(Video.author_rel))
         .where(Video.user_id.in_(follows), Video.status == "approved")
         .order_by(Video.created_at.desc()))

    items, total, pages = await paginate(db, q, page, per_page)
    return {"videos": [v.to_dict() for v in items], "total": total,
            "pages": pages, "current_page": page}
