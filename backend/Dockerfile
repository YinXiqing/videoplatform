FROM python:3.12-slim

WORKDIR /app

# 安装系统依赖（ffmpeg 使用 imageio-ffmpeg 静态包，不需要系统安装）
RUN apt-get update && apt-get install -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
RUN pip install uv && uv sync --no-dev

COPY . .

EXPOSE 5000

CMD ["uv", "run", "uvicorn", "run:app", "--host", "0.0.0.0", "--port", "5000"]
