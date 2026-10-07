import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, PageHeader, Spinner, Badge } from "../../components/ui";
import { api } from "../../api/client";
import { fetchClasses, fetchSections, listStudents } from "./api";
import type { PageResponse } from "../../types/common";
import { useLanguage } from "../../i18n/LanguageContext";

const TERM_KEYS: Record<string, string> = {
  "Unit Test": "admin.exams.terms.unitTest",
  Quarterly: "admin.exams.terms.quarterly",
  "Half Yearly": "admin.exams.terms.halfYearly",
  Annual: "admin.exams.terms.annual",
};


interface ResultSubject {
  exam_subject_id: string;
  subject_id: string;
  max_marks: number;
  pass_marks: number;
  marks_obtained: number | null;
  grade: string | null;
}

interface ExamResult {
  exam_id: string;
  student_id: string;
  student_name: string;
  subjects: ResultSubject[];
  total_marks_obtained: number;
  total_max_marks: number;
  percentage: number;
  overall_grade: string;
}

interface Exam {
  id: string;
  name: string;
  term?: string | null;
}

export default function ReportCards() {
  const { t, te } = useLanguage();
  const termLabel = (v: string) => (TERM_KEYS[v] ? t(TERM_KEYS[v]) : v);
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedExam, setSelectedExam] = useState("");

  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: () => fetchClasses() });
  const sectionsQuery = useQuery({ queryKey: ["sections"], queryFn: () => fetchSections() });

  const studentsQuery = useQuery({
    queryKey: ["students", selectedSection],
    queryFn: () => listStudents({ section_id: selectedSection, status: "ACTIVE", page: 1, page_size: 100 }),
    enabled: !!selectedSection,
  });

  const examsQuery = useQuery({
    queryKey: ["exams-list"],
    queryFn: async () => {
      const { data } = await api.get<PageResponse<Exam>>("/exams");
      return data;
    },
  });

  const subjectsQuery = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data } = await api.get<{ id: string; name: string }[]>("/academics/subjects");
      return data;
    },
  });

  const resultQuery = useQuery({
    queryKey: ["exam-result", selectedStudent, selectedExam],
    queryFn: async () => {
      const { data } = await api.get<ExamResult>(`/exams/${selectedExam}/students/${selectedStudent}/result`);
      return data;
    },
    enabled: !!selectedStudent && !!selectedExam,
  });

  const subjectName = (id: string) => te("subject", subjectsQuery.data?.find((s) => s.id === id)?.name) || id;

  const getSectionName = (id: string) => {
    const section = sectionsQuery.data?.find((s) => s.id === id);
    if (!section) return id;
    const cls = classesQuery.data?.find((c) => c.id === section.class_id);
    return `${te("class", cls?.name)} - ${te("section", section.name)}`;
  };

  const getGradeTone = (grade: string): "green" | "violet" | "yellow" | "red" => {
    if (grade === "A+" || grade === "A") return "green";
    if (grade === "B+" || grade === "B") return "violet";
    if (grade === "C+" || grade === "C") return "yellow";
    return "red";
  };

  const result = resultQuery.data;
  const rows = (result?.subjects ?? []).filter((r) => r.marks_obtained !== null);
  const totalMarks = result?.total_marks_obtained ?? 0;
  const maxMarks = result?.total_max_marks ?? 0;
  const percentage = (result?.percentage ?? 0).toFixed(1);

  async function downloadPdf() {
    const { data } = await api.get<Blob>(`/exams/${selectedExam}/students/${selectedStudent}/report-card`, {
      responseType: "blob",
    });
    const url = URL.createObjectURL(data);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  const selectedStudentData = studentsQuery.data?.items.find((s) => s.id === selectedStudent);

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={t("admin.reportCards.title")} subtitle={t("admin.reportCards.subtitle")} />

      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">{t("admin.common.section")}</label>
            <select
              value={selectedSection}
              onChange={(e) => { setSelectedSection(e.target.value); setSelectedStudent(""); }}
              className="w-full rounded-lg border border-line px-3 py-2"
            >
              <option value="">{t("admin.reportCards.selectSection")}</option>
              {sectionsQuery.data?.map((s) => (
                <option key={s.id} value={s.id}>{getSectionName(s.id)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">{t("admin.common.student")}</label>
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2"
              disabled={!selectedSection}
            >
              <option value="">{t("admin.reportCards.selectStudent")}</option>
              {studentsQuery.data?.items.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name} ({s.admission_no})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">{t("admin.common.exam")}</label>
            <select
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2"
            >
              <option value="">{t("admin.reportCards.selectExam")}</option>
              {examsQuery.data?.items.map((e) => (
                <option key={e.id} value={e.id}>{e.name}{e.term ? ` (${termLabel(e.term)})` : ""}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {selectedStudent && selectedExam && (
        resultQuery.isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : result && rows.length > 0 ? (
          <Card>
            <div className="border-b border-line pb-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-ink">{selectedStudentData?.full_name}</h2>
                  <p className="text-sm text-accent-fg">
                    {selectedStudentData?.admission_no} · {getSectionName(selectedSection)}
                  </p>
                </div>
                <div className="text-end">
                  <p className="text-2xl font-bold text-accent-fg">{percentage}%</p>
                  <p className="text-sm text-accent-fg">{t("admin.reportCards.marksOf", { obtained: totalMarks, max: maxMarks })}</p>
                </div>
              </div>
            </div>

            <table className="w-full">
              <thead>
                <tr className="text-start text-sm text-accent-fg border-b border-line">
                  <th className="pb-2 text-start">{t("admin.common.subject")}</th>
                  <th className="pb-2 text-center">{t("admin.reportCards.marks")}</th>
                  <th className="pb-2 text-center">{t("admin.reportCards.max")}</th>
                  <th className="pb-2 text-center">%</th>
                  <th className="pb-2 text-center">{t("admin.reportCards.grade")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((mark) => (
                  <tr key={mark.exam_subject_id} className="border-b border-line">
                    <td className="py-3 font-medium text-ink">{subjectName(mark.subject_id)}</td>
                    <td className="py-3 text-center">{mark.marks_obtained}</td>
                    <td className="py-3 text-center text-accent-fg">{mark.max_marks}</td>
                    <td className="py-3 text-center">
                      {(((mark.marks_obtained ?? 0) / mark.max_marks) * 100).toFixed(0)}%
                    </td>
                    <td className="py-3 text-center">
                      <Badge tone={getGradeTone(mark.grade ?? "")}>{mark.grade ?? "-"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 flex justify-end">
              <Button variant="secondary" onClick={downloadPdf}>{t("admin.reportCards.downloadPdf")}</Button>
            </div>
          </Card>
        ) : (
          <Card><p className="text-center text-accent-fg py-8">{t("admin.reportCards.noMarks")}</p></Card>
        )
      )}

      {(!selectedStudent || !selectedExam) && (
        <Card><p className="text-center text-accent-fg py-8">{t("admin.reportCards.selectAll")}</p></Card>
      )}
    </div>
  );
}
