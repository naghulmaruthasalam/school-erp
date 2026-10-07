import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import Logo from "../components/Logo";
import { registerSchoolRequest } from "./api";
import { useLanguage } from "../i18n/LanguageContext";

export default function RegisterSchoolPage() {
  const { t } = useLanguage();
  const [schoolName, setSchoolName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("India");
  const [postalCode, setPostalCode] = useState("");
  const [schoolPhone, setSchoolPhone] = useState("");
  const [schoolEmail, setSchoolEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminConfirmPassword, setAdminConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      registerSchoolRequest({
        name: schoolName,
        address: address || undefined,
        city: city || undefined,
        state: state || undefined,
        country: country || undefined,
        postal_code: postalCode || undefined,
        phone: schoolPhone || undefined,
        email: schoolEmail || undefined,
        admin_full_name: adminName,
        admin_email: adminEmail,
        admin_phone: adminPhone || undefined,
        admin_password: adminPassword,
        admin_confirm_password: adminConfirmPassword,
      }),
    onError: (err) => {
      const message =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        t("shell.register.failed");
      setError(message);
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (adminPassword.length < 8) {
      setError(t("shell.auth.passwordMin"));
      return;
    }
    if (adminPassword !== adminConfirmPassword) {
      setError(t("shell.auth.passwordMismatch"));
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-12">

      <div className="relative z-10 w-full max-w-lg">
        <Link
          to="/login"
          className="inline-flex items-center text-ink-3 hover:text-ink text-sm mb-6 transition-colors group"
        >
          <svg className="w-4 h-4 me-2 transition-transform group-hover:-translate-x-1 rtl:-scale-x-100 rtl:group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t("shell.auth.backToLogin")}
        </Link>

        <div className="animated-border">
          <div className="glass-strong !rounded-[32px] p-8">
            {mutation.isSuccess ? (
              <div className="text-center animate-scale-in">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-green-500/15 mb-6">
                  <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-ink mb-2">{t("shell.register.successTitle")}</h2>
                <p className="text-ink-2 mb-4">
                  <span className="font-semibold text-ink">{mutation.data.school.name}</span> {t("shell.register.successMsg")}
                </p>

                <div className="bg-surface-3 rounded-xl p-4 mb-6 text-start">
                  <p className="text-ink-3 text-sm mb-2">{t("shell.register.yourCode")}</p>
                  <p dir="ltr" className="text-2xl font-mono font-bold text-accent-fg tracking-wider text-start">
                    {mutation.data.school.code}
                  </p>
                  <p className="text-xs text-ink-3 mt-2">
                    {t("shell.register.saveCode")}
                  </p>
                </div>

                <p className="text-ink-3 text-sm mb-6">
                  {t("shell.register.signInWith")} <span dir="ltr" className="text-ink">{mutation.data.admin_email}</span> {t("shell.register.andPassword")}
                </p>

                <Link
                  to="/login/admin"
                  className="inline-flex items-center justify-center w-full py-3 px-4 lg-btn lg-btn-primary font-medium"
                >
                  <span className="relative z-10">{t("shell.register.goToSignIn")}</span>
                </Link>
              </div>
            ) : (
              <>
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-soft text-4xl mb-4">
                    🏫
                  </div>
                  <h1 className="text-2xl font-semibold tracking-tight text-ink">{t("landing.registerSchool")}</h1>
                  <p className="text-ink-3 text-sm mt-1">{t("shell.register.subtitle")}</p>
                </div>

                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div className="p-4 rounded-xl bg-surface-2 border border-line">
                    <p className="text-xs font-medium text-accent-fg mb-3 uppercase tracking-wider">{t("shell.register.schoolDetails")}</p>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-ink-2 mb-2">{t("shell.register.schoolName")} *</label>
                        <input
                          required
                          value={schoolName}
                          onChange={(e) => setSchoolName(e.target.value)}
                          className="w-full px-4 py-3 lg-field"
                          placeholder={t("shell.register.schoolNamePh")}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-ink-2 mb-2">{t("shell.about.addressLabel")}</label>
                        <input
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className="w-full px-4 py-3 lg-field"
                          placeholder={t("shell.register.addressPh")}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-ink-2 mb-2">{t("shell.register.city")}</label>
                          <input
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            className="w-full px-4 py-3 lg-field"
                            placeholder={t("shell.register.cityPh")}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-ink-2 mb-2">{t("shell.register.state")}</label>
                          <input
                            value={state}
                            onChange={(e) => setState(e.target.value)}
                            className="w-full px-4 py-3 lg-field"
                            placeholder={t("shell.register.statePh")}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-ink-2 mb-2">{t("shell.register.country")}</label>
                          <input
                            value={country}
                            onChange={(e) => setCountry(e.target.value)}
                            className="w-full px-4 py-3 lg-field"
                            placeholder={t("shell.register.countryPh")}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-ink-2 mb-2">{t("shell.register.postalCode")}</label>
                          <input
                            value={postalCode}
                            onChange={(e) => setPostalCode(e.target.value)}
                            className="w-full px-4 py-3 lg-field"
                            placeholder={t("shell.register.postalPh")}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-ink-2 mb-2">{t("shell.register.schoolPhone")}</label>
                          <input
                            value={schoolPhone}
                            onChange={(e) => setSchoolPhone(e.target.value)}
                            className="w-full px-4 py-3 lg-field"
                            placeholder="+91 22 12345678"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-ink-2 mb-2">{t("shell.register.schoolEmail")}</label>
                          <input
                            type="email"
                            dir="ltr"
                            value={schoolEmail}
                            onChange={(e) => setSchoolEmail(e.target.value)}
                            className="w-full px-4 py-3 lg-field"
                            placeholder="info@school.com"
                          />
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-ink-3 mt-3 flex items-center gap-1">
                      <svg className="w-4 h-4 text-accent-fg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {t("shell.register.autoCode")}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-surface-2 border border-line">
                    <p className="text-xs font-medium text-cyan-400 mb-3 uppercase tracking-wider">{t("shell.register.adminAccount")}</p>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-ink-2 mb-2">{t("shell.register.yourName")}</label>
                        <input
                          required
                          value={adminName}
                          onChange={(e) => setAdminName(e.target.value)}
                          className="w-full px-4 py-3 lg-field"
                          placeholder={t("shell.register.fullName")}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-ink-2 mb-2">{t("shell.register.emailAddress")}</label>
                        <input
                          type="email"
                          dir="ltr"
                          required
                          value={adminEmail}
                          onChange={(e) => setAdminEmail(e.target.value)}
                          className="w-full px-4 py-3 lg-field"
                          placeholder="you@example.com"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-ink-2 mb-2">{t("shell.register.phoneOptional")}</label>
                        <input
                          value={adminPhone}
                          onChange={(e) => setAdminPhone(e.target.value)}
                          className="w-full px-4 py-3 lg-field"
                          placeholder="+91 9876543210"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-ink-2 mb-2">{t("common.password")} *</label>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            required
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            className="w-full px-4 py-3 pe-12 lg-field"
                            placeholder={t("shell.auth.minChars")}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute end-4 top-1/2 -translate-y-1/2 text-ink-3 hover:text-accent-fg transition-colors"
                            aria-label={showPassword ? t("shell.common.hidePassword") : t("shell.common.showPassword")}
                          >
                            {showPassword ? (
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
                        <label className="block text-sm font-medium text-ink-2 mb-2">{t("shell.reset.confirmPassword")} *</label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            required
                            value={adminConfirmPassword}
                            onChange={(e) => setAdminConfirmPassword(e.target.value)}
                            className="w-full px-4 py-3 pe-12 lg-field"
                            placeholder={t("shell.auth.reenter")}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute end-4 top-1/2 -translate-y-1/2 text-ink-3 hover:text-accent-fg transition-colors"
                            aria-label={showConfirmPassword ? t("shell.common.hidePassword") : t("shell.common.showPassword")}
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
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <p className="text-red-400 text-sm text-center">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={mutation.isPending}
                    className="w-full py-3 px-4 lg-btn lg-btn-primary font-medium relative z-10 disabled:opacity-50"
                  >
                    <span className="relative z-10">
                      {mutation.isPending ? (
                        <span className="flex items-center justify-center">
                          <svg className="animate-spin -ms-1 me-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          {t("shell.register.registering")}
                        </span>
                      ) : (
                        t("shell.register.submit")
                      )}
                    </span>
                  </button>
                </form>

                <div className="mt-6 pt-6 border-t border-slate-700/50 text-center">
                  <p className="text-ink-3 text-sm">
                    {t("shell.register.already")}{" "}
                    <Link to="/login" className="text-accent-fg hover:text-ink-2 font-medium transition-colors">
                      {t("common.signIn")}
                    </Link>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-3 text-ink-3">
          <Logo size={24} showWordmark={false} />
          <span className="text-xs">{t("shell.brand.name")}</span>
        </div>
      </div>
    </div>
  );
}
