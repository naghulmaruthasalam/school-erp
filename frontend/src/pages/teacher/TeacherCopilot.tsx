import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader, Spinner, Button } from "../../components/ui";
import { api } from "../../api/client";
import { BookOpen, FileText, ClipboardList, Sparkles, Wand2, Download, Copy, Check } from "lucide-react";

type Tab = "lesson-plan" | "question-paper" | "worksheet";

interface CurriculumOptions {
  grades: number[];
  subjects_by_grade: Record<number, string[]>;
  chapters_by_grade_subject: Record<string, { unit_number: number; title_en: string; title_ar: string; id: string }[]>;
}

export default function TeacherCopilot() {
  const [activeTab, setActiveTab] = useState<Tab>("lesson-plan");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Shared state
  const [grade, setGrade] = useState<number>(6);
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [chapterId, setChapterId] = useState("");

  // Question Paper specific
  const [qpMarks, setQpMarks] = useState("100");
  const [qpDuration, setQpDuration] = useState("180");
  const [qpMcq, setQpMcq] = useState("10");
  const [qpShort, setQpShort] = useState("5");
  const [qpLong, setQpLong] = useState("3");

  // Worksheet specific
  const [wsQuestions, setWsQuestions] = useState("10");
  const [wsDifficulty, setWsDifficulty] = useState("medium");
  const [wsIncludeAnswers, setWsIncludeAnswers] = useState(true);

  // Fetch curriculum options
  const { data: curriculum, isLoading: loadingCurriculum } = useQuery({
    queryKey: ["teacher-copilot", "curriculum-options"],
    queryFn: async () => {
      const res = await api.get<CurriculumOptions>("/teacher-copilot/curriculum-options");
      return res.data;
    },
  });

  // Set initial subject when curriculum loads
  useEffect(() => {
    if (curriculum && !subject) {
      const subjects = curriculum.subjects_by_grade[grade] || [];
      if (subjects.length > 0) setSubject(subjects[0]);
    }
  }, [curriculum, grade, subject]);

  // Get available subjects for selected grade
  const subjects = curriculum?.subjects_by_grade[grade] || [];

  // Get available chapters for selected grade/subject
  const chaptersKey = `${grade}_${subject}`;
  const chapters = curriculum?.chapters_by_grade_subject[chaptersKey] || [];

  // Reset chapter when grade/subject changes
  useEffect(() => {
    setChapter("");
    setChapterId("");
  }, [grade, subject]);

  const extractTopics = async () => {
    if (!chapter) {
      setError("Please select a chapter");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Get chapter content if we have an ID
      let chapterContent = "";
      if (chapterId) {
        const contentRes = await api.get(`/teacher-copilot/curriculum-content/${chapterId}`);
        chapterContent = contentRes.data.full_text || "";
      }

      const res = await api.post("/teacher-copilot/lesson-plan/extract-topics", {
        chapter_name: chapter,
        chapter_content: chapterContent,
        subject,
        grade: String(grade),
      });
      setResult({ type: "topics", data: res.data });
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to extract topics");
    } finally {
      setLoading(false);
    }
  };

  const generateQuestionPaper = async () => {
    if (!chapter) {
      setError("Please select a chapter");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/teacher-copilot/question-paper/generate", {
        board: "CBSE",
        grade: String(grade),
        subject,
        chapters: [chapter],
        total_marks: parseInt(qpMarks),
        duration_minutes: parseInt(qpDuration),
        question_distribution: {
          mcq: parseInt(qpMcq),
          short_answer: parseInt(qpShort),
          long_answer: parseInt(qpLong),
        },
      });
      setResult({ type: "question-paper", data: res.data });
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to generate question paper");
    } finally {
      setLoading(false);
    }
  };

  const generateWorksheet = async () => {
    if (!chapter) {
      setError("Please select a chapter");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/teacher-copilot/worksheet/generate", {
        grade: String(grade),
        subject,
        topic: chapter,
        num_questions: parseInt(wsQuestions),
        difficulty: wsDifficulty,
        include_answers: wsIncludeAnswers,
      });
      setResult({ type: "worksheet", data: res.data });
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to generate worksheet");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (result?.data) {
      const text = JSON.stringify(result.data, null, 2);
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const tabs = [
    { id: "lesson-plan" as Tab, label: "Lesson Plan", icon: BookOpen, color: "from-violet-500 to-purple-600" },
    { id: "question-paper" as Tab, label: "Question Paper", icon: FileText, color: "from-blue-500 to-cyan-500" },
    { id: "worksheet" as Tab, label: "Worksheet", icon: ClipboardList, color: "from-emerald-500 to-teal-500" },
  ];

  if (loadingCurriculum) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Teacher Copilot"
        subtitle="AI-powered tools for lesson planning, question papers & worksheets"
      />

      {/* Tabs */}
      <div className="flex gap-3 mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setResult(null); setError(null); }}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all duration-300 ${
                activeTab === tab.id
                  ? `bg-gradient-to-r ${tab.color} text-white shadow-lg shadow-${tab.color.split("-")[1]}-500/30`
                  : "bg-white dark:bg-surface border border-line hover:border-accent-fg/30 text-ink-2 hover:text-ink"
              }`}
            >
              <Icon className="w-5 h-5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Panel - Form */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-ink dark:text-white mb-4 flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-violet-500" />
              {activeTab === "lesson-plan" && "Generate Lesson Plan"}
              {activeTab === "question-paper" && "Generate Question Paper"}
              {activeTab === "worksheet" && "Generate Worksheet"}
            </h3>

            {/* Common Fields */}
            <div className="space-y-4">
              {/* Grade */}
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1.5">Grade</label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(parseInt(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl border border-line bg-white dark:bg-surface focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                >
                  {curriculum?.grades.map((g) => (
                    <option key={g} value={g}>Grade {g}</option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1.5">Subject</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-line bg-white dark:bg-surface focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                >
                  {subjects.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Chapter */}
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1.5">Chapter</label>
                <select
                  value={chapter}
                  onChange={(e) => {
                    const selected = chapters.find(c => c.title_en === e.target.value);
                    setChapter(e.target.value);
                    setChapterId(selected?.id || "");
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-line bg-white dark:bg-surface focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                >
                  <option value="">Select a chapter</option>
                  {chapters.map((c) => (
                    <option key={c.id} value={c.title_en}>
                      Unit {c.unit_number}: {c.title_en}
                    </option>
                  ))}
                </select>
              </div>

              {/* Question Paper specific fields */}
              {activeTab === "question-paper" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1.5">Total Marks</label>
                      <input
                        type="number"
                        value={qpMarks}
                        onChange={(e) => setQpMarks(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-line bg-white dark:bg-surface focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1.5">Duration (min)</label>
                      <input
                        type="number"
                        value={qpDuration}
                        onChange={(e) => setQpDuration(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-line bg-white dark:bg-surface focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-ink-2 mb-1">MCQs</label>
                      <input
                        type="number"
                        value={qpMcq}
                        onChange={(e) => setQpMcq(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-line bg-white dark:bg-surface text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-2 mb-1">Short Ans</label>
                      <input
                        type="number"
                        value={qpShort}
                        onChange={(e) => setQpShort(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-line bg-white dark:bg-surface text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-2 mb-1">Long Ans</label>
                      <input
                        type="number"
                        value={qpLong}
                        onChange={(e) => setQpLong(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-line bg-white dark:bg-surface text-sm"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Worksheet specific fields */}
              {activeTab === "worksheet" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1.5">Questions</label>
                      <input
                        type="number"
                        value={wsQuestions}
                        onChange={(e) => setWsQuestions(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-line bg-white dark:bg-surface focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink-2 mb-1.5">Difficulty</label>
                      <select
                        value={wsDifficulty}
                        onChange={(e) => setWsDifficulty(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-line bg-white dark:bg-surface focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wsIncludeAnswers}
                      onChange={(e) => setWsIncludeAnswers(e.target.checked)}
                      className="w-4 h-4 rounded border-line text-emerald-500 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-ink-2">Include answer key</span>
                  </label>
                </>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 text-sm">
                  {error}
                </div>
              )}

              <Button
                onClick={() => {
                  if (activeTab === "lesson-plan") extractTopics();
                  else if (activeTab === "question-paper") generateQuestionPaper();
                  else generateWorksheet();
                }}
                disabled={loading || !chapter}
                className={`w-full py-3 flex items-center justify-center gap-2 ${
                  activeTab === "lesson-plan" ? "bg-gradient-to-r from-violet-500 to-purple-600" :
                  activeTab === "question-paper" ? "bg-gradient-to-r from-blue-500 to-cyan-500" :
                  "bg-gradient-to-r from-emerald-500 to-teal-500"
                } text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all`}
              >
                {loading ? <Spinner className="!w-5 !h-5" /> : <Sparkles className="w-5 h-5" />}
                {loading ? "Generating..." : "Generate"}
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Panel - Results */}
        <div className="lg:col-span-3">
          <Card className="p-6 min-h-[400px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-ink dark:text-white">Generated Content</h3>
              {result && (
                <div className="flex gap-2">
                  <button
                    onClick={copyToClipboard}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title="Copy to clipboard"
                  >
                    {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-ink-3" />}
                  </button>
                  <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="Download">
                    <Download className="w-5 h-5 text-ink-3" />
                  </button>
                </div>
              )}
            </div>

            {!result ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-500/20 dark:to-purple-500/20 flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-violet-500" />
                </div>
                <p className="text-ink-3 mb-2">Generated content will appear here</p>
                <p className="text-sm text-ink-4">Select grade, subject, and chapter, then click Generate</p>
              </div>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {result.type === "topics" && result.data.topics && (
                  <div>
                    <h4 className="text-violet-600 dark:text-violet-400 mb-3">Extracted Topics</h4>
                    <ul className="space-y-2">
                      {result.data.topics.map((topic: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center text-xs font-medium flex-shrink-0">
                            {i + 1}
                          </span>
                          <span>{topic}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.type === "question-paper" && (
                  <div className="space-y-6">
                    <div className="text-center border-b pb-4 mb-4">
                      <h4 className="text-xl font-bold">{subject} - Grade {grade}</h4>
                      <p className="text-sm text-ink-3">Question Paper | Total Marks: {qpMarks} | Duration: {qpDuration} min</p>
                    </div>
                    <pre className="text-sm bg-gray-50 dark:bg-gray-800 p-4 rounded-lg overflow-auto whitespace-pre-wrap">
                      {typeof result.data === "string" ? result.data : JSON.stringify(result.data, null, 2)}
                    </pre>
                  </div>
                )}

                {result.type === "worksheet" && (
                  <div className="space-y-6">
                    <div className="text-center border-b pb-4 mb-4">
                      <h4 className="text-xl font-bold">{subject} Worksheet - Grade {grade}</h4>
                      <p className="text-sm text-ink-3">Topic: {chapter} | Difficulty: {wsDifficulty}</p>
                    </div>
                    <pre className="text-sm bg-gray-50 dark:bg-gray-800 p-4 rounded-lg overflow-auto whitespace-pre-wrap">
                      {typeof result.data === "string" ? result.data : JSON.stringify(result.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
