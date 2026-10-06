import { api } from "../api/client";

/** Downloads a file from the user's Copilot history (the endpoint needs the login token, so a plain link won't work). */
export async function downloadCopilotFile(fileId: string, filename: string): Promise<void> {
  const res = await api.get<Blob>(`/copilot/files/${fileId}/download`, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export interface CopilotFileInfo {
  id: string;
  kind: string;
  title: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
}
