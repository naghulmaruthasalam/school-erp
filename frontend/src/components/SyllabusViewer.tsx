import { useState } from "react";
import { Card, Spinner, Badge } from "./ui";
import { BookOpen, FileText, ChevronDown, Download, GraduationCap, Layers, Video, PlayCircle } from "lucide-react";

interface Chapter {
  id: string;
  name: string;
  description?: string;
  order: number;
}

interface Document {
  id: string;
  filename: string;
  type?: "pdf" | "video" | "document";
  video_url?: string;
}

interface Syllabus {
  id: string;
  title: string;
  description?: string;
  academic_year_id: string;
  class_id: string;
  subject_id: string;
  status: string;
  chapters?: Chapter[];
  documents?: Document[];
  created_at: string;
  updated_at: string;
}

interface SyllabusViewerProps {
  syllabusList: Syllabus[];
  isLoading?: boolean;
  getClassName: (id: string) => string;
  getSubjectName: (id: string) => string;
  getYearName: (id: string) => string;
  getDocumentUrl: (docId: string) => string;
  emptyMessage?: string;
}

export function SyllabusViewer({
  syllabusList,
  isLoading,
  getClassName,
  getSubjectName,
  getYearName,
  getDocumentUrl,
  emptyMessage = "No syllabus available.",
}: SyllabusViewerProps) {
  const [expandedSyllabus, setExpandedSyllabus] = useState<string | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!syllabusList || syllabusList.length === 0) {
    return (
      <Card className="text-center py-16" gradient>
        <div className="relative inline-block mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-pink-500 rounded-full blur-xl opacity-30 animate-pulse" />
          <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-violet-500/20 to-pink-500/20 flex items-center justify-center">
            <BookOpen className="w-10 h-10 text-accent-fg" />
          </div>
        </div>
        <p className="text-ink-3">{emptyMessage}</p>
      </Card>
    );
  }

  const toggleSyllabus = (id: string) => setExpandedSyllabus(expandedSyllabus === id ? null : id);
  const toggleChapter = (chapterId: string) => {
    const newExpanded = new Set(expandedChapters);
    newExpanded.has(chapterId) ? newExpanded.delete(chapterId) : newExpanded.add(chapterId);
    setExpandedChapters(newExpanded);
  };

  return (
    <div className="space-y-4">
      {syllabusList.map((syl) => (
        <div
          key={syl.id}
          className={`rounded-2xl overflow-hidden transition-all duration-300 bg-surface dark:bg-gradient-to-br dark:from-surface-2 dark:to-surface border border-line ${
            expandedSyllabus === syl.id ? "shadow-xl shadow-violet-500/10" : "hover:shadow-lg"
          }`}
        >
          <button
            onClick={() => toggleSyllabus(syl.id)}
            className="w-full p-5 flex items-center justify-between text-left transition-colors hover:bg-surface-3 dark:hover:bg-[#2D1B4E]/50"
          >
            <div className="flex items-center gap-4">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl blur-lg opacity-0 group-hover:opacity-50 transition-opacity" />
                <div className="relative w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                  <BookOpen size={26} className="text-white" />
                </div>
              </div>
              <div>
                <h3 className="font-bold text-lg text-ink dark:text-white">{syl.title}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <Badge tone="violet">{getClassName(syl.class_id)}</Badge>
                  <Badge tone="blue">{getSubjectName(syl.subject_id)}</Badge>
                  <span className="text-xs text-ink-3">{getYearName(syl.academic_year_id)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-ink-3 bg-surface-3 px-3 py-1.5 rounded-full">
                <Layers size={16} className="text-accent-fg" />
                <span>{syl.chapters?.length || 0} chapters</span>
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                expandedSyllabus === syl.id
                  ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white rotate-180"
                  : "bg-surface-3 text-ink-3"
              }`}>
                <ChevronDown size={18} />
              </div>
            </div>
          </button>

          {expandedSyllabus === syl.id && (
            <div className="border-t border-line animate-page-enter">
              {syl.description && (
                <div className="px-5 py-4 bg-gradient-to-r from-surface-2 to-white dark:from-[#2D1B4E]/50 dark:to-transparent">
                  <p className="text-sm text-ink-2">{syl.description}</p>
                </div>
              )}

              <div className="p-5 space-y-6">
                {/* Chapters */}
                <div>
                  <h4 className="font-bold mb-4 flex items-center gap-2 text-ink dark:text-white">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <GraduationCap size={16} className="text-white" />
                    </div>
                    Chapters
                  </h4>
                  {syl.chapters && syl.chapters.length > 0 ? (
                    <div className="space-y-2">
                      {syl.chapters.sort((a, b) => a.order - b.order).map((ch, idx) => (
                        <div
                          key={ch.id}
                          className="rounded-xl overflow-hidden transition-all duration-200 bg-surface-3 dark:bg-[#2D1B4E]/50 hover:bg-[#EDE8FF] dark:hover:bg-surface-3 group"
                        >
                          <button
                            onClick={() => toggleChapter(ch.id)}
                            className="w-full p-4 flex items-center justify-between text-left"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white shadow-md shadow-violet-500/30 group-hover:scale-110 transition-transform">
                                {idx + 1}
                              </div>
                              <span className="font-medium text-ink dark:text-white">{ch.name}</span>
                            </div>
                            {ch.description && (
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                                expandedChapters.has(ch.id) ? "bg-violet-500 text-white rotate-180" : "bg-surface text-ink-3"
                              }`}>
                                <ChevronDown size={14} />
                              </div>
                            )}
                          </button>
                          {ch.description && expandedChapters.has(ch.id) && (
                            <div className="px-4 pb-4 pt-0 pl-[68px] text-sm text-ink-3 animate-page-enter">
                              {ch.description}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-ink-3 italic">No chapters defined yet.</p>
                  )}
                </div>

                {/* Documents & Videos */}
                {syl.documents && syl.documents.length > 0 && (
                  <div>
                    <h4 className="font-bold mb-4 flex items-center gap-2 text-ink dark:text-white">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                        <FileText size={16} className="text-white" />
                      </div>
                      Study Materials
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {syl.documents.map((doc) => {
                        const isVideo = doc.type === "video" || doc.filename.match(/\.(mp4|webm|mov|avi)$/i) || doc.video_url;
                        return (
                          <a
                            key={doc.id}
                            href={doc.video_url || getDocumentUrl(doc.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-3 p-4 rounded-xl transition-all duration-300 group border hover:shadow-lg ${
                              isVideo
                                ? "bg-gradient-to-r from-pink-500/10 to-rose-500/10 border-pink-500/20 hover:border-pink-500/40 hover:shadow-pink-500/10"
                                : "bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-emerald-500/10"
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform ${
                              isVideo
                                ? "bg-gradient-to-br from-pink-500 to-rose-600"
                                : "bg-gradient-to-br from-emerald-500 to-teal-600"
                            }`}>
                              {isVideo ? <PlayCircle size={18} className="text-white" /> : <FileText size={18} className="text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className={`block truncate text-sm font-medium ${isVideo ? "text-pink-700 dark:text-pink-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                                {doc.filename}
                              </span>
                              {isVideo && <span className="text-xs text-pink-500/70">Video Content</span>}
                            </div>
                            {isVideo ? (
                              <Video size={18} className="text-pink-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            ) : (
                              <Download size={18} className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
