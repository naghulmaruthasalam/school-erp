import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import Logo from "../components/Logo";
import { LOGIN_SLUG_TO_ROLE, ROLE_THEMES } from "../theme/roles";
import { demoLoginRequest, fetchMe, loginRequest } from "./api";
import { ROLE_HOME, useAuthStore } from "./store";
import { useLanguage } from "../i18n/LanguageContext";
import {
  Sparkles,
  CheckCircle2,
  BookOpen,
  GraduationCap,
  Award,
  BarChart3,
  Eye,
  EyeOff,
  ArrowLeft,
  Globe,
  ChevronDown,
} from "lucide-react";

const FEATURE_KEYS = [
  "login.features.attendance",
  "login.features.aiInsights",
  "login.features.notifications",
  "login.features.cloudStorage",
];

const FLOATING_ELEMENTS = [
  { Icon: BookOpen, top: "15%", left: "10%", delay: "0s", size: 28 },
  { Icon: GraduationCap, top: "25%", right: "15%", delay: "1.5s", size: 32 },
  { Icon: Award, bottom: "30%", left: "15%", delay: "2s", size: 24 },
  { Icon: BarChart3, bottom: "20%", right: "10%", delay: "0.5s", size: 26 },
  { Icon: Sparkles, top: "50%", left: "5%", delay: "3s", size: 20 },
];

