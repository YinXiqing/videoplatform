"""WebSocket 实时推送"""

import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.logger import logger

router = APIRouter(tags=["ws"])

# 连接池：{task_id: [websocket, ...]}
_connections: dict[str, list[WebSocket]] = {}


async def _heartbeat(ws: WebSocket, interval: int = 30):
    """发送心跳 ping，保持连接存活"""
    while True:
        try:
            await asyncio.sleep(interval)
            await ws.send_json({"type": "ping"})
        except Exception:
            break


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
    heartbeat_task = asyncio.create_task(_heartbeat(websocket))
    try:
        while True:
            data = await asyncio.wait_for(websocket.receive_text(), timeout=60)
            try:
                msg = json.loads(data)
                if msg.get("type") == "pong":
                    continue
            except (json.JSONDecodeError, TypeError):
                pass
    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    finally:
        heartbeat_task.cancel()
        if task_id in _connections:
            _connections[task_id].remove(websocket)
            if not _connections[task_id]:
                del _connections[task_id]
