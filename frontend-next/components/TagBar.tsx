"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

function useTags() {
	return useQuery({
		queryKey: ["tags"],
		queryFn: async () => {
			const res = await api.get("/video/list", { params: { page: 1, per_page: 50 } });
			const tagSet = new Set<string>();
			(res.data.videos || []).forEach((v: any) =>
				(v.tags || []).forEach((t: string) => t.trim() && tagSet.add(t.trim())),
			);
			return [...tagSet].sort((a, b) => a.localeCompare(b, "zh"));
		},
		staleTime: 5 * 60 * 1000,
	});
}

export default function TagBar() {
	const pathname = usePathname();
	const router = useRouter();
	const searchParams = useSearchParams();
	const activeTag = searchParams.get("tag") || "";
	const sortBy = searchParams.get("sort") || "newest";

	const { data: tags = [] } = useTags();

	if (pathname !== "/") return null;

	const setParam = (key: string, value: string) => {
		const params = new URLSearchParams(searchParams.toString());
		if (value) params.set(key, value);
		else params.delete(key);
		router.push(`?${params.toString()}`);
	};

	const btn = (key: string, active: boolean, label: string, onClick: () => void) => (
		<button
			key={key}
			onClick={onClick}
			className={`px-3 py-1 rounded-full text-sm whitespace-nowrap transition-colors shrink-0 ${
				active
					? "bg-primary-600 text-white"
					: "bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
			}`}
		>
			{label}
		</button>
	);

	return (
		<div className="bg-white dark:bg-[#0f0f0f] sticky top-14 z-20">
			<div className="px-4 sm:px-6 lg:px-4">
				<div className="flex items-center gap-3 overflow-x-auto scrollbar-none py-2">
					{/* 排序 */}
					{btn("sort-newest", activeTag === "" && sortBy === "newest", "最新", () => {
						setParam("sort", "");
						setParam("tag", "");
					})}
					{btn("sort-popular", sortBy === "popular", "最热", () => setParam("sort", "popular"))}

					{/* 分隔 */}
					<div className="w-px h-5 bg-gray-300 dark:bg-gray-700 shrink-0" />

					{/* 标签 */}
					{btn("tag-all", activeTag === "", "全部", () => setParam("tag", ""))}
					{tags.map((tag) =>
						btn(tag, activeTag === tag, tag, () =>
							setParam("tag", activeTag === tag ? "" : tag),
						),
					)}
				</div>
			</div>
		</div>
	);
}
