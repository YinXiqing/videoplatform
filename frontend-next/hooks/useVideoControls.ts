"use client";
import { useEffect, type RefObject } from "react";

/**
 * 视频播放器键盘快捷键 + 移动端手势。
 * 快捷键：空格暂停、← → 快退/快进 10s、F 全屏。
 * 手势：水平滑动快进/快退。
 */
export function useVideoControls(videoRef: RefObject<HTMLVideoElement | null>) {
	// 键盘快捷键
	useEffect(() => {
		const el = videoRef.current;
		if (!el) return;
		const handleKey = (e: KeyboardEvent) => {
			const tag = (e.target as HTMLElement).tagName;
			if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
			switch (e.key) {
				case " ":
					e.preventDefault();
					el.paused ? el.play().catch(() => {}) : el.pause();
					break;
				case "ArrowLeft":
					e.preventDefault();
					el.currentTime = Math.max(0, el.currentTime - 10);
					break;
				case "ArrowRight":
					e.preventDefault();
					el.currentTime = Math.min(
						el.duration || 0,
						el.currentTime + 10,
					);
					break;
				case "f":
				case "F":
					e.preventDefault();
					if (document.fullscreenElement) document.exitFullscreen();
					else el.requestFullscreen();
					break;
			}
		};
		document.addEventListener("keydown", handleKey);
		return () => document.removeEventListener("keydown", handleKey);
	}, [videoRef]);

	// 移动端手势
	useEffect(() => {
		const el = videoRef.current;
		if (!el) return;
		let sx = 0;
		let sy = 0;
		const onTouchStart = (e: TouchEvent) => {
			sx = e.touches[0].clientX;
			sy = e.touches[0].clientY;
		};
		const onTouchEnd = (e: TouchEvent) => {
			const mx = e.changedTouches[0].clientX - sx;
			const my = e.changedTouches[0].clientY - sy;
			const absX = Math.abs(mx);
			const absY = Math.abs(my);
			if (absX < 30 && absY < 30) return;
			if (absX > absY) {
				if (mx > 0)
					el.currentTime = Math.min(
						el.duration || 0,
						el.currentTime + 10,
					);
				else el.currentTime = Math.max(0, el.currentTime - 10);
			}
		};
		el.addEventListener("touchstart", onTouchStart, { passive: true });
		el.addEventListener("touchend", onTouchEnd, { passive: true });
		return () => {
			el.removeEventListener("touchstart", onTouchStart);
			el.removeEventListener("touchend", onTouchEnd);
		};
	}, [videoRef]);
}
