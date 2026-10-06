const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

export const DEMO_DATA: Record<string, unknown> = {
  // Dashboard stats
  "/dashboard/stats": {
    total_students: 1250,
    total_teachers: 85,
    total_classes: 42,
    attendance_today: 94.5,
    fee_collection: 875000,
    pending_fees: 125000,
  },

  // Parent's children
  "/students/my-children": [
    {
      id: "child1",
      admission_no: "DEMO-STU-001",
      first_name: "Aarav",
      last_name: "Sharma",
      full_name: "Aarav Sharma",
      class_id: "c1",
      section_id: "s1",
      class_name: "Class 10",
      section_name: "A",
      roll_no: 15,
      date_of_birth: "2010-05-15",
      gender: "male",
      photo_url: null,
    },
    {
      id: "child2",
      admission_no: "DEMO-STU-002",
      first_name: "Priya",
      last_name: "Sharma",
      full_name: "Priya Sharma",
      class_id: "c2",
      section_id: "s2",
      class_name: "Class 7",
      section_name: "B",
      roll_no: 8,
      date_of_birth: "2013-08-22",
      gender: "female",
      photo_url: null,
    },
  ],

  // Guardian profile
  "/guardians/me": {
    id: "demo-guardian",
    full_name: "Demo Parent",
    first_name: "Demo",
    last_name: "Parent",
    phone: "9876543210",
    email: "demo.parent@email.com",
    relation: "Father",
  },

  // Teacher profile
  "/teachers/me": {
    id: "demo-teacher",
    emp_id: "DEMO-TCH-001",
    first_name: "Demo",
    last_name: "Teacher",
    full_name: "Demo Teacher",
    email: "demo.teacher@school.com",
    phone: "9876543220",
    subject_ids: ["sub1", "sub3"],
    qualification: "M.Sc., B.Ed.",
    date_of_joining: "2020-06-01",
  },

  // Teacher's assigned classes
  "/teachers/me/classes": [
    { class_id: "c1", class_name: "Class 10", section_id: "s1", section_name: "A", subject_id: "sub1", subject_name: "Mathematics" },
    { class_id: "c1", class_name: "Class 10", section_id: "s2", section_name: "B", subject_id: "sub1", subject_name: "Mathematics" },
    { class_id: "c2", class_name: "Class 9", section_id: "s3", section_name: "A", subject_id: "sub3", subject_name: "Physics" },
  ],

  // Teacher's timetable (includes section_id for attendance/homework filtering)
  "/teachers/me/timetable": [
    { id: "tt1", day_of_week: 0, period_number: 1, start_time: "08:00", end_time: "08:45", subject_id: "sub1", section_id: "s1", class_name: "Class 10-A" },
    { id: "tt2", day_of_week: 0, period_number: 3, start_time: "09:45", end_time: "10:30", subject_id: "sub1", section_id: "s2", class_name: "Class 10-B" },
    { id: "tt3", day_of_week: 1, period_number: 2, start_time: "08:45", end_time: "09:30", subject_id: "sub3", section_id: "s4", class_name: "Class 9-A" },
    { id: "tt4", day_of_week: 1, period_number: 4, start_time: "10:30", end_time: "11:15", subject_id: "sub1", section_id: "s1", class_name: "Class 10-A" },
    { id: "tt5", day_of_week: 2, period_number: 1, start_time: "08:00", end_time: "08:45", subject_id: "sub3", section_id: "s4", class_name: "Class 9-A" },
    { id: "tt6", day_of_week: 2, period_number: 3, start_time: "09:45", end_time: "10:30", subject_id: "sub1", section_id: "s2", class_name: "Class 10-B" },
  ],

  // Student profile
  "/students/me": {
    id: "demo-student",
    admission_no: "DEMO-STU-001",
    first_name: "Demo",
    last_name: "Student",
    full_name: "Demo Student",
    class_id: "c1",
    section_id: "s1",
    class_name: "Class 10",
    section_name: "A",
    roll_no: 15,
    date_of_birth: "2008-05-15",
    gender: "male",
    phone: "9876543210",
    email: "demo.student@school.com",
    address: "123 Demo Street, Demo City",
    photo_url: null,
  },

  // Students list (with section_id for filtering)
  "/students": {
    items: [
      { id: "stu1", admission_no: "STU-2024-001", first_name: "Aarav", last_name: "Sharma", full_name: "Aarav Sharma", class_id: "c1", section_id: "s1", class_name: "10-A", roll_number: "1", phone: "9876543210", status: "ACTIVE" },
      { id: "stu2", admission_no: "STU-2024-002", first_name: "Priya", last_name: "Patel", full_name: "Priya Patel", class_id: "c1", section_id: "s1", class_name: "10-A", roll_number: "2", phone: "9876543211", status: "ACTIVE" },
      { id: "stu3", admission_no: "STU-2024-003", first_name: "Rahul", last_name: "Kumar", full_name: "Rahul Kumar", class_id: "c1", section_id: "s1", class_name: "10-A", roll_number: "3", phone: "9876543212", status: "ACTIVE" },
      { id: "stu4", admission_no: "STU-2024-004", first_name: "Ananya", last_name: "Singh", full_name: "Ananya Singh", class_id: "c1", section_id: "s1", class_name: "10-A", roll_number: "4", phone: "9876543213", status: "ACTIVE" },
      { id: "stu5", admission_no: "STU-2024-005", first_name: "Vikram", last_name: "Reddy", full_name: "Vikram Reddy", class_id: "c1", section_id: "s1", class_name: "10-A", roll_number: "5", phone: "9876543214", status: "ACTIVE" },
      { id: "stu6", admission_no: "STU-2024-006", first_name: "Meera", last_name: "Nair", full_name: "Meera Nair", class_id: "c1", section_id: "s2", class_name: "10-B", roll_number: "1", phone: "9876543215", status: "ACTIVE" },
      { id: "stu7", admission_no: "STU-2024-007", first_name: "Arjun", last_name: "Menon", full_name: "Arjun Menon", class_id: "c1", section_id: "s2", class_name: "10-B", roll_number: "2", phone: "9876543216", status: "ACTIVE" },
      { id: "stu8", admission_no: "STU-2024-008", first_name: "Kavya", last_name: "Rao", full_name: "Kavya Rao", class_id: "c1", section_id: "s2", class_name: "10-B", roll_number: "3", phone: "9876543217", status: "ACTIVE" },
      { id: "stu9", admission_no: "STU-2024-009", first_name: "Aditya", last_name: "Gupta", full_name: "Aditya Gupta", class_id: "c2", section_id: "s4", class_name: "9-A", roll_number: "1", phone: "9876543218", status: "ACTIVE" },
      { id: "stu10", admission_no: "STU-2024-010", first_name: "Sneha", last_name: "Joshi", full_name: "Sneha Joshi", class_id: "c2", section_id: "s4", class_name: "9-A", roll_number: "2", phone: "9876543219", status: "ACTIVE" },
    ],
    total: 10,
    page: 1,
    page_size: 200,
  },

  // Attendance summary for student/parent dashboard
  "/attendance/students/summary": [
    { percentage_present: 92.5, total_days: 45, counts: { PRESENT: 42, ABSENT: 3, LATE: 0 } },
  ],

  // Child attendance for parent
  "/attendance/children": {
    items: [
      { id: "a1", date: "2026-09-30", status: "PRESENT", marked_at: "2026-09-30T08:30:00", student_id: "child1" },
      { id: "a2", date: "2026-09-29", status: "PRESENT", marked_at: "2026-09-29T08:25:00", student_id: "child1" },
      { id: "a3", date: "2026-09-28", status: "LATE", marked_at: "2026-09-28T09:15:00", student_id: "child1" },
    ],
    total: 45,
    page: 1,
    page_size: 10,
  },

  // Attendance history for student
  "/attendance/students": {
    items: [
      { id: "a1", date: "2026-09-30", status: "PRESENT", marked_at: "2026-09-30T08:30:00" },
      { id: "a2", date: "2026-09-29", status: "PRESENT", marked_at: "2026-09-29T08:25:00" },
      { id: "a3", date: "2026-09-28", status: "LATE", marked_at: "2026-09-28T09:15:00" },
      { id: "a4", date: "2026-09-27", status: "PRESENT", marked_at: "2026-09-27T08:20:00" },
      { id: "a5", date: "2026-09-26", status: "ABSENT", marked_at: null },
      { id: "a6", date: "2026-09-25", status: "PRESENT", marked_at: "2026-09-25T08:30:00" },
    ],
    total: 45,
    page: 1,
    page_size: 10,
  },

  // Pending homework for student
  "/homework/pending": [
    { id: "h1", title: "Algebra Practice Set", subject_name: "Mathematics", due_date: tomorrow, teacher_name: "Dr. Meera Iyer" },
    { id: "h2", title: "Essay: Climate Change", subject_name: "English", due_date: today, teacher_name: "Sunita Devi" },
    { id: "h3", title: "Physics Lab Report", subject_name: "Physics", due_date: tomorrow, teacher_name: "Rajesh Verma" },
  ],

  // Fee invoices for student
  "/fees/invoices": {
    items: [
      { id: "inv1", invoice_no: "INV-2026-001", total_amount: 35000, amount_paid: 35000, outstanding_amount: 0, status: "PAID", due_date: "2026-04-15", description: "Q1 - Tuition Fee + Lab Fee", created_at: "2026-04-01" },
      { id: "inv2", invoice_no: "INV-2026-002", total_amount: 35000, amount_paid: 35000, outstanding_amount: 0, status: "PAID", due_date: "2026-07-15", description: "Q2 - Tuition Fee + Lab Fee", created_at: "2026-07-01" },
      { id: "inv3", invoice_no: "INV-2026-003", total_amount: 35000, amount_paid: 20000, outstanding_amount: 15000, status: "PARTIALLY_PAID", due_date: "2026-10-15", description: "Q3 - Tuition Fee + Lab Fee", created_at: "2026-10-01" },
      { id: "inv4", invoice_no: "INV-2026-004", total_amount: 35000, amount_paid: 0, outstanding_amount: 35000, status: "PENDING", due_date: "2027-01-15", description: "Q4 - Tuition Fee + Lab Fee", created_at: "2026-12-01" },
    ],
    total: 4,
    page: 1,
    page_size: 10,
  },

  "/fees/categories": [
    { id: "fc1", name: "Tuition Fee", description: "Monthly tuition fee" },
    { id: "fc2", name: "Lab Fee", description: "Laboratory charges" },
    { id: "fc3", name: "Library Fee", description: "Library access fee" },
    { id: "fc4", name: "Sports Fee", description: "Sports and activities fee" },
  ],

  "/fees/structures": [
    { id: "fs1", category_id: "fc1", class_id: "c1", amount: 25000, frequency: "QUARTERLY" },
    { id: "fs2", category_id: "fc2", class_id: "c1", amount: 10000, frequency: "QUARTERLY" },
    { id: "fs3", category_id: "fc1", class_id: "c2", amount: 22000, frequency: "QUARTERLY" },
  ],

  "/fees/stats": {
    total_collected: 7000000,
    total_pending: 1500000,
    collection_percentage: 82.4,
    this_month_collected: 850000,
  },

  "/analytics/pending-fees": {
    total_pending: 1500000,
    overdue_count: 45,
    due_this_week: 350000,
  },

  "/analytics/attendance-trend": [
    { date: "2026-09-17", percentage: 92 },
    { date: "2026-09-18", percentage: 94 },
    { date: "2026-09-19", percentage: 91 },
    { date: "2026-09-20", percentage: 93 },
    { date: "2026-09-21", percentage: 89 },
    { date: "2026-09-22", percentage: 0 },
    { date: "2026-09-23", percentage: 0 },
    { date: "2026-09-24", percentage: 95 },
    { date: "2026-09-25", percentage: 93 },
    { date: "2026-09-26", percentage: 92 },
    { date: "2026-09-27", percentage: 94 },
    { date: "2026-09-28", percentage: 91 },
    { date: "2026-09-29", percentage: 0 },
    { date: "2026-09-30", percentage: 93 },
  ],

  "/analytics/fee-collection": [
    { month: "Apr", amount: 1200000 },
    { month: "May", amount: 850000 },
    { month: "Jun", amount: 920000 },
    { month: "Jul", amount: 1100000 },
    { month: "Aug", amount: 980000 },
    { month: "Sep", amount: 1050000 },
  ],

  "/analytics/student-distribution": [
    { name: "Class 10", value: 120 },
    { name: "Class 9", value: 115 },
    { name: "Class 8", value: 110 },
    { name: "Class 7", value: 105 },
    { name: "Class 6", value: 100 },
  ],

  "/analytics/attendance-daily": [
    { date: "2026-09-24", present: 1150, absent: 100 },
    { date: "2026-09-25", present: 1180, absent: 70 },
    { date: "2026-09-26", present: 1160, absent: 90 },
    { date: "2026-09-27", present: 1175, absent: 75 },
    { date: "2026-09-28", present: 1140, absent: 110 },
    { date: "2026-09-29", present: 0, absent: 0 },
    { date: "2026-09-30", present: 1165, absent: 85 },
  ],

  "/attendance/staff": {
    items: [
      { id: "sa1", teacher_id: "t1", date: "2026-09-30", status: "PRESENT" },
      { id: "sa2", teacher_id: "t2", date: "2026-09-30", status: "PRESENT" },
      { id: "sa3", teacher_id: "t3", date: "2026-09-30", status: "PRESENT" },
      { id: "sa4", teacher_id: "t4", date: "2026-09-30", status: "ABSENT" },
    ],
    total: 85,
    page: 1,
    page_size: 200,
  },

  "/admissions": {
    items: [],
    total: 0,
    page: 1,
    page_size: 10,
  },

  "/calendar/events": [
    { id: "ev1", title: "Parent-Teacher Meeting", start: "2026-09-15", end: "2026-09-15", type: "meeting" },
    { id: "ev2", title: "Mid-Term Exams", start: "2026-10-15", end: "2026-10-25", type: "exam" },
    { id: "ev3", title: "Diwali Break", start: "2026-10-28", end: "2026-11-05", type: "holiday" },
    { id: "ev4", title: "Sports Day", start: "2026-11-15", end: "2026-11-15", type: "event" },
  ],

  "/attendance/stats": {
    total_students: 1250,
    present_today: 1165,
    absent_today: 85,
    attendance_percentage: 93.2,
  },

  // Teachers list
  "/teachers": {
    items: [
      { id: "t1", emp_id: "TCH-001", full_name: "Dr. Meera Iyer", subject: "Mathematics", phone: "9876543220", email: "meera@school.com", status: "active" },
      { id: "t2", emp_id: "TCH-002", full_name: "Rajesh Verma", subject: "Physics", phone: "9876543221", email: "rajesh@school.com", status: "active" },
      { id: "t3", emp_id: "TCH-003", full_name: "Sunita Devi", subject: "English", phone: "9876543222", email: "sunita@school.com", status: "active" },
      { id: "t4", emp_id: "TCH-004", full_name: "Amit Joshi", subject: "Chemistry", phone: "9876543223", email: "amit@school.com", status: "active" },
    ],
    total: 85,
    page: 1,
    per_page: 10,
  },

  // Attendance
  "/attendance": {
    items: [
      { date: "2024-03-15", present: 1180, absent: 45, late: 25, total: 1250 },
      { date: "2024-03-14", present: 1195, absent: 35, late: 20, total: 1250 },
      { date: "2024-03-13", present: 1165, absent: 60, late: 25, total: 1250 },
    ],
    attendance_rate: 94.5,
  },

  // Student's own attendance
  "/students/me/attendance": {
    present_days: 85,
    absent_days: 5,
    late_days: 2,
    total_days: 92,
    percentage: 92.4,
    recent: [
      { date: "2024-03-15", status: "present" },
      { date: "2024-03-14", status: "present" },
      { date: "2024-03-13", status: "late" },
      { date: "2024-03-12", status: "present" },
      { date: "2024-03-11", status: "absent" },
    ],
  },

  // Timetable
  "/timetable": [
    // Monday (0)
    { id: "tt1", day_of_week: 0, period_number: 1, start_time: "08:00", end_time: "08:45", subject_id: "sub1", teacher_id: "t1" },
    { id: "tt2", day_of_week: 0, period_number: 2, start_time: "08:45", end_time: "09:30", subject_id: "sub2", teacher_id: "t3" },
    { id: "tt3", day_of_week: 0, period_number: 3, start_time: "09:45", end_time: "10:30", subject_id: "sub3", teacher_id: "t2" },
    { id: "tt4", day_of_week: 0, period_number: 4, start_time: "10:30", end_time: "11:15", subject_id: "sub4", teacher_id: "t4" },
    { id: "tt5", day_of_week: 0, period_number: 5, start_time: "11:30", end_time: "12:15", subject_id: "sub5", teacher_id: "t5" },
    { id: "tt6", day_of_week: 0, period_number: 6, start_time: "12:15", end_time: "13:00", subject_id: "sub6", teacher_id: "t6" },
    // Tuesday (1)
    { id: "tt7", day_of_week: 1, period_number: 1, start_time: "08:00", end_time: "08:45", subject_id: "sub2", teacher_id: "t3" },
    { id: "tt8", day_of_week: 1, period_number: 2, start_time: "08:45", end_time: "09:30", subject_id: "sub3", teacher_id: "t2" },
    { id: "tt9", day_of_week: 1, period_number: 3, start_time: "09:45", end_time: "10:30", subject_id: "sub1", teacher_id: "t1" },
    { id: "tt10", day_of_week: 1, period_number: 4, start_time: "10:30", end_time: "11:15", subject_id: "sub5", teacher_id: "t5" },
    { id: "tt11", day_of_week: 1, period_number: 5, start_time: "11:30", end_time: "12:15", subject_id: "sub4", teacher_id: "t4" },
    { id: "tt12", day_of_week: 1, period_number: 6, start_time: "12:15", end_time: "13:00", subject_id: "sub6", teacher_id: "t6" },
    // Wednesday (2)
    { id: "tt13", day_of_week: 2, period_number: 1, start_time: "08:00", end_time: "08:45", subject_id: "sub3", teacher_id: "t2" },
    { id: "tt14", day_of_week: 2, period_number: 2, start_time: "08:45", end_time: "09:30", subject_id: "sub1", teacher_id: "t1" },
    { id: "tt15", day_of_week: 2, period_number: 3, start_time: "09:45", end_time: "10:30", subject_id: "sub4", teacher_id: "t4" },
    { id: "tt16", day_of_week: 2, period_number: 4, start_time: "10:30", end_time: "11:15", subject_id: "sub2", teacher_id: "t3" },
    { id: "tt17", day_of_week: 2, period_number: 5, start_time: "11:30", end_time: "12:15", subject_id: "sub6", teacher_id: "t6" },
    { id: "tt18", day_of_week: 2, period_number: 6, start_time: "12:15", end_time: "13:00", subject_id: "sub5", teacher_id: "t5" },
    // Thursday (3)
    { id: "tt19", day_of_week: 3, period_number: 1, start_time: "08:00", end_time: "08:45", subject_id: "sub4", teacher_id: "t4" },
    { id: "tt20", day_of_week: 3, period_number: 2, start_time: "08:45", end_time: "09:30", subject_id: "sub5", teacher_id: "t5" },
    { id: "tt21", day_of_week: 3, period_number: 3, start_time: "09:45", end_time: "10:30", subject_id: "sub2", teacher_id: "t3" },
    { id: "tt22", day_of_week: 3, period_number: 4, start_time: "10:30", end_time: "11:15", subject_id: "sub1", teacher_id: "t1" },
    { id: "tt23", day_of_week: 3, period_number: 5, start_time: "11:30", end_time: "12:15", subject_id: "sub3", teacher_id: "t2" },
    { id: "tt24", day_of_week: 3, period_number: 6, start_time: "12:15", end_time: "13:00", subject_id: "sub6", teacher_id: "t6" },
    // Friday (4)
    { id: "tt25", day_of_week: 4, period_number: 1, start_time: "08:00", end_time: "08:45", subject_id: "sub1", teacher_id: "t1" },
    { id: "tt26", day_of_week: 4, period_number: 2, start_time: "08:45", end_time: "09:30", subject_id: "sub4", teacher_id: "t4" },
    { id: "tt27", day_of_week: 4, period_number: 3, start_time: "09:45", end_time: "10:30", subject_id: "sub3", teacher_id: "t2" },
    { id: "tt28", day_of_week: 4, period_number: 4, start_time: "10:30", end_time: "11:15", subject_id: "sub6", teacher_id: "t6" },
    { id: "tt29", day_of_week: 4, period_number: 5, start_time: "11:30", end_time: "12:15", subject_id: "sub2", teacher_id: "t3" },
    { id: "tt30", day_of_week: 4, period_number: 6, start_time: "12:15", end_time: "13:00", subject_id: "sub5", teacher_id: "t5" },
    // Saturday (5)
    { id: "tt31", day_of_week: 5, period_number: 1, start_time: "08:00", end_time: "08:45", subject_id: "sub6", teacher_id: "t6" },
    { id: "tt32", day_of_week: 5, period_number: 2, start_time: "08:45", end_time: "09:30", subject_id: "sub1", teacher_id: "t1" },
    { id: "tt33", day_of_week: 5, period_number: 3, start_time: "09:45", end_time: "10:30", subject_id: "sub5", teacher_id: "t5" },
    { id: "tt34", day_of_week: 5, period_number: 4, start_time: "10:30", end_time: "11:15", subject_id: "sub3", teacher_id: "t2" },
  ],

  // Academics timetable endpoint
  "/academics/timetable": [
    { id: "tt1", day_of_week: 0, period_number: 1, start_time: "08:00", end_time: "08:45", subject_id: "sub1", teacher_id: "t1" },
    { id: "tt2", day_of_week: 0, period_number: 2, start_time: "08:45", end_time: "09:30", subject_id: "sub2", teacher_id: "t3" },
    { id: "tt3", day_of_week: 0, period_number: 3, start_time: "09:45", end_time: "10:30", subject_id: "sub3", teacher_id: "t2" },
    { id: "tt4", day_of_week: 0, period_number: 4, start_time: "10:30", end_time: "11:15", subject_id: "sub4", teacher_id: "t4" },
    { id: "tt5", day_of_week: 0, period_number: 5, start_time: "11:30", end_time: "12:15", subject_id: "sub5", teacher_id: "t5" },
    { id: "tt6", day_of_week: 0, period_number: 6, start_time: "12:15", end_time: "13:00", subject_id: "sub6", teacher_id: "t6" },
    { id: "tt7", day_of_week: 1, period_number: 1, start_time: "08:00", end_time: "08:45", subject_id: "sub2", teacher_id: "t3" },
    { id: "tt8", day_of_week: 1, period_number: 2, start_time: "08:45", end_time: "09:30", subject_id: "sub3", teacher_id: "t2" },
    { id: "tt9", day_of_week: 1, period_number: 3, start_time: "09:45", end_time: "10:30", subject_id: "sub1", teacher_id: "t1" },
    { id: "tt10", day_of_week: 1, period_number: 4, start_time: "10:30", end_time: "11:15", subject_id: "sub5", teacher_id: "t5" },
    { id: "tt11", day_of_week: 1, period_number: 5, start_time: "11:30", end_time: "12:15", subject_id: "sub4", teacher_id: "t4" },
    { id: "tt12", day_of_week: 1, period_number: 6, start_time: "12:15", end_time: "13:00", subject_id: "sub6", teacher_id: "t6" },
    { id: "tt13", day_of_week: 2, period_number: 1, start_time: "08:00", end_time: "08:45", subject_id: "sub3", teacher_id: "t2" },
    { id: "tt14", day_of_week: 2, period_number: 2, start_time: "08:45", end_time: "09:30", subject_id: "sub1", teacher_id: "t1" },
    { id: "tt15", day_of_week: 2, period_number: 3, start_time: "09:45", end_time: "10:30", subject_id: "sub4", teacher_id: "t4" },
    { id: "tt16", day_of_week: 2, period_number: 4, start_time: "10:30", end_time: "11:15", subject_id: "sub2", teacher_id: "t3" },
    { id: "tt17", day_of_week: 3, period_number: 1, start_time: "08:00", end_time: "08:45", subject_id: "sub4", teacher_id: "t4" },
    { id: "tt18", day_of_week: 3, period_number: 2, start_time: "08:45", end_time: "09:30", subject_id: "sub5", teacher_id: "t5" },
    { id: "tt19", day_of_week: 3, period_number: 3, start_time: "09:45", end_time: "10:30", subject_id: "sub2", teacher_id: "t3" },
    { id: "tt20", day_of_week: 3, period_number: 4, start_time: "10:30", end_time: "11:15", subject_id: "sub1", teacher_id: "t1" },
    { id: "tt21", day_of_week: 4, period_number: 1, start_time: "08:00", end_time: "08:45", subject_id: "sub1", teacher_id: "t1" },
    { id: "tt22", day_of_week: 4, period_number: 2, start_time: "08:45", end_time: "09:30", subject_id: "sub4", teacher_id: "t4" },
    { id: "tt23", day_of_week: 4, period_number: 3, start_time: "09:45", end_time: "10:30", subject_id: "sub3", teacher_id: "t2" },
    { id: "tt24", day_of_week: 4, period_number: 4, start_time: "10:30", end_time: "11:15", subject_id: "sub6", teacher_id: "t6" },
    { id: "tt25", day_of_week: 5, period_number: 1, start_time: "08:00", end_time: "08:45", subject_id: "sub6", teacher_id: "t6" },
    { id: "tt26", day_of_week: 5, period_number: 2, start_time: "08:45", end_time: "09:30", subject_id: "sub1", teacher_id: "t1" },
    { id: "tt27", day_of_week: 5, period_number: 3, start_time: "09:45", end_time: "10:30", subject_id: "sub5", teacher_id: "t5" },
  ],

  // Homework list
  "/homework": {
    items: [
      { id: "h1", title: "Algebra Practice Set", subject_id: "sub1", subject_name: "Mathematics", due_date: "2026-10-05", status: "pending", teacher_name: "Dr. Meera Iyer", description: "Complete exercises 1-20 from chapter 5" },
      { id: "h2", title: "Essay Writing", subject_id: "sub2", subject_name: "English", due_date: "2026-10-03", status: "submitted", teacher_name: "Sunita Devi", description: "Write a 500-word essay on climate change" },
      { id: "h3", title: "Physics Lab Report", subject_id: "sub3", subject_name: "Physics", due_date: "2026-10-07", status: "pending", teacher_name: "Rajesh Verma", description: "Submit the pendulum experiment report" },
      { id: "h4", title: "Hindi Poetry Analysis", subject_id: "sub5", subject_name: "Hindi", due_date: "2026-10-04", status: "pending", teacher_name: "Kavita Sharma", description: "Analyze the given poem" },
    ],
    total: 4,
    page: 1,
    page_size: 10,
  },

  // Exams
  "/exams": {
    items: [
      { id: "e1", name: "Mid-Term Examination", exam_type: "MID_TERM", class_id: "c1", start_date: "2026-10-15", end_date: "2026-10-25", status: "upcoming", academic_year_id: "ay1" },
      { id: "e2", name: "Unit Test 3", exam_type: "UNIT_TEST", class_id: "c1", start_date: "2026-10-05", end_date: "2026-10-06", status: "upcoming", academic_year_id: "ay1" },
      { id: "e3", name: "Unit Test 2", exam_type: "UNIT_TEST", class_id: "c1", start_date: "2026-08-20", end_date: "2026-08-21", status: "completed", academic_year_id: "ay1" },
      { id: "e4", name: "Unit Test 1", exam_type: "UNIT_TEST", class_id: "c2", start_date: "2026-06-15", end_date: "2026-06-16", status: "completed", academic_year_id: "ay1" },
    ],
    total: 4,
    page: 1,
    page_size: 10,
  },

  // Exam results
  "/exams/results": {
    subject_marks: [
      { subject_id: "sub1", subject_name: "Mathematics", marks_obtained: 85, max_marks: 100, grade: "A" },
      { subject_id: "sub2", subject_name: "English", marks_obtained: 78, max_marks: 100, grade: "B+" },
      { subject_id: "sub3", subject_name: "Physics", marks_obtained: 92, max_marks: 100, grade: "A+" },
      { subject_id: "sub4", subject_name: "Chemistry", marks_obtained: 88, max_marks: 100, grade: "A" },
      { subject_id: "sub5", subject_name: "Hindi", marks_obtained: 75, max_marks: 100, grade: "B+" },
      { subject_id: "sub6", subject_name: "Computer Science", marks_obtained: 95, max_marks: 100, grade: "A+" },
    ],
    total_marks: 513,
    max_total: 600,
    percentage: 85.5,
    rank: 12,
    grade: "A",
  },

  // Marks/Results
  "/marks": {
    exams: [
      { exam_name: "Unit Test 1", subjects: [
        { subject: "Mathematics", marks: 85, total: 100, grade: "A" },
        { subject: "English", marks: 78, total: 100, grade: "B+" },
        { subject: "Physics", marks: 92, total: 100, grade: "A+" },
        { subject: "Chemistry", marks: 88, total: 100, grade: "A" },
      ]},
    ],
    overall_percentage: 85.75,
    rank: 12,
  },

  // Fees
  "/fees": {
    total_fee: 75000,
    paid: 50000,
    pending: 25000,
    due_date: "2024-04-15",
    payments: [
      { id: "p1", amount: 25000, date: "2024-01-15", method: "Online", status: "completed" },
      { id: "p2", amount: 25000, date: "2024-02-15", method: "Online", status: "completed" },
    ],
  },

  // Notifications
  "/notifications": {
    items: [
      { id: "n1", title: "Mid-Term Exam Schedule Released", content: "The mid-term examination schedule for Class 10 has been released. Exams will commence from October 15th. Please check the timetable section for detailed schedule.", notification_type: "ANNOUNCEMENT", priority: "HIGH", created_by_name: "Principal", created_at: "2026-09-28T10:00:00", is_read: false },
      { id: "n2", title: "Dussehra Holiday", content: "School will remain closed from October 10th to October 14th on account of Dussehra festival. Classes will resume on October 15th.", notification_type: "EVENT", priority: "NORMAL", created_by_name: "Admin Office", created_at: "2026-09-27T09:00:00", is_read: false },
      { id: "n3", title: "Fee Payment Reminder", content: "This is a gentle reminder that Q3 fees are due by October 15th. Kindly clear the dues to avoid late fee charges.", notification_type: "REMINDER", priority: "HIGH", created_by_name: "Accounts", created_at: "2026-09-25T11:00:00", is_read: true },
      { id: "n4", title: "Science Exhibition", content: "Annual Science Exhibition will be held on November 5th. Students interested in participating should register with their class teacher by October 20th.", notification_type: "EVENT", priority: "NORMAL", created_by_name: "Science Department", created_at: "2026-09-22T14:00:00", is_read: true },
      { id: "n5", title: "Sports Day Registration", content: "Registration for Annual Sports Day events is now open. Interested students can sign up for track and field events at the PE office.", notification_type: "ANNOUNCEMENT", priority: "NORMAL", created_by_name: "Sports Department", created_at: "2026-09-20T10:00:00", is_read: true },
      { id: "n6", title: "Library Book Return", content: "All library books borrowed before summer vacation must be returned by September 30th. Late returns will incur a fine of ₹5 per day.", notification_type: "REMINDER", priority: "NORMAL", created_by_name: "Library", created_at: "2026-09-18T09:00:00", is_read: true },
    ],
    total: 6,
    page: 1,
    page_size: 10,
  },

  // Classes
  "/classes": {
    items: [
      { id: "c1", name: "Class 10", sections: ["A", "B", "C"], total_students: 120 },
      { id: "c2", name: "Class 9", sections: ["A", "B"], total_students: 85 },
      { id: "c3", name: "Class 8", sections: ["A", "B", "C"], total_students: 110 },
    ],
  },

  // Academic years
  "/academic-years": {
    items: [
      { id: "ay1", name: "2024-25", start_date: "2024-04-01", end_date: "2025-03-31", is_current: true },
      { id: "ay2", name: "2023-24", start_date: "2023-04-01", end_date: "2024-03-31", is_current: false },
    ],
  },

  "/academics/years": [
    { id: "ay1", name: "2024-25", start_date: "2024-04-01", end_date: "2025-03-31", is_current: true },
    { id: "ay2", name: "2023-24", start_date: "2023-04-01", end_date: "2024-03-31", is_current: false },
  ],

  // Syllabus
  "/syllabus": {
    items: [
      {
        id: "syl1",
        school_id: "demo-school",
        academic_year_id: "ay1",
        class_id: "c3",
        subject_id: "sub6",
        title: "Social Studies - Class 6 Paper 1",
        description: "Class 6 Social Studies examination paper covering History, Geography, and Civics",
        status: "PUBLISHED",
        chapters: [
          { id: "ch1", name: "History - Ancient Civilizations", description: "Indus Valley, Mesopotamia, Egypt", order: 1 },
          { id: "ch2", name: "Geography - The Earth", description: "Continents, oceans, climate zones", order: 2 },
          { id: "ch3", name: "Civics - Local Government", description: "Panchayat, Municipality, roles", order: 3 },
        ],
        chapters_count: 3,
        documents: [{ id: "doc1", filename: "cls6_Social_P1.pdf" }],
        created_by: "admin",
        created_at: "2026-04-01T10:00:00",
        updated_at: "2026-04-01T10:00:00",
      },
      {
        id: "syl2",
        school_id: "demo-school",
        academic_year_id: "ay1",
        class_id: "c3",
        subject_id: "sub1",
        title: "Mathematics - Class 6 Hearing Paper 2",
        description: "Class 6 Mathematics special examination paper for hearing impaired students",
        status: "PUBLISHED",
        chapters: [
          { id: "ch4", name: "Numbers and Operations", description: "Whole numbers, integers, basic operations", order: 1 },
          { id: "ch5", name: "Fractions and Decimals", description: "Operations with fractions and decimals", order: 2 },
          { id: "ch6", name: "Basic Geometry", description: "Lines, angles, shapes", order: 3 },
          { id: "ch7", name: "Mensuration", description: "Perimeter and area of basic shapes", order: 4 },
        ],
        chapters_count: 4,
        documents: [{ id: "doc2", filename: "cls6_Math_HearingP2.pdf" }],
        created_by: "admin",
        created_at: "2026-04-01T10:00:00",
        updated_at: "2026-04-01T10:00:00",
      },
      {
        id: "syl3",
        school_id: "demo-school",
        academic_year_id: "ay1",
        class_id: "c4",
        subject_id: "sub1",
        title: "Mathematics - Class 1 Nashat Paper 2",
        description: "Class 1 Mathematics foundational paper covering basic numeracy",
        status: "PUBLISHED",
        chapters: [
          { id: "ch8", name: "Counting 1-100", description: "Number recognition and counting", order: 1 },
          { id: "ch9", name: "Addition", description: "Single digit addition", order: 2 },
          { id: "ch10", name: "Subtraction", description: "Single digit subtraction", order: 3 },
          { id: "ch11", name: "Shapes", description: "Basic 2D shapes - circle, square, triangle", order: 4 },
        ],
        chapters_count: 4,
        documents: [{ id: "doc3", filename: "cls1_Math_Nashat_p2.pdf" }],
        created_by: "admin",
        created_at: "2026-04-01T10:00:00",
        updated_at: "2026-04-01T10:00:00",
      },
      {
        id: "syl4",
        school_id: "demo-school",
        academic_year_id: "ay1",
        class_id: "c1",
        subject_id: "sub1",
        title: "Mathematics - Class 10",
        description: "Complete syllabus for Class 10 Mathematics including Algebra, Geometry, and Trigonometry",
        status: "PUBLISHED",
        chapters: [
          { id: "ch12", name: "Real Numbers", description: "Euclid's division lemma, Fundamental Theorem of Arithmetic", order: 1 },
          { id: "ch13", name: "Polynomials", description: "Zeros of polynomials, relationship between zeros and coefficients", order: 2 },
          { id: "ch14", name: "Quadratic Equations", description: "Solutions, nature of roots, applications", order: 3 },
          { id: "ch15", name: "Arithmetic Progressions", description: "nth term, sum of n terms, applications", order: 4 },
          { id: "ch16", name: "Triangles", description: "Similarity, Pythagoras theorem, applications", order: 5 },
        ],
        chapters_count: 5,
        documents: [],
        created_by: "admin",
        created_at: "2026-04-01T10:00:00",
        updated_at: "2026-04-01T10:00:00",
      },
      {
        id: "syl5",
        school_id: "demo-school",
        academic_year_id: "ay1",
        class_id: "c1",
        subject_id: "sub3",
        title: "Physics - Class 10",
        description: "Complete syllabus for Class 10 Physics covering Light, Electricity, and Magnetism",
        status: "PUBLISHED",
        chapters: [
          { id: "ch17", name: "Light - Reflection and Refraction", description: "Laws of reflection, mirror formula, refraction", order: 1 },
          { id: "ch18", name: "Human Eye and Colourful World", description: "Structure of eye, defects of vision, dispersion", order: 2 },
          { id: "ch19", name: "Electricity", description: "Electric current, Ohm's law, resistance, power", order: 3 },
          { id: "ch20", name: "Magnetic Effects of Electric Current", description: "Magnetic field, electromagnets, electric motor", order: 4 },
        ],
        chapters_count: 4,
        documents: [],
        created_by: "admin",
        created_at: "2026-04-01T10:00:00",
        updated_at: "2026-04-01T10:00:00",
      },
    ],
    total: 5,
    page: 1,
    page_size: 10,
  },

  // Subjects
  "/academics/subjects": [
    { id: "sub1", name: "Mathematics", code: "MATH" },
    { id: "sub2", name: "English", code: "ENG" },
    { id: "sub3", name: "Physics", code: "PHY" },
    { id: "sub4", name: "Chemistry", code: "CHEM" },
    { id: "sub5", name: "Hindi", code: "HIN" },
    { id: "sub6", name: "Social Studies", code: "SST" },
    { id: "sub7", name: "Computer Science", code: "CS" },
  ],

  // Section (linked to classes for attendance/homework)
  "/academics/sections": [
    { id: "s1", name: "A", class_id: "c1", room_no: "101" },
    { id: "s2", name: "B", class_id: "c1", room_no: "102" },
    { id: "s3", name: "C", class_id: "c1", room_no: "103" },
    { id: "s4", name: "A", class_id: "c2", room_no: "201" },
    { id: "s5", name: "B", class_id: "c2", room_no: "202" },
    { id: "s6", name: "A", class_id: "c3", room_no: "301" },
    { id: "s7", name: "A", class_id: "c4", room_no: "401" },
  ],

  // Class
  "/academics/classes": [
    { id: "c1", name: "Class 10", academic_year_id: "ay1", order: 10 },
    { id: "c2", name: "Class 9", academic_year_id: "ay1", order: 9 },
    { id: "c3", name: "Class 6", academic_year_id: "ay1", order: 6 },
    { id: "c4", name: "Class 1", academic_year_id: "ay1", order: 1 },
  ],
};

