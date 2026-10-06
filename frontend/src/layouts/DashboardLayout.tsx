import { useState, type ReactNode, type ComponentType, type SVGProps } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Search, ChevronDown, LogOut, Menu, X, Sparkles, Settings, User, Ellipsis } from "lucide-react";
import AiChatWidget from "../ai/AiChatWidget";
import NotificationBell from "../components/NotificationBell";
import type { Role } from "../types/auth";
import { useAuthStore } from "../auth/store";
import { ThemeToggle } from "../theme/ThemeContext";
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

function Avatar({ name, size = 40 }: { name?: string; size?: number }) {
  return (
    <div
      className="relative grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-2 font-semibold text-white shadow-[0_6px_16px_-6px_var(--accent-glow),inset_0_1px_0_rgba(255,255,255,0.45)]"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name?.charAt(0)?.toUpperCase() || "U"}
    </div>
  );
}

export default function DashboardLayout({ navItems, navGroups }: { navItems?: NavItem[]; navGroups?: NavGroup[] }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isDemo = useAuthStore((s) => s.isDemo);
  const navigate = useNavigate();
  const location = useLocation();
  const { language, setLanguage, dir, t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const userRole = user?.role || "STUDENT";
  const isRTL = dir === "rtl";

  const allItems = navGroups ? navGroups.flatMap((g) => g.items) : navItems || [];
  const closeMobileMenu = () => setMobileMenuOpen(false);
  const dockItems = allItems.slice(0, 4);
  const rolePath = userRole.toLowerCase().replace("_", "-");

  const isActivePath = (item: NavItem) =>
    item.end ? location.pathname === item.to : location.pathname === item.to || location.pathname.startsWith(item.to + "/");

  return (
    <div className="flex min-h-screen" dir={dir}>
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 animate-fade-in bg-slate-900/30 backdrop-blur-md md:hidden dark:bg-black/50"
          onClick={closeMobileMenu}
        />
      )}

      {/* Floating glass sidebar: full drawer on phones, icon rail on tablets, labelled on desktop */}
      <aside
        className={`
          glass-strong fixed bottom-3 top-3 z-50 flex w-[280px] flex-col !rounded-[30px]
          transition-transform duration-500 [transition-timing-function:var(--ease)]
          ${isRTL ? "right-3" : "left-3"}
          ${mobileMenuOpen ? "translate-x-0" : isRTL ? "translate-x-[120%] md:translate-x-0" : "-translate-x-[120%] md:translate-x-0"}
          md:w-[76px] lg:w-[248px]
        `}
      >
        <button
          className="glass-icon-btn absolute end-3 top-3 md:hidden"
          onClick={closeMobileMenu}
          aria-label="Close menu"
        >
          <X size={18} />
        </button>

        {/* Brand */}
        <div className="px-4 pb-3 pt-5 md:px-3 lg:px-4">
          <div className="flex items-center gap-3 md:justify-center lg:justify-start">
            <div className="glass relative grid h-11 w-11 shrink-0 place-items-center !rounded-[15px]">
              <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Cognitec" className="h-7 w-7 object-contain" />
            </div>
            <div className="min-w-0 md:hidden lg:block">
              <p className="text-[14px] font-semibold leading-[1.15] tracking-tight text-ink">Cognitec AI<br />School ERP</p>
              <p className="truncate text-[11px] text-ink-3">{ROLE_TAGLINE[userRole]}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="nav-fade flex-1 overflow-y-auto overflow-x-hidden px-3 py-1 md:px-2.5 lg:px-3">
          <div className="space-y-0.5">
            {allItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={closeMobileMenu}
                  title={t(item.label)}
                  className={({ isActive }) =>
                    `group relative flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[13.5px] font-medium transition-all duration-300 [transition-timing-function:var(--ease)] md:justify-center lg:justify-start ${
                      isActive
                        ? "nav-active text-ink"
                        : "text-ink-2 hover:bg-surface-3 hover:text-ink"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {Icon && (
                        <Icon
                          size={19}
                          className={`shrink-0 transition-colors duration-300 ${isActive ? "text-accent" : "text-ink-3 group-hover:text-ink-2"}`}
                        />
                      )}
                      <span className="truncate md:hidden lg:inline">{t(item.label)}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="px-3 pb-3 pt-2 md:px-2.5 lg:px-3">
          <div className="mb-2 flex items-center gap-2 rounded-2xl bg-accent-soft px-3 py-2.5 md:hidden lg:flex">
            <Sparkles size={15} className="shrink-0 text-accent" />
            <div className="min-w-0">
              <p className="truncate text-[11.5px] font-semibold text-ink">{t("footer.poweredByAI")}</p>
              <p className="truncate text-[10px] text-ink-3">{t("footer.tagline")}</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 md:flex-col lg:flex-row">
            <ThemeToggle />
            <button
              className="glass-icon-btn hover:!text-red-500"
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className={`flex min-h-screen min-w-0 flex-1 flex-col ${isRTL ? "md:mr-[100px] lg:mr-[272px]" : "md:ml-[100px] lg:ml-[272px]"}`}>
        {/* Floating glass top bar */}
        <header className="sticky top-3 z-30 mx-3 mt-3 md:me-4 md:ms-0">
          <div className="glass-strong flex h-[60px] items-center justify-between gap-3 !rounded-full ps-3 pe-3 md:ps-5">
            <button className="glass-icon-btn md:hidden" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu">
              <Menu size={19} />
            </button>

            <label className="hidden w-full max-w-[360px] items-center gap-2.5 rounded-full bg-surface-3 px-4 py-2 transition-all duration-300 focus-within:bg-surface focus-within:shadow-[0_0_0_4px_var(--accent-soft)] sm:flex">
              <Search size={16} className="shrink-0 text-ink-3" />
              <input
                type="text"
                placeholder={t("header.searchPlaceholder")}
                className="w-full !border-0 !bg-transparent text-sm text-ink outline-none !shadow-none placeholder:text-ink-3"
              />
            </label>

            <div className="flex items-center gap-2 md:gap-3">
              <div className="lg-seg">
                <button aria-pressed={language === "en"} onClick={() => setLanguage("en")}>EN</button>
                <button aria-pressed={language === "ar"} onClick={() => setLanguage("ar")}>عربي</button>
              </div>

              <NotificationBell />

              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2.5 rounded-full py-1 ps-1 pe-2 transition-colors hover:bg-surface-3"
                  aria-haspopup="menu"
                  aria-expanded={userDropdownOpen}
                >
                  <Avatar name={user?.full_name} size={36} />
                  <div className="hidden text-start md:block">
                    <p className="max-w-[140px] truncate text-[13px] font-semibold leading-tight text-ink">{user?.full_name}</p>
                    <p className="text-[11px] leading-tight text-ink-3">{user ? ROLE_LABEL[user.role] : ""}</p>
                  </div>
                  <ChevronDown size={15} className={`hidden text-ink-3 transition-transform duration-300 md:block ${userDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {userDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserDropdownOpen(false)} />
                    <div
                      role="menu"
                      className="glass-strong absolute end-0 top-full z-50 mt-3 w-64 origin-top-right overflow-hidden !rounded-[26px] p-2 animate-pop-in"
                    >
                      <div className="mb-1 flex items-center gap-3 rounded-[20px] bg-accent-soft p-3">
                        <Avatar name={user?.full_name} size={44} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink">{user?.full_name}</p>
                          <p className="text-xs text-ink-3">{user ? ROLE_LABEL[user.role] : ""}</p>
                        </div>
                      </div>

                      <button
                        role="menuitem"
                        onClick={() => {
                          setUserDropdownOpen(false);
                          navigate(`/${rolePath}/profile`);
                        }}
                        className="menu-row"
                      >
                        <span className="menu-row-icon"><User size={16} /></span>
                        <span>
                          <span className="block text-sm font-medium text-ink">{t("header.myProfile")}</span>
                          <span className="block text-xs text-ink-3">View & edit profile</span>
                        </span>
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => {
                          setUserDropdownOpen(false);
                          navigate(`/${rolePath}/settings`);
                        }}
                        className="menu-row"
                      >
                        <span className="menu-row-icon"><Settings size={16} /></span>
                        <span>
                          <span className="block text-sm font-medium text-ink">{t("header.settings")}</span>
                          <span className="block text-xs text-ink-3">Preferences & config</span>
                        </span>
                      </button>
                      <div className="my-1 h-px bg-line" />
                      <button
                        role="menuitem"
                        onClick={() => {
                          setUserDropdownOpen(false);
                          logout();
                          navigate("/login", { replace: true });
                        }}
                        className="menu-row hover:!bg-red-500/10"
                      >
                        <span className="menu-row-icon !bg-red-500/12 !text-red-500"><LogOut size={16} /></span>
                        <span>
                          <span className="block text-sm font-medium text-red-500">{t("header.signOut")}</span>
                          <span className="block text-xs text-ink-3">Logout from account</span>
                        </span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {isDemo && (
          <div className="mx-3 mt-3 md:me-4 md:ms-0">
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-[26px] sm:rounded-full bg-gradient-to-r from-amber-400/90 to-orange-500/90 px-4 py-2 text-center text-[13px] font-medium text-white shadow-[0_10px_28px_-12px_rgba(255,159,10,0.8),inset_0_1px_0_rgba(255,255,255,0.5)]">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                {t("demo.demoMode")} — {t("demo.exploreWithSampleData")}
              </span>
              <button
                onClick={() => {
                  logout();
                  navigate("/login", { replace: true });
                }}
                className="rounded-full bg-white/25 px-3 py-0.5 text-xs font-semibold transition-all hover:scale-105 hover:bg-white/35"
              >
                {t("demo.exitDemo")}
              </button>
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 px-3 pb-28 pt-5 md:pe-4 md:ps-0 md:pb-8 md:pt-6">
          <div key={location.pathname} className="animate-page-enter">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Phone dock (iOS tab-bar style) */}
      <nav className="glass-strong fixed inset-x-3 bottom-3 z-30 flex items-center justify-around !rounded-[28px] px-2 py-2 md:hidden" aria-label="Primary">
        {dockItems.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(item);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={`flex min-w-[60px] flex-col items-center gap-0.5 rounded-2xl px-2 py-1.5 text-[10.5px] font-medium transition-all duration-300 ${
                active ? "nav-active text-accent" : "text-ink-3"
              }`}
            >
              {Icon && <Icon size={21} />}
              <span className="max-w-[64px] truncate">{t(item.label)}</span>
            </NavLink>
          );
        })}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex min-w-[60px] flex-col items-center gap-0.5 rounded-2xl px-2 py-1.5 text-[10.5px] font-medium text-ink-3"
        >
          <Ellipsis size={21} />
          <span>More</span>
        </button>
      </nav>

      <AiChatWidget />
    </div>
  );
}

export function ComingSoon({ title }: { title: string }): ReactNode {
  return (
    <div className="glass flex h-64 items-center justify-center text-sm text-ink-3">
      <Sparkles className="mr-2 h-5 w-5 text-accent" />
      {title} — coming soon
    </div>
  );
}
