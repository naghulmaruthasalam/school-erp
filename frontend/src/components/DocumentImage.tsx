import { useState, type ReactNode } from "react";
import { useDocumentUrl } from "../api/files";

/** An <img> for a stored document (profile photos etc.): resolves the short-lived file link first and
 * shows `fallback` (initials, icon...) while loading, when there's no file, or if it fails to load. */
export default function DocumentImage({
  documentId,
  alt,
  className,
  fallback = null,
}: {
  documentId?: string | null;
  alt: string;
  className?: string;
  fallback?: ReactNode;
}) {
  const url = useDocumentUrl(documentId);
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <>{fallback}</>;
  return <img src={url} alt={alt} className={className} onError={() => setFailed(true)} />;
}
