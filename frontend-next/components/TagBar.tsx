"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";

export default function TagBar() {
	const pathname = usePathname();
	const router = useRouter();
	const searchParams = useSearchParams();
	const activeTag = searchParams.get("tag") || "";
	const sortBy = searchParams.get("sort") || "newest";
	const query = searchParams.get("search") || "";
	const isSearch = pathname === "/search";
	const [allTags, setAllTags] = useState<string[]>([]);
	const [total, setTotal] = useState(0);

	const fetchedRef = useRef<string | null>(null);
	useEffect(() => {
		if (pathname === "/") {
			if (fetchedRef.current === "/") return;
			fetchedRef.current = "/";
			api.get("/video/list", { params: { page: 1, per_page: 50 } })
				.then((res) => {
					const tags = new Set<string>();
					(res.data.videos || []).forEach((v: any) =>
						(v.tags || []).forEach((t: string) => t.trim() && tags.add(t.trim())),
					);
					setAllTags([...tags]);
				})
				.catch(() => {});
		} else if (isSearch) {
			const params: any = { page: 1, per_page: 50 };
			if (query) params.search = query;
			api.get("/video/list", { params })
				.then((res) => {
					setTotal(res.data.total || 0);
					const tags = new Set<string>();
					(res.data.videos || []).forEach((v: any) =>
						(v.tags || []).forEach((t: string) => t.trim() && tags.add(t.trim())),
					);
					setAllTags([...tags]);
				})
				.catch(() => {});
		}
	}, [pathname, isSearch, query]);

	if (pathname !== "/" && !isSearch) return null;

	const setTag = (tag: string) => {
		const params = new URLSearchParams(searchParams.toString());
		if (tag) params.set("tag", tag);
		else params.delete("tag");
		router.push(`?${params.toString()}`);
	};

	const setSort = (s: string) => {
		const params = new URLSearchParams(searchParams.toString());
		if (s === "popular") params.set("sort", "popular");
		else params.delete("sort");
		router.push(`?${params.toString()}`);
	};

	return (
		<div className="bg-white dark:bg-[#0f0f0f] sticky top-14 z-20">
			<div className="px-4 sm:px-6 lg:px-4">
				<div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-2">
					{isSearch && query && (
						<span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap shrink-0">
							"{query}" 的搜索结果 共 {total} 个视频
						</span>
					)}
					<button
						onClick={() => setTag("")}
						className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition-colors shrink-0 ${
							activeTag === "" ? "bg-primary-600 text-white" : "bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
						}`}
					>
						全部
					</button>
					{["newest", "popular"].map((s) => (
						<button
							key={s}
							onClick={() => setSort(s)}
							className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition-colors shrink-0 ${
								sortBy === s ? "bg-primary-600 text-white" : "bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
							}`}
						>
							{s === "newest" ? "最新" : "最热"}
						</button>
					))}
					{allTags.slice(0, 20).map((tag) => (
						<button
							key={tag}
							onClick={() => setTag(activeTag === tag ? "" : tag)}
							className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition-colors shrink-0 ${
								activeTag === tag ? "bg-primary-600 text-white" : "bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
							}`}
						>
							{tag}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
