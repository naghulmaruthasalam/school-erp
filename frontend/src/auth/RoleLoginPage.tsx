import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import Logo from "../components/Logo";
import { LOGIN_SLUG_TO_ROLE, ROLE_THEMES } from "../theme/roles";
import { demoLoginRequest, fetchMe, loginRequest } from "./api";
import { ROLE_HOME, useAuthStore } from "./store";
import { currentLanguage, translate, useLanguage } from "../i18n/LanguageContext";
import { ThemeToggle, useRoleAccent } from "../theme/ThemeContext";
import {
  Sparkles,
  CheckCircle2,
  Eye,
  EyeOff,
  ArrowLeft,
} from "lucide-react";

const FEATURE_KEYS = [
  "login.features.attendance",
  "login.features.aiInsights",
  "login.features.notifications",
  "login.features.cloudStorage",
];

const ROLE_NAME_KEY: Record<string, string> = {
  STUDENT: "roles.student",
  PARENT: "roles.parent",
  TEACHER: "roles.teacher",
  SUPER_ADMIN: "roles.superAdmin",
  SCHOOL_ADMIN: "roles.admin",
  PRINCIPAL: "roles.principal",
};

const ROLE_TAGLINE_KEY: Record<string, string> = {
  STUDENT: "shell.login.tagline.STUDENT",
  PARENT: "shell.login.tagline.PARENT",
  TEACHER: "shell.login.tagline.TEACHER",
  PRINCIPAL: "shell.login.tagline.PRINCIPAL",
  SCHOOL_ADMIN: "shell.login.tagline.SCHOOL_ADMIN",
  SUPER_ADMIN: "shell.login.tagline.SUPER_ADMIN",
};

