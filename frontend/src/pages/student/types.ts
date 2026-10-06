// ---------------------------------------------------------------------------
// Enums (mirrors backend/app/core/enums.py)
// ---------------------------------------------------------------------------

export type StudentStatus = "ACTIVE" | "INACTIVE" | "TRANSFERRED" | "GRADUATED" | "ALUMNI";

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "EXCUSED";

export type HomeworkSubmissionStatus = "PENDING" | "SUBMITTED" | "LATE";

export type InvoiceStatus = "PENDING" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED";

export type PaymentMethod = "CASH" | "CHEQUE" | "BANK_TRANSFER" | "PAYU";

export type PaymentStatus = "CREATED" | "SUCCESS" | "FAILED";

/** day_of_week: 0=Monday .. 6=Sunday */
export const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ---------------------------------------------------------------------------
// Student profile (backend/app/schemas/student.py::StudentOut)
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

// ---------------------------------------------------------------------------
// Academics (backend/app/schemas/academic.py)
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

export interface TimetableSlot {
  id: string;
  school_id: string;
  section_id: string;
  day_of_week: number;
  period_number: number;
  start_time: string;
  end_time: string;
  subject_id: string;
  teacher_id: string;
}

// ---------------------------------------------------------------------------
// Attendance (backend/app/schemas/attendance.py)
// ---------------------------------------------------------------------------

export interface StudentAttendance {
  id: string;
  school_id: string;
  section_id: string;
  student_id: string;
  date: string;
  status: AttendanceStatus;
  marked_by: string;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentAttendanceSummary {
  student_id: string;
  total_days: number;
  counts: Record<string, number>;
  percentage_present: number;
}

// ---------------------------------------------------------------------------
// Homework (backend/app/schemas/homework.py)
// ---------------------------------------------------------------------------

export interface Homework {
  id: string;
  school_id: string;
  section_id: string;
  subject_id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  attachment_document_ids: string[];
  assigned_date: string;
  due_date: string;
  created_at: string;
  updated_at: string;
}

export interface PendingHomework extends Homework {
  student_id: string;
}

export interface HomeworkSubmission {
  id: string;
  school_id: string;
  homework_id: string;
  student_id: string;
  status: HomeworkSubmissionStatus;
  submitted_at: string | null;
  attachment_document_ids: string[];
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface HomeworkSubmissionUpdateRequest {
  status?: HomeworkSubmissionStatus;
  attachment_document_ids?: string[];
  remarks?: string;
}

// ---------------------------------------------------------------------------
// Exams (backend/app/schemas/exam.py)
// ---------------------------------------------------------------------------

export interface Exam {
  id: string;
  school_id: string;
  academic_year_id: string;
  name: string;
  term: string | null;
  start_date: string;
  end_date: string;
  class_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface ResultSubject {
  exam_subject_id: string;
  subject_id: string;
  max_marks: number;
  pass_marks: number;
  marks_obtained: number | null;
  grade: string | null;
}

export interface Result {
  exam_id: string;
  student_id: string;
  student_name: string;
  class_id: string;
  section_id: string;
  roll_number: string | null;
  subjects: ResultSubject[];
  total_marks_obtained: number;
  total_max_marks: number;
  percentage: number;
  overall_grade: string;
}

// ---------------------------------------------------------------------------
// Fees (backend/app/schemas/fee.py, backend/app/schemas/payment.py)
// ---------------------------------------------------------------------------

export interface Invoice {
  id: string;
  school_id: string;
  student_id: string;
  academic_year_id: string;
  fee_assignment_ids: string[];
  total_amount: number;
  amount_paid: number;
  outstanding_amount: number;
  due_date: string;
  status: InvoiceStatus;
  created_at: string;
  updated_at: string;
}

export interface PayUInitiateRequest {
  invoice_id: string;
  amount: number;
  return_path?: string;
}

/** Everything needed to auto-submit an HTML form POST straight to PayU's
 * hosted checkout page — PayU's classic flow is a browser redirect via form
 * POST, not a JS SDK modal like Razorpay. */
export interface PayUInitiateResponse {
  payment_id: string;
  invoice_id: string;
  action_url: string;
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  phone: string;
  surl: string;
  furl: string;
  hash: string;
}
