// Types mirroring backend/app/schemas/{academic,attendance,homework,exam,student}.py exactly,
// scoped to the fields the Teacher portal needs.

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "EXCUSED";
export type HomeworkSubmissionStatus = "PENDING" | "SUBMITTED" | "LATE";
export type StudentStatus = "ACTIVE" | "INACTIVE" | "TRANSFERRED" | "GRADUATED" | "ALUMNI";

export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "HALF_DAY",
  "EXCUSED",
];

// Backend day_of_week: 0=Monday .. 6=Sunday
export const WEEKDAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// ---------------------------------------------------------------------------
// Academics (lookups)
// ---------------------------------------------------------------------------

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
  day_of_week: number; // 0=Monday .. 6=Sunday
  period_number: number;
  start_time: string; // "HH:MM:SS"
  end_time: string; // "HH:MM:SS"
  subject_id: string;
  teacher_id: string;
}

// ---------------------------------------------------------------------------
// Student (subset)
// ---------------------------------------------------------------------------

export interface Student {
  id: string;
  admission_no: string;
  first_name: string;
  last_name: string;
  full_name: string;
  class_id: string;
  section_id: string;
  roll_number: string | null;
  status: StudentStatus;
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export interface StudentAttendanceMarkItem {
  student_id: string;
  status: AttendanceStatus;
  remarks?: string | null;
}

export interface StudentAttendanceBulkMarkRequest {
  section_id: string;
  date: string; // YYYY-MM-DD
  records: StudentAttendanceMarkItem[];
}

export interface StudentAttendanceOut {
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

// ---------------------------------------------------------------------------
// Homework
// ---------------------------------------------------------------------------

export interface HomeworkCreateRequest {
  section_id: string;
  subject_id: string;
  title: string;
  description?: string | null;
  chapter?: string | null;
  assigned_date: string;
  due_date: string;
  attachment_document_ids?: string[];
}

export interface HomeworkOut {
  id: string;
  school_id: string;
  section_id: string;
  subject_id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  chapter?: string | null;
  attachment_document_ids: string[];
  assigned_date: string;
  due_date: string;
  created_at: string;
  updated_at: string;
}

export interface HomeworkSubmissionOut {
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

// ---------------------------------------------------------------------------
// Exams / Marks
// ---------------------------------------------------------------------------

export interface ExamOut {
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

export interface ExamSubjectOut {
  id: string;
  school_id: string;
  exam_id: string;
  class_id: string;
  subject_id: string;
  max_marks: number;
  pass_marks: number;
  exam_date: string | null;
}

export interface MarkEntryItem {
  student_id: string;
  marks_obtained: number;
  remarks?: string | null;
}

export interface MarkEntryRequest {
  marks: MarkEntryItem[];
}

export interface MarkOut {
  id: string;
  school_id: string;
  exam_id: string;
  exam_subject_id: string;
  student_id: string;
  marks_obtained: number;
  remarks: string | null;
  entered_by: string;
  entered_at: string;
}
