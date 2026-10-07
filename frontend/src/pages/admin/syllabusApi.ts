import { api } from "../../api/client";
import type { PageResponse } from "../../types/common";

export interface SyllabusChapter {
  id: string;
  syllabus_id: string;
  name: string;
  description: string;
  order: number;
  video_url?: string;
  duration_minutes?: number;
  topics?: string[];
  content?: string | null;
}

export interface SyllabusDocument {
  id: string;
  filename: string;
}

export interface Syllabus {
  id: string;
  school_id: string;
  academic_year_id: string;
  class_id: string;
  subject_id: string;
  title: string;
  description: string;
  status: "DRAFT" | "PUBLISHED";
  chapters: SyllabusChapter[];
  chapters_count: number;
  documents: SyllabusDocument[];
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
  chapters?: { name: string; description?: string; order: number; video_url?: string; duration_minutes?: number; topics?: string[]; content?: string | null }[];
  document_ids?: string[];
}

export interface SyllabusUpdateRequest {
  title?: string;
  description?: string;
  status?: "DRAFT" | "PUBLISHED";
  chapters?: { id?: string; name: string; description?: string; order: number; video_url?: string; duration_minutes?: number; topics?: string[]; content?: string | null }[];
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

// ---- class -> subject -> chapter tree and bulk import -------------------------------------------

export interface TreeChapter {
  id: string;
  name: string;
  description: string | null;
  order: number;
  topics: string[];
  has_content: boolean;
}

export interface TreeSubject {
  id: string;
  name: string;
  syllabus_id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED";
  chapters: TreeChapter[];
}

export interface TreeClass {
  id: string;
  name: string;
  subjects: TreeSubject[];
}

export async function fetchSyllabusTree(): Promise<TreeClass[]> {
  const { data } = await api.get<{ classes: TreeClass[] }>("/syllabus/tree");
  return data.classes;
}

export interface ImportReport {
  academic_year: string;
  dry_run: boolean;
  problems: string[];
  created_classes: string[];
  created_subjects: string[];
  totals: { syllabi_created: number; syllabi_updated: number; chapters_added: number; chapters_updated: number; skipped_groups: number };
  syllabi: { class: string; subject: string; action: "create" | "update"; chapters_added: number; chapters_updated: number; chapters: string[] }[];
}

export async function importSyllabus(
  file: File,
  opts: { dryRun: boolean; createMissing: boolean; replace: boolean },
): Promise<ImportReport> {
  const body = new FormData();
  body.append("file", file);
  body.append("dry_run", String(opts.dryRun));
  body.append("create_missing", String(opts.createMissing));
  body.append("mode", opts.replace ? "replace" : "merge");
  const { data } = await api.post<ImportReport>("/syllabus/import", body);
  return data;
}

export async function downloadImportTemplate(): Promise<void> {
  const { data } = await api.get<string>("/syllabus/import/template", { responseType: "text" });
  const url = URL.createObjectURL(new Blob([data], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "syllabus-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ---- curriculum source (a link to the syllabus file) -------------------------------------------

export interface CurriculumSource {
  configured: boolean;
  url?: string;
  has_api_key?: boolean;
  api_key_header?: string;
  field_map?: Record<string, string>;
  value_map?: Record<string, Record<string, string>>;
  create_missing?: boolean;
  mode?: "merge" | "replace";
  auto_sync_minutes?: number;
  last_synced_at?: string | null;
  last_status?: "ok" | "unchanged" | "error" | null;
  last_message?: string | null;
}

export interface SourcePayload {
  url: string;
  api_key?: string | null; // omitted = keep the saved key, "" = remove it
  api_key_header: string;
  field_map: Record<string, string>;
  value_map: Record<string, Record<string, string>>;
  create_missing: boolean;
  mode: "merge" | "replace";
  auto_sync_minutes: number;
}

export type SourceReport = ImportReport & {
  unchanged?: boolean;
  message?: string;
  records_read?: number;
  source_files?: string[];
  skipped_files?: string[];
};

export const getCurriculumSource = async () => (await api.get<CurriculumSource>("/syllabus/source")).data;
export const saveCurriculumSource = async (p: SourcePayload) => (await api.put<CurriculumSource>("/syllabus/source", p)).data;
export const testCurriculumSource = async (p: SourcePayload) => (await api.post<SourceReport>("/syllabus/source/test", p)).data;
export const syncCurriculumSource = async (force = false) => (await api.post<SourceReport>("/syllabus/source/sync", null, { params: { force } })).data;
export const deleteCurriculumSource = async () => {
  await api.delete("/syllabus/source");
};
