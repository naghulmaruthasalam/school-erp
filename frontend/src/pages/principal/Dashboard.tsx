import { useQuery } from "@tanstack/react-query";
import {
  countPendingAdmissions,
  countStudents,
  countTeachers,
  fetchAttendanceDaily,
  fetchAttendanceTrend,
  fetchFeeCollection,
  fetchStaffAttendanceToday,
  fetchStudentAttendanceToday,
  fetchStudentDistribution,
  listUpcomingExams,
} from "./api";
import { Card, ErrorText, PageHeader, Spinner, StatTile } from "../../components/ui";
import { AttendanceAreaChart, AttendanceLineChart, FeeCollectionBarChart, StudentDistributionPie } from "../../components/Charts";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function PrincipalDashboard() {
  const studentsQuery = useQuery({ queryKey: ["principal", "students-count"], queryFn: countStudents });
  const teachersQuery = useQuery({ queryKey: ["principal", "teachers-count"], queryFn: countTeachers });
  const admissionsQuery = useQuery({ queryKey: ["principal", "pending-admissions"], queryFn: countPendingAdmissions });
  const examsQuery = useQuery({ queryKey: ["principal", "upcoming-exams"], queryFn: listUpcomingExams });
  const studentAttendanceQuery = useQuery({ queryKey: ["principal", "student-attendance-today"], queryFn: fetchStudentAttendanceToday });
  const staffAttendanceQuery = useQuery({ queryKey: ["principal", "staff-attendance-today"], queryFn: fetchStaffAttendanceToday });

  const attendanceTrendQuery = useQuery({ queryKey: ["principal", "attendance-trend"], queryFn: () => fetchAttendanceTrend(14) });
  const feeCollectionQuery = useQuery({ queryKey: ["principal", "fee-collection"], queryFn: () => fetchFeeCollection(6) });
  const studentDistQuery = useQuery({ queryKey: ["principal", "student-distribution"], queryFn: fetchStudentDistribution });
  const attendanceDailyQuery = useQuery({ queryKey: ["principal", "attendance-daily"], queryFn: () => fetchAttendanceDaily(7) });

  const anyError =
    studentsQuery.error ||
    teachersQuery.error ||
    admissionsQuery.error ||
    examsQuery.error ||
    studentAttendanceQuery.error ||
    staffAttendanceQuery.error;

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Principal Dashboard" subtitle="Today's school-wide summary." />

      {anyError && <ErrorText>Some data failed to load. Please refresh to try again.</ErrorText>}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <StatTile
            label="Active Students"
            value={studentsQuery.isLoading ? <Spinner /> : (studentsQuery.data ?? "—")}
          />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
          <StatTile
            label="Active Teachers"
            value={teachersQuery.isLoading ? <Spinner /> : (teachersQuery.data ?? "—")}
          />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <StatTile
            label="Pending Admissions"
            value={admissionsQuery.isLoading ? <Spinner /> : (admissionsQuery.data ?? "—")}
            hint="Status: SUBMITTED"
          />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: "0.25s" }}>
          <StatTile
            label="Upcoming Exams"
            value={examsQuery.isLoading ? <Spinner /> : (examsQuery.data?.total ?? "—")}
          />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <Card>
            <p className="text-sm font-medium text-violet-900 mb-4">Attendance Trend (14 days)</p>
            {attendanceTrendQuery.isLoading ? (
              <div className="flex h-[250px] items-center justify-center"><Spinner /></div>
            ) : attendanceTrendQuery.data && attendanceTrendQuery.data.length > 0 ? (
              <AttendanceLineChart data={attendanceTrendQuery.data} />
            ) : (
              <p className="text-sm text-violet-400 h-[250px] flex items-center justify-center">No attendance data available.</p>
            )}
          </Card>
        </div>

        <div className="animate-fade-in-up" style={{ animationDelay: "0.35s" }}>
          <Card>
            <p className="text-sm font-medium text-violet-900 mb-4">Fee Collection (6 months)</p>
            {feeCollectionQuery.isLoading ? (
              <div className="flex h-[250px] items-center justify-center"><Spinner /></div>
            ) : feeCollectionQuery.data && feeCollectionQuery.data.length > 0 ? (
              <FeeCollectionBarChart data={feeCollectionQuery.data} />
            ) : (
              <p className="text-sm text-violet-400 h-[250px] flex items-center justify-center">No payment data available.</p>
            )}
          </Card>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
          <Card>
            <p className="text-sm font-medium text-violet-900 mb-4">Students by Class</p>
            {studentDistQuery.isLoading ? (
              <div className="flex h-[250px] items-center justify-center"><Spinner /></div>
            ) : studentDistQuery.data && studentDistQuery.data.length > 0 ? (
              <StudentDistributionPie data={studentDistQuery.data} />
            ) : (
              <p className="text-sm text-violet-400 h-[250px] flex items-center justify-center">No student data available.</p>
            )}
          </Card>
        </div>

        <div className="animate-fade-in-up lg:col-span-2" style={{ animationDelay: "0.45s" }}>
          <Card>
            <p className="text-sm font-medium text-violet-900 mb-4">Weekly Attendance (Present vs Absent)</p>
            {attendanceDailyQuery.isLoading ? (
              <div className="flex h-[250px] items-center justify-center"><Spinner /></div>
            ) : attendanceDailyQuery.data && attendanceDailyQuery.data.length > 0 ? (
              <AttendanceAreaChart data={attendanceDailyQuery.data} />
            ) : (
              <p className="text-sm text-violet-400 h-[250px] flex items-center justify-center">No attendance data available.</p>
            )}
          </Card>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
          <Card>
            <p className="text-sm font-medium text-violet-900">Today's Student Attendance</p>
            {studentAttendanceQuery.isLoading ? (
              <Spinner className="mt-3" />
            ) : studentAttendanceQuery.data ? (
              studentAttendanceQuery.data.totalMarked === 0 ? (
                <p className="mt-2 text-sm text-violet-600">No attendance has been marked yet today.</p>
              ) : studentAttendanceQuery.data.complete ? (
                <>
                  <p className="mt-1 text-2xl font-semibold text-violet-900">
                    {Math.round((studentAttendanceQuery.data.presentCount / studentAttendanceQuery.data.totalMarked) * 100)}% present
                  </p>
                  <p className="mt-1 text-xs text-violet-400">
                    {studentAttendanceQuery.data.presentCount} of {studentAttendanceQuery.data.totalMarked} records marked today
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-2xl font-semibold text-violet-900">{studentAttendanceQuery.data.totalMarked}</p>
                  <p className="mt-1 text-xs text-violet-400">records marked today</p>
                </>
              )
            ) : null}
          </Card>
        </div>

        <div className="animate-fade-in-up" style={{ animationDelay: "0.55s" }}>
          <Card>
            <p className="text-sm font-medium text-violet-900">Today's Staff Attendance</p>
            {staffAttendanceQuery.isLoading ? (
              <Spinner className="mt-3" />
            ) : staffAttendanceQuery.data ? (
              staffAttendanceQuery.data.totalMarked === 0 ? (
                <p className="mt-2 text-sm text-violet-600">No staff attendance has been marked yet today.</p>
              ) : staffAttendanceQuery.data.complete ? (
                <>
                  <p className="mt-1 text-2xl font-semibold text-violet-900">
                    {Math.round((staffAttendanceQuery.data.presentCount / staffAttendanceQuery.data.totalMarked) * 100)}% present
                  </p>
                  <p className="mt-1 text-xs text-violet-400">
                    {staffAttendanceQuery.data.presentCount} of {staffAttendanceQuery.data.totalMarked} records marked today
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-2xl font-semibold text-violet-900">{staffAttendanceQuery.data.totalMarked}</p>
                  <p className="mt-1 text-xs text-violet-400">records marked today</p>
                </>
              )
            ) : null}
          </Card>
        </div>
      </div>

      <div className="animate-fade-in-up" style={{ animationDelay: "0.6s" }}>
        <Card>
          <p className="mb-3 text-sm font-medium text-violet-900">Upcoming Exams</p>
          {examsQuery.isLoading ? (
            <Spinner />
          ) : examsQuery.data && examsQuery.data.items.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {examsQuery.data.items.map((exam) => (
                <li key={exam.id} className="flex items-center justify-between py-2 text-sm transition-colors hover:bg-violet-50 px-2 -mx-2 rounded">
                  <span className="text-violet-900">{exam.name}</span>
                  <span className="text-violet-600">
                    {formatDate(exam.start_date)} – {formatDate(exam.end_date)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-violet-400">No exams scheduled.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
