"""视频浏览路由集成测试"""

import pytest


@pytest.mark.asyncio
async def test_list_videos_empty(client):
    """无视频时列表应返回空"""
    res = await client.get("/api/video/list")
    assert res.status_code == 200
    data = res.json()
    assert "videos" in data
    assert "total" in data
    assert "pages" in data
    assert isinstance(data["videos"], list)


@pytest.mark.asyncio
async def test_list_videos_pagination(client):
    """分页参数应正常返回"""
    res = await client.get("/api/video/list?page=1&per_page=5")
    assert res.status_code == 200
    data = res.json()
    assert data["current_page"] == 1
    assert data["per_page"] == 5


@pytest.mark.asyncio
async def test_suggest_empty(client):
    """空搜索应返回空建议"""
    res = await client.get("/api/video/suggest")
    assert res.status_code == 200
    data = res.json()
    assert data["suggestions"] == []


@pytest.mark.asyncio
async def test_suggest_with_query(client):
    """带查询词的搜索建议"""
    res = await client.get("/api/video/suggest?q=test")
    assert res.status_code == 200
    data = res.json()
    assert "suggestions" in data
    assert isinstance(data["suggestions"], list)


@pytest.mark.asyncio
async def test_video_detail_not_found(client):
    """不存在的视频详情应返回 404"""
    res = await client.get("/api/video/detail/99999")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_cover_not_found(client):
    """不存在的视频封面应返回 404"""
    res = await client.get("/api/video/cover/99999")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_stream_not_found(client):
    """不存在的视频流应返回 404"""
    res = await client.get("/api/video/stream/99999")
    assert res.status_code == 404


@pytest.mark.asyncio
async def test_my_videos_unauthorized(client):
    """未登录访问我的视频应返回 401"""
    res = await client.get("/api/video/my-videos")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_favorites_unauthorized(client):
    """未登录访问收藏应返回 401"""
    res = await client.get("/api/video/favorites")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_history_unauthorized(client):
    """未登录访问历史应返回 401"""
    res = await client.get("/api/video/history")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_rate_unauthorized(client):
    """未登录点赞应返回 401"""
    res = await client.post("/api/video/rate/1", json={"type": "like"})
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_admin_endpoints_forbidden(client):
    """非管理员访问管理端点应返回 401"""
    res = await client.get("/api/admin/users")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_admin_endpoints_with_user_token(client):
    """普通用户访问管理端点应返回 403"""
    # 注册并登录
    payload = {"username": "normaluser", "email": "normal@example.com", "password": "secret123"}
    await client.post("/api/auth/register", json=payload)
    login_res = await client.post("/api/auth/login", json={"username": "normaluser", "password": "secret123"})
    token = login_res.json()["access_token"]

    res = await client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 403
