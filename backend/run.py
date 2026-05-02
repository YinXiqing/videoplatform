import os, asyncio
import uvicorn
from app.logger import setup_logging

setup_logging()

from app import create_app

async def _init_db():
    from app.database import engine, Base
    # 导入所有模型，确保它们注册到 Base.metadata
    from app.models import User, Video, PasswordResetToken, WatchHistory, ScrapedVideoInfo, Favorite  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(_init_db())
    uvicorn.run("run:app", host="0.0.0.0", port=5000, workers=int(os.environ.get("WORKERS", 1)))

app = create_app()
