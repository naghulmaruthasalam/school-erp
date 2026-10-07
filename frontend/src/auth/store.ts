import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TokenResponse, User } from "../types/auth";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isDemo: boolean;
  setTokens: (tokens: TokenResponse, isDemo?: boolean) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      isDemo: false,
      setTokens: (tokens, isDemo = false) =>
        set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          isAuthenticated: true,
          isDemo,
        }),
      setUser: (user) => set({ user }),
      logout: () =>
        set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false, isDemo: false }),
    }),
    { name: "capital-school-auth" },
  ),
);

/** Non-hook accessors for use outside React components (e.g. the axios interceptor). */
export const authStore = {
  getState: useAuthStore.getState,
  setState: useAuthStore.setState,
};

/** Role -> the base path of that role's dashboard. */
export const ROLE_HOME: Record<User["role"], string> = {
  SUPER_ADMIN: "/super-admin",
  SCHOOL_ADMIN: "/admin",
  PRINCIPAL: "/principal",
  TEACHER: "/teacher",
  PARENT: "/parent",
  STUDENT: "/student",
};
