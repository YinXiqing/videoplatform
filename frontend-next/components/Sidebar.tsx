"use client";
import { Heart, Home, History, Rss, Shield, ThumbsUp, Video, User, ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
	const { user, isAdmin } = useAuth();
	const pathname = usePathname();
	const [meOpen, setMeOpen] = useState(true);
	const [subscriptions, setSubscriptions] = useState<{ id: number; username: string; avatar: string | null }[]>([]);
	const sidebarRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open || !user) return;
		api.get("/follow/list").then((r) => setSubscriptions(r.data.users)).catch(() => {});
	}, [open, user]);

	useEffect(() => {
		if (!open) return;
		const handleClick = (e: MouseEvent) => {
			if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
				onClose();
			}
		};
		const handleEsc = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("mousedown", handleClick);
		document.addEventListener("keydown", handleEsc);
		return () => {
			document.removeEventListener("mousedown", handleClick);
			document.removeEventListener("keydown", handleEsc);
		};
	}, [open]);

	useEffect(() => { onClose(); }, [pathname]);

	const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

	const navItem = (href: string, icon: any, label: string) => {
		const target = !user && href !== "/" ? "/login" : href;
		return (
			<Link href={target}
				className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive(href) ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium" : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"}`}>
				{icon}
				{label}
			</Link>
		);
	};

	return (
		<>
			{/* 遮罩 */}
			{open && <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />}

			{/* 侧边栏 */}
			<aside ref={sidebarRef}
				className={`fixed top-0 left-0 z-50 h-full w-60 bg-white dark:bg-[#1a1a1a] border-r border-gray-200 dark:border-gray-800 shadow-xl transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full"}`}>
				<div className="flex flex-col h-full">
					{/* Header */}
					<div className="flex items-center h-14 px-4 border-b border-gray-100 dark:border-gray-800">
						<button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 mr-2">
							<svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
						<Link href="/" className="flex items-center gap-2">
							<div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
								<svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
									<path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
								</svg>
							</div>
							<span className="text-base font-bold text-gray-900 dark:text-gray-100">视频平台</span>
						</Link>
					</div>

					{/* 菜单 */}
					<nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
						{navItem("/", <Home className="w-5 h-5" />, "首页")}

						<>
							{navItem("/subscriptions", <Rss className="w-5 h-5" />, "订阅动态")}
								<div className="pt-3 pb-1">
									<p className="text-xs font-medium text-gray-400 dark:text-gray-500 px-3 uppercase tracking-wider">已订阅作者</p>
								</div>
								{subscriptions.length > 0 ? (
									subscriptions.slice(0, 10).map((s) => (
										<Link key={s.id} href={`/user/${s.id}`}
											className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
											<div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0 overflow-hidden">
												{s.avatar ? (
													<img src={`/uploads/${s.avatar}`} alt="" className="w-full h-full object-cover" />
												) : (
													<span className="text-xs font-semibold text-primary-700 dark:text-primary-400">{s.username.charAt(0).toUpperCase()}</span>
												)}
											</div>
											<span className="truncate">{s.username}</span>
										</Link>
									))
								) : (
									<p className="px-3 py-1.5 text-xs text-gray-400 dark:text-gray-500">暂无订阅</p>
								)}

								{user && (<>
								<div className="pt-3 pb-1 flex items-center justify-between px-3">
									<p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">我</p>
									<button onClick={() => setMeOpen(!meOpen)} className="text-gray-400 hover:text-gray-600">
										<ChevronDown className={`w-4 h-4 transition-transform ${meOpen ? "" : "-rotate-90"}`} />
									</button>
								</div>
								{meOpen && (
									<>
										{navItem(`/user/${user.id}`, <User className="w-5 h-5" />, "我的频道")}
										{navItem("/history", <History className="w-5 h-5" />, "历史记录")}
										{navItem("/liked", <ThumbsUp className="w-5 h-5" />, "赞过的视频")}
										{navItem("/favorites", <Heart className="w-5 h-5" />, "我的收藏")}
										{navItem("/my-videos", <Video className="w-5 h-5" />, "我的视频")}
											{isAdmin() && navItem("/admin", <Shield className="w-5 h-5" />, "管理后台")}
									</>
								)}
							</>)}
					</>
					</nav>

					{/* 底部 */}
					{!user && (
						<div className="px-4 py-4 border-t border-gray-100 dark:border-gray-800">
							<Link href="/login" className="block w-full text-center py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
								登录
							</Link>
						</div>
					)}
				</div>
			</aside>
		</>
	);
}
