import AboutPage from "../../components/AboutPage";
import { useLanguage } from "../../i18n/LanguageContext";
import { Eye, ClipboardCheck, Bell, CreditCard, MessageSquare } from "lucide-react";

const features = [
  { icon: Eye, textKey: "shell.about.parent.progress", color: "from-green-500 to-emerald-500" },
  { icon: ClipboardCheck, textKey: "shell.about.parent.attendance", color: "from-teal-500 to-cyan-500" },
  { icon: Bell, textKey: "shell.about.parent.notifications", color: "from-pink-500 to-rose-500" },
  { icon: CreditCard, textKey: "shell.about.parent.fees", color: "from-blue-500 to-indigo-500" },
  { icon: MessageSquare, textKey: "shell.about.parent.communicate", color: "from-amber-500 to-orange-500" },
];

export default function About() {
  const { t } = useLanguage();
  return (
    <AboutPage
      role={t("roles.parent")}
      features={features.map(({ textKey, ...f }) => ({ ...f, text: t(textKey) }))}
    />
  );
}
