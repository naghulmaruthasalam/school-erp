import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Logo from "../components/Logo";
import { api } from "../api/client";

type Step = "email" | "otp" | "password" | "success";

export default function ForgotPasswordPage() {
  const [searchParams] = useSearchParams();
  const initialSchoolCode = searchParams.get("school") || "";

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [schoolCode, setSchoolCode] = useState(initialSchoolCode);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");

  const requestOtpMutation = useMutation({
    mutationFn: async () => {
      await api.post("/auth/forgot-password", { email, school_code: schoolCode || null });
    },
    onSuccess: () => {
      setStep("otp");
      setError("");
    },
    onError: () => setError("Failed to send OTP. Please check your email."),
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async () => {
      await api.post("/auth/verify-otp", { email, otp, school_code: schoolCode || null });
    },
    onSuccess: () => {
      setStep("password");
      setError("");
    },
    onError: () => setError("Invalid OTP. Please try again."),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      await api.post("/auth/reset-password-otp", {
        email,
        otp,
        new_password: newPassword,
        confirm_password: confirmPassword,
        school_code: schoolCode || null,
      });
    },
    onSuccess: () => {
      setStep("success");
      setError("");
    },
    onError: () => setError("Failed to reset password. Please try again."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (step === "email") {
      if (!email) {
        setError("Please enter your email");
        return;
      }
      requestOtpMutation.mutate();
    } else if (step === "otp") {
      if (!otp || otp.length !== 6) {
        setError("Please enter a valid 6-digit OTP");
        return;
      }
      verifyOtpMutation.mutate();
    } else if (step === "password") {
      if (newPassword.length < 8) {
        setError("Password must be at least 8 characters");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      resetPasswordMutation.mutate();
    }
  };

  const isPending = requestOtpMutation.isPending || verifyOtpMutation.isPending || resetPasswordMutation.isPending;

  return (
    <div className="relative min-h-screen bg-auth-gradient flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 bg-grid-pattern" />
      <div className="glow-orb glow-orb-1" />
      <div className="glow-orb glow-orb-2" />

      <div className="relative z-10 w-full max-w-md">
        <Link
          to="/login"
          className="inline-flex items-center text-slate-400 hover:text-white text-sm mb-6 transition-colors group"
        >
          <svg className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to login
        </Link>

        <div className="animated-border">
          <div className="glass-card p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 mb-4">
                {step === "success" ? (
                  <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                )}
              </div>
              <h1 className="text-2xl font-bold text-white">
                {step === "email" && "Reset Password"}
                {step === "otp" && "Verify OTP"}
                {step === "password" && "New Password"}
                {step === "success" && "Password Reset!"}
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                {step === "email" && "Enter your email to receive an OTP"}
                {step === "otp" && "Enter the 6-digit code (use 123456 for testing)"}
                {step === "password" && "Create your new password"}
                {step === "success" && "Your password has been reset successfully"}
              </p>
            </div>

            {step !== "success" && (
              <div className="flex items-center justify-center gap-2 mb-8">
                {["email", "otp", "password"].map((s, i) => (
                  <div key={s} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      step === s ? "bg-indigo-500 text-white" :
                      ["email", "otp", "password"].indexOf(step) > i ? "bg-green-500 text-white" :
                      "bg-slate-700 text-slate-400"
                    }`}>
                      {["email", "otp", "password"].indexOf(step) > i ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </div>
                    {i < 2 && (
                      <div className={`w-12 h-0.5 mx-1 ${
                        ["email", "otp", "password"].indexOf(step) > i ? "bg-green-500" : "bg-slate-700"
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            )}

            {step === "success" ? (
              <div className="text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center w-full py-3 px-4 rounded-xl glow-button font-medium"
                >
                  <span className="relative z-10">Go to Login</span>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {step === "email" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl glow-input"
                        placeholder="you@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        School Code
                        <span className="text-slate-500 font-normal ml-1">(optional)</span>
                      </label>
                      <input
                        value={schoolCode}
                        onChange={(e) => setSchoolCode(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl glow-input"
                        placeholder="e.g. GHS2026"
                      />
                      <p className="text-xs text-slate-500 mt-2">
                        Only required for school staff (Admin, Teacher, etc.). Platform admins can leave this empty.
                      </p>
                    </div>
                  </>
                )}

                {step === "otp" && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Enter OTP
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      className="w-full px-4 py-3 rounded-xl glow-input text-center text-2xl tracking-[0.5em] font-mono"
                      placeholder="000000"
                    />
                    <p className="mt-2 text-xs text-slate-500 text-center">
                      Hint: Use <span className="text-violet-400 font-mono">123456</span> for testing
                    </p>
                  </div>
                )}

                {step === "password" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-4 py-3 pr-12 rounded-xl glow-input"
                          placeholder="Minimum 8 characters"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-slate-300 transition-colors"
                        >
                          {showNewPassword ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-4 py-3 pr-12 rounded-xl glow-input"
                          placeholder="Re-enter your password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-slate-300 transition-colors"
                        >
                          {showConfirmPassword ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-red-400 text-sm text-center">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-3 px-4 rounded-xl glow-button font-medium relative z-10 disabled:opacity-50"
                >
                  <span className="relative z-10">
                    {isPending ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Processing...
                      </span>
                    ) : step === "email" ? "Send OTP" : step === "otp" ? "Verify OTP" : "Reset Password"}
                  </span>
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-3 text-slate-500">
          <Logo size={24} showWordmark={false} />
          <span className="text-xs">Cogniitec AI School ERP</span>
        </div>
      </div>
    </div>
  );
}
