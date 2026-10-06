import { Badge, Card, PageHeader } from "../../components/ui";
import { useAuthStore } from "../../auth/store";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="animate-fade-in-up">
      <p className="text-xs font-medium uppercase tracking-wide text-[#6D28D9] dark:text-[#A78BFA]">{label}</p>
      <p className="mt-0.5 text-sm text-[#24113F] dark:text-white">{value || "—"}</p>
    </div>
  );
}

export default function ParentProfile() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="My Profile" subtitle="Your account information and linked children." />

      <div className="space-y-6">
        {/* Profile Header Card */}
        <Card className="!p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-[#059669] to-[#10B981] p-6">
            <div className="flex items-center gap-6">
              {/* Profile Photo */}
              <div className="relative">
                <div className="w-24 h-24 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border-4 border-white/30 overflow-hidden">
                  <span className="text-4xl font-bold text-white">
                    {user?.full_name?.charAt(0)?.toUpperCase()}
                  </span>
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>

              {/* Profile Info */}
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-1">{user?.full_name}</h2>
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1 bg-white/20 rounded-full backdrop-blur-sm">
                    <p className="text-sm font-medium text-white">Parent / Guardian</p>
                  </div>
                  <Badge tone="green">Active</Badge>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Account Information */}
        <Card className="!p-0 overflow-hidden">
          <div className="p-5 border-b border-[#E5DDF5] dark:border-[#2D1B4E] bg-gradient-to-r from-[#F7F5FF] to-white dark:from-[#1B1230] dark:to-[#231640]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#6D28D9]/10 dark:bg-[#6D28D9]/20 rounded-xl">
                <svg className="w-5 h-5 text-[#6D28D9] dark:text-[#A78BFA]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-[#24113F] dark:text-white">Account Information</h3>
            </div>
          </div>
          <div className="p-6 grid grid-cols-2 gap-6 sm:grid-cols-3">
            <Field label="Full Name" value={user?.full_name} />
            <Field label="Email" value={user?.email} />
            <Field label="Role" value="Parent / Guardian" />
          </div>
        </Card>

        {/* Info Note */}
        <Card className="!bg-[#F7F5FF] dark:!bg-[#231640] !border-[#6D28D9]/20">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-[#6D28D9]/10 rounded-xl">
              <svg className="w-5 h-5 text-[#6D28D9] dark:text-[#A78BFA]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-[#24113F] dark:text-white">Linked Children</p>
              <p className="text-sm text-[#7C6F95] mt-1">
                Your linked children can be selected from the dropdown at the top of the dashboard. Contact the school admin if you need to link additional children to your account.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
