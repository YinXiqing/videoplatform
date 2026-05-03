"use client";
import { useEffect } from "react";

export default function VideoDetailError({
	error,
	reset,
}: {
	error: Error;
	reset: () => void;
}) {
	useEffect(() => {
		console.error(error);
	}, [error]);
	return (
		<div className="min-h-[60vh] flex items-center justify-center bg-gray-50 dark:bg-[#0f0f0f]">
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
					视频加载时发生了错误，请稍后重试
				</p>
				<div className="flex items-center justify-center gap-3">
					<button
						onClick={reset}
						className="bg-primary-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
					>
						重试
					</button>
					<a
						href="/"
						className="px-5 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] transition-colors"
					>
						返回首页
					</a>
				</div>
			</div>
		</div>
	);
}
