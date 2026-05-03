"""WebSocket 实时推送"""

import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.logger import logger

router = APIRouter(tags=["ws"])

# 连接池：{task_id: [websocket, ...]}
_connections: dict[str, list[WebSocket]] = {}


async def notify(task_id: str, data: dict):
    """向订阅了该 task_id 的所有客户端推送消息"""
    if task_id not in _connections:
        return
    dead = []
    for ws in _connections[task_id]:
        try:
            await ws.send_json(data)
        except Exception:
            dead.append(ws)
    for ws in dead:
        _connections[task_id].remove(ws)
    if not _connections[task_id]:
        del _connections[task_id]


@router.websocket("/ws/progress/{task_id}")
async def progress_ws(websocket: WebSocket, task_id: str):
    await websocket.accept()
    _connections.setdefault(task_id, []).append(websocket)
    try:
        while True:
            # 保持连接，等待客户端断开
            await websocket.receive_text()
    except WebSocketDisconnect:
        if task_id in _connections:
            _connections[task_id].remove(websocket)
            if not _connections[task_id]:
                del _connections[task_id]
