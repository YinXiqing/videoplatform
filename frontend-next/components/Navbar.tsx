"use client";
import { Menu, Upload, Bell, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import NotificationBell from "./NotificationBell";
import Sidebar from "./Sidebar";
import ThemeToggle from "./ThemeToggle";
import api from "@/lib/api";

export default function Navbar() {
	const { user, logout } = useAuth();
	const pathname = usePathname();
	const router = useRouter();
	const searchParams = useSearchParams();
	const [q, setQ] = useState("");
	const [showHistory, setShowHistory] = useState(false);
	const [searchHistory, setSearchHistory] = useState<string[]>([]);
	const [suggestions, setSuggestions] = useState<string[]>([]);
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const closeSidebar = useCallback(() => setSidebarOpen(false), []);

	useEffect(() => {
		if (pathname === "/search") setQ(searchParams.get("search") || "");
	}, [pathname, searchParams]);

	useEffect(() => {
		const h = localStorage.getItem("search_history");
		if (h) setSearchHistory(JSON.parse(h));
	}, []);

	const saveHistory = (term: string) => {
		if (!term.trim()) return;
		const updated = [term, ...searchHistory.filter((h) => h !== term)].slice(0, 8);
		setSearchHistory(updated);
		localStorage.setItem("search_history", JSON.stringify(updated));
	};

	useEffect(() => {
		if (!q.trim()) { setSuggestions([]); return; }
		const timer = setTimeout(async () => {
			try { const res = await api.get("/video/suggest", { params: { q } }); setSuggestions(res.data.suggestions); }
			catch { setSuggestions([]); }
		}, 200);
		return () => clearTimeout(timer);
	}, [q]);

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		if (!q.trim()) return;
		saveHistory(q.trim());
		setShowHistory(false);
		router.push(`/search?search=${encodeURIComponent(q.trim())}`);
	};

	const handleHistoryClick = (term: string) => {
		setQ(term); setShowHistory(false);
		saveHistory(term);
		router.push(`/search?search=${encodeURIComponent(term)}`);
	};

	const removeHistory = (term: string, e: React.MouseEvent) => {
		e.stopPropagation();
		setSearchHistory((prev) => prev.filter((h) => h !== term));
		localStorage.setItem("search_history", JSON.stringify(searchHistory.filter((h) => h !== term)));
	};

	const handleLogout = () => { logout(); router.push("/"); };

	return (
		<>
			<Sidebar open={sidebarOpen} onClose={closeSidebar} />

			<header className="bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800 sticky top-0 z-30">
				<div className="px-4 sm:px-6 lg:px-8">
					<div className="flex items-center h-14 max-w-7xl mx-auto">
						{/* 左侧：汉堡 + Logo */}
						<div className="flex items-center gap-2 flex-shrink-0 z-10">
							<button
								onClick={() => setSidebarOpen((v) => !v)}
								className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
								aria-label="菜单"
							>
								<Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
							</button>
							<Link href="/" className="flex items-center gap-2">
								<div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
									<svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
										<path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
									</svg>
								</div>
								<span className="hidden sm:block text-base font-bold text-gray-900 dark:text-gray-100">视频平台</span>
							</Link>
						</div>

						{/* 搜索栏（桌面居中） */}
						<form onSubmit={handleSearch} className="hidden md:block absolute left-1/2 -translate-x-1/2 w-full max-w-lg px-4">
							<div className="relative">
								<input type="text" value={q} onChange={(e) => setQ(e.target.value)}
									onFocus={() => setShowHistory(true)}
									onBlur={() => setTimeout(() => setShowHistory(false), 150)}
									placeholder="搜索视频..."
									className="w-full pl-4 pr-9 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#2a2a2a] dark:text-gray-100 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400 focus:bg-white dark:focus:bg-[#333] transition-all" />
								<button type="submit" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-600 transition-colors">
									<Search className="w-3.5 h-3.5" />
								</button>
								{showHistory && searchHistory.length > 0 && (
									<div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#2a2a2a] rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-50">
										{q.trim() ? suggestions.map((s) => (
											<div key={s} onMouseDown={() => { setQ(s); }}
												className="px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-300">{s}</div>
										)) : searchHistory.map((term) => (
											<div key={term} onClick={() => handleHistoryClick(term)}
												className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
												<span className="flex items-center gap-2">
													<svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
													</svg>
													{term}
												</span>
												<button onClick={(e) => removeHistory(term, e)} className="text-gray-300 hover:text-gray-500">
													<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
													</svg>
												</button>
											</div>
										))}
									</div>
								)}
							</div>
						</form>

						{/* 右侧 */}
						<div className="flex items-center gap-2 ml-auto z-10">
							{user ? (
								<>
									<Link href="/upload"
										className="hidden sm:flex items-center gap-1 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors px-2 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
										<Upload className="w-4 h-4" />
										<span className="hidden md:block">上传</span>
									</Link>
									<ThemeToggle />
									<NotificationBell />
									<Link href="/profile"
										className="w-8 h-8 rounded-full overflow-hidden bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center hover:ring-2 hover:ring-primary-300 transition-all"
										title="个人设置">
										{user.avatar ? (
											<img src={`/uploads/${user.avatar}`} alt="" className="w-full h-full object-cover" />
										) : (
											<span className="text-sm font-semibold text-primary-700">{user.username.charAt(0).toUpperCase()}</span>
										)}
									</Link>
									<button onClick={handleLogout}
										className="px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
										title="退出登录">
										退出
									</button>
								</>
							) : (
								<>
									<ThemeToggle />
									<Link href="/login" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 px-2">登录</Link>
									<Link href="/register" className="bg-primary-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">注册</Link>
								</>
							)}
						</div>
					</div>

					{/* 搜索栏（移动端） */}
					<div className="md:hidden pb-2">
						<form onSubmit={handleSearch} className="relative">
							<input type="text" value={q} onChange={(e) => setQ(e.target.value)}
								placeholder="搜索视频..."
								className="w-full pl-4 pr-9 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#2a2a2a] dark:text-gray-100 dark:placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all" />
							<button type="submit" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-600">
								<Search className="w-3.5 h-3.5" />
							</button>
						</form>
					</div>
				</div>
			</header>

			{/* 移动端底部导航 */}
			{!pathname.startsWith("/admin") && !pathname.startsWith("/video/") && (
				<nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-[#1a1a1a] border-t border-gray-200 dark:border-gray-800 z-50 flex">
					{[
						{ href: "/", label: "首页", d: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
						{ href: "/search", label: "搜索", d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
						{ href: user ? "/upload" : "/login", label: "上传", d: "M12 4v16m8-8H4" },
						user ? { href: `/user/${user.id}`, label: "我的", d: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" }
							: { href: "/login", label: "登录", d: "M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" },
					].map((item) => (
						<Link key={item.label} href={item.href}
							className={`flex-1 flex flex-col items-center py-2 text-xs transition-colors ${pathname === item.href ? "text-primary-600" : "text-gray-500"}`}>
							<svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.d} />
							</svg>
							{item.label}
						</Link>
					))}
				</nav>
			)}
		</>
	);
}
