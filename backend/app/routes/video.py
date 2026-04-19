from flask import Blueprint, request, jsonify, send_from_directory, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from app.models import Video, User
from app import db
from werkzeug.utils import secure_filename
import os
import re
import uuid
from datetime import datetime

# 全局复用的 requests session（代理用）
import requests as _requests_module
_proxy_session = _requests_module.Session()
_proxy_session.trust_env = False
try:
    from moviepy.editor import VideoFileClip
    MOVIEPY_AVAILABLE = True
except ImportError:
    MOVIEPY_AVAILABLE = False

# 尝试导入OpenCV作为替代方案
try:
    import cv2
    OPENCV_AVAILABLE = True
except ImportError:
    OPENCV_AVAILABLE = False

print('video', __name__)

video_bp = Blueprint('video', __name__)

def allowed_file(filename, allowed_extensions):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions

def generate_filename(original_filename):
    ext = original_filename.rsplit('.', 1)[1].lower() if '.' in original_filename else 'mp4'
    return f"{uuid.uuid4().hex}.{ext}"

def get_video_duration(video_path):
    """获取视频时长（秒）"""
    try:
        # 检查文件是否存在
        if not os.path.exists(video_path):
            print(f"视频文件不存在: {video_path}")
            return None
            
        # 检查文件大小
        file_size = os.path.getsize(video_path)
        if file_size < 1024:  # 小于1KB可能是无效文件
            print(f"视频文件太小: {file_size} bytes")
            return None
        
        print(f"正在获取视频时长: {video_path} ({file_size} bytes)")
        
        # 优先使用OpenCV
        if OPENCV_AVAILABLE:
            try:
                cap = cv2.VideoCapture(video_path)
                if cap.isOpened():
                    fps = cap.get(cv2.CAP_PROP_FPS)
                    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                    duration = int(frame_count / fps) if fps > 0 else 0
                    
                    cap.release()
                    
                    if duration > 0:
                        print(f"✅ OpenCV获取视频时长成功: {duration} 秒")
                        return duration
                    else:
                        print("⚠️ OpenCV获取时长为0，尝试MoviePy")
            except Exception as e:
                print(f"⚠️ OpenCV获取时长失败: {e}")
        
        # 备用方案：使用MoviePy
        if MOVIEPY_AVAILABLE:
            try:
                with VideoFileClip(video_path) as clip:
                    duration = int(clip.duration)
                    print(f"✅ MoviePy获取视频时长成功: {duration} 秒")
                    return duration
            except Exception as e:
                print(f"⚠️ MoviePy获取时长失败: {e}")
        
        print("❌ 所有方案都失败，无法获取视频时长")
        return None
        
    except Exception as e:
        print(f"获取视频时长失败: {e}")
        return None

@video_bp.route('/list', methods=['GET'])
def list_videos():
    """Get list of approved videos with search and pagination"""
    # Query parameters
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 12, type=int)
    search = request.args.get('search', '').strip()
    tag = request.args.get('tag', '').strip()
    sort_by = request.args.get('sort', 'newest')  # newest, popular, oldest
    
    # Base query - filter by status if provided
    query = Video.query
    if 'status' in request.args:
        status = request.args.get('status')
        query = query.filter_by(status=status)
    else:
        # Default: only approved videos for public view
        query = query.filter_by(status='approved')
    
    # Search functionality
    if search:
        search_pattern = f'%{search}%'
        query = query.join(User).filter(
            db.or_(
                Video.title.ilike(search_pattern),
                User.username.ilike(search_pattern)
            )
        )

    # Tag filter
    if tag:
        query = query.filter(Video.tags.ilike(f'%{tag}%'))
    
    # Sorting
    if sort_by == 'popular':
        query = query.order_by(Video.view_count.desc())
    elif sort_by == 'oldest':
        query = query.order_by(Video.created_at.asc())
    else:  # newest (default)
        query = query.order_by(Video.created_at.desc())
    
    # Pagination
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'videos': [video.to_dict() for video in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': page,
        'per_page': per_page
    }), 200

