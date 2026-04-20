import { serverFetch } from '@/lib/server-api'
import VideoDetailClient from './client'
import type { Video } from '@/types'
import type { Metadata } from 'next'

async function getVideo(id: string): Promise<Video | null> {
  try {
    const res = await serverFetch(`/api/video/detail/${id}`)
    if (!res.ok) return null
    return (await res.json()).video
  } catch { return null }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const video = await getVideo(id)
  return { title: video ? `${video.title} - 视频平台` : '视频详情 - 视频平台' }
}

export default async function VideoDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const video = await getVideo(id)
  // SSR 获取不到（pending/rejected 需要鉴权）时降级为客户端渲染
  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8">
        <VideoDetailClient id={id} initialVideo={video} />
      </div>
    </div>
  )
}
