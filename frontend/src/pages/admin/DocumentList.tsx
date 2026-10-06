import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Card, PageHeader, Spinner, Badge } from "../../components/ui";
import { api } from "../../api/client";
import type { PageResponse } from "../../types/common";

interface Document {
  id: string;
  filename: string;
  original_filename: string;
  content_type: string;
  size: number;
  category: string;
  uploaded_by: string;
  uploaded_by_name: string;
  created_at: string;
}

const CATEGORIES = [
  "General",
  "Circular",
  "Policy",
  "Form",
  "Report",
  "Certificate",
  "Other",
];

export default function DocumentList() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [uploadCategory, setUploadCategory] = useState("General");

  const documentsQuery = useQuery({
    queryKey: ["documents", selectedCategory],
    queryFn: async () => {
      const { data } = await api.get<PageResponse<Document>>("/uploads/documents", {
        params: selectedCategory ? { category: selectedCategory } : undefined,
      });
      return data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", uploadCategory);
      const { data } = await api.post("/uploads/documents", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/uploads/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (contentType: string) => {
    if (contentType.includes("pdf")) return "📄";
    if (contentType.includes("image")) return "🖼️";
    if (contentType.includes("word") || contentType.includes("document")) return "📝";
    if (contentType.includes("sheet") || contentType.includes("excel")) return "📊";
    return "📎";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
  };

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Document Management" subtitle="Upload and manage school documents" />

      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-violet-700 mb-1">Filter by Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex-1" />
          <div>
            <label className="block text-sm font-medium text-violet-700 mb-1">Upload Category</label>
            <select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value)}
              className="rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="pt-6">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload Document"}
            </Button>
          </div>
        </div>
      </Card>

      {documentsQuery.isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documentsQuery.data?.items.map((doc) => (
            <Card key={doc.id} className="hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-3">
                <div className="text-3xl">{getFileIcon(doc.content_type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-violet-900 truncate" title={doc.original_filename}>
                    {doc.original_filename}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge tone="violet">{doc.category}</Badge>
                    <span className="text-xs text-violet-500">{formatSize(doc.size)}</span>
                  </div>
                  <p className="text-xs text-violet-400 mt-2">
                    By {doc.uploaded_by_name} · {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-violet-100">
                <a
                  href={`${api.defaults.baseURL}/uploads/documents/${doc.id}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-violet-600 hover:underline"
                >
                  Download
                </a>
                <span className="text-violet-300">|</span>
                <button
                  onClick={() => {
                    if (confirm("Delete this document?")) {
                      deleteMutation.mutate(doc.id);
                    }
                  }}
                  className="text-sm text-red-500 hover:underline"
                >
                  Delete
                </button>
              </div>
            </Card>
          ))}
          {documentsQuery.data?.items.length === 0 && (
            <Card className="col-span-full">
              <p className="text-center text-violet-400 py-8">No documents uploaded.</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
