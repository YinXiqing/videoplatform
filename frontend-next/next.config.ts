import type { NextConfig } from "next";

const API_URL = process.env.BACKEND_URL || "http://localhost:5000";

const nextConfig: NextConfig = {
	reactStrictMode: false,
	devIndicators: false,
	allowedDevOrigins: ["192.168.1.16"],
	experimental: {
		proxyClientMaxBodySize: 600 * 1024 * 1024, // 600MB，覆盖默认 10MB 限制
	},
	async rewrites() {
		return [
			{
				source: "/api/:path*",
				destination: `${API_URL}/api/:path*`,
			},
			{
				source: "/uploads/:path*",
				destination: `${API_URL}/uploads/:path*`,
			},
		];
	},
	images: {
		remotePatterns: [
			{ protocol: "https", hostname: "**" },
			{ protocol: "http", hostname: "**" },
		],
	},
};

export default nextConfig;
