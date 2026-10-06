import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/LanguageContext";
import Logo from "../components/Logo";
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
  gradient: string;
  shadowColor: string;
}

const Icon3D = ({ children, bgGradient }: { children: React.ReactNode; bgGradient: string }) => (
  <div className="relative w-16 h-16">
    <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${bgGradient} opacity-40 blur-lg translate-y-2`} />
    <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${bgGradient} shadow-xl`}>
      <div className="absolute inset-[2px] rounded-[14px] bg-gradient-to-br from-white/30 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-1/2 rounded-b-2xl bg-gradient-to-t from-black/20 to-transparent" />
    </div>
    <div className="relative w-full h-full flex items-center justify-center text-white drop-shadow-lg">
      {children}
    </div>
  </div>
);

const ROLES: RoleData[] = [
  {
    id: "teacher",
    name: "TEACHER",
    nameAr: "المعلم",
    description: "Manage classes, create lessons, track student progress, and more.",
    descriptionAr: "إدارة الفصول وإنشاء الدروس وتتبع تقدم الطلاب",
    path: "/login/teacher",
    icon: <Icon3D bgGradient="from-[#A78BFA] to-[#6D28D9]"><Monitor className="w-7 h-7" /></Icon3D>,
    gradient: "from-[#8B5CF6] to-[#6D28D9]",
    shadowColor: "shadow-[#8B5CF6]/40",
  },
  {
    id: "parent",
    name: "PARENT",
    nameAr: "ولي الأمر",
    description: "View your child's progress, attendance and updates.",
    descriptionAr: "عرض تقدم طفلك والحضور والتحديثات",
    path: "/login/parent",
    icon: <Icon3D bgGradient="from-[#F472B6] to-[#DB2777]"><Users className="w-7 h-7" /></Icon3D>,
    gradient: "from-[#EC4899] to-[#DB2777]",
    shadowColor: "shadow-[#EC4899]/40",
  },
  {
    id: "student",
    name: "STUDENT",
    nameAr: "الطالب",
    description: "Access your courses, assignments, results, and more.",
    descriptionAr: "الوصول إلى الدورات والمهام والنتائج",
    path: "/login/student",
    icon: <Icon3D bgGradient="from-[#34D399] to-[#059669]"><GraduationCap className="w-7 h-7" /></Icon3D>,
    gradient: "from-[#10B981] to-[#059669]",
    shadowColor: "shadow-[#10B981]/40",
  },
  {
    id: "super-admin",
    name: "SUPER ADMIN",
    nameAr: "المدير العام",
    description: "Manage system settings, users, roles and overall operations.",
    descriptionAr: "إدارة إعدادات النظام والمستخدمين والأدوار",
    path: "/login/super-admin",
    icon: <Icon3D bgGradient="from-[#FB923C] to-[#EA580C]"><Settings className="w-7 h-7" /></Icon3D>,
    gradient: "from-[#F97316] to-[#EA580C]",
    shadowColor: "shadow-[#F97316]/40",
  },
  {
    id: "school-admin",
    name: "SCHOOL ADMIN",
    nameAr: "مدير المدرسة",
    description: "Handle school operations, facilities and academic management.",
    descriptionAr: "إدارة عمليات المدرسة والمرافق والأكاديمية",
    path: "/login/admin",
    icon: <Icon3D bgGradient="from-[#60A5FA] to-[#2563EB]"><Building2 className="w-7 h-7" /></Icon3D>,
    gradient: "from-[#3B82F6] to-[#2563EB]",
    shadowColor: "shadow-[#3B82F6]/40",
  },
  {
    id: "principal",
    name: "PRINCIPAL",
    nameAr: "المدير",
    description: "Oversee administration, reports and school performance.",
    descriptionAr: "الإشراف على الإدارة والتقارير وأداء المدرسة",
    path: "/login/principal",
    icon: <Icon3D bgGradient="from-[#A78BFA] to-[#7C3AED]"><UserCog className="w-7 h-7" /></Icon3D>,
    gradient: "from-[#8B5CF6] to-[#7C3AED]",
    shadowColor: "shadow-[#8B5CF6]/40",
  },
];

