import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, ErrorText, PasswordInput, Label } from "../components/ui";
import { ROLE_THEMES } from "../theme/roles";
import AuthLayout from "./AuthLayout";
import { resetPasswordRequest } from "./api";
import { useLanguage } from "../i18n/LanguageContext";

const theme = ROLE_THEMES.SCHOOL_ADMIN;

export default function ResetPasswordPage() {
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState("");

  const mutation = useMutation({
    mutationFn: () => resetPasswordRequest(token, newPassword),
    onSuccess: () => {
      setTimeout(() => navigate("/login", { replace: true }), 2000);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setValidationError(t("shell.auth.passwordMin"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setValidationError(t("shell.auth.passwordMismatch"));
      return;
    }
    setValidationError("");
    mutation.mutate();
  }

  if (!token) {
    return (
      <AuthLayout theme={theme} title={t("shell.reset.invalidTitle")}>
        <p className="text-center text-sm text-accent-fg">
          {t("shell.reset.missingToken")}
        </p>
        <Link
          to="/forgot-password"
          className="mt-4 block text-center text-sm font-medium text-accent-fg hover:underline"
        >
          {t("shell.reset.requestNew")}
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout theme={theme} title={t("shell.reset.title")} subtitle={t("shell.reset.subtitle")}>
      {mutation.isSuccess ? (
        <div className="text-center">
          <p className="text-sm text-ink-2">{t("shell.reset.done")}</p>
          <p className="mt-1 text-xs text-accent-fg">{t("shell.reset.redirecting")}</p>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <Label htmlFor="new_password">{t("shell.reset.newPassword")}</Label>
            <PasswordInput
              id="new_password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="confirm_password">{t("shell.reset.confirmPassword")}</Label>
            <PasswordInput
              id="confirm_password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <ErrorText>
            {validationError || (mutation.isError ? t("shell.reset.invalidOrExpired") : "")}
          </ErrorText>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? t("shell.reset.saving") : t("shell.reset.submit")}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
