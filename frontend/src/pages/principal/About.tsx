import AboutPage from "../../components/AboutPage";
import { useLanguage } from "../../i18n/LanguageContext";
import { BarChart3, Users, FileCheck, Shield, TrendingUp } from "lucide-react";

const features = [
  { icon: BarChart3, textKey: "shell.about.principal.analytics", color: "from-indigo-500 to-violet-500" },
  { icon: Users, textKey: "shell.about.principal.teachers", color: "from-teal-500 to-cyan-500" },
  { icon: FileCheck, textKey: "shell.about.principal.leave", color: "from-pink-500 to-rose-500" },
  { icon: Shield, textKey: "shell.about.principal.operations", color: "from-blue-500 to-indigo-500" },
  { icon: TrendingUp, textKey: "shell.about.principal.progress", color: "from-amber-500 to-orange-500" },
];

export default function About() {
  const { t } = useLanguage();
  return (
    <AboutPage
      role={t("roles.principal")}
      features={features.map(({ textKey, ...f }) => ({ ...f, text: t(textKey) }))}
    />
  );
}
