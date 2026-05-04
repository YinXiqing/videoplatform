import "./globals.css";
import type { ReactNode } from "react";
import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/contexts/AuthContext";
import { QueryProvider } from "@/lib/query";

export const viewport = { themeColor: "#e11d48" };

export const metadata = {
	title: "视频平台",
	description: "轻量级视频分享平台",
	manifest: "/manifest.json",
	icons: { icon: "/favicon.svg?v=3", apple: "/icon-192.svg?v=3" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="zh-CN" suppressHydrationWarning>
			<body>
				{/* 防止主题切换闪烁：在 JS 加载前读取 localStorage 并应用主题 */}
				<script
					dangerouslySetInnerHTML={{
						__html: `
          history.scrollRestoration='manual';
          (function(){
            var t = localStorage.getItem('theme');
            if (t === 'light') { document.documentElement.classList.remove('dark'); return; }
            if (t === 'dark') { document.documentElement.classList.add('dark'); return; }
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add('dark');
            else document.documentElement.classList.remove('dark');
          })();
        `,
					}}
				/>
				<QueryProvider>
					<AuthProvider>
						<div className="min-h-screen flex flex-col">
							<Navbar />
							<main className="flex-1 md:pt-0 pt-11">{children}</main>
							<div id="mobile-nav-spacer" className="md:hidden h-16" />
						</div>
					</AuthProvider>
				</QueryProvider>
			</body>
		</html>
	);
}
