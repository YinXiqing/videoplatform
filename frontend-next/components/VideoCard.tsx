'use client'
import { useState, useRef, useEffect, memo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { Video } from '@/types'

declare global { interface Window { Hls: any } }

function VideoCard({ video, formatViews, formatDuration, priority = false }: {
  video: Video; formatViews?: (v: number) => string; formatDuration?: (s: number) => string; priority?: boolean
}) {
  const [imgError, setImgError] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [hlsError, setHlsError] = useState(false)
  const [inViewport, setInViewport] = useState(false)
  const [progress, setProgress] = useState(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<any>(null)
  const loadedRef = useRef(false)

  // IntersectionObserver: 卡片进入/离开视口（提前 150px 触发）
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => setInViewport(e.isIntersecting),
      { rootMargin: '150px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // 进入视口后预加载 HLS，解码一帧后暂停
  useEffect(() => {
    if (!inViewport || hlsError || !video.hls_ready) return
    const el = videoRef.current
    if (!el) return

    const src = `/api/video/hls/${video.id}/index.m3u8`

    if (window.Hls?.isSupported()) {
      const hls = new window.Hls({ enableWorker: true, maxBufferLength: 2, startLevel: 0 })
      hlsRef.current = hls
      hls.loadSource(src)
      hls.attachMedia(el)

      let preloaded = false
      hls.on(window.Hls.Events.MANIFEST_PARSED, () => { el.play().catch(() => {}) })
      hls.on(window.Hls.Events.ERROR, (_e: any, data: any) => {
        if (data.fatal) { setHlsError(true); hls.destroy(); hlsRef.current = null }
      })

      const onPlaying = () => {
        if (preloaded) return
        preloaded = true
        el.pause()
        el.currentTime = 0
        loadedRef.current = true
        setVideoLoaded(true)
      }
      el.addEventListener('playing', onPlaying)

      return () => {
        el.removeEventListener('playing', onPlaying)
        if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
        el.pause()
        el.removeAttribute('src')
        loadedRef.current = false
        setVideoLoaded(false)
        setProgress(0)
      }
    } else if (el.canPlayType('application/vnd.apple.mpegurl')) {
      el.src = src
      const onLoaded = () => {
        el.pause()
        el.currentTime = 0
        loadedRef.current = true
        setVideoLoaded(true)
      }
      el.addEventListener('loadeddata', onLoaded)
      return () => {
        el.removeEventListener('loadeddata', onLoaded)
        el.pause()
        el.removeAttribute('src')
        loadedRef.current = false
        setVideoLoaded(false)
        setProgress(0)
      }
    }
  }, [inViewport, video.id, video.hls_ready, hlsError])

  const handleEnter = () => {
    if (window.matchMedia('(hover: none)').matches) return
    setIsHovered(true)
    const el = videoRef.current
    if (el && loadedRef.current) {
      el.currentTime = 0
      el.play().catch(() => {})
    }
  }

  const handleLeave = () => {
    setIsHovered(false)
    const el = videoRef.current
    if (el) {
      el.pause()
      el.currentTime = 0
    }
    setProgress(0)
  }

  const handleTimeUpdate = () => {
    const el = videoRef.current
    if (el && el.duration > 0) {
      const pct = (el.currentTime / el.duration) * 100
      setProgress(Math.min(pct, 100))
    }
  }

  const coverSrc = `/api/video/cover/${video.id}`

  return (
    <div ref={cardRef} className="group bg-white dark:bg-[#1f1f1f] rounded-xl shadow-sm overflow-hidden hover:shadow-md dark:hover:shadow-black/30 transition-shadow"
      onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <Link href={`/video/${video.id}`}>
        <div className="relative aspect-video overflow-hidden bg-gray-900">
          {/* video 始终 opacity-100，浏览器合成层始终存在 */}
          <video ref={videoRef} muted loop playsInline
            className="absolute inset-0 w-full h-full object-cover"
            onTimeUpdate={handleTimeUpdate} />

          {/* 封面盖在 video 上方（z-10），hover 时消失露出视频 */}
          {!imgError && video.cover_image && (
            <Image src={coverSrc} alt={video.title} fill
              className={`relative z-10 object-cover ${isHovered && videoLoaded ? 'opacity-0' : 'opacity-100'}`}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              onError={() => setImgError(true)} priority={priority} loading={priority ? 'eager' : 'lazy'} />
          )}

          {/* 预览进度条 */}
          {isHovered && videoLoaded && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/30 z-20">
              <div className="h-full bg-white transition-[width] duration-100 linear" style={{ width: `${progress}%` }} />
            </div>
          )}

          {/* 时长标签 */}
          {(video.duration ?? 0) > 0 && (
            <div className={`absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded z-20 ${isHovered && videoLoaded ? 'opacity-0' : 'opacity-100'}`}>
              {formatDuration?.(video.duration!) ?? '00:00'}
            </div>
          )}
        </div>
      </Link>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1 line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors text-sm leading-snug min-h-[2.5rem]">
          <Link href={`/video/${video.id}`}>{video.title}</Link>
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{video.author}</p>
        <div className="flex items-center text-xs text-gray-400 dark:text-gray-500 space-x-2">
          <span>{formatViews?.(video.view_count) ?? video.view_count} 次观看</span><span>•</span>
          <span>{video.created_at.slice(0, 10)}</span>
        </div>
      </div>
    </div>
  )
}

export default memo(VideoCard)
