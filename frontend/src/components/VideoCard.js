import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';

const VideoCard = ({ video, hoveredVideo, setHoveredVideo, formatViews, formatDuration }) => {
  const [imageError, setImageError] = useState(false);
  const isHovered = hoveredVideo === video.id;
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const hoverTimer = useRef(null);

  const handleMouseEnter = () => {
    // 鼠标进入时立即开始 HLS 加载，150ms 后显示播放器
    if (video.is_scraped && video.source_url && window.Hls && !hlsRef.current) {
      const BASE = process.env.REACT_APP_BASE_URL || '';
      const Hls = window.Hls;
      const proxyUrl = `${BASE}/api/video/proxy?url=${encodeURIComponent(video.source_url)}`;
      const hls = new Hls({ enableWorker: true, maxBufferLength: 8, startLevel: 0, abrEwmaDefaultEstimate: 500000 });
      hlsRef.current = hls;
      hls.loadSource(proxyUrl);
      // video 元素出现后立即 attach
      const tryAttach = () => {
        if (videoRef.current) {
          hls.attachMedia(videoRef.current);
          hls.on(Hls.Events.MANIFEST_PARSED, () => videoRef.current?.play().catch(() => {}));
          hls.on(Hls.Events.ERROR, (_, d) => {
            if (d.fatal) {
              hls.destroy(); hlsRef.current = null;
              fetch(`${BASE}/api/video/refresh-url/${video.id}`)
                .then(r => r.json()).then(data => {
                  if (data.video_url && hlsRef.current === null) {
                    const h2 = new Hls({ enableWorker: true, maxBufferLength: 8, startLevel: 0 });
                    hlsRef.current = h2;
                    h2.loadSource(`${BASE}/api/video/proxy?url=${encodeURIComponent(data.video_url)}`);
                    if (videoRef.current) { h2.attachMedia(videoRef.current); h2.on(Hls.Events.MANIFEST_PARSED, () => videoRef.current?.play().catch(() => {})); }
                  }
                }).catch(() => {});
            }
          });
        } else { setTimeout(tryAttach, 20); }
      };
      setTimeout(tryAttach, 160); // 比防抖稍晚，确保 video 元素已渲染
    }
    hoverTimer.current = setTimeout(() => setHoveredVideo(video.id), 150);
  };
  const handleMouseLeave = () => {
    clearTimeout(hoverTimer.current);
    setHoveredVideo(null);
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
  };

  // 离开时清理（兜底）
  useEffect(() => {
    if (!isHovered && hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
  }, [isHovered]);

  const renderThumbnail = () => {
    if (imageError || !video.cover_image) {
      return (
        <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
          <svg className="w-12 h-12 text-white/50" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
          </svg>
        </div>
      );
    }
    return (
      <img
        src={video.is_scraped && video.cover_image?.startsWith('http') ? video.cover_image : `${process.env.REACT_APP_BASE_URL}/api/video/cover/${video.id}`}
        alt={video.title}
        className="w-full h-full object-cover"
        loading="lazy"
        onError={() => setImageError(true)}
      />
    );
  };

  return (
    <div
      className="group bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Link to={`/video/${video.id}`}>
        <div className="relative aspect-video overflow-hidden">
          {isHovered && video.is_scraped ? (
            <video
              ref={videoRef}
              muted
              loop
              playsInline
              className="w-full h-full object-cover"
            />
          ) : isHovered && !video.is_scraped ? (
            <video
              src={`${process.env.REACT_APP_BASE_URL}/api/video/stream/${video.id}`}
              autoPlay muted loop
              className="w-full h-full object-cover"
            />
          ) : video.cover_image ? (
            renderThumbnail()
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
              <svg className="w-12 h-12 text-white/50" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
              </svg>
            </div>
          )}
          {!isHovered && video.duration > 0 && (
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
              {formatDuration ? formatDuration(video.duration) : '00:00'}
            </div>
          )}
        </div>
      </Link>

      <div className="p-4 flex flex-col" style={{height: '100px'}}>
        <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2 group-hover:text-primary-600 transition-colors text-sm leading-snug" style={{minHeight: '2.5rem'}}>
          {video.title}
        </h3>
        <p className="text-sm text-gray-500 truncate">{video.author}</p>
        {video.tags && video.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {video.tags.slice(0, 3).map(tag => (
              <span key={tag} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">{tag}</span>
            ))}
          </div>
        )}
        <div className="flex items-center text-xs text-gray-400 space-x-2 mt-auto">
          <span>{formatViews ? formatViews(video.view_count) : video.view_count} 次观看</span>
          <span>•</span>
          <span>{new Date(video.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
};

export default VideoCard;
