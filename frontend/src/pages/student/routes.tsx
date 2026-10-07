import { Route } from "react-router-dom";
import type { NavItem } from "../../layouts/DashboardLayout";
import {
  DashboardIcon, ProfileIcon, AttendanceIcon, HomeworkIcon,
  TimetableIcon, ExamsIcon, FeesIcon, NotificationsIcon, SettingsIcon, AboutIcon, SyllabusIcon
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

export const studentNavItems: NavItem[] = [
  { label: "Dashboard", to: "/student", end: true, icon: DashboardIcon },
  { label: "My Profile", to: "/student/profile", icon: ProfileIcon },
  { label: "Attendance", to: "/student/attendance", icon: AttendanceIcon },
  { label: "Homework", to: "/student/homework", icon: HomeworkIcon },
  { label: "Syllabus", to: "/student/syllabus", icon: SyllabusIcon },
  { label: "Timetable", to: "/student/timetable", icon: TimetableIcon },
  { label: "Exams", to: "/student/exams", icon: ExamsIcon },
  { label: "Fees", to: "/student/fees", icon: FeesIcon },
  { label: "Notifications", to: "/student/notifications", icon: NotificationsIcon },
  { label: "Settings", to: "/student/settings", icon: SettingsIcon },
  { label: "About", to: "/student/about", icon: AboutIcon },
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
    <Route path="settings" element={<StudentSettings />} />
    <Route path="about" element={<StudentAbout />} />
  </>
);
