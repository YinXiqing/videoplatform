import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../contexts/AuthContext';
import VideoCard from '../components/VideoCard';

const Home = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [hoveredVideo, setHoveredVideo] = useState(null);
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [activeTag, setActiveTag] = useState('');
  const [allTags, setAllTags] = useState([]);
  const [sortBy, setSortBy] = useState('newest');
  const sentinelRef = useRef(null);
  const PER_PAGE = 12;

  const fetchVideos = useCallback(async (p) => {
    if (p === 1) setLoading(true); else setLoadingMore(true);
    try {
      const params = { page: p, per_page: PER_PAGE, sort: sortBy };
      if (activeTag) params.tag = activeTag;
      const res = await api.get('/video/list', { params });
      const { videos: newVids, pages } = res.data;
      setVideos(prev => p === 1 ? newVids : [...prev, ...newVids]);
      setHasMore(p < pages);
      const tagSet = new Set();
      newVids.forEach(v => (v.tags || []).forEach(t => t.trim() && tagSet.add(t.trim())));
      if (tagSet.size > 0) setAllTags(prev => [...new Set([...prev, ...tagSet])]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeTag, sortBy]);

  useEffect(() => {
    setPage(1);
    setVideos([]);
    setHasMore(true);
    fetchVideos(1);
  }, [fetchVideos]);

  // IntersectionObserver 无限滚动
  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
        const next = page + 1;
        setPage(next);
        fetchVideos(next);
      }
    }, { threshold: 0.1 });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loading, page, fetchVideos]);

  const handleSearch = (e) => {
    e.preventDefault();
    window.location.href = `/search?search=${encodeURIComponent(searchQuery)}`;
  };

  const formatDuration = (s) => {
    if (!s) return '00:00';
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };
  const formatViews = (v) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(1)}K` : String(v);

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="bg-gradient-to-r from-primary-600 to-primary-700 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl md:text-3xl font-bold">发现精彩视频</h1>
              <p className="text-sm text-primary-100 mt-1">探索、分享、观看无限精彩内容</p>
            </div>
            <form onSubmit={handleSearch} className="w-full sm:max-w-md">
              <div className="relative">
                <input type="text" placeholder="搜索视频标题、作者..." value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full px-5 py-3 pr-12 rounded-full text-gray-900 bg-white shadow-lg focus:outline-none focus:ring-4 focus:ring-primary-500/30 text-sm" />
                <button type="submit" className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-primary-600 text-white p-2 rounded-full hover:bg-primary-700 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900">推荐视频</h2>
          <div className="flex items-center gap-2">
            {['newest', 'popular'].map(s => (
              <button key={s} onClick={() => { setSortBy(s); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${sortBy === s ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} active:scale-95 transition-transform`}>
                {s === 'newest' ? '最新' : '最热'}
              </button>
            ))}
            <Link to="/search" className="text-primary-600 hover:text-primary-700 font-medium text-sm ml-2">查看全部 →</Link>
          </div>
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button onClick={() => setActiveTag('')}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${activeTag === '' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} active:scale-95 transition-transform`}>
              全部
            </button>
            {allTags.slice(0, 20).map(tag => (
              <button key={tag} onClick={() => setActiveTag(activeTag === tag ? '' : tag)}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${activeTag === tag ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} active:scale-95 transition-transform`}>
                {tag}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm overflow-hidden animate-pulse">
                <div className="aspect-video bg-gray-200" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : videos.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {videos.map(video => (
                <VideoCard key={video.id} video={video} hoveredVideo={hoveredVideo}
                  setHoveredVideo={setHoveredVideo} formatViews={formatViews} formatDuration={formatDuration} />
              ))}
            </div>
            {/* 无限滚动哨兵 */}
            <div ref={sentinelRef} className="h-10 flex items-center justify-center mt-6">
              {loadingMore && <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />}
              {!hasMore && <p className="text-gray-400 text-sm">已加载全部视频</p>}
            </div>
          </>
        ) : (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p>{activeTag ? `没有标签为"${activeTag}"的视频` : '暂无视频'}</p>
            {activeTag && <button onClick={() => setActiveTag('')} className="mt-2 text-primary-600 text-sm hover:underline">清除过滤</button>}
          </div>
        )}
      </section>
    </div>
  );
};

export default Home;
