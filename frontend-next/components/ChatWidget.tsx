'use client'
import { useState, useRef, useEffect } from 'react'

type Message = { role: 'user' | 'assistant'; content: string }
type Mode = 'chat' | 'control'

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('control')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    // 切换模式时显示欢迎消息
    if (mode === 'control') {
      setMessages([{
        role: 'assistant',
        content: '🎮 操控模式已启动\n\n我可以帮你操作平台：\n• 搜索编程\n• 播放视频 1\n• 打开首页\n• 退出登录\n• 我的视频'
      }])
    } else {
      setMessages([{
        role: 'assistant',
        content: '💬 问答模式已启动\n\n有什么问题想问我？'
      }])
    }
  }, [mode])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    const assistantMsg: Message = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, assistantMsg])

    if (mode === 'control') {
      // 操控模式
      try {
        const pageElements: any[] = []
        const clickable = document.querySelectorAll('button, a, [role="button"]')
        clickable.forEach((el) => {
          const text = el.textContent?.trim()
          if (text && text.length < 50) {
            pageElements.push({ type: el.tagName.toLowerCase(), text })
          }
        })
        
        const controlRes = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, page_elements: pageElements.slice(0, 30) }),
        })
        
        if (controlRes.ok) {
          const data = await controlRes.json()
          
          setMessages(prev => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: 'assistant', content: data.response }
            return updated
          })
          
          if (data.ui_action) {
            setTimeout(() => executeUIAction(data.ui_action), 300)
          }
        }
      } catch (e) {
        setMessages(prev => { const u = [...prev]; u[u.length - 1].content = '操作失败，请重试'; return u })
      } finally {
        setLoading(false)
      }
    } else {
      // 问答模式
      try {
        const res = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: newMessages }),
        })
        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const lines = decoder.decode(value).split('\n')
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const { content } = JSON.parse(data)
              if (content) setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: 'assistant', content: updated[updated.length - 1].content + content }
                return updated
              })
            } catch {}
          }
        }
      } catch (e) {
        setMessages(prev => { const u = [...prev]; u[u.length - 1].content = '请求失败，请检查 Ollama 是否运行'; return u })
      } finally {
        setLoading(false)
      }
    }
  }

  const executeUIAction = (action: any) => {
    if (action.type === 'navigate') {
      window.location.href = action.url
    } 
    else if (action.type === 'fill_and_submit') {
      const input = document.querySelector(action.selector) as HTMLInputElement
      if (input) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(input, action.value)
        }
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
        input.focus()
        
        setTimeout(() => {
          const keyword = encodeURIComponent(action.value)
          window.location.href = `/search?search=${keyword}`
        }, 200)
      }
    } 
    else if (action.type === 'click_by_text') {
      const elements = Array.from(document.querySelectorAll('button, a, [role="button"]'))
      const target = elements.find(el => el.textContent?.includes(action.text))
      if (target) (target as HTMLElement).click()
    }
  }

  return (
    <>
      {/* 悬浮按钮 */}
      <button onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110">
        {open
          ? <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
        }
      </button>

      {/* 聊天面板 */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-96 h-[550px] bg-white dark:bg-[#1f1f1f] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700">
          {/* 头部 */}
          <div className="px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-sm font-medium">AI 助手</span>
                <span className="text-xs opacity-70">qwen3:0.6b</span>
              </div>
              <button onClick={() => setMessages([])} className="text-xs opacity-70 hover:opacity-100 transition">清空</button>
            </div>
            
            {/* 模式切换 */}
            <div className="flex gap-1 bg-white/20 rounded-lg p-1">
              <button
                onClick={() => setMode('control')}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  mode === 'control' 
                    ? 'bg-white text-blue-600 shadow' 
                    : 'text-white/80 hover:text-white'
                }`}
              >
                🎮 操控模式
              </button>
              <button
                onClick={() => setMode('chat')}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  mode === 'chat' 
                    ? 'bg-white text-purple-600 shadow' 
                    : 'text-white/80 hover:text-white'
                }`}
              >
                💬 问答模式
              </button>
            </div>
          </div>

          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-[#0f0f0f]">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                  m.role === 'user'
                    ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-br-sm shadow-md'
                    : 'bg-white dark:bg-[#2a2a2a] text-gray-900 dark:text-gray-100 rounded-bl-sm shadow border border-gray-100 dark:border-gray-700'
                }`}>
                  {m.content || (loading && i === messages.length - 1
                    ? <span className="flex gap-1 items-center h-4"><span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}} /><span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}} /><span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}} /></span>
                    : '')}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* 输入框 */}
          <div className="p-3 bg-white dark:bg-[#1f1f1f] border-t border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder={mode === 'control' ? '输入操作指令...' : '输入你的问题...'}
                disabled={loading}
                className="flex-1 text-sm px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-[#2a2a2a] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-purple-500 disabled:opacity-50 transition" />
              <button onClick={send} disabled={loading || !input.trim()}
                className="px-4 py-2.5 bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 disabled:opacity-40 transition-all shadow-md hover:shadow-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