@video_bp.route('/detail/<int:video_id>', methods=['GET'])
def get_video_detail(video_id):
    """Get video details"""
    video = Video.query.get_or_404(video_id)
    
    # Only show approved videos to public
    if video.status != 'approved':
        # Try to get current user from token
        current_user_id = None
        try:
            from flask_jwt_extended import verify_jwt_in_request
            verify_jwt_in_request()
            current_user_id = int(get_jwt_identity())
        except:
            # No valid token provided
            pass
        
        # Check if user is the owner or admin
        if not current_user_id:
            return jsonify({'error': 'Video not found'}), 404
        
        current_user = User.query.get(current_user_id)
        if not current_user or (current_user_id != video.user_id and current_user.role != 'admin'):
            return jsonify({'error': 'Video not found'}), 404
    
    # 如果是jiuselu2抓取的视频，先刷新URL
    final_video_url = video.source_url

    # 后台异步刷新 URL，TTL 10分钟内同一视频不重复刷新
    if video.is_scraped and video.page_url:
        import threading, time
        _refresh_cache = getattr(stream_video, '_refresh_cache', {})
        _refresh_lock = getattr(stream_video, '_refresh_lock', threading.Lock())
        stream_video._refresh_cache = _refresh_cache
        stream_video._refresh_lock = _refresh_lock

        now = time.time()
        with _refresh_lock:
            last = _refresh_cache.get(video_id, 0)
            should_refresh = (now - last) > 600  # 10分钟TTL
            if should_refresh:
                _refresh_cache[video_id] = now

        if should_refresh:
            def _refresh(app, video_id, page_url):
                with app.app_context():
                    try:
                        import yt_dlp
                        from app.models import Video
                        from app import db
                        ydl_opts = {'quiet': True, 'no_warnings': True, 'skip_download': True,
                                    'noplaylist': True, 'socket_timeout': 10}
                        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                            info = ydl.extract_info(page_url, download=False)
                        formats = info.get('formats', [])
                        m3u8_fmts = [f for f in formats if f.get('protocol') in ('m3u8', 'm3u8_native') and f.get('url')]
                        if m3u8_fmts:
                            new_url = max(m3u8_fmts, key=lambda f: f.get('height') or 0)['url']
                        else:
                            direct = [f for f in formats if f.get('url') and f.get('vcodec') != 'none']
                            new_url = max(direct, key=lambda f: f.get('height') or 0)['url'] if direct else info.get('url', '')
                        if new_url and new_url.endswith('.m3u') and not new_url.endswith('.m3u8'):
                            new_url += '8'
                        if new_url:
                            v = db.session.get(Video, video_id)
                            if v:
                                v.source_url = new_url
                                db.session.commit()
                                print(f'[bg] Refreshed video {video_id}: {new_url[:80]}')
                    except Exception as e:
                        print(f'[bg] Refresh failed for video {video_id}: {e}')
                        # 刷新失败时重置缓存，下次可以重试
                        with _refresh_lock:
                            _refresh_cache.pop(video_id, None)
            t = threading.Thread(target=_refresh, args=(current_app._get_current_object(), video_id, video.page_url), daemon=True)
            t.start()
            # 30秒超时看门狗：线程超时后重置缓存让下次可重试
            def _watchdog(thread, vid):
                thread.join(timeout=30)
                if thread.is_alive():
                    print(f'[bg] Refresh timeout for video {vid}, resetting cache')
                    with _refresh_lock:
                        _refresh_cache.pop(vid, None)
            threading.Thread(target=_watchdog, args=(t, video_id), daemon=True).start()
        else:
            print(f'[cache] Skip refresh for video {video_id}, refreshed {int(now-last)}s ago')
    
    video_data = video.to_dict()
    video_data['video_url'] = final_video_url
    return jsonify({'video': video_data}), 200

@video_bp.route('/stream/<int:video_id>', methods=['GET'])
def stream_video(video_id):
    """Stream video file or redirect to external URL"""
    video = Video.query.get_or_404(video_id)
    
    # Check access permissions
    if video.status not in ['approved', 'pending']:
        # Only approved and pending videos can be streamed
        try:
            from flask_jwt_extended import verify_jwt_in_request
            verify_jwt_in_request()
            current_user_id = int(get_jwt_identity())
        except:
            # No valid token provided
            return jsonify({'error': 'Access denied'}), 403
        
        # Check if user is the owner or admin
        current_user = User.query.get(current_user_id)
        if not current_user or (current_user_id != video.user_id and current_user.role != 'admin'):
            return jsonify({'error': 'Access denied'}), 403
    
    # Increment view count
    video.view_count += 1
    db.session.commit()
    
    # If it's an external video, return the URL for frontend to handle
    if video.is_scraped and video.source_url:
        return jsonify({
            'is_external': True,
            'video_url': video.source_url,
            'message': 'External video, use the provided URL'
        }), 200
    
    # Send local file
    upload_folder = current_app.config['UPLOAD_FOLDER']
    return send_from_directory(upload_folder, video.filename)

