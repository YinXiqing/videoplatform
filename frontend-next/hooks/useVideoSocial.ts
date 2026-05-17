"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";

/**
 * 视频互动状态 + 操作：收藏、关注作者。
 */
export function useVideoSocial(videoId: number, authorId: number) {
	const { user } = useAuth();
	const [favorited, setFavorited] = useState(false);
	const [following, setFollowing] = useState(false);
	const [followerCount, setFollowerCount] = useState(0);

	useEffect(() => {
		if (!user) return;
		api
			.get(`/video/favorited/${videoId}`)
			.then((r) => setFavorited(r.data.favorited))
			.catch(() => {});
	}, [videoId, user]);

	useEffect(() => {
		if (!user) return;
		api
			.get(`/follow/${authorId}/status`)
			.then((r) => setFollowing(r.data.following))
			.catch(() => {});
		api
			.get(`/follow/${authorId}/count`)
			.then((r) => setFollowerCount(r.data.followers))
			.catch(() => {});
	}, [authorId, user]);

	const toggleFollow = useCallback(async () => {
		try {
			const res = await api.post(`/follow/${authorId}`);
			setFollowing(res.data.following);
		} catch {}
	}, [authorId]);

	const toggleFavorite = useCallback(async () => {
		try {
			const res = await api.post(`/video/favorite/${videoId}`);
			setFavorited(res.data.favorited);
		} catch {}
	}, [videoId]);

	return {
		favorited,
		following,
		followerCount,
		toggleFollow,
		toggleFavorite,
	};
}