export default function LoginLanding() {
  const { language, setLanguage, dir } = useLanguage();

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-[#FAFAFF] via-[#F5F3FF] to-[#EDE9FE]"
      dir={dir}
    >
      {/* Subtle background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-[#8B5CF6]/10 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-[#EC4899]/10 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 lg:px-12 py-5 border-b border-[#E5DDF5]/50 bg-white/50 backdrop-blur-sm">
        <div className="flex items-center gap-6">
          <Logo size={44} showWordmark={true} />
          <div className="hidden md:flex items-center gap-2 text-sm text-[#7C6F95] pl-6 border-l border-[#E5DDF5]">
            <span className="font-medium">Smart Learning</span>
            <span className="w-1 h-1 rounded-full bg-[#8B5CF6]" />
            <span className="font-medium">Better Future</span>
          </div>
        </div>

        {/* Language switcher */}
        <div className="flex items-center rounded-full bg-white shadow-sm border border-[#E5DDF5] p-1">
          <button
            onClick={() => setLanguage("en")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              language === "en"
                ? "bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white shadow-md shadow-[#8B5CF6]/30"
                : "text-[#7C6F95] hover:text-[#24113F]"
            }`}
          >
            <Globe className="w-4 h-4" />
            EN
          </button>
          <button
            onClick={() => setLanguage("ar")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              language === "ar"
                ? "bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white shadow-md shadow-[#8B5CF6]/30"
                : "text-[#7C6F95] hover:text-[#24113F]"
            }`}
          >
            عربي
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#8B5CF6]/10 to-[#EC4899]/10 border border-[#8B5CF6]/20 mb-6">
            <Sparkles className="w-4 h-4 text-[#8B5CF6]" />
            <span className="text-sm text-[#6D28D9] font-semibold tracking-wide">
              {language === "ar" ? "الجيل القادم من إدارة المدارس" : "Next-Gen School Management"}
            </span>
          </div>

          <h1 className="text-4xl lg:text-5xl font-bold text-[#24113F] mb-4 tracking-tight">
            {language === "ar" ? (
              <>اختر <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8B5CF6] to-[#EC4899]">دورك</span></>
            ) : (
              <>Select <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8B5CF6] to-[#EC4899]">Your Role</span></>
            )}
          </h1>
          <p className="text-lg text-[#7C6F95] max-w-xl mx-auto">
            {language === "ar"
              ? "اختر دورك للمتابعة إلى نظام إدارة المدرسة"
              : "Choose your role to continue to the School ERP system."
            }
          </p>
        </div>

        {/* Role Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {ROLES.map((role, index) => (
            <Link
              key={role.id}
              to={role.path}
              className="group"
              style={{
                animationDelay: `${index * 60}ms`,
              }}
            >
              <div className={`relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br ${role.gradient} text-white shadow-xl ${role.shadowColor} transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl`}>
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/5 rounded-full -ml-12 -mb-12" />

                {/* Icon */}
                <div className="relative w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-300">
                  {role.icon}
                </div>

                {/* Content */}
                <div className="relative">
                  <h3 className="text-lg font-bold mb-2 tracking-wide">
                    {language === "ar" ? role.nameAr : role.name}
                  </h3>
                  <p className="text-sm text-white/85 leading-relaxed mb-5 min-h-[40px]">
                    {language === "ar" ? role.descriptionAr : role.description}
                  </p>
                </div>

                {/* Arrow */}
                <div className="relative flex justify-end">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-all duration-300">
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Features Strip */}
        <div className="mt-14 py-6 px-8 rounded-2xl bg-white/80 backdrop-blur-sm border border-[#E5DDF5] shadow-sm">
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] flex items-center justify-center shadow-md shadow-[#8B5CF6]/30">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#24113F]">{language === "ar" ? "آمن ومحمي" : "Secure & Safe"}</p>
                <p className="text-xs text-[#7C6F95]">{language === "ar" ? "تشفير البيانات" : "Data encrypted"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center shadow-md shadow-[#10B981]/30">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#24113F]">{language === "ar" ? "سريع البرق" : "Lightning Fast"}</p>
                <p className="text-xs text-[#7C6F95]">{language === "ar" ? "تحديثات فورية" : "Real-time updates"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#2563EB] flex items-center justify-center shadow-md shadow-[#3B82F6]/30">
                <Globe className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#24113F]">{language === "ar" ? "متعدد اللغات" : "Multi-Language"}</p>
                <p className="text-xs text-[#7C6F95]">{language === "ar" ? "دعم العربية" : "Arabic RTL support"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#EC4899] to-[#DB2777] flex items-center justify-center shadow-md shadow-[#EC4899]/30">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#24113F]">{language === "ar" ? "ذكاء اصطناعي" : "AI Powered"}</p>
                <p className="text-xs text-[#7C6F95]">{language === "ar" ? "مساعد ذكي" : "Smart assistant"}</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6 px-6 lg:px-12 border-t border-[#E5DDF5]/50 bg-white/30">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-[#7C6F95]">
            © {new Date().getFullYear()} Cogniitec Technologies Pvt. Ltd. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-sm">
            <Link to="/privacy" className="text-[#7C6F95] hover:text-[#6D28D9] transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="text-[#7C6F95] hover:text-[#6D28D9] transition-colors">Terms of Service</Link>
            <Link to="/help" className="text-[#7C6F95] hover:text-[#6D28D9] transition-colors">Help Center</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
