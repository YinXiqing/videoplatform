import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/** 秒数 → MM:SS */
export function dur(s: number | null) {
	if (!s) return "00:00";
	return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** 数字格式化：≥1M → "x.xM", ≥1K → "x.xK" */
export function fmt(v: number) {
	if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
	if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
	return String(v);
}
