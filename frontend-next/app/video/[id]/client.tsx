'use client'
import { useState, useEffect } from 'react'
import VideoPlayer from '@/components/VideoPlayer'
import api from '@/lib/api'
import type { Video } from '@/types'

export default function VideoDetailClient({ id, initialVideo }: { id: string; initialVideo: Video | null }) {
  const [video, setVideo] = useState<Video | null>(initialVideo)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const spacer = document.getElementById('mobile-nav-spacer')
    if (spacer) spacer.style.display = 'none'
    return () => { if (spacer) spacer.style.display = '' }
  }, [])

  useEffect(() => {
    if (initialVideo) return  // SSR 已获取到，无需再请求
    api.get(`/video/detail/${id}`)
      .then(r => setVideo(r.data.video))
      .catch(() => setNotFound(true))
  }, [id, initialVideo])

  if (notFound) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">视频未找到</h2>
        <a href="/" className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700">返回首页</a>
      </div>
    </div>
  )

  if (!video) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return <VideoPlayer video={video} />
}