export default function RoleLoginPage() {
  const { role: roleSlug } = useParams<{ role: string }>();
  const role = roleSlug ? LOGIN_SLUG_TO_ROLE[roleSlug] : undefined;
  useRoleAccent(role);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [schoolCode, setSchoolCode] = useState("");
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);

  const mutation = useMutation({
    mutationFn: async () => {
      const tokens = await loginRequest(username, password, schoolCode);
      setTokens(tokens);
      const user = await fetchMe();
      setUser(user);
      return user;
    },
    onSuccess: (user) => {
      navigate(ROLE_HOME[user.role], { replace: true });
    },
  });

  const demoMutation = useMutation({
    mutationFn: async () => {
      if (!role) throw new Error("Role is required");
      const tokens = await demoLoginRequest(role);
      setTokens(tokens, true);
      const demoUser = {
        id: `demo-${role.toLowerCase()}`,
        school_id: "demo-school",
        username: `demo-${role.toLowerCase()}`,
        email: null,
        role: role,
        full_name: translate(currentLanguage(), "shell.login.demoUser", { role: translate(currentLanguage(), ROLE_NAME_KEY[role]) }),
        phone: null,
        student_id: role === "STUDENT" ? "DEMO-STU-001" : null,
        teacher_id: role === "TEACHER" ? "DEMO-TCH-001" : null,
        guardian_id: role === "PARENT" ? "DEMO-GRD-001" : null,
      };
      setUser(demoUser as any);
      return role;
    },
    onSuccess: (r) => {
      navigate(ROLE_HOME[r], { replace: true });
    },
  });

  if (!role) {
    return <Navigate to="/login" replace />;
  }

  const theme = ROLE_THEMES[role];
  const needsSchoolCode = role !== "SUPER_ADMIN";
  const { dir, t, language, setLanguage } = useLanguage();

  const roleLabel = ROLE_NAME_KEY[role] ? t(ROLE_NAME_KEY[role]) : theme.label;

  return (
    <div className="relative flex min-h-screen flex-col lg:flex-row" dir={dir}>
      {/* Showcase panel */}
      <div className="hidden p-4 lg:flex lg:w-1/2 xl:w-[55%]">
        <div className="glass relative flex w-full flex-col justify-between overflow-hidden !rounded-[36px] p-12">
          <div className="pointer-events-none absolute -end-24 -top-24 h-80 w-80 rounded-full bg-accent/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -start-20 h-80 w-80 rounded-full bg-accent-2/20 blur-3xl" />

          <div className="relative z-10">
            <Link
              to="/login"
              className="group inline-flex items-center gap-2 rounded-full bg-surface-3 px-4 py-2 text-sm font-medium text-ink-2 transition-colors hover:text-ink"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1 rtl:-scale-x-100 rtl:group-hover:translate-x-1" />
              {t("login.backToRoles")}
            </Link>
          </div>

          <div className="relative z-10 flex max-w-lg flex-1 flex-col justify-center">
            <div className="mb-8 inline-flex w-fit items-center gap-3 rounded-full bg-accent-soft px-4 py-2">
              <theme.Icon className="h-5 w-5 text-accent" strokeWidth={1.7} />
              <span className="text-sm font-semibold text-accent-fg">
                {t("shell.login.rolePortal", { role: roleLabel })}
              </span>
            </div>

            <h1 className="mb-4 text-4xl font-semibold leading-[1.1] tracking-tight text-ink xl:text-[3.4rem]">
              {t("login.welcomeTo")}
              <br />
              <span className="text-gradient">{t("shell.brand.name")}</span>
            </h1>

            <p className="mb-9 text-lg text-ink-3">{t(ROLE_TAGLINE_KEY[role])}</p>

            <div className="space-y-3">
              {FEATURE_KEYS.map((key, i) => (
                <div
                  key={key}
                  className="glass-row animate-fade-in-up"
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft">
                    <CheckCircle2 className="h-[18px] w-[18px] text-accent" />
                  </div>
                  <span className="text-sm font-medium text-ink-2">{t(key)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-2 text-ink-3">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs">{t("login.tagline")}</span>
          </div>
        </div>
      </div>

      {/* Sign-in panel */}
      <div className="relative flex min-h-screen flex-1 items-center justify-center p-6 md:p-12 lg:min-h-0">
        <div className="absolute start-6 top-6 lg:hidden">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-full bg-surface-3 px-3.5 py-2 text-sm text-ink-2 transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" />
            {t("login.backToRoles")}
          </Link>
        </div>

        <div className="absolute end-6 top-6 flex items-center gap-2">
          <div className="lg-seg">
            <button aria-pressed={language === "en"} onClick={() => setLanguage("en")}>EN</button>
            <button aria-pressed={language === "ar"} onClick={() => setLanguage("ar")}>عربي</button>
          </div>
          <ThemeToggle />
        </div>

        <div className="mt-12 w-full max-w-md animate-fade-in-up lg:mt-0">
          <div className="mb-7 text-center">
            <div className="glass relative mx-auto mb-5 grid h-[76px] w-[76px] place-items-center !rounded-[24px] p-3">
              <img src={`${import.meta.env.BASE_URL}logo.png`} alt={t("shell.brand.cogniitec")} className="h-full w-full object-contain" />
            </div>
            <h2 className="mb-1 text-[1.65rem] font-semibold tracking-tight text-ink">
              {t("shell.login.signInRole", { role: roleLabel })}
            </h2>
            <p className="text-sm text-ink-3">{t("login.enterCredentials")}</p>
          </div>

          <div className="glass-strong !rounded-[32px] p-7 sm:p-8">
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                mutation.mutate();
              }}
            >
              {needsSchoolCode && (
                <div>
                  <label htmlFor="school_code" className="mb-1.5 block text-[13px] font-medium text-ink-2">
                    {t("login.schoolCode")}
                  </label>
                  <input
                    id="school_code"
                    placeholder={t("shell.login.schoolCodePlaceholder")}
                    value={schoolCode}
                    onChange={(e) => setSchoolCode(e.target.value)}
                    className="lg-field"
                  />
                </div>
              )}

              <div>
                <label htmlFor="username" className="mb-1.5 block text-[13px] font-medium text-ink-2">
                  {role === "STUDENT" ? t("login.studentId") : role === "TEACHER" ? t("login.teacherId") : role === "PARENT" ? t("login.phoneNumber") : t("login.username")}
                </label>
                <input
                  id="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="lg-field"
                  placeholder={role === "STUDENT" ? t("shell.login.studentIdPlaceholder") : role === "TEACHER" ? t("shell.login.teacherIdPlaceholder") : role === "PARENT" ? t("shell.login.phonePlaceholder") : t("shell.login.usernamePlaceholder")}
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-[13px] font-medium text-ink-2">
                  {t("login.password")}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="lg-field pe-12"
                    placeholder={t("shell.login.passwordPlaceholder")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? t("shell.common.hidePassword") : t("shell.common.showPassword")}
                    className="absolute end-4 top-1/2 -translate-y-1/2 text-ink-3 transition-colors hover:text-ink"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end">
                <Link
                  to={`/forgot-password${needsSchoolCode && schoolCode ? `?school=${schoolCode}` : ""}`}
                  className="text-sm font-medium text-accent-fg transition-opacity hover:opacity-70"
                >
                  {t("login.forgotPassword")}
                </Link>
              </div>

              {mutation.isError && (
                <div className="rounded-2xl bg-red-500/10 p-3.5 ring-1 ring-red-500/25">
                  <p className="text-center text-sm font-medium text-red-600 dark:text-red-400">
                    {t("login.invalidCredentials")}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={mutation.isPending}
                className="lg-btn lg-btn-primary !min-h-12 w-full !text-[15px]"
              >
                {mutation.isPending ? (
                  <>
                    <svg className="-ms-1 me-2 h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {t("login.signingIn")}
                  </>
                ) : (
                  t("login.signIn")
                )}
              </button>
            </form>
          </div>

          {/* Demo Login */}
          <div className="mt-6">
            <div className="relative mb-4 flex items-center gap-3 text-xs font-medium text-ink-3">
              <span className="h-px flex-1 bg-line" />
              {t("login.orExploreDemo")}
              <span className="h-px flex-1 bg-line" />
            </div>
            <button
              type="button"
              onClick={() => demoMutation.mutate()}
              disabled={demoMutation.isPending}
              className="lg-btn lg-btn-secondary !min-h-12 w-full"
            >
              {demoMutation.isPending ? (
                <>
                  <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t("login.loading")}
                </>
              ) : (
                <>
                  <Sparkles className="h-[18px] w-[18px] text-amber-500" />
                  {t("shell.login.tryDemoRole", { role: roleLabel })}
                </>
              )}
            </button>
            <p className="mt-2 text-center text-xs text-ink-3">{t("login.noLoginNeeded")}</p>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-ink-3">
              {t("shell.login.notARole", { role: roleLabel.toLowerCase() })}{" "}
              <Link to="/login" className="font-semibold text-accent-fg transition-opacity hover:opacity-70">
                {t("login.chooseDifferentRole")}
              </Link>
            </p>
          </div>

          <div className="mt-10 flex items-center justify-center gap-2 text-ink-3 lg:hidden">
            <Logo size={20} showWordmark={false} />
            <span className="text-xs font-medium">{t("shell.brand.name")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
