from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.ai_agent import chat

router = APIRouter(prefix="/api/ai", tags=["ai"])

class ChatRequest(BaseModel):
    message: str
    page_elements: list = []  # 页面元素列表

@router.post("/chat")
async def ai_chat(req: ChatRequest):
    """AI 助手对话"""
    try:
        result = await chat(req.message, req.page_elements)
        return result
    except Exception as e:
        raise HTTPException(500, str(e))
