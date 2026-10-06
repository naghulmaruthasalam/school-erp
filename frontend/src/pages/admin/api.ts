import { api } from "../../api/client";
import type { PageResponse } from "../../types/common";
import type {
  AcademicYear,
  Admission,
  AdmissionCreateRequest,
  AdmissionReviewRequest,
  AdmissionReviewResponse,
  AdmissionStatus,
  SchoolClass,
  Section,
  Student,
  StudentCreateRequest,
  StudentStatus,
  StudentStatusUpdateRequest,
  StudentUpdateRequest,
  Subject,
  Teacher,
  TeacherCreateRequest,
  TeacherUpdateRequest,
} from "./types";

// ---------------------------------------------------------------------------
// Academics (lookups for selects)
// ---------------------------------------------------------------------------

export async function fetchAcademicYears(): Promise<AcademicYear[]> {
  const { data } = await api.get<AcademicYear[]>("/academics/years");
  return data;
}

export async function fetchClasses(academicYearId?: string): Promise<SchoolClass[]> {
  const { data } = await api.get<SchoolClass[]>("/academics/classes", {
    params: academicYearId ? { academic_year_id: academicYearId } : undefined,
  });
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
// Students
// ---------------------------------------------------------------------------

export interface StudentListParams {
  page?: number;
  page_size?: number;
  class_id?: string;
  section_id?: string;
  status?: StudentStatus;
  name?: string;
}

export async function listStudents(params: StudentListParams): Promise<PageResponse<Student>> {
  const { data } = await api.get<PageResponse<Student>>("/students", { params });
  return data;
}

export async function getStudent(id: string): Promise<Student> {
  const { data } = await api.get<Student>(`/students/${id}`);
  return data;
}

export async function createStudent(payload: StudentCreateRequest): Promise<Student> {
  const { data } = await api.post<Student>("/students", payload);
  return data;
}

export async function updateStudent(id: string, payload: StudentUpdateRequest): Promise<Student> {
  const { data } = await api.patch<Student>(`/students/${id}`, payload);
  return data;
}

export async function updateStudentStatus(id: string, payload: StudentStatusUpdateRequest): Promise<Student> {
  const { data } = await api.patch<Student>(`/students/${id}/status`, payload);
  return data;
}

// ---------------------------------------------------------------------------
// Teachers
// ---------------------------------------------------------------------------

export interface TeacherListParams {
  page?: number;
  page_size?: number;
  name?: string;
  subject_id?: string;
  status?: string;
}

export async function listTeachers(params: TeacherListParams): Promise<PageResponse<Teacher>> {
  const { data } = await api.get<PageResponse<Teacher>>("/teachers", { params });
  return data;
}

export async function getTeacher(id: string): Promise<Teacher> {
  const { data } = await api.get<Teacher>(`/teachers/${id}`);
  return data;
}

export async function createTeacher(payload: TeacherCreateRequest): Promise<Teacher> {
  const { data } = await api.post<Teacher>("/teachers", payload);
  return data;
}

export async function updateTeacher(id: string, payload: TeacherUpdateRequest): Promise<Teacher> {
  const { data } = await api.patch<Teacher>(`/teachers/${id}`, payload);
  return data;
}

// ---------------------------------------------------------------------------
// Admissions
// ---------------------------------------------------------------------------

export interface AdmissionListParams {
  page?: number;
  page_size?: number;
  status?: AdmissionStatus;
}

export async function listAdmissions(params: AdmissionListParams): Promise<PageResponse<Admission>> {
  const { data } = await api.get<PageResponse<Admission>>("/admissions", { params });
  return data;
}

export async function getAdmission(id: string): Promise<Admission> {
  const { data } = await api.get<Admission>(`/admissions/${id}`);
  return data;
}

export async function createAdmission(payload: AdmissionCreateRequest): Promise<Admission> {
  const { data } = await api.post<Admission>("/admissions", payload);
  return data;
}

export async function reviewAdmission(
  id: string,
  payload: AdmissionReviewRequest,
): Promise<AdmissionReviewResponse> {
  const { data } = await api.post<AdmissionReviewResponse>(`/admissions/${id}/review`, payload);
  return data;
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export interface AttendanceTrendPoint {
  date: string;
  percentage: number;
}

export interface FeeCollectionPoint {
  month: string;
  amount: number;
}

export interface DistributionPoint {
  name: string;
  value: number;
}

export async function fetchAttendanceTrend(days = 14): Promise<AttendanceTrendPoint[]> {
  const { data } = await api.get<AttendanceTrendPoint[]>("/analytics/attendance-trend", { params: { days } });
  return data;
}

export async function fetchFeeCollection(months = 6): Promise<FeeCollectionPoint[]> {
  const { data } = await api.get<FeeCollectionPoint[]>("/analytics/fee-collection", { params: { months } });
  return data;
}

export async function fetchStudentDistribution(): Promise<DistributionPoint[]> {
  const { data } = await api.get<DistributionPoint[]>("/analytics/student-distribution");
  return data;
}

export interface PendingFeesSummary {
  total_due: number;
  total_paid: number;
  total_pending: number;
  overdue_count: number;
  total_invoices: number;
}

export async function fetchPendingFees(): Promise<PendingFeesSummary> {
  const { data } = await api.get<PendingFeesSummary>("/analytics/pending-fees");
  return data;
}

export interface TeacherWorkload {
  name: string;
  classes: number;
  status: string;
}

export async function fetchTeacherWorkload(): Promise<TeacherWorkload[]> {
  const { data } = await api.get<TeacherWorkload[]>("/analytics/teacher-workload");
  return data;
}

export interface AdmissionStats {
  total: number;
  submitted: number;
  under_review: number;
  approved: number;
  rejected: number;
  converted: number;
}

export async function fetchAdmissionStats(): Promise<AdmissionStats> {
  const { data } = await api.get<AdmissionStats>("/analytics/admission-stats");
  return data;
}

export interface LeaveStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  by_type: Record<string, number>;
}

export async function fetchLeaveStats(): Promise<LeaveStats> {
  const { data } = await api.get<LeaveStats>("/analytics/leave-stats");
  return data;
}

// ---------------------------------------------------------------------------
// Export utilities
// ---------------------------------------------------------------------------

export function exportDataToCsv<T extends Record<string, unknown>>(data: T[], filename: string): void {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(","),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h];
        const str = val === null || val === undefined ? "" : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      }).join(",")
    ),
  ];
  const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
