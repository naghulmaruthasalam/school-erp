import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, Card } from "../../components/ui";
import SyllabusBrowser from "../../components/SyllabusBrowser";
import { SyllabusViewer } from "../../components/SyllabusViewer";
import { listSyllabus, getSyllabusDocumentUrl } from "../admin/syllabusApi";
import { fetchClasses, fetchSubjects, fetchAcademicYears } from "../admin/api";
import { Filter } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext";

export default function PrincipalSyllabus() {
  const { t, te } = useLanguage();
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

  const getClassName = (id: string) => te("class", classesQuery.data?.find((c) => c.id === id)?.name || id);
  const getSubjectName = (id: string) => te("subject", subjectsQuery.data?.find((s) => s.id === id)?.name || id);
  const getYearName = (id: string) => yearsQuery.data?.find((y) => y.id === id)?.name || id;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={t("principal.syllabus.title")}
        subtitle={t("principal.syllabus.subtitle")}
      />

      <SyllabusBrowser role="principal" />

      <Card className={`mb-6 `}>
        <div className="flex flex-wrap items-center gap-4">
          <Filter size={18} className={"text-ink-3"} />
          <div>
            <label className={`block text-sm font-medium mb-1 text-ink-2`}>
              {t("principal.common.class")}
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className={`rounded-lg border px-3 py-2 border-line focus:border-violet-500`}
            >
              <option value="">{t("principal.common.allClasses")}</option>
              {classesQuery.data?.map((c) => (
                <option key={c.id} value={c.id}>{te("class", c.name)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1 text-ink-2`}>
              {t("principal.syllabus.subject")}
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className={`rounded-lg border px-3 py-2 border-line focus:border-violet-500`}
            >
              <option value="">{t("principal.syllabus.allSubjects")}</option>
              {subjectsQuery.data?.map((s) => (
                <option key={s.id} value={s.id}>{te("subject", s.name)}</option>
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
        emptyMessage={t("principal.syllabus.empty")}
      />
    </div>
  );
}
