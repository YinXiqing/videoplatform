"use client";
import { X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/AuthGuard";
import Toast from "@/components/Toast";
import api from "@/lib/api";
import type { Video } from "@/types";

const dur = (s: number | null) =>
	s ? `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : "";

export default function FavoritesPage() {
	const [favorites, setFavorites] = useState<{ created_at: string; video: Video }[]>([]);
	const [loading, setLoading] = useState(true);
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);
	const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

	const showToast = (msg: string, type: "success" | "error" = "success") => setToast({ msg, type });

	const fetchFavorites = useCallback(async (p = 1) => {
		setLoading(true);
		try {
			const res = await api.get("/video/favorites", { params: { page: p, per_page: 20 } });
			setFavorites(res.data.favorites);
			setTotalPages(res.data.pages);
		} catch {
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchFavorites(page);
	}, [page, fetchFavorites]);

	const removeFavorite = async (videoId: number) => {
		try {
			await api.post(`/video/favorite/${videoId}`);
			setFavorites((prev) => prev.filter((f) => f.video.id !== videoId));
			showToast("已取消收藏");
		} catch {
			showToast("操作失败", "error");
		}
	};

	return (
		<RequireAuth>
			<div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f] py-8">
				<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
					<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">我的收藏</h1>

					{loading ? (
						<div className="space-y-4">
							{[...Array(5)].map((_, i) => (
								<div key={`skel-${i}`} className="bg-white dark:bg-[#1f1f1f] rounded-xl p-4 flex gap-4 animate-pulse">
									<div className="w-40 h-24 bg-gray-200 dark:bg-[#333] rounded-lg flex-shrink-0" />
									<div className="flex-1 space-y-2 py-1">
										<div className="h-4 bg-gray-200 dark:bg-[#333] rounded w-3/4" />
										<div className="h-3 bg-gray-200 dark:bg-[#333] rounded w-1/4" />
									</div>
								</div>
							))}
						</div>
					) : favorites.length === 0 ? (
						<div className="text-center py-16 text-gray-400 dark:text-gray-500">
							<svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
									d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
							</svg>
							<p>还没有收藏视频</p>
							<Link href="/" className="inline-block mt-4 text-primary-600 hover:text-primary-700 text-sm">去发现视频</Link>
						</div>
					) : (
						<>
							<div className="space-y-3">
								{favorites.map(({ created_at, video }) => (
									<div key={`${video.id}-${created_at}`}
										className="bg-white dark:bg-[#1f1f1f] rounded-xl p-4 flex gap-4 hover:shadow-md transition-shadow group">
										<Link href={`/video/${video.id}`} className="flex gap-4 flex-1 min-w-0">
											<div className="relative w-40 h-24 bg-gray-900 rounded-lg overflow-hidden flex-shrink-0">
												{video.cover_image ? (
													<Image src={`/api/video/cover/${video.id}`} alt={video.title} fill className="object-cover" sizes="160px" />
												) : (
													<div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600" />
												)}
												{video.duration && (
													<div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">{dur(video.duration)}</div>
												)}
											</div>
											<div className="flex-1 min-w-0">
												<h3 className="font-medium text-gray-900 dark:text-gray-100 line-clamp-2 mb-1">{video.title}</h3>
												<p className="text-sm text-gray-500 dark:text-gray-400">{video.author}</p>
												<p className="text-xs text-gray-400 dark:text-gray-500 mt-1">收藏于 {new Date(created_at).toLocaleString()}</p>
											</div>
										</Link>
										<button
											onClick={() => removeFavorite(video.id)}
											className="shrink-0 self-center p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
											title="取消收藏"
										>
											<X className="w-4 h-4" />
										</button>
									</div>
								))}
							</div>
							{totalPages > 1 && (
								<div className="flex justify-center items-center gap-2 mt-4">
									<button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
										className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800">
										上一页
									</button>
									<span className="text-sm text-gray-500 dark:text-gray-400">{page} / {totalPages}</span>
									<button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
										className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800">
										下一页
									</button>
								</div>
							)}
						</>
					)}
				</div>
			</div>
			{toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
		</RequireAuth>
	);
}
