import time, os, asyncio
from sqlalchemy import event
from sqlalchemy.exc import OperationalError, DBAPIError
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from config import settings
import logging

_log = logging.getLogger("sqlalchemy.retry")

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=int(os.environ.get("DB_POOL_SIZE", 5)),
    max_overflow=int(os.environ.get("DB_MAX_OVERFLOW", 10)),
    connect_args={
        "server_settings": {"statement_timeout": os.environ.get("DB_STATEMENT_TIMEOUT", "30000")},
    },
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


# 慢查询日志：超过 200ms 自动记录 warning
@event.listens_for(engine.sync_engine, "before_cursor_execute")
def _before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    conn.info["_query_start"] = time.monotonic()

@event.listens_for(engine.sync_engine, "after_cursor_execute")
def _after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    elapsed = time.monotonic() - conn.info.pop("_query_start", time.monotonic())
    if elapsed > 0.2:
        import logging
        logger = logging.getLogger("sqlalchemy.slow")
        logger.warning(f"Slow query ({elapsed*1000:.0f}ms): {statement[:300]}")


class Base(DeclarativeBase):
    pass


async def with_transient_retry(fn, max_retries: int = 3, base_delay: float = 0.2):
    """包装数据库操作，对瞬时错误自动重试"""
    last_err = None
    for attempt in range(max_retries):
        try:
            return await fn()
        except (OperationalError, DBAPIError) as e:
            last_err = e
            msg = str(e).lower()
            # 只重试连接断开、死锁、序列化失败等瞬时错误
            if any(kw in msg for kw in ("connection", "server closed", "deadlock", "serialization", "timeout")):
                wait = base_delay * (2 ** attempt)
                _log.warning(f"db retry {attempt+1}/{max_retries} after {wait:.1f}s: {e}")
                await asyncio.sleep(wait)
            else:
                raise
    raise last_err  # type: ignore[misc]
