import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, ErrorText, Input, Label, PageHeader } from "../../components/ui";
import { api } from "../../api/client";
import { createTeacher } from "./api";
import { useClasses, useSubjects } from "./hooks";
import type { TeacherCreateRequest } from "./types";

const emptyForm: TeacherCreateRequest = {
  first_name: "",
  last_name: "",
  dob: "",
  gender: "",
  phone: "",
  email: "",
  address: "",
  qualifications: [],
  subject_ids: [],
  assigned_class_ids: [],
  joining_date: "",
  status: "ACTIVE",
};

function selectClass(className = "") {
  return `w-full rounded-md border border-violet-200 dark:border-slate-600 bg-violet-50/50 dark:bg-slate-800 px-3 py-2 text-sm text-violet-900 dark:text-slate-100 focus:border-violet-500 dark:focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:bg-white dark:focus:bg-slate-700 ${className}`;
}

export default function TeacherForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<TeacherCreateRequest>(emptyForm);
  const [qualificationsText, setQualificationsText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: subjects } = useSubjects();
  const { data: classes } = useClasses();

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [documents, setDocuments] = useState<{ name: string; file: File | null }[]>([
    { name: "ID Proof", file: null },
    { name: "Address Proof", file: null },
    { name: "Educational Certificates", file: null },
  ]);
  const [uploading, setUploading] = useState(false);

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setPhotoFile(file);
    if (file) {
      setPhotoPreview(URL.createObjectURL(file));
    } else {
      setPhotoPreview(null);
    }
  }

  function handleDocChange(index: number, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setDocuments((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], file };
      return updated;
    });
  }

  async function uploadFile(file: File, module: string): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("module", module);
    const { data } = await api.post("/uploads", formData);
    return data.id;
  }

  const mutation = useMutation({
    mutationFn: createTeacher,
    onSuccess: (teacher) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "teachers"] });
      navigate(`/admin/teachers/${teacher.id}`);
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to create teacher.";
      setError(message);
    },
  });

  function update<K extends keyof TeacherCreateRequest>(key: K, value: TeacherCreateRequest[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSubject(id: string) {
    setForm((prev) => {
      const ids = prev.subject_ids ?? [];
      return { ...prev, subject_ids: ids.includes(id) ? ids.filter((s) => s !== id) : [...ids, id] };
    });
  }

  function toggleClass(id: string) {
    setForm((prev) => {
      const ids = prev.assigned_class_ids ?? [];
      return { ...prev, assigned_class_ids: ids.includes(id) ? ids.filter((c) => c !== id) : [...ids, id] };
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setUploading(true);

    try {
      let photoDocumentId: string | undefined;
      if (photoFile) {
        photoDocumentId = await uploadFile(photoFile, "TEACHER_PHOTO");
      }

      const payload: TeacherCreateRequest = {
        ...form,
        dob: form.dob || null,
        gender: form.gender || null,
        address: form.address || null,
        joining_date: form.joining_date || null,
        qualifications: qualificationsText
          .split(",")
          .map((q) => q.trim())
          .filter(Boolean),
        photo_document_id: photoDocumentId,
      };
      mutation.mutate(payload);
    } catch {
      setError("Failed to upload files.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <PageHeader title="New Teacher" subtitle="Add a new teacher to the school staff." />
      <Card className="max-w-3xl">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>First Name *</Label>
              <Input required value={form.first_name} onChange={(e) => update("first_name", e.target.value)} />
            </div>
            <div>
              <Label>Last Name *</Label>
              <Input required value={form.last_name} onChange={(e) => update("last_name", e.target.value)} />
            </div>
            <div>
              <Label>Date of Birth</Label>
              <Input type="date" value={form.dob ?? ""} onChange={(e) => update("dob", e.target.value)} />
            </div>
            <div>
              <Label>Gender</Label>
              <select className={selectClass()} value={form.gender ?? ""} onChange={(e) => update("gender", e.target.value)}>
                <option value="">Select</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="O">Other</option>
              </select>
            </div>
            <div>
              <Label>Phone *</Label>
              <Input required value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            </div>
            <div>
              <Label>Email *</Label>
              <Input required type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
            </div>
            <div>
              <Label>Joining Date</Label>
              <Input type="date" value={form.joining_date ?? ""} onChange={(e) => update("joining_date", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Address</Label>
              <Input value={form.address ?? ""} onChange={(e) => update("address", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Qualifications (comma separated)</Label>
              <Input value={qualificationsText} onChange={(e) => setQualificationsText(e.target.value)} placeholder="B.Ed, M.Sc Mathematics" />
            </div>
          </div>

          {/* Photo Upload */}
          <div className="border-t border-violet-100 pt-4">
            <Label>Profile Photo</Label>
            <div className="flex items-center gap-4 mt-2">
              <div className="w-24 h-24 rounded-xl bg-violet-50 border-2 border-dashed border-violet-200 flex items-center justify-center overflow-hidden">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-violet-300 text-3xl">👤</span>
                )}
              </div>
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="text-sm text-violet-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-violet-100 file:text-violet-700 hover:file:bg-violet-200"
                />
                <p className="text-xs text-violet-400 mt-1">JPG, PNG up to 5MB</p>
              </div>
            </div>
          </div>

          {/* Documents Upload */}
          <div className="border-t border-violet-100 pt-4">
            <Label>Documents</Label>
            <div className="space-y-3 mt-2">
              {documents.map((doc, idx) => (
                <div key={doc.name} className="flex items-center gap-3 p-3 bg-violet-50/50 rounded-lg">
                  <span className="text-sm font-medium text-violet-700 w-40">{doc.name}</span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleDocChange(idx, e)}
                    className="flex-1 text-sm text-violet-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-violet-100 file:text-violet-700"
                  />
                  {doc.file && <span className="text-green-600 text-sm">✓</span>}
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>Assigned Classes/Grades *</Label>
            <p className="text-xs text-violet-500 dark:text-slate-400 mb-2">
              Select the classes this teacher can manage (attendance, exam results)
            </p>
            <div className="flex flex-wrap gap-2 rounded-md border border-violet-200 dark:border-slate-600 bg-violet-50/30 dark:bg-slate-800/50 p-3">
              {(classes ?? []).length === 0 && (
                <span className="text-sm text-violet-400 dark:text-slate-400">
                  No classes configured. <a href="/admin/academic-setup" className="underline text-amber-600 dark:text-amber-400">Create classes first</a>
                </span>
              )}
              {(classes ?? []).map((c) => {
                const active = (form.assigned_class_ids ?? []).includes(c.id);
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => toggleClass(c.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? "border-emerald-600 bg-emerald-100 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-900/50 dark:text-emerald-300"
                        : "border-violet-300 text-violet-600 hover:bg-violet-100 dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-700"
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label>Subjects</Label>
            <div className="flex flex-wrap gap-2 rounded-md border border-violet-200 dark:border-slate-600 bg-violet-50/30 dark:bg-slate-800/50 p-3">
              {(subjects ?? []).length === 0 && (
                <span className="text-sm text-violet-400 dark:text-slate-400">
                  No subjects configured. <a href="/admin/academic-setup" className="underline text-amber-600 dark:text-amber-400">Create subjects first</a>
                </span>
              )}
              {(subjects ?? []).map((s) => {
                const active = (form.subject_ids ?? []).includes(s.id);
                return (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => toggleSubject(s.id)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? "border-violet-600 bg-violet-100 text-violet-700 dark:border-violet-400 dark:bg-violet-900/50 dark:text-violet-300"
                        : "border-violet-300 text-violet-600 hover:bg-violet-100 dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-700"
                    }`}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>

          <ErrorText>{error}</ErrorText>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => navigate("/admin/teachers")}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || uploading}>
              {uploading ? "Uploading..." : mutation.isPending ? "Creating..." : "Create Teacher"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
