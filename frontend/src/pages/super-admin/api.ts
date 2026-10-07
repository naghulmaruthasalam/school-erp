import { api } from "../../api/client";
import type { PageResponse } from "../../types/common";
import type { School, SchoolCreateRequest, SchoolCreateResponse, SchoolUpdateRequest, PlatformStats, UsersByRole, AuditLogEntry } from "./types";

export interface SchoolListParams {
  page?: number;
  page_size?: number;
}

export async function listSchools(params: SchoolListParams = {}): Promise<PageResponse<School>> {
  const { data } = await api.get<PageResponse<School>>("/schools", { params });
  return data;
}

export async function getSchool(id: string): Promise<School> {
  const { data } = await api.get<School>(`/schools/${id}`);
  return data;
}

export async function createSchool(payload: SchoolCreateRequest): Promise<SchoolCreateResponse> {
  const { data } = await api.post<SchoolCreateResponse>("/schools", payload);
  return data;
}

export async function updateSchool(id: string, payload: SchoolUpdateRequest): Promise<School> {
  const { data } = await api.patch<School>(`/schools/${id}`, payload);
  return data;
}

export async function fetchPlatformStats(): Promise<PlatformStats> {
  const { data } = await api.get<PlatformStats>("/schools/stats/overview");
  return data;
}

export async function fetchUsersByRole(): Promise<UsersByRole[]> {
  const { data } = await api.get<UsersByRole[]>("/schools/stats/users");
  return data;
}

export async function fetchAuditLogs(limit: number = 50): Promise<AuditLogEntry[]> {
  const { data } = await api.get<AuditLogEntry[]>("/schools/stats/audit-logs", { params: { limit } });
  return data;
}

export function exportDataToCsv<T extends object>(data: T[], filename: string): void {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(","),
    ...data.map(row =>
      headers.map(h => {
        const val = (row as Record<string, unknown>)[h];
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
