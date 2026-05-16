import Image from "next/image";
import Link from "next/link";
import type { Video } from "@/types";
import { dur, fmt } from "@/lib/utils";

interface Props {
	videos: Video[];
}

export default function RelatedVideos({ videos }: Props) {
	return (
		<div className="bg-white dark:bg-[#1f1f1f] rounded-xl shadow-sm p-4">
			<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
				相关推荐
			</h3>
			{videos.length > 0 ? (
				<div className="relative">
					<div className="flex lg:flex-col gap-3 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 scrollbar-none">
						{videos.map((rv) => (
							<Link
								key={rv.id}
								href={`/video/${rv.id}`}
								className="flex gap-3 group flex-shrink-0 w-64 lg:w-auto"
							>
								<div className="w-32 h-20 rounded overflow-hidden flex-shrink-0 relative bg-gray-900">
									{rv.cover_image ? (
										<Image
											src={`/api/video/cover/${rv.id}`}
											alt={rv.title}
											fill
											className="object-cover"
											sizes="128px"
										/>
									) : (
										<div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600" />
									)}
									<div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 py-0.5 rounded">
										{dur(rv.duration)}
									</div>
								</div>
								<div className="flex-1 min-w-0">
									<h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-primary-600">
										{rv.title}
									</h4>
									<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
										{rv.author}
									</p>
									<p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
										{fmt(rv.view_count)} 次观看
									</p>
								</div>
							</Link>
						))}
					</div>
					<div className="lg:hidden absolute right-0 top-0 bottom-2 w-10 bg-gradient-to-l from-white dark:from-[#1f1f1f] to-transparent pointer-events-none" />
				</div>
			) : (
				<p className="text-gray-500 dark:text-gray-400 text-sm">
					暂无相关推荐视频
				</p>
			)}
		</div>
	);
}
