import DocumentImage from "../../components/DocumentImage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, Spinner } from "../../components/ui";
import { api } from "../../api/client";
import { getStudent, updateStudent, updateStudentStatus } from "./api";
import { useAcademicYears, useClasses, useSections } from "./hooks";
import { useLanguage } from "../../i18n/LanguageContext";
import type { StudentStatus, StudentUpdateRequest } from "./types";

const STATUS_OPTIONS: StudentStatus[] = ["ACTIVE", "INACTIVE", "TRANSFERRED", "GRADUATED", "ALUMNI"];

function CredentialsModal({ credentials, onClose }: { credentials: { username?: string; email?: string; password: string }; onClose: () => void }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const loginId = credentials.username || credentials.email || "";

  const copyToClipboard = () => {
    const text = t("admin.credentials.clipboard", { id: loginId, password: credentials.password });
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <h2 className="text-xl font-bold text-ink mb-2">{t("admin.credentials.title")}</h2>
        <p className="text-sm text-accent-fg mb-4">{t("admin.credentials.hint")}</p>

        <div className="bg-violet-50 rounded-lg p-4 mb-4 font-mono text-sm">
          <div className="flex justify-between mb-2">
            <span className="text-accent-fg">{t("admin.credentials.loginId")}</span>
            <span className="text-ink font-medium" dir="ltr">{loginId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-accent-fg">{t("admin.credentials.password")}</span>
            <span className="text-ink font-medium" dir="ltr">{credentials.password}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={copyToClipboard} variant="secondary" className="flex-1">
            {copied ? t("admin.credentials.copied") : t("admin.credentials.copy")}
          </Button>
          <Button onClick={onClose} className="flex-1">
            {t("admin.credentials.done")}
          </Button>
        </div>
      </div>
    </div>
  );
}

const STATUS_TONE: Record<StudentStatus, "gray" | "green" | "red" | "yellow"> = {
  ACTIVE: "green",
  INACTIVE: "gray",
  TRANSFERRED: "yellow",
  GRADUATED: "yellow",
  ALUMNI: "gray",
};

function selectClass(className = "") {
  return `w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink dark:text-slate-100 focus:border-violet-500 dark:focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-500 ${className}`;
}

export default function StudentDetail() {
  const { t, te, fmtDate } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<StudentUpdateRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusChoice, setStatusChoice] = useState<StudentStatus | "">("");
  const [statusNote, setStatusNote] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ username?: string; email?: string; password: string } | null>(null);

  const { data: student, isLoading } = useQuery({
    queryKey: ["admin", "students", id],
    queryFn: () => getStudent(id!),
    enabled: !!id,
  });

  const { data: years } = useAcademicYears();
  const { data: classes } = useClasses(form?.academic_year_id || undefined);
  const { data: sections } = useSections(form?.class_id || undefined);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("module", "STUDENT_PHOTO");
      formData.append("linked_entity_type", "student");
      formData.append("linked_entity_id", id);

      const uploadRes = await api.post("/uploads", formData);
      const docId = uploadRes.data.id;

      await api.patch(`/students/${id}`, { photo_document_id: docId });
      queryClient.invalidateQueries({ queryKey: ["admin", "students", id] });
    } catch (err) {
      console.error("Failed to upload photo:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    if (student && !editing) {
      setForm({
        first_name: student.first_name,
        last_name: student.last_name,
        dob: student.dob,
        gender: student.gender,
        blood_group: student.blood_group,
        academic_year_id: student.academic_year_id,
        class_id: student.class_id,
        section_id: student.section_id,
        roll_number: student.roll_number,
        address: student.address,
        phone: student.phone,
        email: student.email,
      });
    }
  }, [student, editing]);

  const updateMutation = useMutation({
    mutationFn: (payload: StudentUpdateRequest) => updateStudent(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
      setEditing(false);
      setError(null);
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? t("admin.studentDetail.updateFailed");
      setError(message);
    },
  });

  const statusMutation = useMutation({
    mutationFn: () => updateStudentStatus(id!, { status: statusChoice as StudentStatus, note: statusNote || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
      setStatusMessage(t("admin.studentDetail.statusUpdated"));
      setStatusChoice("");
      setStatusNote("");
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? t("admin.studentDetail.statusFailed");
      setStatusMessage(message);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/students/${id}/reset-password`);
      return res.data as { email: string; password: string };
    },
    onSuccess: (data) => {
      setCredentials(data);
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? t("admin.studentDetail.resetFailed");
      alert(message);
    },
  });

  function update<K extends keyof StudentUpdateRequest>(key: K, value: StudentUpdateRequest[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    updateMutation.mutate(form);
  }

  function handleStatusSubmit(e: FormEvent) {
    e.preventDefault();
    if (!statusChoice) return;
    statusMutation.mutate();
  }

  if (isLoading || !student) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      {credentials && (
        <CredentialsModal credentials={credentials} onClose={() => setCredentials(null)} />
      )}
      <PageHeader
        title={student.full_name}
        subtitle={t("admin.studentDetail.admissionNoSubtitle", { no: student.admission_no })}
        actions={
          <div className="flex gap-3">
            <Link to="/admin/students">
              <Button variant="secondary">{t("admin.common.backToList")}</Button>
            </Link>
            {!editing && <Button onClick={() => setEditing(true)}>{t("admin.common.edit")}</Button>}
          </div>
        }
      />

      {/* Profile Header */}
      <Card className="!p-0 overflow-hidden mb-6">
        <div className="bg-gradient-to-r from-accent to-accent-2 p-6">
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
                ) : (
                  <DocumentImage
                    documentId={student.photo_document_id}
                    alt={student.full_name}
                    className="w-full h-full object-cover"
                    fallback={
                      <span className="text-4xl font-bold text-white">
                        {student.full_name?.charAt(0)?.toUpperCase()}
                      </span>
                    }
                  />
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full border-2 border-white/50 flex items-center justify-center transition-colors cursor-pointer"
                title={t("admin.teacherDetail.changePhoto")}
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">{student.full_name}</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-white/20 rounded-full text-sm text-white">{t("admin.teacherDetail.idLabel", { id: student.admission_no })}</span>
                <Badge tone={STATUS_TONE[student.status]}>{te("status", student.status)}</Badge>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {editing && form ? (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>{t("admin.common.firstName")}</Label>
                  <Input value={form.first_name ?? ""} onChange={(e) => update("first_name", e.target.value)} />
                </div>
                <div>
                  <Label>{t("admin.common.lastName")}</Label>
                  <Input value={form.last_name ?? ""} onChange={(e) => update("last_name", e.target.value)} />
                </div>
                <div>
                  <Label>{t("admin.common.dob")}</Label>
                  <Input type="date" value={form.dob ?? ""} onChange={(e) => update("dob", e.target.value)} />
                </div>
                <div>
                  <Label>{t("admin.common.gender")}</Label>
                  <select className={selectClass()} value={form.gender ?? ""} onChange={(e) => update("gender", e.target.value)}>
                    <option value="">{t("admin.common.select")}</option>
                    <option value="M">{t("admin.common.male")}</option>
                    <option value="F">{t("admin.common.female")}</option>
                    <option value="O">{t("admin.common.other")}</option>
                  </select>
                </div>
                <div>
                  <Label>{t("admin.studentForm.bloodGroup")}</Label>
                  <Input value={form.blood_group ?? ""} onChange={(e) => update("blood_group", e.target.value)} />
                </div>
                <div>
                  <Label>{t("admin.studentDetail.rollNumber")}</Label>
                  <Input value={form.roll_number ?? ""} onChange={(e) => update("roll_number", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label>{t("admin.common.academicYear")}</Label>
                  <select
                    className={selectClass()}
                    value={form.academic_year_id ?? ""}
                    onChange={(e) => {
                      update("academic_year_id", e.target.value);
                      update("class_id", "");
                      update("section_id", "");
                    }}
                  >
                    {(years ?? []).map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>{t("admin.common.class")}</Label>
                  <select
                    className={selectClass()}
                    value={form.class_id ?? ""}
                    onChange={(e) => {
                      update("class_id", e.target.value);
                      update("section_id", "");
                    }}
                  >
                    {(classes ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {te("class", c.name)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>{t("admin.common.section")}</Label>
                  <select className={selectClass()} value={form.section_id ?? ""} onChange={(e) => update("section_id", e.target.value)}>
                    {(sections ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {te("section", s.name)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>{t("admin.common.phone")}</Label>
                  <Input value={form.phone ?? ""} onChange={(e) => update("phone", e.target.value)} />
                </div>
                <div>
                  <Label>{t("common.email")}</Label>
                  <Input type="email" value={form.email ?? ""} onChange={(e) => update("email", e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Label>{t("admin.common.address")}</Label>
                  <Input value={form.address ?? ""} onChange={(e) => update("address", e.target.value)} />
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
                  {t("admin.common.cancel")}
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? t("admin.common.saving") : t("admin.common.saveChangesLower")}
                </Button>
              </div>
            </form>
          ) : (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <Field label={t("admin.common.firstName")} value={student.first_name} />
              <Field label={t("admin.common.lastName")} value={student.last_name} />
              <Field label={t("admin.common.dob")} value={student.dob ? fmtDate(student.dob) : "—"} />
              <Field label={t("admin.common.gender")} value={student.gender ? te("gender", student.gender) : "—"} />
              <Field label={t("admin.studentForm.bloodGroup")} value={student.blood_group ?? "—"} ltr />
              <Field label={t("admin.studentDetail.rollNumber")} value={student.roll_number ?? "—"} />
              <Field label={t("admin.studentForm.admissionDate")} value={student.admission_date ? fmtDate(student.admission_date) : "—"} />
              <Field label={t("admin.common.phone")} value={student.phone ?? "—"} ltr />
              <Field label={t("common.email")} value={student.email ?? "—"} ltr />
              <Field label={t("admin.common.address")} value={student.address ?? "—"} />
            </dl>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-ink">{t("admin.studentDetail.loginCredentials")}</h2>
            <p className="text-xs text-accent-fg mb-3">
              {student.email ? t("admin.studentDetail.generateHint") : t("admin.studentDetail.addEmailHint")}
            </p>
            <Button
              onClick={() => resetPasswordMutation.mutate()}
              disabled={!student.email || resetPasswordMutation.isPending}
              className="w-full"
            >
              {resetPasswordMutation.isPending ? t("admin.studentDetail.generating") : t("admin.studentDetail.getReset")}
            </Button>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-ink">{t("admin.studentDetail.changeStatus")}</h2>
          <form className="space-y-3" onSubmit={handleStatusSubmit}>
            <div>
              <Label>{t("admin.studentDetail.newStatus")}</Label>
              <select
                className={selectClass()}
                value={statusChoice}
                onChange={(e) => setStatusChoice(e.target.value as StudentStatus | "")}
              >
                <option value="">{t("admin.studentDetail.selectStatus")}</option>
                {STATUS_OPTIONS.filter((s) => s !== student.status).map((s) => (
                  <option key={s} value={s}>
                    {te("status", s)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>{t("admin.common.note")}</Label>
              <Input value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder={t("admin.studentDetail.optionalNote")} />
            </div>
            <Button type="submit" className="w-full" disabled={!statusChoice || statusMutation.isPending}>
              {statusMutation.isPending ? t("admin.studentDetail.updating") : t("admin.studentDetail.updateStatus")}
            </Button>
            {statusMessage && <p className="text-sm text-ink-2">{statusMessage}</p>}
          </form>
        </Card>
      </div>
    </div>
    </div>
  );
}

function Field({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-accent-fg">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink" dir={ltr ? "ltr" : undefined}>{value}</dd>
    </div>
  );
}
