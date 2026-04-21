import os
import base64
import asyncio
import aiohttp
from pathlib import Path

LOCAL_VISION_MODEL = os.getenv("LOCAL_VISION_MODEL", "llava:7b")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")

async def extract_video_frames(video_path: str, num_frames: int = 3) -> list:
    """从视频中提取关键帧"""
    import subprocess
    import tempfile
    
    frames = []
    temp_dir = Path(tempfile.mkdtemp())
    
    try:
        # 使用 ffmpeg 提取帧
        duration_cmd = [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(video_path)
        ]
        result = subprocess.run(duration_cmd, capture_output=True, text=True)
        duration = float(result.stdout.strip())
        
        # 在视频的不同时间点截取帧
        for i in range(num_frames):
            timestamp = (duration / (num_frames + 1)) * (i + 1)
            output_path = temp_dir / f"frame_{i}.jpg"
            
            cmd = [
                "ffmpeg", "-ss", str(timestamp), "-i", str(video_path),
                "-vframes", "1", "-q:v", "2", str(output_path)
            ]
            subprocess.run(cmd, capture_output=True)
            
            if output_path.exists():
                with open(output_path, "rb") as f:
                    frames.append(base64.b64encode(f.read()).decode())
        
        return frames
    finally:
        # 清理临时文件
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)

async def analyze_video_content(video_path: str) -> dict:
    """分析视频内容，生成标题和标签"""
    
    # 1. 提取视频帧
    frames = await extract_video_frames(video_path, num_frames=3)
    
    if not frames:
        return {
            "title": "未命名视频",
            "tags": [],
            "error": "无法提取视频帧"
        }
    
    # 2. 使用视觉模型分析第一帧（最清晰）
    prompt = """请分析这个视频截图，生成：
1. 一个吸引人的视频标题（不超过30字）
2. 5个相关标签

只返回JSON格式：
{"title": "标题", "tags": ["标签1", "标签2", "标签3", "标签4", "标签5"]}"""

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": LOCAL_VISION_MODEL,
                    "prompt": prompt,
                    "images": [frames[0]],  # 使用第一帧
                    "stream": False,
                    "format": "json"
                },
                timeout=aiohttp.ClientTimeout(total=60)
            ) as response:
                data = await response.json()
                content = data.get("response", "{}")
                
                import json
                result = json.loads(content)
                
                return {
                    "title": result.get("title", "未命名视频"),
                    "tags": result.get("tags", [])
                }
    except Exception as e:
        return {
            "title": "未命名视频",
            "tags": [],
            "error": str(e)
        }

async def analyze_video_with_filename(video_path: str, filename: str) -> dict:
    """结合文件名和视频内容分析"""
    
    # 分析视频内容
    video_analysis = await analyze_video_content(video_path)
    
    # 如果视频分析失败，使用文件名
    if video_analysis.get("error"):
        # 从文件名提取信息
        name = Path(filename).stem
        return {
            "title": name,
            "tags": name.split("_")[:5],  # 简单分词
            "source": "filename"
        }
    
    return {
        **video_analysis,
        "source": "video_content"
    }
