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
      class_name: "Class 6",
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
    first_name: "Aarav",
    last_name: "Patel",
    full_name: "Aarav Patel",
    class_id: "c6",
    section_id: "s6",
    class_name: "Class 6",
    section_name: "A",
    roll_no: 15,
    date_of_birth: "2010-05-15",
    gender: "male",
    phone: "9876543210",
    email: "aarav.patel@demo.capitalschool.om",
    address: "456 Student Lane, Demo City",
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

  // Child attendance for parent - September & October 2026
  "/attendance/children": {
    items: [
      // October 2026
      { id: "a1", date: "2026-10-07", status: "PRESENT", marked_at: "2026-10-07T08:25:00", student_id: "child1" },
      { id: "a2", date: "2026-10-06", status: "PRESENT", marked_at: "2026-10-06T08:30:00", student_id: "child1" },
      { id: "a3", date: "2026-10-05", status: "PRESENT", marked_at: "2026-10-05T08:20:00", student_id: "child1" },
      { id: "a4", date: "2026-10-04", status: "LATE", marked_at: "2026-10-04T09:10:00", student_id: "child1" },
      { id: "a5", date: "2026-10-03", status: "PRESENT", marked_at: "2026-10-03T08:28:00", student_id: "child1" },
      { id: "a6", date: "2026-10-02", status: "PRESENT", marked_at: "2026-10-02T08:22:00", student_id: "child1" },
      { id: "a7", date: "2026-10-01", status: "PRESENT", marked_at: "2026-10-01T08:30:00", student_id: "child1" },
      // September 2026
      { id: "a8", date: "2026-09-30", status: "PRESENT", marked_at: "2026-09-30T08:30:00", student_id: "child1" },
      { id: "a9", date: "2026-09-29", status: "PRESENT", marked_at: "2026-09-29T08:25:00", student_id: "child1" },
      { id: "a10", date: "2026-09-28", status: "LATE", marked_at: "2026-09-28T09:15:00", student_id: "child1" },
      { id: "a11", date: "2026-09-27", status: "PRESENT", marked_at: "2026-09-27T08:20:00", student_id: "child1" },
      { id: "a12", date: "2026-09-26", status: "ABSENT", marked_at: null, student_id: "child1" },
      { id: "a13", date: "2026-09-25", status: "PRESENT", marked_at: "2026-09-25T08:30:00", student_id: "child1" },
      { id: "a14", date: "2026-09-24", status: "PRESENT", marked_at: "2026-09-24T08:28:00", student_id: "child1" },
      { id: "a15", date: "2026-09-23", status: "PRESENT", marked_at: "2026-09-23T08:22:00", student_id: "child1" },
      { id: "a16", date: "2026-09-22", status: "PRESENT", marked_at: "2026-09-22T08:25:00", student_id: "child1" },
      { id: "a17", date: "2026-09-21", status: "PRESENT", marked_at: "2026-09-21T08:30:00", student_id: "child1" },
      { id: "a18", date: "2026-09-20", status: "PRESENT", marked_at: "2026-09-20T08:20:00", student_id: "child1" },
      { id: "a19", date: "2026-09-19", status: "LATE", marked_at: "2026-09-19T09:05:00", student_id: "child1" },
      { id: "a20", date: "2026-09-18", status: "PRESENT", marked_at: "2026-09-18T08:25:00", student_id: "child1" },
    ],
    total: 52,
    page: 1,
    page_size: 20,
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
      { id: "inv1", invoice_no: "INV-2026-001", invoice_number: "INV-2026-001", student_name: "Aarav Sharma", paid_amount: 35000, total_amount: 35000, amount_paid: 35000, outstanding_amount: 0, status: "PAID", due_date: "2026-04-15", description: "Q1 - Tuition Fee + Lab Fee", created_at: "2026-04-01" },
      { id: "inv2", invoice_no: "INV-2026-002", invoice_number: "INV-2026-002", student_name: "Aarav Sharma", paid_amount: 35000, total_amount: 35000, amount_paid: 35000, outstanding_amount: 0, status: "PAID", due_date: "2026-07-15", description: "Q2 - Tuition Fee + Lab Fee", created_at: "2026-07-01" },
      { id: "inv3", invoice_no: "INV-2026-003", invoice_number: "INV-2026-003", student_name: "Aarav Sharma", paid_amount: 20000, total_amount: 35000, amount_paid: 20000, outstanding_amount: 15000, status: "PARTIALLY_PAID", due_date: "2026-10-15", description: "Q3 - Tuition Fee + Lab Fee", created_at: "2026-10-01" },
      { id: "inv4", invoice_no: "INV-2026-004", invoice_number: "INV-2026-004", student_name: "Aarav Sharma", paid_amount: 0, total_amount: 35000, amount_paid: 0, outstanding_amount: 35000, status: "PENDING", due_date: "2027-01-15", description: "Q4 - Tuition Fee + Lab Fee", created_at: "2026-12-01" },
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
    total_expected: 8500000,
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

  "/analytics/fee-by-class": [
    { name: "Class 6", billed: 1400000, collected: 1210000, pending: 190000 },
    { name: "Class 7", billed: 1500000, collected: 1260000, pending: 240000 },
    { name: "Class 8", billed: 1550000, collected: 1300000, pending: 250000 },
    { name: "Class 9", billed: 1900000, collected: 1550000, pending: 350000 },
    { name: "Class 10", billed: 2150000, collected: 1680000, pending: 470000 },
  ],

  "/analytics/recent-activity": [
    { type: "payment", title: "Fee Payment", description: "Aarav Sharma paid ₹12,500", time: new Date(Date.now() - 12 * 60000).toISOString() },
    { type: "admission", title: "New Admission", description: "Diya Nair applied for admission", time: new Date(Date.now() - 95 * 60000).toISOString() },
    { type: "attendance", title: "Attendance Marked", description: "Class 8-A: 38 students marked", time: new Date(Date.now() - 4 * 3600000).toISOString() },
    { type: "leave", title: "Leave Request", description: "Ravi Menon requested casual leave (pending)", time: new Date(Date.now() - 26 * 3600000).toISOString() },
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
      { id: "e1", name: "Mid-Term Examination", exam_type: "MID_TERM", class_id: "c1", class_ids: ["c1"], term: "UNIT_TEST", start_date: "2026-10-15", end_date: "2026-10-25", status: "upcoming", academic_year_id: "ay1" },
      { id: "e2", name: "Unit Test 3", exam_type: "UNIT_TEST", class_id: "c1", class_ids: ["c1"], term: "UNIT_TEST", start_date: "2026-10-05", end_date: "2026-10-06", status: "upcoming", academic_year_id: "ay1" },
      { id: "e3", name: "Unit Test 2", exam_type: "UNIT_TEST", class_id: "c1", class_ids: ["c1"], term: "UNIT_TEST", start_date: "2026-08-20", end_date: "2026-08-21", status: "completed", academic_year_id: "ay1" },
      { id: "e4", name: "Unit Test 1", exam_type: "UNIT_TEST", class_id: "c2", class_ids: ["c2"], term: "UNIT_TEST", start_date: "2026-06-15", end_date: "2026-06-16", status: "completed", academic_year_id: "ay1" },
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

  // Circulars
  "/circulars": {
    items: [
      { id: "c1", title: "Annual Day Celebration", content: "We are pleased to announce that our Annual Day will be celebrated on November 20th, 2026. Parents are cordially invited to attend. Programme starts at 4:00 PM.", circular_type: "GENERAL", priority: "HIGH", created_by_name: "Principal", created_at: "2026-10-05T10:00:00", attachment_url: null },
      { id: "c2", title: "Winter Uniform Notice", content: "Students are advised to switch to winter uniform from October 15th, 2026. Ensure proper school dress code is followed.", circular_type: "UNIFORM", priority: "NORMAL", created_by_name: "Admin Office", created_at: "2026-10-03T09:00:00", attachment_url: null },
      { id: "c3", title: "Parent-Teacher Meeting", content: "PTM for all classes will be held on October 25th, 2026. Timing: 9:00 AM to 1:00 PM. All parents are requested to attend.", circular_type: "MEETING", priority: "HIGH", created_by_name: "Principal", created_at: "2026-10-01T11:00:00", attachment_url: null },
      { id: "c4", title: "School Bus Route Change", content: "Due to road construction, Bus Route 5 will be modified from October 10th. New pickup timings will be shared via SMS.", circular_type: "TRANSPORT", priority: "NORMAL", created_by_name: "Transport Department", created_at: "2026-09-28T14:00:00", attachment_url: null },
      { id: "c5", title: "Health Check-up Camp", content: "Annual health check-up camp will be conducted for all students from October 8th to 10th. Please ensure students have had breakfast before coming to school.", circular_type: "HEALTH", priority: "NORMAL", created_by_name: "Health Department", created_at: "2026-09-25T10:00:00", attachment_url: null },
    ],
    total: 5,
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
        class_id: "c6",
        subject_id: "sub6",
        title: "Social Studies - Grade 6",
        description: "Grade 6 Social Studies curriculum covering History, Geography, and Civics",
        status: "PUBLISHED",
        chapters: [
          { id: "ch1", name: "Chapter 1: Ancient Civilizations", description: "Indus Valley, Mesopotamia, Egypt - Understanding early human societies", order: 1, video_url: "https://www.youtube.com/watch?v=F2qSfDDPOYY", duration_minutes: 25 },
          { id: "ch2", name: "Chapter 2: Geography - The Earth", description: "Continents, oceans, climate zones", order: 2, video_url: "https://www.youtube.com/watch?v=x4Ay7MgrPlk", duration_minutes: 20 },
          { id: "ch3", name: "Chapter 3: Civics - Local Government", description: "Understanding local governance and civic responsibilities", order: 3, video_url: "https://www.youtube.com/watch?v=SByX4uF3s-o", duration_minutes: 18 },
        ],
        chapters_count: 3,
        documents: [{ id: "doc1", filename: "Grade6_Social_Studies.pdf" }],
        created_by: "admin",
        created_at: "2026-04-01T10:00:00",
        updated_at: "2026-04-01T10:00:00",
      },
      {
        id: "syl2",
        school_id: "demo-school",
        academic_year_id: "ay1",
        class_id: "c6",
        subject_id: "sub1",
        title: "Mathematics - Grade 6",
        description: "Grade 6 Mathematics curriculum covering Numbers, Fractions, and Geometry",
        status: "PUBLISHED",
        chapters: [
          { id: "ch4", name: "Chapter 1: Numbers and Operations", description: "Whole numbers, integers, basic operations", order: 1, video_url: "https://www.youtube.com/watch?v=JnpqlXN9Whw", duration_minutes: 30 },
          { id: "ch5", name: "Chapter 2: Fractions and Decimals", description: "Operations with fractions and decimals", order: 2, video_url: "https://www.youtube.com/watch?v=GvLIOFKeqUI", duration_minutes: 28 },
          { id: "ch6", name: "Chapter 3: Basic Geometry", description: "Lines, angles, shapes", order: 3, video_url: "https://www.youtube.com/watch?v=IL3UCuXrUzE", duration_minutes: 25 },
          { id: "ch7", name: "Chapter 4: Mensuration", description: "Perimeter and area of basic shapes", order: 4, video_url: "https://www.youtube.com/watch?v=AUqeb9Z3y3k", duration_minutes: 22 },
        ],
        chapters_count: 4,
        documents: [{ id: "doc2", filename: "Grade6_Mathematics.pdf" }],
        created_by: "admin",
        created_at: "2026-04-01T10:00:00",
        updated_at: "2026-04-01T10:00:00",
      },
      {
        id: "syl3",
        school_id: "demo-school",
        academic_year_id: "ay1",
        class_id: "c6",
        subject_id: "sub2",
        title: "English - Grade 6",
        description: "Grade 6 English Language curriculum covering Reading, Writing, Grammar and Literature",
        status: "PUBLISHED",
        chapters: [
          { id: "ch21", name: "Chapter 1: Reading Comprehension", description: "Understanding texts, main ideas, inference skills", order: 1, video_url: "https://www.youtube.com/watch?v=Xr4V3dNGqOI", duration_minutes: 25 },
          { id: "ch22", name: "Chapter 2: Grammar Essentials", description: "Parts of speech, tenses, sentence structure", order: 2, video_url: "https://www.youtube.com/watch?v=E0XJYOVqxXA", duration_minutes: 30 },
          { id: "ch23", name: "Chapter 3: Creative Writing", description: "Essays, stories, descriptive writing", order: 3, video_url: "https://www.youtube.com/watch?v=RSoRzTtwgP4", duration_minutes: 28 },
          { id: "ch24", name: "Chapter 4: Poetry and Literature", description: "Understanding poems, literary devices", order: 4, video_url: "https://www.youtube.com/watch?v=Bk0k1hTNlrk", duration_minutes: 22 },
        ],
        chapters_count: 4,
        documents: [{ id: "doc4", filename: "Grade6_English.pdf" }],
        created_by: "admin",
        created_at: "2026-04-01T10:00:00",
        updated_at: "2026-04-01T10:00:00",
      },
      {
        id: "syl4",
        school_id: "demo-school",
        academic_year_id: "ay1",
        class_id: "c6",
        subject_id: "sub7",
        title: "اللغة العربية - الصف السادس (Arabic - Grade 6)",
        description: "منهج اللغة العربية للصف السادس - القراءة والكتابة والنحو",
        status: "PUBLISHED",
        chapters: [
          { id: "ch25", name: "الوحدة 1: مهارات القراءة", description: "فهم النصوص والأفكار الرئيسية", order: 1, video_url: "https://www.youtube.com/watch?v=HEVCr6y0J5E", duration_minutes: 25 },
          { id: "ch26", name: "الوحدة 2: قواعد النحو", description: "الأسماء والأفعال والحروف", order: 2, video_url: "https://www.youtube.com/watch?v=PKwuQ5UPYyw", duration_minutes: 30 },
          { id: "ch27", name: "الوحدة 3: التعبير الكتابي", description: "كتابة المقالات والقصص", order: 3, video_url: "https://www.youtube.com/watch?v=YYH-F7MPQWI", duration_minutes: 28 },
          { id: "ch28", name: "الوحدة 4: الأدب العربي", description: "الشعر والنثر والأساليب الأدبية", order: 4, video_url: "https://www.youtube.com/watch?v=wMYwXvCGZd4", duration_minutes: 26 },
        ],
        chapters_count: 4,
        documents: [{ id: "doc5", filename: "Grade6_Arabic.pdf" }],
        created_by: "admin",
        created_at: "2026-04-01T10:00:00",
        updated_at: "2026-04-01T10:00:00",
      },
      {
        id: "syl5",
        school_id: "demo-school",
        academic_year_id: "ay1",
        class_id: "c6",
        subject_id: "sub3",
        title: "Science - Grade 6",
        description: "Grade 6 Science curriculum covering Physics, Chemistry and Biology basics",
        status: "PUBLISHED",
        chapters: [
          { id: "ch29", name: "Chapter 1: Living Things", description: "Cells, organisms, ecosystems", order: 1, video_url: "https://www.youtube.com/watch?v=URUJD5NEXC8", duration_minutes: 30 },
          { id: "ch30", name: "Chapter 2: Matter and Materials", description: "States of matter, properties, changes", order: 2, video_url: "https://www.youtube.com/watch?v=btGPcEDvMvA", duration_minutes: 25 },
          { id: "ch31", name: "Chapter 3: Forces and Motion", description: "Types of forces, simple machines", order: 3, video_url: "https://www.youtube.com/watch?v=HfY88LUF0Dw", duration_minutes: 28 },
          { id: "ch32", name: "Chapter 4: Energy", description: "Forms of energy, energy transfer", order: 4, video_url: "https://www.youtube.com/watch?v=fHztd6k5ZXY", duration_minutes: 26 },
        ],
        chapters_count: 4,
        documents: [{ id: "doc6", filename: "Grade6_Science.pdf" }],
        created_by: "admin",
        created_at: "2026-04-01T10:00:00",
        updated_at: "2026-04-01T10:00:00",
      },
      // Grade 10 syllabi for teachers to see other grades
      {
        id: "syl6",
        school_id: "demo-school",
        academic_year_id: "ay1",
        class_id: "c1",
        subject_id: "sub1",
        title: "Mathematics - Grade 10",
        description: "Grade 10 Mathematics covering Algebra, Geometry, and Trigonometry",
        status: "PUBLISHED",
        chapters: [
          { id: "ch33", name: "Chapter 1: Real Numbers", description: "Euclid's division lemma, Fundamental Theorem of Arithmetic", order: 1, video_url: "https://www.youtube.com/watch?v=JnpqlXN9Whw", duration_minutes: 45 },
          { id: "ch34", name: "Chapter 2: Polynomials", description: "Zeros of polynomials, relationship between zeros and coefficients", order: 2, video_url: "https://www.youtube.com/watch?v=GvLIOFKeqUI", duration_minutes: 50 },
          { id: "ch35", name: "Chapter 3: Quadratic Equations", description: "Solutions, nature of roots, applications", order: 3, video_url: "https://www.youtube.com/watch?v=IL3UCuXrUzE", duration_minutes: 55 },
        ],
        chapters_count: 3,
        documents: [],
        created_by: "admin",
        created_at: "2026-04-01T10:00:00",
        updated_at: "2026-04-01T10:00:00",
      },
      {
        id: "syl7",
        school_id: "demo-school",
        academic_year_id: "ay1",
        class_id: "c2",
        subject_id: "sub2",
        title: "English - Grade 9",
        description: "Grade 9 English Language and Literature",
        status: "PUBLISHED",
        chapters: [
          { id: "ch36", name: "Chapter 1: Prose - The Lost Child", description: "Understanding narrative prose", order: 1, video_url: "https://www.youtube.com/watch?v=Xr4V3dNGqOI", duration_minutes: 30 },
          { id: "ch37", name: "Chapter 2: Poetry Analysis", description: "Understanding poetic devices and themes", order: 2, video_url: "https://www.youtube.com/watch?v=E0XJYOVqxXA", duration_minutes: 35 },
        ],
        chapters_count: 2,
        documents: [],
        created_by: "admin",
        created_at: "2026-04-01T10:00:00",
        updated_at: "2026-04-01T10:00:00",
      },
    ],
    total: 7,
    page: 1,
    page_size: 10,
  },

  // Subjects
  "/academics/subjects": [
    { id: "sub1", name: "Mathematics", code: "MATH" },
    { id: "sub2", name: "English", code: "ENG" },
    { id: "sub3", name: "Science", code: "SCI" },
    { id: "sub4", name: "Chemistry", code: "CHEM" },
    { id: "sub5", name: "Islamic Studies", code: "ISL" },
    { id: "sub6", name: "Social Studies", code: "SST" },
    { id: "sub7", name: "Arabic / اللغة العربية", code: "ARB" },
    { id: "sub8", name: "Computer Science", code: "CS" },
  ],

  // Section (linked to classes for attendance/homework)
  "/academics/sections": [
    { id: "s6", name: "A", class_id: "c6", room_no: "106" },
    { id: "s1", name: "A", class_id: "c1", room_no: "101" },
    { id: "s2", name: "B", class_id: "c1", room_no: "102" },
    { id: "s3", name: "C", class_id: "c1", room_no: "103" },
    { id: "s4", name: "A", class_id: "c2", room_no: "201" },
    { id: "s5", name: "B", class_id: "c2", room_no: "202" },
    { id: "s7", name: "A", class_id: "c4", room_no: "401" },
  ],

  // Class
  "/academics/classes": [
    { id: "c6", name: "Grade 6", academic_year_id: "ay1", order: 6 },
    { id: "c1", name: "Grade 10", academic_year_id: "ay1", order: 10 },
    { id: "c2", name: "Grade 9", academic_year_id: "ay1", order: 9 },
    { id: "c3", name: "Grade 8", academic_year_id: "ay1", order: 8 },
    { id: "c4", name: "Grade 7", academic_year_id: "ay1", order: 7 },
  ],
  // ---- Additional demo endpoints so every admin / platform screen renders ----
  "/payments": {
    items: [
      { id: "pay1", amount: 35000, payment_method: "UPI", transaction_id: "TXN-884201", payment_date: "2026-04-10" },
      { id: "pay2", amount: 35000, payment_method: "CARD", transaction_id: "TXN-884977", payment_date: "2026-07-12" },
      { id: "pay3", amount: 20000, payment_method: "NET_BANKING", transaction_id: "TXN-885530", payment_date: "2026-10-02" },
    ],
    total: 3, page: 1, page_size: 20,
  },

  "/academics/calendar": [
    { id: "ev1", school_id: "demo-school", academic_year_id: "ay1", title: "Parent-Teacher Meeting", description: "Term review with parents", event_date: tomorrow, event_type: "EVENT" },
    { id: "ev2", school_id: "demo-school", academic_year_id: "ay1", title: "Mid-Term Exams", description: "Classes 6 to 10", event_date: "2026-10-15", event_type: "EXAM" },
    { id: "ev3", school_id: "demo-school", academic_year_id: "ay1", title: "Diwali Break", description: null, event_date: "2026-10-28", event_type: "HOLIDAY" },
    { id: "ev4", school_id: "demo-school", academic_year_id: "ay1", title: "Sports Day", description: "Annual sports meet", event_date: "2026-11-12", event_type: "EVENT" },
  ],

  "/transport/stats": { total_vehicles: 4, active_vehicles: 3, total_routes: 3, students_using_transport: 86 },
  "/transport/vehicles": {
    items: [
      { id: "v1", vehicle_no: "KA-01-AB-1234", vehicle_type: "BUS", capacity: 40, driver_name: "Ramesh Kumar", driver_phone: "9876500011", driver_license: "DL-0420110012345", helper_name: "Suresh", helper_phone: "9876500012", status: "ACTIVE", insurance_expiry: "2027-03-31", fitness_expiry: "2027-01-15" },
      { id: "v2", vehicle_no: "KA-01-CD-5678", vehicle_type: "BUS", capacity: 32, driver_name: "Mahesh Gowda", driver_phone: "9876500021", driver_license: null, helper_name: null, helper_phone: null, status: "ACTIVE", insurance_expiry: "2026-12-20", fitness_expiry: "2026-11-05" },
      { id: "v3", vehicle_no: "KA-05-EF-9012", vehicle_type: "VAN", capacity: 14, driver_name: "Irfan Pasha", driver_phone: "9876500031", driver_license: null, helper_name: null, helper_phone: null, status: "MAINTENANCE", insurance_expiry: null, fitness_expiry: null },
    ],
    total: 3, page: 1, page_size: 100,
  },
  "/transport/routes": {
    items: [
      { id: "r1", route_name: "North Loop", route_code: "R-01", vehicle_id: "v1", vehicle_no: "KA-01-AB-1234", stops: [{ name: "Lake View", pickup_time: "07:00", drop_time: "15:30", fare: 900 }, { name: "Market Road", pickup_time: "07:15", drop_time: "15:15", fare: 800 }], is_active: true },
      { id: "r2", route_name: "East Side", route_code: "R-02", vehicle_id: "v2", vehicle_no: "KA-01-CD-5678", stops: [{ name: "Park Avenue", pickup_time: "07:05", drop_time: "15:25", fare: 1000 }], is_active: true },
    ],
    total: 2, page: 1, page_size: 100,
  },
  "/transport/assignments": {
    items: [
      { id: "a1", student_id: "s1", student_name: "Aarav Sharma", student_class: "Class 10 - A", route_id: "r1", route_name: "North Loop", stop_name: "Lake View", monthly_fee: 900, is_active: true },
      { id: "a2", student_id: "s2", student_name: "Priya Patel", student_class: "Class 10 - A", route_id: "r2", route_name: "East Side", stop_name: "Park Avenue", monthly_fee: 1000, is_active: true },
    ],
    total: 2, page: 1, page_size: 200,
  },

  "/schools/stats/overview": { total_schools: 12, active_schools: 10, inactive_schools: 2, total_users: 5840, active_users: 5312 },
  "/schools/stats/users": [
    { role: "STUDENT", count: 4120 }, { role: "PARENT", count: 3890 }, { role: "TEACHER", count: 412 },
    { role: "SCHOOL_ADMIN", count: 24 }, { role: "PRINCIPAL", count: 12 },
  ],
  "/schools/stats/audit-logs": [
    { id: "al1", school_name: "Bright Path School", actor_name: "Anita Rao", actor_email: "anita@bps.edu", action: "CREATE_STUDENT", entity_type: "student", entity_id: "s-1001", details: {}, created_at: new Date(Date.now() - 3600e3).toISOString() },
    { id: "al2", school_name: "Lakeview Academy", actor_name: "Ravi Menon", actor_email: "ravi@lakeview.edu", action: "UPDATE_FEE_STRUCTURE", entity_type: "fee_structure", entity_id: "fs-22", details: {}, created_at: new Date(Date.now() - 7200e3).toISOString() },
    { id: "al3", school_name: "Bright Path School", actor_name: "Meera Iyer", actor_email: "meera@bps.edu", action: "MARK_ATTENDANCE", entity_type: "attendance", entity_id: null, details: {}, created_at: new Date(Date.now() - 10800e3).toISOString() },
  ],
  "/schools": {
    items: [
      { id: "sc1", name: "Bright Path School", code: "SCH-2024-BPS001", address: "12 Lake Road", city: "Bengaluru", state: "Karnataka", country: "India", postal_code: "560001", phone: "9876500100", email: "office@bps.edu", logo_document_id: null, academic_year_start_month: 4, is_active: true, created_at: "2024-04-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
      { id: "sc2", name: "Lakeview Academy", code: "SCH-2024-LVA002", address: "8 Park Street", city: "Mysuru", state: "Karnataka", country: "India", postal_code: "570001", phone: "9876500200", email: "hello@lakeview.edu", logo_document_id: null, academic_year_start_month: 6, is_active: true, created_at: "2024-06-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
    ],
    total: 2, page: 1, page_size: 5,
  },
};

// Some screens read years as a plain array, others as a page ({ items }); serve both shapes.
{
  const years = DEMO_DATA["/academics/years"] as unknown[];
  Object.assign(years, { items: years, total: years.length, page: 1, page_size: years.length });
}

export function getDemoResponse(url: string): unknown | null {
  const cleanUrl = url.replace(/\?.*$/, "");
  const queryParams = new URLSearchParams(url.split("?")[1] || "");

  // Endpoints added for full-screen demo coverage (most specific first)
  if (cleanUrl.endsWith("/schools/stats/overview")) return DEMO_DATA["/schools/stats/overview"];
  if (cleanUrl.endsWith("/schools/stats/users")) return DEMO_DATA["/schools/stats/users"];
  if (cleanUrl.endsWith("/schools/stats/audit-logs")) return DEMO_DATA["/schools/stats/audit-logs"];
  if (cleanUrl.endsWith("/schools")) return DEMO_DATA["/schools"];
  if (cleanUrl.endsWith("/transport/stats")) return DEMO_DATA["/transport/stats"];
  if (cleanUrl.endsWith("/transport/vehicles")) return DEMO_DATA["/transport/vehicles"];
  if (cleanUrl.endsWith("/transport/routes")) return DEMO_DATA["/transport/routes"];
  if (cleanUrl.endsWith("/transport/assignments")) return DEMO_DATA["/transport/assignments"];
  if (cleanUrl.endsWith("/academics/calendar")) return DEMO_DATA["/academics/calendar"];
  if (cleanUrl.endsWith("/payments")) return DEMO_DATA["/payments"];

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
  if (cleanUrl.includes("/analytics/fee-by-class")) return DEMO_DATA["/analytics/fee-by-class"];
  if (cleanUrl.includes("/analytics/recent-activity")) return DEMO_DATA["/analytics/recent-activity"];
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
  if (cleanUrl.endsWith("/syllabus") || cleanUrl.includes("/syllabus?")) {
    const syllabusList = DEMO_DATA["/syllabus"] as { items: Array<{ id: string; class_id: string; status: string }> };
    // If request includes status=PUBLISHED (student/parent view), filter by their grade
    // Teachers see all syllabus (no status filter in their request)
    if (cleanUrl.includes("status=PUBLISHED")) {
      const demoStudentClassId = "c6";
      const filteredItems = syllabusList.items.filter(s => s.class_id === demoStudentClassId && s.status === "PUBLISHED");
      return { ...syllabusList, items: filteredItems, total: filteredItems.length };
    }
    // For teachers - return all items (optionally filter by class_id/subject_id if provided)
    let items = [...syllabusList.items];
    const classMatch = cleanUrl.match(/class_id=([^&]+)/);
    const subjectMatch = cleanUrl.match(/subject_id=([^&]+)/);
    if (classMatch) items = items.filter(s => s.class_id === classMatch[1]);
    if (subjectMatch) items = items.filter(s => (s as any).subject_id === subjectMatch[1]);
    return { ...syllabusList, items, total: items.length };
  }
  if (cleanUrl.endsWith("/academics/years")) return DEMO_DATA["/academics/years"];
  if (cleanUrl.endsWith("/academics/subjects")) return DEMO_DATA["/academics/subjects"];
  if (cleanUrl.includes("/academics/timetable")) return DEMO_DATA["/academics/timetable"];
  if (cleanUrl.includes("/academics/sections/")) {
    const sections = DEMO_DATA["/academics/sections"] as Array<{ id: string }>;
    const sectionId = cleanUrl.split("/academics/sections/")[1];
    return sections.find(s => s.id === sectionId) || sections[0];
  }
  if (cleanUrl.includes("/academics/sections")) return DEMO_DATA["/academics/sections"];
  if (cleanUrl.includes("/academics/classes/")) {
    const classes = DEMO_DATA["/academics/classes"] as Array<{ id: string }>;
    const classId = cleanUrl.split("/academics/classes/")[1];
    return classes.find(c => c.id === classId) || { id: classId, name: "Class 6", academic_year_id: "ay1", order: 6 };
  }
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
