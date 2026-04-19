from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import User, Video, ScrapedVideoInfo
from app import db
from bs4 import BeautifulSoup
import requests
import re
from urllib.parse import urlparse

admin_bp = Blueprint('admin', __name__)

def admin_required(fn):
    """Decorator to check if user is admin"""
    @jwt_required()
    def wrapper(*args, **kwargs):
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user or user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        return fn(*args, **kwargs)
    
    wrapper.__name__ = fn.__name__
    return wrapper

# User Management
@admin_bp.route('/users', methods=['GET'])
@admin_required
def get_users():
    """Get all users with pagination"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    search = request.args.get('search', '').strip()
    
    query = User.query
    
    if search:
        search_pattern = f'%{search}%'
        query = query.filter(
            db.or_(
                User.username.ilike(search_pattern),
                User.email.ilike(search_pattern)
            )
        )
    
    pagination = query.order_by(User.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return jsonify({
        'users': [user.to_dict() for user in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': page,
        'per_page': per_page
    }), 200

@admin_bp.route('/users/<int:user_id>', methods=['PUT'])
@admin_required
def update_user(user_id):
    """Update user status or role"""
    user = User.query.get_or_404(user_id)
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Update role
    if 'role' in data and data['role'] in ['user', 'admin']:
        # Prevent changing own role
        current_user_id = get_jwt_identity()
        if user_id == current_user_id:
            return jsonify({'error': 'Cannot change your own role'}), 400
        user.role = data['role']
    
    # Update status
    if 'is_active' in data:
        # Prevent disabling own account
        current_user_id = get_jwt_identity()
        if user_id == current_user_id and not data['is_active']:
            return jsonify({'error': 'Cannot disable your own account'}), 400
        user.is_active = data['is_active']
    
    db.session.commit()
    
    return jsonify({
        'message': 'User updated successfully',
        'user': user.to_dict()
    }), 200

@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    """Delete user and their videos"""
    user = User.query.get_or_404(user_id)
    
    # Prevent deleting own account
    current_user_id = get_jwt_identity()
    if user_id == current_user_id:
        return jsonify({'error': 'Cannot delete your own account'}), 400
    
    # Delete user's videos (cascade delete)
    Video.query.filter_by(user_id=user_id).delete()
    
    db.session.delete(user)
    db.session.commit()
    
    return jsonify({'message': 'User deleted successfully'}), 200

# Video Management
@admin_bp.route('/videos', methods=['GET'])
@admin_required
def get_all_videos():
    """Get all videos for admin with filtering"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status = request.args.get('status', 'all')  # all, pending, approved, rejected
    search = request.args.get('search', '').strip()
    
    query = Video.query
    
    # Filter by status
    if status != 'all' and status in ['pending', 'approved', 'rejected']:
        query = query.filter_by(status=status)
    
    # Search
    if search:
        search_pattern = f'%{search}%'
        query = query.join(User).filter(
            db.or_(
                Video.title.ilike(search_pattern),
                Video.description.ilike(search_pattern),
                User.username.ilike(search_pattern)
            )
        )
    
    pagination = query.order_by(Video.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return jsonify({
        'videos': [video.to_dict() for video in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': page,
        'per_page': per_page
    }), 200

@admin_bp.route('/videos/<int:video_id>', methods=['PUT'])
@admin_required
def update_video(video_id):
    """Update video information or status"""
    video = Video.query.get_or_404(video_id)
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Update fields
    if 'title' in data:
        video.title = data['title'].strip()
    
    if 'description' in data:
        video.description = data['description'].strip()
    
    if 'tags' in data:
        # Convert list to comma-separated string or strip if string
        if isinstance(data['tags'], list):
            video.tags = ','.join(data['tags'])
        else:
            video.tags = data['tags'].strip()
    
    if 'status' in data and data['status'] in ['pending', 'approved', 'rejected']:
        video.status = data['status']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Video updated successfully',
        'video': video.to_dict()
    }), 200

