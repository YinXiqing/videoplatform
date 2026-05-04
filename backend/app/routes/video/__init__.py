"""视频模块路由聚合"""

from fastapi import APIRouter
from .browse import router as browse_router
from .upload import router as upload_router
from .play import router as play_router
from .social import router as social_router

router = APIRouter(prefix="/api/video")
router.include_router(browse_router)
router.include_router(upload_router)
router.include_router(play_router)
router.include_router(social_router)
