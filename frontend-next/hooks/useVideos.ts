import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Video } from "@/types";

export function useVideoList(params: {
	page?: number;
	per_page?: number;
	search?: string;
	tag?: string;
	sort?: string;
}) {
	return useQuery({
		queryKey: ["videos", params],
		queryFn: async () => {
			const res = await api.get("/video/list", { params });
			return res.data as {
				videos: Video[];
				total: number;
				pages: number;
				current_page: number;
			};
		},
	});
}

export function useVideoDetail(id: string | number) {
	return useQuery({
		queryKey: ["video", id],
		queryFn: async () => {
			const res = await api.get(`/video/detail/${id}`);
			return res.data.video as Video;
		},
		enabled: !!id,
	});
}

export function useFavorited(videoId: string | number, enabled?: boolean) {
	return useQuery({
		queryKey: ["favorited", videoId],
		queryFn: async () => {
			const res = await api.get(`/video/favorited/${videoId}`);
			return res.data.favorited as boolean;
		},
		enabled,
	});
}
