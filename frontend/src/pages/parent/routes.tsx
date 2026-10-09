import { Route } from "react-router-dom";
import type { NavItem } from "../../layouts/DashboardLayout";
import {
  DashboardIcon, ProfileIcon, AttendanceIcon, HomeworkIcon,
  ExamsIcon, FeesIcon, NotificationsIcon, SettingsIcon, AboutIcon, SyllabusIcon, SupportIcon,
} from "../../components/Icons";
import AttendancePage from "./AttendancePage";
import ParentDashboard from "./Dashboard";
import ExamsPage from "./ExamsPage";
import FeesPage from "./FeesPage";
import HomeworkPage from "./HomeworkPage";
import NotificationsPage from "./NotificationsPage";
import SupportCenter from "../../components/SupportCenter";
import ParentShell from "./ParentShell";
import ParentProfile from "./Profile";
import ParentSettings from "./Settings";
import ParentAbout from "./About";
import ParentSyllabusPage from "./SyllabusPage";

export const parentNavItems: NavItem[] = [
  { label: "navigation.dashboard", to: "/parent", end: true, icon: DashboardIcon },
  { label: "navigation.myProfile", to: "/parent/profile", icon: ProfileIcon },
  { label: "navigation.attendance", to: "/parent/attendance", icon: AttendanceIcon },
  { label: "navigation.homework", to: "/parent/homework", icon: HomeworkIcon },
  { label: "navigation.syllabus", to: "/parent/syllabus", icon: SyllabusIcon },
  { label: "parent.nav.exams", to: "/parent/exams", icon: ExamsIcon },
  { label: "navigation.fees", to: "/parent/fees", icon: FeesIcon },
  { label: "navigation.notifications", to: "/parent/notifications", icon: NotificationsIcon },
  { label: "lead.nav.support", to: "/parent/support", icon: SupportIcon },
  { label: "navigation.settings", to: "/parent/settings", icon: SettingsIcon },
  { label: "navigation.about", to: "/parent/about", icon: AboutIcon },
];

/**
 * Route elements for the parent portal. Spread into App.tsx's existing
 * `/parent` <Route> (which already provides ProtectedRoute + DashboardLayout).
 * All pages are nested under ParentShell, which renders the children
 * switcher above the active page.
 */
export const parentChildRoutes = (
  <>
    <Route element={<ParentShell />}>
      <Route index element={<ParentDashboard />} />
      <Route path="profile" element={<ParentProfile />} />
      <Route path="attendance" element={<AttendancePage />} />
      <Route path="homework" element={<HomeworkPage />} />
      <Route path="syllabus" element={<ParentSyllabusPage />} />
      <Route path="exams" element={<ExamsPage />} />
      <Route path="fees" element={<FeesPage />} />
      <Route path="notifications" element={<NotificationsPage />} />
      <Route path="support" element={<SupportCenter role="parent" />} />
      <Route path="settings" element={<ParentSettings />} />
      <Route path="about" element={<ParentAbout />} />
    </Route>
  </>
);
