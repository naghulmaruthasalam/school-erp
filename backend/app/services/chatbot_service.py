"""Chatbot service that uses Gemini AI with school data context."""
import logging
import re
from datetime import date, datetime
from typing import Any

from app.core.deps import CurrentUser
from app.core.enums import Role
from app.core.config import get_settings
from app.models.academic import AcademicYear, Class, Section, Subject, TimetableSlot
from app.models.attendance import StudentAttendance
from app.models.fee import Invoice
from app.models.homework import Homework
from app.models.notification import Notification
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.leave import LeaveRequest
from app.models.guardian import Guardian

logger = logging.getLogger(__name__)
settings = get_settings()

SUPPORT_PHONE = "+91 98765 43210"
SUPPORT_EMAIL = "support@cogniitec.com"
SUPPORT_MESSAGE = f"\n\nFor technical issues or further clarification, please contact:\n📞 Phone: {SUPPORT_PHONE}\n📧 Email: {SUPPORT_EMAIL}"


async def get_school_stats(school_id: str) -> dict[str, Any]:
    """Get basic school statistics."""
    total_students = await Student.find({"school_id": school_id}).count()
    total_teachers = await Teacher.find({"school_id": school_id}).count()
    total_classes = await Class.find({"school_id": school_id}).count()
    return {
        "total_students": total_students,
        "total_teachers": total_teachers,
        "total_classes": total_classes,
    }


async def get_student_info(current: CurrentUser) -> dict[str, Any] | None:
    """Get current student's information."""
    if current.role != Role.STUDENT:
        return None
    student = await Student.find_one({"user_id": str(current.user.id)})
    if not student:
        return None
    return {
        "name": current.user.full_name,
        "admission_no": student.admission_no,
        "class_id": student.class_id,
        "section_id": student.section_id,
    }


async def get_student_attendance(current: CurrentUser, days: int = 30) -> dict[str, Any]:
    """Get student's attendance summary."""
    student = await Student.find_one({"user_id": str(current.user.id)})
    if not student:
        return {"error": "Student not found"}

    records = await StudentAttendance.find({
        "student_id": str(student.id),
        "school_id": current.school_id,
    }).to_list()

    total = len(records)
    present = sum(1 for r in records if r.status.value == "PRESENT")
    absent = sum(1 for r in records if r.status.value == "ABSENT")

    return {
        "total_days": total,
        "present": present,
        "absent": absent,
        "percentage": round((present / total * 100), 1) if total > 0 else 0,
    }


async def get_student_fees(current: CurrentUser) -> dict[str, Any]:
    """Get student's fee status."""
    student = await Student.find_one({"user_id": str(current.user.id)})
    if not student:
        return {"error": "Student not found"}

    invoices = await Invoice.find({
        "student_id": str(student.id),
        "school_id": current.school_id,
    }).to_list()

    total_due = sum(i.total_amount for i in invoices)
    total_paid = sum(i.paid_amount for i in invoices)
    pending = total_due - total_paid

    return {
        "total_due": total_due,
        "total_paid": total_paid,
        "pending": pending,
        "invoices_count": len(invoices),
    }


async def get_pending_homework(current: CurrentUser) -> list[dict]:
    """Get pending homework for student."""
    student = await Student.find_one({"user_id": str(current.user.id)})
    if not student:
        return []

    homework = await Homework.find({
        "section_id": student.section_id,
        "school_id": current.school_id,
        "due_date": {"$gte": date.today()},
    }).to_list()

    return [
        {"title": h.title, "subject_id": h.subject_id, "due_date": h.due_date.isoformat()}
        for h in homework[:5]
    ]


async def get_recent_notifications(school_id: str, limit: int = 3) -> list[dict]:
    """Get recent notifications."""
    notifications = await Notification.find(
        Notification.school_id == school_id,
        Notification.is_published == True,
    ).sort(-Notification.created_at).limit(limit).to_list()

    return [
        {"title": n.title, "type": n.notification_type.value, "date": n.created_at.isoformat() if n.created_at else ""}
        for n in notifications
    ]


async def get_teacher_classes(current: CurrentUser) -> dict[str, Any]:
    """Get teacher's assigned classes."""
    teacher = await Teacher.find_one({"user_id": str(current.user.id)})
    if not teacher:
        return {"error": "Teacher not found"}

    slots = await TimetableSlot.find({
        "teacher_id": str(teacher.id),
        "school_id": current.school_id,
    }).to_list()

    return {
        "total_periods": len(slots),
        "unique_sections": len(set(s.section_id for s in slots)),
    }


