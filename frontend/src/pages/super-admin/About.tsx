import { Card, PageHeader } from "../../components/ui";
import Logo from "../../components/Logo";

export default function About() {
  return (
    <div className="animate-fade-in-up">
      <PageHeader title="About" subtitle="Capital Private School - مدرسة العاصمة الخاصة" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center gap-4 mb-6">
            <Logo size={64} showWordmark={false} />
            <div>
              <h2 className="text-xl font-bold text-ink dark:text-white">Capital Private School</h2>
              <p className="text-sm text-ink-3">Version 1.0.0 - Platform Edition</p>
            </div>
          </div>

          <p className="text-ink-2 mb-4">
            Multi-tenant school management platform powering educational institutions
            with AI-driven administration tools.
          </p>

          <div className="border-t border-line pt-4 mt-4">
            <h3 className="font-semibold text-ink dark:text-white mb-3">Platform Features</h3>
            <ul className="space-y-2 text-sm text-ink-2">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                Multi-school management
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                User administration across schools
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                Platform-wide analytics
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                Audit logging and compliance
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                School onboarding and setup
              </li>
            </ul>
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold text-ink dark:text-white mb-4">Contact & Support</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-ink-3">Email</p>
              <p className="text-ink dark:text-white">info@capitalschool.om</p>
            </div>
            <div>
              <p className="text-sm font-medium text-ink-3">Address</p>
              <p className="text-ink dark:text-white">Al Maha St, Muscat, Oman</p>
            </div>
            <div>
              <p className="text-sm font-medium text-ink-3">Phone</p>
              <p className="text-ink dark:text-white">+968 9980 1655</p>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-line">
            <p className="text-xs text-ink-3">
              &copy; {new Date().getFullYear()} Capital Private School. All rights reserved.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
