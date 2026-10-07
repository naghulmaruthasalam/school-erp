import { api } from "../../../api/client";
import type { PageResponse } from "../../../types/common";
import type {
  AcademicYear,
  AcademicYearCreateRequest,
  CalendarEvent,
  CalendarEventCreateRequest,
  ClassCreateRequest,
  SchoolClass,
  Section,
  SectionCreateRequest,
  Subject,
  SubjectCreateRequest,
  TeacherLite,
  TimetableSlot,
  TimetableSlotCreateRequest,
} from "./types";

// ---------------------------------------------------------------------------
// AcademicYear
// ---------------------------------------------------------------------------

export const listAcademicYears = async () => (await api.get<AcademicYear[]>("/academics/years")).data;

export const createAcademicYear = async (payload: AcademicYearCreateRequest) =>
  (await api.post<AcademicYear>("/academics/years", payload)).data;

export const setCurrentAcademicYear = async (id: string) =>
  (await api.patch<AcademicYear>(`/academics/years/${id}`, { is_current: true })).data;

// ---------------------------------------------------------------------------
// Class
// ---------------------------------------------------------------------------

export const listClasses = async (academicYearId?: string) =>
  (
    await api.get<SchoolClass[]>("/academics/classes", {
      params: academicYearId ? { academic_year_id: academicYearId } : {},
    })
  ).data;

export const createClass = async (payload: ClassCreateRequest) =>
  (await api.post<SchoolClass>("/academics/classes", payload)).data;

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

export const listSections = async (classId?: string) =>
  (await api.get<Section[]>("/academics/sections", { params: classId ? { class_id: classId } : {} })).data;

export const createSection = async (payload: SectionCreateRequest) =>
  (await api.post<Section>("/academics/sections", payload)).data;

// ---------------------------------------------------------------------------
// Subject
// ---------------------------------------------------------------------------

export const listSubjects = async () => (await api.get<Subject[]>("/academics/subjects")).data;

export const createSubject = async (payload: SubjectCreateRequest) =>
  (await api.post<Subject>("/academics/subjects", payload)).data;

// ---------------------------------------------------------------------------
// TimetableSlot
// ---------------------------------------------------------------------------

export const listTimetableSlots = async (sectionId: string) =>
  (await api.get<TimetableSlot[]>("/academics/timetable", { params: { section_id: sectionId } })).data;

export const createTimetableSlot = async (payload: TimetableSlotCreateRequest) =>
  (await api.post<TimetableSlot>("/academics/timetable", payload)).data;

// ---------------------------------------------------------------------------
// CalendarEvent
// ---------------------------------------------------------------------------

export const listCalendarEvents = async (academicYearId?: string) =>
  (
    await api.get<CalendarEvent[]>("/academics/calendar", {
      params: academicYearId ? { academic_year_id: academicYearId } : {},
    })
  ).data;

export const createCalendarEvent = async (payload: CalendarEventCreateRequest) =>
  (await api.post<CalendarEvent>("/academics/calendar", payload)).data;

// ---------------------------------------------------------------------------
// Teachers (read-only lookup for selects)
// ---------------------------------------------------------------------------

export const listTeachersLite = async (name?: string) =>
  (
    await api.get<PageResponse<TeacherLite>>("/teachers", {
      params: { page_size: 50, ...(name ? { name } : {}) },
    })
  ).data.items;