async def get_leave_status(current: CurrentUser) -> dict[str, Any]:
    """Get leave request status."""
    user_id = str(current.user.id)

    leaves = await LeaveRequest.find({
        "user_id": user_id,
        "school_id": current.school_id,
    }).to_list()

    pending = sum(1 for l in leaves if l.status.value == "PENDING")
    approved = sum(1 for l in leaves if l.status.value == "APPROVED")

    return {
        "total": len(leaves),
        "pending": pending,
        "approved": approved,
    }


def match_intent(message: str) -> str:
    """Simple intent matching based on keywords."""
    msg = message.lower()

    # Greetings
    if any(w in msg for w in ["hi", "hello", "hey", "good morning", "good afternoon"]):
        return "greeting"

    # Platform/Schools management (Super Admin)
    if any(w in msg for w in ["schools", "all schools", "manage schools", "create school", "add school"]):
        return "schools_management"

    # Platform users (Super Admin)
    if any(w in msg for w in ["all users", "platform users", "user directory", "users list"]):
        return "platform_users"

    # Audit logs (Super Admin)
    if any(w in msg for w in ["audit", "audit log", "activity log", "logs", "track activity"]):
        return "audit_logs"

    # Platform analytics (Super Admin)
    if any(w in msg for w in ["platform stats", "platform analytics", "overview", "dashboard stats"]):
        return "platform_analytics"

    # Attendance
    if any(w in msg for w in ["attendance", "present", "absent", "attendance percentage"]):
        return "attendance"

    # Fees
    if any(w in msg for w in ["fee", "fees", "payment", "due", "pending fee", "pay"]):
        return "fees"

    # Homework
    if any(w in msg for w in ["homework", "assignment", "pending work", "due work"]):
        return "homework"

    # Timetable/Schedule
    if any(w in msg for w in ["timetable", "schedule", "class timing", "period"]):
        return "timetable"

    # Leave
    if any(w in msg for w in ["leave", "leave status", "leave request", "day off"]):
        return "leave"

    # Notifications/Announcements
    if any(w in msg for w in ["notification", "announcement", "notice", "circular"]):
        return "notifications"

    # School info
    if any(w in msg for w in ["school", "students count", "teachers count", "statistics"]):
        return "school_info"

    # Help
    if any(w in msg for w in ["help", "support", "contact", "issue", "problem"]):
        return "help"

    # Thank you
    if any(w in msg for w in ["thank", "thanks", "thank you"]):
        return "thanks"

    return "unknown"


def get_greeting_for_role(name: str, role: Role) -> str:
    """Get role-appropriate greeting message."""
    if role == Role.SUPER_ADMIN:
        return f"""Hello {name}! 👋 Welcome to Cogniitec Platform Assistant.

As a **Super Admin**, you can manage:
• 🏫 Schools - Create, view, and manage schools
• 👥 Users - View platform-wide user directory
• 📊 Analytics - Platform statistics and insights
• 📋 Audit Logs - Track platform activities
• ⚙️ Settings - Platform configuration

How can I assist you today?"""
    elif role == Role.SCHOOL_ADMIN:
        return f"""Hello {name}! 👋 Welcome to Cogniitec School Assistant.

As a **School Admin**, you can manage:
• 👨‍🎓 Students & Teachers - Staff management
• 📚 Academics - Classes, subjects, timetables
• 💰 Fees - Fee structures and collections
• 📊 Attendance - Track attendance records
• 📢 Notifications - Announcements and circulars

How can I help you today?"""
    elif role == Role.PRINCIPAL:
        return f"""Hello {name}! 👋 Welcome to Cogniitec School Assistant.

As a **Principal**, you can:
• 📊 View Analytics - School performance metrics
• 👥 Staff Overview - Teacher and staff management
• 📋 Approvals - Leave requests and admissions
• 📢 Announcements - School-wide communications

How can I assist you today?"""
    elif role == Role.TEACHER:
        return f"""Hello {name}! 👋 Welcome to Cogniitec School Assistant.

As a **Teacher**, you can:
• 📊 Attendance - Mark and view attendance
• 📚 Homework - Assign and track homework
• 📝 Exams - Manage marks and grades
• 📅 Timetable - View your schedule
• 📋 Leave - Submit leave requests

What would you like to know?"""
    elif role == Role.STUDENT:
        return f"""Hello {name}! 👋 Welcome to Cogniitec School Assistant.

You can ask me about:
• 📊 Attendance - Check your attendance
• 💰 Fees - View fee status
• 📚 Homework - Pending assignments
• 📢 Notifications - School announcements
• 📅 Timetable - Your class schedule

How can I help you today?"""
    elif role == Role.PARENT:
        return f"""Hello {name}! 👋 Welcome to Cogniitec School Assistant.

You can check your child's:
• 📊 Attendance - Attendance records
• 💰 Fees - Fee payment status
• 📚 Homework - Pending assignments
• 📢 Notifications - School updates
• 📋 Leave - Leave request status

What would you like to know?"""
    else:
        return f"""Hello {name}! 👋 Welcome to Cogniitec School Assistant.

How can I help you today?"""


