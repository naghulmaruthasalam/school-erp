import { Card, PageHeader } from "../../components/ui";
import { useAuthStore } from "../../auth/store";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="animate-fade-in-up">
      <p className="text-xs font-medium uppercase tracking-wide text-accent-fg dark:text-accent-fg">{label}</p>
      <p className="mt-0.5 text-sm text-ink dark:text-white">{value || "—"}</p>
    </div>
  );
}

export default function SuperAdminProfile() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="My Profile" subtitle="Your account details and contact information." />

      <div className="space-y-6">
        <Card className="!p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-[#DC2626] to-[#EF4444] p-6">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border-4 border-white/30">
                <span className="text-4xl font-bold text-white">
                  {user?.full_name?.charAt(0)?.toUpperCase() || "S"}
                </span>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-1">{user?.full_name}</h2>
                <div className="px-3 py-1 bg-white/20 rounded-full backdrop-blur-sm inline-block">
                  <p className="text-sm font-medium text-white">Super Administrator</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="!p-0 overflow-hidden">
          <div className="p-5 border-b border-line bg-gradient-to-r from-surface-2 to-white dark:from-surface-2 dark:to-surface">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-xl">
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-ink dark:text-white">Contact Information</h3>
            </div>
          </div>
          <div className="p-6 grid grid-cols-2 gap-6 sm:grid-cols-3">
            <Field label="Email" value={user?.email} />
            <Field label="Phone" value={user?.phone} />
            <Field label="Role" value="Super Admin" />
          </div>
        </Card>
      </div>
    </div>
  );
}
