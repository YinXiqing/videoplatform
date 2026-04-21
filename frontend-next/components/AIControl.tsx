'use client'
import { useState, useEffect } from 'react'
import api from '@/lib/api'

export default function AIControl() {
  const [show, setShow] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault()
        setShow(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const executeCommand = async () => {
    if (!input.trim() || loading) return
    setLoading(true)
    setResult('')

    try {
      const res = await api.post('/ai/chat', { message: input })
      setResult(res.data.response)

      console.log('AI 响应:', res.data)

      // 执行 UI 操作
      if (res.data.ui_action) {
        console.log('执行 UI 操作:', res.data.ui_action)
        setTimeout(() => {
          executeUIAction(res.data.ui_action)
          setShow(false) // 执行后关闭控制台
        }, 300)
      }
    } catch (err: any) {
      setResult(`错误: ${err.response?.data?.detail || err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const executeUIAction = (action: any) => {
    console.log('开始执行操作:', action)
    
    if (action.type === 'navigate') {
      console.log('跳转到:', action.url)
      window.location.href = action.url
    } 
    else if (action.type === 'fill_and_submit') {
      console.log('查找输入框:', action.selector)
      const input = document.querySelector(action.selector) as HTMLInputElement
      console.log('找到输入框:', input)
      
      if (input) {
        input.value = action.value
        input.focus()
        
        // 触发 React 的 onChange 事件
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        nativeInputValueSetter?.call(input, action.value)
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
        
        console.log('已填写:', action.value)
        
        // 查找并点击搜索按钮或提交表单
        const form = input.closest('form')
        if (form) {
          console.log('提交表单')
          const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement
          if (submitBtn) {
            submitBtn.click()
          } else {
            form.requestSubmit()
          }
        }
      } else {
        console.error('未找到输入框:', action.selector)
      }
    } 
    else if (action.type === 'click_by_text') {
      console.log('查找包含文本的元素:', action.text)
      const elements = Array.from(document.querySelectorAll('button, a, [role="button"]'))
      const target = elements.find(el => el.textContent?.includes(action.text))
      console.log('找到元素:', target)
      
      if (target) {
        (target as HTMLElement).click()
        console.log('已点击')
      } else {
        console.error('未找到包含文本的元素:', action.text)
      }
    }
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-start justify-center pt-20">
      <div className="bg-white dark:bg-[#1f1f1f] rounded-lg shadow-2xl w-full max-w-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">AI 控制台</h3>
          <button onClick={() => setShow(false)} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && executeCommand()}
            placeholder="输入指令... (例如: 搜索编程, 播放视频1, 打开首页)"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-[#2a2a2a] dark:text-gray-100"
            disabled={loading}
            autoFocus
          />

          {result && (
            <div className="p-4 bg-gray-50 dark:bg-[#2a2a2a] rounded-lg text-sm text-gray-700 dark:text-gray-300">
              {result}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={executeCommand}
              disabled={loading || !input.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? '执行中...' : '执行'}
            </button>
          </div>

          <div className="text-xs text-gray-400 dark:text-gray-500">
            提示: 按 Ctrl+K 打开/关闭控制台
          </div>
        </div>
      </div>
    </div>
  )
}
