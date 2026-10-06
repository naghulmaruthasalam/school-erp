import { useState } from "react";
import { Button, Card, Input, Label, Select } from "../../components/ui";

export default function Settings() {
  const [platformName, setPlatformName] = useState("Cogniitec AI School ERP");
  const [supportEmail, setSupportEmail] = useState("support@cogniitec.com");
  const [supportPhone, setSupportPhone] = useState("+91 98765 43210");
  const [sessionTimeout, setSessionTimeout] = useState("30");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="animate-fade-in-up">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink dark:text-white">Platform Settings</h1>
        <p className="mt-1 text-sm text-ink-2">
          Configure platform-wide settings and preferences
        </p>
      </div>

      <div className="max-w-3xl space-y-6">
        {/* Branding */}
        <Card>
          <h3 className="text-lg font-semibold text-ink dark:text-white mb-4 pb-3 border-b border-line">
            Platform Branding
          </h3>
          <div className="space-y-4">
            <div>
              <Label>Platform Name</Label>
              <Input value={platformName} onChange={(e) => setPlatformName(e.target.value)} />
              <p className="text-xs text-ink-3 mt-1">Displayed in emails and system notifications</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Support Email</Label>
                <Input type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} />
              </div>
              <div>
                <Label>Support Phone</Label>
                <Input value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} />
              </div>
            </div>
          </div>
        </Card>

        {/* Security */}
        <Card>
          <h3 className="text-lg font-semibold text-ink dark:text-white mb-4 pb-3 border-b border-line">
            Security Settings
          </h3>
          <div className="space-y-4">
            <div>
              <Label>Session Timeout</Label>
              <Select value={sessionTimeout} onChange={(e) => setSessionTimeout(e.target.value)}>
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="120">2 hours</option>
              </Select>
              <p className="text-xs text-ink-3 mt-1">Inactive users will be logged out after this duration</p>
            </div>
          </div>
        </Card>

        {/* Email Notifications */}
        <Card>
          <h3 className="text-lg font-semibold text-ink dark:text-white mb-4 pb-3 border-b border-line">
            Admin Notifications
          </h3>
          <div className="space-y-3">
            {[
              { label: "New school registration", desc: "When a new school is onboarded", checked: true },
              { label: "School status changes", desc: "When a school is activated or deactivated", checked: true },
              { label: "Weekly platform summary", desc: "Receive weekly stats via email", checked: true },
              { label: "System alerts", desc: "Critical system errors and warnings", checked: true },
            ].map((item) => (
              <label key={item.label} className="flex items-start gap-3 p-4 bg-surface-3 dark:bg-surface rounded-lg cursor-pointer hover:bg-surface-3 dark:hover:bg-surface-3 border border-line">
                <input type="checkbox" defaultChecked={item.checked} className="mt-0.5 w-4 h-4 rounded border-line text-accent-fg focus:ring-accent/30" />
                <div>
                  <span className="text-sm font-medium text-ink dark:text-white">{item.label}</span>
                  <p className="text-xs text-ink-3">{item.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </Card>

        {/* API & Integrations */}
        <Card>
          <h3 className="text-lg font-semibold text-ink dark:text-white mb-4 pb-3 border-b border-line">
            Integrations
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-surface-3 dark:bg-surface rounded-lg border border-line">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#16A34A] flex items-center justify-center text-white">✓</div>
                <div>
                  <p className="font-medium text-ink dark:text-white">AWS S3 Storage</p>
                  <p className="text-xs text-ink-3">Document and media storage</p>
                </div>
              </div>
              <span className="text-xs font-medium text-emerald-600 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">Connected</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-surface-3 dark:bg-surface rounded-lg border border-line">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center text-white">AI</div>
                <div>
                  <p className="font-medium text-ink dark:text-white">AI Assistant (Gemini)</p>
                  <p className="text-xs text-ink-3">Intelligent chatbot for users</p>
                </div>
              </div>
              <span className="text-xs font-medium text-ink-3 bg-surface-3 dark:bg-surface px-2 py-1 rounded">Optional</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-surface-3 dark:bg-surface rounded-lg border border-line">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#F59E0B] flex items-center justify-center text-white">₹</div>
                <div>
                  <p className="font-medium text-ink dark:text-white">PayU Payment Gateway</p>
                  <p className="text-xs text-ink-3">Fee collection and payments</p>
                </div>
              </div>
              <span className="text-xs font-medium text-ink-3 bg-surface-3 dark:bg-surface px-2 py-1 rounded">Configure in .env</span>
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="secondary">Reset to Defaults</Button>
          <Button onClick={handleSave}>
            {saved ? "✓ Saved" : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
