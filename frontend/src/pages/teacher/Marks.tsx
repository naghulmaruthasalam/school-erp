import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button, Card, ErrorText, PageHeader, Spinner, Badge } from "../../components/ui";
import { fetchClassRoster, listExamSubjects, listExams, listMarks, submitMarks } from "./api";
import { useClasses, useSubjects } from "./hooks";
import { FileText, Award, Save, CheckCircle, Users, GraduationCap } from "lucide-react";

export default function TeacherMarks() {
  const { data: classes } = useClasses();
  const { data: subjects } = useSubjects();
  const queryClient = useQueryClient();

  const [examId, setExamId] = useState("");
  const [examSubjectId, setExamSubjectId] = useState("");
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const examsQuery = useQuery({ queryKey: ["teacher", "exams"], queryFn: listExams });

  const examSubjectsQuery = useQuery({
    queryKey: ["teacher", "exam-subjects", examId],
    queryFn: () => listExamSubjects(examId),
    enabled: !!examId,
  });

  const examSubject = examSubjectsQuery.data?.find((s) => s.id === examSubjectId);

  const rosterQuery = useQuery({
    queryKey: ["teacher", "roster-by-class", examSubject?.class_id],
    queryFn: () => fetchClassRoster(examSubject!.class_id),
    enabled: !!examSubject,
  });

  const existingMarksQuery = useQuery({
    queryKey: ["teacher", "marks", examSubjectId],
    queryFn: () => listMarks(examSubjectId),
    enabled: !!examSubjectId,
  });

  useEffect(() => {
    if (!existingMarksQuery.data) return;
    const nextMarks: Record<string, string> = {};
    const nextRemarks: Record<string, string> = {};
    for (const mark of existingMarksQuery.data) {
      nextMarks[mark.student_id] = String(mark.marks_obtained);
      if (mark.remarks) nextRemarks[mark.student_id] = mark.remarks;
    }
    setMarks(nextMarks);
    setRemarks(nextRemarks);
  }, [existingMarksQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (payload: { examSubjectId: string; marks: { student_id: string; marks_obtained: number; remarks?: string | null }[] }) =>
      submitMarks(payload.examSubjectId, { marks: payload.marks }),
    onSuccess: () => {
      setSaveError(null);
      void queryClient.invalidateQueries({ queryKey: ["teacher", "marks", examSubjectId] });
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setSaveError(message ?? "Failed to save marks.");
    },
  });

  const roster = rosterQuery.data ?? [];

  function handleSave() {
    if (!examSubject) return;
    const payload = roster
      .filter((student) => marks[student.id] !== undefined && marks[student.id] !== "")
      .map((student) => ({
        student_id: student.id,
        marks_obtained: Number(marks[student.id]),
        remarks: remarks[student.id] || null,
      }));
    if (payload.length === 0) {
      setSaveError("Enter at least one mark before saving.");
      return;
    }
    saveMutation.mutate({ examSubjectId, marks: payload });
  }

  const enteredCount = Object.values(marks).filter(v => v !== "" && v !== undefined).length;

  return (
    <div className="animate-page-enter">
      <PageHeader title="Marks Entry" subtitle="Enter exam marks for your class" />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 text-white">
          <FileText className="w-6 h-6 mb-2 opacity-80" />
          <p className="text-2xl font-bold">{examsQuery.data?.items?.length || 0}</p>
          <p className="text-sm text-white/80">Total Exams</p>
        </div>
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white">
          <Users className="w-6 h-6 mb-2 opacity-80" />
          <p className="text-2xl font-bold">{roster.length}</p>
          <p className="text-sm text-white/80">Students</p>
        </div>
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
          <Award className="w-6 h-6 mb-2 opacity-80" />
          <p className="text-2xl font-bold">{enteredCount}</p>
          <p className="text-sm text-white/80">Marks Entered</p>
        </div>
      </div>

      <Card className="mb-6" gradient>
        <h3 className="font-bold text-[#24113F] dark:text-white mb-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
            <GraduationCap className="w-4 h-4 text-white" />
          </div>
          Select Exam & Class
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-[#24113F] dark:text-white mb-2">Exam</label>
            <select
              value={examId}
              onChange={(e) => { setExamId(e.target.value); setExamSubjectId(""); }}
              className="w-full rounded-xl border border-[#E5DDF5] dark:border-[#2D1B4E] bg-white dark:bg-[#1B1230] px-4 py-3 text-sm focus:border-[#6D28D9] focus:ring-2 focus:ring-[#6D28D9]/20"
            >
              <option value="">Select an exam</option>
              {examsQuery.data?.items.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name}{exam.term ? ` (${exam.term})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#24113F] dark:text-white mb-2">Class / Subject</label>
            <select
              value={examSubjectId}
              onChange={(e) => setExamSubjectId(e.target.value)}
              disabled={!examId}
              className="w-full rounded-xl border border-[#E5DDF5] dark:border-[#2D1B4E] bg-white dark:bg-[#1B1230] px-4 py-3 text-sm focus:border-[#6D28D9] focus:ring-2 focus:ring-[#6D28D9]/20 disabled:opacity-50"
            >
              <option value="">Select a class/subject</option>
              {examSubjectsQuery.data?.map((es) => (
                <option key={es.id} value={es.id}>
                  {classes?.find((c) => c.id === es.class_id)?.name ?? es.class_id} — {subjects?.find((s) => s.id === es.subject_id)?.name ?? es.subject_id} (max {es.max_marks})
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {!examSubject ? (
        <Card className="text-center py-12">
          <FileText className="w-12 h-12 mx-auto text-[#7C6F95] mb-4" />
          <p className="text-[#7C6F95]">Select an exam and class/subject to enter marks.</p>
        </Card>
      ) : rosterQuery.isLoading || existingMarksQuery.isLoading ? (
        <Card className="py-12 flex justify-center"><Spinner size="lg" /></Card>
      ) : roster.length === 0 ? (
        <Card className="text-center py-12">
          <Users className="w-12 h-12 mx-auto text-[#7C6F95] mb-4" />
          <p className="text-[#7C6F95]">No active students found for this class.</p>
        </Card>
      ) : (
        <Card gradient>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#24113F] dark:text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-[#6D28D9]" />
              Enter Marks (Max: {examSubject.max_marks})
            </h3>
            <Badge tone="blue">{enteredCount}/{roster.length} entered</Badge>
          </div>
          <div className="space-y-3">
            {roster.map((student, idx) => (
              <div key={student.id} className={`flex items-center gap-4 p-4 rounded-xl ${idx % 2 === 0 ? "bg-[#F7F5FF] dark:bg-[#2D1B4E]/50" : "bg-white dark:bg-[#1B1230]"}`}>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                  {student.full_name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#24113F] dark:text-white truncate">{student.full_name}</p>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={examSubject.max_marks}
                    className="w-20 rounded-xl border border-[#E5DDF5] dark:border-[#2D1B4E] bg-white dark:bg-[#1B1230] px-3 py-2 text-sm text-center font-medium focus:border-[#6D28D9] focus:ring-2 focus:ring-[#6D28D9]/20"
                    value={marks[student.id] ?? ""}
                    onChange={(e) => setMarks((prev) => ({ ...prev, [student.id]: e.target.value }))}
                    placeholder="—"
                  />
                  <input
                    className="w-40 rounded-xl border border-[#E5DDF5] dark:border-[#2D1B4E] bg-white dark:bg-[#1B1230] px-3 py-2 text-sm focus:border-[#6D28D9] focus:ring-2 focus:ring-[#6D28D9]/20"
                    value={remarks[student.id] ?? ""}
                    onChange={(e) => setRemarks((prev) => ({ ...prev, [student.id]: e.target.value }))}
                    placeholder="Remarks"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-[#E5DDF5] dark:border-[#2D1B4E] flex items-center gap-3">
            <Button onClick={handleSave} disabled={saveMutation.isPending} glow>
              {saveMutation.isPending ? <Spinner size="sm" /> : <Save className="w-4 h-4" />}
              {saveMutation.isPending ? "Saving..." : "Save Marks"}
            </Button>
            {saveMutation.isSuccess && !saveMutation.isPending && (
              <span className="flex items-center gap-1 text-sm text-emerald-600">
                <CheckCircle className="w-4 h-4" /> Saved successfully
              </span>
            )}
            <ErrorText>{saveError}</ErrorText>
          </div>
        </Card>
      )}
    </div>
  );
}