async def get_parent_children(current: CurrentUser) -> list[dict]:
    """Get parent's children information."""
    guardian = await Guardian.find_one({"user_id": str(current.user.id)})
    if not guardian:
        return []

    children = []
    for student_id in guardian.student_ids or []:
        student = await Student.get(student_id)
        if student:
            attendance_records = await StudentAttendance.find({
                "student_id": str(student.id),
                "school_id": current.school_id,
            }).to_list()
            total = len(attendance_records)
            present = sum(1 for r in attendance_records if r.status.value == "PRESENT")

            invoices = await Invoice.find({
                "student_id": str(student.id),
                "school_id": current.school_id,
            }).to_list()
            total_due = sum(i.total_amount for i in invoices)
            total_paid = sum(i.paid_amount for i in invoices)

            children.append({
                "name": f"{student.first_name} {student.last_name}",
                "admission_no": student.admission_no,
                "class_id": student.class_id,
                "attendance_percentage": round((present / total * 100), 1) if total > 0 else 0,
                "fees_paid": total_paid,
                "fees_pending": total_due - total_paid,
            })
    return children


async def build_user_context(current: CurrentUser) -> str:
    """Build context string with user-specific data for AI."""
    role = current.role
    context_parts = [f"User: {current.user.full_name}", f"Role: {role.value}"]

    if role == Role.STUDENT:
        student = await Student.find_one({"user_id": str(current.user.id)})
        if student:
            context_parts.append(f"Student ID: {student.admission_no}")
            attendance = await get_student_attendance(current)
            context_parts.append(f"Attendance: {attendance.get('percentage', 0)}% ({attendance.get('present', 0)}/{attendance.get('total_days', 0)} days)")
            fees = await get_student_fees(current)
            context_parts.append(f"Fees: ₹{fees.get('pending', 0):,.0f} pending out of ₹{fees.get('total_due', 0):,.0f}")
            homework = await get_pending_homework(current)
            context_parts.append(f"Pending Homework: {len(homework)} assignments")

    elif role == Role.PARENT:
        children = await get_parent_children(current)
        for child in children:
            context_parts.append(f"Child: {child['name']} ({child['admission_no']}) - Attendance: {child['attendance_percentage']}%, Fees Pending: ₹{child['fees_pending']:,.0f}")

    elif role == Role.TEACHER:
        classes = await get_teacher_classes(current)
        context_parts.append(f"Assigned: {classes.get('unique_sections', 0)} sections, {classes.get('total_periods', 0)} periods/week")

    return "\n".join(context_parts)


async def process_with_gemini(current: CurrentUser, message: str, context: str) -> str | None:
    """Try to process message with Gemini AI. Returns None if Gemini is not available."""
    if not settings.gemini_api_key:
        return None

    try:
        from app.ai.gemini_client import get_model

        role_instructions = {
            Role.STUDENT: "You are a helpful school assistant for a student. Answer questions about their attendance, homework, fees, timetable, and exams based on the context provided.",
            Role.PARENT: "You are a helpful school assistant for a parent. Answer questions about their children's attendance, homework, fees, and school activities based on the context provided.",
            Role.TEACHER: "You are a helpful school assistant for a teacher. Help with class management, attendance, homework assignments, and teaching resources.",
            Role.PRINCIPAL: "You are a helpful school assistant for a principal. Provide school-wide statistics, staff management, and administrative insights.",
            Role.SCHOOL_ADMIN: "You are a helpful school assistant for a school administrator. Help with student/teacher management, fees, and school operations.",
            Role.SUPER_ADMIN: "You are a platform assistant for the super administrator. Help with platform-level operations and school management.",
        }

        system_prompt = f"""{role_instructions.get(current.role, 'You are a helpful school assistant.')}

Current User Context:
{context}

Rules:
- Be concise and professional
- Use the context data to answer questions accurately
- If you don't have specific data, say so clearly
- Format responses with emojis for better readability
- Always be helpful and supportive"""

        model = get_model(system_instruction=system_prompt)
        response = model.generate_content(message)
        return response.text + SUPPORT_MESSAGE
    except Exception as e:
        logger.warning(f"Gemini processing failed: {e}")
        return None


