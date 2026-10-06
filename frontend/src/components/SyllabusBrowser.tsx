import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { BookOpen, ChevronRight, ClipboardCheck, FileText, Lightbulb, ListChecks, MessageSquareText, NotebookPen, PencilLine } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { openCopilot } from "../copilot/events";
import Markdown from "../copilot/Markdown";
import { fetchSyllabusTree, getSyllabus, type TreeChapter, type TreeClass, type TreeSubject } from "../pages/admin/syllabusApi";
import { Badge, Button, Card, Spinner } from "./ui";

export type BrowserRole = "student" | "parent" | "teacher" | "admin";

interface ChapterHomework {
  id: string;
  title: string;
  chapter?: string | null;
  due_date: string;
}

function useChapterHomework(subjectId: string | undefined, chapter: string | undefined) {
  return useQuery({
    queryKey: ["syllabus-browser", "homework", subjectId, chapter],
    enabled: !!subjectId && !!chapter,
    queryFn: async () => {
      const { data } = await api.get<{ items: ChapterHomework[] }>("/homework", { params: { subject_id: subjectId, page_size: 100 } });
      return data.items.filter((h) => (h.chapter ?? "").trim().toLowerCase() === chapter!.trim().toLowerCase());
    },
    retry: false,
  });
}