@admin_bp.route('/videos/bulk-update', methods=['POST'])
@admin_required
def bulk_update_videos():
    """Bulk update video status"""
    data = request.get_json()
    
    if not data or 'video_ids' not in data or 'status' not in data:
        return jsonify({'error': 'Video IDs and status are required'}), 400
    
    video_ids = data['video_ids']
    status = data['status']
    
    if status not in ['pending', 'approved', 'rejected']:
        return jsonify({'error': 'Invalid status'}), 400
    
    updated_count = Video.query.filter(Video.id.in_(video_ids)).update(
        {'status': status}, synchronize_session=False
    )
    
    db.session.commit()
    
    return jsonify({
        'message': f'{updated_count} videos updated successfully',
        'updated_count': updated_count
    }), 200

@admin_bp.route('/videos/<int:video_id>', methods=['DELETE'])
@admin_required
def delete_video(video_id):
    """Delete video"""
    video = Video.query.get_or_404(video_id)
    
    # Delete file from storage
    import os
    try:
        upload_folder = current_app.config['UPLOAD_FOLDER']
        video_path = os.path.join(upload_folder, video.filename)
        if os.path.exists(video_path):
            os.remove(video_path)
        
        if video.cover_image:
            cover_path = os.path.join(upload_folder, video.cover_image)
            if os.path.exists(cover_path):
                os.remove(cover_path)
    except Exception as e:
        print(f"Error deleting files: {e}")
    
    db.session.delete(video)
    db.session.commit()
    
    return jsonify({'message': 'Video deleted successfully'}), 200

@admin_bp.route('/videos/bulk-delete', methods=['POST'])
@admin_required
def bulk_delete_videos():
    """Bulk delete videos"""
    data = request.get_json()
    
    if not data or 'video_ids' not in data:
        return jsonify({'error': 'Video IDs are required'}), 400
    
    video_ids = data['video_ids']
    
    # Get videos to delete their files
    videos = Video.query.filter(Video.id.in_(video_ids)).all()
    
    import os
    upload_folder = current_app.config['UPLOAD_FOLDER']
    
    for video in videos:
        try:
            video_path = os.path.join(upload_folder, video.filename)
            if os.path.exists(video_path):
                os.remove(video_path)
            
            if video.cover_image:
                cover_path = os.path.join(upload_folder, video.cover_image)
                if os.path.exists(cover_path):
                    os.remove(cover_path)
        except Exception as e:
            print(f"Error deleting files for video {video.id}: {e}")
    
    # Delete from database
    deleted_count = Video.query.filter(Video.id.in_(video_ids)).delete(
        synchronize_session=False
    )
    
    db.session.commit()
    
    return jsonify({
        'message': f'{deleted_count} videos deleted successfully',
        'deleted_count': deleted_count
    }), 200

