import { create } from "zustand";
import { client } from "@/lib/client";
import type { LoginResponse, ProfileResponse, RegisterResponse, UserOut } from "@/lib/api-types.manual";

interface AuthState {
  user: UserOut | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateProfile: (data: { email?: string; password?: string }) => Promise<{ success: boolean; error?: string }>;
  fetchProfile: () => Promise<void>;
  isAdmin: () => boolean;
  isAuthenticated: () => boolean;
}

export const useAuth = create<AuthState>()((set, get) => ({
  user: null,
  loading: true,

  login: async (username, password) => {
    const { data, error } = await client.POST("/api/auth/login", {
      body: { username, password },
    });
    if (error || !data) {
      return { success: false, error: "Login failed" };
    }
    const typed = data as unknown as LoginResponse;
    localStorage.setItem("token", typed.access_token);
    localStorage.setItem("refresh_token", typed.refresh_token);
    localStorage.setItem("user", JSON.stringify(typed.user));
    set({ user: typed.user });
    return { success: true };
  },

  register: async (username, email, password) => {
    const { error } = await client.POST("/api/auth/register", {
      body: { username, email, password },
    });
    if (error) {
      return { success: false, error: "Registration failed" };
    }
    return { success: true };
  },

  logout: () => {
    client.POST("/api/auth/logout").catch(() => {});
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    set({ user: null });
  },

  fetchProfile: async () => {
    const { data, error } = await client.GET("/api/auth/profile");
    if (error || !data) {
      get().logout();
      set({ loading: false });
      return;
    }
    const typed = data as unknown as ProfileResponse;
    localStorage.setItem("user", JSON.stringify(typed.user));
    set({ user: typed.user, loading: false });
  },

  updateProfile: async (body) => {
    const { data, error } = await client.PUT("/api/auth/profile", { body });
    if (error || !data) {
      return { success: false, error: "Update failed" };
    }
    const typed = data as unknown as ProfileResponse;
    localStorage.setItem("user", JSON.stringify(typed.user));
    set({ user: typed.user });
    return { success: true };
  },

  isAdmin: () => get().user?.role === "admin",
  isAuthenticated: () => !!get().user,
}));
