import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Card, PageHeader, Spinner } from "../../components/ui";
import { api } from "../../api/client";
import { useAuthStore } from "../../auth/store";
import { useLanguage } from "../../i18n/LanguageContext";

interface SchoolSettings {
  id: string;
  name: string;
  code: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  website: string;
  logo_url: string;
  academic_year_start_month: number;
  currency: string;
  timezone: string;
}

export default function Settings() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<"school" | "profile" | "preferences">("school");

  const [profileForm, setProfileForm] = useState({
    full_name: user?.full_name || "",
    email: user?.email || "",
    phone: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const schoolQuery = useQuery({
    queryKey: ["school-settings"],
    queryFn: async () => {
      const { data } = await api.get<SchoolSettings>("/schools/current");
      return data;
    },
  });

  const [schoolForm, setSchoolForm] = useState<Partial<SchoolSettings>>({});

  const updateSchoolMutation = useMutation({
    mutationFn: async (payload: Partial<SchoolSettings>) => {
      const { data } = await api.patch("/schools/current", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["school-settings"] });
      alert(t("admin.settings.updated"));
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async (payload: typeof passwordForm) => {
      await api.post("/auth/change-password", payload);
    },
    onSuccess: () => {
      alert(t("admin.settings.passwordChanged"));
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
    },
    onError: () => {
      alert(t("admin.settings.passwordFailed"));
    },
  });

  const tabs = [
    { key: "school", labelKey: "admin.settings.tabSchool" },
    { key: "profile", labelKey: "admin.settings.tabProfile" },
    { key: "preferences", labelKey: "admin.settings.tabPreferences" },
  ] as const;

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={t("admin.settings.title")} subtitle={t("admin.settings.subtitle")} />

      <Card className="mb-6">
        <div className="flex gap-2">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setActiveTab(tb.key)}
              className={`px-4 py-2 rounded-lg font-medium ${
                activeTab === tb.key ? "bg-violet-600 text-white" : "text-accent-fg hover:bg-violet-50"
              }`}
            >
              {t(tb.labelKey)}
            </button>
          ))}
        </div>
      </Card>

      {activeTab === "school" && (
        schoolQuery.isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : (
          <Card>
            <h3 className="font-semibold text-ink mb-4">{t("admin.settings.schoolInfo")}</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateSchoolMutation.mutate(schoolForm);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-1">{t("admin.settings.schoolName")}</label>
                  <input
                    type="text"
                    defaultValue={schoolQuery.data?.name}
                    onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })}
                    className="w-full rounded-lg border border-line px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-1">{t("admin.settings.schoolCode")}</label>
                  <input
                    type="text"
                    defaultValue={schoolQuery.data?.code}
                    disabled
                    className="w-full rounded-lg border border-line px-3 py-2 bg-violet-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-1">{t("common.email")}</label>
                  <input
                    type="email"
                    defaultValue={schoolQuery.data?.email}
                    onChange={(e) => setSchoolForm({ ...schoolForm, email: e.target.value })}
                    className="w-full rounded-lg border border-line px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-1">{t("admin.settings.phone")}</label>
                  <input
                    type="text"
                    defaultValue={schoolQuery.data?.phone}
                    onChange={(e) => setSchoolForm({ ...schoolForm, phone: e.target.value })}
                    className="w-full rounded-lg border border-line px-3 py-2"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-ink-2 mb-1">{t("admin.common.address")}</label>
                  <input
                    type="text"
                    defaultValue={schoolQuery.data?.address}
                    onChange={(e) => setSchoolForm({ ...schoolForm, address: e.target.value })}
                    className="w-full rounded-lg border border-line px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-1">{t("admin.common.city")}</label>
                  <input
                    type="text"
                    defaultValue={schoolQuery.data?.city}
                    onChange={(e) => setSchoolForm({ ...schoolForm, city: e.target.value })}
                    className="w-full rounded-lg border border-line px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-1">{t("admin.settings.state")}</label>
                  <input
                    type="text"
                    defaultValue={schoolQuery.data?.state}
                    onChange={(e) => setSchoolForm({ ...schoolForm, state: e.target.value })}
                    className="w-full rounded-lg border border-line px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-1">{t("admin.settings.pincode")}</label>
                  <input
                    type="text"
                    defaultValue={schoolQuery.data?.pincode}
                    onChange={(e) => setSchoolForm({ ...schoolForm, pincode: e.target.value })}
                    className="w-full rounded-lg border border-line px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-1">{t("admin.settings.website")}</label>
                  <input
                    type="url"
                    defaultValue={schoolQuery.data?.website}
                    onChange={(e) => setSchoolForm({ ...schoolForm, website: e.target.value })}
                    className="w-full rounded-lg border border-line px-3 py-2"
                  />
                </div>
              </div>
              <Button type="submit" disabled={updateSchoolMutation.isPending}>
                {updateSchoolMutation.isPending ? t("admin.common.saving") : t("admin.common.saveChanges")}
              </Button>
            </form>
          </Card>
        )
      )}

      {activeTab === "profile" && (
        <div className="space-y-6">
          <Card>
            <h3 className="font-semibold text-ink mb-4">{t("admin.settings.profileInfo")}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">{t("admin.settings.fullName")}</label>
                <input
                  type="text"
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                  className="w-full rounded-lg border border-line px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">{t("common.email")}</label>
                <input
                  type="email"
                  value={profileForm.email}
                  disabled
                  className="w-full rounded-lg border border-line px-3 py-2 bg-violet-50"
                />
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold text-ink mb-4">{t("admin.settings.changePassword")}</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (passwordForm.new_password !== passwordForm.confirm_password) {
                  alert(t("admin.settings.passwordMismatch"));
                  return;
                }
                updatePasswordMutation.mutate(passwordForm);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-1">{t("admin.settings.currentPassword")}</label>
                  <input
                    type="password"
                    value={passwordForm.current_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                    className="w-full rounded-lg border border-line px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-1">{t("admin.settings.newPassword")}</label>
                  <input
                    type="password"
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                    className="w-full rounded-lg border border-line px-3 py-2"
                    required
                    minLength={8}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-2 mb-1">{t("admin.settings.confirmPassword")}</label>
                  <input
                    type="password"
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                    className="w-full rounded-lg border border-line px-3 py-2"
                    required
                  />
                </div>
              </div>
              <Button type="submit" disabled={updatePasswordMutation.isPending}>
                {updatePasswordMutation.isPending ? t("admin.settings.changing") : t("admin.settings.changePassword")}
              </Button>
            </form>
          </Card>
        </div>
      )}

      {activeTab === "preferences" && (
        <Card>
          <h3 className="font-semibold text-ink mb-4">{t("admin.settings.displayPrefs")}</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-violet-50 rounded-lg">
              <div>
                <p className="font-medium text-ink">{t("admin.settings.darkMode")}</p>
                <p className="text-sm text-accent-fg">{t("admin.settings.darkModeHint")}</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-violet-50 rounded-lg">
              <div>
                <p className="font-medium text-ink">{t("admin.settings.language")}</p>
                <p className="text-sm text-accent-fg">{t("admin.settings.languageHint")}</p>
              </div>
              <select className="rounded-lg border border-line px-3 py-2" disabled>
                <option>{language === "ar" ? t("common.arabic") : t("common.english")}</option>
              </select>
            </div>
            <div className="flex items-center justify-between p-4 bg-violet-50 rounded-lg">
              <div>
                <p className="font-medium text-ink">{t("admin.settings.dateFormat")}</p>
                <p className="text-sm text-accent-fg">{t("admin.settings.dateFormatHint")}</p>
              </div>
              <select className="rounded-lg border border-line px-3 py-2">
                <option>DD/MM/YYYY</option>
                <option>MM/DD/YYYY</option>
                <option>YYYY-MM-DD</option>
              </select>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
