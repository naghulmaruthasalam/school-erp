import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { Role } from "../types/auth";
import { useAuthStore } from "./store";

export default function ProtectedRoute({
  roles,
  children,
}: {
  roles?: Role[];
  children: ReactNode;
}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  return <>{children}</>;
}
