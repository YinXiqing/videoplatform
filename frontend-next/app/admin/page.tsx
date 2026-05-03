"use client";
import { CheckCircle, Clock, Eye, Rss, Users, Video } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireAdmin } from "@/components/AuthGuard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import api from "@/lib/api";
import type { Video as VideoType } from "@/types";

interface Stats {
	total_users: number;
	total_videos: number;
	pending_videos: number;
	approved_videos: number;
	total_views: number;
}

const statCards = (s: Stats) => [
	{
		title: "总用户数",
		value: s.total_users,
		icon: Users,
		href: "/admin/users",
		color: "text-blue-600",
		bg: "bg-blue-50 dark:bg-blue-900/20",
	},
	{
		title: "总视频数",
		value: s.total_videos,
		icon: Video,
		href: "/admin/videos",
		color: "text-green-600",
		bg: "bg-green-50 dark:bg-green-900/20",
	},
	{
		title: "待审核",
		value: s.pending_videos,
		icon: Clock,
		href: "/admin/videos?status=pending",
		color: "text-yellow-600",
		bg: "bg-yellow-50 dark:bg-yellow-900/20",
	},
	{
		title: "已发布",
		value: s.approved_videos,
		icon: CheckCircle,
		href: "/admin/videos?status=approved",
		color: "text-purple-600",
		bg: "bg-purple-50 dark:bg-purple-900/20",
	},
	{
		title: "总播放量",
		value: s.total_views,
		icon: Eye,
		href: "/admin/videos",
		color: "text-red-600",
		bg: "bg-red-50 dark:bg-red-900/20",
	},
];

export default function AdminDashboard() {
	const [stats, setStats] = useState<Stats>({
		total_users: 0,
		total_videos: 0,
		pending_videos: 0,
		approved_videos: 0,
		total_views: 0,
	});
	const [pendingVideos, setPendingVideos] = useState<VideoType[]>([]);
	const [loading, setLoading] = useState(true);

	const [trends, setTrends] = useState<{
		labels: string[];
		video_trends: number[];
		view_trends: number[];
	} | null>(null);

	useEffect(() => {
		Promise.all([
			api.get("/admin/stats").then((r) => setStats(r.data)),
			api.get("/admin/trends").then((r) => setTrends(r.data)),
			api
				.get("/admin/videos", { params: { status: "pending", per_page: 5 } })
				.then((r) => setPendingVideos(r.data.videos)),
		]).finally(() => setLoading(false));
	}, []);

	const maxVideo = Math.max(...(trends?.video_trends ?? [1]), 1);
	const maxView = Math.max(...(trends?.view_trends ?? [1]), 1);

	return (
		<RequireAdmin>
			<div className="p-8">
				<div className="mb-8">
					<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
						概览
					</h1>
					<p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
						平台数据一览
					</p>
				</div>

				{/* 统计卡片 */}
				<div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
					{statCards(stats).map((c) => (
						<Link key={c.title} href={c.href}>
							<Card className="hover:shadow-md transition-shadow cursor-pointer">
								<CardContent className="p-5">
									<div
										className={`w-10 h-10 ${c.bg} rounded-lg flex items-center justify-center mb-3`}
									>
										<c.icon className={`w-5 h-5 ${c.color}`} />
									</div>
									<p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
										{loading ? "—" : c.value.toLocaleString()}
									</p>
									<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
										{c.title}
									</p>
								</CardContent>
							</Card>
						</Link>
					))}
				</div>

				{/* 趋势图表 */}
				{trends && (
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
						<Card>
							<CardHeader>
								<CardTitle className="text-sm">近 7 天新增视频</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="flex items-end gap-2 h-32">
									{trends.labels.map((label, i) => (
										<div
											key={label}
											className="flex-1 flex flex-col items-center gap-1"
										>
											<span className="text-xs text-gray-500">
												{trends.video_trends[i]}
											</span>
											<div
												className="w-full bg-primary-500 rounded-t transition-all"
												style={{
													height: `${(trends.video_trends[i] / maxVideo) * 100}%`,
													minHeight: trends.video_trends[i] > 0 ? "4px" : "0",
												}}
											/>
											<span className="text-xs text-gray-400">{label}</span>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
						<Card>
							<CardHeader>
								<CardTitle className="text-sm">近 7 天新增播放量</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="flex items-end gap-2 h-32">
									{trends.labels.map((label, i) => (
										<div
											key={label}
											className="flex-1 flex flex-col items-center gap-1"
										>
											<span className="text-xs text-gray-500">
												{trends.view_trends[i]}
											</span>
											<div
												className="w-full bg-green-500 rounded-t transition-all"
												style={{
													height: `${(trends.view_trends[i] / maxView) * 100}%`,
													minHeight: trends.view_trends[i] > 0 ? "4px" : "0",
												}}
											/>
											<span className="text-xs text-gray-400">{label}</span>
										</div>
									))}
								</div>
							</CardContent>
						</Card>
					</div>
				)}

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* 待审核视频 */}
					<div className="lg:col-span-2">
						<Card>
							<CardHeader className="flex flex-row items-center justify-between">
								<CardTitle>待审核视频</CardTitle>
								<Button variant="ghost" size="sm" asChild>
									<Link href="/admin/videos?status=pending">查看全部</Link>
								</Button>
							</CardHeader>
							<div className="divide-y divide-gray-100 dark:divide-gray-800">
								{pendingVideos.length === 0 ? (
									<p className="text-center text-gray-400 dark:text-gray-500 py-10 text-sm">
										暂无待审核视频
									</p>
								) : (
									pendingVideos.map((v) => (
										<div
											key={v.id}
											className="flex items-center gap-4 px-6 py-3"
										>
											<div className="relative w-20 h-12 rounded-lg overflow-hidden bg-gray-900 shrink-0">
												{v.cover_image ? (
													<Image
														src={`/api/video/cover/${v.id}`}
														alt={v.title}
														fill
														className="object-cover"
														sizes="80px"
													/>
												) : (
													<div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600" />
												)}
											</div>
											<div className="flex-1 min-w-0">
												<p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
													{v.title}
												</p>
												<p className="text-xs text-gray-500 dark:text-gray-400">
													{v.author} ·{" "}
													{new Date(v.created_at).toLocaleDateString()}
												</p>
											</div>
											<Badge variant="warning">待审核</Badge>
										</div>
									))
								)}
							</div>
						</Card>
					</div>

					{/* 快捷操作 */}
					<div>
						<Card>
							<CardHeader>
								<CardTitle>快捷操作</CardTitle>
							</CardHeader>
							<CardContent className="space-y-2">
								{[
									{
										href: "/admin/scraper",
										label: "视频抓取",
										desc: "从外部网站抓取视频",
										icon: Rss,
										color: "text-primary-600",
									},
									{
										href: "/admin/videos?status=pending",
										label: "审核视频",
										desc: `${stats.pending_videos} 个待处理`,
										icon: Clock,
										color: "text-yellow-600",
									},
									{
										href: "/admin/users",
										label: "用户管理",
										desc: `共 ${stats.total_users} 名用户`,
										icon: Users,
										color: "text-blue-600",
									},
								].map((item) => (
									<Link
										key={item.href}
										href={item.href}
										className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
									>
										<item.icon className={`w-5 h-5 ${item.color} shrink-0`} />
										<div>
											<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
												{item.label}
											</p>
											<p className="text-xs text-gray-500 dark:text-gray-400">
												{item.desc}
											</p>
										</div>
									</Link>
								))}
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</RequireAdmin>
	);
}
