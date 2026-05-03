FROM python:3.12-slim

WORKDIR /app

# 安装系统依赖（ffmpeg 使用 imageio-ffmpeg 静态包，不需要系统安装）
RUN apt-get update && apt-get install -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
RUN pip install uv && uv sync --no-dev

COPY . .

EXPOSE 5000

CMD ["uv", "run", "python", "-c", "import asyncio; from app.database import engine, Base; from app.models import User, Video, PasswordResetToken, WatchHistory, ScrapedVideoInfo, Favorite; asyncio.run(engine.run_sync(Base.metadata.create_all)); asyncio.run(engine.dispose()); import uvicorn; uvicorn.run('run:app', host='0.0.0.0', port=5000)"]
