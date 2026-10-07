import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, Button, Card, Modal, PageHeader, Spinner } from "../../components/ui";
import { api } from "../../api/client";
import { DataTable } from "../../components/DataTable";
import { openDocument } from "../../api/files";
import { fetchSectionRoster, getHomework, listHomeworkSubmissions, saveTeacherFeedback } from "./api";
import { sectionLabel, useClasses, useSections, useSubjects } from "./hooks";
import type { HomeworkSubmissionOut, HomeworkSubmissionStatus } from "./types";
import Markdown from "../../copilot/Markdown";
import { useLanguage } from "../../i18n/LanguageContext";

const STATUS_TONE: Record<HomeworkSubmissionStatus, "gray" | "green" | "yellow"> = {
  PENDING: "gray",
  SUBMITTED: "green",
  LATE: "yellow",
};

interface AiFeedback {
  status: string;
  grade?: string; percentage?: number; total_score?: number; max_score?: number;
  overall_feedback?: string; strengths?: string[]; areas_to_improve?: string[];
  questions?: { question_number: number; feedback: string; score: number; max_score: number }[];
}

/** Two levels, in this order: the AI's marking of what the student handed in, then the teacher's own comments. */
function ReviewModal({ submission, studentName, onClose }: { submission: HomeworkSubmissionOut; studentName: string; onClose: () => void }) {
  const { t, language, fmtNumber } = useLanguage();
  const qc = useQueryClient();
  const [text, setText] = useState(submission.teacher_feedback ?? "");
  const ai = useQuery<AiFeedback>({
    queryKey: ["teacher", "submission-feedback", submission.id, language],
    queryFn: async () => (await api.get(`/homework/submissions/${submission.id}/feedback`)).data,
    refetchInterval: (q) => (q.state.data?.status === "pending" ? 4000 : false),
  });
  const save = useMutation({
    mutationFn: () => saveTeacherFeedback(submission.id, text),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["teacher", "homework"] }); },
  });
  const f = ai.data;
  return (
    <Modal open onClose={onClose} title={`${t("teacherHomework.review.reviewTitle")} — ${studentName}`} size="xl">
      <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 pb-6">
        <section data-testid="review-ai">
          <h3 className="mb-2 text-sm font-semibold text-ink">{t("teacherHomework.review.aiFirst")}</h3>
          {ai.isLoading ? <Spinner size="sm" /> : f?.status === "ready" ? (
            <div className="space-y-2 rounded-xl bg-surface-3 p-3 text-sm text-ink-2">
              <p className="flex items-center gap-2 font-semibold text-ink">
                <Badge tone="violet">{f.grade}</Badge>
                <span dir="ltr">{fmtNumber(f.total_score ?? 0)} / {fmtNumber(f.max_score ?? 0)} ({fmtNumber(f.percentage ?? 0)}%)</span>
              </p>
              <p dir="auto">{f.overall_feedback}</p>
              {(f.questions ?? []).map((q) => (
                <p key={q.question_number} dir="auto" className="text-xs"><b>{fmtNumber(q.question_number)}.</b> <span dir="ltr">({fmtNumber(q.score)}/{fmtNumber(q.max_score)})</span> {q.feedback}</p>
              ))}
            </div>
          ) : <p className="rounded-xl bg-surface-3 p-3 text-sm text-ink-3">{t("teacherHomework.review.noAi")}</p>}
        </section>
        <section>
          <h3 className="text-sm font-semibold text-ink">{t("teacherHomework.review.yourFeedback")}</h3>
          <p className="mb-2 text-xs text-ink-3">{t("teacherHomework.review.yourFeedbackHint")}</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={4000} dir="auto" data-testid="teacher-feedback-input" className="lg-field w-full" />
          <div className="mt-2 flex items-center gap-3">
            <Button size="sm" glow onClick={() => save.mutate()} disabled={save.isPending}>{t("teacherHomework.review.save")}</Button>
            {save.isSuccess && <span className="text-xs text-emerald-600" data-testid="feedback-saved">{t("teacherHomework.review.saved")}</span>}
          </div>
        </section>
      </div>
    </Modal>
  );
}

