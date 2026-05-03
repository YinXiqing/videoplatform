export default function VideoDetailLoading() {
	return (
		<div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f] py-4 sm:py-8">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4 sm:gap-6 lg:gap-8">
					<div>
						{/* 播放器骨架 */}
						<div className="bg-gray-200 dark:bg-[#2a2a2a] rounded-xl overflow-hidden aspect-video animate-pulse" />
						{/* 信息区骨架 */}
						<div className="bg-white dark:bg-[#1f1f1f] rounded-xl shadow-sm mt-4 p-6 animate-pulse">
							<div className="h-7 bg-gray-200 dark:bg-[#333] rounded w-3/4 mb-4" />
							<div className="flex items-center gap-3 mb-6">
								<div className="h-4 bg-gray-200 dark:bg-[#333] rounded w-24" />
								<div className="h-4 bg-gray-200 dark:bg-[#333] rounded w-20" />
							</div>
							<div className="flex items-center gap-3 pb-4 mb-4 border-b border-gray-100 dark:border-gray-800">
								<div className="w-10 h-10 bg-gray-200 dark:bg-[#333] rounded-full" />
								<div className="h-4 bg-gray-200 dark:bg-[#333] rounded w-16" />
							</div>
							<div className="space-y-2">
								<div className="h-3 bg-gray-200 dark:bg-[#333] rounded w-full" />
								<div className="h-3 bg-gray-200 dark:bg-[#333] rounded w-5/6" />
								<div className="h-3 bg-gray-200 dark:bg-[#333] rounded w-2/3" />
							</div>
						</div>
					</div>
					{/* 侧栏骨架 */}
					<div className="bg-white dark:bg-[#1f1f1f] rounded-xl shadow-sm p-4 animate-pulse">
						<div className="h-5 bg-gray-200 dark:bg-[#333] rounded w-24 mb-4" />
						{[...Array(4)].map((_, i) => (
							<div key={i} className="flex gap-3 mb-3">
								<div className="w-32 h-20 bg-gray-200 dark:bg-[#2a2a2a] rounded flex-shrink-0" />
								<div className="flex-1 space-y-2">
									<div className="h-3 bg-gray-200 dark:bg-[#333] rounded w-full" />
									<div className="h-3 bg-gray-200 dark:bg-[#333] rounded w-3/4" />
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
