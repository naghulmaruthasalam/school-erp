import { useQuery } from "@tanstack/react-query";
import { PageHeader, Card, Spinner } from "../../components/ui";
import { SyllabusViewer } from "../../components/SyllabusViewer";
import { listSyllabus, getSyllabusDocumentUrl } from "../admin/syllabusApi";
import { fetchClasses, fetchSubjects, fetchAcademicYears } from "../admin/api";
import { BookOpen, GraduationCap, FileText, Sparkles } from "lucide-react";

export default function StudentSyllabus() {
  const syllabusQuery = useQuery({
    queryKey: ["student", "syllabus"],
    queryFn: () => listSyllabus({ status: "PUBLISHED" }),
  });

  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: () => fetchClasses() });
  const subjectsQuery = useQuery({ queryKey: ["subjects"], queryFn: fetchSubjects });
  const yearsQuery = useQuery({ queryKey: ["academicYears"], queryFn: fetchAcademicYears });

  const getClassName = (id: string) => classesQuery.data?.find((c) => c.id === id)?.name || id;
  const getSubjectName = (id: string) => subjectsQuery.data?.find((s) => s.id === id)?.name || id;
  const getYearName = (id: string) => yearsQuery.data?.find((y) => y.id === id)?.name || id;

  const totalSyllabus = syllabusQuery.data?.items?.length || 0;
  const totalChapters = syllabusQuery.data?.items?.reduce((acc: number, s: any) => acc + (s.chapters?.length || 0), 0) || 0;

  const stats = [
    { icon: BookOpen, label: "My Subjects", value: totalSyllabus, color: "from-violet-500 to-purple-600" },
    { icon: GraduationCap, label: "Chapters", value: totalChapters, color: "from-blue-500 to-cyan-600" },
    { icon: FileText, label: "Materials", value: syllabusQuery.data?.items?.reduce((acc: number, s: any) => acc + (s.documents?.length || 0), 0) || 0, color: "from-emerald-500 to-teal-600" },
  ];

  return (
    <div className="animate-page-enter">
      <PageHeader title="My Syllabus" subtitle="View your course curriculum and study materials" />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {stats.map((s, i) => (
          <div key={i} className={`relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br ${s.color} text-white shadow-lg`}>
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 blur-2xl" />
            <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/5 rounded-full -ml-4 -mb-4 blur-xl" />
            <s.icon className="w-7 h-7 mb-3 drop-shadow-lg" />
            <p className="text-3xl font-bold">{s.value}</p>
            <p className="text-sm text-white/80">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Welcome Card */}
      <Card className="mb-6 relative overflow-hidden" gradient>
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-violet-500/10 to-pink-500/10 rounded-full -mr-24 -mt-24 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-[#24113F] dark:text-white">Your Learning Journey</h3>
            <p className="text-sm text-[#7C6F95]">
              Explore your syllabus, chapters, and study materials for your grade.
            </p>
          </div>
        </div>
      </Card>

      <SyllabusViewer
        syllabusList={syllabusQuery.data?.items || []}
        isLoading={syllabusQuery.isLoading}
        getClassName={getClassName}
        getSubjectName={getSubjectName}
        getYearName={getYearName}
        getDocumentUrl={getSyllabusDocumentUrl}
        emptyMessage="No syllabus available for your classes yet."
      />
    </div>
  );
}
