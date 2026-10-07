import { Route } from "react-router-dom";
import type { NavItem } from "../../layouts/DashboardLayout";
import AcademicYearList from "./academics/AcademicYearList";
import CalendarView from "./academics/CalendarView";
import ClassList from "./academics/ClassList";
import SectionList from "./academics/SectionList";
import SubjectList from "./academics/SubjectList";
import TimetableView from "./academics/TimetableView";
import FeeCategoryList from "./fees/FeeCategoryList";
import FeeOverview from "./fees/FeeOverview";
import FeeStructureList from "./fees/FeeStructureList";
import InvoiceDetail from "./fees/InvoiceDetail";

/** Nav items for the Academics & Fees slice — concatenated with the sibling agent's nav items in App.tsx. */
export const academicsFeesNavItems: NavItem[] = [
  { label: "Academics", to: "/admin/academics", end: true },
  { label: "Classes", to: "/admin/academics/classes" },
  { label: "Sections", to: "/admin/academics/sections" },
  { label: "Subjects", to: "/admin/academics/subjects" },
  { label: "Timetable", to: "/admin/academics/timetable" },
  { label: "Calendar", to: "/admin/academics/calendar" },
  { label: "Fees", to: "/admin/fees", end: true },
  { label: "Assign & Invoice", to: "/admin/fees/manage" },
  { label: "Fee Structures", to: "/admin/fees/structures" },
  { label: "Fee Categories", to: "/admin/fees/categories" },
];

/** Child routes for the Academics & Fees slice — merged into the single `/admin` route tree in App.tsx. */
export const academicsFeesChildRoutes = (
  <>
    <Route path="academics" element={<AcademicYearList />} />
    <Route path="academics/classes" element={<ClassList />} />
    <Route path="academics/sections" element={<SectionList />} />
    <Route path="academics/subjects" element={<SubjectList />} />
    <Route path="academics/timetable" element={<TimetableView />} />
    <Route path="academics/calendar" element={<CalendarView />} />
    <Route path="fees/manage" element={<FeeOverview />} />
    <Route path="fees/structures" element={<FeeStructureList />} />
    <Route path="fees/categories" element={<FeeCategoryList />} />
    <Route path="fees/invoices/:id" element={<InvoiceDetail />} />
  </>
);
