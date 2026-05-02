import './globals.css'
import type { ReactNode } from 'react'
import Script from 'next/script'
import { AuthProvider } from '@/contexts/AuthContext'
import Navbar from '@/components/Navbar'

export const metadata = { title: '视频平台', description: '轻量级视频分享平台', icons: { icon: '/icon.svg' } }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <body>
        {/* 防止主题切换闪烁：在 JS 加载前读取 localStorage 并应用主题 */}
        <script dangerouslySetInnerHTML={{ __html: `
          history.scrollRestoration='manual';
          (function(){
            var t = localStorage.getItem('theme');
            if (t === 'light') document.documentElement.classList.remove('dark');
            else document.documentElement.classList.add('dark');
          })();
        `}} />
        <Script src="https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js" strategy="afterInteractive" />
        <AuthProvider>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-1 md:pt-0 pt-11">{children}</main>
            <div id="mobile-nav-spacer" className="md:hidden h-16" />
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}
