import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import Logo from "../components/Logo";
import { ThemeToggle } from "../theme/ThemeContext";
import {
  Monitor, Users, GraduationCap, Settings, Building2, UserCog,
  Globe, ArrowRight, Shield, Zap, Sparkles
} from "lucide-react";

interface RoleData {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  path: string;
  icon: React.ReactNode;
  tone: [string, string];
}

const ROLES: RoleData[] = [
  {
    id: "teacher",
    name: "TEACHER",
    nameAr: "المعلم",
    description: "Manage classes, create lessons, track student progress, and more.",
    descriptionAr: "إدارة الفصول وإنشاء الدروس وتتبع تقدم الطلاب",
    path: "/login/teacher",
    icon: <Monitor className="h-6 w-6" />,
    tone: ["#12a8a8", "#32ade6"],
  },
  {
    id: "parent",
    name: "PARENT",
    nameAr: "ولي الأمر",
    description: "View your child's progress, attendance and updates.",
    descriptionAr: "عرض تقدم طفلك والحضور والتحديثات",
    path: "/login/parent",
    icon: <Users className="h-6 w-6" />,
    tone: ["#22ac5c", "#5fd68a"],
  },
  {
    id: "student",
    name: "STUDENT",
    nameAr: "الطالب",
    description: "Access your courses, assignments, results, and more.",
    descriptionAr: "الوصول إلى الدورات والمهام والنتائج",
    path: "/login/student",
    icon: <GraduationCap className="h-6 w-6" />,
    tone: ["#a64fe0", "#ff4f8b"],
  },
  {
    id: "super-admin",
    name: "SUPER ADMIN",
    nameAr: "المدير العام",
    description: "Manage system settings, users, roles and overall operations.",
    descriptionAr: "إدارة إعدادات النظام والمستخدمين والأدوار",
    path: "/login/super-admin",
    icon: <Settings className="h-6 w-6" />,
    tone: ["#5e5ce6", "#bf5af2"],
  },
  {
    id: "school-admin",
    name: "SCHOOL ADMIN",
    nameAr: "مدير المدرسة",
    description: "Handle school operations, facilities and academic management.",
    descriptionAr: "إدارة عمليات المدرسة والمرافق والأكاديمية",
    path: "/login/admin",
    icon: <Building2 className="h-6 w-6" />,
    tone: ["#0a7aff", "#5ac8fa"],
  },
  {
    id: "principal",
    name: "PRINCIPAL",
    nameAr: "المدير",
    description: "Oversee administration, reports and school performance.",
    descriptionAr: "الإشراف على الإدارة والتقارير وأداء المدرسة",
    path: "/login/principal",
    icon: <UserCog className="h-6 w-6" />,
    tone: ["#6a52f0", "#0a84ff"],
  },
];

