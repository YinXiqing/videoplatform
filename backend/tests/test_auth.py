"""认证路由集成测试"""

import pytest


@pytest.mark.asyncio
async def test_register_success(client):
    """注册新用户应返回 201"""
    res = await client.post("/api/auth/register", json={
        "username": "testuser_auth",
        "email": "testauth@example.com",
        "password": "secret123",
    })
    assert res.status_code == 201
    data = res.json()
    assert "user" in data
    assert data["user"]["username"] == "testuser_auth"


@pytest.mark.asyncio
async def test_register_duplicate(client):
    """重复注册应返回 409"""
    payload = {"username": "testuser_dup", "email": "testdup@example.com", "password": "secret123"}
    r1 = await client.post("/api/auth/register", json=payload)
    assert r1.status_code == 201
    r2 = await client.post("/api/auth/register", json=payload)
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_register_weak_password(client):
    """弱密码应返回 400"""
    res = await client.post("/api/auth/register", json={
        "username": "weakpw",
        "email": "weak@example.com",
        "password": "12",
    })
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_register_invalid_email(client):
    """无效邮箱应返回 400"""
    res = await client.post("/api/auth/register", json={
        "username": "bademail",
        "email": "notanemail",
        "password": "secret123",
    })
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_login_success(client):
    """正确凭据登录应返回 200 + token"""
    # 先注册
    payload = {"username": "testuser_login", "email": "testlogin@example.com", "password": "secret123"}
    await client.post("/api/auth/register", json=payload)

    res = await client.post("/api/auth/login", json={
        "username": "testuser_login",
        "password": "secret123",
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["username"] == "testuser_login"


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    """错误密码应返回 401"""
    payload = {"username": "testuser_wrong", "email": "testwrong@example.com", "password": "secret123"}
    await client.post("/api/auth/register", json=payload)

    res = await client.post("/api/auth/login", json={
        "username": "testuser_wrong",
        "password": "wrong",
    })
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_login_nonexistent_user(client):
    """不存在的用户应返回 401"""
    res = await client.post("/api/auth/login", json={
        "username": "nobody",
        "password": "secret123",
    })
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_profile_unauthorized(client):
    """未登录访问 profile 应返回 401"""
    res = await client.get("/api/auth/profile")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_profile_authorized(client):
    """登录后可获取 profile"""
    payload = {"username": "testuser_prof", "email": "testprof@example.com", "password": "secret123"}
    await client.post("/api/auth/register", json=payload)
    login_res = await client.post("/api/auth/login", json={"username": "testuser_prof", "password": "secret123"})
    token = login_res.json()["access_token"]

    res = await client.get("/api/auth/profile", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["user"]["username"] == "testuser_prof"


@pytest.mark.asyncio
async def test_logout(client):
    """登出应返回 200 并清除 cookie"""
    payload = {"username": "testuser_out", "email": "testout@example.com", "password": "secret123"}
    await client.post("/api/auth/register", json=payload)
    await client.post("/api/auth/login", json={"username": "testuser_out", "password": "secret123"})

    res = await client.post("/api/auth/logout")
    assert res.status_code == 200
    # cookie 应包含 access_token="" 或已过期
    set_cookie = res.headers.get("set-cookie", "")
    assert "access_token=" in set_cookie
