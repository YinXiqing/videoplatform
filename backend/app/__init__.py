from contextlib import asynccontextmanager
import time, uuid
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.logger import logger, request_id_ctx
from app.limiter import limiter
from config import settings

async def _run_migrations():
    """自动数据库迁移：检测模型变更并同步到数据库（启动时自动执行）"""
    import asyncio, os, sys
    from alembic.config import Config
    from alembic import command

    cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))

    def _sync():
        try:
            command.upgrade(cfg, "head")
            return True
        except Exception as e:
            print(f"[migrate] {e}", file=sys.stderr)
            return False

    ok = await asyncio.to_thread(_sync)
    if ok:
        return

    # 兜底：create_all 建表（首次部署或 alembic 失败时）
    try:
        from app.database import engine, Base
        from app.models import User, Video, PasswordResetToken, WatchHistory, ScrapedVideoInfo, Favorite  # noqa: F401
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        # 标记迁移头，后续增量走 alembic
        await asyncio.to_thread(lambda: command.stamp(cfg, "head"))
        print("[migrate] Database tables created")
    except Exception as e:
        print(f"[migrate] create_all failed: {e}", file=sys.stderr)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 自动数据库迁移
    await _run_migrations()

    # 重置上次异常中断的下载任务
    from app.database import AsyncSessionLocal
    from app.models import ScrapedVideoInfo
    from sqlalchemy import update as sa_update
    async with AsyncSessionLocal() as db:
        await db.execute(
            sa_update(ScrapedVideoInfo)
            .where(ScrapedVideoInfo.download_status == "downloading")
            .values(download_status="failed", download_progress=0)
        )
        await db.commit()
    yield
    from app.routes.video.helpers import async_close_session
    await async_close_session()

class RequestIDMiddleware(BaseHTTPMiddleware):
    """为每个请求注入唯一 request_id，写入日志上下文和响应头"""
    async def dispatch(self, request: Request, call_next):
        rid = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:12]
        request_id_ctx.set(rid)
        response = await call_next(request)
        response.headers["X-Request-ID"] = rid
        return response

class LimitBodySizeMiddleware(BaseHTTPMiddleware):
    """非上传接口限制请求体 1MB"""
    async def dispatch(self, request: Request, call_next):
        if request.url.path != "/api/video/upload":
            content_length = request.headers.get("content-length")
            if content_length and int(content_length) > 1 * 1024 * 1024:
                return JSONResponse(status_code=413, content={"detail": "Request body too large"})
        return await call_next(request)

class AccessLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        t = time.perf_counter()
        response = await call_next(request)
        ms = round((time.perf_counter() - t) * 1000)
        logger.info("request", method=request.method, path=request.url.path, status=response.status_code, ms=ms)
        return response

def create_app() -> FastAPI:
    app = FastAPI(title="Video Platform API", lifespan=lifespan)
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    from starlette.middleware.gzip import GZipMiddleware
    app.add_middleware(GZipMiddleware, minimum_size=500)
    app.add_middleware(RequestIDMiddleware)
    app.add_middleware(LimitBodySizeMiddleware)
    app.add_middleware(AccessLogMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error("unhandled_exception", path=request.url.path, error=str(exc), exc_info=True)
        return JSONResponse(status_code=500, content={"detail": "Internal server error",
                                                       "request_id": request_id_ctx.get()})

    from app.routes.auth import router as auth_router
    from app.routes.video import router as video_router
    from app.routes.admin import router as admin_router
    from app.routes.health import router as health_router
    app.include_router(auth_router)
    app.include_router(video_router)
    app.include_router(admin_router)
    app.include_router(health_router)
    from app.routes.follow import router as follow_router
    app.include_router(follow_router)
    from app.routes.ws import router as ws_router
    app.include_router(ws_router)
    from app.routes.user import router as user_router
    app.include_router(user_router)

    return app
