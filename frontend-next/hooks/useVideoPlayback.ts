"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";

/**
 * 视频播放逻辑：加载流、HLS 初始化、进度记忆。
 * 返回 videoRef / hlsRef 供外部挂载到 <video> 元素。
 */
export function useVideoPlayback(videoId: number) {
	const { user } = useAuth();
	const videoRef = useRef<HTMLVideoElement>(null);
	const hlsRef = useRef<any>(null);
	const [playError, setPlayError] = useState<string | false>(false);
	const [retryKey, setRetryKey] = useState(0);

	const retry = useCallback(() => {
		setPlayError(false);
		setRetryKey((k) => k + 1);
	}, []);

	useEffect(() => {
		const el = videoRef.current;
		if (!el) return;

		const restoreProgress = () => {
			const saved = parseFloat(
				localStorage.getItem(`vp_${videoId}`) ?? "0",
			);
			if (saved > 5) el.currentTime = saved;
		};

		api
			.get(`/video/stream/${videoId}`)
			.then(async ({ data }) => {
				if (hlsRef.current) {
					hlsRef.current.destroy();
					hlsRef.current = null;
				}

				if (data.is_hls) {
					const url = data.video_url;
					const { default: Hls } = await import("hls.js");

					if (Hls.isSupported()) {
						const hls = new Hls({ enableWorker: true });
						hlsRef.current = hls;
						hls.loadSource(url);
						hls.attachMedia(el);
						hls.on(Hls.Events.MANIFEST_PARSED, () => {
							restoreProgress();
							el.play().catch(() => {});
						});
						hls.on(Hls.Events.ERROR, (_: any, d: any) => {
							if (d.fatal) setPlayError("error");
						});
					} else if (el.canPlayType("application/vnd.apple.mpegurl")) {
						el.src = url;
						el.onloadedmetadata = restoreProgress;
					}
				} else {
					el.src = data.video_url;
					el.onloadedmetadata = restoreProgress;
					el.play().catch(() => {});
				}
			})
			.catch((e) => {
				setPlayError(
					e?.response?.status === 503 ? "processing" : "error",
				);
			});

		const saveProgress = () =>
			localStorage.setItem(`vp_${videoId}`, String(el.currentTime));
		let lastSave = 0;
		const throttledSave = () => {
			const now = Date.now();
			if (now - lastSave >= 5000) {
				lastSave = now;
				saveProgress();
			}
		};
		el.addEventListener("timeupdate", throttledSave);
		return () => {
			el.removeEventListener("timeupdate", throttledSave);
			hlsRef.current?.destroy();
			hlsRef.current = null;
		};
	}, [videoId, retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

	// 播放时记录观看历史
	useEffect(() => {
		if (user) api.post(`/video/history/${videoId}`).catch(() => {});
	}, [videoId, user]);

	return { videoRef, hlsRef, playError, retry };
}
