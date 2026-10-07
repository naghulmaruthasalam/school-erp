import AboutPage from "../../components/AboutPage";
import { useLanguage } from "../../i18n/LanguageContext";
import { BookOpen, ClipboardCheck, GraduationCap, Calendar, FileText } from "lucide-react";

const features = [
  { icon: ClipboardCheck, textKey: "shell.about.teacher.attendance", color: "from-teal-500 to-cyan-500" },
  { icon: BookOpen, textKey: "shell.about.teacher.homework", color: "from-violet-500 to-purple-500" },
  { icon: GraduationCap, textKey: "shell.about.teacher.marks", color: "from-pink-500 to-rose-500" },
  { icon: Calendar, textKey: "shell.about.teacher.timetable", color: "from-blue-500 to-indigo-500" },
  { icon: FileText, textKey: "shell.about.teacher.leave", color: "from-amber-500 to-orange-500" },
];

export default function About() {
  const { t } = useLanguage();
  return (
    <AboutPage
      role={t("roles.teacher")}
      description={t("shell.about.teacherDescription")}
      features={features.map(({ textKey, ...f }) => ({ ...f, text: t(textKey) }))}
    />
  );
}
