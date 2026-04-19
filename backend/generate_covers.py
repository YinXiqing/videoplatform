#!/usr/bin/env python3
"""
为测试视频生成封面图片的脚本
"""

import os
import random
from PIL import Image, ImageDraw, ImageFont
import sys

def generate_cover_image(title, video_id, output_dir):
    """生成单个封面图片"""
    # 创建图片尺寸 (16:9 比例)
    width, height = 1280, 720
    
    # 创建新图片
    image = Image.new('RGB', (width, height), color=(random.randint(20, 60), random.randint(20, 60), random.randint(40, 80)))
    draw = ImageDraw.Draw(image)
    
    # 尝试使用系统字体，如果没有则使用默认字体
    try:
        # Windows系统字体
        font_large = ImageFont.truetype("arial.ttf", 60)
        font_small = ImageFont.truetype("arial.ttf", 30)
    except:
        try:
            # Linux/Mac系统字体
            font_large = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", 60)
            font_small = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", 30)
        except:
            # 使用默认字体
            font_large = ImageFont.load_default()
            font_small = ImageFont.load_default()
    
    # 添加装饰性背景图案
    for i in range(0, width, 100):
        for j in range(0, height, 100):
            if (i + j) % 200 == 0:
                draw.rectangle([i, j, i+80, j+80], fill=(random.randint(100, 150), random.randint(100, 150), random.randint(120, 170)))
    
    # 添加半透明覆盖层
    overlay = Image.new('RGBA', (width, height), (0, 0, 0, 100))
    image.paste(overlay, (0, 0), overlay)
    
    # 添加标题文字
    title_lines = []
    if len(title) > 20:
        # 分行显示长标题
        words = title.split()
        current_line = ""
        for word in words:
            if len(current_line + word) < 20:
                current_line += word + " "
            else:
                title_lines.append(current_line.strip())
                current_line = word + " "
        if current_line:
            title_lines.append(current_line.strip())
    else:
        title_lines.append(title)
    
    # 绘制标题
    y_offset = height // 2 - 50
    for line in title_lines[:3]:  # 最多显示3行
        # 计算文字位置使其居中
        bbox = draw.textbbox((0, 0), line, font=font_large)
        text_width = bbox[2] - bbox[0]
        x = (width - text_width) // 2
        
        # 绘制文字阴影
        draw.text((x+2, y_offset+2), line, fill=(0, 0, 0), font=font_large)
        # 绘制文字
        draw.text((x, y_offset), line, fill=(255, 255, 255), font=font_large)
        y_offset += 70
    
    # 添加视频ID标签
    id_text = f"Video #{video_id}"
    bbox = draw.textbbox((0, 0), id_text, font=font_small)
    text_width = bbox[2] - bbox[0]
    draw.text((width - text_width - 20, 20), id_text, fill=(255, 255, 255), font=font_small)
    
    # 添加装饰性边框
    border_color = (random.randint(150, 255), random.randint(150, 255), random.randint(150, 255))
    draw.rectangle([10, 10, width-10, height-10], outline=border_color, width=5)
    
    return image

def generate_all_covers():
    """为所有测试视频生成封面"""
    # 确保输出目录存在
    output_dir = os.path.join(os.path.dirname(__file__), 'uploads')
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # 测试视频标题列表
    video_titles = [
        'React 18 完整教程 - 从入门到精通',
        'Python Django 项目实战 - 电商网站开发',
        '机器学习入门 - 线性回归详解',
        'Vue 3 + TypeScript 实战项目',
        '数据结构与算法 - 二叉树完全指南',
        'Docker 容器化部署实战',
        'JavaScript 异步编程完全指南',
        'MySQL 数据库优化技巧',
        'React Native 移动应用开发',
        'Git 版本控制高级用法',
        'Node.js 微服务架构设计',
        'CSS Grid 布局完全教程',
        'API 设计最佳实践',
        'Webpack 5 配置与优化',
        'TypeScript 高级类型系统'
    ]
    
    # 为前15个具体视频生成封面
    cover_files = []
    for i, title in enumerate(video_titles, 1):
        image = generate_cover_image(title, i, output_dir)
        
        # 生成文件名
        cover_filename = f'cover_video_{i:02d}.png'
        cover_path = os.path.join(output_dir, cover_filename)
        
        # 保存图片
        image.save(cover_path, 'PNG')
        cover_files.append(cover_filename)
        print(f"✅ 生成封面: {cover_filename}")
    
    # 为剩余的测试视频生成通用封面
    for i in range(16, 50):
        title = f'测试视频 #{i} - 技术分享'
        image = generate_cover_image(title, i, output_dir)
        
        cover_filename = f'cover_video_{i:02d}.png'
        cover_path = os.path.join(output_dir, cover_filename)
        
        image.save(cover_path, 'PNG')
        cover_files.append(cover_filename)
        print(f"✅ 生成封面: {cover_filename}")
    
    print(f"\n🎨 总共生成了 {len(cover_files)} 个封面图片")
    print("📁 封面文件保存在:", output_dir)
    
    return cover_files

if __name__ == '__main__':
    try:
        generate_all_covers()
        print("\n✨ 封面生成完成！")
    except Exception as e:
        print(f"❌ 生成封面时出错: {e}")
        sys.exit(1)
