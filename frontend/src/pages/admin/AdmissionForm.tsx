import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, ErrorText, Input, Label, Select } from "../../components/ui";
import { api } from "../../api/client";
import { createAdmission } from "./api";
import { useAcademicYears, useClasses } from "./hooks";
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AdmissionCreateRequest>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<{ name: string; file: File | null }[]>([
    { name: "Birth Certificate", file: null },
    { name: "Previous School/Transfer Certificate", file: null },
    { name: "Student Photo", file: null },
    { name: "Address Proof", file: null },
    { name: "Parent/Guardian ID Proof", file: null },
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
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to create admission.";
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
        if (!form.applicant_first_name) errors.push("First name is required");
        if (!form.applicant_last_name) errors.push("Last name is required");
        if (!form.dob) errors.push("Date of birth is required");
        if (!form.gender) errors.push("Gender is required");
        if (!form.applying_for_class_id) errors.push("Class selection is required");
        break;
      case 1: // Parent/Guardian
        if (!form.guardian_name && isOtherGuardian) errors.push("Guardian name is required");
        if (!form.guardian_phone && isOtherGuardian) errors.push("Guardian phone is required");
        if (form.primary_guardian === "Father" && !form.father_name) errors.push("Father's name is required when Father is primary guardian");
        if (form.primary_guardian === "Father" && !form.father_phone) errors.push("Father's phone is required when Father is primary guardian");
        if (form.primary_guardian === "Mother" && !form.mother_name) errors.push("Mother's name is required when Mother is primary guardian");
        if (form.primary_guardian === "Mother" && !form.mother_phone) errors.push("Mother's phone is required when Mother is primary guardian");
        break;
      case 2: // Address
        if (!form.address_line1) errors.push("Address line 1 is required");
        if (!form.city) errors.push("City is required");
        if (!form.state) errors.push("State is required");
        if (!form.postal_code) errors.push("Postal code is required");
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
        setError("Please fix the errors in highlighted sections.");
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
        if (doc.name === "Student Photo") {
          studentPhotoId = await uploadFile(doc.file, "STUDENT_PHOTO");
        } else {
          documentIds.push(await uploadFile(doc.file, "ADMISSION_DOCUMENT"));
        }
      }
    } catch {
      setError("Failed to upload documents. Please try again.");
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
    "Student Information",
    "Parent/Guardian",
    "Address",
    "Previous Academics",
    "Documents",
    "Admission Details",
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink dark:text-white">New Admission Application</h1>
        <p className="mt-1 text-sm text-ink-2">Fill out the admission form with all required details.</p>
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
              {idx + 1}. {section}
            </button>
          );
        })}
      </div>

      <Card className="max-w-4xl">
        <form onSubmit={handleSubmit}>
          {/* Section 1: Student Information */}
          {activeSection === 0 && (
            <div className="space-y-4">
              <SectionHeader title="Student Information" subtitle="Basic details of the applicant" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label>First Name *</Label>
                  <Input required value={form.applicant_first_name} onChange={(e) => update("applicant_first_name", e.target.value)} />
                </div>
                <div>
                  <Label>Middle Name</Label>
                  <Input value={form.applicant_middle_name ?? ""} onChange={(e) => update("applicant_middle_name", e.target.value)} />
                </div>
                <div>
                  <Label>Last Name *</Label>
                  <Input required value={form.applicant_last_name} onChange={(e) => update("applicant_last_name", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label>Date of Birth *</Label>
                  <Input type="date" required value={form.dob ?? ""} onChange={(e) => update("dob", e.target.value)} />
                </div>
                <div>
                  <Label>Gender *</Label>
                  <Select required value={form.gender ?? ""} onChange={(e) => update("gender", e.target.value)}>
                    <option value="">Select Gender</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="O">Other</option>
                  </Select>
                </div>
                <div>
                  <Label>Blood Group</Label>
                  <Select value={form.blood_group ?? ""} onChange={(e) => update("blood_group", e.target.value)}>
                    <option value="">Select Blood Group</option>
                    {BLOOD_GROUPS.map((bg) => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Applying For Class *</Label>
                  <Select required value={form.applying_for_class_id} onChange={(e) => update("applying_for_class_id", e.target.value)}>
                    <option value="">Select Class</option>
                    {(classes ?? []).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                  {(classes ?? []).length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">No classes found. Please create classes in Academic Setup first.</p>
                  )}
                </div>
                <div>
                  <Label>Academic Year *</Label>
                  <Select value={form.academic_year_id ?? ""} onChange={(e) => update("academic_year_id", e.target.value)}>
                    <option value="">Select Academic Year</option>
                    {(academicYears ?? []).map((ay) => (
                      <option key={ay.id} value={ay.id}>{ay.name}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Previous School</Label>
                  <Input value={form.previous_school ?? ""} onChange={(e) => update("previous_school", e.target.value)} placeholder="Name of previous school (if any)" />
                </div>
                <div>
                  <Label>Student Email</Label>
                  <Input type="email" value={form.applicant_email ?? ""} onChange={(e) => update("applicant_email", e.target.value)} placeholder="student@email.com" />
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Parent/Guardian Information */}
          {activeSection === 1 && (
            <div className="space-y-4">
              <SectionHeader title="Parent / Guardian Information" subtitle="Contact details of parents and guardians" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label>Father's Name</Label>
                  <Input value={form.father_name ?? ""} onChange={(e) => update("father_name", e.target.value)} />
                </div>
                <div>
                  <Label>Father's Phone</Label>
                  <Input value={form.father_phone ?? ""} onChange={(e) => update("father_phone", e.target.value)} />
                </div>
                <div>
                  <Label>Father's Email</Label>
                  <Input type="email" value={form.father_email ?? ""} onChange={(e) => update("father_email", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <Label>Mother's Name</Label>
                  <Input value={form.mother_name ?? ""} onChange={(e) => update("mother_name", e.target.value)} />
                </div>
                <div>
                  <Label>Mother's Phone</Label>
                  <Input value={form.mother_phone ?? ""} onChange={(e) => update("mother_phone", e.target.value)} />
                </div>
                <div>
                  <Label>Mother's Email</Label>
                  <Input type="email" value={form.mother_email ?? ""} onChange={(e) => update("mother_email", e.target.value)} />
                </div>
              </div>
              <div className="border-t border-line pt-4 mt-4">
                <p className="text-sm font-medium text-ink dark:text-white mb-3">Primary Guardian Details</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Primary Guardian *</Label>
                    <Select required value={form.primary_guardian} onChange={(e) => update("primary_guardian", e.target.value)}>
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Other">Other Guardian</option>
                    </Select>
                  </div>
                  {isOtherGuardian && (
                    <div>
                      <Label>Guardian Relationship *</Label>
                      <Select required value={form.guardian_relationship ?? ""} onChange={(e) => update("guardian_relationship", e.target.value)}>
                        <option value="">Select Relationship</option>
                        {GUARDIAN_RELATIONSHIPS.filter(r => r !== "Father" && r !== "Mother").map((rel) => (
                          <option key={rel} value={rel}>{rel}</option>
                        ))}
                      </Select>
                    </div>
                  )}
                </div>
                {isOtherGuardian ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mt-4">
                    <div>
                      <Label>Guardian Name *</Label>
                      <Input required value={form.guardian_name} onChange={(e) => update("guardian_name", e.target.value)} />
                    </div>
                    <div>
                      <Label>Guardian Phone *</Label>
                      <Input required value={form.guardian_phone} onChange={(e) => update("guardian_phone", e.target.value)} />
                    </div>
                    <div>
                      <Label>Guardian Email</Label>
                      <Input type="email" value={form.guardian_email ?? ""} onChange={(e) => update("guardian_email", e.target.value)} />
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 p-3 bg-surface-3 rounded-lg">
                    <p className="text-sm text-ink-2">
                      Guardian details will be auto-filled from {form.primary_guardian}'s information above.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 3: Address */}
          {activeSection === 2 && (
            <div className="space-y-4">
              <SectionHeader title="Address" subtitle="Residential address of the student" />
              <div>
                <Label>Address Line 1 *</Label>
                <Input required value={form.address_line1 ?? ""} onChange={(e) => update("address_line1", e.target.value)} placeholder="House No., Street Name" />
              </div>
              <div>
                <Label>Address Line 2</Label>
                <Input value={form.address_line2 ?? ""} onChange={(e) => update("address_line2", e.target.value)} placeholder="Area, Landmark" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>City *</Label>
                  <Input required value={form.city ?? ""} onChange={(e) => update("city", e.target.value)} />
                </div>
                <div>
                  <Label>State *</Label>
                  <Input required value={form.state ?? ""} onChange={(e) => update("state", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Country</Label>
                  <Input value={form.country ?? ""} onChange={(e) => update("country", e.target.value)} />
                </div>
                <div>
                  <Label>PIN/Postal Code *</Label>
                  <Input required value={form.postal_code ?? ""} onChange={(e) => update("postal_code", e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Previous Academic Information */}
          {activeSection === 3 && (
            <div className="space-y-4">
              <SectionHeader title="Previous Academic Information" subtitle="Details from previous school (if applicable)" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Previous School</Label>
                  <Input value={form.previous_school ?? ""} onChange={(e) => update("previous_school", e.target.value)} />
                </div>
                <div>
                  <Label>Previous Class</Label>
                  <Select value={form.previous_class ?? ""} onChange={(e) => update("previous_class", e.target.value)}>
                    <option value="">Select Previous Class</option>
                    {PREVIOUS_CLASS_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Board</Label>
                  <Select value={form.previous_board ?? ""} onChange={(e) => update("previous_board", e.target.value)}>
                    <option value="">Select Board</option>
                    <option value="CBSE">CBSE</option>
                    <option value="ICSE">ICSE</option>
                    <option value="State Board">State Board</option>
                    <option value="IB">IB</option>
                    <option value="Cambridge">Cambridge</option>
                    <option value="Other">Other</option>
                  </Select>
                </div>
                <div>
                  <Label>Previous School Location</Label>
                  <Input value={form.previous_school_location ?? ""} onChange={(e) => update("previous_school_location", e.target.value)} placeholder="City, State" />
                </div>
              </div>
              <div>
                <Label>Transfer Certificate Number</Label>
                <Input value={form.transfer_certificate_no ?? ""} onChange={(e) => update("transfer_certificate_no", e.target.value)} placeholder="TC Number (if applicable)" />
              </div>
            </div>
          )}

          {/* Section 5: Documents */}
          {activeSection === 4 && (
            <div className="space-y-4">
              <SectionHeader title="Documents" subtitle="Upload required documents for admission" />
              <div className="space-y-4">
                {documents.map((doc, idx) => (
                  <div key={doc.name} className="flex items-center gap-4 p-4 border border-line rounded-lg bg-surface-3 dark:bg-surface-2">
                    <div className="flex-1">
                      <Label>{doc.name}</Label>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileChange(idx, e)}
                        className="w-full text-sm text-ink-2 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-accent file:text-white hover:file:bg-[#5B21B6]"
                      />
                    </div>
                    {doc.file && (
                      <span className="text-sm text-emerald-600 font-medium">✓ Selected</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 p-4 bg-surface-3 rounded-lg">
                <p className="text-sm text-ink-2">
                  <strong>Note:</strong> Accepted formats: PDF, JPG, JPEG, PNG. Maximum file size: 5MB per document.
                </p>
              </div>
            </div>
          )}

          {/* Section 6: Admission Details */}
          {activeSection === 5 && (
            <div className="space-y-4">
              <SectionHeader title="Admission Details" subtitle="Administrative information" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="p-4 bg-surface-3 dark:bg-surface-2 rounded-lg border border-line">
                  <Label>Application Number</Label>
                  <p className="text-sm text-ink-3 italic">Auto-generated on submission</p>
                </div>
                <div className="p-4 bg-surface-3 dark:bg-surface-2 rounded-lg border border-line">
                  <Label>Application Date</Label>
                  <p className="text-sm text-ink-3">{new Date().toLocaleDateString()}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Admission Type</Label>
                  <Select value={form.admission_type ?? ""} onChange={(e) => update("admission_type", e.target.value)}>
                    {ADMISSION_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </Select>
                </div>
                <div className="p-4 bg-surface-3 dark:bg-surface-2 rounded-lg border border-line">
                  <Label>Status</Label>
                  <p className="text-sm font-medium text-amber-500">Pending</p>
                </div>
              </div>
            </div>
          )}

          <ErrorText>{error}</ErrorText>

          <div className="flex justify-between gap-3 mt-6 pt-6 border-t border-line">
            <div>
              {activeSection > 0 && (
                <Button type="button" variant="secondary" onClick={() => setActiveSection(activeSection - 1)}>
                  ← Previous
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => navigate("/admin/admissions")}>
                Cancel
              </Button>
              {activeSection < sections.length - 1 ? (
                <Button type="button" onClick={() => setActiveSection(activeSection + 1)}>
                  Next →
                </Button>
              ) : (
                <Button type="submit" disabled={mutation.isPending || uploading}>
                  {uploading ? "Uploading..." : mutation.isPending ? "Submitting..." : "Submit Application"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}
