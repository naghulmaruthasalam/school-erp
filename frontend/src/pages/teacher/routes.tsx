import { Route } from "react-router-dom";
import type { NavItem } from "../../layouts/DashboardLayout";
import {
  DashboardIcon, ProfileIcon, TimetableIcon, AttendanceIcon,
  HomeworkIcon, MarksIcon, LeaveIcon, NotificationsIcon, SettingsIcon, AboutIcon, SyllabusIcon
} from "../../components/Icons";
import TeacherAttendance from "./Attendance";
import TeacherDashboard from "./Dashboard";
import TeacherHomework from "./Homework";
import TeacherHomeworkSubmissions from "./HomeworkSubmissions";
import TeacherLeaveRequest from "./LeaveRequest";
import TeacherMarks from "./Marks";
import TeacherSyllabus from "./Syllabus";
import TeacherSyllabusDetail from "./SyllabusDetail";
import TeacherSyllabusForm from "./SyllabusForm";
import TeacherTimetable from "./Timetable";
import TeacherNotifications from "./Notifications";
import TeacherProfile from "./Profile";
import TeacherSettings from "./Settings";
import TeacherAbout from "./About";
import TeacherCopilot from "./TeacherCopilot";

export const teacherNavItems: NavItem[] = [
  { label: "navigation.dashboard", to: "/teacher", end: true, icon: DashboardIcon },
  { label: "navigation.myProfile", to: "/teacher/profile", icon: ProfileIcon },
  { label: "navigation.myClasses", to: "/teacher/timetable", icon: TimetableIcon },
  { label: "navigation.attendance", to: "/teacher/attendance", icon: AttendanceIcon },
  { label: "navigation.homework", to: "/teacher/homework", icon: HomeworkIcon },
  { label: "AI Copilot", to: "/teacher/copilot", icon: HomeworkIcon },
  { label: "navigation.syllabus", to: "/teacher/syllabus", icon: SyllabusIcon },
  { label: "navigation.marks", to: "/teacher/marks", icon: MarksIcon },
  { label: "navigation.leave", to: "/teacher/leave", icon: LeaveIcon },
  { label: "navigation.notifications", to: "/teacher/notifications", icon: NotificationsIcon },
  { label: "navigation.settings", to: "/teacher/settings", icon: SettingsIcon },
  { label: "navigation.about", to: "/teacher/about", icon: AboutIcon },
];

export const teacherChildRoutes = (
  <>
    <Route index element={<TeacherDashboard />} />
    <Route path="profile" element={<TeacherProfile />} />
    <Route path="timetable" element={<TeacherTimetable />} />
    <Route path="attendance" element={<TeacherAttendance />} />
    <Route path="homework" element={<TeacherHomework />} />
    <Route path="homework/:homeworkId" element={<TeacherHomeworkSubmissions />} />
    <Route path="syllabus" element={<TeacherSyllabus />} />
    <Route path="syllabus/new" element={<TeacherSyllabusForm />} />
    <Route path="syllabus/:id" element={<TeacherSyllabusDetail />} />
    <Route path="syllabus/:id/edit" element={<TeacherSyllabusForm />} />
    <Route path="marks" element={<TeacherMarks />} />
    <Route path="leave" element={<TeacherLeaveRequest />} />
    <Route path="notifications" element={<TeacherNotifications />} />
    <Route path="settings" element={<TeacherSettings />} />
    <Route path="about" element={<TeacherAbout />} />
    <Route path="copilot" element={<TeacherCopilot />} />
  </>
);
