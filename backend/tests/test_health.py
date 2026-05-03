"""健康检查端点测试"""

import pytest


@pytest.mark.asyncio
async def test_health_endpoint(client):
    """/health 应返回 200 及数据库状态"""
    response = await client.get("/health")
    data = response.json()

    assert response.status_code in (200, 503)
    assert "status" in data
    assert data["status"] in ("healthy", "unhealthy")
    assert "checks" in data
    assert "database" in data["checks"]
    assert "upload_directory" in data["checks"]
