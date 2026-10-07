import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, useEffect } from "react";
import { Badge, Card, PageHeader, Spinner } from "../../components/ui";
import { api } from "../../api/client";
import { useLanguage } from "../../i18n/LanguageContext";

interface TeacherProfile {
  id: string;
  employee_no: string;
  first_name: string;
  last_name: string;
  full_name: string;
  dob: string | null;
  gender: string | null;
  phone: string;
  email: string;
  address: string | null;
  qualifications: string[];
  subject_ids: string[];
  joining_date: string | null;
  status: string;
  photo_document_id: string | null;
}

function Field({ label, value, ltr }: { label: string; value: string | null | undefined; ltr?: boolean }) {
  return (
    <div className="animate-fade-in-up">
      <p className="text-xs font-medium uppercase tracking-wide text-accent-fg dark:text-accent-fg">{label}</p>
      <p className="mt-0.5 text-sm text-ink dark:text-white" dir={ltr ? "ltr" : undefined}>{value || "—"}</p>
    </div>
  );
}

export default function TeacherProfile() {
  const { t, te, fmtDate } = useLanguage();
  const formatDate = (iso: string | null): string =>
    iso ? fmtDate(iso, { day: "numeric", month: "long", year: "numeric" }) : "—";
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ["teacher", "my-profile"],
    queryFn: async () => {
      const res = await api.get<TeacherProfile>("/teachers/me");
      return res.data;
    },
  });

  useEffect(() => {
    async function fetchPhotoUrl() {
      if (profile?.photo_document_id) {
        try {
          const res = await api.get<{ url: string }>(`/uploads/${profile.photo_document_id}/url`);
          setPhotoUrl(res.data.url);
        } catch {
          setPhotoUrl(null);
        }
      } else {
        setPhotoUrl(null);
      }
    }
    fetchPhotoUrl();
  }, [profile?.photo_document_id]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("module", "TEACHER_PHOTO");
      formData.append("linked_entity_type", "teacher");
      formData.append("linked_entity_id", profile.id);

      const uploadRes = await api.post<{ id: string }>("/uploads", formData);
      const docId = uploadRes.data.id;

      await api.patch("/teachers/me", { photo_document_id: docId });

      const urlRes = await api.get<{ url: string }>(`/uploads/${docId}/url`);
      setPhotoUrl(urlRes.data.url);

      queryClient.invalidateQueries({ queryKey: ["teacher", "my-profile"] });
    } catch (err) {
      console.error("Failed to upload photo:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={t("profile.title")} subtitle={t("profile.subtitle")} />

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : error || !profile ? (
        <p className="text-sm text-red-600">{t("teacher.profile.loadError")}</p>
      ) : (
        <div className="space-y-6">
          {/* Profile Header Card */}
          <Card className="!p-0 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-6">
              <div className="flex items-center gap-6">
                {/* Profile Photo */}
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
                    ) : photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={profile.full_name}
                        className="w-full h-full object-cover"
                        onError={() => setPhotoUrl(null)}
                      />
                    ) : (
                      <span className="text-4xl font-bold text-white">
                        {profile.full_name?.charAt(0)?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -end-1 w-8 h-8 bg-accent hover:bg-[#5B21B6] rounded-full border-2 border-white flex items-center justify-center transition-colors cursor-pointer"
                    title={t("teacher.profile.changePhoto")}
                  >
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                </div>

                {/* Profile Info */}
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-white mb-1">{profile.full_name}</h2>
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1 bg-white/20 rounded-full backdrop-blur-sm">
                      <p className="text-sm font-medium text-white">{t("teacher.profile.id", { id: profile.employee_no })}</p>
                    </div>
                    <Badge tone={profile.status === "ACTIVE" ? "green" : "gray"}>{te("status", profile.status)}</Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Info */}
            <div className="grid grid-cols-3 divide-x divide-line dark:divide-line">
              <div className="p-4 text-center">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{profile.subject_ids?.length || 0}</p>
                <p className="text-xs text-ink-3 uppercase">{t("profile.subjects")}</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{profile.qualifications?.length || 0}</p>
                <p className="text-xs text-ink-3 uppercase">{t("profile.qualifications")}</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{formatDate(profile.joining_date)}</p>
                <p className="text-xs text-ink-3 uppercase">{t("profile.joined")}</p>
              </div>
            </div>
          </Card>

          {/* Personal Details */}
          <Card className="!p-0 overflow-hidden">
            <div className="p-5 border-b border-line bg-gradient-to-r from-surface-2 to-white dark:from-surface-2 dark:to-surface">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent/10 dark:bg-accent/20 rounded-xl">
                  <svg className="w-5 h-5 text-accent-fg dark:text-accent-fg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-ink dark:text-white">{t("profile.personalDetails")}</h3>
              </div>
            </div>
            <div className="p-6 grid grid-cols-2 gap-6 sm:grid-cols-3">
              <Field label={t("profile.dateOfBirth")} value={formatDate(profile.dob)} />
              <Field label={t("profile.gender")} value={te("gender", profile.gender)} />
              <Field label={t("profile.employeeNo")} value={profile.employee_no} />
            </div>
          </Card>

          {/* Contact Information */}
          <Card className="!p-0 overflow-hidden">
            <div className="p-5 border-b border-line bg-gradient-to-r from-surface-2 to-white dark:from-surface-2 dark:to-surface">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-xl">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-ink dark:text-white">{t("profile.contactInfo")}</h3>
              </div>
            </div>
            <div className="p-6 grid grid-cols-2 gap-6 sm:grid-cols-3">
              <Field label={t("profile.email")} value={profile.email} ltr />
              <Field label={t("profile.phone")} value={profile.phone} ltr />
              <Field label={t("profile.address")} value={profile.address} />
            </div>
          </Card>

          {/* Qualifications */}
          {profile.qualifications && profile.qualifications.length > 0 && (
            <Card className="!p-0 overflow-hidden">
              <div className="p-5 border-b border-line bg-gradient-to-r from-surface-2 to-white dark:from-surface-2 dark:to-surface">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 dark:bg-amber-500/20 rounded-xl">
                    <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-ink dark:text-white">{t("profile.qualifications")}</h3>
                </div>
              </div>
              <div className="p-6">
                <div className="flex flex-wrap gap-2">
                  {profile.qualifications.map((q, i) => (
                    <span key={i} className="px-3 py-1.5 bg-surface-3 text-accent-fg dark:text-accent-fg rounded-full text-sm font-medium">
                      {q}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
