import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import Logo from "../components/Logo";
import { ThemeToggle } from "../theme/ThemeContext";
import {
  Monitor, Users, GraduationCap, Settings, Building2, UserCog,
  Globe, ArrowRight, Shield, Zap, Sparkles, CheckCircle2
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
    { Icon: Shield, tone: "#0a7aff", title: ar ? "آمن ومحمي" : "Secure & Safe", hint: ar ? "تشفير البيانات وصلاحيات الأدوار" : "Encrypted data with role-based access" },
    { Icon: Zap, tone: "#22ac5c", title: ar ? "سريع البرق" : "Lightning Fast", hint: ar ? "تحديثات فورية للحضور والرسوم" : "Real-time attendance and fee updates" },
    { Icon: Globe, tone: "#12a8a8", title: ar ? "متعدد اللغات" : "Multi-Language", hint: ar ? "دعم كامل للعربية من اليمين لليسار" : "Full Arabic RTL support" },
    { Icon: Sparkles, tone: "#ff4f8b", title: ar ? "ذكاء اصطناعي" : "AI Powered", hint: ar ? "مساعد ذكي للمعلمين والإدارة" : "A smart assistant for staff and families" },
  ];

  return (
    <div className="relative flex min-h-screen flex-col lg:flex-row" dir={dir}>
      {/* Showcase panel */}
      <div className="hidden p-4 lg:flex lg:w-1/2 xl:w-[55%]">
        <div className="glass relative flex w-full flex-col justify-between overflow-hidden !rounded-[36px] p-12">
          <div className="pointer-events-none absolute -end-24 -top-24 h-80 w-80 rounded-full bg-accent/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -start-20 h-80 w-80 rounded-full bg-accent-2/20 blur-3xl" />

          <div className="relative z-10">
            <Logo size={44} showWordmark={true} />
          </div>

          <div className="relative z-10 flex max-w-lg flex-1 flex-col justify-center">
            <div className="mb-8 inline-flex w-fit items-center gap-3 rounded-full bg-accent-soft px-4 py-2">
              <Sparkles className="h-5 w-5 text-accent" strokeWidth={1.7} />
              <span className="text-sm font-semibold text-accent-fg">
                {ar ? "الجيل القادم من إدارة المدارس" : "Next-Gen School Management"}
              </span>
            </div>

            <h1 className="mb-4 text-4xl font-semibold leading-[1.1] tracking-tight text-ink xl:text-[3.4rem]">
              {ar ? "مرحباً بك في" : "Welcome to"}
              <br />
              <span className="text-gradient">Capital Private School</span>
            </h1>

            <p className="mb-9 text-lg text-ink-3">
              {ar ? "تعلّم ذكي لمستقبل أفضل" : "Smart learning for a better future."}
            </p>

            <div className="space-y-3">
              {features.map(({ Icon, tone, title, hint }, i) => (
                <div key={title} className="glass-row animate-fade-in-up" style={{ animationDelay: `${i * 0.08}s` }}>
                  <div
                    className="lg-icon !h-9 !w-9 shrink-0 !rounded-[12px]"
                    style={{ ["--tone-a" as string]: tone, ["--tone-b" as string]: tone }}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{title}</p>
                    <p className="text-xs text-ink-3">{hint}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-2 text-ink-3">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs">
              © {new Date().getFullYear()} Capital Private School, Muscat
            </span>
          </div>
        </div>
      </div>

      {/* Role selection panel */}
      <div className="relative flex flex-1 flex-col px-5 pb-8 pt-20 md:px-12 lg:justify-center lg:py-12">
        <div className="absolute start-5 top-6 lg:hidden">
          <Logo size={34} showWordmark={true} />
        </div>
        <div className="absolute end-5 top-6 flex items-center gap-2 md:end-12">
          <div className="lg-seg">
            <button aria-pressed={language === "en"} onClick={() => setLanguage("en")}>EN</button>
            <button aria-pressed={language === "ar"} onClick={() => setLanguage("ar")}>عربي</button>
          </div>
          <ThemeToggle />
        </div>

        <div className="mx-auto w-full max-w-lg animate-fade-in-up">
          <div className="mb-7 text-center lg:text-start">
            <h2 className="mb-1.5 text-[1.9rem] font-semibold tracking-tight text-ink">
              {ar ? (
                <>اختر <span className="text-gradient">دورك</span></>
              ) : (
                <>Select <span className="text-gradient">Your Role</span></>
              )}
            </h2>
            <p className="text-sm text-ink-3">
              {ar ? "اختر دورك للمتابعة إلى نظام إدارة المدرسة" : "Choose your role to continue to the School ERP system."}
            </p>
          </div>

          <div className="space-y-3">
            {ROLES.map((role, index) => (
              <Link
                key={role.id}
                to={role.path}
                className="group block animate-fade-in-up"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div
                  className="glass glass-lift relative flex items-center gap-4 overflow-hidden !rounded-[24px] p-4 pe-5"
                  style={{ ["--tone-a" as string]: role.tone[0], ["--tone-b" as string]: role.tone[1] }}
                >
                  <div
                    className="pointer-events-none absolute -end-10 -top-10 h-28 w-28 rounded-full opacity-20 blur-2xl transition-opacity duration-500 group-hover:opacity-50"
                    style={{ background: role.tone[0] }}
                  />
                  <div className="lg-icon relative !h-12 !w-12 shrink-0 !rounded-[16px] transition-transform duration-500 [transition-timing-function:var(--ease-spring)] group-hover:scale-110 group-hover:-rotate-3">
                    {role.icon}
                  </div>
                  <div className="relative min-w-0 flex-1">
                    <h3 className="text-[14px] font-semibold tracking-[0.06em] text-ink">
                      {ar ? role.nameAr : role.name}
                    </h3>
                    <p className="mt-0.5 text-[13px] leading-snug text-ink-3">
                      {ar ? role.descriptionAr : role.description}
                    </p>
                  </div>
                  <div className="role-arrow relative shrink-0">
                    <ArrowRight className={`h-5 w-5 ${ar ? "rotate-180" : ""}`} />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm lg:justify-start">
            <Link to="/privacy" className="text-ink-3 transition-colors hover:text-accent-fg">Privacy Policy</Link>
            <Link to="/terms" className="text-ink-3 transition-colors hover:text-accent-fg">Terms of Service</Link>
            <Link to="/help" className="text-ink-3 transition-colors hover:text-accent-fg">Help Center</Link>
          </div>
          <p className="mt-3 text-center text-xs text-ink-3 lg:hidden">
            © {new Date().getFullYear()} Capital Private School, Muscat
          </p>
        </div>
      </div>
    </div>
  );
}
