"""管理后台：统计 + 趋势"""

from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession
from app.deps import get_db, require_admin
from app.models import User, Video

router = APIRouter(tags=["admin"])


@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    total_users = (await db.execute(select(func.count(User.id)))).scalar_one()
    total_videos = (await db.execute(select(func.count(Video.id)))).scalar_one()
    pending = (await db.execute(select(func.count(Video.id)).where(Video.status == "pending"))).scalar_one()
    approved = (await db.execute(select(func.count(Video.id)).where(Video.status == "approved"))).scalar_one()
    total_views = (await db.execute(select(func.sum(Video.view_count)))).scalar_one() or 0
    return {"total_users": total_users, "total_videos": total_videos,
            "pending_videos": pending, "approved_videos": approved, "total_views": int(total_views)}


@router.get("/trends")
async def get_trends(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    """最近 7 天每日新增视频和播放量趋势"""
    today = datetime.now(timezone.utc).replace(tzinfo=None).date()
    video_trends = []
    view_trends = []
    labels = []

    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        labels.append(day.strftime("%m-%d"))
        day_start = datetime(day.year, day.month, day.day)
        day_end = day_start + timedelta(days=1)
        video_count = (await db.execute(
            select(func.count(Video.id)).where(
                Video.created_at >= day_start, Video.created_at < day_end
            )
        )).scalar_one()
        video_trends.append(video_count)
        view_count = (await db.execute(
            select(func.coalesce(func.sum(Video.view_count), 0)).where(
                Video.created_at >= day_start, Video.created_at < day_end
            )
        )).scalar_one()
        view_trends.append(int(view_count))

    return {"labels": labels, "video_trends": video_trends, "view_trends": view_trends}
