import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { BookOpen, ChevronRight, Download, ExternalLink, PlayCircle, ClipboardCheck, FileText, Lightbulb, ListChecks, MessageSquareText, NotebookPen, PencilLine } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { openCopilot } from "../copilot/events";
import Markdown from "../copilot/Markdown";
import { fetchSyllabusTree, getSyllabus, type TreeChapter, type TreeClass, type TreeSubject } from "../pages/admin/syllabusApi";
import { Badge, Button, Card, Spinner } from "./ui";
import { useLanguage } from "../i18n/LanguageContext";

export type BrowserRole = "student" | "parent" | "teacher" | "admin" | "principal";

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

/** A YouTube / Vimeo link is embedded; any other link is a video file (uploaded to the school's storage) and plays natively. */
function LessonVideo({ url }: { url: string }) {
  const { t } = useLanguage();
  const [failed, setFailed] = useState(false);
  const yt = /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/.exec(url);
  const vimeo = /vimeo\.com\/(?:video\/)?(\d+)/.exec(url);
  const embed = yt ? `https://www.youtube-nocookie.com/embed/${yt[1]}` : vimeo ? `https://player.vimeo.com/video/${vimeo[1]}` : null;
  if (embed) {
    return <iframe src={embed} title={t("lead.browser.video")} allow="fullscreen; picture-in-picture" allowFullScreen className="aspect-video w-full rounded-xl bg-black" />;
  }
  if (failed) {
    return <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-accent-fg hover:underline">{t("lead.browser.openVideo")}</a>;
  }
  return <video controls preload="metadata" playsInline src={url} onError={() => setFailed(true)} className="w-full max-h-[26rem] rounded-xl bg-black" />;
}

