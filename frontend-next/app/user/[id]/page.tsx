"use client";
import { Pencil, Camera, Users, Heart, Video as VideoIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import VideoCard from "@/components/VideoCard";
import Toast from "@/components/Toast";
import api from "@/lib/api";
import type { Video, User } from "@/types";

interface ProfileData {
	user: { id: number; username: string; avatar: string | null; bio: string | null; created_at: string };
	video_count: number;
	follower_count: number;
	following_count: number;
	is_following: boolean;
}

const fmt = (s: number) =>
	s >= 1e6 ? `${(s / 1e6).toFixed(1)}M` : s >= 1e3 ? `${(s / 1e3).toFixed(1)}K` : String(s);
const dur = (s: number | null) =>
	s ? `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : "00:00";

const tabs = ["video", "following", "favorite"] as const;
type Tab = (typeof tabs)[number];
const tabLabels: Record<Tab, string> = { video: "作品", following: "关注", favorite: "收藏" };
const tabIcons: Record<Tab, any> = { video: VideoIcon, following: Users, favorite: Heart };

export default function UserPage() {
	const { id } = useParams<{ id: string }>();
	const { user: currentUser } = useAuth();
	const [profile, setProfile] = useState<ProfileData | null>(null);
	const [videos, setVideos] = useState<Video[]>([]);
	const [following, setFollowing] = useState<{ id: number; username: string; avatar: string | null }[]>([]);
	const [favorites, setFavorites] = useState<{ created_at: string; video: Video }[]>([]);
	const [loading, setLoading] = useState(true);
	const [tab, setTab] = useState<Tab>("video");
	const [editingBio, setEditingBio] = useState(false);
	const [bioText, setBioText] = useState("");
	const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
	const fileRef = useRef<HTMLInputElement>(null);

	const showToast = (msg: string, type: "success" | "error" = "success") => setToast({ msg, type });
	const userId = parseInt(id);

	const fetchProfile = useCallback(async () => {
		try {
			const res = await api.get(`/user/${userId}`);
			setProfile(res.data);
		} catch {}
	}, [userId]);

	const fetchVideos = useCallback(async () => {
		try {
			const res = await api.get(`/user/${userId}/videos`);
			setVideos(res.data.videos);
		} catch {}
	}, [userId]);

	const fetchFollowing = useCallback(async () => {
		try {
			const res = await api.get(`/user/${userId}/following`);
			setFollowing(res.data.users);
		} catch {}
	}, [userId]);

	const fetchFavorites = useCallback(async () => {
		try {
			const res = await api.get(`/user/${userId}/favorites`);
			setFavorites(res.data.favorites);
		} catch {}
	}, [userId]);

	useEffect(() => {
		setLoading(true);
		Promise.all([fetchProfile(), fetchVideos(), fetchFollowing(), fetchFavorites()])
			.finally(() => setLoading(false));
	}, [fetchProfile, fetchVideos, fetchFollowing, fetchFavorites]);

	useEffect(() => {
		if (!loading) {
			if (tab === "video") fetchVideos();
			else if (tab === "following") fetchFollowing();
			else fetchFavorites();
		}
	}, [tab, fetchVideos, fetchFollowing, fetchFavorites, loading]);

	const toggleFollow = async () => {
		if (!currentUser) return;
		try {
			const res = await api.post(`/follow/${userId}`);
			setProfile((p) => p ? {
				...p,
				is_following: res.data.following,
				follower_count: p.follower_count + (res.data.following ? 1 : -1),
			} : p);
		} catch (e: any) {
			showToast(e?.response?.data?.detail || "操作失败", "error");
		}
	};

	const saveBio = async () => {
		try {
			await api.put("/user/profile", { bio: bioText });
			setProfile((p) => p ? { ...p, user: { ...p.user, bio: bioText } } : p);
			setEditingBio(false);
			showToast("简介已更新");
		} catch {
			showToast("保存失败", "error");
		}
	};

	const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const form = new FormData();
		form.append("avatar", file);
		try {
			const res = await api.post("/user/profile/avatar", form);
			setProfile((p) => p ? { ...p, user: { ...p.user, avatar: res.data.avatar } } : p);
			showToast("头像已更新");
		} catch (e: any) {
			showToast(e?.response?.data?.detail || "上传失败", "error");
		}
	};

	if (loading) {
		return (
			<div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f] py-8">
				<div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 animate-pulse">
					<div className="bg-white dark:bg-[#1f1f1f] rounded-2xl p-8 mb-6 flex items-center gap-6">
						<div className="w-24 h-24 bg-gray-200 dark:bg-[#333] rounded-full" />
						<div className="space-y-3 flex-1">
							<div className="h-6 bg-gray-200 dark:bg-[#333] rounded w-32" />
							<div className="h-4 bg-gray-200 dark:bg-[#333] rounded w-48" />
							<div className="h-4 bg-gray-200 dark:bg-[#333] rounded w-64" />
						</div>
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
						{[...Array(6)].map((_, i) => (
							<div key={i} className="aspect-video bg-gray-200 dark:bg-[#333] rounded-xl" />
						))}
					</div>
				</div>
			</div>
		);
	}

	if (!profile) return <div className="text-center py-16 text-gray-400">用户不存在</div>;

	const isSelf = currentUser?.id === userId;
	const avatarUrl = profile.user.avatar ? `/uploads/${profile.user.avatar}` : null;

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f] py-8">
			<div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
				{/* 用户信息头 */}
				<div className="bg-white dark:bg-[#1f1f1f] rounded-2xl p-8 mb-6">
					<div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
						<div className="relative group">
							<div className="w-24 h-24 rounded-full overflow-hidden bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
								{avatarUrl ? (
									<Image src={avatarUrl} alt={profile.user.username} fill className="object-cover" sizes="96px" />
								) : (
									<span className="text-3xl font-bold text-primary-600 dark:text-primary-400">
										{profile.user.username?.charAt(0).toUpperCase() || "U"}
									</span>
								)}
							</div>
							{isSelf && (
								<button
									onClick={() => fileRef.current?.click()}
									className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
								>
									<Camera className="w-6 h-6 text-white" />
								</button>
							)}
							<input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
						</div>

						<div className="flex-1 text-center sm:text-left">
							<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
								{profile.user.username}
							</h1>

							{isSelf && editingBio ? (
								<div className="mt-2 flex gap-2">
									<input
										value={bioText}
										onChange={(e) => setBioText(e.target.value)}
										className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm dark:bg-[#2a2a2a] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
										placeholder="写一段简介..."
										autoFocus
									/>
									<button onClick={saveBio} className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700">
										保存
									</button>
									<button onClick={() => setEditingBio(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">
										取消
									</button>
								</div>
							) : (
								<p className="mt-1 text-gray-500 dark:text-gray-400 text-sm">
									{profile.user.bio || (isSelf ? "还没有填写简介" : "这个人很懒，什么都没写")}
									{isSelf && (
										<button onClick={() => { setBioText(profile.user.bio || ""); setEditingBio(true); }} className="ml-2 text-primary-600 hover:text-primary-700 inline-flex items-center gap-0.5">
											<Pencil className="w-3 h-3" /> 编辑
										</button>
									)}
								</p>
							)}

							<div className="flex items-center justify-center sm:justify-start gap-6 mt-4 text-sm text-gray-500 dark:text-gray-400">
								<span><strong className="text-gray-900 dark:text-gray-100">{fmt(profile.video_count)}</strong> 视频</span>
								<span><strong className="text-gray-900 dark:text-gray-100">{fmt(profile.follower_count)}</strong> 粉丝</span>
								<span><strong className="text-gray-900 dark:text-gray-100">{fmt(profile.following_count)}</strong> 关注</span>
							</div>
						</div>

						{currentUser && !isSelf && (
							<button
								onClick={toggleFollow}
								className={`shrink-0 px-6 py-2 text-sm rounded-lg font-medium transition-colors ${
									profile.is_following
										? "bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#333]"
										: "bg-primary-600 text-white hover:bg-primary-700"
								}`}
							>
								{profile.is_following ? "已关注" : "关注"}
							</button>
						)}
					</div>
				</div>

				{/* Tabs */}
				<div className="flex gap-1 mb-6 bg-white dark:bg-[#1f1f1f] rounded-xl p-1">
					{tabs.map((t) => {
						const Icon = tabIcons[t];
						return (
							<button
								key={t}
								onClick={() => setTab(t)}
								className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
									tab === t
										? "bg-primary-600 text-white"
										: "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
								}`}
							>
								<Icon className="w-4 h-4" />
								{tabLabels[t]}
							</button>
						);
					})}
				</div>

				{/* Tab 内容 */}
				{tab === "video" && (
					videos.length === 0 ? (
						<p className="text-center py-16 text-gray-400 dark:text-gray-500">暂无作品</p>
					) : (
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
							{videos.map((v, i) => (
								<VideoCard key={v.id} video={v} formatViews={fmt} formatDuration={dur} priority={i < 4} />
							))}
						</div>
					)
				)}

				{tab === "following" && (
					following.length === 0 ? (
						<p className="text-center py-16 text-gray-400 dark:text-gray-500">还没有关注任何作者</p>
					) : (
						<div className="space-y-2">
							{following.map((u) => (
								<Link
									key={u.id}
									href={`/user/${u.id}`}
									className="bg-white dark:bg-[#1f1f1f] rounded-xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow"
								>
									<div className="w-10 h-10 rounded-full overflow-hidden bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
										{u.avatar ? (
											<Image src={`/uploads/${u.avatar}`} alt={u.username} fill className="object-cover" sizes="40px" />
										) : (
											<span className="text-sm font-semibold text-primary-700 dark:text-primary-400">
												{u.username?.charAt(0).toUpperCase() || "U"}
											</span>
										)}
									</div>
									<span className="font-medium text-gray-900 dark:text-gray-100">{u.username}</span>
								</Link>
							))}
						</div>
					)
				)}

				{tab === "favorite" && (
					favorites.length === 0 ? (
						<p className="text-center py-16 text-gray-400 dark:text-gray-500">还没有收藏视频</p>
					) : (
						<div className="space-y-3">
							{favorites.map(({ video }) => (
								<Link
									key={video.id}
									href={`/video/${video.id}`}
									className="bg-white dark:bg-[#1f1f1f] rounded-xl p-4 flex gap-4 hover:shadow-md transition-shadow"
								>
									<div className="relative w-40 h-24 bg-gray-900 rounded-lg overflow-hidden flex-shrink-0">
										{video.cover_image ? (
											<Image src={`/api/video/cover/${video.id}`} alt={video.title} fill className="object-cover" sizes="160px" />
										) : (
											<div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600" />
										)}
										{video.duration && (
											<div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
												{dur(video.duration)}
											</div>
										)}
									</div>
									<div className="flex-1 min-w-0">
										<h3 className="font-medium text-gray-900 dark:text-gray-100 line-clamp-2 mb-1">{video.title}</h3>
										<p className="text-sm text-gray-500 dark:text-gray-400">{video.author}</p>
									</div>
								</Link>
							))}
						</div>
					)
				)}
			</div>

			{toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
		</div>
	);
}
