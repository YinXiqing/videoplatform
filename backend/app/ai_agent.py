import os
import json
import re
import aiohttp
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Video, User
from app.database import AsyncSessionLocal
from app.system_map import SYSTEM_MAP, get_system_context

LOCAL_MODEL_URL = os.getenv("LOCAL_MODEL_URL", "http://localhost:11434/api/chat")
LOCAL_MODEL_NAME = os.getenv("LOCAL_MODEL_NAME", "qwen3:0.6b")

async def search_videos(keyword: str, limit: int = 10):
    """搜索视频"""
    async with AsyncSessionLocal() as db:
        pat = f"%{keyword}%"
        q = select(Video).where(
            Video.status == "approved",
            or_(Video.title.ilike(pat), Video.description.ilike(pat), Video.tags.ilike(pat))
        ).limit(limit)
        result = await db.execute(q)
        videos = result.scalars().all()
        return [{"id": v.id, "title": v.title, "description": v.description, "tags": v.tags} for v in videos]

async def get_video_detail(video_id: int):
    """获取视频详情"""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Video).where(Video.id == video_id))
        video = result.scalar_one_or_none()
        if not video:
            return {"error": "视频不存在"}
        return video.to_dict()

async def list_pending_videos(limit: int = 10):
    """获取待审核视频"""
    async with AsyncSessionLocal() as db:
        q = select(Video).where(Video.status == "pending").limit(limit)
        result = await db.execute(q)
        videos = result.scalars().all()
        return [{"id": v.id, "title": v.title, "description": v.description} for v in videos]

async def approve_video(video_id: int):
    """审核通过"""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Video).where(Video.id == video_id))
        video = result.scalar_one_or_none()
        if not video:
            return {"error": "视频不存在"}
        video.status = "approved"
        await db.commit()
        return {"status": "success", "message": f"视频 {video.title} 已审核通过"}

async def reject_video(video_id: int):
    """拒绝视频"""
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Video).where(Video.id == video_id))
        video = result.scalar_one_or_none()
        if not video:
            return {"error": "视频不存在"}
        video.status = "rejected"
        await db.commit()
        return {"status": "success", "message": f"视频 {video.title} 已被拒绝"}

