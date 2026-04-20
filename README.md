# 轻量级视频平台 (Video Platform)

一个基于 Next.js + FastAPI 的现代化视频分享平台。

## 🛠 技术栈

### 前端
- Next.js 16 + React 19（SSR + CSR 混合渲染）
- TypeScript
- Tailwind CSS 4
- Axios
- HLS.js（流媒体播放）

### 后端
- Python 3.12
- FastAPI + Uvicorn（4 worker 异步）
- SQLAlchemy 2.0（asyncio）
- PostgreSQL（asyncpg）
- python-jose（JWT）
- bcrypt（异步密码加密）
- aiofiles（异步文件 IO）
- aiohttp（异步 HTTP）
- yt-dlp + BeautifulSoup4（视频抓取）
- structlog（结构化日志）
- ffmpeg（视频时长提取、封面截图）

## 📁 项目结构

```
videoplatform/
├── service.sh               # 服务管理脚本
├── backend/
│   ├── app/
│   │   ├── __init__.py      # FastAPI 应用工厂（中间件、异常处理）
│   │   ├── models.py        # 数据库模型（User, Video, ScrapedVideoInfo, WatchHistory）
│   │   ├── database.py      # 异步数据库引擎（连接池）
│   │   ├── deps.py          # 依赖注入
│   │   ├── logger.py        # structlog 配置
│   │   └── routes/
│   │       ├── auth.py      # 认证路由
│   │       ├── video.py     # 视频路由（含观看历史）
│   │       └── admin.py     # 管理路由
│   ├── uploads/             # 上传文件存储
│   ├── config.py            # 配置（pydantic-settings）
│   ├── requirements.txt
│   └── run.py               # uvicorn 启动入口
│
└── frontend-next/
    ├── app/                 # Next.js App Router
    │   ├── page.tsx         # 首页（SSR）
    │   ├── login/
    │   ├── register/
    │   ├── profile/
    │   ├── upload/
    │   ├── search/          # 搜索页（SSR）
    │   ├── history/         # 观看历史
    │   ├── my-videos/
    │   ├── video/[id]/      # 视频详情（SSR + CSR 降级）
    │   └── admin/
    │       ├── page.tsx
    │       ├── users/
    │       ├── videos/
    │       └── scraper/
    ├── components/          # 公共组件
    ├── contexts/            # AuthContext
    ├── lib/                 # API 工具
    └── types/
```

## 🚀 快速开始

### 前置条件

- PostgreSQL 数据库：
  ```sql
  CREATE USER videoplatform WITH PASSWORD 'videoplatform';
  CREATE DATABASE videoplatform OWNER videoplatform;
  ```
- ffmpeg（视频处理）：
  ```bash
  sudo apt install ffmpeg   # Ubuntu/Debian
  ```

### 1. 配置后端环境变量

编辑 `backend/.env`：

```env
DATABASE_URL=postgresql+asyncpg://videoplatform:videoplatform@localhost/videoplatform
SECRET_KEY=your-secret-key
JWT_SECRET_KEY=your-jwt-secret-key
```

### 2. 启动后端

```bash
cd backend
uv venv .venv
source .venv/bin/activate
uv pip install -r requirements.txt
python run.py
```

后端 API 服务将在 http://localhost:5000 启动，API 文档见 http://localhost:5000/docs

### 3. 启动前端

```bash
cd frontend-next
pnpm install
pnpm dev
```

前端服务将在 http://localhost:3000 启动

### 4. 使用 service.sh 管理服务

```bash
./service.sh start     # 同时启动前后端
./service.sh stop      # 停止所有服务
./service.sh restart   # 重启
./service.sh status    # 查看运行状态
./service.sh backend   # 仅启动后端
./service.sh frontend  # 仅启动前端
```

### 5. 默认管理员账号

- 用户名: `admin` / 密码: `admin123`

## 🌟 功能特性

- 视频浏览、搜索（按标题、作者、简介），无限滚动加载
- 搜索历史记录（本地缓存）
- 用户注册、登录（JWT 认证，24 小时有效期）
- 视频上传（MP4/AVI/MKV/MOV/WMV/FLV，最大 500MB）
  - 自动提取视频时长
  - 无封面时自动截取第 1 秒作为封面
  - 上传后需管理员审核才公开展示
- 视频播放（支持 HLS 流媒体、进度记忆、播放失败自动刷新 URL）
- 播放量去重（同一用户 1 小时内不重复计数）
- 观看历史记录（登录用户）
- 个人视频管理（含列表内直接预览）
- 管理后台：用户管理、视频审核（含预览）、视频抓取（yt-dlp）

## 🔒 安全措施

- JWT Token 认证（Header + Cookie 双支持）
- bcrypt 密码加密（异步执行，不阻塞事件循环）
- SQLAlchemy ORM 参数化查询（防 SQL 注入）
- 文件上传类型和大小校验
- 速率限制（slowapi，200次/分钟）
- 请求体大小限制（非上传接口 1MB）
- 全局异常处理（500 错误统一返回 JSON）

## 📄 许可证

MIT License
