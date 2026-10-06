import { Card, PageHeader } from "../../components/ui";
import Logo from "../../components/Logo";

export default function About() {
  return (
    <div className="animate-fade-in-up">
      <PageHeader title="About" subtitle="Cogniitec AI School ERP Platform" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center gap-4 mb-6">
            <Logo size={64} showWordmark={false} />
            <div>
              <h2 className="text-xl font-bold text-[#24113F] dark:text-white">Cogniitec AI School ERP</h2>
              <p className="text-sm text-[#7C6F95]">Version 1.0.0 - Platform Edition</p>
            </div>
          </div>

          <p className="text-[#4B4260] dark:text-[#D8CCEA] mb-4">
            Multi-tenant school management platform powering educational institutions
            with AI-driven administration tools.
          </p>

          <div className="border-t border-[#E5DDF5] dark:border-[#2D1B4E] pt-4 mt-4">
            <h3 className="font-semibold text-[#24113F] dark:text-white mb-3">Platform Features</h3>
            <ul className="space-y-2 text-sm text-[#4B4260] dark:text-[#D8CCEA]">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6D28D9]"></span>
                Multi-school management
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6D28D9]"></span>
                User administration across schools
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6D28D9]"></span>
                Platform-wide analytics
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6D28D9]"></span>
                Audit logging and compliance
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6D28D9]"></span>
                School onboarding and setup
              </li>
            </ul>
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold text-[#24113F] dark:text-white mb-4">Contact & Support</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-[#7C6F95]">Email</p>
              <p className="text-[#24113F] dark:text-white">platform@cogniitec.com</p>
            </div>
            <div>
              <p className="text-sm font-medium text-[#7C6F95]">Website</p>
              <p className="text-[#24113F] dark:text-white">www.cogniitec.com</p>
            </div>
            <div>
              <p className="text-sm font-medium text-[#7C6F95]">Documentation</p>
              <p className="text-[#24113F] dark:text-white">docs.cogniitec.com</p>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-[#E5DDF5] dark:border-[#2D1B4E]">
            <p className="text-xs text-[#7C6F95]">
              &copy; {new Date().getFullYear()} Cogniitec Technologies. All rights reserved.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