async def parse_intent(user_message: str, page_elements: list = [], conversation_history: list = []):
    """使用本地模型解析用户意图，支持对话历史"""
    
    # 构建对话历史上下文
    history_context = ""
    if conversation_history:
        recent = conversation_history[-4:]  # 只保留最近4轮对话
        history_context = "\n\n【最近对话】\n" + "\n".join([
            f"用户: {h.get('user', '')}\nAI: {h.get('assistant', '')}" 
            for h in recent
        ])
    
    # 构建系统提示词
    system_prompt = f"""你是一个视频平台的智能助手。根据用户的指令，返回JSON格式的操作。

{get_system_context()}

当前页面可点击元素：{json.dumps([e.get('text') for e in page_elements[:20]], ensure_ascii=False)}

请根据用户指令，返回以下格式的JSON：
{{
  "action": "操作类型",
  "params": {{"关键参数"}},
  "response": "给用户的回复"
}}

操作类型说明：
- navigate: 跳转页面，params需要url（如 /login, /register, /upload, /admin 等）
- search: 搜索视频，params需要keyword
- play: 播放视频，params需要video_id（数字）
- approve: 审核通过视频，params需要video_id
- reject: 拒绝视频，params需要video_id
- click: 点击页面元素，params需要text（元素的文本内容）
- logout: 退出登录（无需params）
- help: 显示帮助（无需params）

【学习示例 - 仔细理解这些模式】

# 退出/登出类
用户："退出登录" → {{"action":"logout","params":{{}},"response":"正在退出登录"}}
用户："我想退出" → {{"action":"logout","params":{{}},"response":"正在退出登录"}}
用户："帮我登出" → {{"action":"logout","params":{{}},"response":"正在退出登录"}}
用户："下线" → {{"action":"logout","params":{{}},"response":"正在退出登录"}}

# 登录类
用户："去登录" → {{"action":"navigate","params":{{"url":"/login"}},"response":"正在打开登录页面"}}
用户："我要登录" → {{"action":"navigate","params":{{"url":"/login"}},"response":"正在打开登录页面"}}
用户："打开登录页" → {{"action":"navigate","params":{{"url":"/login"}},"response":"正在打开登录页面"}}

# 搜索类
用户："搜索编程" → {{"action":"search","params":{{"keyword":"编程"}},"response":"正在搜索编程相关视频"}}
用户："找一些Python视频" → {{"action":"search","params":{{"keyword":"Python"}},"response":"正在搜索Python相关视频"}}
用户："我想看教程" → {{"action":"search","params":{{"keyword":"教程"}},"response":"正在搜索教程相关视频"}}
用户："有没有关于AI的内容" → {{"action":"search","params":{{"keyword":"AI"}},"response":"正在搜索AI相关视频"}}

# 播放类
用户："播放视频1" → {{"action":"play","params":{{"video_id":1}},"response":"正在播放视频1"}}
用户："看第2个视频" → {{"action":"play","params":{{"video_id":2}},"response":"正在播放视频2"}}
用户："打开视频3" → {{"action":"play","params":{{"video_id":3}},"response":"正在播放视频3"}}
用户："我想看5号视频" → {{"action":"play","params":{{"video_id":5}},"response":"正在播放视频5"}}

# 导航类
用户："回首页" → {{"action":"navigate","params":{{"url":"/"}},"response":"正在打开首页"}}
用户："去上传页面" → {{"action":"navigate","params":{{"url":"/upload"}},"response":"正在打开上传页面"}}
用户："打开管理后台" → {{"action":"navigate","params":{{"url":"/admin"}},"response":"正在打开管理后台"}}
用户："我的视频" → {{"action":"navigate","params":{{"url":"/my-videos"}},"response":"正在打开我的视频"}}
用户："看看历史记录" → {{"action":"navigate","params":{{"url":"/history"}},"response":"正在打开观看历史"}}

# 审核类
用户："审核通过视频1" → {{"action":"approve","params":{{"video_id":1}},"response":"正在审核通过视频1"}}
用户："批准2号视频" → {{"action":"approve","params":{{"video_id":2}},"response":"正在审核通过视频2"}}
用户："拒绝视频3" → {{"action":"reject","params":{{"video_id":3}},"response":"正在拒绝视频3"}}

只返回JSON，不要其他内容。"""

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                LOCAL_MODEL_URL,
                json={
                    "model": LOCAL_MODEL_NAME,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message}
                    ],
                    "stream": False,
                    "format": "json"
                },
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                data = await response.json()
                content = data.get("message", {}).get("content", "{}")
                intent = json.loads(content)
                
                action = intent.get("action")
                params = intent.get("params", {})
                response_text = intent.get("response", "")
                
                # 根据意图执行操作
                if action == "logout":
                    return {
                        "action": "logout",
                        "ui_action": {"type": "click_by_text", "text": "退出登录"},
                        "response": response_text or "正在退出登录"
                    }
                
                elif action == "navigate":
                    url = params.get("url", "/")
                    return {
                        "action": "navigate",
                        "url": url,
                        "ui_action": {"type": "navigate", "url": url},
                        "response": response_text or f"正在跳转到 {url}"
                    }
                
                elif action == "search":
                    keyword = params.get("keyword", "")
                    result = await search_videos(keyword)
                    return {
                        "action": "search_videos",
                        "keyword": keyword,
                        "result": result,
                        "ui_action": {
                            "type": "fill_and_submit",
                            "selector": "input[placeholder='搜索视频...']",
                            "value": keyword
                        },
                        "response": response_text or f"找到 {len(result)} 个视频"
                    }
                
                elif action == "play":
                    video_id = params.get("video_id", 0)
                    return {
                        "action": "play_video",
                        "video_id": video_id,
                        "ui_action": {"type": "navigate", "url": f"/video/{video_id}"},
                        "response": response_text or f"正在播放视频 {video_id}"
                    }
                
                elif action == "approve":
                    video_id = params.get("video_id", 0)
                    result = await approve_video(video_id)
                    return {
                        "action": "approve_video",
                        "video_id": video_id,
                        "result": result,
                        "response": result.get("message", "操作完成")
                    }
                
                elif action == "reject":
                    video_id = params.get("video_id", 0)
                    result = await reject_video(video_id)
                    return {
                        "action": "reject_video",
                        "video_id": video_id,
                        "result": result,
                        "response": result.get("message", "操作完成")
                    }
                
                elif action == "click":
                    text = params.get("text", "")
                    return {
                        "action": "click",
                        "ui_action": {"type": "click_by_text", "text": text},
                        "response": response_text or f"正在点击 {text}"
                    }
                
                elif action == "help":
                    return {
                        "action": "help",
                        "response": get_system_context()
                    }
                
                else:
                    return {
                        "action": "unknown",
                        "response": response_text or "我理解了，但不确定如何操作"
                    }
    
    except Exception as e:
        # 如果模型调用失败，回退到关键词匹配
        return await parse_intent_fallback(user_message, page_elements)

