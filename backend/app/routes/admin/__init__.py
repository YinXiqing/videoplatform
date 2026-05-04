"""管理后台路由聚合"""

from fastapi import APIRouter
from .users import router as users_router
from .videos import router as videos_router
from .scraper import router as scraper_router
from .stats import router as stats_router

router = APIRouter(prefix="/api/admin")
router.include_router(users_router)
router.include_router(videos_router)
router.include_router(scraper_router)
router.include_router(stats_router)
