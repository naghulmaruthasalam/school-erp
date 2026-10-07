import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, ErrorText, Input, Label, PageHeader } from "../../components/ui";
import { api } from "../../api/client";
import { createStudent } from "./api";
import { useAcademicYears, useClasses, useSections } from "./hooks";
import type { StudentCreateRequest } from "./types";

function CredentialsModal({ credentials, onClose, studentId }: { credentials: { username?: string; email?: string; password: string }; onClose: () => void; studentId: string }) {
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const loginId = credentials.username || credentials.email || "";

  const copyToClipboard = () => {
    const text = `Login Credentials\nLogin ID: ${loginId}\nPassword: ${credentials.password}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <h2 className="text-xl font-bold text-ink mb-2">Student Login Credentials</h2>
        <p className="text-sm text-accent-fg mb-4">Share these credentials with the student. They will be asked to change password on first login.</p>

        <div className="bg-violet-50 rounded-lg p-4 mb-4 font-mono text-sm">
          <div className="flex justify-between mb-2">
            <span className="text-accent-fg">Login ID:</span>
            <span className="text-ink font-medium">{loginId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-accent-fg">Password:</span>
            <span className="text-ink font-medium">{credentials.password}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={copyToClipboard} variant="secondary" className="flex-1">
            {copied ? "Copied!" : "Copy Credentials"}
          </Button>
          <Button onClick={() => { onClose(); navigate(`/admin/students/${studentId}`); }} className="flex-1">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

const emptyForm: StudentCreateRequest = {
  first_name: "",
  last_name: "",
  dob: "",
  gender: "",
  blood_group: "",
  academic_year_id: "",
  class_id: "",
  section_id: "",
  roll_number: "",
  admission_date: "",
  address: "",
  phone: "",
  email: "",
};

function selectClass(className = "") {
  return `w-full rounded-md border border-line bg-violet-50/50 dark:bg-surface px-3 py-2 text-sm text-ink dark:text-slate-100 focus:border-violet-500 dark:focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:bg-surface dark:focus:bg-surface-3 disabled:opacity-50 disabled:cursor-not-allowed ${className}`;
}

export default function StudentForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<StudentCreateRequest>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ username?: string; email?: string; password: string; studentId: string } | null>(null);

  const { data: years, isLoading: yearsLoading } = useAcademicYears();
  const { data: allClasses } = useClasses(); // fetch all to check if any exist
  const { data: classes, isLoading: classesLoading } = useClasses(form.academic_year_id || undefined);
  const { data: sections, isLoading: sectionsLoading } = useSections(form.class_id || undefined);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [documents, setDocuments] = useState<{ name: string; file: File | null }[]>([
    { name: "Birth Certificate", file: null },
    { name: "Transfer Certificate", file: null },
    { name: "Previous Report Card", file: null },
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
    mutationFn: createStudent,
    onSuccess: (student: { id: string; credentials?: { email: string; password: string } }) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
      if (student.credentials) {
        setCredentials({ ...student.credentials, studentId: student.id });
      } else {
        navigate(`/admin/students/${student.id}`);
      }
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to create student.";
      setError(message);
    },
  });

  function update<K extends keyof StudentCreateRequest>(key: K, value: StudentCreateRequest[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.academic_year_id || !form.class_id || !form.section_id) {
      setError("Academic year, class and section are required.");
      return;
    }
    setUploading(true);

    try {
      let photoDocumentId: string | undefined;
      if (photoFile) {
        photoDocumentId = await uploadFile(photoFile, "STUDENT_PHOTO");
      }

      const documentIds: string[] = [];
      for (const doc of documents) {
        if (doc.file) documentIds.push(await uploadFile(doc.file, "STUDENT_DOCUMENT"));
      }

      const payload: StudentCreateRequest = {
        ...form,
        dob: form.dob || null,
        gender: form.gender || null,
        blood_group: form.blood_group || null,
        roll_number: form.roll_number || null,
        admission_date: form.admission_date || null,
        address: form.address || null,
        phone: form.phone || null,
        email: form.email || null,
        photo_document_id: photoDocumentId,
        document_ids: documentIds,
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
      {credentials && (
        <CredentialsModal
          credentials={credentials}
          studentId={credentials.studentId}
          onClose={() => setCredentials(null)}
        />
      )}
      <PageHeader title="New Student" subtitle="Enroll a new student into an academic year, class and section." />
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
              <Label>Blood Group</Label>
              <Input value={form.blood_group ?? ""} onChange={(e) => update("blood_group", e.target.value)} placeholder="e.g. O+" />
            </div>
            <div>
              <Label>Admission Date</Label>
              <Input type="date" value={form.admission_date ?? ""} onChange={(e) => update("admission_date", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label>Academic Year *</Label>
              <select
                className={selectClass()}
                required
                value={form.academic_year_id}
                onChange={(e) => {
                  update("academic_year_id", e.target.value);
                  update("class_id", "");
                  update("section_id", "");
                }}
              >
                <option value="">Select year</option>
                {(years ?? []).map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </select>
              {!yearsLoading && (years ?? []).length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  No academic years. <a href="/admin/academic-setup" className="underline">Create one first</a>
                </p>
              )}
            </div>
            <div>
              <Label>Class *</Label>
              <select
                className={selectClass()}
                required
                value={form.class_id}
                disabled={!form.academic_year_id}
                onChange={(e) => {
                  update("class_id", e.target.value);
                  update("section_id", "");
                }}
              >
                <option value="">Select class</option>
                {(classes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {form.academic_year_id && !classesLoading && (classes ?? []).length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  {(allClasses ?? []).length > 0
                    ? "No classes for this academic year. Create classes for this year in Academic Setup."
                    : <>No classes found. <a href="/admin/academic-setup" className="underline">Create classes first</a></>
                  }
                </p>
              )}
            </div>
            <div>
              <Label>Section *</Label>
              <select
                className={selectClass()}
                required
                value={form.section_id}
                disabled={!form.class_id}
                onChange={(e) => update("section_id", e.target.value)}
              >
                <option value="">Select section</option>
                {(sections ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {form.class_id && !sectionsLoading && (sections ?? []).length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  No sections for this class. <a href="/admin/academic-setup" className="underline">Create sections first</a>
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Phone</Label>
              <Input value={form.phone ?? ""} onChange={(e) => update("phone", e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email ?? ""} onChange={(e) => update("email", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Address</Label>
              <Input value={form.address ?? ""} onChange={(e) => update("address", e.target.value)} />
            </div>
          </div>

          {/* Photo Upload */}
          <div className="border-t border-line pt-4">
            <Label>Student Photo</Label>
            <div className="flex items-center gap-4 mt-2">
              <div className="w-24 h-24 rounded-xl bg-violet-50 border-2 border-dashed border-line flex items-center justify-center overflow-hidden">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-ink-2 text-3xl">👤</span>
                )}
              </div>
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="text-sm text-accent-fg file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-violet-100 file:text-ink-2 hover:file:bg-violet-200"
                />
                <p className="text-xs text-accent-fg mt-1">JPG, PNG up to 5MB</p>
              </div>
            </div>
          </div>

          {/* Documents Upload */}
          <div className="border-t border-line pt-4">
            <Label>Documents</Label>
            <div className="space-y-3 mt-2">
              {documents.map((doc, idx) => (
                <div key={doc.name} className="flex items-center gap-3 p-3 bg-violet-50/50 rounded-lg">
                  <span className="text-sm font-medium text-ink-2 w-40">{doc.name}</span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleDocChange(idx, e)}
                    className="flex-1 text-sm text-accent-fg file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-violet-100 file:text-ink-2"
                  />
                  {doc.file && <span className="text-green-600 text-sm">✓</span>}
                </div>
              ))}
            </div>
          </div>

          <ErrorText>{error}</ErrorText>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => navigate("/admin/students")}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || uploading}>
              {uploading ? "Uploading..." : mutation.isPending ? "Creating..." : "Create Student"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
