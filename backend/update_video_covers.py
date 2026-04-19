#!/usr/bin/env python3
"""
更新现有视频的封面图片
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from app.models import Video

def update_video_covers():
    """更新现有视频的封面"""
    app = create_app()
    
    with app.app_context():
        print("开始更新视频封面...")
        
        # 获取所有没有封面的已审核视频
        videos_without_covers = Video.query.filter(
            (Video.cover_image.is_(None) | (Video.cover_image == '')) & 
            (Video.status == 'approved')
        ).all()
        
        print(f"找到 {len(videos_without_covers)} 个没有封面的已审核视频")
        
        # 封面文件列表
        available_covers = []
        for i in range(1, 50):  # cover_video_01.png 到 cover_video_49.png
            cover_file = f'cover_video_{i:02d}.png'
            cover_path = os.path.join('uploads', cover_file)
            if os.path.exists(cover_path):
                available_covers.append(cover_file)
        
        print(f"可用的封面文件: {len(available_covers)} 个")
        
        # 为没有封面的视频分配封面
        updated_count = 0
        for i, video in enumerate(videos_without_covers):
            if i < len(available_covers):
                video.cover_image = available_covers[i]
                updated_count += 1
                print(f"✅ 更新视频 '{video.title[:30]}...' 的封面为: {available_covers[i]}")
            else:
                print(f"⚠️  封面文件不足，无法为视频 '{video.title[:30]}...' 设置封面")
        
        # 提交更改
        try:
            db.session.commit()
            print(f"\n✅ 成功更新了 {updated_count} 个视频的封面!")
            
            # 显示统计信息
            total_approved = Video.query.filter_by(status='approved').count()
            videos_with_covers = Video.query.filter(
                Video.cover_image.isnot(None) & 
                (Video.cover_image != '') & 
                (Video.status == 'approved')
            ).count()
            
            print(f"📊 统计信息:")
            print(f"   - 总已审核视频: {total_approved}")
            print(f"   - 有封面的视频: {videos_with_covers}")
            print(f"   - 无封面的视频: {total_approved - videos_with_covers}")
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ 更新封面失败: {e}")

def show_sample_videos():
    """显示一些示例视频及其封面"""
    app = create_app()
    
    with app.app_context():
        print("\n📹 示例视频封面预览:")
        print("-" * 60)
        
        videos = Video.query.filter_by(status='approved').limit(10).all()
        for video in videos:
            cover_status = "✅ 有封面" if video.cover_image else "❌ 无封面"
            print(f"标题: {video.title[:40]}...")
            print(f"封面: {video.cover_image or 'None'} {cover_status}")
            print("-" * 60)

if __name__ == '__main__':
    update_video_covers()
    show_sample_videos()