@video_bp.route('/cover/<int:video_id>', methods=['GET'])
def get_cover(video_id):
    """Get video cover image"""
    video = Video.query.get_or_404(video_id)
    
    # If it's an external video with external cover URL, return the URL
    if video.is_scraped and video.cover_image:
        # Check if it's a URL (starts with http)
        if video.cover_image.startswith('http'):
            return jsonify({
                'is_external': True,
                'cover_url': video.cover_image
            }), 200
    
    # For local cover images
    if video.cover_image:
        upload_folder = current_app.config['UPLOAD_FOLDER']
        return send_from_directory(upload_folder, video.cover_image)
    
    # Return default cover
    return jsonify({'error': 'No cover image'}), 404

@video_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_video():
    """Upload new video"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(int(user_id))
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Debug: Print request info
        print(f"Upload request - Files: {list(request.files.keys())}")
        print(f"Upload request - Form: {list(request.form.keys())}")
        
        # Check if video file is provided
        if 'video' not in request.files:
            return jsonify({'error': 'No video file provided'}), 400
        
        video_file = request.files['video']
        if video_file.filename == '':
            return jsonify({'error': 'No video file selected'}), 400
        
        # Validate video file
        allowed_video_extensions = current_app.config['ALLOWED_VIDEO_EXTENSIONS']
        if not allowed_file(video_file.filename, allowed_video_extensions):
            return jsonify({'error': f'Invalid video format. Allowed: {", ".join(allowed_video_extensions)}'}), 400
        
        # Get form data
        title = request.form.get('title', '').strip()
        description = request.form.get('description', '').strip()
        tags = request.form.get('tags', '').strip()
        
        print(f"Form data - Title: '{title}', Description: '{description}', Tags: '{tags}'")
        
        if not title:
            return jsonify({'error': 'Title is required'}), 400
        
        # Generate filename and save video
        filename = generate_filename(video_file.filename)
        upload_folder = current_app.config['UPLOAD_FOLDER']
        
        # Ensure upload folder exists
        os.makedirs(upload_folder, exist_ok=True)
        
        video_path = os.path.join(upload_folder, filename)
        video_file.save(video_path)
        
        # Get video duration
        duration = get_video_duration(video_path)
        print(f"Video duration: {duration} seconds")
        
        # Handle cover image
        cover_filename = None
        if 'cover' in request.files:
            cover_file = request.files['cover']
            if cover_file.filename != '':
                allowed_image_extensions = current_app.config['ALLOWED_IMAGE_EXTENSIONS']
                if allowed_file(cover_file.filename, allowed_image_extensions):
                    cover_filename = f"cover_{filename.rsplit('.', 1)[0]}.{cover_file.filename.rsplit('.', 1)[1].lower()}"
                    cover_path = os.path.join(upload_folder, cover_filename)
                    cover_file.save(cover_path)
        
        # Create video record
        video = Video(
            title=title,
            description=description,
            tags=tags,
            filename=filename,
            cover_image=cover_filename,
            file_size=os.path.getsize(video_path),
            duration=duration,
            user_id=int(user_id),
            status='pending'  # Videos need admin approval
        )
        
        db.session.add(video)
        db.session.commit()
        
        return jsonify({
            'message': 'Video uploaded successfully. Awaiting admin approval.',
            'video': video.to_dict()
        }), 201
        
    except Exception as e:
        print(f"Upload error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Upload failed: {str(e)}'}), 500

@video_bp.route('/refresh-url/<int:video_id>', methods=['GET'])
def refresh_video_url(video_id):
    """Force refresh video URL via yt-dlp (called on HLS error)"""
    video = Video.query.get_or_404(video_id)
    if not video.is_scraped or not video.page_url:
        return jsonify({'video_url': video.source_url}), 200
    try:
        import yt_dlp
        # 清除 TTL 缓存强制刷新
        cache = getattr(get_video_detail, '_refresh_cache', {})
        cache.pop(video_id, None)

        ydl_opts = {'quiet': True, 'no_warnings': True, 'skip_download': True,
                    'noplaylist': True, 'socket_timeout': 15}
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video.page_url, download=False)
        formats = info.get('formats', [])
        m3u8_fmts = [f for f in formats if f.get('protocol') in ('m3u8', 'm3u8_native') and f.get('url')]
        if m3u8_fmts:
            new_url = max(m3u8_fmts, key=lambda f: f.get('height') or 0)['url']
        else:
            direct = [f for f in formats if f.get('url') and f.get('vcodec') != 'none']
            new_url = max(direct, key=lambda f: f.get('height') or 0)['url'] if direct else info.get('url', '')
        if new_url and new_url.endswith('.m3u') and not new_url.endswith('.m3u8'):
            new_url += '8'
        if new_url:
            video.source_url = new_url
            db.session.commit()
        return jsonify({'video_url': new_url or video.source_url}), 200
    except Exception as e:
        return jsonify({'video_url': video.source_url, 'error': str(e)}), 200


@video_bp.route('/proxy', methods=['GET'])
def proxy_stream():
    """Proxy m3u8/ts requests to bypass CORS"""
    from flask import Response
    from urllib.parse import urlparse as _urlparse
    target_url = request.args.get('url')
    if not target_url:
        return jsonify({'error': 'url required'}), 400

    # SSRF 防护：黑名单模式，拒绝内网/本地地址
    BLOCKED = re.compile(
        r'^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.0\.0\.0|::1|fd[0-9a-f]{2}:)',
        re.IGNORECASE
    )
    try:
        host = _urlparse(target_url).hostname or ''
        if not host or BLOCKED.match(host):
            return jsonify({'error': 'Blocked address'}), 403
        # 只允许 http/https
        scheme = _urlparse(target_url).scheme
        if scheme not in ('http', 'https'):
            return jsonify({'error': 'Invalid scheme'}), 403
    except Exception:
        return jsonify({'error': 'Invalid URL'}), 400

    try:
        headers = {'User-Agent': 'Mozilla/5.0', 'Referer': target_url}
        r = _proxy_session.get(target_url, headers=headers, timeout=15, verify=False,
                    proxies={'http': None, 'https': None}, stream=True)
        r.raise_for_status()
        content_type = r.headers.get('Content-Type', 'application/octet-stream')

        # 如果是 m3u8，重写其中的相对 ts 路径为代理路径
        if 'm3u8' in content_type or '.m3u8' in target_url:
            from urllib.parse import urljoin, urlparse, urlunparse
            # 去掉 query string 再算 base
            parsed = urlparse(target_url)
            clean = urlunparse((parsed.scheme, parsed.netloc, parsed.path, '', '', ''))
            base = clean.rsplit('/', 1)[0] + '/'
            lines = []
            for line in r.text.splitlines():
                stripped = line.strip()
                if stripped and not stripped.startswith('#'):
                    abs_url = urljoin(base, stripped)
                    lines.append(f'http://localhost:5000/api/video/proxy?url={abs_url}')
                else:
                    lines.append(line)
            body = '\n'.join(lines)
            return Response(body, content_type='application/vnd.apple.mpegurl',
                            headers={'Access-Control-Allow-Origin': '*'})

        # ts 片段流式透传
        return Response(
            r.iter_content(chunk_size=8192),
            content_type=content_type,
            headers={'Access-Control-Allow-Origin': '*'}
        )

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@video_bp.route('/my-videos', methods=['GET'])
@jwt_required()
def get_my_videos():
    """Get current user's videos"""
    user_id = get_jwt_identity()
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    
    query = Video.query.filter_by(user_id=user_id).order_by(Video.created_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'videos': [video.to_dict() for video in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': page,
        'per_page': per_page
    }), 200