export default function TeacherHomeworkSubmissions() {
  const { homeworkId } = useParams<{ homeworkId: string }>();
  const { t, te, fmtDate } = useLanguage();
  const { data: sections } = useSections();
  const { data: classes } = useClasses();
  const { data: subjects } = useSubjects();

  const homeworkQuery = useQuery({
    queryKey: ["teacher", "homework", homeworkId],
    queryFn: () => getHomework(homeworkId as string),
    enabled: !!homeworkId,
  });

  const submissionsQuery = useQuery({
    queryKey: ["teacher", "homework", homeworkId, "submissions"],
    queryFn: () => listHomeworkSubmissions(homeworkId as string),
    enabled: !!homeworkId,
  });

  const rosterQuery = useQuery({
    queryKey: ["teacher", "roster", homeworkQuery.data?.section_id],
    queryFn: () => fetchSectionRoster(homeworkQuery.data!.section_id),
    enabled: !!homeworkQuery.data,
  });

  const homework = homeworkQuery.data;
  const [reviewing, setReviewing] = useState<HomeworkSubmissionOut | null>(null);
  const nameOf = (id: string) => rosterQuery.data?.find((s) => s.id === id)?.full_name ?? id;

  return (
    <div>
      <PageHeader
        title={homework ? homework.title : t("teacher.homeworkSubmissions.title")}
        subtitle={
          homework
            ? `${sectionLabel(homework.section_id, sections, classes, te)} — ${
                te("subject", subjects?.find((s) => s.id === homework.subject_id)?.name) || homework.subject_id
              }`
            : undefined
        }
        actions={
          <Link to="/teacher/homework" className="text-sm text-accent-fg hover:underline">
            {t("teacher.homeworkSubmissions.back")}
          </Link>
        }
      />

      {homework?.description && (
        <Card className="mb-6">
          <div dir="auto"><Markdown>{homework.description}</Markdown></div>
          <p className="mt-2 text-xs text-accent-fg">
            {t("teacher.homeworkSubmissions.assignedDue", { assigned: fmtDate(homework.assigned_date), due: fmtDate(homework.due_date) })}
          </p>
        </Card>
      )}

      {submissionsQuery.isLoading || rosterQuery.isLoading ? (
        <Card>
          <Spinner className="mx-auto" />
        </Card>
      ) : (
        <DataTable
          rowKey={(row) => row.id}
          rows={submissionsQuery.data ?? []}
          emptyLabel={t("teacher.homeworkSubmissions.empty")}
          columns={[
            {
              header: t("teacher.homeworkSubmissions.student"),
              cell: (r) => rosterQuery.data?.find((s) => s.id === r.student_id)?.full_name ?? r.student_id,
            },
            {
              header: t("teacher.homeworkSubmissions.status"),
              cell: (r) => <Badge tone={STATUS_TONE[r.status]}>{te("status", r.status)}</Badge>,
            },
            {
              header: t("teacher.homeworkSubmissions.submittedAt"),
              cell: (r) => (r.submitted_at ? fmtDate(r.submitted_at, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"),
            },
            {
              header: t("teacher.homeworkSubmissions.attachments"),
              cell: (r) =>
                r.attachment_document_ids.length === 0 ? (
                  "—"
                ) : (
                  <span className="flex flex-wrap gap-2">
                    {r.attachment_document_ids.map((docId, i) => (
                      <button key={docId} type="button" className="text-accent-fg hover:underline" onClick={() => void openDocument(docId)}>
                        {t("teacher.homeworkSubmissions.file", { n: i + 1 })}
                      </button>
                    ))}
                  </span>
                ),
            },
            { header: t("teacher.homeworkSubmissions.remarks"), cell: (r) => r.remarks ?? "—" },
            {
              header: t("teacherHomework.review.col"),
              cell: (r) => r.status === "PENDING" ? "—" : (
                <span className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setReviewing(r)}>{t("teacherHomework.review.review")}</Button>
                  <Badge tone={r.teacher_feedback ? "green" : "gray"}>{t(r.teacher_feedback ? "teacherHomework.review.reviewed" : "teacherHomework.review.notReviewed")}</Badge>
                </span>
              ),
            },
          ]}
        />
      )}
      {reviewing && <ReviewModal submission={reviewing} studentName={nameOf(reviewing.student_id)} onClose={() => setReviewing(null)} />}
    </div>
  );
}
