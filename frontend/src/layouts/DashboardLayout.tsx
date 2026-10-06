import { useState, type ReactNode, type ComponentType, type SVGProps } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Search, ChevronDown, LogOut, Menu, X, Sparkles, Zap } from "lucide-react";
import AiChatWidget from "../ai/AiChatWidget";
import NotificationBell from "../components/NotificationBell";
import type { Role } from "../types/auth";
import { useAuthStore } from "../auth/store";
import { ThemeToggle, useTheme } from "../theme/ThemeContext";
import { useLanguage } from "../i18n/LanguageContext";

export interface NavItem {
  label: string;
  to: string;
  end?: boolean;
  icon?: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Platform Admin",
  SCHOOL_ADMIN: "Admin",
  PRINCIPAL: "Principal",
  TEACHER: "Teacher",
  PARENT: "Parent",
  STUDENT: "Student",
};

const ROLE_TAGLINE: Record<Role, string> = {
  SUPER_ADMIN: "Platform Management",
  SCHOOL_ADMIN: "School Administration",
  PRINCIPAL: "School Leadership",
  TEACHER: "Empowering Minds",
  PARENT: "Nurturing Growth",
  STUDENT: "Learning Journey",
};

const ROLE_ACCENT: Record<Role, { bg: string; gradient: string; shadow: string; text: string; glow: string }> = {
  SUPER_ADMIN: { bg: "bg-violet-500", gradient: "from-violet-500 to-purple-600", shadow: "shadow-violet-500/40", text: "text-violet-400", glow: "drop-shadow-[0_0_8px_rgba(139,92,246,0.6)]" },
  SCHOOL_ADMIN: { bg: "bg-violet-500", gradient: "from-violet-500 to-purple-600", shadow: "shadow-violet-500/40", text: "text-violet-400", glow: "drop-shadow-[0_0_8px_rgba(139,92,246,0.6)]" },
  PRINCIPAL: { bg: "bg-indigo-500", gradient: "from-indigo-500 to-blue-600", shadow: "shadow-indigo-500/40", text: "text-indigo-400", glow: "drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]" },
  TEACHER: { bg: "bg-teal-500", gradient: "from-teal-500 to-cyan-600", shadow: "shadow-teal-500/40", text: "text-teal-400", glow: "drop-shadow-[0_0_8px_rgba(20,184,166,0.6)]" },
  PARENT: { bg: "bg-emerald-500", gradient: "from-emerald-500 to-green-600", shadow: "shadow-emerald-500/40", text: "text-emerald-400", glow: "drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]" },
  STUDENT: { bg: "bg-purple-500", gradient: "from-purple-500 to-pink-600", shadow: "shadow-purple-500/40", text: "text-purple-400", glow: "drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]" },
};

