import { Link } from "react-router-dom";
import { ROLE_HOME, useAuthStore } from "../auth/store";

export default function Unauthorized() {
  const user = useAuthStore((s) => s.user);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-violet-50 text-center">
      <p className="text-3xl font-semibold text-violet-900">403</p>
      <p className="text-sm text-violet-600">You don't have access to that page.</p>
      <Link
        to={user ? ROLE_HOME[user.role] : "/login"}
        className="mt-4 text-sm font-medium text-violet-600 hover:underline"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
