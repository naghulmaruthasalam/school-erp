import { Route } from "react-router-dom";
import type { NavItem } from "../../layouts/DashboardLayout";
import {
  DashboardIcon, ProfileIcon, StudentsIcon, TeachersIcon,
  ExamsIcon, AttendanceIcon, FeesIcon, CalendarIcon,
  SettingsIcon, AboutIcon, AnalyticsIcon, SyllabusIcon
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

export const principalNavItems: NavItem[] = [
  { label: "Dashboard", to: "/principal", end: true, icon: DashboardIcon },
  { label: "My Profile", to: "/principal/profile", icon: ProfileIcon },
  { label: "Staff", to: "/principal/staff", icon: TeachersIcon },
  { label: "Students", to: "/principal/students", icon: StudentsIcon },
  { label: "Syllabus", to: "/principal/syllabus", icon: SyllabusIcon },
  { label: "Examinations", to: "/principal/exams", icon: ExamsIcon },
  { label: "Attendance", to: "/principal/attendance", icon: AttendanceIcon },
  { label: "Fee Reports", to: "/principal/fees", icon: FeesIcon },
  { label: "Calendar", to: "/principal/calendar", icon: CalendarIcon },
  { label: "Analytics", to: "/principal/analytics", icon: AnalyticsIcon },
  { label: "Settings", to: "/principal/settings", icon: SettingsIcon },
  { label: "About", to: "/principal/about", icon: AboutIcon },
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
    <Route path="calendar" element={<SchoolCalendar />} />
    <Route path="analytics" element={<PrincipalDashboard />} />
    <Route path="settings" element={<Settings />} />
    <Route path="about" element={<About />} />
  </>
);
