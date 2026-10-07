import { openDocument } from "../../api/files";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, PageHeader, Spinner, Badge } from "../../components/ui";
import { fetchClasses, fetchSubjects, fetchAcademicYears } from "./api";
import { getSyllabus } from "./syllabusApi";
import { useLanguage } from "../../i18n/LanguageContext";

export default function SyllabusDetail() {
  const { t, te, fmtDate } = useLanguage();
  const { id } = useParams<{ id: string }>();

  const syllabusQuery = useQuery({
    queryKey: ["syllabus", id],
    queryFn: () => getSyllabus(id!),
    enabled: Boolean(id),
  });

  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: () => fetchClasses() });
  const subjectsQuery = useQuery({ queryKey: ["subjects"], queryFn: fetchSubjects });
  const yearsQuery = useQuery({ queryKey: ["academicYears"], queryFn: fetchAcademicYears });

  const getClassName = (cid: string) => te("class", classesQuery.data?.find((c) => c.id === cid)?.name) || cid;
  const getSubjectName = (sid: string) => te("subject", subjectsQuery.data?.find((s) => s.id === sid)?.name) || sid;
  const getYearName = (yid: string) => yearsQuery.data?.find((y) => y.id === yid)?.name || yid;

  if (syllabusQuery.isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }

  if (!syllabusQuery.data) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader title={t("admin.syllabus.notFoundTitle")} />
        <Card><p className="text-center text-accent-fg py-8">{t("admin.syllabus.notFound")}</p></Card>
      </div>
    );
  }

  const syl = syllabusQuery.data;

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={syl.title} subtitle={t("admin.syllabus.details")}>
        <Link to={`/admin/syllabus/${id}/edit`}>
          <Button>{t("admin.syllabus.edit")}</Button>
        </Link>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-ink mb-4">{t("admin.common.overview")}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-xs text-accent-fg uppercase">{t("admin.common.academicYear")}</p>
                <p className="font-medium text-ink">{getYearName(syl.academic_year_id)}</p>
              </div>
              <div>
                <p className="text-xs text-accent-fg uppercase">{t("admin.common.class")}</p>
                <p className="font-medium text-ink">{getClassName(syl.class_id)}</p>
              </div>
              <div>
                <p className="text-xs text-accent-fg uppercase">{t("admin.common.subject")}</p>
                <p className="font-medium text-ink">{getSubjectName(syl.subject_id)}</p>
              </div>
              <div>
                <p className="text-xs text-accent-fg uppercase">{t("admin.common.status")}</p>
                <Badge tone={syl.status === "PUBLISHED" ? "green" : "gray"}>{te("status", syl.status)}</Badge>
              </div>
            </div>
            {syl.description && (
              <div>
                <p className="text-xs text-accent-fg uppercase mb-1">{t("admin.common.description")}</p>
                <p className="text-ink-2">{syl.description}</p>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-ink mb-4">{t("admin.syllabus.chaptersTitle", { n: syl.chapters?.length || 0 })}</h2>
            {syl.chapters && syl.chapters.length > 0 ? (
              <div className="space-y-3">
                {syl.chapters.sort((a, b) => a.order - b.order).map((ch, idx) => (
                  <div key={ch.id} className="border border-line rounded-lg p-4 hover:bg-violet-50/50">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-violet-100 text-ink-2 rounded-full flex items-center justify-center text-sm font-semibold">
                        {idx + 1}
                      </div>
                      <div>
                        <h3 className="font-medium text-ink">{ch.name}</h3>
                        {ch.description && (
                          <p className="text-sm text-accent-fg mt-1">{ch.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-accent-fg py-4">{t("admin.syllabus.noChapters")}</p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-ink mb-4">{t("admin.common.documents")}</h2>
            {syl.documents && syl.documents.length > 0 ? (
              <ul className="space-y-2">
                {syl.documents.map((doc) => (
                  <li key={doc.id}>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        void openDocument(doc.id);
                      }}
                      className="flex items-center gap-2 text-sm text-ink-2 hover:text-ink hover:underline"
                    >
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="truncate">{doc.filename}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-accent-fg">{t("admin.syllabus.noDocuments")}</p>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-ink mb-4">{t("admin.syllabus.metadata")}</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-accent-fg">{t("admin.common.created")}</span>
                <span className="text-ink">{fmtDate(syl.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-accent-fg">{t("admin.common.updated")}</span>
                <span className="text-ink">{fmtDate(syl.updated_at)}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
