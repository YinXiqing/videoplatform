import json
from pydantic_settings import BaseSettings
from pathlib import Path
import os

BASE_DIR = Path(__file__).parent

class Settings(BaseSettings):
    SECRET_KEY: str
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 24

    DATABASE_URL: str = f"postgresql+asyncpg://videoplatform:videoplatform@localhost/videoplatform"

    UPLOAD_FOLDER: Path = BASE_DIR / "uploads"
    MAX_UPLOAD_SIZE: int = 500 * 1024 * 1024  # 500MB
    ALLOWED_VIDEO_EXTENSIONS: set = {"mp4", "avi", "mkv", "mov", "wmv", "flv"}
    ALLOWED_IMAGE_EXTENSIONS: set = {"jpg", "jpeg", "png", "gif", "webp"}

    CORS_ORIGINS: list[str] = ["http://localhost:3000"]


    RESEND_API_KEY: str = ""
    RESEND_FROM: str = "noreply@resend.dev"
    FRONTEND_URL: str = "http://localhost:3000"

    @property
    def YT_PROXY(self) -> str | None:
        return os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY") or None

    @property
    def YT_COOKIES_FILE(self) -> str | None:
        cf = os.environ.get("YTDLP_COOKIES_FILE") or ""
        return cf if cf and Path(cf).exists() else None

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
settings.UPLOAD_FOLDER.mkdir(exist_ok=True)