import json
import aiohttp
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.deps import get_db
from app.models import Video, User
from config import settings

router = APIRouter(prefix="/api/chat", tags=["chat"])

OLLAMA_URL = getattr(settings, "OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = getattr(settings, "OLLAMA_MODEL", "qwen3:0.6b")

SYSTEM_PROMPT = """你是这个视频平台的专属 AI 助手，完全熟悉平台的所有功能和操作。

## 平台概述
基于 Next.js 16 + FastAPI 的视频分享平台，支持视频上传、抓取、审核、播放。

## 用户功能
- 注册/登录（JWT 认证，24小时有效）
- 浏览首页视频，无限滚动加载
- 搜索视频（按标题、作者、简介），支持搜索历史
- 观看视频（HLS 流媒体，支持进度记忆）
- 观看历史记录
- 个人中心：修改邮箱/密码
- 上传视频（MP4/AVI/MKV/MOV/WMV/FLV，最大500MB）
  - 上传后需管理员审核才公开
  - 自动提取时长，自动截取封面

## 管理员功能
- 用户管理：查看/禁用/删除用户，修改角色
- 视频管理：审核（通过/拒绝）、编辑、删除、批量操作
- 视频抓取（yt-dlp）：
  1. 输入视频页面 URL，点击"开始抓取"获取视频信息
  2. 点击"下载"将视频下载到本地并转为 HLS 分片
  3. 下载完成后点击"发布"，视频出现在首页
  4. 支持批量抓取（每行一个URL，最多20个）
  5. 支持批量下载、批量发布、批量删除
  6. 抓取列表分三个标签：全部/进行中/已发布
- 数据统计：用户数、视频数、播放量

## 技术架构
- 前端：Next.js 16 + React 19 + TypeScript + Tailwind CSS
- 后端：FastAPI + SQLAlchemy 2.0 + PostgreSQL + asyncpg
- 视频处理：ffmpeg（HLS转码）、yt-dlp（视频抓取）
- 认证：JWT Token（Header + Cookie 双支持）
- 播放：HLS.js 流媒体播放

## 默认账号
- 管理员：admin / admin123

## 注意事项
- 播放量去重：同一用户1小时内不重复计数
- 视频上传后自动后台转码为 HLS，转码完成前无法播放
- 抓取的视频必须先下载到本地才能发布，不支持外链直接发布

回答请简洁准确，使用中文。如果用户问的问题超出平台范围，也可以正常回答。"""


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


@router.post("/stream")
async def chat_stream(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    # 查询实时数据
    total_videos = (await db.execute(select(func.count(Video.id)).where(Video.status == "approved"))).scalar_one()
    total_users = (await db.execute(select(func.count(User.id)))).scalar_one()
    pending = (await db.execute(select(func.count(Video.id)).where(Video.status == "pending"))).scalar_one()
    total_views = (await db.execute(select(func.sum(Video.view_count)))).scalar_one() or 0

    # 最新10个视频
    recent_videos = (await db.execute(
        select(Video).where(Video.status == "approved").order_by(Video.created_at.desc()).limit(10)
    )).scalars().all()
    recent_str = "\n".join([f"- [{v.id}] {v.title}（{v.view_count}次播放，作者ID:{v.user_id}）" for v in recent_videos])

    # 播放量最高的5个视频
    top_videos = (await db.execute(
        select(Video).where(Video.status == "approved").order_by(Video.view_count.desc()).limit(5)
    )).scalars().all()
    top_str = "\n".join([f"- [{v.id}] {v.title}（{v.view_count}次）" for v in top_videos])

    system = SYSTEM_PROMPT + f"""

## 当前平台实时数据
- 已发布视频：{total_videos} 个
- 待审核视频：{pending} 个
- 注册用户：{total_users} 人
- 总播放量：{total_views} 次

## 最新发布的视频
{recent_str or '暂无'}

## 播放量最高的视频
{top_str or '暂无'}"""

    messages = [{"role": "system", "content": system}] + [m.model_dump() for m in req.messages]

    async def generate():
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{OLLAMA_URL}/api/chat",
                    json={"model": OLLAMA_MODEL, "messages": messages, "stream": True},
                    timeout=aiohttp.ClientTimeout(total=120),
                ) as resp:
                    async for line in resp.content:
                        text = line.decode().strip()
                        if not text:
                            continue
                        try:
                            data = json.loads(text)
                            content = data.get("message", {}).get("content", "")
                            if content:
                                yield f"data: {json.dumps({'content': content})}\n\n"
                            if data.get("done"):
                                yield "data: [DONE]\n\n"
                        except Exception:
                            continue
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