/** The chapter's notes from the database as a PDF to read here, open in a tab or save. */
function ChapterPdf({ syllabusId, index, language, fallback }: { syllabusId: string; index: number; language: string; fallback: React.ReactNode }) {
  const { t } = useLanguage();
  const pdf = useQuery({
    queryKey: ["syllabus", "pdf", syllabusId, index, language],
    queryFn: async () => (await api.get<Blob>(`/syllabus/${syllabusId}/chapters/${index}/pdf`, { params: { lang: language }, responseType: "blob" })).data,
    enabled: !import.meta.env.VITE_STANDALONE_DEMO,
    retry: false,
    staleTime: 5 * 60_000,
  });
  const url = useMemo(() => (pdf.data ? URL.createObjectURL(pdf.data) : null), [pdf.data]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  if (import.meta.env.VITE_STANDALONE_DEMO) return <>{fallback}</>;
  if (pdf.isLoading) return <div className="flex justify-center py-8"><Spinner /></div>;
  if (!url) return <p className="rounded-xl bg-surface p-3 text-sm text-ink-3">{t("lead.browser.pdfFailed")}</p>;
  return (
    <div className="space-y-2" data-testid="chapter-pdf">
      <div className="flex flex-wrap gap-2">
        <a href={url} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="secondary" type="button"><ExternalLink size={15} /> {t("lead.browser.openPdf")}</Button></a>
        <a href={url} download={`chapter-${index + 1}.pdf`}><Button size="sm" variant="secondary" type="button"><Download size={15} /> {t("lead.browser.downloadPdf")}</Button></a>
      </div>
      <iframe src={url} title={t("lead.browser.pdfNotes")} className="h-[32rem] w-full rounded-xl bg-white" />
      <details className="rounded-xl bg-surface p-3 text-sm">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-ink-3">{t("lead.browser.readAsText")}</summary>
        <div className="mt-2">{fallback}</div>
      </details>
    </div>
  );
}

/** Class -> Subject -> Chapter, read from the syllabus in the database and scoped to what the user may see. */
export default function SyllabusBrowser({ role }: { role: BrowserRole }) {
  const { t, te, fmtDate, fmtNumber, language } = useLanguage();
  const navigate = useNavigate();
  const tree = useQuery({ queryKey: ["syllabus", "tree", language], queryFn: fetchSyllabusTree });
  const classes = useMemo(() => (tree.data ?? []).filter((c) => c.subjects.length > 0), [tree.data]);

  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [view, setView] = useState<"pdf" | "video">("pdf");

  const cls: TreeClass | undefined = classes.find((c) => c.id === classId) ?? classes[0];
  const subject: TreeSubject | undefined = cls?.subjects.find((s) => s.id === subjectId) ?? cls?.subjects[0];
  const chapter: TreeChapter | undefined = subject?.chapters.find((c) => c.id === chapterId);

  // Keep the selection valid when the tree loads or the class changes.
  useEffect(() => {
    if (cls && cls.id !== classId) setClassId(cls.id);
    if (subject && subject.id !== subjectId) setSubjectId(subject.id);
  }, [cls, subject, classId, subjectId]);

  // Opening a subject shows its first chapter straight away, so the content is one click (not two) from the subject.
  useEffect(() => {
    if (subject && !chapter && subject.chapters.length > 0) setChapterId(subject.chapters[0].id);
  }, [subject, chapter]);

  useEffect(() => { setView("pdf"); }, [chapter?.id]);

  const detail = useQuery({
    queryKey: ["syllabus", "detail", subject?.syllabus_id, language],
    queryFn: () => getSyllabus(subject!.syllabus_id),
    enabled: !!chapter && !!subject,
  });
  const full = detail.data?.chapters.find((c) => c.id === chapter?.id);
  const homework = useChapterHomework(subject?.id, chapter?.key ?? chapter?.name);

  if (tree.isLoading) return <Card className="flex justify-center py-10"><Spinner size="lg" /></Card>;
  if (tree.isError) return <Card className="py-8 text-center text-sm text-ink-3">{t("shell.syllabusBrowser.loadFailed")}</Card>;
  if (classes.length === 0) {
    return (
      <Card className="py-10 text-center">
        <BookOpen className="mx-auto mb-3 text-ink-3" size={28} />
        <p className="text-sm font-semibold text-ink">{t("shell.syllabusBrowser.noneTitle")}</p>
        <p className="text-xs text-ink-3">
          {role === "student" || role === "parent" ? t("shell.syllabusBrowser.noneStudent") : t("shell.syllabusBrowser.noneStaff")}
        </p>
      </Card>
    );
  }

  const ctx = { classId: cls!.id, subjectId: subject?.id, chapter: chapter?.key ?? chapter?.name };
  const asTeacher = role === "teacher";

  function createHomework(prefill?: { title?: string; description?: string }) {
    navigate("/teacher/homework", {
      state: { prefill: { class_id: cls!.id, subject_id: subject!.id, chapter: chapter!.key ?? chapter!.name, ...prefill } },
    });
  }

  return (
    <Card className="mb-6" gradient>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="lg-icon !h-9 !w-9 !rounded-[12px]"><BookOpen size={18} /></span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">{t("shell.syllabusBrowser.title")}</h2>
          <p className="text-xs text-ink-3">{asTeacher ? t("shell.syllabusBrowser.pickTeacher") : t("shell.syllabusBrowser.pick")}</p>
        </div>
      </div>

      <div className="space-y-3">
        {(
          <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("shell.syllabusBrowser.class")}>
            {classes.map((c) => (
              <button key={c.id} role="tab" aria-selected={c.id === cls!.id} className={clsx("lg-chip cursor-pointer", c.id === cls!.id && "!bg-accent !text-white")}
                onClick={() => { setClassId(c.id); setSubjectId(""); setChapterId(""); }}>
                {te("class", c.name)}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("shell.syllabusBrowser.subject")}>
          {cls!.subjects.map((s) => (
            <button key={s.syllabus_id} role="tab" aria-selected={s.syllabus_id === subject?.syllabus_id}
              className={clsx("lg-chip cursor-pointer", s.syllabus_id === subject?.syllabus_id && "!bg-accent !text-white")}
              onClick={() => { setSubjectId(s.id); setChapterId(""); }}>
              {te("subject", s.name)}
            </button>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <div className="grid content-start gap-2">
            {subject && subject.chapters.length === 0 && <p className="text-sm text-ink-3">{t("shell.syllabusBrowser.noChapters")}</p>}
            {subject?.chapters.map((c, i) => (
              <button key={c.id} onClick={() => setChapterId(c.id)} aria-current={c.id === chapter?.id} className={clsx("glass-row !items-start text-start", c.id === chapter?.id && "ring-2 ring-accent/50")}>
                <span className="lg-icon !h-8 !w-8 shrink-0 !rounded-[10px] text-xs font-semibold">{fmtNumber(i + 1)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">{c.name}{c.has_video && <PlayCircle size={14} className="shrink-0 text-accent-fg" aria-label={t("lead.browser.video")} />}</span>
                  <span className="block text-xs text-ink-3">
                    {c.topics.length > 0 ? t("shell.syllabusBrowser.topicCount", { n: fmtNumber(c.topics.length) }) : c.description ?? t("shell.syllabusBrowser.chapter")}
                  </span>
                </span>
                <ChevronRight size={16} className="mt-2 shrink-0 text-ink-3 rtl:-scale-x-100" />
              </button>
            ))}
          </div>

          <div className="min-w-0">
            {!chapter ? (
              <div className="grid h-full min-h-32 place-items-center rounded-2xl bg-surface-3 p-6 text-center text-sm text-ink-3">
                {t("shell.syllabusBrowser.choose")}
              </div>
            ) : (
              <div className="space-y-4 rounded-2xl bg-surface-3 p-4" data-testid="chapter-detail">
                <div>
                  <h3 className="text-base font-semibold text-ink">{chapter.name}</h3>
                  {chapter.description && <p className="mt-0.5 text-sm text-ink-2">{chapter.description}</p>}
                </div>

                {chapter.topics.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">{t("shell.syllabusBrowser.topics")}</p>
                    <div className="flex flex-wrap gap-1.5">{chapter.topics.map((topic) => <Badge key={topic} tone="blue">{topic}</Badge>)}</div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("lead.browser.pdfNotes")}>
                  <button type="button" role="tab" aria-selected={view === "pdf"} data-testid="show-pdf"
                    className={clsx("lg-chip cursor-pointer !px-4 !py-2 text-sm", view === "pdf" && "!bg-accent !text-white")} onClick={() => setView("pdf")}>
                    <FileText size={16} /> <span data-no-translate>{t("lead.browser.pdf")}</span>
                  </button>
                  <button type="button" role="tab" aria-selected={view === "video"} data-testid="show-video"
                    className={clsx("lg-chip cursor-pointer !px-4 !py-2 text-sm", view === "video" && "!bg-accent !text-white", !full?.video_url && !detail.isLoading && "opacity-60")} onClick={() => setView("video")}>
                    <PlayCircle size={16} /> {t("lead.browser.video")}
                    {full?.duration_minutes ? <span className="font-normal opacity-80">· {t("lead.browser.minutes", { n: fmtNumber(full.duration_minutes) })}</span> : null}
                  </button>
                </div>

                {detail.isLoading && <Spinner size="sm" />}
                {view === "video" && (
                  full?.video_url ? (
                    <div data-testid="chapter-video">
                      {full.video_language && full.video_language !== language && (
                        <p className="mb-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                          {t(full.video_language === "ar" ? "lead.browser.videoOnlyArabic" : "lead.browser.videoOnlyEnglish")}
                        </p>
                      )}
                      {/* keyed by link, so switching language swaps the video instead of reusing the player */}
                      <LessonVideo key={full.video_url} url={full.video_url} />
                    </div>
                  ) : !detail.isLoading && <p className="rounded-xl bg-surface p-3 text-sm text-ink-3" data-testid="no-video">{t("lead.browser.noVideo")}</p>
                )}

                {view === "pdf" && (full?.content || chapter.topics.length > 0) ? (
                  <div>
                    {full?.content_language && full.content_language !== language && (
                      <p className="mb-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                        {t(full.content_language === "ar" ? "lead.browser.onlyArabic" : "lead.browser.onlyEnglish")}
                      </p>
                    )}
                    <ChapterPdf syllabusId={subject!.syllabus_id} index={Number(chapter.id.split("-").pop())} language={language}
                      fallback={
                        <div className="max-h-[28rem] overflow-y-auto rounded-xl bg-surface p-3 text-sm leading-relaxed text-ink-2" dir={full?.content_language === "ar" ? "rtl" : "ltr"}>
                          <Markdown>{full?.content ?? ""}</Markdown>
                        </div>
                      } />
                  </div>
                ) : view === "pdf" && !detail.isLoading && (
                  <p className="rounded-xl bg-surface p-3 text-sm text-ink-3">{t("lead.browser.noNotes")}</p>
                )}

                {(detail.data?.documents ?? []).length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">{t("lead.browser.materials")}</p>
                    <ul className="space-y-1">
                      {detail.data!.documents.map((d) => (
                        <li key={d.id}>
                          <button type="button" className="text-sm font-medium text-accent-fg hover:underline" dir="auto"
                            onClick={async () => {
                              const { data } = await api.get<{ url: string }>(`/syllabus/documents/${d.id}/url`);
                              window.open(data.url, "_blank", "noopener");
                            }}>
                            {d.filename}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">{t("shell.syllabusBrowser.homework")}</p>
                  {homework.isLoading ? <Spinner size="sm" /> : (homework.data ?? []).length === 0 ? (
                    <p className="text-sm text-ink-3">{t("shell.syllabusBrowser.none")}</p>
                  ) : (
                    <ul className="space-y-1">
                      {homework.data!.map((h) => (
                        <li key={h.id} className="flex items-center justify-between gap-2 text-sm">
                          {asTeacher ? <Link to={`/teacher/homework/${h.id}`} className="font-medium text-accent-fg hover:underline">{h.title}</Link> : <span className="font-medium text-ink">{h.title}</span>}
                          <span className="shrink-0 text-xs text-ink-3">{t("shell.syllabusBrowser.due", { date: fmtDate(h.due_date) })}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                  {asTeacher && (
                    <>
                      <Button size="sm" glow onClick={() => createHomework()}><NotebookPen size={15} /> {t("shell.syllabusBrowser.createHomework")}</Button>
                      <Button size="sm" variant="secondary" onClick={() => openCopilot({ ...ctx, tool: "homework_ideas" })}><Lightbulb size={15} /> {t("shell.syllabusBrowser.homeworkIdeas")}</Button>
                      <Button size="sm" variant="secondary" onClick={() => openCopilot({ ...ctx, tool: "worksheet" })}><FileText size={15} /> {t("shell.syllabusBrowser.worksheet")}</Button>
                      <Button size="sm" variant="secondary" onClick={() => openCopilot({ ...ctx, tool: "lesson_plan" })}><ClipboardCheck size={15} /> {t("shell.syllabusBrowser.lessonPlan")}</Button>
                      <Button size="sm" variant="secondary" onClick={() => openCopilot({ ...ctx, tool: "quiz" })}><ListChecks size={15} /> {t("shell.syllabusBrowser.classQuiz")}</Button>
                    </>
                  )}
                  {(role === "student" || role === "parent") && (
                    <>
                      <Button size="sm" glow onClick={() => openCopilot({ ...ctx, tool: "explain" })}><Lightbulb size={15} /> {t("shell.syllabusBrowser.explain")}</Button>
                      {role === "student" && <Button size="sm" variant="secondary" onClick={() => openCopilot({ ...ctx, tool: "quiz" })}><ListChecks size={15} /> {t("shell.syllabusBrowser.quizMe")}</Button>}
                    </>
                  )}
                  {role !== "admin" && (
                    <Button size="sm" variant="secondary" onClick={() => openCopilot({ ...ctx, message: `Explain "${chapter.name}" ` })}><MessageSquareText size={15} /> {t("shell.syllabusBrowser.askCopilot")}</Button>
                  )}
                  {role === "admin" && subject && (
                    <Link to={`/admin/syllabus/${subject.syllabus_id}/edit`}><Button size="sm" variant="secondary"><PencilLine size={15} /> {t("shell.syllabusBrowser.edit")}</Button></Link>
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
