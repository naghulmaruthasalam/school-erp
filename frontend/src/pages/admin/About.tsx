import AboutPage from "../../components/AboutPage";
import { useLanguage } from "../../i18n/LanguageContext";
import { Users, Building2, Calendar, BarChart3, Settings } from "lucide-react";

const features = [
  { icon: Users, textKey: "admin.about.manageUsers", color: "from-violet-500 to-purple-500" },
  { icon: Building2, textKey: "admin.about.configureClasses", color: "from-teal-500 to-cyan-500" },
  { icon: Calendar, textKey: "admin.about.createTimetables", color: "from-pink-500 to-rose-500" },
  { icon: BarChart3, textKey: "admin.about.viewAnalytics", color: "from-blue-500 to-indigo-500" },
  { icon: Settings, textKey: "admin.about.manageSettings", color: "from-amber-500 to-orange-500" },
];

export default function About() {
  const { t } = useLanguage();
  return <AboutPage role={t("roles.admin")} features={features.map(({ textKey, ...f }) => ({ ...f, text: t(textKey) }))} />;
}
