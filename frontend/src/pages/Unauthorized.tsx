import { Link } from "react-router-dom";
import { ROLE_HOME, useAuthStore } from "../auth/store";

export default function Unauthorized() {
  const user = useAuthStore((s) => s.user);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-strong animate-pop-in w-full max-w-sm !rounded-[32px] p-10 text-center">
        <p className="text-gradient text-7xl font-semibold tracking-tight">403</p>
        <p className="mt-3 text-base font-medium text-ink">Access restricted</p>
        <p className="mt-1 text-sm text-ink-3">You don't have access to that page.</p>
        <Link to={user ? ROLE_HOME[user.role] : "/login"} className="lg-btn lg-btn-primary mt-7">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
