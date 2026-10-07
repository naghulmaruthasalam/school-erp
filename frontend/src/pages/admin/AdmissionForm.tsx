import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, ErrorText, Input, Label, Select } from "../../components/ui";
import { api } from "../../api/client";
import { createAdmission } from "./api";
import { useAcademicYears, useClasses } from "./hooks";
import { useLanguage } from "../../i18n/LanguageContext";
import type { AdmissionCreateRequest } from "./types";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const GUARDIAN_RELATIONSHIPS = ["Father", "Mother", "Grandfather", "Grandmother", "Uncle", "Aunt", "Guardian", "Other"];
const ADMISSION_TYPES = ["New", "Transfer", "Re-admission"];
const PREVIOUS_CLASS_OPTIONS = ["LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

const emptyForm: AdmissionCreateRequest = {
  applicant_first_name: "",
  applicant_middle_name: "",
  applicant_last_name: "",
  dob: "",
  gender: "",
  blood_group: "",
  applying_for_class_id: "",
  academic_year_id: "",
  previous_school: "",
  applicant_email: "",
  father_name: "",
  father_phone: "",
  father_email: "",
  mother_name: "",
  mother_phone: "",
  mother_email: "",
  primary_guardian: "Father",
  guardian_relationship: "Father",
  guardian_name: "",
  guardian_phone: "",
  guardian_email: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  country: "India",
  postal_code: "",
  previous_class: "",
  previous_board: "",
  previous_school_location: "",
  transfer_certificate_no: "",
  admission_type: "New",
};

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b border-line pb-3 mb-4">
      <h3 className="text-lg font-semibold text-ink dark:text-white">{title}</h3>
      {subtitle && <p className="text-sm text-ink-3">{subtitle}</p>}
    </div>
  );
}

