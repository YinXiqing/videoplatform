import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../contexts/AuthContext';
import ConfirmDialog from '../../components/ConfirmDialog';

// 动态加载 HLS.js
function loadHls() {
  return new Promise((resolve) => {
    if (window.Hls) return resolve(window.Hls);
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js';
    s.onload = () => resolve(window.Hls);
    document.head.appendChild(s);
  });
}

const AdminScraper = () => {
  const [url, setUrl] = useState('');
  const [batchMode, setBatchMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scrapedVideos, setScrapedVideos] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [previewVideo, setPreviewVideo] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false });
  const [selectedVideos, setSelectedVideos] = useState([]);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  useEffect(() => { fetchScrapedVideos(); }, []);

  useEffect(() => {
    if (success || error) {
      const t = setTimeout(() => { setSuccess(''); setError(''); }, 5000);
      return () => clearTimeout(t);
    }
  }, [success, error]);

  // 初始化 HLS 播放器
  useEffect(() => {
    if (!previewVideo?.video_url) return;
    const videoUrl = previewVideo.video_url;
    const proxiedUrl = `${process.env.REACT_APP_BASE_URL}/api/video/proxy?url=${encodeURIComponent(videoUrl)}`;

    const t = setTimeout(() => {
      loadHls().then((Hls) => {
        const el = videoRef.current;
        if (!el) return;
        if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true });
          hlsRef.current = hls;
          hls.loadSource(proxiedUrl);
          hls.attachMedia(el);
          hls.on(Hls.Events.MANIFEST_PARSED, () => el.play().catch(() => {}));
          hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) console.error('HLS fatal error:', data); });
        } else if (el.canPlayType('application/vnd.apple.mpegurl')) {
          el.src = proxiedUrl;
          el.play().catch(() => {});
        }
      });
    }, 200);

    return () => {
      clearTimeout(t);
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [previewVideo]);

  const fetchScrapedVideos = async () => {
    try {
      const res = await api.get('/admin/scraped');
      setScrapedVideos(res.data.scraped_videos);
    } catch (e) {
      console.error('fetchScrapedVideos error:', e);
    }
  };

  const handleScrape = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');
    try {
      if (batchMode) {
        const urls = url.split('\n').map(u => u.trim()).filter(Boolean);
        const res = await api.post('/admin/scrape/batch', { urls });
        setSuccess(res.data.message);
      } else {
        await api.post('/admin/scrape', { url });
        setSuccess('抓取成功！');
      }
      setUrl('');
      fetchScrapedVideos();
    } catch (e) {
      setError(e.response?.data?.error || '抓取失败，请检查URL');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (scrapedId) => {
    try {
      await api.post(`/admin/scraped/${scrapedId}/import`, {});
      setSuccess('视频发布成功！');
      fetchScrapedVideos();
      if (previewVideo?.id === scrapedId) setPreviewVideo(null);
    } catch (e) {
      setError(e.response?.data?.error || '发布失败');
    }
  };

  const handleDelete = (scrapedId) => {
    setConfirmDialog({
      isOpen: true, type: 'danger',
      title: '删除抓取记录', message: '确定要删除这条抓取记录吗？',
      onConfirm: async () => {
        try {
          await api.delete(`/admin/scraped/${scrapedId}`);
          setSuccess('已删除');
          fetchScrapedVideos();
          if (previewVideo?.id === scrapedId) setPreviewVideo(null);
        } catch (e) { setError('删除失败'); }
        setConfirmDialog({ isOpen: false });
      }
    });
  };

  const [batchLoading, setBatchLoading] = useState(false);

  const handleBatchPublish = () => {
    if (!selectedVideos.length) return setError('请先选择视频');
    setConfirmDialog({
      isOpen: true, type: 'warning',
      title: '批量发布', message: `确定发布选中的 ${selectedVideos.length} 个视频？`,
      onConfirm: async () => {
        setBatchLoading(true);
        try {
          const res = await api.post('/admin/scraped/batch-publish', { video_ids: selectedVideos });
          setSuccess(res.data.message || '批量发布成功');
          setSelectedVideos([]);
          fetchScrapedVideos();
        } catch (e) { setError('批量发布失败'); }
        finally { setBatchLoading(false); }
        setConfirmDialog({ isOpen: false });
      }
    });
  };

  const handleBatchDelete = () => {
    if (!selectedVideos.length) return setError('请先选择视频');
    setConfirmDialog({
      isOpen: true, type: 'danger',
      title: '批量删除', message: `确定删除选中的 ${selectedVideos.length} 条记录？`,
      onConfirm: async () => {
        setBatchLoading(true);
        try {
          const res = await api.post('/admin/scraped/batch-delete', { video_ids: selectedVideos });
          setSuccess(res.data.message || '批量删除成功');
          setSelectedVideos([]);
          fetchScrapedVideos();
        } catch (e) { setError('批量删除失败'); }
        finally { setBatchLoading(false); }
        setConfirmDialog({ isOpen: false });
      }
    });
  };

  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');

  const handleEditTitle = async (videoId) => {
    try {
      await api.put(`/admin/scraped/${videoId}`, { title: editingTitle });
      setScrapedVideos(prev => prev.map(v => v.id === videoId ? { ...v, title: editingTitle } : v));
      setEditingId(null);
    } catch (e) { setError('编辑失败'); }
  };

  const closePreview = () => {
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    setPreviewVideo(null);
  };

  

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">视频抓取</h1>
          <p className="text-gray-500 mt-1 text-sm">从外部网站抓取视频信息并导入平台</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">{success}</div>}

        {/* 抓取表单 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <form onSubmit={handleScrape} className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                {batchMode ? '批量抓取（每行一个URL，最多20个）' : '视频页面URL'}
              </label>
              <button type="button" onClick={() => { setBatchMode(!batchMode); setUrl(''); }}
                className="text-xs text-primary-600 hover:underline">
                {batchMode ? '切换单条模式' : '切换批量模式'}
              </button>
            </div>
            {batchMode ? (
              <textarea value={url} onChange={e => setUrl(e.target.value)}
                placeholder={"https://example.com/video/1\nhttps://example.com/video/2"}
                rows={5}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-mono"
                required />
            ) : (
              <input type="url" value={url} onChange={e => setUrl(e.target.value)}
                placeholder="输入视频页面URL"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                required />
            )}
            <button type="submit" disabled={loading}
              className="bg-primary-600 text-white px-5 py-2.5 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 text-sm font-medium">
              {loading ? '抓取中...' : batchMode ? '批量抓取' : '开始抓取'}
            </button>
          </form>
        </div>

        {/* 抓取记录 */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-gray-900">抓取记录 ({scrapedVideos.length})</h2>
              {scrapedVideos.some(v => v.status === 'pending') && (
                <button
                  onClick={() => {
                    const pendingIds = scrapedVideos.filter(v => v.status === 'pending').map(v => v.id);
                    setSelectedVideos(selectedVideos.length === pendingIds.length ? [] : pendingIds);
                  }}
                  className="text-xs text-primary-600 hover:underline"
                >
                  {selectedVideos.length === scrapedVideos.filter(v => v.status === 'pending').length ? '取消全选' : '全选待处理'}
                </button>
              )}
            </div>
            {selectedVideos.length > 0 && (
              <div className="flex gap-2">
                <button onClick={handleBatchPublish} disabled={batchLoading} className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">
                  {batchLoading ? '处理中...' : `批量发布 (${selectedVideos.length})`}
                </button>
                <button onClick={handleBatchDelete} disabled={batchLoading} className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50">
                  {batchLoading ? '处理中...' : `批量删除 (${selectedVideos.length})`}
                </button>
              </div>
            )}
          </div>

          {scrapedVideos.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p>暂无抓取记录</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {scrapedVideos.map(video => (
                <div key={video.id} className="p-4 flex items-center gap-4">
                  {video.status === 'pending' && (
                    <input
                      type="checkbox"
                      checked={selectedVideos.includes(video.id)}
                      onChange={() => setSelectedVideos(prev =>
                        prev.includes(video.id) ? prev.filter(id => id !== video.id) : [...prev, video.id]
                      )}
                      className="h-4 w-4 text-primary-600 rounded"
                    />
                  )}

                  {/* 封面 */}
                  <div
                    className="w-28 h-18 flex-shrink-0 rounded-lg overflow-hidden bg-gray-900 cursor-pointer relative group"
                    style={{ height: '72px' }}
                    onClick={() => setPreviewVideo(video)}
                  >
                    {video.cover_url ? (
                      <>
                        <img src={video.cover_url} alt={video.title} className="w-full h-full object-cover" onError={e => { e.target.style.display='none'; }} />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all">
                          <svg className="w-7 h-7 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                          </svg>
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                        <svg className="w-6 h-6 text-white/50" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* 信息 */}
                  <div className="flex-1 min-w-0">
                    {editingId === video.id ? (
                      <div className="flex gap-2 items-center">
                        <input autoFocus value={editingTitle} onChange={e => setEditingTitle(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleEditTitle(video.id); if (e.key === 'Escape') setEditingId(null); }}
                          className="flex-1 border border-primary-400 rounded px-2 py-1 text-sm focus:outline-none" />
                        <button onClick={() => handleEditTitle(video.id)} className="text-xs text-green-600 hover:underline">保存</button>
                        <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:underline">取消</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 group/title">
                        <p className="font-medium text-gray-900 truncate text-sm">{video.title || '未命名'}</p>
                        <button onClick={() => { setEditingId(video.id); setEditingTitle(video.title || ''); }}
                          className="opacity-0 group-hover/title:opacity-100 text-gray-400 hover:text-gray-600 transition-opacity">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(video.scraped_at).toLocaleString()}
                    </p>
                  </div>

                  {/* 状态 + 操作 */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      video.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      video.status === 'published' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {video.status === 'pending' ? '待处理' : video.status === 'published' ? '已发布' : video.status}
                    </span>
                    {video.status === 'pending' && (
                      <>
                        <button onClick={() => handlePublish(video.id)} className="px-2.5 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">发布</button>
                        <button onClick={() => handleDelete(video.id)} className="px-2.5 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700">删除</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 预览弹窗 */}
      {previewVideo && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={closePreview}>
          <div className="bg-white rounded-xl max-w-3xl w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="font-semibold text-gray-900 truncate pr-4">{previewVideo.title || '视频预览'}</h3>
              <button onClick={closePreview} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 播放器 */}
            <div className="bg-black aspect-video">
              {previewVideo.video_url ? (
                <video
                  ref={videoRef}
                  controls
                  muted
                  className="w-full h-full"
                  crossOrigin="anonymous"
                />
              ) : previewVideo.cover_url ? (
                <img src={previewVideo.cover_url} alt={previewVideo.title} className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500">无视频地址</div>
              )}
            </div>

            {/* 信息 */}
            <div className="p-4 space-y-2 text-sm">
              <div>
                <span className="text-gray-500">抓取时间：</span>
                <span className="text-gray-700">{new Date(previewVideo.scraped_at).toLocaleString()}</span>
              </div>
            </div>

            <div className="px-4 pb-4 flex justify-end gap-2">
              <button onClick={closePreview} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">关闭</button>
              {previewVideo.status === 'pending' && (
                <button onClick={() => handlePublish(previewVideo.id)} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">发布视频</button>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        type={confirmDialog.type}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onClose={() => setConfirmDialog({ isOpen: false })}
      />
    </div>
  );
};

export default AdminScraper;
