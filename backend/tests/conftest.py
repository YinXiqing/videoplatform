"""测试配置和 fixtures"""

import os
import sys

# 将 backend 项目根目录加入 sys.path，确保 app 包可导入
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app import create_app


@pytest_asyncio.fixture
async def client() -> AsyncClient:
    """提供测试 HTTP 客户端"""
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
