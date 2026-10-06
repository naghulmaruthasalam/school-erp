import { useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../i18n/LanguageContext";
import { LanguageSwitcherButtons } from "../../components/LanguageSwitcher";
import {
  FileText,
  Download,
  Eye,
  BookOpen,
  Calculator,
  Globe2,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";

interface SyllabusDocument {
  id: string;
  titleEn: string;
  titleAr: string;
  classEn: string;
  classAr: string;
  subjectEn: string;
  subjectAr: string;
  pdfUrl: string;
  icon: typeof FileText;
  color: string;
}

const SYLLABUS_DOCUMENTS: SyllabusDocument[] = [
  {
    id: "cls6-social-p1",
    titleEn: "Social Studies - Part 1",
    titleAr: "الدراسات الاجتماعية - الجزء الأول",
    classEn: "Class 6",
    classAr: "الصف السادس",
    subjectEn: "Social Studies",
    subjectAr: "الدراسات الاجتماعية",
    pdfUrl: "file:///C:/Users/deepi/Downloads/cls6_Social_P1%201.pdf",
    icon: Globe2,
    color: "from-emerald-500 to-teal-500",
  },
  {
    id: "cls6-math-hearing-p2",
    titleEn: "Mathematics (Hearing) - Part 2",
    titleAr: "الرياضيات (السمعي) - الجزء الثاني",
    classEn: "Class 6",
    classAr: "الصف السادس",
    subjectEn: "Mathematics",
    subjectAr: "الرياضيات",
    pdfUrl: "file:///C:/Users/deepi/Downloads/cls6_Math_HearingP2%201.pdf",
    icon: Calculator,
    color: "from-blue-500 to-indigo-500",
  },
  {
    id: "cls1-math-nashat-p2",
    titleEn: "Mathematics (Nashat) - Part 2",
    titleAr: "الرياضيات (نشاط) - الجزء الثاني",
    classEn: "Class 1",
    classAr: "الصف الأول",
    subjectEn: "Mathematics",
    subjectAr: "الرياضيات",
    pdfUrl: "file:///C:/Users/deepi/Downloads/cls1_Math_Nashat_p2.pdf",
    icon: Calculator,
    color: "from-violet-500 to-purple-500",
  },
];

export default function SyllabusViewer() {
  const { t, language } = useLanguage();
  const [selectedDoc, setSelectedDoc] = useState<SyllabusDocument | null>(null);

  const getText = (doc: SyllabusDocument, field: "title" | "class" | "subject") => {
    if (field === "title") return language === "ar" ? doc.titleAr : doc.titleEn;
    if (field === "class") return language === "ar" ? doc.classAr : doc.classEn;
    return language === "ar" ? doc.subjectAr : doc.subjectEn;
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-landing">
      {/* Background Effects - matching login landing */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="glow-orb-premium w-[600px] h-[600px] bg-blue-600/30 -top-40 -left-40" style={{ animationDelay: '0s' }} />
        <div className="glow-orb-premium w-[700px] h-[700px] bg-purple-600/40 -bottom-40 -right-40" style={{ animationDelay: '5s' }} />
        <div className="glow-orb-premium w-[500px] h-[500px] bg-pink-500/25 bottom-1/4 left-1/3" style={{ animationDelay: '10s' }} />
        <div className="particles-bg" />
        <div className="stars-bg" />

        {/* Neon wave curves at bottom */}
        <svg className="absolute bottom-0 left-0 w-full h-[300px]" preserveAspectRatio="none" viewBox="0 0 1440 300">
          <defs>
            <linearGradient id="syllabusWaveGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ec4899" stopOpacity="0.1" />
              <stop offset="20%" stopColor="#ec4899" stopOpacity="1" />
              <stop offset="50%" stopColor="#a855f7" stopOpacity="1" />
              <stop offset="80%" stopColor="#8b5cf6" stopOpacity="1" />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.1" />
            </linearGradient>
            <filter id="syllabusWaveGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            d="M-50,200 Q150,120 350,180 T750,120 T1150,200 T1500,140"
            stroke="url(#syllabusWaveGrad1)"
            strokeWidth="5"
            fill="none"
            filter="url(#syllabusWaveGlow)"
            className="animate-glow-pulse"
          />
          <path
            d="M-50,240 Q200,160 400,220 T850,150 T1250,240 T1500,180"
            stroke="url(#syllabusWaveGrad1)"
            strokeWidth="3"
            fill="none"
            filter="url(#syllabusWaveGlow)"
            opacity="0.6"
          />
        </svg>
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-purple-900/30 via-pink-900/15 to-transparent" />
      </div>

      {/* Header */}
      <header className="relative z-20 border-b border-violet-500/20 bg-slate-900/50 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <ArrowLeft className="w-5 h-5 text-violet-400 group-hover:-translate-x-1 transition-transform" />
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10">
                <svg viewBox="0 0 50 50" className="w-full h-full drop-shadow-lg">
                  <defs>
                    <linearGradient id="syllabusLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#06b6d4" />
                      <stop offset="50%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                  <polygon points="25,2 45,14 45,36 25,48 5,36 5,14" fill="url(#syllabusLogoGrad)" />
                  <polygon points="25,10 38,18 38,32 25,40 12,32 12,18" fill="none" stroke="white" strokeWidth="1.5" opacity="0.9"/>
                  <circle cx="25" cy="25" r="6" fill="white" opacity="0.9"/>
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-white font-bold text-lg tracking-wider">Cognitec</span>
                <span className="text-cyan-400 text-xs font-medium">School ERP System</span>
              </div>
            </div>
          </Link>
          <LanguageSwitcherButtons />
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-12">
        {/* Page Header */}
        <div className="text-center mb-12 animate-fade-in-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 mb-6 shadow-xl">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">
            {t("syllabus.title")}
          </h1>
          <p className="text-slate-400 max-w-md mx-auto">
            {t("syllabus.subtitle")}
          </p>
        </div>

        {/* Documents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {SYLLABUS_DOCUMENTS.map((doc, i) => (
            <div
              key={doc.id}
              className="role-card-premium p-6 animate-fade-in-up cursor-pointer group"
              style={{ animationDelay: `${i * 100}ms` }}
              onClick={() => setSelectedDoc(doc)}
            >
              {/* Icon */}
              <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${doc.color} mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <doc.icon className="w-7 h-7 text-white" />
              </div>

              {/* Title */}
              <h3 className="text-lg font-bold text-white mb-2 group-hover:text-violet-300 transition-colors">
                {getText(doc, "title")}
              </h3>

              {/* Meta */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  {getText(doc, "class")}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-700/50 text-slate-300 border border-slate-600/30">
                  {getText(doc, "subject")}
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDoc(doc);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600/20 text-violet-300 text-sm font-medium hover:bg-violet-600/30 transition-colors border border-violet-500/30"
                >
                  <Eye className="w-4 h-4" />
                  {t("syllabus.viewOnline")}
                </button>
                <a
                  href={doc.pdfUrl}
                  download
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors border border-slate-600/30"
                  title={t("syllabus.downloadPdf")}
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* PDF Viewer Modal */}
        {selectedDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-5xl h-[85vh] bg-slate-900 rounded-2xl border border-violet-500/30 overflow-hidden shadow-2xl animate-scale-in">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-violet-500/20 bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${selectedDoc.color}`}>
                    <selectedDoc.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{getText(selectedDoc, "title")}</h3>
                    <p className="text-sm text-slate-400">{getText(selectedDoc, "class")} • {getText(selectedDoc, "subject")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href={selectedDoc.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {language === "ar" ? "فتح في نافذة جديدة" : "Open in new tab"}
                  </a>
                  <button
                    onClick={() => setSelectedDoc(null)}
                    className="w-10 h-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                  >
                    <span className="text-2xl">&times;</span>
                  </button>
                </div>
              </div>

              {/* PDF Embed */}
              <div className="h-[calc(100%-72px)] bg-slate-950">
                <iframe
                  src={selectedDoc.pdfUrl}
                  className="w-full h-full"
                  title={getText(selectedDoc, "title")}
                />
              </div>
            </div>
          </div>
        )}

        {/* Back to Home */}
        <div className="text-center animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-violet-400 hover:text-violet-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {language === "ar" ? "العودة إلى الصفحة الرئيسية" : "Back to Home"}
          </Link>
        </div>
      </main>
    </div>
  );
}