# Video Scraping
@admin_bp.route('/scrape', methods=['POST'])
@admin_required
def scrape_video():
    """Scrape video information from external URL"""
    import os
    for key in ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'NO_PROXY', 'no_proxy']:
        os.environ.pop(key, None)

    data = request.get_json()
    if not data or 'url' not in data:
        return jsonify({'error': 'URL is required'}), 400

    url = data['url'].strip()

    title, cover_url, video_url = '', '', ''

    # --- 方案1: yt-dlp ---
    try:
        import yt_dlp
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
            'noplaylist': True,
            'socket_timeout': 15,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

        title = info.get('title', '')
        # yt-dlp 有时会在重复标题后加 " (N)" 后缀，去掉它
        import re as _re
        title = _re.sub(r'\s*\(\d+\)$', '', title).strip()
        cover_url = info.get('thumbnail', '')
        duration = int(info.get('duration') or 0)
        tags_str = ''  # yt-dlp 通常拿不到标签，后面用 BS 补充

        # 优先取 m3u8 格式
        formats = info.get('formats', [])
        m3u8_formats = [f for f in formats if f.get('protocol') in ('m3u8', 'm3u8_native') and f.get('url')]
        if m3u8_formats:
            # 取最高质量
            best = max(m3u8_formats, key=lambda f: f.get('height') or 0)
            video_url = best['url']
        elif not video_url:
            # 取直链
            direct = [f for f in formats if f.get('url') and f.get('vcodec') != 'none']
            if direct:
                best = max(direct, key=lambda f: f.get('height') or 0)
                video_url = best['url']

        # 如果 formats 为空，尝试顶层 url
        if not video_url:
            video_url = info.get('url', '')

        print(f"yt-dlp OK - title: {title[:60]}, video: {video_url[:80]}")

        # yt-dlp 通常拿不到标签，额外用 BS 抓一次
        try:
            _headers = {'User-Agent': 'Mozilla/5.0', 'Referer': url}
            _resp = requests.get(url, headers=_headers, timeout=10, verify=False, proxies={'http': None, 'https': None})
            _soup = BeautifulSoup(_resp.content, 'html.parser')
            og_tags = [t.get('content', '').strip() for t in _soup.find_all('meta', property='video:tag') if t.get('content')]
            if not og_tags:
                kw = _soup.find('meta', attrs={'name': 'keywords'})
                og_tags = [t.strip() for t in (kw.get('content', '') if kw else '').split(',') if t.strip()]
            tags_str = ','.join(og_tags[:15])
            print(f"Tags: {tags_str}")
        except Exception:
            pass

    except Exception as e:
        print(f"yt-dlp failed ({e}), falling back to BeautifulSoup")

        # --- 方案2: BeautifulSoup fallback ---
        try:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9',
                'Referer': url,
            }
            session = requests.Session()
            session.trust_env = False
            resp = session.get(url, headers=headers, timeout=15, verify=False, proxies={'http': None, 'https': None})
            resp.raise_for_status()
            soup = BeautifulSoup(resp.content, 'html.parser')

            og_title = soup.find('meta', property='og:title')
            title = og_title.get('content', '').strip() if og_title else ''
            if not title:
                t = soup.find('title')
                title = t.get_text().strip() if t else ''

            video_tag = soup.find('video', attrs={'data-poster': True})
            if video_tag:
                cover_url = video_tag.get('data-poster', '')
            if not cover_url:
                og_img = soup.find('meta', property='og:image')
                cover_url = og_img.get('content', '').strip() if og_img else ''

            if video_tag:
                video_url = video_tag.get('data-src', '')
            if not video_url:
                for script in soup.find_all('script'):
                    text = script.string or ''
                    m = re.search(r'["\']([^"\']*\.m3u8[^"\']*)["\']', text, re.IGNORECASE)
                    if m:
                        video_url = m.group(1)
                        break
            if not video_url:
                m = re.search(r'data-src=["\']([^"\']*\.m3u8[^"\']*)["\']', resp.text, re.IGNORECASE)
                if m:
                    video_url = m.group(1)

            # 标签
            og_tags = [t.get('content', '').strip() for t in soup.find_all('meta', property='video:tag') if t.get('content')]
            if not og_tags:
                kw = soup.find('meta', attrs={'name': 'keywords'})
                og_tags = [t.strip() for t in (kw.get('content', '') if kw else '').split(',') if t.strip()]
            tags_str = ','.join(og_tags[:15])

            print(f"BeautifulSoup OK - title: {title[:60]}, video: {video_url[:80]}")

        except Exception as e2:
            return jsonify({'error': f'抓取失败: {str(e2)}'}), 500

    if not title:
        title = 'Untitled Video'
    for u in [video_url, cover_url]:
        pass
    if video_url and video_url.startswith('//'):
        video_url = 'https:' + video_url
    if cover_url and cover_url.startswith('//'):
        cover_url = 'https:' + cover_url
    # 修复 yt-dlp 偶发的 .m3u 截断
    if video_url and video_url.endswith('.m3u') and not video_url.endswith('.m3u8'):
        video_url = video_url + '8'

    scraped = ScrapedVideoInfo(
        source_url=url, title=title, description='',
        video_url=video_url, cover_url=cover_url, duration=duration, tags=tags_str
    )
    db.session.add(scraped)
    db.session.commit()

    return jsonify({
        'message': '视频信息抓取成功',
        'scraped_info': {'source_url': url, 'title': title, 'description': '', 'video_url': video_url, 'cover_url': cover_url, 'tags': tags_str},
        'scraped_id': scraped.id
    }), 200

