'use client'
import { useState } from 'react'
import api from '@/lib/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
  actions?: any[]
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const res = await api.post('/ai/chat', { message: input })
      const assistantMessage: Message = {
        role: 'assistant',
        content: res.data.response || '操作已完成',
        actions: res.data.actions
      }
      setMessages(prev => [...prev, assistantMessage])

      // 执行 UI 操作
      if (res.data.ui_action) {
        executeUIAction(res.data.ui_action)
      }
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `错误: ${err.response?.data?.detail || err.message}`
      }])
    } finally {
      setLoading(false)
    }
  }

  const executeUIAction = (action: any) => {
    if (action.type === 'navigate') {
      window.location.href = action.url
    } else if (action.type === 'fill_and_submit') {
      const input = document.querySelector(action.selector) as HTMLInputElement
      if (input) {
        input.value = action.value
        const form = input.closest('form')
        if (form) form.submit()
      }
    } else if (action.type === 'click_by_text') {
      const elements = Array.from(document.querySelectorAll('button, a'))
      const target = elements.find(el => el.textContent?.includes(action.text))
      if (target) (target as HTMLElement).click()
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f] py-6">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">AI 助手</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">使用自然语言操作视频平台</p>
        </div>

        <div className="bg-white dark:bg-[#1f1f1f] rounded-xl shadow-sm p-6 mb-4" style={{height: '600px', display: 'flex', flexDirection: 'column'}}>
          <div className="flex-1 overflow-y-auto mb-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 dark:text-gray-500 mt-20">
                <p className="mb-4">试试这些指令：</p>
                <div className="space-y-2 text-sm">
                  <p>• 搜索关于"编程"的视频</p>
                  <p>• 播放视频 1</p>
                  <p>• 打开上传页面</p>
                  <p>• 点击"登录"按钮</p>
                  <p>• 列出所有待审核的视频</p>
                </div>
              </div>
            )}
            
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg p-4 ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 dark:bg-[#2a2a2a] text-gray-900 dark:text-gray-100'
                }`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
                      <p className="text-sm font-medium mb-2">执行的操作：</p>
                      {msg.actions.map((action, j) => (
                        <div key={j} className="text-sm mb-2 p-2 bg-white dark:bg-[#1f1f1f] rounded">
                          <p className="font-mono text-xs text-blue-600 dark:text-blue-400">{action.tool}</p>
                          <pre className="text-xs mt-1 overflow-x-auto">{JSON.stringify(action.result, null, 2)}</pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-[#2a2a2a] rounded-lg p-4">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex space-x-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && sendMessage()}
              placeholder="输入指令..."
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-[#2a2a2a] dark:text-gray-100"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              发送
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
