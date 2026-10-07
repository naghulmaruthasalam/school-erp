import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

/** A short-lived link to a stored file (S3 presigned URL, or the signed local-storage URL in dev).
 * Files can't be linked by plain <a href>/<img src>: those requests carry no Authorization header,
 * so the API hands out an expiring link instead. */
export async function fetchDocumentUrl(documentId: string): Promise<string | undefined> {
  const { data } = await api.get<{ url?: string }>(`/uploads/${documentId}/url`);
  return data?.url;
}

/** Resolved link for an <img src> / <a href>; undefined while loading or when there is no file. */
export function useDocumentUrl(documentId?: string | null): string | undefined {
  return useQuery({
    queryKey: ["document-url", documentId],
    queryFn: () => fetchDocumentUrl(documentId as string),
    enabled: !!documentId,
    staleTime: 20 * 60 * 1000,
    retry: false,
  }).data;
}

export async function openDocument(documentId: string): Promise<void> {
  const url = await fetchDocumentUrl(documentId);
  if (url) window.open(url, "_blank", "noopener");
}
