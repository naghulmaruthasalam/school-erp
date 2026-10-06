import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, ErrorText, PasswordInput, Label } from "../components/ui";
import { ROLE_THEMES } from "../theme/roles";
import AuthLayout from "./AuthLayout";
import { resetPasswordRequest } from "./api";

const theme = ROLE_THEMES.SCHOOL_ADMIN;

export default function ResetPasswordPage() {
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
      setValidationError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setValidationError("Passwords do not match.");
      return;
    }
    setValidationError("");
    mutation.mutate();
  }

  if (!token) {
    return (
      <AuthLayout theme={theme} title="Invalid reset link">
        <p className="text-center text-sm text-violet-600">
          This link is missing its reset token. Please request a new one.
        </p>
        <Link
          to="/forgot-password"
          className="mt-4 block text-center text-sm font-medium text-violet-600 hover:underline"
        >
          Request a new link
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout theme={theme} title="Set a new password" subtitle="Choose a new password for your account.">
      {mutation.isSuccess ? (
        <div className="text-center">
          <p className="text-sm text-violet-700">Your password has been reset.</p>
          <p className="mt-1 text-xs text-violet-400">Redirecting you to sign in…</p>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <Label htmlFor="new_password">New password</Label>
            <PasswordInput
              id="new_password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="confirm_password">Confirm password</Label>
            <PasswordInput
              id="confirm_password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <ErrorText>
            {validationError || (mutation.isError ? "This reset link is invalid or has expired." : "")}
          </ErrorText>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Reset password"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
