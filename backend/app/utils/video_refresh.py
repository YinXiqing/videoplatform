"""
视频URL刷新工具
处理动态变化的视频URL，特别是jiuselu2等网站
"""
import requests
from bs4 import BeautifulSoup
import re
import time
from urllib.parse import urlparse, urljoin
import logging

logger = logging.getLogger(__name__)

def refresh_jiuselu2_video_url(video_url, source_url, max_retries=3):
    """
    刷新jiuselu2视频URL
    
    Args:
        video_url (str): 当前视频URL
        source_url (str): 原始页面URL
        max_retries (int): 最大重试次数
    
    Returns:
        str: 刷新后的视频URL，如果失败则返回原URL
    """
    if not source_url or 'jiuselu2.com' not in source_url:
        return video_url
    
    logger.info(f"开始刷新jiuselu2视频URL: {source_url}")
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'DNT': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Referer': source_url,
        'Origin': f"{'https' if source_url.startswith('https') else 'http'}://{urlparse(source_url).netloc}"
    }
    
    for attempt in range(max_retries):
        try:
            logger.info(f"尝试刷新视频URL (第{attempt + 1}次)")
            
            # 使用session保持连接
            session = requests.Session()
            session.trust_env = False
            
            # 获取页面内容
            response = session.get(
                source_url, 
                headers=headers, 
                timeout=15, 
                allow_redirects=True, 
                verify=False,
                proxies={'http': None, 'https': None}
            )
            response.raise_for_status()
            
            # 解析HTML
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # 提取新的视频URL
            new_video_url = _extract_jiuselu2_video_url(soup, source_url)
            
            if new_video_url and new_video_url != video_url:
                logger.info(f"成功刷新视频URL: {new_video_url[:100]}...")
                return new_video_url
            else:
                logger.info("未找到新的视频URL，可能URL未变化")
                return video_url
                
        except Exception as e:
            logger.error(f"第{attempt + 1}次刷新失败: {str(e)}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)  # 指数退避
            continue
    
    logger.warning(f"视频URL刷新失败，使用原URL: {video_url[:100]}...")
    return video_url

def _extract_jiuselu2_video_url(soup, source_url):
    """
    从jiuselu2页面提取视频URL
    
    Args:
        soup: BeautifulSoup对象
        source_url: 原始页面URL
    
    Returns:
        str: 视频URL
    """
    video_url = ''
    
    # 方法1: 查找script标签中的m3u8链接
    scripts = soup.find_all('script')
    logger.info(f"找到 {len(scripts)} 个script标签")
    for i, script in enumerate(scripts):
        if script.string:
            logger.info(f"检查script标签 {i+1}/{len(scripts)}")
            # 查找m3u8链接的模式
            m3u8_patterns = [
                r'https?://[^\\s\"\\'<>]+\\.m3u8[^\\s\"\\'<>]*',
                r'[\\'\\\"]([^\\']*\\.m3u8[^\\\"]*)[\\'\\\"]',
                r'src:\\s*[\\'\\\"]([^\\']*\\.m3u8[^\\\"]*)[\\'\\\"]',
                r'file:\\s*[\\'\\\"]([^\\']*\\.m3u8[^\\\"]*)[\\'\\\"]',
                r'videoUrl:\\s*[\\'\\\"]([^\\']*\\.m3u8[^\\\"]*)[\\'\\\"]',
                r'source:\\s*[\\'\\\"]([^\\']*\\.m3u8[^\\\"]*)[\\'\\\"]',
                r'player\\s*:\\s*{[^}]*url\\s*:\\s*[\\'\\\"]([^\\']*\\.m3u8[^\\\"]*)[\\'\\\"]',
                r'video\\s*:\\s*{[^}]*src\\s*:\\s*[\\'\\\"]([^\\']*\\.m3u8[^\\\"]*)[\\'\\\"]'
            ]
            
            for pattern in m3u8_patterns:
                matches = re.findall(pattern, script.string, re.IGNORECASE)
                if matches:
                    video_url = matches[0]
                    logger.info(f"在script标签 {i+1} 中找到m3u8: {video_url[:100]}...")
                    return _normalize_video_url(video_url, source_url)
    
    # 方法2: 查找video标签
    video_tag = soup.find('video', src=True)
    if video_tag:
        video_url = video_tag.get('src', '')
        if '.m3u8' in video_url:
            logger.info(f"在video标签中找到m3u8: {video_url[:100]}...")
            return _normalize_video_url(video_url, source_url)
    
    # 方法3: 查找source标签
    source_tags = soup.find_all('source', src=True)
    logger.info(f"找到 {len(source_tags)} 个source标签")
    for i, source in enumerate(source_tags):
        src = source.get('src', '')
        if '.m3u8' in src:
            logger.info(f"在source标签 {i+1}/{len(source_tags)} 中找到m3u8: {src[:100]}...")
            return _normalize_video_url(src, source_url)
    
    # 方法4: 查找iframe
    iframes = soup.find_all('iframe')
    logger.info(f"找到 {len(iframes)} 个iframe")
    for i, iframe in enumerate(iframes):
        src = iframe.get('src', '')
        if '.m3u8' in src or '/embed/' in src:
            logger.info(f"在iframe {i+1}/{len(iframes)} 中找到视频: {src[:100]}...")
            return _normalize_video_url(src, source_url)
    
    # 方法5: 查找其他可能的视频格式
    if not video_url:
        # 查找直接的视频链接
        video_patterns = [
            r'https?://[^\\s\"\\'<>]+\\.mp4[^\\s\"\\'<>]*',
            r'https?://[^\\s\"\\'<>]+\\.webm[^\\s\"\\'<>]*',
            r'https?://[^\\s\"\\'<>]+\\.flv[^\\s\"\\'<>]*',
            r'https?://[^\\s\"\\'<>]+\\.ts[^\\s\"\\'<>]*'
        ]
        
        for i, script in enumerate(scripts):
            if script.string:
                for pattern in video_patterns:
                    matches = re.findall(pattern, script.string, re.IGNORECASE)
                    if matches:
                        video_url = matches[0]
                        logger.info(f"在script标签 {i+1} 中找到其他视频格式: {video_url[:100]}...")
                        return _normalize_video_url(video_url, source_url)
    
    # 方法6: 查找data属性
    data_video_url = soup.find(attrs={'data-video-url': True})
    if data_video_url:
        video_url = data_video_url.get('data-video-url', '')
        if video_url:
            logger.info(f"在data属性中找到视频URL: {video_url[:100]}...")
            return _normalize_video_url(video_url, source_url)
    
    # 方法7: 查找JSON数据
    json_scripts = soup.find_all('script', type='application/json')
    logger.info(f"找到 {len(json_scripts)} 个JSON script标签")
    for i, script in enumerate(json_scripts):
        if script.string:
            try:
                json_data = json.loads(script.string)
                if isinstance(json_data, dict):
                    # 查找常见的视频URL字段
                    video_url_fields = ['videoUrl', 'video_url', 'src', 'url', 'video', 'source']
                    for field in video_url_fields:
                        if field in json_data:
                            video_url = json_data[field]
                            if isinstance(video_url, str) and ('.m3u8' in video_url or '.mp4' in video_url):
                                logger.info(f"在JSON数据中找到视频URL (字段: {field}): {video_url[:100]}...")
                                return _normalize_video_url(video_url, source_url)
                    
                    # 查找嵌套结构
                    for key, value in json_data.items():
                        if isinstance(value, dict):
                            for field in video_url_fields:
                                if field in value:
                                    video_url = value[field]
                                    if isinstance(video_url, str) and ('.m3u8' in video_url or '.mp4' in video_url):
                                        logger.info(f"在嵌套JSON数据中找到视频URL (字段: {field}): {video_url[:100]}...")
                                        return _normalize_video_url(video_url, source_url)
            except json.JSONDecodeError:
                continue
    
    logger.info(f"未找到视频URL，返回空字符串")
    return video_url

def _normalize_video_url(video_url, source_url):
    """
    标准化视频URL
    
    Args:
        video_url: 视频URL
        source_url: 源页面URL
    
    Returns:
        str: 标准化后的URL
    """
    if not video_url:
        return video_url
    
    # 处理相对URL
    if video_url.startswith('//'):
        video_url = 'https:' + video_url
    elif video_url.startswith('/'):
        parsed_url = urlparse(source_url)
        video_url = f"{parsed_url.scheme}://{parsed_url.netloc}{video_url}"
    elif not video_url.startswith('http'):
        # 可能是相对路径，尝试补全
        parsed_url = urlparse(source_url)
        base_url = f"{parsed_url.scheme}://{parsed_url.netloc}"
        video_url = urljoin(base_url, video_url)
    
    return video_url