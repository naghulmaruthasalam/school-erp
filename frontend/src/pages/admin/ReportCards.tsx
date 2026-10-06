import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, PageHeader, Spinner, Badge } from "../../components/ui";
import { api } from "../../api/client";
import { fetchClasses, fetchSections, listStudents } from "./api";
import type { PageResponse } from "../../types/common";

interface Mark {
  id: string;
  student_id: string;
  exam_id: string;
  subject_id: string;
  marks_obtained: number;
  max_marks: number;
  grade: string;
}

interface Exam {
  id: string;
  name: string;
  exam_type: string;
}

export default function ReportCards() {
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedExam, setSelectedExam] = useState("");

  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: () => fetchClasses() });
  const sectionsQuery = useQuery({ queryKey: ["sections"], queryFn: () => fetchSections() });

  const studentsQuery = useQuery({
    queryKey: ["students", selectedSection],
    queryFn: () => listStudents({ section_id: selectedSection, status: "ACTIVE", page: 1, page_size: 100 }),
    enabled: !!selectedSection,
  });

  const examsQuery = useQuery({
    queryKey: ["exams-list"],
    queryFn: async () => {
      const { data } = await api.get<PageResponse<Exam>>("/exams");
      return data;
    },
  });

  const marksQuery = useQuery({
    queryKey: ["marks", selectedStudent, selectedExam],
    queryFn: async () => {
      const { data } = await api.get<Mark[]>("/exams/marks", {
        params: { student_id: selectedStudent, exam_id: selectedExam },
      });
      return data;
    },
    enabled: !!selectedStudent && !!selectedExam,
  });

  const getSectionName = (id: string) => {
    const section = sectionsQuery.data?.find((s) => s.id === id);
    if (!section) return id;
    const cls = classesQuery.data?.find((c) => c.id === section.class_id);
    return `${cls?.name || ""} - ${section.name}`;
  };

  const getGradeTone = (grade: string): "green" | "violet" | "yellow" | "red" => {
    if (grade === "A+" || grade === "A") return "green";
    if (grade === "B+" || grade === "B") return "violet";
    if (grade === "C+" || grade === "C") return "yellow";
    return "red";
  };

  const totalMarks = marksQuery.data?.reduce((sum, m) => sum + m.marks_obtained, 0) || 0;
  const maxMarks = marksQuery.data?.reduce((sum, m) => sum + m.max_marks, 0) || 0;
  const percentage = maxMarks > 0 ? ((totalMarks / maxMarks) * 100).toFixed(1) : 0;

  const selectedStudentData = studentsQuery.data?.items.find((s) => s.id === selectedStudent);

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Report Cards" subtitle="View and generate student report cards" />

      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-violet-700 mb-1">Section</label>
            <select
              value={selectedSection}
              onChange={(e) => { setSelectedSection(e.target.value); setSelectedStudent(""); }}
              className="w-full rounded-lg border border-violet-200 px-3 py-2"
            >
              <option value="">-- Select Section --</option>
              {sectionsQuery.data?.map((s) => (
                <option key={s.id} value={s.id}>{getSectionName(s.id)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-violet-700 mb-1">Student</label>
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="w-full rounded-lg border border-violet-200 px-3 py-2"
              disabled={!selectedSection}
            >
              <option value="">-- Select Student --</option>
              {studentsQuery.data?.items.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name} ({s.admission_no})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-violet-700 mb-1">Exam</label>
            <select
              value={selectedExam}
              onChange={(e) => setSelectedExam(e.target.value)}
              className="w-full rounded-lg border border-violet-200 px-3 py-2"
            >
              <option value="">-- Select Exam --</option>
              {examsQuery.data?.items.map((e) => (
                <option key={e.id} value={e.id}>{e.name} ({e.exam_type})</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {selectedStudent && selectedExam && (
        marksQuery.isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : marksQuery.data && marksQuery.data.length > 0 ? (
          <Card>
            <div className="border-b border-violet-200 pb-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-violet-900">{selectedStudentData?.full_name}</h2>
                  <p className="text-sm text-violet-600">
                    {selectedStudentData?.admission_no} · {getSectionName(selectedSection)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-violet-600">{percentage}%</p>
                  <p className="text-sm text-violet-500">{totalMarks}/{maxMarks} marks</p>
                </div>
              </div>
            </div>

            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-violet-600 border-b border-violet-100">
                  <th className="pb-2">Subject</th>
                  <th className="pb-2 text-center">Marks</th>
                  <th className="pb-2 text-center">Max</th>
                  <th className="pb-2 text-center">%</th>
                  <th className="pb-2 text-center">Grade</th>
                </tr>
              </thead>
              <tbody>
                {marksQuery.data.map((mark) => (
                  <tr key={mark.id} className="border-b border-violet-50">
                    <td className="py-3 font-medium text-violet-900">{mark.subject_id}</td>
                    <td className="py-3 text-center">{mark.marks_obtained}</td>
                    <td className="py-3 text-center text-violet-500">{mark.max_marks}</td>
                    <td className="py-3 text-center">
                      {((mark.marks_obtained / mark.max_marks) * 100).toFixed(0)}%
                    </td>
                    <td className="py-3 text-center">
                      <Badge tone={getGradeTone(mark.grade)}>{mark.grade}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 flex justify-end">
              <Button variant="secondary" onClick={() => window.print()}>Print Report Card</Button>
            </div>
          </Card>
        ) : (
          <Card><p className="text-center text-violet-400 py-8">No marks found for this student/exam.</p></Card>
        )
      )}

      {(!selectedStudent || !selectedExam) && (
        <Card><p className="text-center text-violet-400 py-8">Select a section, student, and exam to view report card.</p></Card>
      )}
    </div>
  );
}