@video_bp.route('/my-videos/<int:video_id>/edit', methods=['PUT'])
@jwt_required()
def update_user_video(video_id):
    """Update video information (owner only)"""
    current_user_id = int(get_jwt_identity())
    
    video = Video.query.get_or_404(video_id)
    
    # Check if user is the owner
    if video.user_id != current_user_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    
    # Update allowed fields
    if 'title' in data:
        video.title = data['title']
    if 'description' in data:
        video.description = data['description']
    if 'tags' in data:
        # Convert list to comma-separated string
        if isinstance(data['tags'], list):
            video.tags = ','.join(data['tags'])
        else:
            video.tags = data['tags']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Video updated successfully',
        'video': video.to_dict()
    }), 200

@video_bp.route('/my-videos/<int:video_id>/delete', methods=['DELETE'])
@jwt_required()
def delete_user_video(video_id):
    """Delete video (owner only)"""
    current_user_id = int(get_jwt_identity())
    
    video = Video.query.get_or_404(video_id)
    
    # Check if user is the owner
    if video.user_id != current_user_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Delete video file and cover if they exist
    upload_folder = current_app.config['UPLOAD_FOLDER']
    if video.filename:
        video_path = os.path.join(upload_folder, video.filename)
        if os.path.exists(video_path):
            os.remove(video_path)
    
    if video.cover_image:
        cover_path = os.path.join(upload_folder, video.cover_image)
        if os.path.exists(cover_path):
            os.remove(cover_path)
    
    # Delete video record
    db.session.delete(video)
    db.session.commit()
    
    return jsonify({'message': 'Video deleted successfully'}), 200
