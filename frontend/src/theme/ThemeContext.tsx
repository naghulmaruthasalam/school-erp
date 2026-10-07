import { Moon, Sun } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Role } from "../types/auth";
import { readStored, writeStored } from "../lib/safeStorage";
import { useAuthStore } from "../auth/store";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  role: Role | null;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const role = user?.role || null;

  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const stored = readStored("theme") as Theme | null;
      if (stored === "light" || stored === "dark") return stored;
      // A host page (e.g. an embedded demo) may already have chosen a theme.
      const hosted = document.documentElement.getAttribute("data-theme");
      if (hosted === "light" || hosted === "dark") return hosted;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "dark";
  });

  useEffect(() => {
    writeStored("theme", theme);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
  }, [theme]);

  // Apply role-based data attribute for CSS theming. Only clears what this
  // effect itself applied, so pre-login screens can tint the wallpaper too.
  const appliedRole = useRef(false);
  useEffect(() => {
    if (role) {
      document.documentElement.setAttribute("data-role", role);
      appliedRole.current = true;
    } else if (appliedRole.current) {
      document.documentElement.removeAttribute("data-role");
      appliedRole.current = false;
    }
  }, [role]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, role }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

// Role color configurations
export const ROLE_COLORS = {
  SUPER_ADMIN: {
    primary: "#6366f1",
    light: "#818cf8",
    dark: "#4f46e5",
    gradient: "from-indigo-500 to-indigo-600",
    glow: "rgba(99, 102, 241, 0.4)",
  },
  SCHOOL_ADMIN: {
    primary: "#6366f1",
    light: "#818cf8",
    dark: "#4f46e5",
    gradient: "from-indigo-500 to-indigo-600",
    glow: "rgba(99, 102, 241, 0.4)",
  },
  TEACHER: {
    primary: "#14b8a6",
    light: "#2dd4bf",
    dark: "#0d9488",
    gradient: "from-teal-500 to-teal-600",
    glow: "rgba(20, 184, 166, 0.4)",
  },
  STUDENT: {
    primary: "#a855f7",
    light: "#c084fc",
    dark: "#9333ea",
    gradient: "from-purple-500 to-pink-500",
    glow: "rgba(168, 85, 247, 0.4)",
  },
  PARENT: {
    primary: "#10b981",
    light: "#34d399",
    dark: "#059669",
    gradient: "from-emerald-500 to-emerald-600",
    glow: "rgba(16, 185, 129, 0.4)",
  },
  PRINCIPAL: {
    primary: "#4f46e5",
    light: "#6366f1",
    dark: "#4338ca",
    gradient: "from-indigo-600 to-indigo-700",
    glow: "rgba(79, 70, 229, 0.4)",
  },
} as const;

export function useRoleColors() {
  const { role } = useTheme();
  return role ? ROLE_COLORS[role] : ROLE_COLORS.SCHOOL_ADMIN;
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      className="glass-icon-btn relative overflow-hidden"
      aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
      title={`Switch to ${dark ? "light" : "dark"} mode`}
    >
      <Sun
        size={17}
        className={`absolute text-amber-500 transition-all duration-500 [transition-timing-function:var(--ease-spring)] ${
          dark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
        }`}
      />
      <Moon
        size={17}
        className={`absolute text-indigo-300 transition-all duration-500 [transition-timing-function:var(--ease-spring)] ${
          dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
        }`}
      />
    </button>
  );
}

/** Pre-login screens (role login, forgot password...) tint the wallpaper with
 * the role's accent. Restores whatever the signed-in user's role dictates when
 * the screen unmounts, so a successful login never loses its accent. */
export function useRoleAccent(role: Role | null | undefined) {
  useEffect(() => {
    if (!role) return;
    document.documentElement.setAttribute("data-role", role);
    return () => {
      const current = useAuthStore.getState().user?.role;
      if (current) document.documentElement.setAttribute("data-role", current);
      else document.documentElement.removeAttribute("data-role");
    };
  }, [role]);
}
