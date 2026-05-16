"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";

export interface VideoSocialState {
	favorited: boolean;
	liked: boolean;
	disliked: boolean;
	following: boolean;
	followerCount: number;
}

export interface VideoSocialActions {
	rateVideo: (type: string) => Promise<void>;
	toggleFollow: () => Promise<void>;
	toggleFavorite: () => Promise<void>;
}

/**
 * 视频互动状态 + 操作：收藏、点赞/点踩、关注作者。
 */
export function useVideoSocial(videoId: number, authorId: number) {
	const { user } = useAuth();
	const [favorited, setFavorited] = useState(false);
	const [liked, setLiked] = useState(false);
	const [disliked, setDisliked] = useState(false);
	const [following, setFollowing] = useState(false);
	const [followerCount, setFollowerCount] = useState(0);

	// 拉取初始状态
	useEffect(() => {
		if (!user) return;
		api
			.get(`/video/favorited/${videoId}`)
			.then((r) => setFavorited(r.data.favorited))
			.catch(() => {});
		api
			.get(`/video/rate/${videoId}/status`)
			.then((r) => {
				setLiked(r.data.liked);
				setDisliked(r.data.disliked);
			})
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

	const rateVideo = useCallback(
		async (type: string) => {
			try {
				const res = await api.post(`/video/rate/${videoId}`, { type });
				setLiked(res.data.liked);
				setDisliked(res.data.disliked);
			} catch {}
		},
		[videoId],
	);

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
		liked,
		disliked,
		following,
		followerCount,
		rateVideo,
		toggleFollow,
		toggleFavorite,
	};
}
