// Types mirroring backend/app/schemas/academic.py exactly.

export interface AcademicYear {
  id: string;
  school_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

export interface AcademicYearCreateRequest {
  name: string;
  start_date: string;
  end_date: string;
  is_current?: boolean;
}

export interface SchoolClass {
  id: string;
  school_id: string;
  academic_year_id: string;
  name: string;
  order: number;
}

export interface ClassCreateRequest {
  academic_year_id: string;
  name: string;
  order?: number;
}

export interface Section {
  id: string;
  school_id: string;
  class_id: string;
  name: string;
  class_teacher_id: string | null;
  room_no: string | null;
}

export interface SectionCreateRequest {
  class_id: string;
  name: string;
  class_teacher_id?: string | null;
  room_no?: string | null;
}

export interface Subject {
  id: string;
  school_id: string;
  name: string;
  code: string;
}

export interface SubjectCreateRequest {
  name: string;
  code: string;
}

export interface TimetableSlot {
  id: string;
  school_id: string;
  section_id: string;
  day_of_week: number; // 0=Monday .. 6=Sunday
  period_number: number;
  start_time: string; // "HH:MM" or "HH:MM:SS"
  end_time: string;
  subject_id: string;
  teacher_id: string;
}

export interface TimetableSlotCreateRequest {
  section_id: string;
  day_of_week: number;
  period_number: number;
  start_time: string;
  end_time: string;
  subject_id: string;
  teacher_id: string;
}

export type CalendarEventType = "HOLIDAY" | "EXAM" | "EVENT" | "OTHER";

export interface CalendarEvent {
  id: string;
  school_id: string;
  academic_year_id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_type: CalendarEventType;
}

export interface CalendarEventCreateRequest {
  academic_year_id: string;
  title: string;
  description?: string | null;
  event_date: string;
  event_type: CalendarEventType;
}

/** Minimal shape we read off GET /teachers for populating selects. */
export interface TeacherLite {
  id: string;
  full_name: string;
  employee_no: string;
}

export const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
