"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import VideoPlayer from "@/components/VideoPlayer";
import api from "@/lib/api";
import type { Video } from "@/types";

export default function VideoDetailClient({
	id,
	initialVideo,
}: {
	id: string;
	initialVideo: Video | null;
}) {
	const [video, setVideo] = useState<Video | null>(initialVideo);
	const [notFound, setNotFound] = useState(false);
	const [serverError, setServerError] = useState(false);
	const router = useRouter();

	useEffect(() => {
		const spacer = document.getElementById("mobile-nav-spacer");
		if (spacer) spacer.style.display = "none";
		return () => {
			if (spacer) spacer.style.display = "";
		};
	}, []);

	useEffect(() => {
		if (initialVideo) return;
		api
			.get(`/video/detail/${id}`)
			.then((r) => setVideo(r.data.video))
			.catch((e) => {
				if (e.response?.status === 404) setNotFound(true);
				else setServerError(true);
			});
	}, [id, initialVideo]);

	if (serverError)
		return (
			<div className="min-h-[60vh] flex items-center justify-center">
				<div className="text-center">
					<svg
						className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={1.5}
							d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
						/>
					</svg>
					<h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
						加载失败
					</h2>
					<p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
						服务器出错了，请稍后重试
					</p>
					<a
						href="/"
						className="bg-primary-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary-700"
					>
						返回首页
					</a>
				</div>
			</div>
		);

	if (notFound)
		return (
			<div className="min-h-[60vh] flex items-center justify-center">
				<div className="text-center">
					<p className="text-5xl font-bold text-gray-300 dark:text-gray-600 mb-3">
						404
					</p>
					<h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
						视频未找到
					</h2>
					<p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
						该视频不存在或已被删除
					</p>
					<a
						href="/"
						className="bg-primary-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary-700"
					>
						返回首页
					</a>
				</div>
			</div>
		);

	if (!video)
		return (
			<div className="min-h-[60vh] flex items-center justify-center">
				<div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
			</div>
		);

	return (
		<div>
			{/* 移动端顶部导航栏 */}
			<div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#0f0f0f] border-b border-gray-100 dark:border-gray-800">
				<button
					onClick={() => router.back()}
					className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
				>
					<svg
						className="w-5 h-5"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M15 19l-7-7 7-7"
						/>
					</svg>
				</button>
				<h1 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate flex-1">
					{video.title}
				</h1>
				<a
					href="/"
					className="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
				>
					<svg
						className="w-5 h-5"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
						/>
					</svg>
				</a>
			</div>
			<VideoPlayer video={video} />
		</div>
	);
}
