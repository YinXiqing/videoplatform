"use client";
import { useCallback, useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";
const THEME_CYCLE: Theme[] = ["system", "light", "dark"];

function applyTheme(theme: Theme) {
	const isDark =
		theme === "dark" ||
		(theme === "system" &&
			window.matchMedia("(prefers-color-scheme: dark)").matches);
	document.documentElement.classList.toggle("dark", isDark);
}

export default function ThemeToggle() {
	const [theme, setTheme] = useState<Theme>("system");
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		const saved = localStorage.getItem("theme") as Theme | null;
		const t = saved || "system";
		setTheme(t);
		applyTheme(t);
		setMounted(true);
	}, []);

	// 监听系统主题变化（仅 system 模式时需要）
	useEffect(() => {
		if (theme !== "system") return;
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		const handler = () => applyTheme("system");
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, [theme]);

	const cycle = useCallback(() => {
		const idx = THEME_CYCLE.indexOf(theme);
		const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
		setTheme(next);
		localStorage.setItem("theme", next);
		applyTheme(next);
	}, [theme]);

	if (!mounted) return <div className="w-9 h-9" />;

	const icon =
		theme === "system"
			? "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM9 15l3-8 3 8M8 12h8"
			: theme === "dark"
				? "M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
				: "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z";

	return (
		<button
			type="button"
			onClick={cycle}
			className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
			title={
				theme === "system" ? "跟随系统" : theme === "dark" ? "深色" : "浅色"
			}
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
					d={icon}
				/>
			</svg>
		</button>
	);
}
