import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, PageHeader, Spinner, Badge } from "../../components/ui";
import { fetchClasses, fetchSubjects, fetchAcademicYears } from "./api";
import { getSyllabus, getSyllabusDocumentUrl } from "./syllabusApi";

export default function SyllabusDetail() {
  const { id } = useParams<{ id: string }>();

  const syllabusQuery = useQuery({
    queryKey: ["syllabus", id],
    queryFn: () => getSyllabus(id!),
    enabled: Boolean(id),
  });

  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: () => fetchClasses() });
  const subjectsQuery = useQuery({ queryKey: ["subjects"], queryFn: fetchSubjects });
  const yearsQuery = useQuery({ queryKey: ["academicYears"], queryFn: fetchAcademicYears });

  const getClassName = (cid: string) => classesQuery.data?.find((c) => c.id === cid)?.name || cid;
  const getSubjectName = (sid: string) => subjectsQuery.data?.find((s) => s.id === sid)?.name || sid;
  const getYearName = (yid: string) => yearsQuery.data?.find((y) => y.id === yid)?.name || yid;

  if (syllabusQuery.isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }

  if (!syllabusQuery.data) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader title="Syllabus Not Found" />
        <Card><p className="text-center text-accent-fg py-8">The requested syllabus could not be found.</p></Card>
      </div>
    );
  }

  const syl = syllabusQuery.data;

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={syl.title} subtitle="Syllabus Details">
        <Link to={`/admin/syllabus/${id}/edit`}>
          <Button>Edit Syllabus</Button>
        </Link>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-ink mb-4">Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-xs text-accent-fg uppercase">Academic Year</p>
                <p className="font-medium text-ink">{getYearName(syl.academic_year_id)}</p>
              </div>
              <div>
                <p className="text-xs text-accent-fg uppercase">Class</p>
                <p className="font-medium text-ink">{getClassName(syl.class_id)}</p>
              </div>
              <div>
                <p className="text-xs text-accent-fg uppercase">Subject</p>
                <p className="font-medium text-ink">{getSubjectName(syl.subject_id)}</p>
              </div>
              <div>
                <p className="text-xs text-accent-fg uppercase">Status</p>
                <Badge tone={syl.status === "PUBLISHED" ? "green" : "gray"}>{syl.status}</Badge>
              </div>
            </div>
            {syl.description && (
              <div>
                <p className="text-xs text-accent-fg uppercase mb-1">Description</p>
                <p className="text-ink-2">{syl.description}</p>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-ink mb-4">Chapters ({syl.chapters?.length || 0})</h2>
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
              <p className="text-center text-accent-fg py-4">No chapters defined.</p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-ink mb-4">Documents</h2>
            {syl.documents && syl.documents.length > 0 ? (
              <ul className="space-y-2">
                {syl.documents.map((doc) => (
                  <li key={doc.id}>
                    <a
                      href={getSyllabusDocumentUrl(doc.id)}
                      target="_blank"
                      rel="noopener noreferrer"
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
              <p className="text-sm text-accent-fg">No documents uploaded.</p>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-ink mb-4">Metadata</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-accent-fg">Created</span>
                <span className="text-ink">{new Date(syl.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-accent-fg">Updated</span>
                <span className="text-ink">{new Date(syl.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
