import { Route } from "react-router-dom";
import type { NavItem } from "../../layouts/DashboardLayout";
import {
  DashboardIcon, ProfileIcon, AttendanceIcon, HomeworkIcon,
  TimetableIcon, ExamsIcon, FeesIcon, NotificationsIcon, SettingsIcon, AboutIcon, SyllabusIcon,
  SupportIcon,
} from "../../components/Icons";
import StudentAttendance from "./Attendance";
import StudentDashboard from "./Dashboard";
import StudentExams from "./Exams";
import StudentFees from "./Fees";
import StudentHomework from "./Homework";
import StudentProfile from "./Profile";
import StudentSyllabus from "./Syllabus";
import StudentTimetable from "./Timetable";
import StudentNotifications from "./Notifications";
import StudentSettings from "./Settings";
import StudentAbout from "./About";
import SupportCenter from "../../components/SupportCenter";

export const studentNavItems: NavItem[] = [
  { label: "navigation.dashboard", to: "/student", end: true, icon: DashboardIcon },
  { label: "navigation.myProfile", to: "/student/profile", icon: ProfileIcon },
  { label: "navigation.attendance", to: "/student/attendance", icon: AttendanceIcon },
  { label: "navigation.homework", to: "/student/homework", icon: HomeworkIcon },
  { label: "navigation.syllabus", to: "/student/syllabus", icon: SyllabusIcon },
  { label: "timetable.title", to: "/student/timetable", icon: TimetableIcon },
  { label: "student.nav.exams", to: "/student/exams", icon: ExamsIcon },
  { label: "navigation.fees", to: "/student/fees", icon: FeesIcon },
  { label: "navigation.notifications", to: "/student/notifications", icon: NotificationsIcon },
  { label: "lead.nav.support", to: "/student/support", icon: SupportIcon },
  { label: "navigation.settings", to: "/student/settings", icon: SettingsIcon },
  { label: "navigation.about", to: "/student/about", icon: AboutIcon },
];

/** Spread into App.tsx's existing `/student` route: `<Route path="/student" ...>{studentChildRoutes}</Route>` */
export const studentChildRoutes = (
  <>
    <Route index element={<StudentDashboard />} />
    <Route path="profile" element={<StudentProfile />} />
    <Route path="attendance" element={<StudentAttendance />} />
    <Route path="homework" element={<StudentHomework />} />
    <Route path="syllabus" element={<StudentSyllabus />} />
    <Route path="timetable" element={<StudentTimetable />} />
    <Route path="exams" element={<StudentExams />} />
    <Route path="fees" element={<StudentFees />} />
    <Route path="notifications" element={<StudentNotifications />} />
    <Route path="support" element={<SupportCenter role="student" />} />
    <Route path="settings" element={<StudentSettings />} />
    <Route path="about" element={<StudentAbout />} />
  </>
);
