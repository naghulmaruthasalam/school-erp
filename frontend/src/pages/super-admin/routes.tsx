import { Route } from "react-router-dom";
import type { NavItem } from "../../layouts/DashboardLayout";
import {
  DashboardIcon, ProfileIcon, SchoolsIcon, UsersIcon,
  AnalyticsIcon, DocumentsIcon, SettingsIcon, AboutIcon
} from "../../components/Icons";
import Analytics from "./Analytics";
import AuditLogs from "./AuditLogs";
import CreateSchool from "./CreateSchool";
import SuperAdminDashboard from "./Dashboard";
import SchoolDetail from "./SchoolDetail";
import SchoolList from "./SchoolList";
import Profile from "./Profile";
import Settings from "./Settings";
import UserList from "./UserList";
import About from "./About";

export const superAdminNavItems: NavItem[] = [
  { label: "Dashboard", to: "/super-admin", end: true, icon: DashboardIcon },
  { label: "My Profile", to: "/super-admin/profile", icon: ProfileIcon },
  { label: "Schools", to: "/super-admin/schools", icon: SchoolsIcon },
  { label: "Users", to: "/super-admin/users", icon: UsersIcon },
  { label: "Analytics", to: "/super-admin/analytics", icon: AnalyticsIcon },
  { label: "Audit Logs", to: "/super-admin/audit", icon: DocumentsIcon },
  { label: "Settings", to: "/super-admin/settings", icon: SettingsIcon },
  { label: "About", to: "/super-admin/about", icon: AboutIcon },
];

export const superAdminChildRoutes = (
  <>
    <Route index element={<SuperAdminDashboard />} />
    <Route path="profile" element={<Profile />} />
    <Route path="schools" element={<SchoolList />} />
    <Route path="users" element={<UserList />} />
    <Route path="analytics" element={<Analytics />} />
    <Route path="audit" element={<AuditLogs />} />
    <Route path="settings" element={<Settings />} />
    <Route path="new" element={<CreateSchool />} />
    <Route path=":id" element={<SchoolDetail />} />
    <Route path="about" element={<About />} />
  </>
);
