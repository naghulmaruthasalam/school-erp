// Types mirroring backend/app/schemas/school.py exactly.

export interface School {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  postal_code: string | null;
  phone: string | null;
  email: string | null;
  logo_document_id: string | null;
  academic_year_start_month: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SchoolCreateRequest {
  name: string;
  code: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string;
  postal_code?: string | null;
  phone?: string | null;
  email?: string | null;
  academic_year_start_month?: number;

  // First SCHOOL_ADMIN user provisioned for this school
  admin_full_name: string;
  admin_email: string;
  admin_phone?: string | null;
}

export interface SchoolUpdateRequest {
  name?: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  phone?: string | null;
  email?: string | null;
  academic_year_start_month?: number | null;
  logo_document_id?: string | null;
  is_active?: boolean | null;
}

export interface SchoolCreateResponse {
  school: School;
  admin_user_id: string;
  admin_email: string;
}

export interface PlatformStats {
  total_schools: number;
  active_schools: number;
  inactive_schools: number;
  total_users: number;
  active_users: number;
}

export interface UsersByRole {
  role: string;
  count: number;
}

export interface AuditLogEntry {
  id: string;
  school_name: string;
  actor_name: string;
  actor_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string | null;
}
