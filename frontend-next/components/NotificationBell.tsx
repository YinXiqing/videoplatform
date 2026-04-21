'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import api from '@/lib/api'

export default function NotificationBell() {
  const { user, isAdmin } = useAuth()
  const [count, setCount] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      try {
        if (isAdmin()) {
          const res = await api.get('/video/list?status=pending')
          setCount(res.data.total ?? 0)
        } else {
          const res = await api.get('/video/my-videos')
          setCount((res.data.videos ?? []).filter((v: { status: string }) => v.status === 'rejected').length)
        }
      } catch {}
    })()
  }, [user])

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538.214 1.055.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{count}</span>
        )}
      </button>
      {showDropdown && (
        <div className="absolute right-0 top-10 w-64 bg-white dark:bg-[#2a2a2a] rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-1 text-sm z-50">
          <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
            <p className="font-medium text-gray-900 dark:text-gray-100">{isAdmin() ? '待审核视频' : '审核未通过'}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">共 {count} 个</p>
          </div>
          {count > 0 && (
            <Link href={isAdmin() ? '/admin/videos' : '/my-videos'}
              onClick={() => setShowDropdown(false)}
              className="block px-4 py-2 text-primary-600 dark:text-primary-400 hover:bg-gray-50 dark:hover:bg-[#333] transition-colors">
              {isAdmin() ? '立即审核 →' : '查看我的视频 →'}
            </Link>
          )}
          {count === 0 && <p className="px-4 py-2 text-gray-400 dark:text-gray-500">暂无通知</p>}
        </div>
      )}
    </div>
  )
}