# ---- 以下旧抓取函数保留但不再使用 ----

@admin_bp.route('/scrape/batch', methods=['POST'])
@admin_required
def batch_scrape_videos():
    """Batch scrape multiple URLs"""
    data = request.get_json()
    if not data or 'urls' not in data:
        return jsonify({'error': 'urls required'}), 400

    urls = [u.strip() for u in data['urls'] if u.strip()]
    if not urls:
        return jsonify({'error': 'No valid URLs'}), 400
    if len(urls) > 20:
        return jsonify({'error': '最多一次提交20个URL'}), 400

    import threading
    results = []
    lock = threading.Lock()
    app = current_app._get_current_object()

    def _scrape_one(app, u):
        with app.app_context():
            try:
                import yt_dlp, re as _re
                ydl_opts = {'quiet': True, 'no_warnings': True, 'skip_download': True,
                            'noplaylist': True, 'socket_timeout': 15}
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(u, download=False)
                title = _re.sub(r'\s*\(\d+\)$', '', info.get('title', '') or '').strip() or 'Untitled'
                cover_url = info.get('thumbnail', '')
                duration = int(info.get('duration') or 0)
                formats = info.get('formats', [])
                m3u8_fmts = [f for f in formats if f.get('protocol') in ('m3u8', 'm3u8_native') and f.get('url')]
                if m3u8_fmts:
                    video_url = max(m3u8_fmts, key=lambda f: f.get('height') or 0)['url']
                else:
                    direct = [f for f in formats if f.get('url') and f.get('vcodec') != 'none']
                    video_url = max(direct, key=lambda f: f.get('height') or 0)['url'] if direct else info.get('url', '')
                if video_url and video_url.endswith('.m3u') and not video_url.endswith('.m3u8'):
                    video_url += '8'
                try:
                    _r = requests.get(u, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10, verify=False, proxies={'http': None, 'https': None})
                    _soup = BeautifulSoup(_r.content, 'html.parser')
                    og_tags = [t.get('content', '').strip() for t in _soup.find_all('meta', property='video:tag') if t.get('content')]
                    if not og_tags:
                        kw = _soup.find('meta', attrs={'name': 'keywords'})
                        og_tags = [t.strip() for t in (kw.get('content', '') if kw else '').split(',') if t.strip()]
                    tags_str = ','.join(og_tags[:15])
                except Exception:
                    tags_str = ''
                with lock:
                    scraped = ScrapedVideoInfo(source_url=u, title=title, description='',
                                               video_url=video_url, cover_url=cover_url,
                                               duration=duration, tags=tags_str)
                    db.session.add(scraped)
                    db.session.commit()
                    results.append({'url': u, 'success': True, 'title': title, 'scraped_id': scraped.id})
            except Exception as e:
                with lock:
                    results.append({'url': u, 'success': False, 'error': str(e)})

    threads = [threading.Thread(target=_scrape_one, args=(app, u,)) for u in urls]
    for t in threads: t.start()
    for t in threads: t.join(timeout=30)

    success = sum(1 for r in results if r.get('success'))
    return jsonify({'message': f'完成 {success}/{len(urls)} 个', 'results': results}), 200


