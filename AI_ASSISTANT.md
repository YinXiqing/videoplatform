# AI 助手功能说明

## 功能概述

视频平台集成了本地大模型 AI 助手，用户可以通过自然语言指令直接操作平台功能，无需手动点击页面。

## 可用功能

### 1. 搜索视频
**指令示例：**
- "搜索关于编程的视频"
- "找一些关于 Python 的视频"
- "搜索标题包含'教程'的视频"

### 2. 获取视频详情
**指令示例：**
- "获取视频 ID 为 1 的详细信息"
- "查看视频 5 的详情"

### 3. 管理员功能

#### 查看待审核视频
**指令示例：**
- "列出所有待审核的视频"
- "显示待审核视频列表"

#### 审核通过视频
**指令示例：**
- "审核通过视频 ID 为 2 的视频"
- "批准视频 3"

#### 拒绝视频
**指令示例：**
- "拒绝视频 ID 为 4 的视频"
- "不通过视频 5"

## 使用方法

1. **访问 AI 助手页面**
   - 登录后点击用户菜单中的"AI 助手"
   - 或直接访问 `/ai-assistant`

2. **输入自然语言指令**
   - 在输入框中输入你的指令
   - 按回车或点击"发送"按钮

3. **查看执行结果**
   - AI 会自动调用相应的平台功能
   - 执行结果会显示在对话框中

## 技术实现

### 后端架构

**AI Agent 服务** (`backend/app/ai_agent.py`)
- 定义了平台操作工具（Tools）
- 使用 Function Calling 让模型调用工具
- 支持多轮对话和工具链式调用

**可用工具：**
```python
- search_videos: 搜索视频
- get_video_detail: 获取视频详情
- list_pending_videos: 列出待审核视频
- approve_video: 审核通过视频
- reject_video: 拒绝视频
```

**API 接口** (`backend/app/routes/ai.py`)
```
POST /api/ai/chat
Body: { "message": "用户指令" }
Response: { "response": "AI回复", "actions": [...] }
```

### 前端实现

**AI 助手页面** (`frontend-next/app/ai-assistant/page.tsx`)
- 聊天界面
- 实时显示 AI 执行的操作
- 支持查看工具调用结果

## 配置要求

### 环境变量
在 `backend/.env` 中配置：
```env
LOCAL_MODEL_URL=http://localhost:11434/api/chat
LOCAL_MODEL_NAME=qwen2.5:7b
```

### 本地模型要求
- 支持 Function Calling（工具调用）
- 推荐模型：Qwen2.5、Llama 3.1、Mistral 等
- 使用 Ollama 部署：
  ```bash
  ollama pull qwen2.5:7b
  ollama serve
  ```

## 扩展功能

可以轻松添加更多工具，例如：

### 视频上传
```python
{
    "name": "upload_video",
    "description": "上传视频",
    "parameters": {
        "title": "视频标题",
        "description": "视频描述",
        "url": "视频URL"
    }
}
```

### 用户管理
```python
{
    "name": "list_users",
    "description": "列出用户"
}
```

### 数据统计
```python
{
    "name": "get_statistics",
    "description": "获取平台统计数据"
}
```

## 注意事项

1. **权限控制**：管理员功能（审核视频）需要管理员权限
2. **错误处理**：如果工具调用失败，AI 会返回错误信息
3. **性能优化**：建议使用较小的模型（7B）以获得更快的响应速度
4. **隐私保护**：所有操作都在本地模型上执行，不会发送数据到外部服务

## 示例对话

**用户：** 搜索关于 Python 的视频

**AI：** 好的，我来帮你搜索关于 Python 的视频。

*执行操作：search_videos(keyword="Python", limit=10)*

**结果：**
```json
[
  {"id": 1, "title": "Python 入门教程", "description": "..."},
  {"id": 2, "title": "Python 进阶技巧", "description": "..."}
]
```

---

**用户：** 审核通过视频 1

**AI：** 好的，我来审核通过视频 1。

*执行操作：approve_video(video_id=1)*

**结果：**
```json
{"status": "success", "message": "视频 Python 入门教程 已审核通过"}
```
