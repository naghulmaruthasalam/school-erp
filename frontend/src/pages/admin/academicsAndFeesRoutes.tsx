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
  { label: "admin.nav.academics", to: "/admin/academics", end: true },
  { label: "admin.nav.classes", to: "/admin/academics/classes" },
  { label: "admin.nav.sections", to: "/admin/academics/sections" },
  { label: "admin.nav.subjects", to: "/admin/academics/subjects" },
  { label: "admin.nav.timetable", to: "/admin/academics/timetable" },
  { label: "admin.nav.calendar", to: "/admin/academics/calendar" },
  { label: "admin.nav.fees", to: "/admin/fees", end: true },
  { label: "admin.nav.assignInvoice", to: "/admin/fees/manage" },
  { label: "admin.nav.feeStructures", to: "/admin/fees/structures" },
  { label: "admin.nav.feeCategories", to: "/admin/fees/categories" },
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