export function getDemoResponse(url: string): unknown | null {
  const cleanUrl = url.replace(/\?.*$/, "");
  const queryParams = new URLSearchParams(url.split("?")[1] || "");

  // Handle students with section_id filter (for attendance roster)
  if (cleanUrl.endsWith("/students") && queryParams.get("section_id")) {
    const sectionId = queryParams.get("section_id");
    const allStudents = DEMO_DATA["/students"] as { items: Array<{ section_id: string }> };
    const filtered = allStudents.items.filter(s => s.section_id === sectionId);
    return { items: filtered, total: filtered.length, page: 1, page_size: 200 };
  }

  // Exact endpoint matches (order matters - most specific first)
  if (cleanUrl.endsWith("/students/my-children")) return DEMO_DATA["/students/my-children"];
  if (cleanUrl.endsWith("/guardians/me")) return DEMO_DATA["/guardians/me"];
  if (cleanUrl.endsWith("/teachers/me")) return DEMO_DATA["/teachers/me"];
  if (cleanUrl.endsWith("/teachers/me/classes")) return DEMO_DATA["/teachers/me/classes"];
  if (cleanUrl.endsWith("/teachers/me/timetable")) return DEMO_DATA["/teachers/me/timetable"];
  if (cleanUrl.endsWith("/students/me")) return DEMO_DATA["/students/me"];
  if (cleanUrl.endsWith("/attendance/students/summary")) return DEMO_DATA["/attendance/students/summary"];
  if (cleanUrl.endsWith("/attendance/students")) return DEMO_DATA["/attendance/students"];
  if (cleanUrl.endsWith("/homework/pending")) return DEMO_DATA["/homework/pending"];
  if (cleanUrl.endsWith("/homework")) return DEMO_DATA["/homework"];
  if (cleanUrl.endsWith("/fees/invoices")) return DEMO_DATA["/fees/invoices"];
  if (cleanUrl.endsWith("/fees/categories")) return DEMO_DATA["/fees/categories"];
  if (cleanUrl.endsWith("/fees/structures")) return DEMO_DATA["/fees/structures"];
  if (cleanUrl.endsWith("/fees/stats")) return DEMO_DATA["/fees/stats"];
  if (cleanUrl.endsWith("/analytics/pending-fees")) return DEMO_DATA["/analytics/pending-fees"];
  if (cleanUrl.includes("/analytics/attendance-trend")) return DEMO_DATA["/analytics/attendance-trend"];
  if (cleanUrl.includes("/analytics/fee-collection")) return DEMO_DATA["/analytics/fee-collection"];
  if (cleanUrl.endsWith("/analytics/student-distribution")) return DEMO_DATA["/analytics/student-distribution"];
  if (cleanUrl.includes("/analytics/attendance-daily")) return DEMO_DATA["/analytics/attendance-daily"];
  if (cleanUrl.includes("/attendance/staff")) return DEMO_DATA["/attendance/staff"];
  if (cleanUrl.endsWith("/admissions")) return DEMO_DATA["/admissions"];
  if (cleanUrl.endsWith("/students") || cleanUrl.includes("/students?")) return DEMO_DATA["/students"];
  if (cleanUrl.includes("/calendar/events")) return DEMO_DATA["/calendar/events"];
  if (cleanUrl.includes("/attendance/stats")) return DEMO_DATA["/attendance/stats"];
  if (cleanUrl.endsWith("/exams")) return DEMO_DATA["/exams"];
  if (cleanUrl.includes("/exams/") && cleanUrl.includes("/result")) return DEMO_DATA["/exams/results"];
  if (cleanUrl.endsWith("/notifications")) return DEMO_DATA["/notifications"];

  // Individual syllabus item
  const syllabusMatch = cleanUrl.match(/\/syllabus\/(syl\d+)$/);
  if (syllabusMatch) {
    const syllabusList = DEMO_DATA["/syllabus"] as { items: Array<{ id: string }> };
    const item = syllabusList.items.find(s => s.id === syllabusMatch[1]);
    if (item) return item;
  }
  if (cleanUrl.endsWith("/syllabus") || cleanUrl.includes("/syllabus?")) return DEMO_DATA["/syllabus"];
  if (cleanUrl.endsWith("/academics/years")) return DEMO_DATA["/academics/years"];
  if (cleanUrl.endsWith("/academics/subjects")) return DEMO_DATA["/academics/subjects"];
  if (cleanUrl.includes("/academics/timetable")) return DEMO_DATA["/academics/timetable"];
  if (cleanUrl.includes("/academics/sections")) return DEMO_DATA["/academics/sections"];
  if (cleanUrl.includes("/academics/classes")) return DEMO_DATA["/academics/classes"];

  // Pattern matches
  for (const [pattern, data] of Object.entries(DEMO_DATA)) {
    if (cleanUrl.endsWith(pattern)) {
      return data;
    }
  }

  // Fallback matches
  if (cleanUrl.includes("/guardians")) return DEMO_DATA["/guardians/me"];
  if (cleanUrl.includes("/students/my-children")) return DEMO_DATA["/students/my-children"];
  if (cleanUrl.includes("/students")) return DEMO_DATA["/students"];
  if (cleanUrl.includes("/teachers/me")) return DEMO_DATA["/teachers/me"];
  if (cleanUrl.includes("/teachers")) return DEMO_DATA["/teachers"];
  if (cleanUrl.includes("/attendance/students")) return DEMO_DATA["/attendance/students"];
  if (cleanUrl.includes("/attendance")) return DEMO_DATA["/attendance/students/summary"];
  if (cleanUrl.includes("/homework")) return DEMO_DATA["/homework"];
  if (cleanUrl.includes("/fees")) return DEMO_DATA["/fees/invoices"];
  if (cleanUrl.includes("/timetable")) return DEMO_DATA["/timetable"];
  if (cleanUrl.includes("/academics/subjects")) return DEMO_DATA["/academics/subjects"];
  if (cleanUrl.includes("/academics/sections")) return DEMO_DATA["/academics/sections"];
  if (cleanUrl.includes("/academics/classes")) return DEMO_DATA["/academics/classes"];
  if (cleanUrl.includes("/classes")) return DEMO_DATA["/classes"];
  if (cleanUrl.includes("/academic")) return DEMO_DATA["/academic-years"];

  return { items: [], total: 0 };
}
