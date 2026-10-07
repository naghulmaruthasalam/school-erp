import { api } from "../../api/client";
import type { PageResponse } from "../../types/common";

export interface SyllabusChapter {
  name: string;
  description?: string;
  order: number;
  video_url?: string;
  duration_minutes?: number;
}


export interface Syllabus {
  id: string;
  school_id: string;
  academic_year_id: string;
  class_id: string;
  subject_id: string;
  title: string;
  description?: string;
  status: "DRAFT" | "PUBLISHED";
  chapters: SyllabusChapter[];
  document_ids: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SyllabusListParams {
  academic_year_id?: string;
  class_id?: string;
  subject_id?: string;
  status?: string;
  page?: number;
  page_size?: number;
}

export interface SyllabusCreateRequest {
  academic_year_id: string;
  class_id: string;
  subject_id: string;
  title: string;
  description?: string;
  status?: "DRAFT" | "PUBLISHED";
  chapters?: { name: string; description?: string; order: number; video_url?: string; duration_minutes?: number }[];
  document_ids?: string[];
}

export interface SyllabusUpdateRequest {
  title?: string;
  description?: string;
  status?: "DRAFT" | "PUBLISHED";
  chapters?: { name: string; description?: string; order: number; video_url?: string; duration_minutes?: number }[];
  document_ids?: string[];
}

export async function listSyllabus(params: SyllabusListParams = {}): Promise<PageResponse<Syllabus>> {
  const { data } = await api.get<PageResponse<Syllabus>>("/syllabus", {
    params: { page_size: 100, ...params },
  });
  return data;
}

export async function getSyllabus(id: string): Promise<Syllabus> {
  const { data } = await api.get<Syllabus>(`/syllabus/${id}`);
  return data;
}

export async function createSyllabus(payload: SyllabusCreateRequest): Promise<Syllabus> {
  const { data } = await api.post<Syllabus>("/syllabus", payload);
  return data;
}

export async function updateSyllabus(id: string, payload: SyllabusUpdateRequest): Promise<Syllabus> {
  const { data } = await api.patch<Syllabus>(`/syllabus/${id}`, payload);
  return data;
}

export async function deleteSyllabus(id: string): Promise<void> {
  await api.delete(`/syllabus/${id}`);
}

export async function uploadSyllabusDocument(syllabusId: string, file: File): Promise<SyllabusDocument> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post<SyllabusDocument>(`/syllabus/${syllabusId}/documents`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export function getSyllabusDocumentUrl(documentId: string): string {
  return `${api.defaults.baseURL}/syllabus/documents/${documentId}/download`;
}
