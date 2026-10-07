import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { api } from "../../api/client";
import { Badge, Button, Card, ErrorText, PageHeader, Spinner } from "../../components/ui";
import { DataTable, Pagination, type Column } from "../../components/DataTable";
import { fetchHomework, fetchHomeworkSubmissions, fetchPendingHomework, updateHomeworkSubmission } from "./api";
import { useMyProfile, useSubjects, subjectMap } from "./hooks";
import { openCopilot } from "../../copilot/events";
import type { Homework, PendingHomework } from "./types";
import { BookOpen, Calendar, Clock, Upload, FileText, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Star, Award, X, Sparkles, ThumbsUp, Target } from "lucide-react";

interface AIFeedback {
  status: string;
  total_score?: number;
  max_score?: number;
  percentage?: number;
  grade?: string;
  overall_feedback?: string;
  strengths?: string[];
  areas_to_improve?: string[];
}

function AIFeedbackModal({ homeworkId, onClose }: { homeworkId: string; onClose: () => void }) {
  const { data: submissions } = useQuery({
    queryKey: ["homework-submissions", homeworkId],
    queryFn: () => fetchHomeworkSubmissions(homeworkId),
  });

  const submission = submissions?.[0];

  const { data: feedback, isLoading } = useQuery<AIFeedback>({
    queryKey: ["homework-feedback", submission?.id],
    queryFn: async () => {
      const { data } = await api.get(`/homework/submissions/${submission?.id}/feedback`);
      return data;
    },
    enabled: !!submission?.id,
  });

  const gradeColors: Record<string, string> = {
    A: "from-emerald-500 to-teal-500",
    B: "from-blue-500 to-cyan-500",
    C: "from-amber-500 to-yellow-500",
    D: "from-orange-500 to-red-400",
    F: "from-red-500 to-rose-600",
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-surface rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-gradient-to-r from-violet-500 to-purple-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-8 h-8" />
              <div>
                <h2 className="text-xl font-bold">AI Feedback</h2>
                <p className="text-white/80 text-sm">Your homework evaluation</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {isLoading || !feedback ? (
            <div className="flex flex-col items-center py-12">
              <Spinner size="lg" />
              <p className="mt-4 text-ink-3">Analyzing your submission...</p>
            </div>
          ) : feedback.status === "pending" ? (
            <div className="text-center py-12">
              <Sparkles className="w-16 h-16 mx-auto text-violet-500 mb-4" />
              <p className="text-lg font-bold text-ink dark:text-white">Feedback is being processed</p>
              <p className="text-ink-3">Check back in a few minutes.</p>
            </div>
          ) : (
            <>
              {/* Score Card */}
              <div className="flex items-center gap-6 mb-6">
                <div className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${gradeColors[feedback.grade || "C"]} flex items-center justify-center shadow-lg`}>
                  <span className="text-4xl font-bold text-white">{feedback.grade}</span>
                </div>
                <div>
                  <p className="text-3xl font-bold text-ink dark:text-white">{feedback.percentage}%</p>
                  <p className="text-ink-3">{feedback.total_score} / {feedback.max_score} points</p>
                </div>
              </div>

              {/* Overall Feedback */}
              <div className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-xl p-4 mb-6">
                <p className="text-ink dark:text-white">{feedback.overall_feedback}</p>
              </div>

              {/* Strengths */}
              {feedback.strengths && feedback.strengths.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-bold text-ink dark:text-white flex items-center gap-2 mb-3">
                    <ThumbsUp className="w-5 h-5 text-emerald-500" /> What you did well
                  </h3>
                  <ul className="space-y-2">
                    {feedback.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-ink-2">
                        <Star className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Areas to Improve */}
              {feedback.areas_to_improve && feedback.areas_to_improve.length > 0 && (
                <div>
                  <h3 className="font-bold text-ink dark:text-white flex items-center gap-2 mb-3">
                    <Target className="w-5 h-5 text-blue-500" /> Areas to improve
                  </h3>
                  <ul className="space-y-2">
                    {feedback.areas_to_improve.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-ink-2">
                        <Award className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

const PAGE_SIZE = 10;

function MarkSubmittedButton({ homeworkId, studentId }: { homeworkId: string; studentId: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const submissions = await fetchHomeworkSubmissions(homeworkId);
      const mine = submissions.find((s) => s.student_id === studentId);
      if (!mine) throw new Error("No submission record found for this homework yet.");
      let attachmentIds = mine.attachment_document_ids ?? [];
      if (file) {
        const form = new FormData();
        form.append("file", file);
        form.append("module", "HOMEWORK_SUBMISSION");
        const { data } = await api.post<{ id: string }>("/uploads", form);
        attachmentIds = [...attachmentIds, data.id];
      }
      return updateHomeworkSubmission(mine.id, { status: "SUBMITTED", attachment_document_ids: attachmentIds });
    },
    onSuccess: () => {
      setError("");
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["student", "homework-pending"] });
      queryClient.invalidateQueries({ queryKey: ["student", "homework-all"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to submit homework."),
  });

  return (
    <div className="flex flex-col gap-3">
      <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed transition-all ${
          file
            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
            : "border-line hover:border-accent hover:bg-surface-3"
        }`}
      >
        {file ? (
          <>
            <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center">
              <FileText size={20} className="text-white" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 truncate max-w-[200px]">{file.name}</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-500">Click to change file</p>
            </div>
            <CheckCircle size={20} className="text-emerald-500" />
          </>
        ) : (
          <>
            <div className="w-10 h-10 rounded-lg bg-surface-3 flex items-center justify-center">
              <Upload size={20} className="text-ink-3" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-medium text-ink dark:text-white">Upload your work</p>
              <p className="text-xs text-ink-3">PDF, DOC, or image files</p>
            </div>
          </>
        )}
      </button>

      <Button
        onClick={() => mutation.mutate()}
        disabled={!file || mutation.isPending}
        className={`w-full ${!file ? "opacity-50 cursor-not-allowed" : ""}`}
        glow={!!file}
      >
        {mutation.isPending ? "Submitting..." : file ? "Submit Homework" : "Upload file to submit"}
      </Button>

      {error && <ErrorText className="text-center">{error}</ErrorText>}
    </div>
  );
}

function PendingHomeworkCard({ hw, subjectName, studentId, classId }: { hw: PendingHomework; subjectName: string; studentId: string; classId?: string }) {
  const [expanded, setExpanded] = useState(false);
  const overdue = hw.due_date < new Date().toISOString().slice(0, 10);
  const dueToday = hw.due_date === new Date().toISOString().slice(0, 10);

  return (
    <Card className="overflow-hidden" gradient>
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        {/* Left: Info */}
        <div className="flex-1">
          <div className="flex items-start gap-3 mb-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${
              overdue
                ? "bg-gradient-to-br from-red-500 to-rose-600"
                : dueToday
                  ? "bg-gradient-to-br from-amber-500 to-orange-600"
                  : "bg-gradient-to-br from-violet-500 to-purple-600"
            }`}>
              <BookOpen size={24} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-ink dark:text-white">{hw.title}</h3>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <Badge tone="violet">{subjectName}</Badge>
                {hw.chapter && <Badge tone="blue">{hw.chapter}</Badge>}
                {overdue && <Badge tone="red">Overdue</Badge>}
                {dueToday && !overdue && <Badge tone="amber">Due Today</Badge>}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm mb-3">
            <div className="flex items-center gap-2 text-ink-3">
              <Calendar size={16} />
              <span>Assigned: {formatDate(hw.assigned_date)}</span>
            </div>
            <div className={`flex items-center gap-2 ${overdue ? "text-red-600 font-medium" : dueToday ? "text-amber-600 font-medium" : "text-ink-3"}`}>
              <Clock size={16} />
              <span>Due: {formatDate(hw.due_date)}</span>
            </div>
          </div>

          {hw.description && (
            <div className="mt-3">
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-2 text-sm text-accent-fg hover:text-accent transition-colors"
              >
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                {expanded ? "Hide instructions" : "View instructions"}
              </button>
              {expanded && (
                <div className="mt-3 p-4 rounded-xl bg-surface-3 dark:bg-surface-2 text-sm text-ink-2 leading-relaxed max-h-60 overflow-y-auto">
                  {hw.description.split('\n').map((line, i) => (
                    <p key={i} className={line.trim() === '' ? 'h-2' : 'mb-2'}>
                      {line.replace(/\*\*/g, '').replace(/\*/g, '').replace(/---/g, '').trim()}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Upload & Submit */}
        <div className="lg:w-72 lg:border-l lg:border-line lg:pl-4">
          <MarkSubmittedButton homeworkId={hw.id} studentId={studentId} />
          {classId && (
            <button type="button" className="mt-3 text-xs font-medium text-accent-fg hover:underline"
              onClick={() => openCopilot({ classId, subjectId: hw.subject_id, chapter: hw.chapter ?? undefined, message: `I need help getting started with my homework "${hw.title}". Give me a hint, not the answer.` })}>
              Get a hint from the Copilot
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function StudentHomework() {
  const { data: profile } = useMyProfile();
  const { data: subjects } = useSubjects();
  const subjects_ = subjectMap(subjects);
  const [page, setPage] = useState(1);
  const [feedbackHomeworkId, setFeedbackHomeworkId] = useState<string | null>(null);

  const pendingQuery = useQuery({
    queryKey: ["student", "homework-pending"],
    queryFn: fetchPendingHomework,
  });

  const allQuery = useQuery({
    queryKey: ["student", "homework-all", profile?.section_id, page],
    queryFn: () => fetchHomework({ section_id: profile!.section_id, page, page_size: PAGE_SIZE }),
    enabled: !!profile?.section_id,
  });

  const pendingIds = new Set((pendingQuery.data ?? []).map((hw) => hw.id));
  const pendingCount = pendingQuery.data?.length ?? 0;
  const submittedCount = (allQuery.data?.items ?? []).filter(hw => !pendingIds.has(hw.id)).length;

  const columns: Column<Homework>[] = [
    { header: "Title", cell: (row) => <span className="font-medium text-ink dark:text-white">{row.title}</span> },
    { header: "Subject", cell: (row) => <Badge tone="violet">{subjects_[row.subject_id]?.name ?? "—"}</Badge> },
    { header: "Assigned", cell: (row) => formatDate(row.assigned_date) },
    { header: "Due", cell: (row) => formatDate(row.due_date) },
    {
      header: "Status",
      cell: (row) => (pendingIds.has(row.id) ? <Badge tone="amber">Pending</Badge> : <Badge tone="green">Submitted</Badge>),
    },
    {
      header: "Feedback",
      cell: (row) => !pendingIds.has(row.id) ? (
        <button
          onClick={() => setFeedbackHomeworkId(row.id)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-medium hover:shadow-lg transition-all"
        >
          <Sparkles className="w-3 h-3" /> AI Feedback
        </button>
      ) : <span className="text-ink-3 text-sm">—</span>,
    },
  ];

  return (
    <div className="animate-page-enter">
      <PageHeader title="Homework" subtitle="View assignments and submit your work" />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-6 -mt-6 blur-xl" />
          <AlertCircle className="w-7 h-7 mb-2 drop-shadow" />
          <p className="text-3xl font-bold">{pendingCount}</p>
          <p className="text-sm text-white/80">Pending</p>
        </div>
        <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-6 -mt-6 blur-xl" />
          <CheckCircle className="w-7 h-7 mb-2 drop-shadow" />
          <p className="text-3xl font-bold">{submittedCount}</p>
          <p className="text-sm text-white/80">Submitted</p>
        </div>
        <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg col-span-2 md:col-span-1">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -mr-6 -mt-6 blur-xl" />
          <BookOpen className="w-7 h-7 mb-2 drop-shadow" />
          <p className="text-3xl font-bold">{allQuery.data?.total ?? 0}</p>
          <p className="text-sm text-white/80">Total Assignments</p>
        </div>
      </div>

      {/* Pending Section */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Clock size={16} className="text-white" />
          </div>
          <h2 className="font-bold text-lg text-ink dark:text-white">Pending Assignments</h2>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-sm font-medium">
              {pendingCount}
            </span>
          )}
        </div>

        {pendingQuery.isLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : pendingCount === 0 ? (
          <Card className="text-center py-8" gradient>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="text-lg font-bold text-ink dark:text-white mb-1">All caught up!</p>
            <p className="text-sm text-ink-3">No pending homework. Great job!</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {(pendingQuery.data ?? [])
              .slice()
              .sort((a, b) => a.due_date.localeCompare(b.due_date))
              .map((hw) => (
                <PendingHomeworkCard
                  key={hw.id}
                  hw={hw}
                  subjectName={subjects_[hw.subject_id]?.name ?? "—"}
                  studentId={hw.student_id}
                  classId={profile?.class_id}
                />
              ))}
          </div>
        )}
      </div>

      {/* All Homework Section */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <BookOpen size={16} className="text-white" />
          </div>
          <h2 className="font-bold text-lg text-ink dark:text-white">All Homework</h2>
        </div>
        <Card gradient>
          <DataTable
            columns={columns}
            rows={allQuery.data?.items ?? []}
            isLoading={allQuery.isLoading}
            rowKey={(row) => row.id}
            emptyLabel="No homework assigned yet."
          />
          {allQuery.data && allQuery.data.total > PAGE_SIZE && (
            <div className="mt-4 pt-4 border-t border-line">
              <Pagination page={page} pageSize={PAGE_SIZE} total={allQuery.data.total} onPageChange={setPage} />
            </div>
          )}
        </Card>
      </div>

      {/* AI Feedback Modal */}
      {feedbackHomeworkId && (
        <AIFeedbackModal homeworkId={feedbackHomeworkId} onClose={() => setFeedbackHomeworkId(null)} />
      )}
    </div>
  );
}
