"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import RelatedVideos from "@/components/RelatedVideos";
import Toast from "@/components/Toast";
import { useAuth } from "@/contexts/AuthContext";
import { useVideoPlayback } from "@/hooks/useVideoPlayback";
import { useVideoControls } from "@/hooks/useVideoControls";
import { useVideoSocial } from "@/hooks/useVideoSocial";
import api from "@/lib/api";
import { dur, fmt } from "@/lib/utils";
import type { Video } from "@/types";

type ConfirmState = {
	isOpen: boolean;
	type?: string;
	title?: string;
	message?: string;
	onConfirm?: () => void;
};

export default function VideoPlayer({ video: initialVideo }: { video: Video }) {
	const { isAdmin, user } = useAuth();
	const router = useRouter();
	const [video, setVideo] = useState<Video>(initialVideo);
	const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);
	const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
	const [confirm, setConfirm] = useState<ConfirmState>({ isOpen: false });

	const { videoRef, playError, retry } = useVideoPlayback(video.id);
	useVideoControls(videoRef);
	const {
		favorited, liked, disliked,
		following, followerCount,
		rateVideo, toggleFollow, toggleFavorite,
	} = useVideoSocial(video.id, video.user_id);

	const showToast = (msg: string, type: "success" | "error" = "success") =>
		setToast({ msg, type });

	const fetchRelated = useCallback(async () => {
		try {
			const tags = (video.tags || []).filter(Boolean);
			const params: Record<string, any> = { per_page: 8 };
			if (tags.length > 0) params.tag = tags[0];
			else params.search = video.title?.slice(0, 10);
			const res = await api.get("/video/list", { params });
			setRelatedVideos(
				res.data.videos.filter((r: Video) => r.id !== video.id).slice(0, 6),
			);
		} catch {
			setRelatedVideos([]);
		}
	}, [video.id, video.tags, video.title]);

	useEffect(() => {
		window.scrollTo(0, 0);
		fetchRelated();
	}, [fetchRelated]);

	const handleApprove = () =>
		setConfirm({
			isOpen: true,
			type: "info",
			title: "审核通过",
			message: "确定要通过这个视频的审核吗？",
			onConfirm: async () => {
				try {
					await api.put(`/admin/videos/${video.id}`, { status: "approved" });
					setVideo({ ...video, status: "approved" });
					showToast("视频已通过审核");
				} catch {
					showToast("操作失败", "error");
				}
				setConfirm({ isOpen: false });
			},
		});

	const handleReject = () =>
		setConfirm({
			isOpen: true,
			type: "danger",
			title: "拒绝视频",
			message: "确定要拒绝这个视频吗？",
			onConfirm: async () => {
				try {
					await api.put(`/admin/videos/${video.id}`, { status: "rejected" });
					setVideo({ ...video, status: "rejected" });
					showToast("视频已拒绝", "error");
				} catch {
					showToast("操作失败", "error");
				}
				setConfirm({ isOpen: false });
			},
		});

	const coverSrc = `/api/video/cover/${video.id}`;

	return (
		<div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4 sm:gap-6 lg:gap-8">
			<div>
				<div className="bg-black rounded-xl overflow-hidden aspect-video relative">
					{playError ? (
						<div className="w-full h-full flex flex-col items-center justify-center text-white gap-3">
							<svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
							</svg>
							<p className="text-gray-300 text-sm">
								{playError === "processing" ? "视频正在处理中" : "视频加载失败"}
							</p>
							<button onClick={retry} className="px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm transition-colors">
								重试
							</button>
						</div>
					) : (
						<video ref={videoRef} controls muted className="w-full h-full object-contain" crossOrigin="anonymous" poster={video.cover_image ? coverSrc : undefined} />
					)}
				</div>

				<div className="bg-white dark:bg-[#1f1f1f] rounded-xl shadow-sm mt-4 p-6">
					<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">{video.title}</h1>

					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center text-sm text-gray-500 dark:text-gray-400 gap-3">
							<span>{fmt(video.view_count)} 次观看</span>
							<span>•</span>
							<span>{video.created_at.slice(0, 10)}</span>
							<span>•</span>
							<span>{dur(video.duration)}</span>
						</div>

						<div className="flex items-center gap-2">
							<button
								onClick={user ? toggleFavorite : () => router.push("/login")}
								className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${favorited ? "bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30" : "bg-gray-100 dark:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#333]"}`}
							>
								<svg className="w-4 h-4" fill={favorited ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
								</svg>
								{favorited ? "已收藏" : "收藏"}
							</button>

							<button
								onClick={user ? () => rateVideo(liked ? "null" : "like") : () => router.push("/login")}
								className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${liked ? "bg-primary-100 dark:bg-primary-900/20 text-primary-600" : "bg-gray-100 dark:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#333]"}`}
							>
								<svg className="w-4 h-4" fill={liked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
								</svg>
								{liked ? "已赞" : "赞"}
							</button>

							<button
								onClick={user ? () => rateVideo(disliked ? "null" : "dislike") : () => router.push("/login")}
								className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${disliked ? "bg-red-50 dark:bg-red-900/20 text-red-500" : "bg-gray-100 dark:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#333]"}`}
							>
								<svg className="w-4 h-4" fill={disliked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
								</svg>
							</button>

							{user ? (
								<a
									href={`/api/video/download/${video.id}`}
									className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-[#2a2a2a] hover:bg-gray-200 dark:hover:bg-[#333] text-gray-700 dark:text-gray-300 text-sm rounded-lg transition-colors"
								>
									<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
									</svg>
									下载
								</a>
							) : (
								<Link href="/login" className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-[#2a2a2a] hover:bg-gray-200 dark:hover:bg-[#333] text-gray-700 dark:text-gray-300 text-sm rounded-lg transition-colors">
									<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
									</svg>
									下载
								</Link>
							)}
						</div>
					</div>

					{isAdmin() && video.status === "pending" && (
						<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
							<p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-3">管理员审核操作</p>
							<div className="flex gap-3">
								<button onClick={handleApprove} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">通过审核</button>
								<button onClick={handleReject} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700">拒绝视频</button>
							</div>
						</div>
					)}

					<div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100 dark:border-gray-800">
						<div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
							<span className="text-lg font-medium text-primary-700">
								{video.author?.charAt(0).toUpperCase() || "U"}
							</span>
						</div>
						<div>
							<p className="font-medium text-gray-900 dark:text-gray-100">{video.author || "未知用户"}</p>
							<p className="text-xs text-gray-400 dark:text-gray-500">{followerCount} 位粉丝</p>
						</div>
						{user?.id !== video.user_id && (
							<button
								onClick={user ? toggleFollow : () => router.push("/login")}
								className={`shrink-0 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${following ? "bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-400" : "bg-primary-600 text-white hover:bg-primary-700"}`}
							>
								{following ? "已订阅" : "订阅"}
							</button>
						)}
					</div>

					{video.description && (
						<p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap text-sm">{video.description}</p>
					)}
					{(video.tags?.length ?? 0) > 0 && (
						<div className="mt-4 flex flex-wrap gap-2">
							{video.tags?.map((tag, i) => (
								<span key={i} className="px-3 py-1 bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-400 text-sm rounded-full">{tag}</span>
							))}
						</div>
					)}
				</div>
			</div>

			<div>
				<RelatedVideos videos={relatedVideos} />
			</div>

			<ConfirmDialog
				isOpen={confirm.isOpen}
				onClose={() => setConfirm({ isOpen: false })}
				onConfirm={confirm.onConfirm}
				title={confirm.title}
				message={confirm.message}
				type={confirm.type}
				confirmText="确认"
				cancelText="取消"
			/>
			{toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
		</div>
	);
}
