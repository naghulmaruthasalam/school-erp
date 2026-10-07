import { useQuery } from "@tanstack/react-query";
import { PageHeader, Card } from "../../components/ui";
import SyllabusBrowser from "../../components/SyllabusBrowser";
import { listSyllabus } from "../admin/syllabusApi";
import { BookOpen, GraduationCap, FileText, Sparkles } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext";

export default function StudentSyllabus() {
  const { t, language } = useLanguage();
  const syllabusQuery = useQuery({
    queryKey: ["student", "syllabus", language],
    queryFn: () => listSyllabus({ status: "PUBLISHED" }),
  });

  const totalSyllabus = syllabusQuery.data?.items?.length || 0;
  const totalChapters = syllabusQuery.data?.items?.reduce((acc: number, s: any) => acc + (s.chapters?.length || 0), 0) || 0;

  const stats = [
    { icon: BookOpen, label: t("student.syllabus.mySubjects"), value: totalSyllabus, color: "from-violet-500 to-purple-600" },
    { icon: GraduationCap, label: t("student.syllabus.chapters"), value: totalChapters, color: "from-blue-500 to-cyan-600" },
    { icon: FileText, label: t("student.syllabus.materials"), value: syllabusQuery.data?.items?.reduce((acc: number, s: any) => acc + (s.documents?.length || 0), 0) || 0, color: "from-emerald-500 to-teal-600" },
  ];

  return (
    <div className="animate-page-enter">
      <PageHeader title={t("student.syllabus.title")} subtitle={t("student.syllabus.subtitle")} />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {stats.map((s, i) => (
          <div key={i} className={`relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br ${s.color} text-white shadow-lg`}>
            <div className="absolute top-0 end-0 w-24 h-24 bg-white/10 rounded-full -me-8 -mt-8 blur-2xl" />
            <div className="absolute bottom-0 start-0 w-16 h-16 bg-white/5 rounded-full -ms-4 -mb-4 blur-xl" />
            <s.icon className="w-7 h-7 mb-3 drop-shadow-lg" />
            <p className="text-3xl font-bold">{s.value}</p>
            <p className="text-sm text-white/80">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Welcome Card */}
      <Card className="mb-6 relative overflow-hidden" gradient>
        <div className="absolute top-0 end-0 w-48 h-48 bg-gradient-to-br from-violet-500/10 to-pink-500/10 rounded-full -me-24 -mt-24 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-ink dark:text-white">{t("student.syllabus.journey")}</h3>
            <p className="text-sm text-ink-3">
              {t("student.syllabus.journeyDesc")}
            </p>
          </div>
        </div>
      </Card>

      <SyllabusBrowser role="student" />

    </div>
  );
}
