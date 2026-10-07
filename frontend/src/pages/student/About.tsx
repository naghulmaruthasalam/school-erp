import AboutPage from "../../components/AboutPage";
import { useLanguage } from "../../i18n/LanguageContext";
import { BookOpen, ClipboardCheck, Calendar, FileText, Bell } from "lucide-react";

const features = [
  { icon: BookOpen, textKey: "shell.about.student.materials", color: "from-violet-500 to-purple-500" },
  { icon: ClipboardCheck, textKey: "shell.about.student.attendance", color: "from-teal-500 to-cyan-500" },
  { icon: FileText, textKey: "shell.about.student.results", color: "from-pink-500 to-rose-500" },
  { icon: Calendar, textKey: "shell.about.student.timetable", color: "from-blue-500 to-indigo-500" },
  { icon: Bell, textKey: "shell.about.student.notifications", color: "from-amber-500 to-orange-500" },
];

export default function About() {
  const { t } = useLanguage();
  return (
    <AboutPage
      role={t("roles.student")}
      features={features.map(({ textKey, ...f }) => ({ ...f, text: t(textKey) }))}
    />
  );
}
