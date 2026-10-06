import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, Card } from "../../components/ui";
import { SyllabusViewer } from "../../components/SyllabusViewer";
import { useTheme } from "../../theme/ThemeContext";
import { listSyllabus, getSyllabusDocumentUrl } from "../admin/syllabusApi";
import { fetchClasses, fetchSubjects, fetchAcademicYears } from "../admin/api";
import { Filter } from "lucide-react";

export default function PrincipalSyllabus() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");

  const syllabusQuery = useQuery({
    queryKey: ["principal", "syllabus", selectedClass, selectedSubject],
    queryFn: () => listSyllabus({
      class_id: selectedClass || undefined,
      subject_id: selectedSubject || undefined,
    }),
  });

  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: () => fetchClasses() });
  const subjectsQuery = useQuery({ queryKey: ["subjects"], queryFn: fetchSubjects });
  const yearsQuery = useQuery({ queryKey: ["academicYears"], queryFn: fetchAcademicYears });

  const getClassName = (id: string) => classesQuery.data?.find((c) => c.id === id)?.name || id;
  const getSubjectName = (id: string) => subjectsQuery.data?.find((s) => s.id === id)?.name || id;
  const getYearName = (id: string) => yearsQuery.data?.find((y) => y.id === id)?.name || id;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Syllabus Overview"
        subtitle="Review all course curricula across the school"
      />

      <Card className={`mb-6 ${isDark ? "bg-slate-800/50 border-slate-700" : ""}`}>
        <div className="flex flex-wrap items-center gap-4">
          <Filter size={18} className={isDark ? "text-slate-400" : "text-slate-500"} />
          <div>
            <label className={`block text-sm font-medium mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
              Class
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className={`rounded-lg border px-3 py-2 ${
                isDark
                  ? "bg-slate-700 border-slate-600 text-white"
                  : "border-slate-200 focus:border-violet-500"
              }`}
            >
              <option value="">All Classes</option>
              {classesQuery.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
              Subject
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className={`rounded-lg border px-3 py-2 ${
                isDark
                  ? "bg-slate-700 border-slate-600 text-white"
                  : "border-slate-200 focus:border-violet-500"
              }`}
            >
              <option value="">All Subjects</option>
              {subjectsQuery.data?.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
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
        emptyMessage="No syllabus available. Ask teachers to create and publish syllabi."
      />
    </div>
  );
}
