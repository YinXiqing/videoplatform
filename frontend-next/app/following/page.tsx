"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/AuthGuard";
import api from "@/lib/api";

interface FollowingUser {
	id: number;
	username: string;
}

export default function FollowingPage() {
	const [following, setFollowing] = useState<FollowingUser[]>([]);
	const [loading, setLoading] = useState(true);

	const fetchFollowing = async () => {
		try {
			const res = await api.get("/follow/list");
			setFollowing(res.data.users);
		} catch {
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchFollowing();
	}, []);

	const unfollow = async (userId: number) => {
		await api.post(`/follow/${userId}`);
		setFollowing((prev) => prev.filter((u) => u.id !== userId));
	};

	return (
		<RequireAuth>
			<div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f] py-8">
				<div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
					<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
						我的关注
					</h1>

					{loading ? (
						<div className="space-y-3">
							{[...Array(5)].map((_, i) => (
								<div
									key={`skel-${i}`}
									className="bg-white dark:bg-[#1f1f1f] rounded-xl p-4 animate-pulse flex items-center gap-3"
								>
									<div className="w-10 h-10 bg-gray-200 dark:bg-[#333] rounded-full" />
									<div className="h-4 bg-gray-200 dark:bg-[#333] rounded w-24" />
								</div>
							))}
						</div>
					) : following.length === 0 ? (
						<div className="text-center py-16 text-gray-400 dark:text-gray-500">
							<p>还没有关注任何作者</p>
							<Link
								href="/"
								className="mt-2 text-primary-600 text-sm inline-block hover:underline"
							>
								去发现感兴趣的视频
							</Link>
						</div>
					) : (
						<div className="space-y-2">
							{following.map((u) => (
								<div
									key={u.id}
									className="bg-white dark:bg-[#1f1f1f] rounded-xl p-4 flex items-center justify-between"
								>
									<div className="flex items-center gap-3">
										<div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
											<span className="text-sm font-semibold text-primary-700">
												{u.username?.charAt(0).toUpperCase() || "U"}
											</span>
										</div>
										<span className="font-medium text-gray-900 dark:text-gray-100">
											{u.username || "未知用户"}
										</span>
									</div>
									<button
										type="button"
										onClick={() => unfollow(u.id)}
										className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
									>
										取消关注
									</button>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</RequireAuth>
	);
}
