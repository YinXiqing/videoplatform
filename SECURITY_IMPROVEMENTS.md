# 安全改进说明

## ✅ 已完成的安全修复

### 1. 修复 datetime.utcnow() 弃用问题
- **文件**: `backend/app/models.py`, `backend/app/routes/auth.py`
- **改动**: 将所有 `datetime.utcnow()` 替换为 `datetime.now(timezone.utc)`
- **原因**: Python 3.12+ 中 `utcnow()` 已被弃用

### 2. 添加请求速率限制
- **文件**: `backend/app/__init__.py`, `backend/app/routes/auth.py`
- **依赖**: 新增 `slowapi==0.1.9`
- **限制规则**:
  - 全局: 200 请求/分钟
  - 登录: 10 请求/分钟
  - 注册: 5 请求/分钟
- **作用**: 防止暴力破解和 DDoS 攻击

### 3. 改进密钥配置
- **文件**: `backend/config.py`
- **改动**: 启动时检测默认密钥并显示警告
- **建议**: 生产环境必须在 `.env` 中设置强密钥
  ```bash
  SECRET_KEY=<生成的随机密钥>
  JWT_SECRET_KEY=<生成的随机密钥>
  ```

### 4. 改进 Token 存储方式
- **文件**: `backend/app/deps.py`, `backend/app/routes/auth.py`
- **改动**: 
  - 登录时设置 httpOnly cookie
  - 支持从 cookie 或 Authorization header 读取 token
  - 新增 `/api/auth/logout` 接口清除 cookie
- **安全性**: httpOnly cookie 防止 XSS 攻击窃取 token
- **兼容性**: 仍支持 Authorization header，前端可继续使用 localStorage 作为备用

### 5. 添加文件上传安全验证
- **文件**: `backend/app/routes/video.py`
- **改动**:
  - 验证文件魔数（magic bytes）而非仅检查扩展名
  - 支持的视频格式: MP4, MKV, AVI
  - 支持的图片格式: JPG, PNG, GIF, WebP
  - 封面图片大小限制: 10MB
- **作用**: 防止伪造扩展名上传恶意文件

## 📦 依赖变更

```diff
+ slowapi==0.1.9
```

安装命令:
```bash
cd backend
source .venv/bin/activate
uv pip install -r requirements.txt
```

## 🔧 配置建议

### 生产环境 `.env` 配置示例

```env
# 数据库
DATABASE_URL=postgresql+asyncpg://user:password@localhost/videoplatform

# 安全密钥（必须修改！）
SECRET_KEY=<使用 secrets.token_urlsafe(32) 生成>
JWT_SECRET_KEY=<使用 secrets.token_urlsafe(32) 生成>

# JWT 配置
JWT_EXPIRE_HOURS=24

# CORS（根据实际域名修改）
CORS_ORIGINS=["https://yourdomain.com"]
```

生成密钥命令:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

## 🚀 启动测试

```bash
# 后端
cd backend
source .venv/bin/activate
python run.py

# 前端
cd frontend-next
pnpm dev
```

启动后会看到密钥警告（如果使用默认值）:
```
⚠️  WARNING: Using default SECRET_KEY! Generate a secure key with:
   SECRET_KEY=<随机密钥>
⚠️  WARNING: Using default JWT_SECRET_KEY! Generate a secure key with:
   JWT_SECRET_KEY=<随机密钥>
```

## 📝 前端适配说明

后端现在支持两种认证方式，前端无需立即修改：

1. **继续使用 localStorage + Authorization header**（当前方式）
2. **使用 httpOnly cookie**（推荐，需修改前端）

如需使用 cookie 方式，前端需要：
- 登录后不再手动存储 token（后端自动设置 cookie）
- API 请求时移除 `Authorization` header（浏览器自动发送 cookie）
- 调用 `/api/auth/logout` 清除 cookie

## ⚠️ 注意事项

1. **生产环境必须使用 HTTPS**，否则 cookie 的 `secure` 标志无法生效
2. **修改 `auth.py` 中的 `secure=False` 为 `secure=True`**（需要 HTTPS）
3. **定期更新依赖**以修复安全漏洞
4. **监控速率限制日志**，调整限制规则

## 🔐 后续安全建议

- [ ] 添加 CSRF 保护
- [ ] 实现 2FA 双因素认证
- [ ] 添加日志审计系统
- [ ] 配置 CSP (Content Security Policy)
- [ ] 使用 Redis 存储速率限制数据（当前使用内存）
- [ ] 添加文件病毒扫描（ClamAV）
- [ ] 实现账号锁定机制（多次登录失败）