export default function AdmissionForm() {
  const { t, te, fmtDate } = useLanguage();
  const optLabel = (prefix: string, v: string) => {
    const k = `${prefix}.${v}`;
    const r = t(k);
    return r === k ? v : r;
  };
  const prevClassLabel = (v: string) => (/^\d+$/.test(v) ? te("class", v) : optLabel("admin.prevClass", v));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AdmissionCreateRequest>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<{ name: string; file: File | null }[]>([
    { name: "admin.admissionForm.docBirth", file: null },
    { name: "admin.admissionForm.docPrevious", file: null },
    { name: "admin.admissionForm.docPhoto", file: null },
    { name: "admin.admissionForm.docAddress", file: null },
    { name: "admin.admissionForm.docGuardianId", file: null },
  ]);

  const { data: academicYears } = useAcademicYears();
  const { data: classes } = useClasses(form.academic_year_id || undefined);

  const mutation = useMutation({
    mutationFn: createAdmission,
    onSuccess: (admission) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "admissions"] });
      navigate(`/admin/admissions/${admission.id}`);
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? t("admin.admissionForm.createFailed");
      setError(message);
    },
  });

  function update<K extends keyof AdmissionCreateRequest>(key: K, value: AdmissionCreateRequest[K]) {
    setForm((prev) => {
      const updated = { ...prev, [key]: value };
      // Auto-fill guardian details based on primary guardian selection
      if (key === "primary_guardian") {
        if (value === "Father") {
          updated.guardian_name = prev.father_name || "";
          updated.guardian_phone = prev.father_phone || "";
          updated.guardian_email = prev.father_email || "";
          updated.guardian_relationship = "Father";
        } else if (value === "Mother") {
          updated.guardian_name = prev.mother_name || "";
          updated.guardian_phone = prev.mother_phone || "";
          updated.guardian_email = prev.mother_email || "";
          updated.guardian_relationship = "Mother";
        } else {
          updated.guardian_name = "";
          updated.guardian_phone = "";
          updated.guardian_email = "";
          updated.guardian_relationship = "";
        }
      }
      // Also update guardian fields when father/mother details change
      if (key === "father_name" && prev.primary_guardian === "Father") {
        updated.guardian_name = value as string;
      }
      if (key === "father_phone" && prev.primary_guardian === "Father") {
        updated.guardian_phone = value as string;
      }
      if (key === "father_email" && prev.primary_guardian === "Father") {
        updated.guardian_email = value as string;
      }
      if (key === "mother_name" && prev.primary_guardian === "Mother") {
        updated.guardian_name = value as string;
      }
      if (key === "mother_phone" && prev.primary_guardian === "Mother") {
        updated.guardian_phone = value as string;
      }
      if (key === "mother_email" && prev.primary_guardian === "Mother") {
        updated.guardian_email = value as string;
      }
      return updated;
    });
  }

  const isOtherGuardian = form.primary_guardian === "Other";

  // Per-section validation
  const [sectionErrors, setSectionErrors] = useState<Record<number, string[]>>({});

  function validateSection(sectionIndex: number): string[] {
    const errors: string[] = [];
    switch (sectionIndex) {
      case 0: // Student Information
        if (!form.applicant_first_name) errors.push(t("admin.admissionForm.v.firstName"));
        if (!form.applicant_last_name) errors.push(t("admin.admissionForm.v.lastName"));
        if (!form.dob) errors.push(t("admin.admissionForm.v.dob"));
        if (!form.gender) errors.push(t("admin.admissionForm.v.gender"));
        if (!form.applying_for_class_id) errors.push(t("admin.admissionForm.v.class"));
        break;
      case 1: // Parent/Guardian
        if (!form.guardian_name && isOtherGuardian) errors.push(t("admin.admissionForm.v.guardianName"));
        if (!form.guardian_phone && isOtherGuardian) errors.push(t("admin.admissionForm.v.guardianPhone"));
        if (form.primary_guardian === "Father" && !form.father_name) errors.push(t("admin.admissionForm.v.fatherName"));
        if (form.primary_guardian === "Father" && !form.father_phone) errors.push(t("admin.admissionForm.v.fatherPhone"));
        if (form.primary_guardian === "Mother" && !form.mother_name) errors.push(t("admin.admissionForm.v.motherName"));
        if (form.primary_guardian === "Mother" && !form.mother_phone) errors.push(t("admin.admissionForm.v.motherPhone"));
        break;
      case 2: // Address
        if (!form.address_line1) errors.push(t("admin.admissionForm.v.address1"));
        if (!form.city) errors.push(t("admin.admissionForm.v.city"));
        if (!form.state) errors.push(t("admin.admissionForm.v.state"));
        if (!form.postal_code) errors.push(t("admin.admissionForm.v.postal"));
        break;
    }
    return errors;
  }

  function validateAllSections(): boolean {
    const allErrors: Record<number, string[]> = {};
    let hasErrors = false;
    for (let i = 0; i < 6; i++) {
      const errors = validateSection(i);
      if (errors.length > 0) {
        allErrors[i] = errors;
        hasErrors = true;
      }
    }
    setSectionErrors(allErrors);
    return !hasErrors;
  }

  function getSectionStatus(index: number): "complete" | "error" | "pending" {
    if (sectionErrors[index]?.length > 0) return "error";
    const errors = validateSection(index);
    if (errors.length === 0) return "complete";
    return "pending";
  }

  function handleFileChange(index: number, e: ChangeEvent<HTMLInputElement>) {
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!validateAllSections()) {
      const firstErrorSection = Object.keys(sectionErrors).map(Number).sort()[0];
      if (firstErrorSection !== undefined) {
        setActiveSection(firstErrorSection);
        setError(t("admin.admissionForm.fixErrors"));
      }
      return;
    }

    // Upload the selected documents first; the application stores their ids.
    let studentPhotoId: string | undefined;
    const documentIds: string[] = [];
    setUploading(true);
    try {
      for (const doc of documents) {
        if (!doc.file) continue;
        if (doc.name === "admin.admissionForm.docPhoto") {
          studentPhotoId = await uploadFile(doc.file, "STUDENT_PHOTO");
        } else {
          documentIds.push(await uploadFile(doc.file, "ADMISSION_DOCUMENT"));
        }
      }
    } catch {
      setError(t("admin.admissionForm.uploadFailed"));
      return;
    } finally {
      setUploading(false);
    }

    const payload: AdmissionCreateRequest = {
      ...form,
      dob: form.dob || null,
      gender: form.gender || null,
      academic_year_id: form.academic_year_id || null,
      applicant_email: form.applicant_email || null,
      father_email: form.father_email || null,
      mother_email: form.mother_email || null,
      guardian_email: form.guardian_email || null,
      student_photo_id: studentPhotoId,
      document_ids: documentIds,
    };
    mutation.mutate(payload);
  }

  const sections = [
    "admin.admissionForm.sec.student",
    "admin.admissionForm.sec.guardian",
    "admin.admissionForm.sec.address",
    "admin.admissionForm.sec.previous",
    "admin.admissionForm.sec.documents",
    "admin.admissionForm.sec.details",
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink dark:text-white">{t("admin.admissionForm.title")}</h1>
        <p className="mt-1 text-sm text-ink-2">{t("admin.admissionForm.subtitle")}</p>
      </div>

      {/* Section Navigation */}
      <div className="mb-6 flex flex-wrap gap-2">
        {sections.map((section, idx) => {
          const status = getSectionStatus(idx);
          return (
            <button
              key={section}
              type="button"
              onClick={() => setActiveSection(idx)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                activeSection === idx
                  ? "bg-accent text-white"
                  : status === "error"
                  ? "bg-red-50 text-red-700 border border-red-300"
                  : status === "complete"
                  ? "bg-green-50 text-green-700 border border-green-300"
                  : "bg-surface text-ink-2 border border-line hover:bg-surface-3 dark:text-ink-2 dark:border-line"
              }`}
            >
              {status === "error" && <span>⚠</span>}
              {status === "complete" && <span>✓</span>}
              {idx + 1}. {t(section)}
            </button>
          );
        })}
      </div>

      <Card className="max-w-4xl">
        <form onSubmit={handleSubmit}>
          {/* Section 1: Student Information */}
          {activeSection === 0 && (
            <div className="space-y-4">
              <SectionHeader title={t("admin.admissionForm.sec.student")} subtitle={t("admin.admissionForm.studentInfoSub")} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label>{t("admin.forms.firstNameReq")}</Label>
                  <Input required value={form.applicant_first_name} onChange={(e) => update("applicant_first_name", e.target.value)} />
                </div>
                <div>
                  <Label>{t("admin.admissionForm.middleName")}</Label>
                  <Input value={form.applicant_middle_name ?? ""} onChange={(e) => update("applicant_middle_name", e.target.value)} />
                </div>
                <div>
                  <Label>{t("admin.forms.lastNameReq")}</Label>
                  <Input required value={form.applicant_last_name} onChange={(e) => update("applicant_last_name", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label>{t("admin.admissionForm.dobReq")}</Label>
                  <Input type="date" required value={form.dob ?? ""} onChange={(e) => update("dob", e.target.value)} />
                </div>
                <div>
                  <Label>{t("admin.admissionForm.genderReq")}</Label>
                  <Select required value={form.gender ?? ""} onChange={(e) => update("gender", e.target.value)}>
                    <option value="">{t("admin.admissionForm.selectGender")}</option>
                    <option value="M">{t("admin.common.male")}</option>
                    <option value="F">{t("admin.common.female")}</option>
                    <option value="O">{t("admin.common.other")}</option>
                  </Select>
                </div>
                <div>
                  <Label>{t("admin.studentForm.bloodGroup")}</Label>
                  <Select value={form.blood_group ?? ""} onChange={(e) => update("blood_group", e.target.value)}>
                    <option value="">{t("admin.admissionForm.selectBlood")}</option>
                    {BLOOD_GROUPS.map((bg) => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>{t("admin.admissionForm.applyingForClassReq")}</Label>
                  <Select required value={form.applying_for_class_id} onChange={(e) => update("applying_for_class_id", e.target.value)}>
                    <option value="">{t("admin.admissionForm.selectClass")}</option>
                    {(classes ?? []).map((c) => (
                      <option key={c.id} value={c.id}>{te("class", c.name)}</option>
                    ))}
                  </Select>
                  {(classes ?? []).length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">{t("admin.admissionForm.noClasses")}</p>
                  )}
                </div>
                <div>
                  <Label>{t("admin.studentForm.academicYearReq")}</Label>
                  <Select value={form.academic_year_id ?? ""} onChange={(e) => update("academic_year_id", e.target.value)}>
                    <option value="">{t("admin.admissionForm.selectYear")}</option>
                    {(academicYears ?? []).map((ay) => (
                      <option key={ay.id} value={ay.id}>{ay.name}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>{t("admin.admissionForm.previousSchool")}</Label>
                  <Input value={form.previous_school ?? ""} onChange={(e) => update("previous_school", e.target.value)} placeholder={t("admin.admissionForm.prevSchoolPlaceholder")} />
                </div>
                <div>
                  <Label>{t("admin.admissionForm.studentEmail")}</Label>
                  <Input type="email" value={form.applicant_email ?? ""} onChange={(e) => update("applicant_email", e.target.value)} placeholder="student@email.com" />
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Parent/Guardian Information */}
          {activeSection === 1 && (
            <div className="space-y-4">
              <SectionHeader title={t("admin.admissionForm.guardianTitle")} subtitle={t("admin.admissionForm.guardianSub")} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label>{t("admin.admissionForm.fatherName")}</Label>
                  <Input value={form.father_name ?? ""} onChange={(e) => update("father_name", e.target.value)} />
                </div>
                <div>
                  <Label>{t("admin.admissionForm.fatherPhone")}</Label>
                  <Input value={form.father_phone ?? ""} onChange={(e) => update("father_phone", e.target.value)} />
                </div>
                <div>
                  <Label>{t("admin.admissionForm.fatherEmail")}</Label>
                  <Input type="email" value={form.father_email ?? ""} onChange={(e) => update("father_email", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label>{t("admin.admissionForm.motherName")}</Label>
                  <Input value={form.mother_name ?? ""} onChange={(e) => update("mother_name", e.target.value)} />
                </div>
                <div>
                  <Label>{t("admin.admissionForm.motherPhone")}</Label>
                  <Input value={form.mother_phone ?? ""} onChange={(e) => update("mother_phone", e.target.value)} />
                </div>
                <div>
                  <Label>{t("admin.admissionForm.motherEmail")}</Label>
                  <Input type="email" value={form.mother_email ?? ""} onChange={(e) => update("mother_email", e.target.value)} />
                </div>
              </div>
              <div className="border-t border-line pt-4 mt-4">
                <p className="text-sm font-medium text-ink dark:text-white mb-3">{t("admin.admissionForm.primaryGuardianDetails")}</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label>{t("admin.admissionForm.primaryGuardianReq")}</Label>
                    <Select required value={form.primary_guardian} onChange={(e) => update("primary_guardian", e.target.value)}>
                      <option value="Father">{t("admin.relationship.Father")}</option>
                      <option value="Mother">{t("admin.relationship.Mother")}</option>
                      <option value="Other">{t("admin.admissionForm.otherGuardian")}</option>
                    </Select>
                  </div>
                  {isOtherGuardian && (
                    <div>
                      <Label>{t("admin.admissionForm.guardianRelationshipReq")}</Label>
                      <Select required value={form.guardian_relationship ?? ""} onChange={(e) => update("guardian_relationship", e.target.value)}>
                        <option value="">{t("admin.admissionForm.selectRelationship")}</option>
                        {GUARDIAN_RELATIONSHIPS.filter(r => r !== "Father" && r !== "Mother").map((rel) => (
                          <option key={rel} value={rel}>{optLabel("admin.relationship", rel)}</option>
                        ))}
                      </Select>
                    </div>
                  )}
                </div>
                {isOtherGuardian ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mt-4">
                    <div>
                      <Label>{t("admin.admissionForm.guardianNameReq")}</Label>
                      <Input required value={form.guardian_name} onChange={(e) => update("guardian_name", e.target.value)} />
                    </div>
                    <div>
                      <Label>{t("admin.admissionForm.guardianPhoneReq")}</Label>
                      <Input required value={form.guardian_phone} onChange={(e) => update("guardian_phone", e.target.value)} />
                    </div>
                    <div>
                      <Label>{t("admin.admissionForm.guardianEmail")}</Label>
                      <Input type="email" value={form.guardian_email ?? ""} onChange={(e) => update("guardian_email", e.target.value)} />
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 p-3 bg-surface-3 rounded-lg">
                    <p className="text-sm text-ink-2">
                      {t("admin.admissionForm.autoFill", { who: optLabel("admin.relationship", form.primary_guardian) })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 3: Address */}
          {activeSection === 2 && (
            <div className="space-y-4">
              <SectionHeader title={t("admin.admissionForm.addressTitle")} subtitle={t("admin.admissionForm.addressSub")} />
              <div>
                <Label>{t("admin.admissionForm.address1Req")}</Label>
                <Input required value={form.address_line1 ?? ""} onChange={(e) => update("address_line1", e.target.value)} placeholder={t("admin.admissionForm.address1Placeholder")} />
              </div>
              <div>
                <Label>{t("admin.admissionForm.address2")}</Label>
                <Input value={form.address_line2 ?? ""} onChange={(e) => update("address_line2", e.target.value)} placeholder={t("admin.admissionForm.address2Placeholder")} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>{t("admin.admissionForm.cityReq")}</Label>
                  <Input required value={form.city ?? ""} onChange={(e) => update("city", e.target.value)} />
                </div>
                <div>
                  <Label>{t("admin.admissionForm.stateReq")}</Label>
                  <Input required value={form.state ?? ""} onChange={(e) => update("state", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>{t("admin.admissionForm.country")}</Label>
                  <Input value={form.country ?? ""} onChange={(e) => update("country", e.target.value)} />
                </div>
                <div>
                  <Label>{t("admin.admissionForm.postalReq")}</Label>
                  <Input required value={form.postal_code ?? ""} onChange={(e) => update("postal_code", e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Previous Academic Information */}
          {activeSection === 3 && (
            <div className="space-y-4">
              <SectionHeader title={t("admin.admissionForm.prevTitle")} subtitle={t("admin.admissionForm.prevSub")} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>{t("admin.admissionForm.previousSchool")}</Label>
                  <Input value={form.previous_school ?? ""} onChange={(e) => update("previous_school", e.target.value)} />
                </div>
                <div>
                  <Label>{t("admin.admissionForm.previousClass")}</Label>
                  <Select value={form.previous_class ?? ""} onChange={(e) => update("previous_class", e.target.value)}>
                    <option value="">{t("admin.admissionForm.selectPrevClass")}</option>
                    {PREVIOUS_CLASS_OPTIONS.map((c) => (
                      <option key={c} value={c}>{prevClassLabel(c)}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>{t("admin.admissionForm.board")}</Label>
                  <Select value={form.previous_board ?? ""} onChange={(e) => update("previous_board", e.target.value)}>
                    <option value="">{t("admin.admissionForm.selectBoard")}</option>
                    <option value="CBSE">{t("admin.board.CBSE")}</option>
                    <option value="ICSE">{t("admin.board.ICSE")}</option>
                    <option value="State Board">{t("admin.board.State Board")}</option>
                    <option value="IB">{t("admin.board.IB")}</option>
                    <option value="Cambridge">{t("admin.board.Cambridge")}</option>
                    <option value="Other">{t("admin.board.Other")}</option>
                  </Select>
                </div>
                <div>
                  <Label>{t("admin.admissionForm.prevLocation")}</Label>
                  <Input value={form.previous_school_location ?? ""} onChange={(e) => update("previous_school_location", e.target.value)} placeholder={t("admin.admissionForm.prevLocationPlaceholder")} />
                </div>
              </div>
              <div>
                <Label>{t("admin.admissionForm.tcNumber")}</Label>
                <Input value={form.transfer_certificate_no ?? ""} onChange={(e) => update("transfer_certificate_no", e.target.value)} placeholder={t("admin.admissionForm.tcPlaceholder")} />
              </div>
            </div>
          )}

          {/* Section 5: Documents */}
          {activeSection === 4 && (
            <div className="space-y-4">
              <SectionHeader title={t("admin.admissionForm.sec.documents")} subtitle={t("admin.admissionForm.docsSub")} />
              <div className="space-y-4">
                {documents.map((doc, idx) => (
                  <div key={doc.name} className="flex items-center gap-4 p-4 border border-line rounded-lg bg-surface-3 dark:bg-surface-2">
                    <div className="flex-1">
                      <Label>{t(doc.name)}</Label>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileChange(idx, e)}
                        className="w-full text-sm text-ink-2 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-accent file:text-white hover:file:bg-[#5B21B6]"
                      />
                    </div>
                    {doc.file && (
                      <span className="text-sm text-emerald-600 font-medium">{t("admin.admissionForm.selected")}</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 p-4 bg-surface-3 rounded-lg">
                <p className="text-sm text-ink-2">
                  <strong>{t("admin.admissionForm.note")}</strong> {t("admin.admissionForm.noteBody")}
                </p>
              </div>
            </div>
          )}

          {/* Section 6: Admission Details */}
          {activeSection === 5 && (
            <div className="space-y-4">
              <SectionHeader title={t("admin.admissionForm.sec.details")} subtitle={t("admin.admissionForm.detailsSub")} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="p-4 bg-surface-3 dark:bg-surface-2 rounded-lg border border-line">
                  <Label>{t("admin.admissionForm.applicationNumber")}</Label>
                  <p className="text-sm text-ink-3 italic">{t("admin.admissionForm.autoOnSubmit")}</p>
                </div>
                <div className="p-4 bg-surface-3 dark:bg-surface-2 rounded-lg border border-line">
                  <Label>{t("admin.admissionForm.applicationDate")}</Label>
                  <p className="text-sm text-ink-3">{fmtDate(new Date())}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>{t("admin.admissionForm.admissionType")}</Label>
                  <Select value={form.admission_type ?? ""} onChange={(e) => update("admission_type", e.target.value)}>
                    {ADMISSION_TYPES.map((type) => (
                      <option key={type} value={type}>{optLabel("admin.admissionType", type)}</option>
                    ))}
                  </Select>
                </div>
                <div className="p-4 bg-surface-3 dark:bg-surface-2 rounded-lg border border-line">
                  <Label>{t("admin.common.status")}</Label>
                  <p className="text-sm font-medium text-amber-500">{t("admin.admissionForm.pending")}</p>
                </div>
              </div>
            </div>
          )}

          <ErrorText>{error}</ErrorText>

          <div className="flex justify-between gap-3 mt-6 pt-6 border-t border-line">
            <div>
              {activeSection > 0 && (
                <Button type="button" variant="secondary" onClick={() => setActiveSection(activeSection - 1)}>
                  {t("admin.admissionForm.previous")}
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => navigate("/admin/admissions")}>
                {t("admin.common.cancel")}
              </Button>
              {activeSection < sections.length - 1 ? (
                <Button type="button" onClick={() => setActiveSection(activeSection + 1)}>
                  {t("admin.admissionForm.next")}
                </Button>
              ) : (
                <Button type="submit" disabled={mutation.isPending || uploading}>
                  {uploading ? t("admin.forms.uploading") : mutation.isPending ? t("admin.admissionForm.submitting") : t("admin.admissionForm.submit")}
                </Button>
              )}
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}
