import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button, Card, PageHeader, Spinner, Badge } from "../../components/ui";
import { fetchAcademicYears, fetchClasses, fetchSubjects } from "./api";
import { listSyllabus } from "./syllabusApi";

export default function SyllabusList() {
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");

  const yearsQuery = useQuery({ queryKey: ["academicYears"], queryFn: fetchAcademicYears });
  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: () => fetchClasses() });
  const subjectsQuery = useQuery({ queryKey: ["subjects"], queryFn: fetchSubjects });

  const syllabusQuery = useQuery({
    queryKey: ["syllabus", selectedYear, selectedClass, selectedSubject],
    queryFn: () => listSyllabus({
      academic_year_id: selectedYear || undefined,
      class_id: selectedClass || undefined,
      subject_id: selectedSubject || undefined,
    }),
  });

  const getClassName = (id: string) => classesQuery.data?.find((c) => c.id === id)?.name || id;
  const getSubjectName = (id: string) => subjectsQuery.data?.find((s) => s.id === id)?.name || id;
  const getYearName = (id: string) => yearsQuery.data?.find((y) => y.id === id)?.name || id;

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Syllabus Management" subtitle="Manage curriculum and course content">
        <Link to="/admin/syllabus/new">
          <Button>Create Syllabus</Button>
        </Link>
      </PageHeader>

      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-violet-700 mb-1">Academic Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500"
            >
              <option value="">All Years</option>
              {yearsQuery.data?.map((y) => (
                <option key={y.id} value={y.id}>{y.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-violet-700 mb-1">Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500"
            >
              <option value="">All Classes</option>
              {classesQuery.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-violet-700 mb-1">Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500"
            >
              <option value="">All Subjects</option>
              {subjectsQuery.data?.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {syllabusQuery.isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="space-y-3">
          {syllabusQuery.data?.items.map((syl) => (
            <Link key={syl.id} to={`/admin/syllabus/${syl.id}`}>
              <Card className="hover:border-violet-400 cursor-pointer">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-violet-900">{syl.title}</h3>
                      <Badge tone="violet">{getClassName(syl.class_id)}</Badge>
                      <Badge tone="gray">{getSubjectName(syl.subject_id)}</Badge>
                    </div>
                    <p className="text-sm text-violet-700 mb-2 line-clamp-2">{syl.description}</p>
                    <div className="flex items-center gap-4 text-xs text-violet-500">
                      <span>{getYearName(syl.academic_year_id)}</span>
                      <span>{syl.chapters_count} chapters</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge tone={syl.status === "PUBLISHED" ? "green" : "gray"}>{syl.status}</Badge>
                    <p className="text-xs text-violet-400 mt-2">
                      Updated: {new Date(syl.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
          {syllabusQuery.data?.items.length === 0 && (
            <Card><p className="text-center text-violet-400 py-8">No syllabus found.</p></Card>
          )}
        </div>
      )}
    </div>
  );
}
