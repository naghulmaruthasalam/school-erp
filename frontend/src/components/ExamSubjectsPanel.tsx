import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Button, ErrorText } from "./ui";
import { useLanguage } from "../i18n/LanguageContext";

interface ExamSubject {
  id: string;
  class_id: string;
  subject_id: string;
  max_marks: number;
  pass_marks: number;
  exam_date: string | null;
}

interface Named {
  id: string;
  name: string;
}

/** Lists and adds the per-class subject papers (max/pass marks) of an exam. Marks entry by teachers needs these. */
export function ExamSubjectsPanel({ examId, classIds }: { examId: string; classIds: string[] }) {
  const { t, te, fmtDate, fmtNumber } = useLanguage();
  const queryClient = useQueryClient();
  const queryKey = ["exam-subjects", examId];

  const { data: classes } = useQuery({ queryKey: ["classes"], queryFn: async () => (await api.get<Named[]>("/academics/classes")).data });
  const { data: subjects } = useQuery({ queryKey: ["subjects"], queryFn: async () => (await api.get<Named[]>("/academics/subjects")).data });
  const { data: rows } = useQuery({
    queryKey,
    queryFn: async () => (await api.get<ExamSubject[]>(`/exams/${examId}/subjects`)).data,
  });

  const [classId, setClassId] = useState(classIds[0] ?? "");
  const [subjectId, setSubjectId] = useState("");
  const [maxMarks, setMaxMarks] = useState("100");
  const [passMarks, setPassMarks] = useState("35");
  const [examDate, setExamDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const addMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/exams/${examId}/subjects`, {
          class_id: classId,
          subject_id: subjectId,
          max_marks: Number(maxMarks),
          pass_marks: Number(passMarks),
          exam_date: examDate || null,
        })
      ).data,
    onSuccess: () => {
      setError(null);
      setSubjectId("");
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (err) => setError(err instanceof Error ? err.message : t("shell.examSubjects.addFailed")),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!classId || !subjectId || !maxMarks) {
      setError(t("shell.examSubjects.required"));
      return;
    }
    addMutation.mutate();
  }

  const className = (id: string) => {
    const n = classes?.find((c) => c.id === id)?.name;
    return n ? te("class", n) : id;
  };
  const subjectName = (id: string) => {
    const n = subjects?.find((s) => s.id === id)?.name;
    return n ? te("subject", n) : id;
  };
  const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm";

  return (
    <div className="mt-4 border-t border-line pt-4">
      <h4 className="mb-2 text-sm font-semibold text-ink">{t("shell.examSubjects.title")}</h4>
      {(rows ?? []).length === 0 ? (
        <p className="mb-3 text-sm text-ink-3">{t("shell.examSubjects.empty")}</p>
      ) : (
        <ul className="mb-3 space-y-1 text-sm text-ink-2">
          {rows!.map((r) => (
            <li key={r.id}>
              {className(r.class_id)} — {subjectName(r.subject_id)} · {t("shell.examSubjects.maxPass", { max: fmtNumber(r.max_marks), pass: fmtNumber(r.pass_marks) })}
              {r.exam_date ? ` · ${fmtDate(r.exam_date)}` : ""}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleSubmit} className="grid grid-cols-2 items-end gap-3 md:grid-cols-6">
        <select aria-label={t("shell.examSubjects.class")} className={field} value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">{t("shell.examSubjects.class")}</option>
          {classIds.map((id) => (
            <option key={id} value={id}>{className(id)}</option>
          ))}
        </select>
        <select aria-label={t("shell.examSubjects.subject")} className={field} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">{t("shell.examSubjects.subject")}</option>
          {(subjects ?? []).map((s) => (
            <option key={s.id} value={s.id}>{te("subject", s.name)}</option>
          ))}
        </select>
        <input aria-label={t("shell.examSubjects.maxMarks")} type="number" min={1} className={field} value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} placeholder={t("shell.examSubjects.max")} />
        <input aria-label={t("shell.examSubjects.passMarks")} type="number" min={0} className={field} value={passMarks} onChange={(e) => setPassMarks(e.target.value)} placeholder={t("shell.examSubjects.pass")} />
        <input aria-label={t("shell.examSubjects.examDate")} type="date" className={field} value={examDate} onChange={(e) => setExamDate(e.target.value)} />
        <Button type="submit" disabled={addMutation.isPending}>{addMutation.isPending ? t("shell.examSubjects.adding") : t("shell.examSubjects.add")}</Button>
      </form>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
