"""测试配置和 fixtures"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("TESTING", "true")
os.environ.setdefault("LOG_JSON", "false")

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app import create_app
from app.limiter import limiter
from app.database import AsyncSessionLocal
from app.models import User
from sqlalchemy import delete


@pytest_asyncio.fixture(autouse=True)
def _disable_rate_limits():
    limiter.reset()


@pytest_asyncio.fixture(autouse=True)
async def _cleanup_db():
    """每个测试后清理测试用户数据"""
    yield
    async with AsyncSessionLocal() as db:
        for name in ("testuser_auth", "testuser_dup", "weakpw", "bademail",
                      "testuser_login", "testuser_wrong", "testuser_prof",
                      "testuser_out", "normaluser"):
            await db.execute(delete(User).where(User.username == name))
        await db.commit()


@pytest_asyncio.fixture
async def client() -> AsyncClient:
    """提供测试 HTTP 客户端"""
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