export default function DashboardLayout({ navItems, navGroups }: { navItems?: NavItem[]; navGroups?: NavGroup[] }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isDemo = useAuthStore((s) => s.isDemo);
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { language, setLanguage, dir, t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const isDark = theme === "dark";
  const userRole = user?.role || "STUDENT";
  const accent = ROLE_ACCENT[userRole];
  const isRTL = dir === "rtl";

  const allItems = navGroups ? navGroups.flatMap(g => g.items) : navItems || [];
  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className={`flex min-h-screen ${isDark ? "bg-[#0B0F1A]" : "bg-gradient-to-br from-[#F8F7FF] via-[#F0EDFF] to-[#E8E4FF]"}`} dir={dir}>
      {mobileMenuOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={closeMobileMenu} />}

      {/* Enhanced Sidebar */}
      <aside className={`
        fixed top-0 h-full w-[260px] flex flex-col z-50 transition-all duration-300
        ${isDark ? "bg-gradient-to-b from-[#0F1629] via-[#131B2E] to-[#0F1629]" : "bg-gradient-to-b from-[#1E1145] via-[#2D1B69] to-[#1E1145]"}
        ${isRTL ? "right-0" : "left-0"}
        ${mobileMenuOpen ? "translate-x-0" : isRTL ? "translate-x-full lg:translate-x-0" : "-translate-x-full lg:translate-x-0"}
        lg:w-[240px] md:w-[80px] md:translate-x-0
      `}>
        {/* Decorative glow orbs */}
        <div className="absolute top-20 -left-20 w-40 h-40 bg-violet-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-40 -right-20 w-40 h-40 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />

        <button className="absolute top-4 right-4 p-2 text-white/60 hover:text-white lg:hidden" onClick={closeMobileMenu}>
          <X size={20} />
        </button>

        {/* Logo Section */}
        <div className="px-5 py-6 md:px-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-pink-500 rounded-xl blur-lg opacity-50 animate-pulse" />
              <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                <img src="/logo.png" alt="Cognitec" className="w-8 h-8 object-contain" />
              </div>
            </div>
            <div className="md:hidden lg:block">
              <p className="text-lg font-bold bg-gradient-to-r from-violet-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent">
                Cognitec AI School ERP
              </p>
              <p className="text-[11px] text-violet-300/60">{ROLE_TAGLINE[userRole]}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto scrollbar-thin scrollbar-thumb-violet-500/20 scrollbar-track-transparent">
          <div className="space-y-1.5">
            {allItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={closeMobileMenu}
                  className={({ isActive: navActive }) =>
                    `group relative flex items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-medium transition-all duration-300 overflow-hidden ${
                      navActive
                        ? `bg-gradient-to-r ${accent.gradient} text-white shadow-lg ${accent.shadow}`
                        : "text-violet-200/70 hover:text-white hover:bg-white/5"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent" />
                      )}
                      {Icon && (
                        <div className={`relative ${isActive ? accent.glow : "group-hover:drop-shadow-[0_0_6px_rgba(139,92,246,0.4)]"} transition-all duration-300`}>
                          <Icon size={20} className="shrink-0" />
                        </div>
                      )}
                      <span className="md:hidden lg:inline relative">{t(item.label)}</span>
                      {isActive && (
                        <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-white shadow-lg shadow-white/50 animate-pulse" />
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* AI Powered Footer */}
        <div className="mx-3 mb-3 p-4 rounded-2xl bg-gradient-to-br from-violet-500/10 to-pink-500/10 border border-violet-500/20 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-xs">
            <div className="relative">
              <Sparkles size={16} className="text-violet-400 animate-pulse" />
              <div className="absolute inset-0 blur-sm bg-violet-400/50 rounded-full" />
            </div>
            <span className="md:hidden lg:inline text-violet-300 font-medium">{t("footer.poweredByAI")}</span>
          </div>
          <p className="text-[10px] text-violet-400/60 mt-1.5 italic md:hidden lg:block">{t("footer.tagline")}</p>
        </div>

        {/* Bottom Controls */}
        <div className="p-3 border-t border-violet-500/20">
          <div className="flex items-center justify-between md:justify-center lg:justify-between">
            <ThemeToggle />
            <button
              className="p-2.5 rounded-xl transition-all duration-300 text-violet-300/70 hover:text-red-400 hover:bg-red-500/10 hover:shadow-lg hover:shadow-red-500/20"
              onClick={() => { logout(); navigate("/login", { replace: true }); }}
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className={`flex-1 flex flex-col min-h-screen ${isRTL ? "lg:mr-[240px] md:mr-[80px]" : "lg:ml-[240px] md:ml-[80px]"}`}>
        {/* Enhanced Top Header */}
        <header className={`sticky top-0 z-30 h-16 flex items-center justify-between px-4 md:px-6 backdrop-blur-xl ${
          isDark
            ? "bg-[#0B0F1A]/80 border-b border-violet-500/10"
            : "bg-white/70 border-b border-violet-200/50 shadow-sm"
        }`}>
          <button className="p-2 rounded-xl lg:hidden text-violet-400 hover:text-white hover:bg-violet-500/20" onClick={() => setMobileMenuOpen(true)}>
            <Menu size={24} />
          </button>

          {/* Enhanced Search */}
          <div className={`hidden sm:flex items-center gap-3 px-4 py-2.5 rounded-xl w-[340px] transition-all duration-300 ${
            isDark
              ? "bg-violet-500/5 border border-violet-500/20 focus-within:border-violet-500/40 focus-within:bg-violet-500/10"
              : "bg-white border border-violet-200 focus-within:border-violet-400 focus-within:shadow-lg focus-within:shadow-violet-500/10"
          }`}>
            <Search size={18} className={isDark ? "text-violet-400" : "text-violet-500"} />
            <input
              type="text"
              placeholder={t("header.searchPlaceholder")}
              className={`bg-transparent text-sm w-full outline-none ${isDark ? "text-white placeholder:text-violet-400/50" : "text-violet-900 placeholder:text-violet-400"}`}
            />
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3 md:gap-4">
            {/* Language Switcher */}
            <div className={`flex items-center gap-1 rounded-xl p-1 ${isDark ? "bg-violet-500/10 border border-violet-500/20" : "bg-violet-50 border border-violet-200"}`}>
              <button
                onClick={() => setLanguage("en")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 ${
                  language === "en"
                    ? `bg-gradient-to-r ${accent.gradient} text-white shadow-md ${accent.shadow}`
                    : isDark ? "text-violet-300/70 hover:text-white" : "text-violet-600 hover:text-violet-900"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage("ar")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 ${
                  language === "ar"
                    ? `bg-gradient-to-r ${accent.gradient} text-white shadow-md ${accent.shadow}`
                    : isDark ? "text-violet-300/70 hover:text-white" : "text-violet-600 hover:text-violet-900"
                }`}
              >
                عربي
              </button>
            </div>

            <NotificationBell />

            {/* User profile dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className={`flex items-center gap-3 pl-3 md:pl-4 border-l ${isDark ? "border-violet-500/20" : "border-violet-200"}`}
              >
                <div className={`relative w-10 h-10 rounded-xl bg-gradient-to-br ${accent.gradient} flex items-center justify-center text-white text-sm font-bold shadow-lg ${accent.shadow}`}>
                  {user?.full_name?.charAt(0) || "U"}
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-[#0B0F1A]" />
                </div>
                <div className="hidden md:block text-left">
                  <p className={`text-sm font-semibold ${isDark ? "text-white" : "text-violet-900"}`}>{user?.full_name}</p>
                  <p className={`text-xs ${isDark ? "text-violet-400/70" : "text-violet-500"}`}>{user ? ROLE_LABEL[user.role] : ""}</p>
                </div>
                <ChevronDown size={16} className={`hidden md:block ${isDark ? "text-violet-400" : "text-violet-500"}`} />
              </button>

              {userDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserDropdownOpen(false)} />
                  <div className={`absolute right-0 top-full mt-3 w-64 rounded-2xl shadow-2xl z-50 overflow-hidden animate-page-enter ${
                    isDark
                      ? "bg-gradient-to-br from-[#1A1F35] to-[#0F1629] border border-violet-500/30 shadow-violet-500/20"
                      : "bg-gradient-to-br from-white to-violet-50 border border-violet-200 shadow-violet-500/10"
                  }`}>
                    {/* User Info Header */}
                    <div className={`p-4 ${isDark ? "bg-gradient-to-r from-violet-500/10 to-purple-500/10" : "bg-gradient-to-r from-violet-100 to-purple-100"}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${accent.gradient} flex items-center justify-center text-white font-bold shadow-lg ${accent.shadow}`}>
                          {user?.full_name?.charAt(0) || "U"}
                        </div>
                        <div>
                          <p className={`font-bold ${isDark ? "text-white" : "text-violet-900"}`}>{user?.full_name}</p>
                          <p className={`text-xs ${isDark ? "text-violet-400" : "text-violet-600"}`}>{user ? ROLE_LABEL[user.role] : ""}</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-2">
                      <button
                        onClick={() => { setUserDropdownOpen(false); navigate(`/${userRole.toLowerCase().replace('_', '-')}/profile`); }}
                        className={`w-full px-4 py-3 rounded-xl text-left text-sm flex items-center gap-3 transition-all ${
                          isDark ? "text-violet-200 hover:bg-violet-500/20 hover:text-white" : "text-violet-700 hover:bg-violet-100"
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${accent.gradient} flex items-center justify-center shadow-md`}>
                          <span className="text-white text-xs font-bold">{user?.full_name?.charAt(0)}</span>
                        </div>
                        <div>
                          <span className="font-medium">{t("header.myProfile")}</span>
                          <p className={`text-xs ${isDark ? "text-violet-400/70" : "text-violet-500"}`}>View & edit profile</p>
                        </div>
                      </button>
                      <button
                        onClick={() => { setUserDropdownOpen(false); navigate(`/${userRole.toLowerCase().replace('_', '-')}/settings`); }}
                        className={`w-full px-4 py-3 rounded-xl text-left text-sm flex items-center gap-3 transition-all ${
                          isDark ? "text-violet-200 hover:bg-violet-500/20 hover:text-white" : "text-violet-700 hover:bg-violet-100"
                        }`}
                      >
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md">
                          <Zap size={16} className="text-white" />
                        </div>
                        <div>
                          <span className="font-medium">{t("header.settings")}</span>
                          <p className={`text-xs ${isDark ? "text-violet-400/70" : "text-violet-500"}`}>Preferences & config</p>
                        </div>
                      </button>
                    </div>

                    <div className={`p-2 border-t ${isDark ? "border-violet-500/20" : "border-violet-200"}`}>
                      <button
                        onClick={() => { setUserDropdownOpen(false); logout(); navigate("/login", { replace: true }); }}
                        className="w-full px-4 py-3 rounded-xl text-left text-sm flex items-center gap-3 text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-md">
                          <LogOut size={16} className="text-white" />
                        </div>
                        <div>
                          <span className="font-medium">{t("header.signOut")}</span>
                          <p className="text-xs text-red-400/70">Logout from account</p>
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {isDemo && (
          <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500 text-white px-4 py-2.5 text-center text-sm font-medium shadow-lg">
            <Sparkles className="inline w-4 h-4 mr-2 animate-pulse" />
            {t("demo.demoMode")} — {t("demo.exploreWithSampleData")}
            <button
              onClick={() => { logout(); navigate("/login", { replace: true }); }}
              className="ml-4 px-4 py-1 bg-white/20 hover:bg-white/30 rounded-full text-xs font-bold transition-all hover:scale-105"
            >
              {t("demo.exitDemo")}
            </button>
          </div>
        )}

        <main className={`flex-1 p-4 md:p-6 ${isDark ? "bg-[#0B0F1A]" : "bg-gradient-to-br from-[#F8F7FF] via-[#F0EDFF] to-[#E8E4FF]"}`}>
          <Outlet />
        </main>
      </div>

      <AiChatWidget />
    </div>
  );
}

export function ComingSoon({ title }: { title: string }): ReactNode {
  return (
    <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-violet-300/50 text-sm text-violet-400 bg-violet-500/5">
      <Sparkles className="w-5 h-5 mr-2 text-violet-400" />
      {title} — coming soon
    </div>
  );
}
