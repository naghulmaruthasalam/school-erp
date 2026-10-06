import { api } from "../../api/client";
import type { PageResponse } from "../../types/common";
import type {
  ExamOut,
  HomeworkOut,
  InvoiceOut,
  InvoiceStatus,
  PayUInitiateRequest,
  PayUInitiateResponse,
  PendingHomeworkOut,
  ResultOut,
  SchoolClass,
  Section,
  Student,
  StudentAttendanceOut,
  StudentAttendanceSummaryItem,
  Subject,
} from "./types";

// ---------------------------------------------------------------------------
// Children
// ---------------------------------------------------------------------------

export async function fetchMyChildren(): Promise<Student[]> {
  const { data } = await api.get<Student[]>("/students/my-children");
  return data;
}

// ---------------------------------------------------------------------------
// Academics (read-only lookups, used to resolve class/section/subject names)
// ---------------------------------------------------------------------------

export async function fetchClasses(): Promise<SchoolClass[]> {
  const { data } = await api.get<SchoolClass[]>("/academics/classes");
  return data;
}

export async function fetchSections(classId?: string): Promise<Section[]> {
  const { data } = await api.get<Section[]>("/academics/sections", {
    params: classId ? { class_id: classId } : undefined,
  });
  return data;
}

export async function fetchSubjects(): Promise<Subject[]> {
  const { data } = await api.get<Subject[]>("/academics/subjects");
  return data;
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export async function fetchAttendanceSummary(
  studentId: string,
  dateFrom: string,
  dateTo: string,
): Promise<StudentAttendanceSummaryItem[]> {
  const { data } = await api.get<StudentAttendanceSummaryItem[]>("/attendance/students/summary", {
    params: { student_id: studentId, date_from: dateFrom, date_to: dateTo },
  });
  return data;
}

export interface AttendanceHistoryParams {
  student_id: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

export async function fetchAttendanceHistory(
  params: AttendanceHistoryParams,
): Promise<PageResponse<StudentAttendanceOut>> {
  const { data } = await api.get<PageResponse<StudentAttendanceOut>>("/attendance/students", { params });
  return data;
}

// ---------------------------------------------------------------------------
// Homework
// ---------------------------------------------------------------------------

export async function fetchPendingHomework(): Promise<PendingHomeworkOut[]> {
  const { data } = await api.get<PendingHomeworkOut[]>("/homework/pending");
  return data;
}

export interface HomeworkListParams {
  section_id?: string;
  subject_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

export async function fetchHomeworkList(params: HomeworkListParams): Promise<PageResponse<HomeworkOut>> {
  const { data } = await api.get<PageResponse<HomeworkOut>>("/homework", { params });
  return data;
}

// ---------------------------------------------------------------------------
// Exams / results
// ---------------------------------------------------------------------------

export interface ExamListParams {
  academic_year_id?: string;
  page?: number;
  page_size?: number;
}

export async function fetchExams(params: ExamListParams = {}): Promise<PageResponse<ExamOut>> {
  const { data } = await api.get<PageResponse<ExamOut>>("/exams", { params });
  return data;
}

export async function fetchExamResult(examId: string, studentId: string): Promise<ResultOut> {
  const { data } = await api.get<ResultOut>(`/exams/${examId}/students/${studentId}/result`);
  return data;
}

export async function fetchReportCardPdf(examId: string, studentId: string): Promise<Blob> {
  const { data } = await api.get(`/exams/${examId}/students/${studentId}/report-card`, {
    responseType: "blob",
  });
  return data as Blob;
}

// ---------------------------------------------------------------------------
// Fees / payments
// ---------------------------------------------------------------------------

export interface InvoiceListParams {
  student_id?: string;
  status?: InvoiceStatus;
  academic_year_id?: string;
  page?: number;
  page_size?: number;
}

export async function fetchInvoices(params: InvoiceListParams): Promise<PageResponse<InvoiceOut>> {
  const { data } = await api.get<PageResponse<InvoiceOut>>("/fees/invoices", { params });
  return data;
}

export async function initiatePayUPayment(payload: PayUInitiateRequest): Promise<PayUInitiateResponse> {
  const { data } = await api.post<PayUInitiateResponse>("/payments/payu/initiate", payload);
  return data;
}
