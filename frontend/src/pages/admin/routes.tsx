import { Route } from "react-router-dom";
import type { NavGroup } from "../../layouts/DashboardLayout";
import {
  DashboardIcon, ProfileIcon, StudentsIcon, TeachersIcon, AdmissionsIcon,
  LeaveIcon, NotificationsIcon, LibraryIcon, TransportIcon, TimetableIcon,
  AttendanceIcon, ExamsIcon, FeesIcon, CalendarIcon, AcademicIcon,
  HomeworkIcon, ReportIcon, DocumentsIcon, SettingsIcon, AboutIcon, SyllabusIcon
} from "../../components/Icons";
import AdminDashboard from "./Dashboard";
import AdmissionDetail from "./AdmissionDetail";
import AdmissionForm from "./AdmissionForm";
import AdmissionList from "./AdmissionList";
import LeaveList from "./LeaveList";
import NotificationList from "./NotificationList";
import LibraryList from "./LibraryList";
import TransportList from "./TransportList";
import TimetableList from "./TimetableList";
import AttendanceList from "./AttendanceList";
import ExamList from "./ExamList";
import FeeList from "./FeeList";
import CalendarList from "./CalendarList";
import AcademicSetup from "./AcademicSetup";
import HomeworkList from "./HomeworkList";
import ReportCards from "./ReportCards";
import DocumentList from "./DocumentList";
import Profile from "./Profile";
import Settings from "./Settings";
import StudentDetail from "./StudentDetail";
import StudentForm from "./StudentForm";
import StudentList from "./StudentList";
import TeacherDetail from "./TeacherDetail";
import TeacherForm from "./TeacherForm";
import TeacherList from "./TeacherList";
import About from "./About";
import SyllabusList from "./SyllabusList";
import SyllabusForm from "./SyllabusForm";
import SyllabusDetail from "./SyllabusDetail";
import Reports from "./Reports";

export const adminNavGroups: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", to: "/admin", end: true, icon: DashboardIcon },
    ],
  },
  {
    title: "People",
    items: [
      { label: "Students", to: "/admin/students", icon: StudentsIcon },
      { label: "Teachers", to: "/admin/teachers", icon: TeachersIcon },
      { label: "Admissions", to: "/admin/admissions", icon: AdmissionsIcon },
    ],
  },
  {
    title: "Academics",
    items: [
      { label: "Timetable", to: "/admin/timetable", icon: TimetableIcon },
      { label: "Attendance", to: "/admin/attendance", icon: AttendanceIcon },
      { label: "Homework", to: "/admin/homework", icon: HomeworkIcon },
      { label: "Syllabus", to: "/admin/syllabus", icon: SyllabusIcon },
      { label: "Exams", to: "/admin/exams", icon: ExamsIcon },
      { label: "Report Cards", to: "/admin/report-cards", icon: ReportIcon },
      { label: "Reports & Analytics", to: "/admin/reports", icon: ReportIcon },
      { label: "Academic Setup", to: "/admin/academic-setup", icon: AcademicIcon },
    ],
  },
  {
    title: "Finance",
    items: [
      { label: "Fee Overview", to: "/admin/fees", end: true, icon: FeesIcon },
    ],
  },
  {
    title: "Resources",
    items: [
      { label: "Library", to: "/admin/library", icon: LibraryIcon },
      { label: "Transport", to: "/admin/transport", icon: TransportIcon },
      { label: "Documents", to: "/admin/documents", icon: DocumentsIcon },
    ],
  },
  {
    title: "Management",
    items: [
      { label: "Leave Requests", to: "/admin/leave", icon: LeaveIcon },
      { label: "Notifications", to: "/admin/notifications", icon: NotificationsIcon },
      { label: "Calendar", to: "/admin/calendar", icon: CalendarIcon },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "My Profile", to: "/admin/profile", icon: ProfileIcon },
      { label: "Settings", to: "/admin/settings", icon: SettingsIcon },
      { label: "About", to: "/admin/about", icon: AboutIcon },
    ],
  },
];

export const adminChildRoutes = (
  <>
    <Route index element={<AdminDashboard />} />
    <Route path="profile" element={<Profile />} />
    <Route path="students" element={<StudentList />} />
    <Route path="students/new" element={<StudentForm />} />
    <Route path="students/:id" element={<StudentDetail />} />
    <Route path="teachers" element={<TeacherList />} />
    <Route path="teachers/new" element={<TeacherForm />} />
    <Route path="teachers/:id" element={<TeacherDetail />} />
    <Route path="admissions" element={<AdmissionList />} />
    <Route path="admissions/new" element={<AdmissionForm />} />
    <Route path="admissions/:id" element={<AdmissionDetail />} />
    <Route path="leave" element={<LeaveList />} />
    <Route path="notifications" element={<NotificationList />} />
    <Route path="library" element={<LibraryList />} />
    <Route path="transport" element={<TransportList />} />
    <Route path="timetable" element={<TimetableList />} />
    <Route path="attendance" element={<AttendanceList />} />
    <Route path="exams" element={<ExamList />} />
    <Route path="fees" element={<FeeList />} />
    <Route path="calendar" element={<CalendarList />} />
    <Route path="academic-setup" element={<AcademicSetup />} />
    <Route path="homework" element={<HomeworkList />} />
    <Route path="syllabus" element={<SyllabusList />} />
    <Route path="syllabus/new" element={<SyllabusForm />} />
    <Route path="syllabus/:id" element={<SyllabusDetail />} />
    <Route path="syllabus/:id/edit" element={<SyllabusForm />} />
    <Route path="report-cards" element={<ReportCards />} />
    <Route path="reports" element={<Reports />} />
    <Route path="documents" element={<DocumentList />} />
    <Route path="settings" element={<Settings />} />
    <Route path="about" element={<About />} />
  </>
);