export default function RoleLoginPage() {
  const { role: roleSlug } = useParams<{ role: string }>();
  const role = roleSlug ? LOGIN_SLUG_TO_ROLE[roleSlug] : undefined;

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
        full_name: `Demo ${ROLE_THEMES[role].label}`,
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

  const roleLabels: Record<string, { en: string; ar: string }> = {
    STUDENT: { en: "Student", ar: "الطالب" },
    PARENT: { en: "Parent", ar: "ولي الأمر" },
    TEACHER: { en: "Teacher", ar: "المعلم" },
    SUPER_ADMIN: { en: "Super Admin", ar: "المدير العام" },
    SCHOOL_ADMIN: { en: "School Admin", ar: "مدير المدرسة" },
    PRINCIPAL: { en: "Principal", ar: "المدير" },
  };
  const roleLabel = roleLabels[role]?.[language] || theme.label;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" dir={dir}>
      {/* Left side - Illustration & Info */}
      <div className="login-split-left hidden lg:flex lg:w-1/2 xl:w-[55%] relative p-12 flex-col justify-between overflow-hidden">
        {/* Background elements */}
        <div className="absolute inset-0 bg-grid-pattern opacity-30" />
        <div className="glow-orb glow-orb-1" style={{ width: "300px", height: "300px" }} />
        <div className="glow-orb glow-orb-2" style={{ width: "250px", height: "250px" }} />

        {/* Morphing blob */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-gradient-to-br from-violet-500/20 to-pink-500/20 morphing-blob blur-3xl" />

        {/* Top wavy lines */}
        <svg className="absolute top-0 left-0 w-full h-[150px] pointer-events-none" preserveAspectRatio="none" viewBox="0 0 800 150">
          <defs>
            <linearGradient id="topWaveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.1" />
              <stop offset="50%" stopColor="#ec4899" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.1" />
            </linearGradient>
            <filter id="topGlow">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <path d="M0,80 Q200,20 400,60 T800,40" stroke="url(#topWaveGrad)" strokeWidth="2" fill="none" filter="url(#topGlow)" className="animate-glow-pulse" />
          <path d="M0,100 Q200,50 400,80 T800,60" stroke="url(#topWaveGrad)" strokeWidth="1.5" fill="none" filter="url(#topGlow)" opacity="0.6" />
        </svg>

        {/* Bottom wavy lines */}
        <svg className="absolute bottom-0 left-0 w-full h-[150px] pointer-events-none" preserveAspectRatio="none" viewBox="0 0 800 150">
          <path d="M0,50 Q200,100 400,70 T800,90" stroke="url(#topWaveGrad)" strokeWidth="2" fill="none" filter="url(#topGlow)" className="animate-glow-pulse" />
          <path d="M0,70 Q200,120 400,90 T800,110" stroke="url(#topWaveGrad)" strokeWidth="1.5" fill="none" filter="url(#topGlow)" opacity="0.6" />
        </svg>

        {/* Side wavy line */}
        <svg className="absolute top-0 right-0 w-[100px] h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 600">
          <path d="M80,0 Q40,150 70,300 T50,600" stroke="url(#topWaveGrad)" strokeWidth="2" fill="none" filter="url(#topGlow)" className="animate-glow-pulse" />
        </svg>

        {/* Floating icons */}
        {FLOATING_ELEMENTS.map(({ Icon, top, left, right, bottom, delay, size }, i) => (
          <div
            key={i}
            className="absolute pointer-events-none opacity-30 animate-float-around"
            style={{ top, left, right, bottom, animationDelay: delay }}
          >
            <Icon className="text-violet-300" size={size} strokeWidth={1} />
          </div>
        ))}

        {/* Content */}
        <div className="relative z-10">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            {t("login.backToRoles")}
          </Link>
        </div>

        <div className="relative z-10 flex-1 flex flex-col justify-center max-w-lg">
          {/* Role badge */}
          <div className={`inline-flex items-center gap-3 px-4 py-2 rounded-full bg-gradient-to-r ${theme.from}/20 ${theme.to}/20 border border-violet-500/20 w-fit mb-8`}>
            <theme.Icon className="w-5 h-5 text-violet-400" strokeWidth={1.5} />
            <span className="text-violet-300 font-medium">{roleLabel} {t("login.portal")}</span>
          </div>

          {/* Main heading */}
          <h1 className="text-4xl xl:text-5xl font-bold text-white mb-4 leading-tight">
            {t("login.welcomeTo")}
            <br />
            <span className="text-gradient">Cogniitec AI</span>
          </h1>

          <p className="text-slate-400 text-lg mb-8">
            {theme.tagline}
          </p>

          {/* Feature list */}
          <div className="space-y-4">
            {FEATURE_KEYS.map((key, i) => (
              <div
                key={key}
                className="flex items-center gap-3 animate-fade-in-up"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-violet-400" />
                </div>
                <span className="text-slate-300 text-sm">{t(key)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 text-slate-500">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs">{t("login.tagline")}</span>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen lg:min-h-0 relative">
        {/* Mobile back link */}
        <div className="absolute top-6 left-6 lg:hidden">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("login.backToRoles")}
          </Link>
        </div>

        {/* Language Toggle */}
        <div className="absolute top-6 right-6 flex items-center gap-2">
          <button
            onClick={() => setLanguage("en")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              language === "en"
                ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {language === "en" && <Globe className="w-4 h-4" />}
            EN
            {language === "en" && <ChevronDown className="w-3 h-3" />}
          </button>
          <button
            onClick={() => setLanguage("ar")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              language === "ar"
                ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            عربي
          </button>
        </div>

        <div className="w-full max-w-md animate-fade-in-up">
          {/* Logo and header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 mb-4 shadow-lg shadow-violet-500/30 p-2">
              <img src="/logo.png" alt="Cognitec" className="w-full h-full object-contain" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-1">
              {t("login.signIn")} - {roleLabel}
            </h2>
            <p className="text-slate-500 text-sm">
              {t("login.enterCredentials")}
            </p>
          </div>

          {/* Login form card */}
          <div className="login-glass p-8">
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                mutation.mutate();
              }}
            >
              {needsSchoolCode && (
                <div>
                  <label htmlFor="school_code" className="block text-sm font-medium text-slate-700 mb-2">
                    {t("login.schoolCode")}
                  </label>
                  <input
                    id="school_code"
                    placeholder="e.g. SCH-2024-XXXXXX"
                    value={schoolCode}
                    onChange={(e) => setSchoolCode(e.target.value)}
                    className="w-full input-premium text-slate-800"
                  />
                </div>
              )}

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-2">
                  {role === "STUDENT" ? t("login.studentId") : role === "TEACHER" ? t("login.teacherId") : role === "PARENT" ? t("login.phoneNumber") : t("login.username")}
                </label>
                <input
                  id="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full input-premium text-slate-800"
                  placeholder={role === "STUDENT" ? "e.g. BPS-STU-001" : role === "TEACHER" ? "e.g. BPS-TCH-001" : role === "PARENT" ? "e.g. 9876543210" : "Enter username"}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                  {t("login.password")}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full input-premium text-slate-800 pr-12"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end">
                <Link
                  to={`/forgot-password${needsSchoolCode && schoolCode ? `?school=${schoolCode}` : ""}`}
                  className="text-sm text-violet-600 hover:text-violet-700 font-medium transition-colors"
                >
                  {t("login.forgotPassword")}
                </Link>
              </div>

              {mutation.isError && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                  <p className="text-red-600 text-sm text-center font-medium">
                    {t("login.invalidCredentials")}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={mutation.isPending}
                className="w-full btn-premium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="relative z-10 flex items-center justify-center">
                  {mutation.isPending ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {t("login.signingIn")}
                    </>
                  ) : (
                    t("login.signIn")
                  )}
                </span>
              </button>
            </form>
          </div>

          {/* Demo Login */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-gradient-to-br from-slate-50 to-slate-100 text-slate-500">
                  {t("login.orExploreDemo")}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => demoMutation.mutate()}
              disabled={demoMutation.isPending}
              className="mt-4 w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 text-white font-semibold shadow-lg shadow-orange-300/30 hover:shadow-xl hover:shadow-orange-400/40 hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {demoMutation.isPending ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t("login.loading")}
                </>
              ) : (
                <>
                  <span className="text-lg">✨</span>
                  {t("login.tryDemo")} {roleLabel}
                </>
              )}
            </button>
            <p className="mt-2 text-xs text-slate-400 text-center">
              {t("login.noLoginNeeded")}
            </p>
          </div>

          {/* Footer links */}
          <div className="mt-8 text-center">
            <p className="text-slate-500 text-sm">
              {t("login.notA")} {roleLabel.toLowerCase()}?{" "}
              <Link to="/login" className="text-violet-600 hover:text-violet-700 font-semibold transition-colors">
                {t("login.chooseDifferentRole")}
              </Link>
            </p>
          </div>

          {/* Mobile branding */}
          <div className="mt-10 flex items-center justify-center gap-2 text-slate-400 lg:hidden">
            <Logo size={20} showWordmark={false} />
            <span className="text-xs font-medium">Cogniitec AI School ERP</span>
          </div>
        </div>
      </div>
    </div>
  );
}
