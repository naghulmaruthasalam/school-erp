import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, Spinner } from "../../components/ui";
import { api } from "../../api/client";
import { getTeacher, updateTeacher } from "./api";
import { useClasses, useSubjects } from "./hooks";
import type { TeacherStatus, TeacherUpdateRequest } from "./types";

const STATUS_TONE: Record<TeacherStatus, "gray" | "green" | "red" | "yellow"> = {
  ACTIVE: "green",
  ON_LEAVE: "yellow",
  INACTIVE: "gray",
};

function selectClass(className = "") {
  return `w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink dark:text-slate-100 focus:border-violet-500 dark:focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-500 ${className}`;
}

export default function TeacherDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<TeacherUpdateRequest | null>(null);
  const [qualificationsText, setQualificationsText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: teacher, isLoading } = useQuery({
    queryKey: ["admin", "teachers", id],
    queryFn: () => getTeacher(id!),
    enabled: !!id,
  });

  const { data: subjects } = useSubjects();
  const { data: classes } = useClasses();

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("module", "TEACHER_PHOTO");
      formData.append("linked_entity_type", "teacher");
      formData.append("linked_entity_id", id);

      const uploadRes = await api.post("/uploads", formData);
      const docId = uploadRes.data.id;

      await api.patch(`/teachers/${id}`, { photo_document_id: docId });
      queryClient.invalidateQueries({ queryKey: ["admin", "teachers", id] });
    } catch (err) {
      console.error("Failed to upload photo:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    if (teacher && !editing) {
      setForm({
        employee_no: teacher.employee_no,
        first_name: teacher.first_name,
        last_name: teacher.last_name,
        dob: teacher.dob,
        gender: teacher.gender,
        phone: teacher.phone,
        email: teacher.email ?? undefined,
        address: teacher.address,
        qualifications: teacher.qualifications,
        subject_ids: teacher.subject_ids,
        assigned_class_ids: teacher.assigned_class_ids,
        joining_date: teacher.joining_date,
        status: teacher.status,
      });
      setQualificationsText(teacher.qualifications.join(", "));
    }
  }, [teacher, editing]);

  const updateMutation = useMutation({
    mutationFn: (payload: TeacherUpdateRequest) => updateTeacher(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "teachers"] });
      setEditing(false);
      setError(null);
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to update teacher.";
      setError(message);
    },
  });

  function update<K extends keyof TeacherUpdateRequest>(key: K, value: TeacherUpdateRequest[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function toggleSubject(subjectId: string) {
    setForm((prev) => {
      if (!prev) return prev;
      const ids = prev.subject_ids ?? [];
      return { ...prev, subject_ids: ids.includes(subjectId) ? ids.filter((s) => s !== subjectId) : [...ids, subjectId] };
    });
  }

  function toggleClass(classId: string) {
    setForm((prev) => {
      if (!prev) return prev;
      const ids = prev.assigned_class_ids ?? [];
      return { ...prev, assigned_class_ids: ids.includes(classId) ? ids.filter((c) => c !== classId) : [...ids, classId] };
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    updateMutation.mutate({
      ...form,
      qualifications: qualificationsText
        .split(",")
        .map((q) => q.trim())
        .filter(Boolean),
    });
  }

  if (isLoading || !teacher) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const subjectNameById = new Map((subjects ?? []).map((s) => [s.id, s.name]));
  const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));

  return (
    <div>
      <PageHeader
        title={teacher.full_name}
        subtitle={`Employee No ${teacher.employee_no}`}
        actions={
          <div className="flex gap-3">
            <Link to="/admin/teachers">
              <Button variant="secondary">Back to list</Button>
            </Link>
            {!editing && <Button onClick={() => setEditing(true)}>Edit</Button>}
          </div>
        }
      />

      {/* Profile Header */}
      <Card className="!p-0 overflow-hidden mb-6">
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-6">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <div className="w-24 h-24 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border-4 border-white/30 overflow-hidden">
                {uploading ? (
                  <Spinner />
                ) : teacher.photo_document_id ? (
                  <img
                    src={`/api/v1/uploads/documents/${teacher.photo_document_id}/download`}
                    alt={teacher.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl font-bold text-white">
                    {teacher.full_name?.charAt(0)?.toUpperCase()}
                  </span>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full border-2 border-white/50 flex items-center justify-center transition-colors cursor-pointer"
                title="Change photo"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">{teacher.full_name}</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-white/20 rounded-full text-sm text-white">ID: {teacher.employee_no}</span>
                <Badge tone={STATUS_TONE[teacher.status]}>{teacher.status}</Badge>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="max-w-3xl">
        {editing && form ? (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Employee No</Label>
                <Input value={form.employee_no ?? ""} onChange={(e) => update("employee_no", e.target.value)} />
              </div>
              <div>
                <Label>Status</Label>
                <select
                  className={selectClass()}
                  value={form.status ?? "ACTIVE"}
                  onChange={(e) => update("status", e.target.value as TeacherStatus)}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="ON_LEAVE">ON_LEAVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
              <div>
                <Label>First Name</Label>
                <Input value={form.first_name ?? ""} onChange={(e) => update("first_name", e.target.value)} />
              </div>
              <div>
                <Label>Last Name</Label>
                <Input value={form.last_name ?? ""} onChange={(e) => update("last_name", e.target.value)} />
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
                <Label>Phone</Label>
                <Input value={form.phone ?? ""} onChange={(e) => update("phone", e.target.value)} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email ?? ""} onChange={(e) => update("email", e.target.value)} />
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
                <Input value={qualificationsText} onChange={(e) => setQualificationsText(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Assigned Classes/Grades</Label>
              <p className="text-xs text-accent-fg mb-2">Classes this teacher can manage (attendance, exam results)</p>
              <div className="flex flex-wrap gap-2 rounded-md border border-line p-3">
                {(classes ?? []).length === 0 && <span className="text-sm text-accent-fg">No classes configured yet.</span>}
                {(classes ?? []).map((c) => {
                  const active = (form.assigned_class_ids ?? []).includes(c.id);
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => toggleClass(c.id)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        active ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-line text-ink-2 hover:bg-violet-50"
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
              <div className="flex flex-wrap gap-2 rounded-md border border-line p-3">
                {(subjects ?? []).length === 0 && <span className="text-sm text-accent-fg">No subjects configured yet.</span>}
                {(subjects ?? []).map((s) => {
                  const active = (form.subject_ids ?? []).includes(s.id);
                  return (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => toggleSubject(s.id)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        active ? "border-violet-600 bg-violet-50 text-ink-2" : "border-line text-ink-2 hover:bg-violet-50"
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
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        ) : (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <Field label="First Name" value={teacher.first_name} />
            <Field label="Last Name" value={teacher.last_name} />
            <Field label="Date of Birth" value={teacher.dob ?? "—"} />
            <Field label="Gender" value={teacher.gender ?? "—"} />
            <Field label="Phone" value={teacher.phone} />
            <Field label="Email" value={teacher.email ?? "—"} />
            <Field label="Joining Date" value={teacher.joining_date ?? "—"} />
            <Field label="Address" value={teacher.address ?? "—"} />
            <Field label="Qualifications" value={teacher.qualifications.join(", ") || "—"} />
            <Field
              label="Assigned Classes"
              value={teacher.assigned_class_ids?.map((cid) => classNameById.get(cid) ?? cid).join(", ") || "—"}
            />
            <Field
              label="Subjects"
              value={teacher.subject_ids.map((sid) => subjectNameById.get(sid) ?? sid).join(", ") || "—"}
            />
          </dl>
        )}
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-accent-fg">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}