async def process_chat(current: CurrentUser, message: str) -> str:
    """Process chat message and return response."""
    # Build user context first
    context = await build_user_context(current)

    # Try Gemini first for intelligent responses
    gemini_response = await process_with_gemini(current, message, context)
    if gemini_response:
        return gemini_response

    # Fall back to keyword-based responses
    intent = match_intent(message)
    school_id = current.school_id
    role = current.role

    try:
        if intent == "greeting":
            return get_greeting_for_role(current.user.full_name, role)

        elif intent == "thanks":
            return f"You're welcome! 😊 Feel free to ask if you need anything else.{SUPPORT_MESSAGE}"

        elif intent == "schools_management":
            if role == Role.SUPER_ADMIN:
                return f"🏫 **Schools Management**\n\nYou can manage schools from your dashboard:\n• **View All Schools** - See all registered schools\n• **Add New School** - Register a new school\n• **School Details** - View/edit school information\n• **Activate/Deactivate** - Manage school status\n\nGo to **Schools** in your sidebar to get started!{SUPPORT_MESSAGE}"
            else:
                return f"School management is only available for Super Admins.{SUPPORT_MESSAGE}"

        elif intent == "platform_users":
            if role == Role.SUPER_ADMIN:
                return f"👥 **Platform Users**\n\nYou can view all users across the platform:\n• **User Directory** - Browse all users\n• **Filter by Role** - Students, Teachers, Admins\n• **Filter by School** - View school-specific users\n\nGo to **Users** in your sidebar to view the directory!{SUPPORT_MESSAGE}"
            else:
                return f"Platform-wide user directory is only available for Super Admins.{SUPPORT_MESSAGE}"

        elif intent == "audit_logs":
            if role == Role.SUPER_ADMIN:
                return f"📋 **Audit Logs**\n\nTrack all platform activities:\n• **User Actions** - Login, create, update, delete\n• **School Operations** - School management actions\n• **System Events** - Platform-wide events\n\nGo to **Audit Logs** in your sidebar to review activities!{SUPPORT_MESSAGE}"
            else:
                return f"Audit logs are only available for Super Admins.{SUPPORT_MESSAGE}"

        elif intent == "platform_analytics":
            if role == Role.SUPER_ADMIN:
                return f"📊 **Platform Analytics**\n\nYour dashboard shows key metrics:\n• **Total Schools** - Active and inactive\n• **Total Users** - Students, Teachers, Admins\n• **Recent Activity** - Latest platform actions\n• **Growth Trends** - User and school growth\n\nCheck your **Dashboard** for real-time analytics!{SUPPORT_MESSAGE}"
            else:
                return f"Platform analytics are only available for Super Admins.{SUPPORT_MESSAGE}"

        elif intent == "help":
            if role == Role.SUPER_ADMIN:
                return f"I'm here to help! As a Super Admin, you can:\n\n🏫 **Schools** - Manage all schools on the platform\n👥 **Users** - View platform-wide user directory\n📊 **Analytics** - Platform statistics and trends\n📋 **Audit Logs** - Track all platform activities\n⚙️ **Settings** - Configure platform settings{SUPPORT_MESSAGE}"
            elif role == Role.SCHOOL_ADMIN:
                return f"I'm here to help! As a School Admin, you can manage:\n\n👨‍🎓 **Students & Teachers** - Staff management\n📚 **Academics** - Classes, subjects, timetables\n💰 **Fees** - Fee structures and payments\n📊 **Attendance** - Attendance tracking\n📢 **Notifications** - School announcements{SUPPORT_MESSAGE}"
            else:
                return f"I'm here to help! You can ask me about:\n\n📊 **Attendance** - Check attendance records\n💰 **Fees** - View fee status\n📚 **Homework** - See assignments\n📢 **Notifications** - Get announcements\n📅 **Leave** - Check leave status\n🏫 **School Info** - Get statistics{SUPPORT_MESSAGE}"

        elif intent == "attendance":
            if role == Role.STUDENT:
                data = await get_student_attendance(current)
                if "error" in data:
                    return f"I couldn't find your attendance records. Please contact your class teacher.{SUPPORT_MESSAGE}"
                return f"📊 **Your Attendance Summary**\n\n• Total Days: {data['total_days']}\n• Present: {data['present']} days\n• Absent: {data['absent']} days\n• Attendance: {data['percentage']}%\n\nKeep up the good attendance! 🌟"
            else:
                return f"As a {role.value}, you can view attendance records in the Attendance section of your dashboard.{SUPPORT_MESSAGE}"

        elif intent == "fees":
            if role == Role.STUDENT:
                data = await get_student_fees(current)
                if "error" in data:
                    return f"I couldn't find your fee records. Please contact the accounts office.{SUPPORT_MESSAGE}"
                if data['pending'] > 0:
                    return f"💰 **Your Fee Status**\n\n• Total Due: ₹{data['total_due']:,.0f}\n• Paid: ₹{data['total_paid']:,.0f}\n• Pending: ₹{data['pending']:,.0f}\n\nPlease clear the pending amount to avoid any issues.{SUPPORT_MESSAGE}"
                else:
                    return f"💰 **Your Fee Status**\n\n• Total Paid: ₹{data['total_paid']:,.0f}\n• Pending: ₹0\n\n✅ All fees are cleared! Great job!"
            elif role == Role.PARENT:
                return f"You can view your child's fee details in the Fees section. Select your child from the dropdown to see their fee status.{SUPPORT_MESSAGE}"
            else:
                return f"Fee management is available in the Fees section of your admin dashboard.{SUPPORT_MESSAGE}"

        elif intent == "homework":
            if role in [Role.STUDENT, Role.PARENT]:
                homework = await get_pending_homework(current)
                if not homework:
                    return "📚 **Homework Status**\n\n✅ No pending homework! You're all caught up! 🎉"
                hw_list = "\n".join([f"• {h['title']} (Due: {h['due_date']})" for h in homework])
                return f"📚 **Pending Homework**\n\n{hw_list}\n\nMake sure to complete them before the due date!"
            else:
                return f"You can manage homework in the Homework section of your dashboard.{SUPPORT_MESSAGE}"

        elif intent == "notifications":
            notifications = await get_recent_notifications(school_id)
            if not notifications:
                return "📢 No recent notifications. Check back later!"
            notif_list = "\n".join([f"• [{n['type']}] {n['title']}" for n in notifications])
            return f"📢 **Recent Notifications**\n\n{notif_list}\n\nCheck the Notifications page for more details."

        elif intent == "leave":
            if role in [Role.TEACHER, Role.STUDENT]:
                data = await get_leave_status(current)
                return f"📅 **Leave Status**\n\n• Total Requests: {data['total']}\n• Pending: {data['pending']}\n• Approved: {data['approved']}\n\nYou can submit new leave requests from the Leave section."
            else:
                return f"Leave management is available in the Leave Requests section.{SUPPORT_MESSAGE}"

        elif intent == "timetable":
            return f"📅 Your timetable is available in the Timetable section of your dashboard. You can view your daily and weekly schedule there.{SUPPORT_MESSAGE}"

        elif intent == "school_info":
            if role in [Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.SUPER_ADMIN]:
                stats = await get_school_stats(school_id)
                return f"🏫 **School Statistics**\n\n• Total Students: {stats['total_students']}\n• Total Teachers: {stats['total_teachers']}\n• Total Classes: {stats['total_classes']}\n\nVisit the Dashboard for detailed analytics."
            else:
                return f"School information is available on your dashboard. Contact the administration for detailed statistics.{SUPPORT_MESSAGE}"

        else:
            if role == Role.SUPER_ADMIN:
                return f"I'm not sure I understand that. 🤔\n\nAs a Super Admin, you can ask me about:\n• Schools management\n• Platform users\n• Analytics & statistics\n• Audit logs\n• Platform settings\n\nOr try rephrasing your question!{SUPPORT_MESSAGE}"
            elif role == Role.SCHOOL_ADMIN:
                return f"I'm not sure I understand that. 🤔\n\nAs a School Admin, you can ask me about:\n• Students & Teachers\n• Academics & Timetables\n• Fees & Payments\n• Attendance records\n• Notifications\n\nOr try rephrasing your question!{SUPPORT_MESSAGE}"
            else:
                return f"I'm not sure I understand that. 🤔\n\nYou can ask me about:\n• Attendance\n• Fees\n• Homework\n• Notifications\n• Leave status\n• School information\n\nOr try rephrasing your question!{SUPPORT_MESSAGE}"

    except Exception as e:
        return f"Sorry, I encountered an issue while processing your request. Please try again later.{SUPPORT_MESSAGE}"
