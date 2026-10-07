import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Card, ErrorText, Input, Label, PageHeader } from "../../components/ui";
import { useLanguage } from "../../i18n/LanguageContext";
import { createSchool } from "./api";

export default function CreateSchool() {
  const { t } = useLanguage();
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
      setSuccessMessage(t("superAdmin.create.success", { name: res.school.name, code: res.school.code, email: res.admin_email }));
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  if (successMessage) {
    return (
      <div>
        <PageHeader title={t("superAdmin.create.title")} />
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
            {t("superAdmin.create.successHint")}
          </p>
          <div className="flex gap-3">
            <Button onClick={() => navigate("/super-admin")}>{t("superAdmin.create.backToDashboard")}</Button>
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
              {t("superAdmin.create.createAnother")}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t("superAdmin.create.title")} subtitle={t("superAdmin.create.subtitle")} />
      <Card className="max-w-lg">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <h2 className="mb-3 text-sm font-semibold text-ink dark:text-white">{t("superAdmin.create.school")}</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">{t("superAdmin.create.schoolName")}</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder={t("superAdmin.create.schoolNamePlaceholder")} />
              </div>
              <div>
                <Label htmlFor="code">{t("superAdmin.create.schoolCode")}</Label>
                <Input
                  id="code"
                  required
                  placeholder="GHS2026"
                  dir="ltr"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
                <p className="mt-1 text-xs text-ink-3">{t("superAdmin.create.codeHint")}</p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-ink dark:text-white">{t("superAdmin.create.schoolAdmin")}</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="admin_full_name">{t("superAdmin.create.fullName")}</Label>
                <Input
                  id="admin_full_name"
                  required
                  value={adminFullName}
                  onChange={(e) => setAdminFullName(e.target.value)}
                  placeholder={t("superAdmin.create.fullNamePlaceholder")}
                />
              </div>
              <div>
                <Label htmlFor="admin_email">{t("superAdmin.create.email")}</Label>
                <Input
                  id="admin_email"
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@school.com"
                  dir="ltr"
                />
                <p className="mt-1 text-xs text-ink-3">{t("superAdmin.create.emailHint")}</p>
              </div>
            </div>
          </div>

          <ErrorText>
            {mutation.isError
              ? t("superAdmin.create.error")
              : ""}
          </ErrorText>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t("superAdmin.create.creating") : t("superAdmin.create.title")}
            </Button>
            <Link to="/super-admin">
              <Button type="button" variant="secondary">
                {t("common.cancel")}
              </Button>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
