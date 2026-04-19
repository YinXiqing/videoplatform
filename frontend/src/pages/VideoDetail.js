import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../contexts/AuthContext';
import { useAuth } from '../contexts/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';

const VideoDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const playNext = () => {
    if (relatedVideos.length > 0) navigate(`/video/${relatedVideos[0].id}`);
  };
  const currentUrlRef = useRef(null);
  const relatedHoverTimer = useRef(null);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    type: 'danger',
    title: '',
    message: '',
    onConfirm: null
  });
  const [relatedVideos, setRelatedVideos] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(true);
  const [hoveredRelatedVideo, setHoveredRelatedVideo] = useState(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    window.scrollTo(0, 0);
    fetchVideoDetail();
  }, [id]);

  // Auto-play video when video data is loaded
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (video && !isPlaying) {
      setIsPlaying(true);
    }
  }, [video]);

  // HLS.js player for scraped m3u8 videos
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isPlaying || !video?.is_scraped) return;

    const initHls = (videoUrl) => {
      const el = videoRef.current;
      if (!el) return;
      const Hls = window.Hls;
      if (!Hls) return;
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      const proxiedUrl = `${process.env.REACT_APP_BASE_URL}/api/video/proxy?url=${encodeURIComponent(videoUrl)}`;
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true });
        hlsRef.current = hls;
        hls.loadSource(proxiedUrl);
        hls.attachMedia(el);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          const saved = parseFloat(localStorage.getItem(`vp_${video.id}`));
          if (saved > 5) el.currentTime = saved;
          el.play().catch(() => {});
          el.onended = playNext;
          el.ontimeupdate = () => localStorage.setItem(`vp_${video.id}`, el.currentTime);
        });
        hls.on(Hls.Events.ERROR, (_, d) => {
          if (d.fatal && (d.response?.code === 403 || d.response?.code === 410 || d.type === Hls.ErrorTypes.NETWORK_ERROR)) {
            console.log('HLS error, refreshing URL...');
            fetch(`${process.env.REACT_APP_BASE_URL}/api/video/refresh-url/${video.id}`)
              .then(r => r.json())
              .then(data => { if (data.video_url) initHls(data.video_url); })
              .catch(() => {});
          }
        });
      } else if (el.canPlayType('application/vnd.apple.mpegurl')) {
        el.src = proxiedUrl;
        el.play().catch(() => {});
      }
    };

    const videoUrl = video.video_url || video.source_url;
    if (!videoUrl) return;
    // URL 没变化时不重新初始化（避免后台刷新触发多次重载）
    if (videoUrl === currentUrlRef.current && hlsRef.current) return;
    currentUrlRef.current = videoUrl;

    if (window.Hls) {
      const t = setTimeout(() => initHls(videoUrl), 100);
      return () => { clearTimeout(t); if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };
    } else {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js';
      s.onload = () => setTimeout(() => initHls(videoUrl), 100);
      document.head.appendChild(s);
      return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, video]);

  const fetchVideoDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/video/detail/${id}`);
      const v = response.data.video;
      setVideo(v);
      document.title = `${v.title} - 视频平台`;
      fetchRelatedVideos(v);
      // 抓取视频：后台刷新 URL，不阻塞页面显示
      if (v.is_scraped && v.page_url) {
        fetch(`${process.env.REACT_APP_BASE_URL}/api/video/refresh-url/${v.id}`)
          .then(r => r.json())
          .then(d => { if (d.video_url) setVideo(prev => prev ? { ...prev, video_url: d.video_url } : prev); })
          .catch(() => {});
      }
    } catch (err) {
      console.error('Error fetching video detail:', err);
      setError('获取视频信息失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedVideos = async (currentVideo) => {
    setRelatedLoading(true);
    try {
      const GENERIC_TAGS = new Set(['原创', '国产', '自拍', '高清', '中文', '字幕', '无码', '有码']);
      const tags = (currentVideo.tags || []).filter(t => t && !GENERIC_TAGS.has(t.trim()));
      // 优先用非通用标签，没有则用标题搜索
      const params = { per_page: 8 };
      if (tags.length > 0) params.tag = tags[0];
      else if (currentVideo.title) params.search = currentVideo.title.slice(0, 10);

      const response = await api.get('/video/list', { params });
      const filteredVideos = response.data.videos.filter(v => v.id !== currentVideo.id);
      setRelatedVideos(filteredVideos.slice(0, 6));
    } catch (err) {
      console.error('Error fetching related videos:', err);
      setRelatedVideos([]);
    } finally {
      setRelatedLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatViews = (views) => {
    if (views >= 1000000) {
      return `${(views / 1000000).toFixed(1)}M`;
    } else if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K`;
    }
    return views.toString();
  };

  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleApprove = () => {
    setConfirmDialog({
      isOpen: true,
      type: 'info',
      title: '审核通过',
      message: '确定要通过这个视频的审核吗？通过后视频将对所有用户可见。',
      onConfirm: async () => {
        try {
          await api.put(`/admin/videos/${video.id}`, { status: 'approved' });
          setVideo({ ...video, status: 'approved' });
          showToast('视频已通过审核 ✓');
        } catch (error) {
          showToast('操作失败，请重试', 'error');
        }
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      }
    });
  };

  const handleReject = () => {
    setConfirmDialog({
      isOpen: true,
      type: 'danger',
      title: '拒绝视频',
      message: '确定要拒绝这个视频吗？拒绝后视频将被隐藏。',
      onConfirm: async () => {
        try {
          await api.put(`/admin/videos/${video.id}`, { status: 'rejected' });
          setVideo({ ...video, status: 'rejected' });
          showToast('视频已拒绝', 'error');
        } catch (error) {
          showToast('操作失败，请重试', 'error');
        }
        setConfirmDialog({ ...confirmDialog, isOpen: false });
      }
    });
  };


  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    };
    
    const labels = {
      pending: '待审核',
      approved: '已通过',
      rejected: '已拒绝'
    };
    
    return (
      <span className={`px-3 py-1 text-sm font-medium rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{error || '视频未找到'}</h2>
          <button
            onClick={() => navigate('/')}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
          {/* Main Video Player */}
          <div className="lg:col-span-2">
            <div className="bg-black rounded-xl overflow-hidden aspect-video relative">
              {isPlaying ? (
                video.is_scraped ? (
                  <video ref={videoRef} controls muted className="w-full h-full object-contain" crossOrigin="anonymous" />
                ) : (
                  <video controls autoPlay className="w-full h-full object-contain" onEnded={playNext}
                    src={`${process.env.REACT_APP_BASE_URL}/api/video/stream/${video.id}`}
                    onTimeUpdate={e => localStorage.setItem(`vp_${video.id}`, e.target.currentTime)}
                    onLoadedMetadata={e => {
                      const saved = parseFloat(localStorage.getItem(`vp_${video.id}`));
                      if (saved > 5) e.target.currentTime = saved;
                    }}>
                    您的浏览器不支持视频播放。
                  </video>
                )
              ) : (
                <div className="relative w-full h-full">
                  {video.cover_image ? (
                    <img
                      src={video.is_scraped && video.cover_image?.startsWith('http') ? video.cover_image : `${process.env.REACT_APP_BASE_URL}/api/video/cover/${video.id}`}
                      alt={video.title}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600" />
                  )}
                  <button
                    onClick={() => setIsPlaying(true)}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors group"
                  >
                    <div className="w-20 h-20 bg-white/90 rounded-full flex items-center justify-center transform group-hover:scale-110 transition-transform">
                      <svg className="w-10 h-10 text-primary-600 ml-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                      </svg>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Video Info */}
            <div className="bg-white rounded-xl shadow-sm mt-6 p-6">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-bold text-gray-900">{video.title}</h1>
                {video.status === 'pending' && getStatusBadge(video.status)}
              </div>

              <div className="flex items-center text-sm text-gray-500 space-x-4 mb-4">
                <span>{formatViews(video.view_count)} 次观看</span>
                <span>•</span>
                <span>{new Date(video.created_at).toLocaleDateString()}</span>
                <span>•</span>
                <span>{formatDuration(video.duration)}</span>
              </div>

              {isAdmin() && video.status === 'pending' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h3 className="text-sm font-medium text-blue-800 mb-3">管理员审核操作</h3>
                  <div className="flex space-x-3">
                    <button onClick={handleApprove} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 transition-colors">通过审核</button>
                    <button onClick={handleReject} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors">拒绝视频</button>
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-3 mb-6 pb-6 border-b border-gray-100">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-lg font-medium text-primary-700">{video.author?.charAt(0).toUpperCase() || 'U'}</span>
                </div>
                <p className="font-medium text-gray-900">{video.author || '未知用户'}</p>
              </div>

              {video.description && (
                <div className="prose max-w-none">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">视频简介</h3>
                  <p className="text-gray-600 whitespace-pre-wrap">{video.description}</p>
                </div>
              )}

              {video.tags && video.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {video.tags.map((tag, index) => (
                    <span key={index} className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">相关推荐</h3>
              {relatedLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse flex space-x-3">
                      <div className="w-32 h-20 bg-gray-200 rounded flex-shrink-0"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : relatedVideos.length > 0 ? (
                <div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
                  {relatedVideos.map((rv) => (
                    <Link key={rv.id} to={`/video/${rv.id}`} className="flex space-x-3 group flex-shrink-0 w-64 lg:w-auto">
                      <div className="w-32 h-20 rounded overflow-hidden flex-shrink-0 relative"
                        onMouseEnter={() => { relatedHoverTimer.current = setTimeout(() => setHoveredRelatedVideo(rv.id), 300); }}
                        onMouseLeave={() => { clearTimeout(relatedHoverTimer.current); setHoveredRelatedVideo(null); }}>
                        {hoveredRelatedVideo === rv.id ? (
                          <video
                            src={rv.is_scraped && rv.source_url
                              ? `${process.env.REACT_APP_BASE_URL}/api/video/proxy?url=${encodeURIComponent(rv.source_url)}`
                              : `${process.env.REACT_APP_BASE_URL}/api/video/stream/${rv.id}`}
                            autoPlay muted loop className="w-full h-full object-cover" />
                        ) : rv.cover_image ? (
                          <img src={rv.is_scraped && rv.cover_image?.startsWith('http') ? rv.cover_image : `${process.env.REACT_APP_BASE_URL}/api/video/cover/${rv.id}`}
                            alt={rv.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600" />
                        )}
                        {hoveredRelatedVideo !== rv.id && (
                          <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 py-0.5 rounded">
                            {formatDuration(rv.duration)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-primary-600 transition-colors">{rv.title}</h4>
                        <p className="text-xs text-gray-500 mt-1">{rv.author}</p>
                        <p className="text-xs text-gray-400 mt-1">{formatViews(rv.view_count)} 次观看</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">暂无相关推荐视频</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
        confirmText="确认"
        cancelText="取消"
      />

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg text-white text-sm font-medium transition-all ${toast.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default VideoDetail;
