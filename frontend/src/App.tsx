import { Navigate, Route, Routes } from "react-router-dom";
import ForgotPasswordPage from "./auth/ForgotPasswordPage";
import LoginLanding from "./auth/LoginLanding";
import ProtectedRoute from "./auth/ProtectedRoute";
import RegisterSchoolPage from "./auth/RegisterSchoolPage";
import ResetPasswordPage from "./auth/ResetPasswordPage";
import RoleLoginPage from "./auth/RoleLoginPage";
import { ROLE_HOME, useAuthStore } from "./auth/store";
import DashboardLayout, { type NavItem } from "./layouts/DashboardLayout";
import { academicsFeesChildRoutes } from "./pages/admin/academicsAndFeesRoutes";
import { adminChildRoutes, adminNavGroups } from "./pages/admin/routes";
import NotFound from "./pages/NotFound";
import { parentChildRoutes, parentNavItems } from "./pages/parent/routes";
import { principalChildRoutes, principalNavItems } from "./pages/principal/routes";
import { studentChildRoutes, studentNavItems } from "./pages/student/routes";
import { superAdminChildRoutes, superAdminNavItems } from "./pages/super-admin/routes";
import { teacherChildRoutes, teacherNavItems } from "./pages/teacher/routes";
import Unauthorized from "./pages/Unauthorized";
import SyllabusViewer from "./pages/public/SyllabusViewer";

const SUPER_ADMIN_NAV: NavItem[] = superAdminNavItems;
const PRINCIPAL_NAV: NavItem[] = principalNavItems;
const TEACHER_NAV: NavItem[] = teacherNavItems;
const PARENT_NAV: NavItem[] = parentNavItems;
const STUDENT_NAV: NavItem[] = studentNavItems;

function HomeRedirect() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  return <Navigate to={ROLE_HOME[user.role]} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginLanding />} />
      <Route path="/login/:role" element={<RoleLoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/register" element={<RegisterSchoolPage />} />
      <Route path="/syllabus" element={<SyllabusViewer />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      <Route
        path="/super-admin"
        element={
          <ProtectedRoute roles={["SUPER_ADMIN"]}>
            <DashboardLayout navItems={SUPER_ADMIN_NAV} />
          </ProtectedRoute>
        }
      >
        {superAdminChildRoutes}
      </Route>

      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={["SCHOOL_ADMIN"]}>
            <DashboardLayout navGroups={adminNavGroups} />
          </ProtectedRoute>
        }
      >
        {adminChildRoutes}
        {academicsFeesChildRoutes}
      </Route>

      <Route
        path="/principal"
        element={
          <ProtectedRoute roles={["PRINCIPAL"]}>
            <DashboardLayout navItems={PRINCIPAL_NAV} />
          </ProtectedRoute>
        }
      >
        {principalChildRoutes}
      </Route>

      <Route
        path="/teacher"
        element={
          <ProtectedRoute roles={["TEACHER"]}>
            <DashboardLayout navItems={TEACHER_NAV} />
          </ProtectedRoute>
        }
      >
        {teacherChildRoutes}
      </Route>

      <Route
        path="/parent"
        element={
          <ProtectedRoute roles={["PARENT"]}>
            <DashboardLayout navItems={PARENT_NAV} />
          </ProtectedRoute>
        }
      >
        {parentChildRoutes}
      </Route>

      <Route
        path="/student"
        element={
          <ProtectedRoute roles={["STUDENT"]}>
            <DashboardLayout navItems={STUDENT_NAV} />
          </ProtectedRoute>
        }
      >
        {studentChildRoutes}
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
