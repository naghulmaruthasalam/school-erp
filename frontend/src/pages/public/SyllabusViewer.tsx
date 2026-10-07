import { useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../i18n/LanguageContext";
import { LanguageSwitcherButtons } from "../../components/LanguageSwitcher";
import Logo from "../../components/Logo";
import { ThemeToggle } from "../../theme/ThemeContext";
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
    <div className="relative min-h-screen">
      {/* Header */}
      <header className="sticky top-3 z-20 mx-3 mt-3 md:mx-6">
        <div className="glass-strong mx-auto flex max-w-6xl items-center justify-between !rounded-full px-4 py-2.5 md:px-6">
          <Link to="/" className="group flex items-center gap-3">
            <ArrowLeft className="h-5 w-5 text-ink-3 transition-transform group-hover:-translate-x-1 group-hover:text-ink" />
            <Logo size={36} showWordmark />
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcherButtons />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-12">
        {/* Page Header */}
        <div className="mb-12 text-center animate-fade-in-up">
          <div className="lg-icon mx-auto mb-6 !h-16 !w-16 !rounded-[22px]">
            <BookOpen className="h-8 w-8" />
          </div>
          <h1 className="mb-3 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">{t("syllabus.title")}</h1>
          <p className="mx-auto max-w-md text-ink-3">{t("syllabus.subtitle")}</p>
        </div>

        {/* Documents Grid */}
        <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {SYLLABUS_DOCUMENTS.map((doc, i) => (
            <div
              key={doc.id}
              className="glass glass-lift group animate-fade-in-up cursor-pointer p-6"
              style={{ animationDelay: `${i * 100}ms` }}
              onClick={() => setSelectedDoc(doc)}
            >
              <div className={`mb-4 inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-gradient-to-br ${doc.color} shadow-lg transition-transform duration-500 [transition-timing-function:var(--ease-spring)] group-hover:scale-110 group-hover:-rotate-3`}>
                <doc.icon className="h-7 w-7 text-white" />
              </div>

              <h3 className="mb-2 text-lg font-semibold tracking-tight text-ink">{getText(doc, "title")}</h3>

              <div className="mb-4 flex flex-wrap gap-2">
                <span className="lg-chip" style={{ ["--chip" as string]: "var(--accent)" }}>{getText(doc, "class")}</span>
                <span className="lg-chip">{getText(doc, "subject")}</span>
              </div>

              <div className="mt-4 flex gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDoc(doc);
                  }}
                  className="lg-btn lg-btn-secondary flex-1 !min-h-10"
                >
                  <Eye className="h-4 w-4" />
                  {t("syllabus.viewOnline")}
                </button>
                <a
                  href={doc.pdfUrl}
                  download
                  onClick={(e) => e.stopPropagation()}
                  className="glass-icon-btn !h-10 !w-10 !rounded-2xl"
                  title={t("syllabus.downloadPdf")}
                >
                  <Download className="h-4 w-4" />
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* PDF Viewer Modal */}
        {selectedDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-md animate-fade-in dark:bg-black/60">
            <div className="glass-strong relative h-[85vh] w-full max-w-5xl overflow-hidden !rounded-[28px] animate-pop-in">
              <div className="flex items-center justify-between border-b border-line px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-gradient-to-br ${selectedDoc.color}`}>
                    <selectedDoc.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink">{getText(selectedDoc, "title")}</h3>
                    <p className="text-sm text-ink-3">{getText(selectedDoc, "class")} • {getText(selectedDoc, "subject")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href={selectedDoc.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lg-btn lg-btn-primary !min-h-10"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {language === "ar" ? "فتح في نافذة جديدة" : "Open in new tab"}
                  </a>
                  <button
                    onClick={() => setSelectedDoc(null)}
                    aria-label="Close"
                    className="glass-icon-btn"
                  >
                    <span className="text-2xl leading-none">&times;</span>
                  </button>
                </div>
              </div>

              <div className="h-[calc(100%-72px)] bg-surface-2">
                <iframe src={selectedDoc.pdfUrl} className="h-full w-full" title={getText(selectedDoc, "title")} />
              </div>
            </div>
          </div>
        )}

        <div className="text-center animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
          <Link to="/" className="inline-flex items-center gap-2 text-accent-fg transition-opacity hover:opacity-70">
            <ArrowLeft className="h-4 w-4" />
            {language === "ar" ? "العودة إلى الصفحة الرئيسية" : "Back to Home"}
          </Link>
        </div>
      </main>
    </div>
  );
}
