import { useState } from "react";
import { Card, PageHeader, Spinner } from "../../components/ui";
import { api } from "../../api/client";

type Tab = "lesson-plan" | "question-paper" | "worksheet";

export default function TeacherCopilot() {
  const [activeTab, setActiveTab] = useState<Tab>("lesson-plan");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Lesson Plan state
  const [lpChapter, setLpChapter] = useState("");
  const [lpSubject, setLpSubject] = useState("Mathematics");
  const [lpGrade, setLpGrade] = useState("6");

  // Question Paper state
  const [qpSubject, setQpSubject] = useState("Mathematics");
  const [qpGrade, setQpGrade] = useState("6");
  const [qpChapters, setQpChapters] = useState("");
  const [qpMarks, setQpMarks] = useState("100");
  const [qpDuration, setQpDuration] = useState("180");

  // Worksheet state
  const [wsTopic, setWsTopic] = useState("");
  const [wsSubject, setWsSubject] = useState("Mathematics");
  const [wsGrade, setWsGrade] = useState("6");
  const [wsQuestions, setWsQuestions] = useState("10");
  const [wsDifficulty, setWsDifficulty] = useState("medium");

  const extractTopics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/teacher-copilot/lesson-plan/extract-topics", {
        chapter_name: lpChapter,
        subject: lpSubject,
        grade: lpGrade,
      });
      setResult({ type: "topics", data: res.data });
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to extract topics");
    } finally {
      setLoading(false);
    }
  };

  const generateQuestionPaper = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/teacher-copilot/question-paper/generate", {
        board: "CBSE",
        grade: qpGrade,
        subject: qpSubject,
        chapters: qpChapters.split(",").map(c => c.trim()),
        total_marks: parseInt(qpMarks),
        duration_minutes: parseInt(qpDuration),
      });
      setResult({ type: "question-paper", data: res.data });
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to generate question paper");
    } finally {
      setLoading(false);
    }
  };

  const generateWorksheet = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/teacher-copilot/worksheet/generate", {
        grade: wsGrade,
        subject: wsSubject,
        topic: wsTopic,
        num_questions: parseInt(wsQuestions),
        difficulty: wsDifficulty,
      });
      setResult({ type: "worksheet", data: res.data });
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to generate worksheet");
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: "lesson-plan" as Tab, label: "Lesson Plan", icon: "📚" },
    { id: "question-paper" as Tab, label: "Question Paper", icon: "📝" },
    { id: "worksheet" as Tab, label: "Worksheet", icon: "📋" },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Teacher Copilot"
        subtitle="AI-powered tools for lesson planning, question papers & worksheets"
      />

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setResult(null); setError(null); }}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              activeTab === tab.id
                ? "bg-gradient-to-r from-[#6D28D9] to-[#8B5CF6] text-white shadow-lg"
                : "bg-white dark:bg-[#1B1230] text-[#7C6F95] hover:bg-[#F7F5FF] dark:hover:bg-[#231640]"
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <Card>
          {activeTab === "lesson-plan" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[#24113F] dark:text-white">Generate Lesson Plan</h3>
              <div>
                <label className="block text-sm font-medium text-[#7C6F95] mb-1">Chapter Name</label>
                <input
                  type="text"
                  value={lpChapter}
                  onChange={(e) => setLpChapter(e.target.value)}
                  placeholder="e.g., Fractions and Decimals"
                  className="w-full px-4 py-2 rounded-xl border border-[#E5DDF5] dark:border-[#2D1B4E] bg-white dark:bg-[#1B1230] text-[#24113F] dark:text-white focus:ring-2 focus:ring-[#6D28D9]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#7C6F95] mb-1">Subject</label>
                  <select
                    value={lpSubject}
                    onChange={(e) => setLpSubject(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-[#E5DDF5] dark:border-[#2D1B4E] bg-white dark:bg-[#1B1230] text-[#24113F] dark:text-white"
                  >
                    <option>Mathematics</option>
                    <option>Science</option>
                    <option>Social Studies</option>
                    <option>English</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#7C6F95] mb-1">Grade</label>
                  <select
                    value={lpGrade}
                    onChange={(e) => setLpGrade(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-[#E5DDF5] dark:border-[#2D1B4E] bg-white dark:bg-[#1B1230] text-[#24113F] dark:text-white"
                  >
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(g => (
                      <option key={g} value={g}>Grade {g}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={extractTopics}
                disabled={loading || !lpChapter}
                className="w-full py-3 bg-gradient-to-r from-[#6D28D9] to-[#8B5CF6] text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
              >
                {loading ? <Spinner /> : "Extract Topics"}
              </button>
            </div>
          )}

          {activeTab === "question-paper" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[#24113F] dark:text-white">Generate Question Paper</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#7C6F95] mb-1">Subject</label>
                  <select
                    value={qpSubject}
                    onChange={(e) => setQpSubject(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-[#E5DDF5] dark:border-[#2D1B4E] bg-white dark:bg-[#1B1230] text-[#24113F] dark:text-white"
                  >
                    <option>Mathematics</option>
                    <option>Science</option>
                    <option>Social Studies</option>
                    <option>English</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#7C6F95] mb-1">Grade</label>
                  <select
                    value={qpGrade}
                    onChange={(e) => setQpGrade(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-[#E5DDF5] dark:border-[#2D1B4E] bg-white dark:bg-[#1B1230] text-[#24113F] dark:text-white"
                  >
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(g => (
                      <option key={g} value={g}>Grade {g}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#7C6F95] mb-1">Chapters (comma separated)</label>
                <input
                  type="text"
                  value={qpChapters}
                  onChange={(e) => setQpChapters(e.target.value)}
                  placeholder="e.g., Fractions, Decimals, Geometry"
                  className="w-full px-4 py-2 rounded-xl border border-[#E5DDF5] dark:border-[#2D1B4E] bg-white dark:bg-[#1B1230] text-[#24113F] dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#7C6F95] mb-1">Total Marks</label>
                  <input
                    type="number"
                    value={qpMarks}
                    onChange={(e) => setQpMarks(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-[#E5DDF5] dark:border-[#2D1B4E] bg-white dark:bg-[#1B1230] text-[#24113F] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#7C6F95] mb-1">Duration (mins)</label>
                  <input
                    type="number"
                    value={qpDuration}
                    onChange={(e) => setQpDuration(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-[#E5DDF5] dark:border-[#2D1B4E] bg-white dark:bg-[#1B1230] text-[#24113F] dark:text-white"
                  />
                </div>
              </div>
              <button
                onClick={generateQuestionPaper}
                disabled={loading || !qpChapters}
                className="w-full py-3 bg-gradient-to-r from-[#6D28D9] to-[#8B5CF6] text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
              >
                {loading ? <Spinner /> : "Generate Question Paper"}
              </button>
            </div>
          )}

          {activeTab === "worksheet" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-[#24113F] dark:text-white">Generate Worksheet</h3>
              <div>
                <label className="block text-sm font-medium text-[#7C6F95] mb-1">Topic</label>
                <input
                  type="text"
                  value={wsTopic}
                  onChange={(e) => setWsTopic(e.target.value)}
                  placeholder="e.g., Addition of Fractions"
                  className="w-full px-4 py-2 rounded-xl border border-[#E5DDF5] dark:border-[#2D1B4E] bg-white dark:bg-[#1B1230] text-[#24113F] dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#7C6F95] mb-1">Subject</label>
                  <select
                    value={wsSubject}
                    onChange={(e) => setWsSubject(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-[#E5DDF5] dark:border-[#2D1B4E] bg-white dark:bg-[#1B1230] text-[#24113F] dark:text-white"
                  >
                    <option>Mathematics</option>
                    <option>Science</option>
                    <option>Social Studies</option>
                    <option>English</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#7C6F95] mb-1">Grade</label>
                  <select
                    value={wsGrade}
                    onChange={(e) => setWsGrade(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-[#E5DDF5] dark:border-[#2D1B4E] bg-white dark:bg-[#1B1230] text-[#24113F] dark:text-white"
                  >
                    {[1,2,3,4,5,6,7,8,9,10,11,12].map(g => (
                      <option key={g} value={g}>Grade {g}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#7C6F95] mb-1">Questions</label>
                  <input
                    type="number"
                    value={wsQuestions}
                    onChange={(e) => setWsQuestions(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-[#E5DDF5] dark:border-[#2D1B4E] bg-white dark:bg-[#1B1230] text-[#24113F] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#7C6F95] mb-1">Difficulty</label>
                  <select
                    value={wsDifficulty}
                    onChange={(e) => setWsDifficulty(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-[#E5DDF5] dark:border-[#2D1B4E] bg-white dark:bg-[#1B1230] text-[#24113F] dark:text-white"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>
              <button
                onClick={generateWorksheet}
                disabled={loading || !wsTopic}
                className="w-full py-3 bg-gradient-to-r from-[#6D28D9] to-[#8B5CF6] text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
              >
                {loading ? <Spinner /> : "Generate Worksheet"}
              </button>
            </div>
          )}
        </Card>

        {/* Result Display */}
        <Card className="max-h-[600px] overflow-y-auto">
          <h3 className="text-lg font-semibold text-[#24113F] dark:text-white mb-4">Generated Content</h3>

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Spinner />
              <p className="mt-4 text-[#7C6F95]">Generating with AI...</p>
            </div>
          )}

          {!loading && !error && !result && (
            <div className="flex flex-col items-center justify-center py-12 text-[#7C6F95]">
              <span className="text-4xl mb-4">✨</span>
              <p>Generated content will appear here</p>
            </div>
          )}

          {result?.type === "topics" && (
            <div className="space-y-3">
              <h4 className="font-medium text-[#6D28D9]">Extracted Topics:</h4>
              <ul className="space-y-2">
                {result.data.topics?.map((topic: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 p-3 bg-[#F7F5FF] dark:bg-[#231640] rounded-lg">
                    <span className="text-[#6D28D9] font-bold">{i + 1}.</span>
                    <span className="text-[#24113F] dark:text-white">{topic}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result?.type === "question-paper" && (
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-[#6D28D9]/10 to-[#8B5CF6]/10 rounded-xl">
                <h4 className="font-bold text-[#6D28D9]">{result.data.title}</h4>
                <p className="text-sm text-[#7C6F95]">
                  Total Marks: {result.data.total_marks} | Duration: {result.data.duration_minutes} mins
                </p>
              </div>
              {result.data.general_instructions?.length > 0 && (
                <div>
                  <h5 className="font-medium text-[#24113F] dark:text-white mb-2">Instructions:</h5>
                  <ul className="text-sm text-[#7C6F95] list-disc pl-5 space-y-1">
                    {result.data.general_instructions.map((ins: string, i: number) => (
                      <li key={i}>{ins}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.data.sections?.map((section: any, si: number) => (
                <div key={si} className="border-t border-[#E5DDF5] dark:border-[#2D1B4E] pt-4">
                  <h5 className="font-semibold text-[#6D28D9]">{section.section_name}: {section.section_label}</h5>
                  <p className="text-xs text-[#7C6F95] mb-3">{section.instructions}</p>
                  {section.questions?.map((q: any, qi: number) => (
                    <div key={qi} className="mb-3 p-3 bg-[#F7F5FF] dark:bg-[#231640] rounded-lg">
                      <p className="font-medium text-[#24113F] dark:text-white">
                        Q{q.question_number}. {q.question_text} <span className="text-[#7C6F95]">({q.marks} marks)</span>
                      </p>
                      {q.options && (
                        <ul className="mt-2 pl-4 text-sm text-[#7C6F95]">
                          {q.options.map((opt: string, oi: number) => (
                            <li key={oi}>{String.fromCharCode(65 + oi)}. {opt}</li>
                          ))}
                        </ul>
                      )}
                      {q.answer_key && (
                        <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                          <strong>Answer:</strong> {q.answer_key}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {result?.type === "worksheet" && (
            <div className="space-y-4">
              <div className="p-4 bg-gradient-to-r from-[#6D28D9]/10 to-[#8B5CF6]/10 rounded-xl">
                <h4 className="font-bold text-[#6D28D9]">{result.data.title}</h4>
                <p className="text-sm text-[#7C6F95]">{result.data.instructions}</p>
              </div>
              {result.data.questions?.map((q: any, i: number) => (
                <div key={i} className="p-3 bg-[#F7F5FF] dark:bg-[#231640] rounded-lg">
                  <p className="font-medium text-[#24113F] dark:text-white">
                    Q{q.question_number}. {q.question_text}
                  </p>
                  {q.options && (
                    <ul className="mt-2 pl-4 text-sm text-[#7C6F95]">
                      {q.options.map((opt: string, oi: number) => (
                        <li key={oi}>{String.fromCharCode(65 + oi)}. {opt}</li>
                      ))}
                    </ul>
                  )}
                  {q.hint && <p className="mt-1 text-xs text-[#6D28D9]">Hint: {q.hint}</p>}
                  <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                    <strong>Answer:</strong> {q.answer}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
