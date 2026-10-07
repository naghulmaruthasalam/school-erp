import { useQuery } from "@tanstack/react-query";
import { fetchAcademicYears, fetchClasses, fetchSections, fetchSubjects } from "./api";

/** Shared read-only academic lookups (years/classes/sections/subjects) used to populate selects. */

export function useAcademicYears() {
  return useQuery({ queryKey: ["admin", "academic-years"], queryFn: fetchAcademicYears });
}

export function useClasses(academicYearId?: string) {
  return useQuery({
    queryKey: ["admin", "classes", academicYearId ?? "all"],
    queryFn: () => fetchClasses(academicYearId),
  });
}

export function useSections(classId?: string) {
  return useQuery({
    queryKey: ["admin", "sections", classId ?? "all"],
    queryFn: () => fetchSections(classId),
  });
}

export function useSubjects() {
  return useQuery({ queryKey: ["admin", "subjects"], queryFn: fetchSubjects });
}
