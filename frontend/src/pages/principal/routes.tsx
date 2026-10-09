import { Route } from "react-router-dom";
import type { NavItem } from "../../layouts/DashboardLayout";
import {
  DashboardIcon, ProfileIcon, StudentsIcon, TeachersIcon,
  ExamsIcon, AttendanceIcon, FeesIcon, CalendarIcon,
  SettingsIcon, AboutIcon, AnalyticsIcon, SyllabusIcon, NotificationsIcon, SupportIcon,
} from "../../components/Icons";
import PrincipalDashboard from "./Dashboard";
import Profile from "./Profile";
import StaffOverview from "./StaffOverview";
import StudentOverview from "./StudentOverview";
import ExamManagement from "./ExamManagement";
import AttendanceReports from "./AttendanceReports";
import FeeReports from "./FeeReports";
import SchoolCalendar from "./SchoolCalendar";
import PrincipalSyllabus from "./Syllabus";
import Settings from "./Settings";
import About from "./About";
import NotificationList from "../admin/NotificationList";
import VideoViewsReport from "../../components/VideoViewsReport";
import TicketDesk from "../../components/TicketDesk";
import CurriculumLibrary from "../../components/CurriculumLibrary";

export const principalNavItems: NavItem[] = [
  { label: "navigation.dashboard", to: "/principal", end: true, icon: DashboardIcon },
  { label: "navigation.myProfile", to: "/principal/profile", icon: ProfileIcon },
  { label: "principal.nav.staff", to: "/principal/staff", icon: TeachersIcon },
  { label: "navigation.students", to: "/principal/students", icon: StudentsIcon },
  { label: "navigation.syllabus", to: "/principal/syllabus", icon: SyllabusIcon },
  { label: "principal.nav.exams", to: "/principal/exams", icon: ExamsIcon },
  { label: "navigation.attendance", to: "/principal/attendance", icon: AttendanceIcon },
  { label: "principal.nav.feeReports", to: "/principal/fees", icon: FeesIcon },
  { label: "lead.nav.announcements", to: "/principal/announcements", icon: NotificationsIcon },
  { label: "lead.nav.videoViews", to: "/principal/video-views", icon: AnalyticsIcon },
  { label: "lead.nav.tickets", to: "/principal/tickets", icon: SupportIcon },
  { label: "lead.nav.library", to: "/principal/library", icon: SyllabusIcon },
  { label: "principal.nav.calendar", to: "/principal/calendar", icon: CalendarIcon },
  { label: "principal.nav.analytics", to: "/principal/analytics", icon: AnalyticsIcon },
  { label: "navigation.settings", to: "/principal/settings", icon: SettingsIcon },
  { label: "navigation.about", to: "/principal/about", icon: AboutIcon },
];

export const principalChildRoutes = (
  <>
    <Route index element={<PrincipalDashboard />} />
    <Route path="profile" element={<Profile />} />
    <Route path="staff" element={<StaffOverview />} />
    <Route path="students" element={<StudentOverview />} />
    <Route path="syllabus" element={<PrincipalSyllabus />} />
    <Route path="exams" element={<ExamManagement />} />
    <Route path="attendance" element={<AttendanceReports />} />
    <Route path="fees" element={<FeeReports />} />
    <Route path="announcements" element={<NotificationList />} />
    <Route path="video-views" element={<VideoViewsReport />} />
    <Route path="tickets" element={<TicketDesk />} />
    <Route path="library" element={<CurriculumLibrary canManage />} />
    <Route path="calendar" element={<SchoolCalendar />} />
    <Route path="analytics" element={<PrincipalDashboard />} />
    <Route path="settings" element={<Settings />} />
    <Route path="about" element={<About />} />
  </>
);
