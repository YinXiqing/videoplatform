from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, Boolean, BigInteger, DateTime, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
import bcrypt as _bcrypt
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="user")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    avatar: Mapped[str | None] = mapped_column(String(255), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    videos: Mapped[list["Video"]] = relationship("Video", back_populates="author_rel", lazy="select")

    def set_password(self, password: str):
        self.password_hash = _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()

    def check_password(self, password: str) -> bool:
        try:
            return _bcrypt.checkpw(password.encode(), self.password_hash.encode())
        except Exception:
            return False

    def to_dict(self):
        return {
            "id": self.id, "username": self.username, "email": self.email,
            "role": self.role, "is_active": self.is_active,
            "avatar": self.avatar, "bio": self.bio,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Video(Base):
    __tablename__ = "videos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    tags: Mapped[str | None] = mapped_column(String(500))
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    cover_image: Mapped[str | None] = mapped_column(String(255))
    file_size: Mapped[int | None] = mapped_column(BigInteger)
    duration: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    source_url: Mapped[str | None] = mapped_column(Text)
    page_url: Mapped[str | None] = mapped_column(Text)
    http_headers: Mapped[str | None] = mapped_column(Text)  # JSON，存抓取时的请求头
    is_scraped: Mapped[bool] = mapped_column(Boolean, default=False)
    hls_ready: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    author_rel: Mapped["User"] = relationship("User", back_populates="videos")

    __table_args__ = (
        Index("ix_video_title_trgm", "title", postgresql_using="gin",
              postgresql_ops={"title": "gin_trgm_ops"}),
        Index("ix_video_tags_trgm", "tags", postgresql_using="gin",
              postgresql_ops={"tags": "gin_trgm_ops"}),
        Index("ix_video_status_created", "status", "created_at"),
    )

    def to_dict(self):
        if self.is_scraped and self.source_url:
            play_url = self.source_url  # 外链视频直接用源 URL（经 proxy 播放）
        elif self.hls_ready:
            play_url = f"/api/video/hls/{self.id}/index.m3u8"
        else:
            play_url = f"/api/video/file/{self.id}"

        return {
            "id": self.id, "title": self.title, "description": self.description,
            "tags": self.tags.split(",") if self.tags else [],
            "filename": self.filename, "cover_image": self.cover_image,
            "file_size": self.file_size, "duration": self.duration,
            "status": self.status, "view_count": self.view_count,
            "user_id": self.user_id,
            "author": self.author_rel.username if self.author_rel else None,
            "source_url": self.source_url,
            "video_url": play_url,
            "page_url": self.page_url, "is_scraped": self.is_scraped,
            "http_headers": self.http_headers,
            "hls_ready": self.hls_ready,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }



class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, default=False)


class WatchHistory(Base):
    __tablename__ = "watch_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    video_id: Mapped[int] = mapped_column(Integer, ForeignKey("videos.id"), nullable=False, index=True)
    watched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    video: Mapped["Video"] = relationship("Video", lazy="select")

    __table_args__ = (
        UniqueConstraint("user_id", "video_id", name="uq_user_video_watch"),
        Index("ix_watch_history_user_video_time", "user_id", "video_id", "watched_at"),
    )


class Favorite(Base):
    __tablename__ = "favorites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    video_id: Mapped[int] = mapped_column(Integer, ForeignKey("videos.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    video: Mapped["Video"] = relationship("Video", lazy="select")

    __table_args__ = (UniqueConstraint("user_id", "video_id", name="uq_user_video_favorite"),)


class Follow(Base):
    __tablename__ = "follows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    follower_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    followed_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (UniqueConstraint("follower_id", "followed_id", name="uq_follow"),)


class ScrapedVideoInfo(Base):
    __tablename__ = "scraped_videos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    cover_url: Mapped[str | None] = mapped_column(Text)
    video_url: Mapped[str | None] = mapped_column(Text)
    duration: Mapped[int] = mapped_column(Integer, default=0)
    tags: Mapped[str | None] = mapped_column(String(500))
    scraped_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    http_headers: Mapped[str | None] = mapped_column(Text)
    # 下载状态
    download_status: Mapped[str] = mapped_column(String(20), default="none")  # none/downloading/done/failed
    download_progress: Mapped[int] = mapped_column(Integer, default=0)
    local_filename: Mapped[str | None] = mapped_column(String(255))
    is_m3u8: Mapped[bool] = mapped_column(Boolean, default=False)
    video_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
