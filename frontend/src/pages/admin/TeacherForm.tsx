import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, ErrorText, Input, Label, PageHeader } from "../../components/ui";
import { api } from "../../api/client";
import { createTeacher } from "./api";
import { useClasses, useSubjects } from "./hooks";
import { useLanguage } from "../../i18n/LanguageContext";
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
  return `w-full rounded-md border border-line bg-violet-50/50 dark:bg-surface px-3 py-2 text-sm text-ink dark:text-slate-100 focus:border-violet-500 dark:focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:bg-surface dark:focus:bg-surface-3 ${className}`;
}

export default function TeacherForm() {
  const { t, te } = useLanguage();
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
    { name: "admin.teacherForm.docIdProof", file: null },
    { name: "admin.teacherForm.docAddressProof", file: null },
    { name: "admin.teacherForm.docCertificates", file: null },
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
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? t("admin.teacherForm.createFailed");
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

      const documentIds: string[] = [];
      for (const doc of documents) {
        if (doc.file) documentIds.push(await uploadFile(doc.file, "TEACHER_DOCUMENT"));
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
        document_ids: documentIds,
      };
      mutation.mutate(payload);
    } catch {
      setError(t("admin.forms.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <PageHeader title={t("admin.teacherForm.title")} subtitle={t("admin.teacherForm.subtitle")} />
      <Card className="max-w-3xl">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>{t("admin.forms.firstNameReq")}</Label>
              <Input required value={form.first_name} onChange={(e) => update("first_name", e.target.value)} />
            </div>
            <div>
              <Label>{t("admin.forms.lastNameReq")}</Label>
              <Input required value={form.last_name} onChange={(e) => update("last_name", e.target.value)} />
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
              <Label>{t("admin.forms.phoneReq")}</Label>
              <Input required value={form.phone} onChange={(e) => update("phone", e.target.value)} />
            </div>
            <div>
              <Label>{t("admin.forms.emailReq")}</Label>
              <Input required type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
            </div>
            <div>
              <Label>{t("admin.forms.joiningDate")}</Label>
              <Input type="date" value={form.joining_date ?? ""} onChange={(e) => update("joining_date", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>{t("admin.common.address")}</Label>
              <Input value={form.address ?? ""} onChange={(e) => update("address", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>{t("admin.forms.qualificationsHint")}</Label>
              <Input value={qualificationsText} onChange={(e) => setQualificationsText(e.target.value)} placeholder={t("admin.forms.qualificationsPlaceholder")} />
            </div>
          </div>

          {/* Photo Upload */}
          <div className="border-t border-line pt-4">
            <Label>{t("admin.forms.profilePhoto")}</Label>
            <div className="flex items-center gap-4 mt-2">
              <div className="w-24 h-24 rounded-xl bg-violet-50 border-2 border-dashed border-line flex items-center justify-center overflow-hidden">
                {photoPreview ? (
                  <img src={photoPreview} alt={t("admin.forms.photoPreview")} className="w-full h-full object-cover" />
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
                <p className="text-xs text-accent-fg mt-1">{t("admin.forms.photoHint")}</p>
              </div>
            </div>
          </div>

          {/* Documents Upload */}
          <div className="border-t border-line pt-4">
            <Label>{t("admin.forms.documents")}</Label>
            <div className="space-y-3 mt-2">
              {documents.map((doc, idx) => (
                <div key={doc.name} className="flex items-center gap-3 p-3 bg-violet-50/50 rounded-lg">
                  <span className="text-sm font-medium text-ink-2 w-40">{t(doc.name)}</span>
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

          <div>
            <Label>{t("admin.forms.assignedClasses")}</Label>
            <p className="text-xs text-accent-fg dark:text-ink-3 mb-2">
              {t("admin.forms.assignedClassesHint")}
            </p>
            <div className="flex flex-wrap gap-2 rounded-md border border-line bg-violet-50/30 dark:bg-slate-800/50 p-3">
              {(classes ?? []).length === 0 && (
                <span className="text-sm text-accent-fg dark:text-ink-3">
                  {t("admin.forms.noClassesConfigured")} <a href="/admin/academic-setup" className="underline text-amber-600 dark:text-amber-400">{t("admin.forms.createClassesFirst")}</a>
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
                        : "border-line text-accent-fg hover:bg-violet-100 dark:border-slate-500 dark:text-ink-2 dark:hover:bg-surface-3"
                    }`}
                  >
                    {te("class", c.name)}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label>{t("admin.forms.subjects")}</Label>
            <div className="flex flex-wrap gap-2 rounded-md border border-line bg-violet-50/30 dark:bg-slate-800/50 p-3">
              {(subjects ?? []).length === 0 && (
                <span className="text-sm text-accent-fg dark:text-ink-3">
                  {t("admin.forms.noSubjectsConfigured")} <a href="/admin/academic-setup" className="underline text-amber-600 dark:text-amber-400">{t("admin.forms.createSubjectsFirst")}</a>
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
                        ? "border-violet-600 bg-violet-100 text-ink-2 dark:border-violet-400 dark:bg-violet-900/50 dark:text-ink-2"
                        : "border-line text-accent-fg hover:bg-violet-100 dark:border-slate-500 dark:text-ink-2 dark:hover:bg-surface-3"
                    }`}
                  >
                    {te("subject", s.name)}
                  </button>
                );
              })}
            </div>
          </div>

          <ErrorText>{error}</ErrorText>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => navigate("/admin/teachers")}>
              {t("admin.common.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending || uploading}>
              {uploading ? t("admin.forms.uploading") : mutation.isPending ? t("admin.forms.creating") : t("admin.teacherForm.create")}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
