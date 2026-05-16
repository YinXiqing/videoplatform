"use client";
import { Heart, History, Rss, Shield, ThumbsUp, Video, User, ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSidebar } from "@/contexts/SidebarContext";
import api from "@/lib/api";

export default function Sidebar() {
	const { user, isAdmin } = useAuth();
	const pathname = usePathname();
	const { open } = useSidebar();
	const [meOpen, setMeOpen] = useState(true);
	const [subscriptions, setSubscriptions] = useState<{ id: number; username: string; avatar: string | null }[]>([]);

	useEffect(() => {
		if (!user) return;
		api.get("/follow/list").then((r) => setSubscriptions(r.data.users)).catch(() => {});
	}, [user]);

	const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

	const navItem = (href: string, icon: React.ReactNode, label: string) => {
		const target = !user && href !== "/" ? "/login" : href;
		return (
			<Link
				href={target}
				title={open ? undefined : label}
				className={`flex items-center gap-3 rounded-lg text-sm transition-colors ${
					open ? "px-3 py-2" : "px-0 py-2 justify-center"
				} ${
					isActive(href)
						? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium"
						: "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
				}`}
			>
				<span className="shrink-0">{icon}</span>
				{open && <span className="truncate">{label}</span>}
			</Link>
		);
	};

	return (
		<aside
			className={`hidden md:flex flex-col h-[calc(100vh-3.5rem)] sticky top-14 bg-white dark:bg-[#0f0f0f] transition-all duration-200 ${
				open ? "w-60" : "w-16"
			}`}
		>
			<nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
				{navItem("/", <HomeIcon />, "首页")}

				{user && navItem("/subscriptions", <Rss className="w-5 h-5" />, "订阅动态")}

				{user && open && (
					<>
						<div className="pt-3 pb-1">
							<p className="text-xs font-medium text-gray-400 dark:text-gray-500 px-3 uppercase tracking-wider">
								已订阅作者
							</p>
						</div>
						{subscriptions.length > 0
							? subscriptions.slice(0, 10).map((s) => (
									<Link
										key={s.id}
										href={`/user/${s.id}`}
										title={s.username}
										className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
									>
										<div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0 overflow-hidden">
											{s.avatar ? (
												<img src={`/uploads/${s.avatar}`} alt="" className="w-full h-full object-cover" loading="lazy" />
											) : (
												<span className="text-xs font-semibold text-primary-700 dark:text-primary-400">
													{s.username.charAt(0).toUpperCase()}
												</span>
											)}
										</div>
										<span className="truncate">{s.username}</span>
									</Link>
								))
							: (
								<p className="px-3 py-1.5 text-xs text-gray-400 dark:text-gray-500">
									暂无订阅
								</p>
							)}
					</>
				)}

				{user && (
					<>
						{open && (
							<div className="pt-3 pb-1 flex items-center justify-between px-3">
								<p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
									我
								</p>
								<button onClick={() => setMeOpen(!meOpen)} className="text-gray-400 hover:text-gray-600">
									<ChevronDown className={`w-4 h-4 transition-transform ${meOpen ? "" : "-rotate-90"}`} />
								</button>
							</div>
						)}
						{(open ? meOpen : true) && (
							<>
								{navItem(`/user/${user.id}`, <User className="w-5 h-5" />, "我的频道")}
								{navItem("/history", <History className="w-5 h-5" />, "历史记录")}
								{navItem("/liked", <ThumbsUp className="w-5 h-5" />, "赞过的视频")}
								{navItem("/favorites", <Heart className="w-5 h-5" />, "我的收藏")}
								{navItem("/my-videos", <Video className="w-5 h-5" />, "我的视频")}
								{isAdmin() && navItem("/admin", <Shield className="w-5 h-5" />, "管理后台")}
							</>
						)}
					</>
				)}
			</nav>
		</aside>
	);
}

function HomeIcon() {
	return (
		<svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
		</svg>
	);
}
