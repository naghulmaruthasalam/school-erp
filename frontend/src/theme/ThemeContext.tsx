import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Role } from "../types/auth";
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
      const stored = localStorage.getItem("theme") as Theme | null;
      if (stored) return stored;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "dark";
  });

  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
  }, [theme]);

  // Apply role-based data attribute for CSS theming
  useEffect(() => {
    if (role) {
      document.documentElement.setAttribute("data-role", role);
    } else {
      document.documentElement.removeAttribute("data-role");
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

  return (
    <button
      onClick={toggleTheme}
      className="relative p-2 rounded-lg transition-all duration-300 hover:bg-slate-700/50"
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      <div className="relative w-5 h-5">
        {/* Sun icon */}
        <svg
          className={`absolute inset-0 w-5 h-5 text-amber-400 transition-all duration-300 ${
            theme === "light" ? "opacity-100 rotate-0 scale-100" : "opacity-0 rotate-90 scale-0"
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
        {/* Moon icon */}
        <svg
          className={`absolute inset-0 w-5 h-5 text-slate-300 transition-all duration-300 ${
            theme === "dark" ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-0"
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      </div>
    </button>
  );
}
