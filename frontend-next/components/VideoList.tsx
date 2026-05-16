"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import VideoCard from "@/components/VideoCard";
import api from "@/lib/api";
import type { Video } from "@/types";

const PER_PAGE = 12;
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

interface VideoListProps {
	initialVideos: Video[];
	initialTags: string[];
	initialHasMore: boolean;
}

export default function VideoList({
	initialVideos,
	initialTags,
	initialHasMore,
}: VideoListProps) {
	const [videos, setVideos] = useState<Video[]>(initialVideos);
	const [allTags, setAllTags] = useState<string[]>(initialTags);
	const searchParams = useSearchParams();
	const router = useRouter();
	const activeTag = searchParams.get("tag") || "";
	const sortBy = searchParams.get("sort") || "newest";
	const [page, setPage] = useState(1);
	const [hasMore, setHasMore] = useState(initialHasMore);
	const [loadingMore, setLoadingMore] = useState(false);
	const [showBackTop, setShowBackTop] = useState(false);
	const sentinelRef = useRef<HTMLDivElement>(null);
	const stateRef = useRef({ page, activeTag, sortBy, hasMore, loadingMore });
	stateRef.current = { page, activeTag, sortBy, hasMore, loadingMore };

	const fetchVideos = useCallback(
		async (p: number, tag: string, sort: string, replace: boolean) => {
			setLoadingMore(true);
			try {
				const params: Record<string, any> = {
					page: p,
					per_page: PER_PAGE,
					sort,
				};
				if (tag) params.tag = tag;
				const res = await api.get("/video/list", { params });
				const { videos: newVids, pages } = res.data;
				setVideos((prev) => (replace ? newVids : [...prev, ...newVids]));
				setHasMore(p < pages);
				const tagSet = new Set<string>();
				newVids.forEach((v: Video) =>
					(v.tags || []).forEach(
						(t: string) => t.trim() && tagSet.add(t.trim()),
					),
				);
				if (tagSet.size > 0)
					setAllTags((prev) => [...new Set([...prev, ...tagSet])]);
			} catch {
			} finally {
				setLoadingMore(false);
			}
		},
		[],
	);

	useEffect(() => {
		setPage(1);
		fetchVideos(1, activeTag, sortBy, true);
	}, [activeTag, sortBy, fetchVideos]);

	// 无限滚动
	useEffect(() => {
		const sentinel = sentinelRef.current;
		if (!sentinel) return;
		const obs = new IntersectionObserver(
			(entries) => {
				if (!entries[0].isIntersecting) return;
				const { page, activeTag, sortBy, hasMore, loadingMore } =
					stateRef.current;
				if (!hasMore || loadingMore) return;
				const next = page + 1;
				setPage(next);
				fetchVideos(next, activeTag, sortBy, false);
			},
			{ threshold: 0.1 },
		);
		obs.observe(sentinel);
		return () => obs.disconnect();
	}, [fetchVideos]);

	// 回到顶部：监听滚动位置
	useEffect(() => {
		const onScroll = () => {
			setShowBackTop(window.scrollY > 800);
		};
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	const scrollToTop = () => {
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	return (
		<>
			{videos.length > 0 ? (
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
					<div
						ref={sentinelRef}
						className="h-10 flex items-center justify-center mt-6"
					>
						{loadingMore && (
							<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
						)}
						{!hasMore && (
							<p className="text-gray-400 dark:text-gray-500 text-sm">
								已加载全部视频
							</p>
						)}
					</div>
				</>
			) : (
				<div className="text-center py-16 text-gray-400 dark:text-gray-500">
					<p>{activeTag ? `没有标签为"${activeTag}"的视频` : "暂无视频"}</p>
					{activeTag && (
						<button
							onClick={() => router.push("/")}
							className="mt-2 text-primary-600 text-sm hover:underline"
						>
							清除过滤
						</button>
					)}
				</div>
			)}

			{/* 回到顶部 */}
			{showBackTop && (
				<button
					onClick={scrollToTop}
					className="fixed bottom-20 md:bottom-6 right-6 z-40 w-10 h-10 bg-white dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-full shadow-lg flex items-center justify-center hover:shadow-xl hover:scale-110 transition-all"
					aria-label="回到顶部"
				>
					<svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
					</svg>
				</button>
			)}
		</>
	);
}
