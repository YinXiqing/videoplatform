"""收藏、历史记录"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, delete as sa_delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.deps import get_db, get_current_user
from app.models import Video, WatchHistory, Favorite, User

router = APIRouter(tags=["video"])


@router.post("/history/{video_id}", status_code=200)
async def record_history(video_id: int, db: AsyncSession = Depends(get_db),
                         user: User = Depends(get_current_user)):
    video = await db.get(Video, video_id)
    if not video or video.status != "approved":
        return {"ok": False}
    existing = (await db.execute(
        select(WatchHistory).where(WatchHistory.user_id == user.id, WatchHistory.video_id == video_id)
    )).scalar_one_or_none()
    if existing:
        existing.watched_at = datetime.now(timezone.utc).replace(tzinfo=None)
    else:
        db.add(WatchHistory(user_id=user.id, video_id=video_id))
    await db.commit()
    return {"ok": True}


@router.get("/history")
async def get_history(page: int = 1, per_page: int = Query(20, le=100),
                      db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    q = (select(WatchHistory)
         .options(selectinload(WatchHistory.video).selectinload(Video.author_rel))
         .where(WatchHistory.user_id == user.id)
         .order_by(WatchHistory.watched_at.desc()))
    total = (await db.execute(select(func.count()).select_from(q.order_by(None).subquery()))).scalar_one()
    items = (await db.execute(q.offset((page - 1) * per_page).limit(per_page))).scalars().all()
    return {
        "history": [{"watched_at": h.watched_at.isoformat(), "video": h.video.to_dict()}
                    for h in items if h.video],
        "total": total, "pages": -(-total // per_page), "current_page": page,
    }


@router.delete("/history")
async def clear_history(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await db.execute(sa_delete(WatchHistory).where(WatchHistory.user_id == user.id))
    await db.commit()
    return {"message": "History cleared"}


@router.post("/favorite/{video_id}")
async def toggle_favorite(video_id: int, db: AsyncSession = Depends(get_db),
                          user: User = Depends(get_current_user)):
    video = await db.get(Video, video_id)
    if not video or video.status != "approved":
        raise HTTPException(404, "视频不存在")
    existing = (await db.execute(
        select(Favorite).where(Favorite.user_id == user.id, Favorite.video_id == video_id)
    )).scalar_one_or_none()
    if existing:
        await db.delete(existing)
        await db.commit()
        return {"favorited": False}
    db.add(Favorite(user_id=user.id, video_id=video_id))
    await db.commit()
    return {"favorited": True}


@router.get("/favorites")
async def get_favorites(page: int = 1, per_page: int = Query(20, le=100),
                        db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    q = (select(Favorite)
         .options(selectinload(Favorite.video).selectinload(Video.author_rel))
         .where(Favorite.user_id == user.id)
         .order_by(Favorite.created_at.desc()))
    total = (await db.execute(select(func.count()).select_from(q.order_by(None).subquery()))).scalar_one()
    items = (await db.execute(q.offset((page - 1) * per_page).limit(per_page))).scalars().all()
    return {
        "favorites": [{"created_at": h.created_at.isoformat(), "video": h.video.to_dict()}
                      for h in items if h.video],
        "total": total, "pages": -(-total // per_page), "current_page": page,
    }


@router.get("/favorited/{video_id}")
async def check_favorited(video_id: int, db: AsyncSession = Depends(get_db),
                          user: User = Depends(get_current_user)):
    existing = (await db.execute(
        select(Favorite).where(Favorite.user_id == user.id, Favorite.video_id == video_id)
    )).scalar_one_or_none()
    return {"favorited": existing is not None}
