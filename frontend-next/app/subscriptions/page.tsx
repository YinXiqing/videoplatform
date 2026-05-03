"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/AuthGuard";
import VideoCard from "@/components/VideoCard";
import api from "@/lib/api";
import type { Video } from "@/types";

const fmt = (s: number) =>
	s >= 1e6
		? `${(s / 1e6).toFixed(1)}M`
		: s >= 1e3
			? `${(s / 1e3).toFixed(1)}K`
			: String(s);
const dur = (s: number) =>
	s
		? `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
		: "00:00";

export default function SubscriptionsPage() {
	const [videos, setVideos] = useState<Video[]>([]);
	const [loading, setLoading] = useState(true);
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);

	useEffect(() => {
		setLoading(true);
		api
			.get("/follow/feed", { params: { page, per_page: 12 } })
			.then((res) => {
				setVideos(res.data.videos);
				setTotalPages(res.data.pages);
			})
			.catch(() => {})
			.finally(() => setLoading(false));
	}, [page]);

	return (
		<RequireAuth>
			<div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f] py-8">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
						订阅内容
					</h1>

					{loading ? (
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
							{[...Array(8)].map((_, i) => (
								<div
									key={i}
									className="bg-white dark:bg-[#1f1f1f] rounded-xl overflow-hidden animate-pulse"
								>
									<div className="aspect-video bg-gray-200 dark:bg-[#2a2a2a]" />
									<div className="p-4 space-y-2">
										<div className="h-4 bg-gray-200 dark:bg-[#333] rounded w-3/4" />
										<div className="h-3 bg-gray-200 dark:bg-[#333] rounded w-1/2" />
									</div>
								</div>
							))}
						</div>
					) : videos.length === 0 ? (
						<div className="text-center py-16 text-gray-400 dark:text-gray-500">
							<svg
								className="w-12 h-12 mx-auto mb-3"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={1.5}
									d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
								/>
							</svg>
							<p className="mb-2">还没有订阅任何作者</p>
							<Link
								href="/"
								className="text-primary-600 hover:text-primary-700 text-sm"
							>
								去发现感兴趣的视频
							</Link>
						</div>
					) : (
						<>
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
								{videos.map((v, i) => (
									<VideoCard
										key={v.id}
										video={v}
										formatViews={fmt}
										formatDuration={dur}
										priority={i < 4}
									/>
								))}
							</div>
							{totalPages > 1 && (
								<div className="flex justify-center items-center gap-2 mt-8">
									<button
										type="button"
										onClick={() => setPage((p) => Math.max(1, p - 1))}
										disabled={page === 1}
										className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
									>
										上一页
									</button>
									<span className="text-sm text-gray-500 dark:text-gray-400">
										{page} / {totalPages}
									</span>
									<button
										type="button"
										onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
										disabled={page === totalPages}
										className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
									>
										下一页
									</button>
								</div>
							)}
						</>
					)}
				</div>
			</div>
		</RequireAuth>
	);
}
