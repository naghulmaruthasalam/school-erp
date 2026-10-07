import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button, Card, PageHeader, Spinner, Badge } from "../../components/ui";
import { fetchClasses, fetchSubjects } from "./api";
import { listTeacherSyllabus } from "./syllabusApi";
import { useLanguage } from "../../i18n/LanguageContext";

export default function SyllabusList() {
  const { t, te, fmtDate } = useLanguage();
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");

  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: fetchClasses });
  const subjectsQuery = useQuery({ queryKey: ["subjects"], queryFn: fetchSubjects });

  const syllabusQuery = useQuery({
    queryKey: ["teacher-syllabus", selectedClass, selectedSubject],
    queryFn: () => listTeacherSyllabus({
      class_id: selectedClass || undefined,
      subject_id: selectedSubject || undefined,
    }),
  });

  const getClassName = (id: string) => te("class", classesQuery.data?.find((c) => c.id === id)?.name) || id;
  const getSubjectName = (id: string) => te("subject", subjectsQuery.data?.find((s) => s.id === id)?.name) || id;

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={t("teacher.syllabus.listTitle")} subtitle={t("teacher.syllabus.listSubtitle")}>
        <Link to="/teacher/syllabus/new">
          <Button>{t("syllabus.createSyllabus")}</Button>
        </Link>
      </PageHeader>

      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">{t("syllabus.class")}</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="rounded-lg border border-line px-3 py-2 focus:border-violet-500"
            >
              <option value="">{t("syllabus.allClasses")}</option>
              {classesQuery.data?.map((c) => (
                <option key={c.id} value={c.id}>{te("class", c.name)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">{t("syllabus.subject")}</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="rounded-lg border border-line px-3 py-2 focus:border-violet-500"
            >
              <option value="">{t("syllabus.allSubjects")}</option>
              {subjectsQuery.data?.map((s) => (
                <option key={s.id} value={s.id}>{te("subject", s.name)}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {syllabusQuery.isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="space-y-3">
          {syllabusQuery.data?.items.map((syl) => (
            <Link key={syl.id} to={`/teacher/syllabus/${syl.id}`}>
              <Card className="hover:border-violet-400 cursor-pointer">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-ink">{syl.title}</h3>
                      <Badge tone="violet">{getClassName(syl.class_id)}</Badge>
                      <Badge tone="gray">{getSubjectName(syl.subject_id)}</Badge>
                    </div>
                    <p className="text-sm text-ink-2 mb-2 line-clamp-2">{syl.description}</p>
                    <div className="flex items-center gap-4 text-xs text-accent-fg">
                      <span>{t("teacher.syllabus.chaptersCount", { n: syl.chapters_count })}</span>
                    </div>
                  </div>
                  <div className="text-end">
                    <Badge tone={syl.status === "PUBLISHED" ? "green" : "gray"}>{te("status", syl.status)}</Badge>
                    <p className="text-xs text-accent-fg mt-2">
                      {t("teacher.syllabus.updated", { date: fmtDate(syl.updated_at) })}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
          {syllabusQuery.data?.items.length === 0 && (
            <Card><p className="text-center text-accent-fg py-8">{t("teacher.syllabus.noneForSubjects")}</p></Card>
          )}
        </div>
      )}
    </div>
  );
}
