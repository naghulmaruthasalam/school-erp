import { useQuery } from "@tanstack/react-query";
import { PageHeader, ErrorText } from "../../components/ui";
import { SyllabusViewer } from "../../components/SyllabusViewer";
import { listSyllabus, getSyllabusDocumentUrl } from "../admin/syllabusApi";
import { fetchClasses, fetchSubjects, fetchAcademicYears } from "../admin/api";

export default function ParentSyllabusPage() {
  const syllabusQuery = useQuery({
    queryKey: ["parent", "syllabus"],
    queryFn: () => listSyllabus({ status: "PUBLISHED" }),
  });

  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: () => fetchClasses() });
  const subjectsQuery = useQuery({ queryKey: ["subjects"], queryFn: fetchSubjects });
  const yearsQuery = useQuery({ queryKey: ["academicYears"], queryFn: fetchAcademicYears });

  const classes = Array.isArray(classesQuery.data) ? classesQuery.data : [];
  const subjects = Array.isArray(subjectsQuery.data) ? subjectsQuery.data : [];
  const years = Array.isArray(yearsQuery.data) ? yearsQuery.data : [];

  const getClassName = (id: string) => classes.find((c) => c.id === id)?.name ?? id;
  const getSubjectName = (id: string) => subjects.find((s) => s.id === id)?.name ?? id;
  const getYearName = (id: string) => years.find((y) => y.id === id)?.name ?? id;

  const isLoading = syllabusQuery.isLoading || classesQuery.isLoading || subjectsQuery.isLoading || yearsQuery.isLoading;
  const hasError = syllabusQuery.isError || classesQuery.isError || subjectsQuery.isError || yearsQuery.isError;

  if (hasError) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader title="Course Syllabus" subtitle="View your child's curriculum and study materials" />
        <ErrorText>Could not load syllabus. Please try again later.</ErrorText>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Course Syllabus"
        subtitle="View your child's curriculum and study materials"
      />

      <SyllabusViewer
        syllabusList={Array.isArray(syllabusQuery.data?.items) ? syllabusQuery.data.items : []}
        isLoading={isLoading}
        getClassName={getClassName}
        getSubjectName={getSubjectName}
        getYearName={getYearName}
        getDocumentUrl={getSyllabusDocumentUrl}
        emptyMessage="No syllabus available for your child's classes yet."
      />
    </div>
  );
}
