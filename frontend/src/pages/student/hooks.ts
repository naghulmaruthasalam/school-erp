import { useQuery } from "@tanstack/react-query";
import { fetchAcademicYear, fetchClass, fetchMyProfile, fetchSection, fetchSubjects } from "./api";
import type { Subject } from "./types";

/** The logged-in student's own profile — class/section/roll number/admission details. */
export function useMyProfile() {
  return useQuery({ queryKey: ["student", "me"], queryFn: fetchMyProfile });
}

export function useMyClass(classId: string | undefined) {
  return useQuery({
    queryKey: ["student", "class", classId],
    queryFn: () => fetchClass(classId as string),
    enabled: !!classId,
  });
}

export function useMySection(sectionId: string | undefined) {
  return useQuery({
    queryKey: ["student", "section", sectionId],
    queryFn: () => fetchSection(sectionId as string),
    enabled: !!sectionId,
  });
}

export function useMyAcademicYear(yearId: string | undefined) {
  return useQuery({
    queryKey: ["student", "academic-year", yearId],
    queryFn: () => fetchAcademicYear(yearId as string),
    enabled: !!yearId,
  });
}

export function useSubjects() {
  return useQuery({ queryKey: ["student", "subjects"], queryFn: fetchSubjects });
}

/** Map of subject_id -> Subject, for resolving names in homework/timetable/exam rows. */
export function subjectMap(subjects: Subject[] | undefined): Record<string, Subject> {
  const map: Record<string, Subject> = {};
  for (const s of subjects ?? []) map[s.id] = s;
  return map;
}
