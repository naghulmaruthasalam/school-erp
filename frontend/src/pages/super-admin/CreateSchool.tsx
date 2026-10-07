import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Card, ErrorText, Input, Label, PageHeader } from "../../components/ui";
import { createSchool } from "./api";

export default function CreateSchool() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [adminFullName, setAdminFullName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: () =>
      createSchool({
        name,
        code,
        admin_full_name: adminFullName,
        admin_email: adminEmail,
      }),
    onSuccess: (res) => {
      setSuccessMessage(`School "${res.school.name}" created with code ${res.school.code}. Admin login provisioned for ${res.admin_email}.`);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  if (successMessage) {
    return (
      <div>
        <PageHeader title="Create School" />
        <Card className="max-w-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-green-700">{successMessage}</p>
          </div>
          <p className="text-xs text-ink-3 mb-4">
            The school admin will receive their login credentials via email. They can then complete the school profile with address, contact details, and other information.
          </p>
          <div className="flex gap-3">
            <Button onClick={() => navigate("/super-admin")}>Back to Dashboard</Button>
            <Button
              variant="secondary"
              onClick={() => {
                setName("");
                setCode("");
                setAdminFullName("");
                setAdminEmail("");
                setSuccessMessage(null);
              }}
            >
              Create Another
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Create School" subtitle="Quickly onboard a new school with minimal details. The school admin can complete their profile later." />
      <Card className="max-w-lg">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <h2 className="mb-3 text-sm font-semibold text-ink dark:text-white">School</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">School name *</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Green Hills Academy" />
              </div>
              <div>
                <Label htmlFor="code">School code *</Label>
                <Input
                  id="code"
                  required
                  placeholder="e.g. GHS2026"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
                <p className="mt-1 text-xs text-ink-3">Unique identifier for the school. Used for login.</p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-ink dark:text-white">School Admin</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="admin_full_name">Full name *</Label>
                <Input
                  id="admin_full_name"
                  required
                  value={adminFullName}
                  onChange={(e) => setAdminFullName(e.target.value)}
                  placeholder="Admin's full name"
                />
              </div>
              <div>
                <Label htmlFor="admin_email">Email *</Label>
                <Input
                  id="admin_email"
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@school.com"
                />
                <p className="mt-1 text-xs text-ink-3">Login credentials will be sent to this email.</p>
              </div>
            </div>
          </div>

          <ErrorText>
            {mutation.isError
              ? "Failed to create school. Check the code is unique and all required fields are filled."
              : ""}
          </ErrorText>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating..." : "Create School"}
            </Button>
            <Link to="/super-admin">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
