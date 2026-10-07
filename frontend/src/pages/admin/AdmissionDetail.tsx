import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, Spinner } from "../../components/ui";
import { getAdmission, reviewAdmission } from "./api";
import { useAcademicYears, useClasses, useSections } from "./hooks";
import { api } from "../../api/client";
import { useLanguage } from "../../i18n/LanguageContext";
import type { AdmissionStatus } from "./types";

const STATUS_TONE: Record<AdmissionStatus, "gray" | "green" | "red" | "yellow"> = {
  SUBMITTED: "yellow",
  UNDER_REVIEW: "yellow",
  APPROVED: "green",
  REJECTED: "red",
  CONVERTED: "green",
};

function selectClass(className = "") {
  return `w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink dark:text-slate-100 focus:border-violet-500 dark:focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-500 ${className}`;
}

export default function AdmissionDetail() {
  const { t, te, fmtDate } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [academicYearId, setAcademicYearId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [admissionNo, setAdmissionNo] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ studentLoginCreated: boolean; guardianLoginCreated: boolean; notes: string[] } | null>(
    null,
  );

  const { data: admission, isLoading } = useQuery({
    queryKey: ["admin", "admissions", id],
    queryFn: () => getAdmission(id!),
    enabled: !!id,
  });

  // Pre-fill class and generate admission number when admission loads
  useEffect(() => {
    if (admission && !classId && admission.applying_for_class_id) {
      setClassId(admission.applying_for_class_id);
    }
    if (admission && !admissionNo) {
      setAdmissionNo(`ADM${new Date().getFullYear()}${String(Date.now()).slice(-4)}`);
    }
  }, [admission, classId, admissionNo]);

  // Auto-fetch next roll number when section is selected
  useEffect(() => {
    if (sectionId) {
      api.get(`/admissions/next-roll-number/${sectionId}`)
        .then((res) => setRollNumber(res.data.roll_number))
        .catch(() => setRollNumber("1"));
    }
  }, [sectionId]);

  const { data: years } = useAcademicYears();
  const { data: classes } = useClasses(academicYearId || undefined);
  const { data: sections } = useSections(classId || undefined);

  const classNameById = new Map((classes ?? []).map((c) => [c.id, te("class", c.name)]));

  const reviewMutation = useMutation({
    mutationFn: (action: "approve" | "reject") =>
      reviewAdmission(id!, {
        action,
        review_notes: reviewNotes || null,
        academic_year_id: action === "approve" ? academicYearId : undefined,
        section_id: action === "approve" ? sectionId : undefined,
        admission_no: action === "approve" ? admissionNo || undefined : undefined,
        roll_number: action === "approve" ? rollNumber || undefined : undefined,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "admissions"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
      queryClient.setQueryData(["admin", "admissions", id], data.admission);
      setResult({
        studentLoginCreated: data.student_login_created,
        guardianLoginCreated: data.guardian_login_created,
        notes: data.notes,
      });
      setError(null);
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? t("admin.admissionDetail.reviewFailed");
      setError(message);
    },
  });

  function handleApprove(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!academicYearId || !sectionId) {
      setError(t("admin.admissionDetail.approveRequired"));
      return;
    }
    reviewMutation.mutate("approve");
  }

  function handleReject() {
    setError(null);
    reviewMutation.mutate("reject");
  }

  if (isLoading || !admission) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const canReview = admission.status === "SUBMITTED" || admission.status === "UNDER_REVIEW";

  return (
    <div>
      <PageHeader
        title={`${admission.applicant_first_name} ${admission.applicant_last_name}`}
        subtitle={t("admin.admissionDetail.subtitle")}
        actions={
          <Link to="/admin/admissions">
            <Button variant="secondary">{t("admin.common.backToList")}</Button>
          </Link>
        }
      />

      <div className="mb-4">
        <Badge tone={STATUS_TONE[admission.status]}>{te("status", admission.status)}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 space-y-6">
          {/* Student Information */}
          <div>
            <h3 className="text-sm font-semibold text-ink mb-3 pb-2 border-b border-line">{t("admin.admissionDetail.studentInfo")}</h3>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
              <Field label={t("admin.admissionDetail.fullName")} value={`${admission.applicant_first_name} ${admission.applicant_last_name}`} />
              <Field label={t("admin.common.dob")} value={admission.dob ? fmtDate(admission.dob) : "—"} />
              <Field label={t("admin.common.gender")} value={admission.gender === "M" ? t("admin.common.male") : admission.gender === "F" ? t("admin.common.female") : admission.gender ? te("gender", admission.gender) : "—"} />
              <Field label={t("common.email")} value={admission.applicant_email ?? "—"} ltr />
              <Field label={t("admin.admissionDetail.applyingForClass")} value={classNameById.get(admission.applying_for_class_id) ?? admission.applying_for_class_id} />
              <Field label={t("admin.admissionDetail.applicationDate")} value={fmtDate(admission.created_at)} />
              <Field label={t("admin.studentForm.bloodGroup")} value={admission.blood_group || "—"} ltr />
              <Field label={t("admin.admissionDetail.admissionType")} value={admission.admission_type || "—"} />
              <Field label={t("admin.admissionDetail.previousSchool")} value={admission.previous_school || "—"} />
            </dl>
          </div>

          {/* Guardian Information */}
          <div>
            <h3 className="text-sm font-semibold text-ink mb-3 pb-2 border-b border-line">{t("admin.admissionDetail.guardianInfo")}</h3>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
              <Field label={t("admin.admissionDetail.guardianName")} value={admission.guardian_name} />
              <Field label={t("admin.admissionDetail.guardianPhone")} value={admission.guardian_phone} ltr />
              <Field label={t("admin.admissionDetail.guardianEmail")} value={admission.guardian_email ?? "—"} ltr />
              <Field label={t("admin.admissionDetail.relationship")} value={admission.guardian_relationship || admission.primary_guardian || "—"} />
              <Field label={t("admin.admissionDetail.father")} value={admission.father_name || "—"} />
              <Field label={t("admin.admissionDetail.mother")} value={admission.mother_name || "—"} />
              <Field
                label={t("admin.common.address")}
                value={[admission.address_line1, admission.address_line2, admission.city, admission.state, admission.postal_code].filter(Boolean).join(", ") || "—"}
              />
              <Field label={t("admin.common.documents")} value={t("admin.admissionDetail.uploaded", { n: admission.document_ids.length + (admission.student_photo_id ? 1 : 0) })} />
            </dl>
          </div>

          {/* Review Information */}
          {admission.review_notes && (
            <div>
              <h3 className="text-sm font-semibold text-ink mb-3 pb-2 border-b border-line">{t("admin.admissionDetail.reviewNotesTitle")}</h3>
              <p className="text-sm text-ink-2">{admission.review_notes}</p>
            </div>
          )}

          {admission.created_student_id && (
            <div className="pt-4 border-t border-line">
              <Link to={`/admin/students/${admission.created_student_id}`} className="text-sm font-medium text-accent-fg hover:underline">
                {t("admin.admissionDetail.viewEnrolled")}
              </Link>
            </div>
          )}
        </Card>

        {canReview && (
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-ink">{t("admin.admissionDetail.reviewApplication")}</h2>
            <form className="space-y-3" onSubmit={handleApprove}>
              <div>
                <Label>{t("admin.studentForm.academicYearReq")}</Label>
                <select
                  className={selectClass()}
                  value={academicYearId}
                  onChange={(e) => {
                    setAcademicYearId(e.target.value);
                    setClassId("");
                    setSectionId("");
                  }}
                >
                  <option value="">{t("admin.studentForm.selectYear")}</option>
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
                  value={classId}
                  disabled={!academicYearId}
                  onChange={(e) => {
                    setClassId(e.target.value);
                    setSectionId("");
                  }}
                >
                  <option value="">{t("admin.studentForm.selectClass")}</option>
                  {(classes ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {te("class", c.name)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>{t("admin.studentForm.sectionReq")}</Label>
                <select className={selectClass()} value={sectionId} disabled={!classId} onChange={(e) => setSectionId(e.target.value)}>
                  <option value="">{t("admin.studentForm.selectSection")}</option>
                  {(sections ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {te("section", s.name)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>{t("admin.common.admissionNo")}</Label>
                <Input value={admissionNo} onChange={(e) => setAdmissionNo(e.target.value)} placeholder={t("admin.admissionDetail.admissionNoPlaceholder")} />
              </div>
              <div>
                <Label>{t("admin.studentDetail.rollNumber")}</Label>
                <Input value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} />
              </div>
              <div>
                <Label>{t("admin.admissionDetail.reviewNotesTitle")}</Label>
                <Input value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder={t("admin.admissionDetail.optional")} />
              </div>

              <ErrorText>{error}</ErrorText>

              <div className="flex gap-2 pt-1">
                <Button type="submit" className="flex-1" disabled={reviewMutation.isPending}>
                  {reviewMutation.isPending ? t("admin.admissionDetail.approving") : t("admin.admissionDetail.approve")}
                </Button>
                <Button type="button" variant="danger" className="flex-1" disabled={reviewMutation.isPending} onClick={handleReject}>
                  {t("admin.admissionDetail.reject")}
                </Button>
              </div>
            </form>

            {result && (
              <div className="mt-4 rounded-md border border-line bg-violet-50 p-3 text-sm text-ink-2">
                <p className="font-medium text-ink">
                  {result.studentLoginCreated || result.guardianLoginCreated
                    ? t("admin.admissionDetail.accountsCreated")
                    : t("admin.admissionDetail.reviewRecorded")}
                </p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-ink-2">
                  <li>{t("admin.admissionDetail.studentLoginCreated", { v: result.studentLoginCreated ? t("admin.admissionDetail.yes") : t("admin.admissionDetail.no") })}</li>
                  <li>{t("admin.admissionDetail.guardianLoginCreated", { v: result.guardianLoginCreated ? t("admin.admissionDetail.yes") : t("admin.admissionDetail.no") })}</li>
                  {result.notes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
                {admission.created_student_id && (
                  <Button className="mt-3" variant="secondary" onClick={() => navigate(`/admin/students/${admission.created_student_id}`)}>
                    {t("admin.admissionDetail.viewStudent")}
                  </Button>
                )}
              </div>
            )}
          </Card>
        )}
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
