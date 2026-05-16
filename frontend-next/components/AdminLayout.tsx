"use client";
import { ExternalLink, LayoutDashboard, LogOut, Rss, Users, Video } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const navItems = [
	{ href: "/admin", label: "概览", icon: LayoutDashboard, exact: true },
	{ href: "/admin/videos", label: "视频管理", icon: Video },
	{ href: "/admin/users", label: "用户管理", icon: Users },
	{ href: "/admin/scraper", label: "视频抓取", icon: Rss },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const { logout } = useAuth();

	return (
		<div className="min-h-screen bg-gray-100 dark:bg-[#0a0a0a]">
			<header className="bg-white dark:bg-[#0f0f0f] border-b border-gray-200 dark:border-gray-800">
				<div className="px-4 sm:px-6">
					<div className="flex items-center gap-6 overflow-x-auto scrollbar-none">
						<Link href="/admin" className="flex items-center gap-2 shrink-0 py-3 mr-2">
							<span className="text-base font-bold text-gray-900 dark:text-gray-100">
								管理后台
							</span>
						</Link>
						<nav className="flex items-center gap-1">
							{navItems.map(({ href, label, icon: Icon, exact }) => {
								const active = exact ? pathname === href : pathname.startsWith(href);
								return (
									<Link
										key={href}
										href={href}
										className={cn(
											"flex items-center gap-2 px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
											active
												? "border-primary-600 text-primary-600 dark:text-primary-400"
												: "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600",
										)}
									>
										<Icon className="w-4 h-4" />
										{label}
									</Link>
								);
							})}
						</nav>
						<div className="flex items-center gap-2 ml-auto shrink-0 py-2">
							<Link
								href="/"
								className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
							>
								<ExternalLink className="w-4 h-4" />
								<span className="hidden sm:inline">前台</span>
							</Link>
							<button
								onClick={logout}
								className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
							>
								<LogOut className="w-4 h-4" />
								<span className="hidden sm:inline">退出</span>
							</button>
						</div>
					</div>
				</div>
			</header>
			<main>{children}</main>
		</div>
	);
}
