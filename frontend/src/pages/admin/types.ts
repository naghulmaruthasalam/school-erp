// Types mirroring backend/app/schemas/{student,teacher,admission,guardian,academic}.py exactly.

export type StudentStatus = "ACTIVE" | "INACTIVE" | "TRANSFERRED" | "GRADUATED" | "ALUMNI";
export type TeacherStatus = "ACTIVE" | "ON_LEAVE" | "INACTIVE";
export type AdmissionStatus = "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "CONVERTED";

// ---------------------------------------------------------------------------
// Academics (read-only lookups used to populate selects)
// ---------------------------------------------------------------------------

export interface AcademicYear {
  id: string;
  school_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

export interface SchoolClass {
  id: string;
  school_id: string;
  academic_year_id: string;
  name: string;
  order: number;
}

export interface Section {
  id: string;
  school_id: string;
  class_id: string;
  name: string;
  class_teacher_id: string | null;
  room_no: string | null;
}

export interface Subject {
  id: string;
  school_id: string;
  name: string;
  code: string;
}

// ---------------------------------------------------------------------------
// Student
// ---------------------------------------------------------------------------

export interface Student {
  id: string;
  school_id: string;
  admission_no: string;
  first_name: string;
  last_name: string;
  full_name: string;
  dob: string | null;
  gender: string | null;
  blood_group: string | null;

  academic_year_id: string;
  class_id: string;
  section_id: string;
  roll_number: string | null;

  guardian_ids: string[];
  primary_guardian_id: string | null;

  admission_date: string | null;
  status: StudentStatus;

  address: string | null;
  phone: string | null;
  email: string | null;

  photo_document_id: string | null;
  document_ids: string[];

  created_at: string;
  updated_at: string;
}

export interface StudentCreateRequest {
  admission_no?: string;  // Auto-generated if not provided
  first_name: string;
  last_name: string;
  dob?: string | null;
  gender?: string | null;
  blood_group?: string | null;

  academic_year_id: string;
  class_id: string;
  section_id: string;
  roll_number?: string | null;

  admission_date?: string | null;

  address?: string | null;
  phone?: string | null;
  email?: string | null;

  photo_document_id?: string | null;
  document_ids?: string[];
}

export interface StudentUpdateRequest {
  first_name?: string;
  last_name?: string;
  dob?: string | null;
  gender?: string | null;
  blood_group?: string | null;

  academic_year_id?: string;
  class_id?: string;
  section_id?: string;
  roll_number?: string | null;

  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface StudentStatusUpdateRequest {
  status: StudentStatus;
  note?: string | null;
}

// ---------------------------------------------------------------------------
// Teacher
// ---------------------------------------------------------------------------

export interface Teacher {
  id: string;
  school_id: string;
  employee_no: string;
  first_name: string;
  last_name: string;
  full_name: string;
  dob: string | null;
  gender: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  qualifications: string[];
  subject_ids: string[];
  assigned_class_ids: string[];
  joining_date: string | null;
  status: TeacherStatus;
  photo_document_id: string | null;
  document_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface TeacherCreateRequest {
  employee_no?: string;  // Auto-generated if not provided
  first_name: string;
  last_name: string;
  dob?: string | null;
  gender?: string | null;
  phone: string;
  email: string;
  address?: string | null;
  qualifications?: string[];
  subject_ids?: string[];
  assigned_class_ids?: string[];
  joining_date?: string | null;
  status?: TeacherStatus;
  photo_document_id?: string | null;
  document_ids?: string[];
}

export interface TeacherUpdateRequest {
  employee_no?: string;
  first_name?: string;
  last_name?: string;
  dob?: string | null;
  gender?: string | null;
  phone?: string;
  email?: string;
  address?: string | null;
  qualifications?: string[];
  subject_ids?: string[];
  assigned_class_ids?: string[];
  joining_date?: string | null;
  status?: TeacherStatus;
}

// ---------------------------------------------------------------------------
// Admission
// ---------------------------------------------------------------------------

export interface Admission {
  id: string;
  school_id: string;
  applicant_first_name: string;
  applicant_last_name: string;
  dob: string | null;
  gender: string | null;
  applying_for_class_id: string;
  applicant_email: string | null;
  guardian_name: string;
  guardian_phone: string;
  guardian_email: string | null;
  document_ids: string[];
  applicant_middle_name?: string | null;
  blood_group?: string | null;
  academic_year_id?: string | null;
  previous_school?: string | null;
  student_photo_id?: string | null;
  father_name?: string | null;
  father_phone?: string | null;
  mother_name?: string | null;
  mother_phone?: string | null;
  primary_guardian?: string | null;
  guardian_relationship?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  previous_class?: string | null;
  previous_board?: string | null;
  admission_type?: string | null;
  status: AdmissionStatus;
  reviewed_by: string | null;
  review_notes: string | null;
  created_student_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdmissionCreateRequest {
  // Student Information
  applicant_first_name: string;
  applicant_middle_name?: string | null;
  applicant_last_name: string;
  dob?: string | null;
  gender?: string | null;
  blood_group?: string | null;
  applying_for_class_id: string;
  academic_year_id?: string | null;
  previous_school?: string | null;
  applicant_email?: string | null;
  student_photo_id?: string | null;

  // Parent/Guardian Information
  father_name?: string | null;
  father_phone?: string | null;
  father_email?: string | null;
  mother_name?: string | null;
  mother_phone?: string | null;
  mother_email?: string | null;
  primary_guardian: string;
  guardian_relationship?: string | null;
  guardian_name: string;
  guardian_phone: string;
  guardian_email?: string | null;

  // Address
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;

  // Previous Academic Information
  previous_class?: string | null;
  previous_board?: string | null;
  previous_school_location?: string | null;
  transfer_certificate_no?: string | null;

  // Admission Details
  admission_type?: string | null;

  document_ids?: string[];
}

export interface AdmissionReviewRequest {
  action: "approve" | "reject";
  review_notes?: string | null;

  // Required only when action == "approve"
  academic_year_id?: string | null;
  section_id?: string | null;
  admission_no?: string | null;
  roll_number?: string | null;
}

export interface AdmissionReviewResponse {
  admission: Admission;
  student_id: string | null;
  guardian_id: string | null;
  student_login_created: boolean;
  guardian_login_created: boolean;
  notes: string[];
}