@admin_bp.route('/scraped', methods=['GET'])
@admin_required
def get_scraped_videos():
    """Get list of scraped videos"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status = request.args.get('status', 'pending')
    
    query = ScrapedVideoInfo.query
    if status != 'all':
        query = query.filter_by(status=status)
    
    pagination = query.order_by(ScrapedVideoInfo.scraped_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return jsonify({
        'scraped_videos': [{
            'id': v.id,
            'source_url': v.source_url,
            'title': v.title,
            'description': v.description,
            'cover_url': v.cover_url,
            'video_url': v.video_url,
            'scraped_at': v.scraped_at.isoformat() if v.scraped_at else None,
            'status': v.status
        } for v in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'current_page': page,
        'per_page': per_page
    }), 200

@admin_bp.route('/scraped/<int:scraped_id>/import', methods=['POST'])
@admin_required
def import_scraped_video(scraped_id):
    """Import scraped video as a video record"""
    scraped = ScrapedVideoInfo.query.get_or_404(scraped_id)
    data = request.get_json() or {}

    # Create video record immediately with external cover URL
    video = Video(
        title=data.get('title', scraped.title) or 'Untitled Video',
        description=data.get('description', scraped.description) or '',
        tags=scraped.tags or '',
        source_url=scraped.video_url,
        page_url=scraped.source_url,
        cover_image=scraped.cover_url,  # 先用外部URL，后台异步下载
        duration=scraped.duration or 0,
        is_scraped=True,
        user_id=get_jwt_identity(),
        status='approved',
        filename='external_video',
        file_size=0,
    )
    
    db.session.add(video)
    scraped.status = 'published'
    db.session.commit()

    # 后台异步下载封面到本地
    if scraped.cover_url and scraped.cover_url.startswith('http'):
        import threading
        def _dl_cover(app, video_id, cover_url, upload_folder):
            with app.app_context():
                try:
                    import uuid, os
                    from app.models import Video
                    from app import db
                    ext = cover_url.split('?')[0].rsplit('.', 1)[-1].lower()
                    if ext not in ('jpg', 'jpeg', 'png', 'webp', 'gif'): ext = 'jpg'
                    fname = f"cover_{uuid.uuid4().hex}.{ext}"
                    os.makedirs(upload_folder, exist_ok=True)
                    r = requests.get(cover_url, timeout=10, verify=False,
                                     headers={'User-Agent': 'Mozilla/5.0'}, proxies={'http': None, 'https': None})
                    r.raise_for_status()
                    with open(os.path.join(upload_folder, fname), 'wb') as f:
                        f.write(r.content)
                    v = db.session.get(Video, video_id)
                    if v: v.cover_image = fname; db.session.commit()
                    print(f'[bg] Cover downloaded: {fname}')
                except Exception as e:
                    print(f'[bg] Cover download failed: {e}')
        threading.Thread(target=_dl_cover, args=(
            current_app._get_current_object(), video.id, scraped.cover_url,
            current_app.config['UPLOAD_FOLDER']), daemon=True).start()
    
    return jsonify({
        'message': 'Video published successfully',
        'video': video.to_dict()
    }), 201

@admin_bp.route('/scraped/<int:scraped_id>', methods=['PUT'])
@admin_required
def update_scraped_video(scraped_id):
    """Edit scraped video title"""
    scraped = ScrapedVideoInfo.query.get_or_404(scraped_id)
    data = request.get_json() or {}
    if 'title' in data:
        scraped.title = data['title'].strip()
    db.session.commit()
    return jsonify({'message': 'Updated', 'title': scraped.title}), 200


@admin_bp.route('/scraped/<int:scraped_id>', methods=['DELETE'])
@admin_required
def delete_scraped_video(scraped_id):
    """Delete scraped video record"""
    scraped = ScrapedVideoInfo.query.get_or_404(scraped_id)
    scraped.status = 'deleted'
    db.session.commit()
    
    return jsonify({
        'message': 'Scraped video deleted successfully'
    }), 200

# Statistics
@admin_bp.route('/stats', methods=['GET'])
@admin_required
def get_stats():
    """Get platform statistics"""
    total_users = User.query.count()
    total_videos = Video.query.count()
    pending_videos = Video.query.filter_by(status='pending').count()
    approved_videos = Video.query.filter_by(status='approved').count()
    total_views = db.session.query(db.func.sum(Video.view_count)).scalar() or 0
    
    return jsonify({
        'total_users': total_users,
        'total_videos': total_videos,
        'pending_videos': pending_videos,
        'approved_videos': approved_videos,
        'total_views': int(total_views)
    }), 200


@admin_bp.route('/scraped/batch-publish', methods=['POST'])
@admin_required
def batch_publish_scraped_videos():
    """Batch publish scraped videos"""
    try:
        data = request.get_json()
        video_ids = data.get('video_ids', [])
        
        if not video_ids:
            return jsonify({'error': 'No video IDs provided'}), 400
        
        success_count = 0
        error_count = 0
        
        for video_id in video_ids:
            try:
                scraped = ScrapedVideoInfo.query.get(video_id)
                if scraped and scraped.status == 'pending':
                    # Create video record from scraped info
                    video = Video(
                        title=scraped.title or 'Untitled Video',
                        description=scraped.description or '',
                        tags=scraped.tags or '',
                        source_url=scraped.video_url,
                        page_url=scraped.source_url,
                        cover_image=scraped.cover_url,
                        duration=scraped.duration or 0,
                        is_scraped=True,
                        user_id=get_jwt_identity(),
                        status='approved',
                        filename='external_video',
                        file_size=0,
                    )
                    db.session.add(video)
                    scraped.status = 'published'
                    success_count += 1
                    print(f"Published video: {scraped.title[:30]}...")
            except Exception as e:
                print(f"Error publishing video {video_id}: {e}")
                error_count += 1
        
        db.session.commit()

        # 后台异步下载封面（批量发布）
        import threading
        def _dl_covers_batch(app, cover_tasks, upload_folder):
            for vid_id, cover_url in cover_tasks:
                with app.app_context():
                    try:
                        import uuid, os
                        from app.models import Video
                        from app import db
                        ext = cover_url.split('?')[0].rsplit('.', 1)[-1].lower()
                        if ext not in ('jpg', 'jpeg', 'png', 'webp', 'gif'): ext = 'jpg'
                        fname = f"cover_{uuid.uuid4().hex}.{ext}"
                        os.makedirs(upload_folder, exist_ok=True)
                        r = requests.get(cover_url, timeout=10, verify=False,
                                         headers={'User-Agent': 'Mozilla/5.0'}, proxies={'http': None, 'https': None})
                        r.raise_for_status()
                        with open(os.path.join(upload_folder, fname), 'wb') as f:
                            f.write(r.content)
                        v = db.session.get(Video, vid_id)
                        if v: v.cover_image = fname; db.session.commit()
                    except Exception as e:
                        print(f'[bg] Cover download failed for video {vid_id}: {e}')
        cover_tasks = [(v.id, v.cover_image) for v in Video.query.filter(
            Video.cover_image.like('http%'), Video.is_scraped == True).order_by(Video.id.desc()).limit(success_count).all()]
        if cover_tasks:
            threading.Thread(target=_dl_covers_batch, args=(
                current_app._get_current_object(), cover_tasks,
                current_app.config['UPLOAD_FOLDER']), daemon=True).start()

        return jsonify({
            'message': f'成功发布 {success_count} 个视频',
            'success_count': success_count,
            'error_count': error_count
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Batch publish error: {e}")
        return jsonify({'error': f'Batch publish failed: {str(e)}'}), 500

@admin_bp.route('/scraped/batch-delete', methods=['POST'])
@admin_required
def batch_delete_scraped_videos():
    """Batch delete scraped videos"""
    try:
        data = request.get_json()
        video_ids = data.get('video_ids', [])
        
        if not video_ids:
            return jsonify({'error': 'No video IDs provided'}), 400
        
        success_count = 0
        
        for video_id in video_ids:
            try:
                scraped = ScrapedVideoInfo.query.get(video_id)
                if scraped:
                    db.session.delete(scraped)
                    success_count += 1
            except:
                pass
        
        db.session.commit()
        
        return jsonify({
            'message': f'成功删除 {success_count} 条记录',
            'success_count': success_count
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Batch delete error: {e}")
        return jsonify({'error': f'Batch delete failed: {str(e)}'}), 500

@admin_bp.route('/scrape/refresh-url', methods=['POST'])
@admin_required
def refresh_video_url():
    """Refresh video URL by re-scraping the source page"""
    import os
    for key in ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'NO_PROXY', 'no_proxy']:
        os.environ.pop(key, None)

    data = request.get_json()
    source_url = data.get('source_url') if data else None
    if not source_url:
        return jsonify({'error': 'Source URL is required'}), 400

    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Referer': source_url,
        }
        session = requests.Session()
        session.trust_env = False
        resp = session.get(source_url, headers=headers, timeout=15, verify=False, proxies={'http': None, 'https': None})
        resp.raise_for_status()

        soup = BeautifulSoup(resp.content, 'html.parser')
        video_tag = soup.find('video', attrs={'data-src': True})
        video_url = video_tag.get('data-src', '') if video_tag else ''
        if not video_url:
            m = re.search(r'["\']([^"\']*\.m3u8[^"\']*)["\']', resp.text, re.IGNORECASE)
            if m:
                video_url = m.group(1)
        if video_url and video_url.startswith('//'):
            video_url = 'https:' + video_url

        return jsonify({'success': True, 'new_url': video_url}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Image proxy for CORS issues
@admin_bp.route('/proxy/image')
def proxy_image():
    """Proxy image requests to avoid CORS issues"""
    from flask import Response
    import requests
    
    image_url = request.args.get('url')
    if not image_url:
        print("Image proxy: No URL provided")
        return jsonify({'error': 'No URL provided'}), 400
    
    # 简单的URL验证，只允许特定域名
    allowed_domains = ['i0.hdslb.com', 'i1.hdslb.com', 'i2.hdslb.com', 'i3.hdslb.com', 
                   'hdslb.com', 'bilibili.com', 'sina.com.cn']
    
    try:
        from urllib.parse import urlparse
        parsed = urlparse(image_url)
        if not any(domain in parsed.netloc for domain in allowed_domains):
            print(f"Image proxy: Domain not allowed: {parsed.netloc}")
            return jsonify({'error': 'Domain not allowed'}), 403
    except:
        return jsonify({'error': 'Invalid URL'}), 400
    
    print(f"Image proxy: Requesting {image_url}")
    
    try:
        # Fetch the image
        response = requests.get(image_url, timeout=10, stream=True, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': 'https://www.bilibili.com/'
        })
        response.raise_for_status()
        
        # Determine content type
        content_type = response.headers.get('content-type', 'image/jpeg')
        print(f"Image proxy: Success, content-type: {content_type}, size: {len(response.content)} bytes")
        
        # Return the image with proper headers
        return Response(
            response.content,
            mimetype=content_type,
            headers={
                'Cache-Control': 'public, max-age=3600',  # Cache for 1 hour
                'Access-Control-Allow-Origin': '*'
            }
        )
        
    except requests.exceptions.Timeout:
        print(f"Image proxy: Timeout for {image_url}")
        return jsonify({'error': 'Request timeout'}), 408
    except requests.exceptions.ConnectionError:
        print(f"Image proxy: Connection error for {image_url}")
        return jsonify({'error': 'Connection error'}), 503
    except requests.exceptions.HTTPError as e:
        print(f"Image proxy: HTTP error {e.response.status_code} for {image_url}")
        return jsonify({'error': f'HTTP error {e.response.status_code}'}), e.response.status_code
    except Exception as e:
        print(f"Image proxy: Unexpected error for {image_url}: {e}")
        return jsonify({'error': 'Failed to fetch image'}), 500
