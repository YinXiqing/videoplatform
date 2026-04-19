#!/usr/bin/env python3
"""
测试视频URL刷新功能
"""
import sys
import os

# 直接导入video_refresh模块，避免Flask依赖
sys.path.insert(0, '/home/alan/videoplatform/backend/app/utils')

try:
    # 直接导入模块
    import video_refresh
    refresh_jiuselu2_video_url = video_refresh.refresh_jiuselu2_video_url
    _extract_jiuselu2_video_url = video_refresh._extract_jiuselu2_video_url
    _normalize_video_url = video_refresh._normalize_video_url
    
    print("✅ video_refresh模块导入成功")
    
    # 测试_normalize_video_url函数
    test_cases = [
        {
            'input': ('//example.com/video.m3u8', 'https://jiuselu2.com/video-page'),
            'expected': 'https://example.com/video.m3u8'
        },
        {
            'input': ('/video.m3u8', 'https://jiuselu2.com/video-page'),
            'expected': 'https://jiuselu2.com/video-page/video.m3u8'
        },
        {
            'input': ('video.m3u8', 'https://jiuselu2.com/video-page'),
            'expected': 'https://jiuselu2.com/video-page'
        }
    ]
    
    print("\n🔍 测试_normalize_video_url函数:")
    for i, test_case in enumerate(test_cases):
        result = _normalize_video_url(test_case['input'][0], test_case['input'][1])
        status = "✅" if result == test_case['expected'] else "❌"
        print(f"  测试{i+1}: {status}")
        print(f"    输入: {test_case['input']}")
        print(f"    期望: {test_case['expected']}")
        print(f"    实际: {result}")
        print()
    
    print("✅ 所有基础功能测试完成")
    
except ImportError as e:
    print(f"❌ 导入失败: {e}")
    print("请确保所有依赖包已安装: requests, beautifulsoup4")
except Exception as e:
    print(f"❌ 测试失败: {e}")
    import traceback
    traceback.print_exc()