async def parse_intent_fallback(user_message: str, page_elements: list = []):
    """关键词匹配作为后备方案"""
    msg = user_message.lower()
async def parse_intent_fallback(user_message: str, page_elements: list = []):
    """关键词匹配作为后备方案"""
    msg = user_message.lower()
    
    # 检查是否询问系统功能
    if "有什么功能" in msg or "能做什么" in msg or "帮助" in msg or "功能列表" in msg:
        return {
            "action": "help",
            "response": get_system_context()
        }
    
    # 使用系统映射进行智能导航
    for page_name, url in SYSTEM_MAP["navigation"].items():
        if page_name in msg or page_name.lower() in msg:
            return {
                "action": "navigate",
                "url": url,
                "ui_action": {"type": "navigate", "url": url},
                "response": f"正在打开{page_name}"
            }
    
    # 如果有页面元素，尝试智能匹配
    if page_elements and ("点击" in msg or "打开" in msg or "进入" in msg):
        target_text = re.sub(r'(点击|打开|进入|按钮|链接)', '', msg).strip()
        for elem in page_elements:
            elem_text = elem.get('text', '').lower()
            if target_text in elem_text or elem_text in target_text:
                return {
                    "action": "click_element",
                    "element": elem,
                    "ui_action": {"type": "click_selector", "selector": elem.get('selector')},
                    "response": f"正在点击「{elem.get('text')}」"
                }
    
    # 导航操作
    if "首页" in msg or "主页" in msg or "回到首页" in msg:
        return {
            "action": "navigate",
            "url": "/",
            "ui_action": {"type": "navigate", "url": "/"},
            "response": "正在打开首页"
        }
    
    if "上传" in msg and ("页面" in msg or "打开" in msg or "去" in msg):
        return {
            "action": "navigate",
            "url": "/upload",
            "ui_action": {"type": "navigate", "url": "/upload"},
            "response": "正在打开上传页面"
        }
    
    if "管理" in msg or "后台" in msg:
        return {
            "action": "navigate",
            "url": "/admin",
            "ui_action": {"type": "navigate", "url": "/admin"},
            "response": "正在打开管理后台"
        }
    
    if "登录" in msg or "登陆" in msg:
        return {
            "action": "navigate",
            "url": "/login",
            "ui_action": {"type": "navigate", "url": "/login"},
            "response": "正在打开登录页面"
        }
    
    if "注册" in msg:
        return {
            "action": "navigate",
            "url": "/register",
            "ui_action": {"type": "navigate", "url": "/register"},
            "response": "正在打开注册页面"
        }
    
    if "个人" in msg or "我的" in msg and "资料" in msg:
        return {
            "action": "navigate",
            "url": "/profile",
            "ui_action": {"type": "navigate", "url": "/profile"},
            "response": "正在打开个人资料页面"
        }
    
    if "历史" in msg or "观看历史" in msg:
        return {
            "action": "navigate",
            "url": "/history",
            "ui_action": {"type": "navigate", "url": "/history"},
            "response": "正在打开观看历史"
        }
    
    if "我的视频" in msg:
        return {
            "action": "navigate",
            "url": "/my-videos",
            "ui_action": {"type": "navigate", "url": "/my-videos"},
            "response": "正在打开我的视频"
        }
    
    # 搜索视频
    if "搜索" in msg or "找" in msg or "查找" in msg:
        keyword = re.sub(r'(搜索|找|查找|关于|的|视频)', '', msg).strip()
        if keyword:
            result = await search_videos(keyword)
            return {
                "action": "search_videos",
                "keyword": keyword,
                "result": result,
                "ui_action": {
                    "type": "fill_and_submit",
                    "selector": "input[placeholder='搜索视频...']",
                    "value": keyword
                },
                "response": f"找到 {len(result)} 个关于「{keyword}」的视频，正在为您搜索"
            }
    
    # 播放视频
    match = re.search(r'(\d+)', msg)
    if match and ("播放" in msg or "打开视频" in msg or "看视频" in msg):
        video_id = int(match.group(1))
        return {
            "action": "play_video",
            "video_id": video_id,
            "ui_action": {
                "type": "navigate",
                "url": f"/video/{video_id}"
            },
            "response": f"正在播放视频 {video_id}"
        }
    
    # 获取视频详情
    match = re.search(r'(视频|id)\s*(\d+)', msg)
    if match and ("详情" in msg or "详细" in msg or "查看" in msg or "获取" in msg):
        video_id = int(match.group(2))
        result = await get_video_detail(video_id)
        return {
            "action": "get_video_detail",
            "video_id": video_id,
            "result": result,
            "response": f"视频 {video_id} 的详细信息"
        }
    
    # 列出待审核视频
    if "待审核" in msg or "审核列表" in msg:
        result = await list_pending_videos()
        return {
            "action": "list_pending_videos",
            "result": result,
            "response": f"当前有 {len(result)} 个待审核视频"
        }
    
    # 审核通过
    match = re.search(r'(视频|id)\s*(\d+)', msg)
    if match and ("通过" in msg or "批准" in msg or "审核通过" in msg):
        video_id = int(match.group(2))
        result = await approve_video(video_id)
        return {
            "action": "approve_video",
            "video_id": video_id,
            "result": result,
            "response": result.get("message", "操作完成")
        }
    
    # 拒绝视频
    match = re.search(r'(视频|id)\s*(\d+)', msg)
    if match and ("拒绝" in msg or "不通过" in msg):
        video_id = int(match.group(2))
        result = await reject_video(video_id)
        return {
            "action": "reject_video",
            "video_id": video_id,
            "result": result,
            "response": result.get("message", "操作完成")
        }
    
    return {
        "action": "unknown",
        "response": "可以试试：\n• 搜索XX视频\n• 播放视频1\n• 打开首页/上传页面/登录/注册\n• 我的视频/观看历史\n• 列出待审核视频\n• 审核通过视频X"
    }

async def chat(user_message: str, page_elements: list = [], conversation_history: list = []):
    """处理用户消息，支持对话历史"""
    result = await parse_intent(user_message, page_elements, conversation_history)
    return {
        "response": result["response"],
        "actions": [result] if result.get("result") or result.get("ui_action") else [],
        "ui_action": result.get("ui_action")
    }
