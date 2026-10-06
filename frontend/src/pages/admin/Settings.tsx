import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Card, PageHeader, Spinner } from "../../components/ui";
import { api } from "../../api/client";
import { useAuthStore } from "../../auth/store";

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
      alert("School settings updated!");
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async (payload: typeof passwordForm) => {
      await api.post("/auth/change-password", payload);
    },
    onSuccess: () => {
      alert("Password changed successfully!");
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
    },
    onError: () => {
      alert("Failed to change password. Check your current password.");
    },
  });

  const tabs = [
    { key: "school", label: "School Info" },
    { key: "profile", label: "My Profile" },
    { key: "preferences", label: "Preferences" },
  ] as const;

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Settings" subtitle="Manage school and account settings" />

      <Card className="mb-6">
        <div className="flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 rounded-lg font-medium ${
                activeTab === t.key ? "bg-violet-600 text-white" : "text-violet-600 hover:bg-violet-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Card>

      {activeTab === "school" && (
        schoolQuery.isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : (
          <Card>
            <h3 className="font-semibold text-violet-900 mb-4">School Information</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateSchoolMutation.mutate(schoolForm);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-violet-700 mb-1">School Name</label>
                  <input
                    type="text"
                    defaultValue={schoolQuery.data?.name}
                    onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })}
                    className="w-full rounded-lg border border-violet-200 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-violet-700 mb-1">School Code</label>
                  <input
                    type="text"
                    defaultValue={schoolQuery.data?.code}
                    disabled
                    className="w-full rounded-lg border border-violet-200 px-3 py-2 bg-violet-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-violet-700 mb-1">Email</label>
                  <input
                    type="email"
                    defaultValue={schoolQuery.data?.email}
                    onChange={(e) => setSchoolForm({ ...schoolForm, email: e.target.value })}
                    className="w-full rounded-lg border border-violet-200 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-violet-700 mb-1">Phone</label>
                  <input
                    type="text"
                    defaultValue={schoolQuery.data?.phone}
                    onChange={(e) => setSchoolForm({ ...schoolForm, phone: e.target.value })}
                    className="w-full rounded-lg border border-violet-200 px-3 py-2"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-violet-700 mb-1">Address</label>
                  <input
                    type="text"
                    defaultValue={schoolQuery.data?.address}
                    onChange={(e) => setSchoolForm({ ...schoolForm, address: e.target.value })}
                    className="w-full rounded-lg border border-violet-200 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-violet-700 mb-1">City</label>
                  <input
                    type="text"
                    defaultValue={schoolQuery.data?.city}
                    onChange={(e) => setSchoolForm({ ...schoolForm, city: e.target.value })}
                    className="w-full rounded-lg border border-violet-200 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-violet-700 mb-1">State</label>
                  <input
                    type="text"
                    defaultValue={schoolQuery.data?.state}
                    onChange={(e) => setSchoolForm({ ...schoolForm, state: e.target.value })}
                    className="w-full rounded-lg border border-violet-200 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-violet-700 mb-1">Pincode</label>
                  <input
                    type="text"
                    defaultValue={schoolQuery.data?.pincode}
                    onChange={(e) => setSchoolForm({ ...schoolForm, pincode: e.target.value })}
                    className="w-full rounded-lg border border-violet-200 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-violet-700 mb-1">Website</label>
                  <input
                    type="url"
                    defaultValue={schoolQuery.data?.website}
                    onChange={(e) => setSchoolForm({ ...schoolForm, website: e.target.value })}
                    className="w-full rounded-lg border border-violet-200 px-3 py-2"
                  />
                </div>
              </div>
              <Button type="submit" disabled={updateSchoolMutation.isPending}>
                {updateSchoolMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </Card>
        )
      )}

      {activeTab === "profile" && (
        <div className="space-y-6">
          <Card>
            <h3 className="font-semibold text-violet-900 mb-4">Profile Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-violet-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                  className="w-full rounded-lg border border-violet-200 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-violet-700 mb-1">Email</label>
                <input
                  type="email"
                  value={profileForm.email}
                  disabled
                  className="w-full rounded-lg border border-violet-200 px-3 py-2 bg-violet-50"
                />
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold text-violet-900 mb-4">Change Password</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (passwordForm.new_password !== passwordForm.confirm_password) {
                  alert("Passwords don't match!");
                  return;
                }
                updatePasswordMutation.mutate(passwordForm);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-violet-700 mb-1">Current Password</label>
                  <input
                    type="password"
                    value={passwordForm.current_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                    className="w-full rounded-lg border border-violet-200 px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-violet-700 mb-1">New Password</label>
                  <input
                    type="password"
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                    className="w-full rounded-lg border border-violet-200 px-3 py-2"
                    required
                    minLength={8}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-violet-700 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                    className="w-full rounded-lg border border-violet-200 px-3 py-2"
                    required
                  />
                </div>
              </div>
              <Button type="submit" disabled={updatePasswordMutation.isPending}>
                {updatePasswordMutation.isPending ? "Changing..." : "Change Password"}
              </Button>
            </form>
          </Card>
        </div>
      )}

      {activeTab === "preferences" && (
        <Card>
          <h3 className="font-semibold text-violet-900 mb-4">Display Preferences</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-violet-50 rounded-lg">
              <div>
                <p className="font-medium text-violet-900">Dark Mode</p>
                <p className="text-sm text-violet-600">Use the theme toggle in the sidebar</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-violet-50 rounded-lg">
              <div>
                <p className="font-medium text-violet-900">Language</p>
                <p className="text-sm text-violet-600">Currently only English is supported</p>
              </div>
              <select className="rounded-lg border border-violet-200 px-3 py-2" disabled>
                <option>English</option>
              </select>
            </div>
            <div className="flex items-center justify-between p-4 bg-violet-50 rounded-lg">
              <div>
                <p className="font-medium text-violet-900">Date Format</p>
                <p className="text-sm text-violet-600">How dates are displayed</p>
              </div>
              <select className="rounded-lg border border-violet-200 px-3 py-2">
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
