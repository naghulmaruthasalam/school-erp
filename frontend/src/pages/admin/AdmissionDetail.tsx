import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, Spinner } from "../../components/ui";
import { getAdmission, reviewAdmission } from "./api";
import { useAcademicYears, useClasses, useSections } from "./hooks";
import { api } from "../../api/client";
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

  const classNameById = new Map((classes ?? []).map((c) => [c.id, c.name]));

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
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to review admission.";
      setError(message);
    },
  });

  function handleApprove(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!academicYearId || !sectionId) {
      setError("Academic year and section are required to approve.");
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
        subtitle="Admission application"
        actions={
          <Link to="/admin/admissions">
            <Button variant="secondary">Back to list</Button>
          </Link>
        }
      />

      <div className="mb-4">
        <Badge tone={STATUS_TONE[admission.status]}>{admission.status}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 space-y-6">
          {/* Student Information */}
          <div>
            <h3 className="text-sm font-semibold text-ink mb-3 pb-2 border-b border-line">Student Information</h3>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
              <Field label="Full Name" value={`${admission.applicant_first_name} ${admission.applicant_last_name}`} />
              <Field label="Date of Birth" value={admission.dob ?? "—"} />
              <Field label="Gender" value={admission.gender === "M" ? "Male" : admission.gender === "F" ? "Female" : admission.gender ?? "—"} />
              <Field label="Email" value={admission.applicant_email ?? "—"} />
              <Field label="Applying For Class" value={classNameById.get(admission.applying_for_class_id) ?? admission.applying_for_class_id} />
              <Field label="Application Date" value={new Date(admission.created_at).toLocaleDateString()} />
            </dl>
          </div>

          {/* Guardian Information */}
          <div>
            <h3 className="text-sm font-semibold text-ink mb-3 pb-2 border-b border-line">Guardian Information</h3>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
              <Field label="Guardian Name" value={admission.guardian_name} />
              <Field label="Guardian Phone" value={admission.guardian_phone} />
              <Field label="Guardian Email" value={admission.guardian_email ?? "—"} />
            </dl>
          </div>

          {/* Review Information */}
          {admission.review_notes && (
            <div>
              <h3 className="text-sm font-semibold text-ink mb-3 pb-2 border-b border-line">Review Notes</h3>
              <p className="text-sm text-ink-2">{admission.review_notes}</p>
            </div>
          )}

          {admission.created_student_id && (
            <div className="pt-4 border-t border-line">
              <Link to={`/admin/students/${admission.created_student_id}`} className="text-sm font-medium text-accent-fg hover:underline">
                View enrolled student →
              </Link>
            </div>
          )}
        </Card>

        {canReview && (
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-ink">Review Application</h2>
            <form className="space-y-3" onSubmit={handleApprove}>
              <div>
                <Label>Academic Year *</Label>
                <select
                  className={selectClass()}
                  value={academicYearId}
                  onChange={(e) => {
                    setAcademicYearId(e.target.value);
                    setClassId("");
                    setSectionId("");
                  }}
                >
                  <option value="">Select year</option>
                  {(years ?? []).map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Class</Label>
                <select
                  className={selectClass()}
                  value={classId}
                  disabled={!academicYearId}
                  onChange={(e) => {
                    setClassId(e.target.value);
                    setSectionId("");
                  }}
                >
                  <option value="">Select class</option>
                  {(classes ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Section *</Label>
                <select className={selectClass()} value={sectionId} disabled={!classId} onChange={(e) => setSectionId(e.target.value)}>
                  <option value="">Select section</option>
                  {(sections ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Admission No</Label>
                <Input value={admissionNo} onChange={(e) => setAdmissionNo(e.target.value)} placeholder="Auto-generated if left blank" />
              </div>
              <div>
                <Label>Roll Number</Label>
                <Input value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} />
              </div>
              <div>
                <Label>Review Notes</Label>
                <Input value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Optional" />
              </div>

              <ErrorText>{error}</ErrorText>

              <div className="flex gap-2 pt-1">
                <Button type="submit" className="flex-1" disabled={reviewMutation.isPending}>
                  {reviewMutation.isPending ? "Approving..." : "Approve"}
                </Button>
                <Button type="button" variant="danger" className="flex-1" disabled={reviewMutation.isPending} onClick={handleReject}>
                  Reject
                </Button>
              </div>
            </form>

            {result && (
              <div className="mt-4 rounded-md border border-line bg-violet-50 p-3 text-sm text-ink-2">
                <p className="font-medium text-ink">
                  {result.studentLoginCreated || result.guardianLoginCreated
                    ? "Student and parent accounts created."
                    : "Review recorded."}
                </p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-ink-2">
                  <li>Student login created: {result.studentLoginCreated ? "Yes" : "No"}</li>
                  <li>Guardian login created: {result.guardianLoginCreated ? "Yes" : "No"}</li>
                  {result.notes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
                {admission.created_student_id && (
                  <Button className="mt-3" variant="secondary" onClick={() => navigate(`/admin/students/${admission.created_student_id}`)}>
                    View student
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-accent-fg">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}