/** Class -> Subject -> Chapter, read from the syllabus in the database and scoped to what the user may see. */
export default function SyllabusBrowser({ role }: { role: BrowserRole }) {
  const navigate = useNavigate();
  const tree = useQuery({ queryKey: ["syllabus", "tree"], queryFn: fetchSyllabusTree });
  const classes = useMemo(() => (tree.data ?? []).filter((c) => c.subjects.length > 0), [tree.data]);

  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");

  const cls: TreeClass | undefined = classes.find((c) => c.id === classId) ?? classes[0];
  const subject: TreeSubject | undefined = cls?.subjects.find((s) => s.id === subjectId) ?? cls?.subjects[0];
  const chapter: TreeChapter | undefined = subject?.chapters.find((c) => c.id === chapterId);

  // Keep the selection valid when the tree loads or the class changes.
  useEffect(() => {
    if (cls && cls.id !== classId) setClassId(cls.id);
    if (subject && subject.id !== subjectId) setSubjectId(subject.id);
  }, [cls, subject, classId, subjectId]);

  const detail = useQuery({
    queryKey: ["syllabus", "detail", subject?.syllabus_id],
    queryFn: () => getSyllabus(subject!.syllabus_id),
    enabled: !!chapter && !!subject,
  });
  const full = detail.data?.chapters.find((c) => c.id === chapter?.id);
  const homework = useChapterHomework(subject?.id, chapter?.name);

  if (tree.isLoading) return <Card className="flex justify-center py-10"><Spinner size="lg" /></Card>;
  if (tree.isError) return <Card className="py-8 text-center text-sm text-ink-3">Couldn't load the syllabus right now.</Card>;
  if (classes.length === 0) {
    return (
      <Card className="py-10 text-center">
        <BookOpen className="mx-auto mb-3 text-ink-3" size={28} />
        <p className="text-sm font-semibold text-ink">No syllabus to browse yet</p>
        <p className="text-xs text-ink-3">
          {role === "student" || role === "parent" ? "Your school hasn't published a syllabus for this class." : "Create or import a syllabus to see it here."}
        </p>
      </Card>
    );
  }

  const ctx = { classId: cls!.id, subjectId: subject?.id, chapter: chapter?.name };
  const asTeacher = role === "teacher";

  function createHomework(prefill?: { title?: string; description?: string }) {
    navigate("/teacher/homework", {
      state: { prefill: { class_id: cls!.id, subject_id: subject!.id, chapter: chapter!.name, ...prefill } },
    });
  }

  return (
    <Card className="mb-6" gradient>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="lg-icon !h-9 !w-9 !rounded-[12px]"><BookOpen size={18} /></span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">Browse by class, subject and chapter</h2>
          <p className="text-xs text-ink-3">Pick a chapter to see its topics and notes{asTeacher ? ", and to assign homework" : ""}.</p>
        </div>
      </div>

      <div className="space-y-3">
        {(
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Class">
            {classes.map((c) => (
              <button key={c.id} role="tab" aria-selected={c.id === cls!.id} className={clsx("lg-chip cursor-pointer", c.id === cls!.id && "!bg-accent !text-white")}
                onClick={() => { setClassId(c.id); setSubjectId(""); setChapterId(""); }}>
                {c.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Subject">
          {cls!.subjects.map((s) => (
            <button key={s.syllabus_id} role="tab" aria-selected={s.syllabus_id === subject?.syllabus_id}
              className={clsx("lg-chip cursor-pointer", s.syllabus_id === subject?.syllabus_id && "!bg-accent !text-white")}
              onClick={() => { setSubjectId(s.id); setChapterId(""); }}>
              {s.name}
            </button>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <div className="grid content-start gap-2">
            {subject && subject.chapters.length === 0 && <p className="text-sm text-ink-3">No chapters in this subject yet.</p>}
            {subject?.chapters.map((c, i) => (
              <button key={c.id} onClick={() => setChapterId(c.id)} aria-current={c.id === chapter?.id} className={clsx("glass-row !items-start text-start", c.id === chapter?.id && "ring-2 ring-accent/50")}>
                <span className="lg-icon !h-8 !w-8 shrink-0 !rounded-[10px] text-xs font-semibold">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{c.name}</span>
                  <span className="block text-xs text-ink-3">
                    {c.topics.length > 0 ? `${c.topics.length} topic${c.topics.length === 1 ? "" : "s"}` : c.description ?? "Chapter"}
                  </span>
                </span>
                <ChevronRight size={16} className="mt-2 shrink-0 text-ink-3" />
              </button>
            ))}
          </div>

          <div className="min-w-0">
            {!chapter ? (
              <div className="grid h-full min-h-32 place-items-center rounded-2xl bg-surface-3 p-6 text-center text-sm text-ink-3">
                Choose a chapter to see what it covers.
              </div>
            ) : (
              <div className="space-y-4 rounded-2xl bg-surface-3 p-4" data-testid="chapter-detail">
                <div>
                  <h3 className="text-base font-semibold text-ink">{chapter.name}</h3>
                  {chapter.description && <p className="mt-0.5 text-sm text-ink-2">{chapter.description}</p>}
                </div>

                {chapter.topics.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">Topics</p>
                    <div className="flex flex-wrap gap-1.5">{chapter.topics.map((t) => <Badge key={t} tone="blue">{t}</Badge>)}</div>
                  </div>
                )}

                {detail.isLoading && <Spinner size="sm" />}
                {full?.content && (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">Notes</p>
                    <div className="max-h-64 overflow-y-auto rounded-xl bg-surface p-3 text-sm text-ink-2"><Markdown>{full.content}</Markdown></div>
                  </div>
                )}

                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">Homework for this chapter</p>
                  {homework.isLoading ? <Spinner size="sm" /> : (homework.data ?? []).length === 0 ? (
                    <p className="text-sm text-ink-3">None yet.</p>
                  ) : (
                    <ul className="space-y-1">
                      {homework.data!.map((h) => (
                        <li key={h.id} className="flex items-center justify-between gap-2 text-sm">
                          {asTeacher ? <Link to={`/teacher/homework/${h.id}`} className="font-medium text-accent-fg hover:underline">{h.title}</Link> : <span className="font-medium text-ink">{h.title}</span>}
                          <span className="shrink-0 text-xs text-ink-3">Due {h.due_date}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                  {asTeacher && (
                    <>
                      <Button size="sm" glow onClick={() => createHomework()}><NotebookPen size={15} /> Create homework</Button>
                      <Button size="sm" variant="secondary" onClick={() => openCopilot({ ...ctx, tool: "homework_ideas" })}><Lightbulb size={15} /> Homework ideas</Button>
                      <Button size="sm" variant="secondary" onClick={() => openCopilot({ ...ctx, tool: "worksheet" })}><FileText size={15} /> Worksheet</Button>
                      <Button size="sm" variant="secondary" onClick={() => openCopilot({ ...ctx, tool: "lesson_plan" })}><ClipboardCheck size={15} /> Lesson plan</Button>
                      <Button size="sm" variant="secondary" onClick={() => openCopilot({ ...ctx, tool: "quiz" })}><ListChecks size={15} /> Class quiz</Button>
                    </>
                  )}
                  {(role === "student" || role === "parent") && (
                    <>
                      <Button size="sm" glow onClick={() => openCopilot({ ...ctx, tool: "explain" })}><Lightbulb size={15} /> Explain it to me</Button>
                      {role === "student" && <Button size="sm" variant="secondary" onClick={() => openCopilot({ ...ctx, tool: "quiz" })}><ListChecks size={15} /> Quiz me</Button>}
                    </>
                  )}
                  {role !== "admin" && (
                    <Button size="sm" variant="secondary" onClick={() => openCopilot({ ...ctx, message: `Explain "${chapter.name}" ` })}><MessageSquareText size={15} /> Ask the Copilot</Button>
                  )}
                  {role === "admin" && subject && (
                    <Link to={`/admin/syllabus/${subject.syllabus_id}/edit`}><Button size="sm" variant="secondary"><PencilLine size={15} /> Edit syllabus</Button></Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
