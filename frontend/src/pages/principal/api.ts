import { api } from "../../api/client";
import type { PageResponse } from "../../types/common";
import type { Exam, StaffAttendanceOut, StudentAttendanceOut } from "./types";

// ---------------------------------------------------------------------------
// Counts (we only need PageResponse.total, so page_size=1 keeps payloads tiny)
// ---------------------------------------------------------------------------

export async function countStudents(): Promise<number> {
  const { data } = await api.get<PageResponse<unknown>>("/students", { params: { page_size: 1 } });
  return data.total;
}

export async function countTeachers(): Promise<number> {
  const { data } = await api.get<PageResponse<unknown>>("/teachers", { params: { page_size: 1 } });
  return data.total;
}

export async function countPendingAdmissions(): Promise<number> {
  const { data } = await api.get<PageResponse<unknown>>("/admissions", {
    params: { status: "SUBMITTED", page_size: 1 },
  });
  return data.total;
}

// ---------------------------------------------------------------------------
// Upcoming exams
// ---------------------------------------------------------------------------

export async function listUpcomingExams(): Promise<PageResponse<Exam>> {
  const { data } = await api.get<PageResponse<Exam>>("/exams", { params: { page_size: 5 } });
  return data;
}

// ---------------------------------------------------------------------------
// Attendance "today" snapshots.
//
// The list endpoints are the only school-wide attendance views available
// (the /summary endpoints are per-student / per-teacher aggregates over a
// date range, not a single school-wide rollup), so we page through today's
// records ourselves. PageParams caps page_size at 200 server-side; when a
// school has more marked records than that in a single day we fall back to
// reporting the count only, rather than computing a percentage off a partial
// sample.
// ---------------------------------------------------------------------------

const MAX_PAGE_SIZE = 200;

export interface AttendanceSnapshot {
  /** Total attendance records marked for today, from PageResponse.total. */
  totalMarked: number;
  /** Count with status PRESENT, only meaningful when `complete` is true. */
  presentCount: number;
  /** True when we fetched every record (totalMarked <= page fetched). */
  complete: boolean;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function fetchStudentAttendanceToday(): Promise<AttendanceSnapshot> {
  const today = todayIso();
  const { data } = await api.get<PageResponse<StudentAttendanceOut>>("/attendance/students", {
    params: { date_from: today, date_to: today, page_size: MAX_PAGE_SIZE },
  });
  return {
    totalMarked: data.total,
    presentCount: data.items.filter((r) => r.status === "PRESENT").length,
    complete: data.total <= data.items.length,
  };
}

export async function fetchStaffAttendanceToday(): Promise<AttendanceSnapshot> {
  const today = todayIso();
  const { data } = await api.get<PageResponse<StaffAttendanceOut>>("/attendance/staff", {
    params: { date_from: today, date_to: today, page_size: MAX_PAGE_SIZE },
  });
  return {
    totalMarked: data.total,
    presentCount: data.items.filter((r) => r.status === "PRESENT").length,
    complete: data.total <= data.items.length,
  };
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

export interface AttendanceDailyPoint {
  date: string;
  present: number;
  absent: number;
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

export async function fetchAttendanceDaily(days = 7): Promise<AttendanceDailyPoint[]> {
  const { data } = await api.get<AttendanceDailyPoint[]>("/analytics/attendance-daily", { params: { days } });
  return data;
}
