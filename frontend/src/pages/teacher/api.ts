import { api } from "../../api/client";
import type { PageResponse } from "../../types/common";
import type {
  ExamOut,
  ExamSubjectOut,
  HomeworkCreateRequest,
  HomeworkOut,
  HomeworkSubmissionOut,
  MarkEntryRequest,
  MarkOut,
  SchoolClass,
  Section,
  Student,
  StudentAttendanceBulkMarkRequest,
  StudentAttendanceOut,
  Subject,
  TimetableSlot,
} from "./types";

// ---------------------------------------------------------------------------
// Academics (lookups)
// ---------------------------------------------------------------------------

export async function fetchClasses(): Promise<SchoolClass[]> {
  const { data } = await api.get<SchoolClass[]>("/academics/classes");
  return data;
}

export async function fetchSections(): Promise<Section[]> {
  const { data } = await api.get<Section[]>("/academics/sections");
  return data;
}

export async function fetchSubjects(): Promise<Subject[]> {
  const { data } = await api.get<Subject[]>("/academics/subjects");
  return data;
}

export async function fetchMyTeacher(): Promise<{ id: string; assigned_class_ids?: string[] }> {
  const { data } = await api.get("/teachers/me");
  return data;
}

export async function fetchMyTimetable(teacherId: string): Promise<TimetableSlot[]> {
  const { data } = await api.get<TimetableSlot[]>("/academics/timetable", {
    params: { teacher_id: teacherId },
  });
  return data;
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

export async function fetchSectionRoster(sectionId: string): Promise<Student[]> {
  const { data } = await api.get<PageResponse<Student>>("/students", {
    params: { section_id: sectionId, page_size: 200 },
  });
  return data.items;
}

export async function fetchClassRoster(classId: string): Promise<Student[]> {
  const { data } = await api.get<PageResponse<Student>>("/students", {
    params: { class_id: classId, page_size: 200 },
  });
  return data.items;
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export async function markStudentAttendance(
  payload: StudentAttendanceBulkMarkRequest,
): Promise<StudentAttendanceOut[]> {
  const { data } = await api.post<StudentAttendanceOut[]>("/attendance/students", payload);
  return data;
}

export interface AttendanceListParams {
  section_id: string;
  date_from: string;
  date_to: string;
  page_size?: number;
}

export async function listStudentAttendance(
  params: AttendanceListParams,
): Promise<PageResponse<StudentAttendanceOut>> {
  const { data } = await api.get<PageResponse<StudentAttendanceOut>>("/attendance/students", {
    params: { page_size: 200, ...params },
  });
  return data;
}

// ---------------------------------------------------------------------------
// Homework
// ---------------------------------------------------------------------------

export interface HomeworkListParams {
  section_id?: string;
  page_size?: number;
}

export async function listHomework(params: HomeworkListParams = {}): Promise<PageResponse<HomeworkOut>> {
  const { data } = await api.get<PageResponse<HomeworkOut>>("/homework", {
    params: { page_size: 100, ...params },
  });
  return data;
}

export async function createHomework(payload: HomeworkCreateRequest): Promise<HomeworkOut> {
  const { data } = await api.post<HomeworkOut>("/homework", payload);
  return data;
}

export async function saveTeacherFeedback(submissionId: string, teacher_feedback: string): Promise<HomeworkSubmissionOut> {
  const { data } = await api.patch<HomeworkSubmissionOut>(`/homework/submissions/${submissionId}`, { teacher_feedback });
  return data;
}

export async function getHomework(id: string): Promise<HomeworkOut> {
  const { data } = await api.get<HomeworkOut>(`/homework/${id}`);
  return data;
}

export async function listHomeworkSubmissions(homeworkId: string): Promise<HomeworkSubmissionOut[]> {
  const { data } = await api.get<HomeworkSubmissionOut[]>(`/homework/${homeworkId}/submissions`);
  return data;
}

// ---------------------------------------------------------------------------
// Exams / Marks
// ---------------------------------------------------------------------------

export async function listExams(): Promise<PageResponse<ExamOut>> {
  const { data } = await api.get<PageResponse<ExamOut>>("/exams", { params: { page_size: 100 } });
  return data;
}

export async function listExamSubjects(examId: string): Promise<ExamSubjectOut[]> {
  const { data } = await api.get<ExamSubjectOut[]>(`/exams/${examId}/subjects`);
  return data;
}

export async function listMarks(examSubjectId: string): Promise<MarkOut[]> {
  const { data } = await api.get<MarkOut[]>(`/exams/subjects/${examSubjectId}/marks`);
  return data;
}

export async function submitMarks(examSubjectId: string, payload: MarkEntryRequest): Promise<MarkOut[]> {
  const { data } = await api.post<MarkOut[]>(`/exams/subjects/${examSubjectId}/marks`, payload);
  return data;
}
