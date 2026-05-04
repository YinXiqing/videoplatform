"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
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

interface SearchResultsProps {
	initialVideos: Video[];
	initialTotal: number;
	initialPages: number;
	initialTags: string[];
	query: string;
}

function SearchResultsInner({
	initialVideos,
	initialTotal,
	initialPages,
	initialTags,
	query,
}: SearchResultsProps) {
	const [videos, setVideos] = useState<Video[]>(initialVideos);
	const [total, setTotal] = useState(initialTotal);
	const [totalPages, setTotalPages] = useState(initialPages);
	const [allTags, setAllTags] = useState<string[]>(initialTags);
	const searchUrlParams = useSearchParams();
	const sortBy = searchUrlParams.get("sort") || "newest";
	const [page, setPage] = useState(1);
	const [activeTag, setActiveTag] = useState("");
	const [loading, setLoading] = useState(false);
	const initializedRef = useRef(false);

	const search = useCallback(
		async (p: number, sort: string, tag: string) => {
			setLoading(true);
			try {
				const params: Record<string, any> = {
					search: query,
					sort,
					page: p,
					per_page: 12,
				};
				if (tag) params.tag = tag;
				const res = await api.get("/video/list", { params });
				setVideos(res.data.videos);
				setTotal(res.data.total);
				setTotalPages(res.data.pages);
				const tagSet = new Set<string>();
				res.data.videos.forEach((v: Video) =>
					(v.tags || []).forEach(
						(t: string) => t.trim() && tagSet.add(t.trim()),
					),
				);
				if (tagSet.size > 0)
					setAllTags((prev) => [...new Set([...prev, ...tagSet])]);
			} catch {
			} finally {
				setLoading(false);
			}
		},
		[query],
	);

	useEffect(() => {
		initializedRef.current = false;
		setPage(1);
		setActiveTag("");
		// sortBy is read from URL searchParams in TagBar
		search(1, "newest", "");
		initializedRef.current = true;
	}, [search]);

	useEffect(() => {
		if (!initializedRef.current) return;
		search(page, sortBy, activeTag);
	}, [sortBy, page, activeTag, search]);

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f] py-8">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

				{loading ? (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
						{[...Array(8)].map((_, i) => (
							<div
								key={i}
								className="bg-white dark:bg-[#1f1f1f] rounded-xl shadow-sm overflow-hidden animate-pulse"
							>
								<div className="aspect-video bg-gray-200 dark:bg-[#333]" />
								<div className="p-4">
									<div className="h-4 bg-gray-200 dark:bg-[#333] rounded w-3/4 mb-2" />
									<div className="h-3 bg-gray-200 dark:bg-[#333] rounded w-1/2" />
								</div>
							</div>
						))}
					</div>
				) : videos.length > 0 ? (
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
							<div className="flex justify-center mt-8 items-center gap-1">
								<button
									onClick={() => setPage((p) => Math.max(1, p - 1))}
									disabled={page === 1}
									className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm"
								>
									上一页
								</button>
								{(() => {
									const pages: (number | "...")[] = [];
									if (totalPages <= 7) {
										for (let i = 1; i <= totalPages; i++) pages.push(i);
									} else {
										pages.push(1);
										if (page > 3) pages.push("...");
										for (
											let i = Math.max(2, page - 1);
											i <= Math.min(totalPages - 1, page + 1);
											i++
										)
											pages.push(i);
										if (page < totalPages - 2) pages.push("...");
										pages.push(totalPages);
									}
									return pages.map((p, i) =>
										p === "..." ? (
											<span
												key={`e${i}`}
												className="w-10 h-10 flex items-center justify-center text-gray-400"
											>
												…
											</span>
										) : (
											<button
												key={p}
												onClick={() => setPage(p)}
												className={`w-10 h-10 rounded-lg text-sm ${page === p ? "bg-primary-600 text-white" : "border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"}`}
											>
												{p}
											</button>
										),
									);
								})()}
								<button
									onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
									disabled={page === totalPages}
									className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm"
								>
									下一页
								</button>
							</div>
						)}
					</>
				) : (
					<div className="text-center py-16">
						<h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
							未找到相关视频
						</h3>
						<Link
							href="/"
							className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700"
						>
							返回首页
						</Link>
					</div>
				)}
			</div>
		</div>
	);
}

export default function SearchResults(props: SearchResultsProps) {
	return (
		<Suspense>
			<SearchResultsInner {...props} />
		</Suspense>
	);
}
