import axios from "axios";

const api = axios.create({
	baseURL: "/api",
	headers: { "Content-Type": "application/json" },
	withCredentials: true, // 自动携带 httpOnly cookie
});

api.interceptors.response.use(
	(res) => res,
	(error) => {
		if (
			error.response?.status === 401 &&
			typeof window !== "undefined" &&
			!window.location.pathname.startsWith("/login")
		) {
			window.location.href = "/login";
		}
		return Promise.reject(error);
	},
);

export default api;
