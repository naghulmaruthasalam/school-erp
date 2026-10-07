// Types mirroring backend/app/schemas/{exam,attendance}.py for the pieces the
// Principal dashboard renders directly. Counts for students/teachers/admissions
// are read off PageResponse.total, so those list item shapes aren't needed here.

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

export interface StudentAttendanceOut {
  id: string;
  school_id: string;
  section_id: string;
  student_id: string;
  date: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "EXCUSED" | string;
  marked_by: string;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffAttendanceOut {
  id: string;
  school_id: string;
  teacher_id: string;
  date: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "EXCUSED" | string;
  marked_by: string;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}
