#!/usr/bin/env python3
"""
测试视频详情页URL刷新功能
"""
import requests
import json

def test_video_detail_refresh():
    # 测试视频详情页API
    url = "http://localhost:5000/api/video/detail/1"
    
    try:
        print(f"Testing URL: {url}")
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print("✓ API request successful")
            
            if 'video' in data:
                video = data['video']
                print(f"Video ID: {video.get('id')}")
                print(f"Video Title: {video.get('title')}")
                print(f"Is Scraped: {video.get('is_scraped')}")
                print(f"Source URL: {video.get('source_url')}")
                print(f"Video URL: {video.get('video_url')}")
                
                # 检查是否有刷新后的URL
                if 'refreshed_video_url' in data:
                    print(f"✓ Refreshed Video URL: {data['refreshed_video_url']}")
                else:
                    print("- No refreshed_video_url in response")
                
                # 检查是否是jiuselu2视频
                if video.get('is_scraped') and video.get('source_url') and 'jiuselu2.com' in video.get('source_url'):
                    print("✓ This is a jiuselu2 video")
                    print("✓ URL refresh should have been triggered")
                else:
                    print("- This is not a jiuselu2 video")
                
            else:
                print("- No video data in response")
        else:
            print(f"✗ API request failed with status code: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"✗ Error testing video detail: {e}")

if __name__ == "__main__":
    test_video_detail_refresh()