export default function LoginLanding() {
  const { language, setLanguage, dir } = useLanguage();
  const ar = language === "ar";

  const features = [
    { Icon: Shield, tone: "#0a7aff", title: ar ? "آمن ومحمي" : "Secure & Safe", hint: ar ? "تشفير البيانات" : "Data encrypted" },
    { Icon: Zap, tone: "#22ac5c", title: ar ? "سريع البرق" : "Lightning Fast", hint: ar ? "تحديثات فورية" : "Real-time updates" },
    { Icon: Globe, tone: "#12a8a8", title: ar ? "متعدد اللغات" : "Multi-Language", hint: ar ? "دعم العربية" : "Arabic RTL support" },
    { Icon: Sparkles, tone: "#ff4f8b", title: ar ? "ذكاء اصطناعي" : "AI Powered", hint: ar ? "مساعد ذكي" : "Smart assistant" },
  ];

  return (
    <div className="relative min-h-screen" dir={dir}>
      {/* Header */}
      <header className="sticky top-3 z-20 mx-3 mt-3 md:mx-6">
        <div className="glass-strong mx-auto flex max-w-6xl items-center justify-between !rounded-full px-4 py-2.5 md:px-6">
          <div className="flex items-center gap-6">
            <Logo size={40} showWordmark={true} />
            <div className="hidden items-center gap-2 border-s border-line ps-6 text-sm text-ink-3 md:flex">
              <span className="font-medium">Smart Learning</span>
              <span className="h-1 w-1 rounded-full bg-accent" />
              <span className="font-medium">Better Future</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="lg-seg">
              <button aria-pressed={language === "en"} onClick={() => setLanguage("en")}>EN</button>
              <button aria-pressed={language === "ar"} onClick={() => setLanguage("ar")}>عربي</button>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-5 py-12 md:px-8 lg:py-16">
        {/* Hero */}
        <div className="mb-12 text-center animate-fade-in-up">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-accent-soft px-5 py-2.5 ring-1 ring-accent/20">
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="text-sm font-semibold tracking-wide text-accent-fg">
              {ar ? "الجيل القادم من إدارة المدارس" : "Next-Gen School Management"}
            </span>
          </div>

          <h1 className="mb-4 text-4xl font-semibold tracking-tight text-ink sm:text-5xl lg:text-6xl">
            {ar ? (
              <>اختر <span className="text-gradient">دورك</span></>
            ) : (
              <>Select <span className="text-gradient">Your Role</span></>
            )}
          </h1>
          <p className="mx-auto max-w-xl text-lg text-ink-3">
            {ar ? "اختر دورك للمتابعة إلى نظام إدارة المدرسة" : "Choose your role to continue to the School ERP system."}
          </p>
        </div>

        {/* Role cards */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((role, index) => (
            <Link
              key={role.id}
              to={role.path}
              className="group block animate-fade-in-up"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <div
                className="glass glass-lift relative overflow-hidden p-6"
                style={{ ["--tone-a" as string]: role.tone[0], ["--tone-b" as string]: role.tone[1] }}
              >
                <div
                  className="pointer-events-none absolute -end-12 -top-12 h-40 w-40 rounded-full opacity-25 blur-2xl transition-opacity duration-500 group-hover:opacity-50"
                  style={{ background: role.tone[0] }}
                />
                <div className="lg-icon relative mb-5 !h-14 !w-14 !rounded-[18px] transition-transform duration-500 [transition-timing-function:var(--ease-spring)] group-hover:scale-110 group-hover:-rotate-3">
                  {role.icon}
                </div>
                <div className="relative">
                  <h3 className="mb-2 text-[15px] font-semibold tracking-[0.06em] text-ink">
                    {ar ? role.nameAr : role.name}
                  </h3>
                  <p className="mb-6 min-h-[44px] text-sm leading-relaxed text-ink-3">
                    {ar ? role.descriptionAr : role.description}
                  </p>
                </div>
                <div className="relative flex justify-end">
                  <div className="role-arrow">
                    <ArrowRight className={`h-5 w-5 ${ar ? "rotate-180" : ""}`} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Feature strip */}
        <div className="glass mt-12 px-6 py-6 sm:px-8">
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-5">
            {features.map(({ Icon, tone, title, hint }) => (
              <div key={title} className="flex items-center gap-3">
                <div
                  className="lg-icon !h-10 !w-10 !rounded-[13px]"
                  style={{ ["--tone-a" as string]: tone, ["--tone-b" as string]: tone }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">{title}</p>
                  <p className="text-xs text-ink-3">{hint}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="relative z-10 px-6 pb-8 pt-2 lg:px-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-ink-3">
            © {new Date().getFullYear()} Cogniitec Technologies Pvt. Ltd. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-sm">
            <Link to="/privacy" className="text-ink-3 transition-colors hover:text-accent-fg">Privacy Policy</Link>
            <Link to="/terms" className="text-ink-3 transition-colors hover:text-accent-fg">Terms of Service</Link>
            <Link to="/help" className="text-ink-3 transition-colors hover:text-accent-fg">Help Center</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
