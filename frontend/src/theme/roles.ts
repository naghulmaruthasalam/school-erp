import type { Role } from "../types/auth";
import type { LucideIcon } from "lucide-react";
import {
  GraduationCap,
  Users,
  BookOpen,
  Building2,
  ClipboardList,
  Shield,
} from "lucide-react";

export interface RoleTheme {
  role: Role;
  label: string;
  tagline: string;
  loginPath: string;
  /** Tailwind gradient stop classes, used for backgrounds/buttons/glow. */
  from: string;
  to: string;
  /** Solid accent used for links, focus rings, icons. */
  accentText: string;
  accentBg: string;
  accentRing: string;
  /** Raw hex pair for the CSS-custom-property animated border (can't be
   * expressed as Tailwind classes since it feeds a conic-gradient). */
  glowFrom: string;
  glowTo: string;
  Icon: LucideIcon;
}

export const ROLE_THEMES: Record<Role, RoleTheme> = {
  STUDENT: {
    role: "STUDENT",
    label: "Student",
    tagline: "Your classes, homework, and results — all in one place.",
    loginPath: "/login/student",
    from: "from-indigo-500",
    to: "to-violet-600",
    accentText: "text-indigo-600",
    accentBg: "!bg-indigo-600 hover:!bg-indigo-700",
    accentRing: "focus:!ring-indigo-500 focus:!border-indigo-500",
    glowFrom: "#6366f1",
    glowTo: "#8b5cf6",
    Icon: GraduationCap,
  },
  PARENT: {
    role: "PARENT",
    label: "Parent",
    tagline: "Stay close to your child's school life, every day.",
    loginPath: "/login/parent",
    from: "from-emerald-500",
    to: "to-teal-600",
    accentText: "text-emerald-600",
    accentBg: "!bg-emerald-600 hover:!bg-emerald-700",
    accentRing: "focus:!ring-emerald-500 focus:!border-emerald-500",
    glowFrom: "#34d399",
    glowTo: "#0d9488",
    Icon: Users,
  },
  TEACHER: {
    role: "TEACHER",
    label: "Teacher",
    tagline: "Attendance, homework, and marks — without the busywork.",
    loginPath: "/login/teacher",
    from: "from-violet-500",
    to: "to-purple-600",
    accentText: "text-violet-600",
    accentBg: "!bg-violet-600 hover:!bg-violet-700",
    accentRing: "focus:!ring-violet-500 focus:!border-violet-500",
    glowFrom: "#a78bfa",
    glowTo: "#7c3aed",
    Icon: BookOpen,
  },
  PRINCIPAL: {
    role: "PRINCIPAL",
    label: "Principal",
    tagline: "The whole school, at a glance.",
    loginPath: "/login/principal",
    from: "from-amber-500",
    to: "to-orange-600",
    accentText: "text-amber-600",
    accentBg: "!bg-amber-600 hover:!bg-amber-700",
    accentRing: "focus:!ring-amber-500 focus:!border-amber-500",
    glowFrom: "#fbbf24",
    glowTo: "#ea580c",
    Icon: Building2,
  },
  SCHOOL_ADMIN: {
    role: "SCHOOL_ADMIN",
    label: "School Admin",
    tagline: "Run the school's day-to-day operations.",
    loginPath: "/login/admin",
    from: "from-violet-500",
    to: "to-purple-700",
    accentText: "text-violet-600",
    accentBg: "!bg-violet-600 hover:!bg-violet-700",
    accentRing: "focus:!ring-violet-500 focus:!border-violet-500",
    glowFrom: "#8b5cf6",
    glowTo: "#7c3aed",
    Icon: ClipboardList,
  },
  SUPER_ADMIN: {
    role: "SUPER_ADMIN",
    label: "Platform Admin",
    tagline: "Manage every school on the platform.",
    loginPath: "/login/super-admin",
    from: "from-purple-800",
    to: "to-violet-950",
    accentText: "text-purple-600",
    accentBg: "!bg-purple-800 hover:!bg-purple-900",
    accentRing: "focus:!ring-purple-600 focus:!border-purple-600",
    glowFrom: "#9333ea",
    glowTo: "#4c1d95",
    Icon: Shield,
  },
};

export const ROLE_LOGIN_ORDER: Role[] = [
  "TEACHER",
  "PARENT",
  "STUDENT",
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "PRINCIPAL",
];

/** Maps a login path segment (e.g. "student", "admin") back to a Role. */
export const LOGIN_SLUG_TO_ROLE: Record<string, Role> = {
  student: "STUDENT",
  parent: "PARENT",
  teacher: "TEACHER",
  principal: "PRINCIPAL",
  admin: "SCHOOL_ADMIN",
  "super-admin": "SUPER_ADMIN",
};
