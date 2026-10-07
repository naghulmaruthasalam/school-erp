import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../auth/store";
import { fetchClasses, fetchMyTeacher, fetchMyTimetable, fetchSections, fetchSubjects } from "./api";

/** The current teacher's own teacher_id (from /auth/me, cached in the auth store). */
export function useOwnTeacherId(): string | null {
  return useAuthStore((s) => s.user?.teacher_id ?? null);
}

export function useMyTimetable() {
  const teacherId = useOwnTeacherId();
  return useQuery({
    queryKey: ["teacher", "timetable", teacherId],
    queryFn: () => fetchMyTimetable(teacherId as string),
    enabled: !!teacherId,
  });
}

export function useSections() {
  return useQuery({ queryKey: ["teacher", "sections"], queryFn: fetchSections });
}

export function useClasses() {
  return useQuery({ queryKey: ["teacher", "classes"], queryFn: fetchClasses });
}

export function useSubjects() {
  return useQuery({ queryKey: ["teacher", "subjects"], queryFn: fetchSubjects });
}

const gradeOf = (name?: string) => (name ?? "").match(/\d+/)?.[0] ?? (name ?? "").trim().toLowerCase();

/**
 * The section_ids this teacher teaches: the ones on their timetable, plus every section of the grades
 * they are assigned to (a duplicate "Grade 6" / "Class 6" record counts as the same grade). A teacher
 * whose timetable is not set up yet can still pick a section.
 */
export function useMySectionIds(): string[] {
  const { data: slots } = useMyTimetable();
  const { data: sections } = useSections();
  const { data: classes } = useClasses();
  const teacherId = useOwnTeacherId();
  const { data: me } = useQuery({ queryKey: ["teacher", "me"], queryFn: fetchMyTeacher, enabled: !!teacherId });
  const ids = new Set((slots ?? []).map((s) => s.section_id));
  const grades = new Set((me?.assigned_class_ids ?? []).map((id) => gradeOf(classes?.find((c) => c.id === id)?.name)));
  (sections ?? []).forEach((sec) => {
    if (grades.has(gradeOf(classes?.find((c) => c.id === sec.class_id)?.name))) ids.add(sec.id);
  });
  return Array.from(ids);
}

/** Builds a "Class Name - Section Name" label for a section_id. */
export function sectionLabel(
  sectionId: string,
  sections: { id: string; name: string; class_id: string }[] | undefined,
  classes: { id: string; name: string }[] | undefined,
  te?: (kind: "class" | "section", value: string) => string,
): string {
  const section = sections?.find((s) => s.id === sectionId);
  if (!section) return sectionId;
  const cls = classes?.find((c) => c.id === section.class_id);
  const sectionName = te ? te("section", section.name) : section.name;
  return cls ? `${te ? te("class", cls.name) : cls.name} - ${sectionName}` : sectionName;
}
