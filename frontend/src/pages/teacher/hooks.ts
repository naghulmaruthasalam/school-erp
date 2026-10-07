import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../auth/store";
import { fetchClasses, fetchMyTimetable, fetchSections, fetchSubjects } from "./api";

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

/** The distinct section_ids this teacher teaches, derived from their timetable slots. */
export function useMySectionIds(): string[] {
  const { data: slots } = useMyTimetable();
  if (!slots) return [];
  return Array.from(new Set(slots.map((s) => s.section_id)));
}

/** Builds a "Class Name - Section Name" label for a section_id. */
export function sectionLabel(
  sectionId: string,
  sections: { id: string; name: string; class_id: string }[] | undefined,
  classes: { id: string; name: string }[] | undefined,
): string {
  const section = sections?.find((s) => s.id === sectionId);
  if (!section) return sectionId;
  const cls = classes?.find((c) => c.id === section.class_id);
  return cls ? `${cls.name} - ${section.name}` : section.name;
}
