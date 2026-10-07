import { api } from "../../api/client";
import type { PageResponse } from "../../types/common";
import type {
  AcademicYear,
  Exam,
  Homework,
  HomeworkSubmission,
  HomeworkSubmissionUpdateRequest,
  Invoice,
  PayUInitiateRequest,
  PayUInitiateResponse,
  PendingHomework,
  Result,
  SchoolClass,
  Section,
  Student,
  StudentAttendance,
  StudentAttendanceSummary,
  Subject,
  TimetableSlot,
} from "./types";

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function fetchMyProfile(): Promise<Student> {
  const { data } = await api.get<Student>("/students/me");
  return data;
}

// ---------------------------------------------------------------------------
// Academics (read-only lookups; a STUDENT may read these but not write them)
// ---------------------------------------------------------------------------

export async function fetchAcademicYear(yearId: string): Promise<AcademicYear> {
  const { data } = await api.get<AcademicYear>(`/academics/years/${yearId}`);
  return data;
}

export async function fetchClass(classId: string): Promise<SchoolClass> {
  const { data } = await api.get<SchoolClass>(`/academics/classes/${classId}`);
  return data;
}

export async function fetchSection(sectionId: string): Promise<Section> {
  const { data } = await api.get<Section>(`/academics/sections/${sectionId}`);
  return data;
}

export async function fetchSubjects(): Promise<Subject[]> {
  const { data } = await api.get<Subject[]>("/academics/subjects");
  return data;
}

export async function fetchTimetable(sectionId: string): Promise<TimetableSlot[]> {
  const { data } = await api.get<TimetableSlot[]>("/academics/timetable", { params: { section_id: sectionId } });
  return data;
}

// ---------------------------------------------------------------------------
// Attendance — a STUDENT caller is auto-scoped to their own records server-side
// ---------------------------------------------------------------------------

export async function fetchAttendanceSummary(dateFrom: string, dateTo: string): Promise<StudentAttendanceSummary[]> {
  const { data } = await api.get<StudentAttendanceSummary[]>("/attendance/students/summary", {
    params: { date_from: dateFrom, date_to: dateTo },
  });
  return data;
}

export interface AttendanceHistoryParams {
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

export async function fetchAttendanceHistory(
  params: AttendanceHistoryParams,
): Promise<PageResponse<StudentAttendance>> {
  const { data } = await api.get<PageResponse<StudentAttendance>>("/attendance/students", { params });
  return data;
}

// ---------------------------------------------------------------------------
// Homework
// ---------------------------------------------------------------------------

export async function fetchPendingHomework(): Promise<PendingHomework[]> {
  const { data } = await api.get<PendingHomework[]>("/homework/pending");
  return data;
}

export interface HomeworkListParams {
  section_id: string;
  subject_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

export async function fetchHomework(params: HomeworkListParams): Promise<PageResponse<Homework>> {
  const { data } = await api.get<PageResponse<Homework>>("/homework", { params });
  return data;
}

export async function fetchHomeworkSubmissions(homeworkId: string): Promise<HomeworkSubmission[]> {
  const { data } = await api.get<HomeworkSubmission[]>(`/homework/${homeworkId}/submissions`);
  return data;
}

export async function updateHomeworkSubmission(
  submissionId: string,
  payload: HomeworkSubmissionUpdateRequest,
): Promise<HomeworkSubmission> {
  const { data } = await api.patch<HomeworkSubmission>(`/homework/submissions/${submissionId}`, payload);
  return data;
}

// ---------------------------------------------------------------------------
// Exams
// ---------------------------------------------------------------------------

export interface ExamListParams {
  academic_year_id?: string;
  page?: number;
  page_size?: number;
}

export async function fetchExams(params: ExamListParams = {}): Promise<PageResponse<Exam>> {
  const { data } = await api.get<PageResponse<Exam>>("/exams", { params: { page_size: 100, ...params } });
  return data;
}

export async function fetchExamResult(examId: string, studentId: string): Promise<Result> {
  const { data } = await api.get<Result>(`/exams/${examId}/students/${studentId}/result`);
  return data;
}

export async function fetchReportCardPdf(examId: string, studentId: string): Promise<Blob> {
  const { data } = await api.get(`/exams/${examId}/students/${studentId}/report-card`, {
    responseType: "blob",
  });
  return data as Blob;
}

// ---------------------------------------------------------------------------
// Fees
// ---------------------------------------------------------------------------

export interface InvoiceListParams {
  status?: string;
  academic_year_id?: string;
  page?: number;
  page_size?: number;
}

export async function fetchInvoices(params: InvoiceListParams = {}): Promise<PageResponse<Invoice>> {
  const { data } = await api.get<PageResponse<Invoice>>("/fees/invoices", { params: { page_size: 100, ...params } });
  return data;
}

export async function initiatePayUPayment(payload: PayUInitiateRequest): Promise<PayUInitiateResponse> {
  const { data } = await api.post<PayUInitiateResponse>("/payments/payu/initiate", payload);
  return data;
}
