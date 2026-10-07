export type Role =
  | "SUPER_ADMIN"
  | "SCHOOL_ADMIN"
  | "PRINCIPAL"
  | "TEACHER"
  | "PARENT"
  | "STUDENT";

export interface User {
  id: string;
  school_id: string | null;
  email: string;
  role: Role;
  full_name: string;
  phone: string | null;
  student_id: string | null;
  teacher_id: string | null;
  guardian_id: string | null;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}
