import { Card, PageHeader } from "../../components/ui";
import { useAuthStore } from "../../auth/store";

export default function Settings() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Settings" subtitle="Manage your preferences" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="font-semibold text-[#24113F] dark:text-white mb-4">Account Information</h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-[#7C6F95]">Name</p>
              <p className="text-[#24113F] dark:text-white">{user?.full_name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-[#7C6F95]">Email</p>
              <p className="text-[#24113F] dark:text-white">{user?.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-[#7C6F95]">Role</p>
              <p className="text-[#24113F] dark:text-white">Principal</p>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold text-[#24113F] dark:text-white mb-4">Preferences</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[#24113F] dark:text-white">Email Notifications</p>
                <p className="text-sm text-[#7C6F95]">Receive email updates</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#6D28D9]/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#6D28D9]"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[#24113F] dark:text-white">Push Notifications</p>
                <p className="text-sm text-[#7C6F95]">Receive push notifications</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#6D28D9]/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#6D28D9]"></div>
              </label>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
