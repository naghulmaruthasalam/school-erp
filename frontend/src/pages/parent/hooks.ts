import { useQuery } from "@tanstack/react-query";
import {
  fetchClasses,
  fetchMyChildren,
  fetchSections,
  fetchSubjects,
} from "./api";

/** All children linked to the signed-in parent. Fetched once and cached. */
export function useMyChildren() {
  return useQuery({ queryKey: ["parent", "my-children"], queryFn: fetchMyChildren });
}

/** Read-only academic lookups, used to resolve class/section/subject names for display. */
export function useClasses() {
  return useQuery({ queryKey: ["parent", "classes"], queryFn: fetchClasses });
}

export function useSections() {
  return useQuery({ queryKey: ["parent", "sections"], queryFn: () => fetchSections() });
}

export function useSubjects() {
  return useQuery({ queryKey: ["parent", "subjects"], queryFn: fetchSubjects });
}
