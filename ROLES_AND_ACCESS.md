# Cogniitec School ERP - Roles and Access Control

## Role Hierarchy

| Role | Description |
|------|-------------|
| **Super Admin** | Platform owner, manages all schools |
| **School Admin** | School-level admin, full school management |
| **Principal** | School head, similar to School Admin |
| **Teacher** | Teaches classes, manages attendance/homework/marks |
| **Student** | Views own data, submits homework |
| **Parent** | Views children's data |

---

## Access Matrix

### Super Admin
| Module | Create | Read | Update | Delete |
|--------|--------|------|--------|--------|
| Schools | ✅ | ✅ | ✅ | ✅ |
| Users (all) | ✅ | ✅ | ✅ | ✅ |
| Analytics | - | ✅ | - | - |
| Audit Logs | - | ✅ | - | - |
| Settings | - | ✅ | ✅ | - |

### School Admin / Principal
| Module | Create | Read | Update | Delete |
|--------|--------|------|--------|--------|
| Academic Years | ✅ | ✅ | ✅ | ✅ |
| Classes | ✅ | ✅ | ✅ | ✅ |
| Sections | ✅ | ✅ | ✅ | ✅ |
| Subjects | ✅ | ✅ | ✅ | ✅ |
| Teachers | ✅ | ✅ | ✅ | ✅ |
| Students | ✅ | ✅ | ✅ | ✅ |
| Guardians | ✅ | ✅ | ✅ | ✅ |
| **Timetable** | ✅ | ✅ | ✅ | ✅ |
| Attendance | ✅ | ✅ | ✅ | ✅ |
| Exams | ✅ | ✅ | ✅ | ✅ |
| Marks | ✅ | ✅ | ✅ | ✅ |
| Homework | ✅ | ✅ | ✅ | ✅ |
| Fee Structure | ✅ | ✅ | ✅ | ✅ |
| Fee Payments | ✅ | ✅ | ✅ | - |
| Notifications | ✅ | ✅ | - | - |
| Documents | ✅ | ✅ | - | ✅ |
| Leave Requests | - | ✅ | ✅ (approve) | - |
| Reports | - | ✅ | - | - |

### Teacher
| Module | Create | Read | Update | Delete |
|--------|--------|------|--------|--------|
| Own Profile | - | ✅ | ✅ (photo) | - |
| My Classes/Timetable | - | ✅ | - | - |
| Students (assigned) | - | ✅ | - | - |
| Attendance | ✅ (assigned classes only) | ✅ | ✅ (assigned classes only) | - |
| Homework | ✅ | ✅ | ✅ | ✅ |
| Marks | ✅ (assigned classes only) | ✅ | ✅ (assigned classes only) | - |
| Leave Requests | ✅ | ✅ (own) | - | - |
| Notifications | - | ✅ | - | - |

**Note:** Teachers are assigned specific classes/grades during registration. They can only mark attendance and enter exam results for students in their assigned classes.

### Student
| Module | Create | Read | Update | Delete |
|--------|--------|------|--------|--------|
| Own Profile | - | ✅ | ✅ (photo) | - |
| Timetable | - | ✅ | - | - |
| Attendance | - | ✅ (own) | - | - |
| Homework | - | ✅ | - | - |
| Homework Submissions | ✅ | ✅ | ✅ | - |
| Marks | - | ✅ (own) | - | - |
| Exams | - | ✅ | - | - |
| Fees | - | ✅ (own) | - | - |
| Notifications | - | ✅ | - | - |
| Leave Requests | ✅ | ✅ (own) | - | - |

### Parent
| Module | Create | Read | Update | Delete |
|--------|--------|------|--------|--------|
| Children Profiles | - | ✅ | - | - |
| Timetable | - | ✅ | - | - |
| Attendance | - | ✅ (children) | - | - |
| Homework | - | ✅ (children) | - | - |
| Marks | - | ✅ (children) | - | - |
| Fees | - | ✅ (children) | - | - |
| Fee Payments | ✅ | ✅ | - | - |
| Notifications | - | ✅ | - | - |
| Leave Requests | ✅ | ✅ (children) | - | - |

---

## Timetable Management

**Who can assign timetable?**
- School Admin
- Principal

**Location:** `/admin/timetable`

**Process:**
1. Create Academic Year
2. Create Classes
3. Create Sections for each Class
4. Create Subjects
5. Create Teachers
6. Assign Timetable slots (Teacher + Subject + Section + Day + Period)

---

## AI Assistant Context by Role

| Role | AI Can Access |
|------|--------------|
| Super Admin | Schools, users, analytics, platform settings |
| School Admin | Staff, students, fees, reports, school settings |
| Teacher | Classes, attendance, grades, timetable |
| Student | Homework, attendance, timetable, exams, fees |
| Parent | Child's attendance, grades, fees, homework |
