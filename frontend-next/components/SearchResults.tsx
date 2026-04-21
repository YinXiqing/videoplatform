'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import VideoCard from '@/components/VideoCard'
import type { Video } from '@/types'

const fmt = (s: number) => s >= 1e6 ? `${(s/1e6).toFixed(1)}M` : s >= 1e3 ? `${(s/1e3).toFixed(1)}K` : String(s)
const dur = (s: number) => s ? `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}` : '00:00'

interface SearchResultsProps {
  initialVideos: Video[]
  initialTotal: number
  initialPages: number
  initialTags: string[]
  query: string
}

function SearchResultsInner({ initialVideos, initialTotal, initialPages, initialTags, query }: SearchResultsProps) {
  const [videos, setVideos] = useState<Video[]>(initialVideos)
  const [total, setTotal] = useState(initialTotal)
  const [allTags, setAllTags] = useState<string[]>(initialTags)
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)
  const [activeTag, setActiveTag] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(initialPages > 1)


  const search = useCallback(async (p: number, sort: string, tag: string, append: boolean = false) => {
    setLoading(true)
    try {
      const params: Record<string, any> = { search: query, sort, page: p, per_page: 12 }
      if (tag) params.tag = tag
      const res = await api.get('/video/list', { params })
      
      if (append) {
        setVideos(prev => [...prev, ...res.data.videos])
      } else {
        setVideos(res.data.videos)
      }
      
      setTotal(res.data.total)
      setHasMore(p < res.data.pages)
      
      const tagSet = new Set<string>()
      res.data.videos.forEach((v: Video) => (v.tags || []).forEach((t: string) => t.trim() && tagSet.add(t.trim())))
      if (tagSet.size > 0) setAllTags(prev => [...new Set([...prev, ...tagSet])])
    } catch {}
    finally { setLoading(false) }
  }, [query])

  // 滚动加载
  useEffect(() => {
    const handleScroll = () => {
      if (loading || !hasMore) return
      
      const scrollTop = window.scrollY
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight
      
      if (scrollTop + windowHeight >= documentHeight - 500) {
        setPage(prev => prev + 1)
      }
    }
    
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [loading, hasMore])

  useEffect(() => {
    setPage(1); setActiveTag(''); setSortBy('newest')
    search(1, 'newest', '', false)
  }, [query])

  useEffect(() => {
    if (page === 1) return
    search(page, sortBy, activeTag, true)
  }, [page])

  useEffect(() => {
    if (sortBy === 'newest' && page === 1 && !activeTag) return
    setPage(1)
    search(1, sortBy, activeTag, false)
  }, [sortBy, activeTag])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{query ? `"${query}" 的搜索结果` : '所有视频'}</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">共 {total} 个视频</p>
        </div>

        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400 shrink-0">排序：</span>
            {[['newest', '最新'], ['popular', '最热'], ['oldest', '最早']].map(([val, label]) => (
              <button key={val} onClick={() => { setSortBy(val); setPage(1) }}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${sortBy === val ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                {label}
              </button>
            ))}
          </div>
          {allTags.length > 0 && (
            <div className="relative">
              <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
                <button onClick={() => { setActiveTag(''); setPage(1) }} className={`px-3 py-1 rounded-full text-sm whitespace-nowrap shrink-0 transition-colors ${activeTag === '' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>全部</button>
                {allTags.slice(0, 20).map(tag => (
                  <button key={tag} onClick={() => { setActiveTag(activeTag === tag ? '' : tag); setPage(1) }}
                    className={`px-3 py-1 rounded-full text-sm whitespace-nowrap shrink-0 transition-colors ${activeTag === tag ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>{tag}</button>
                ))}
              </div>
              <div className="absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-gray-50 dark:from-[#0f0f0f] to-transparent pointer-events-none" />
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => <div key={i} className="bg-white dark:bg-[#1f1f1f] rounded-xl shadow-sm overflow-hidden animate-pulse"><div className="aspect-video bg-gray-200 dark:bg-[#333]" /><div className="p-4"><div className="h-4 bg-gray-200 dark:bg-[#333] rounded w-3/4 mb-2" /><div className="h-3 bg-gray-200 dark:bg-[#333] rounded w-1/2" /></div></div>)}
          </div>
        ) : videos.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {videos.map((v, i) => <VideoCard key={`${v.id}-${i}`} video={v} formatViews={fmt} formatDuration={dur} priority={i < 4} />)}
            </div>
            {loading && (
              <div className="flex justify-center mt-8">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>加载中...</span>
                </div>
              </div>
            )}
            {!hasMore && videos.length > 0 && (
              <div className="text-center mt-8 text-gray-400 dark:text-gray-500 text-sm">
                已加载全部 {total} 个视频
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">未找到相关视频</h3>
            <Link href="/" className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700">返回首页</Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SearchResults(props: SearchResultsProps) {
  return <Suspense><SearchResultsInner {...props} /></Suspense>
}
