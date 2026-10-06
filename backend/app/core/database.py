from beanie import init_beanie

from app.core.config import get_settings
from app.core.tenant_db import get_client, close_client, get_database

settings = get_settings()


def get_all_models() -> list:
    """All document models - platform and tenant-scoped in the same database."""
    from app.models.tenant import Tenant
    from app.models.user import User
    from app.models.audit_log import AuditLog
    from app.models.cloud_service_log import CloudServiceLog
    from app.models.admission import Admission
    from app.models.ai_conversation import AIConversation
    from app.models.attendance import StaffAttendance, StudentAttendance
    from app.models.academic import (
        AcademicYear,
        CalendarEvent,
        Class,
        ClassSubjectTeacher,
        Section,
        Subject,
        TimetableSlot,
    )
    from app.models.document import Document as DocumentModel
    from app.models.exam import Exam, ExamSubject, Mark
    from app.models.fee import FeeAssignment, FeeCategory, FeeStructure, Invoice, Payment
    from app.models.guardian import Guardian
    from app.models.homework import Homework, HomeworkSubmission
    from app.models.homework_validation import HomeworkValidation
    from app.models.curriculum import CurriculumUnit
    from app.models.leave import LeaveRequest
    from app.models.notification import Notification, UserNotificationRead
    from app.models.library import Book, BookIssue
    from app.models.transport import Route, StudentTransport, Vehicle
    from app.models.student import Student
    from app.models.teacher import Teacher

    return [
        # Platform models (no school_id)
        Tenant,
        User,
        AuditLog,
        CloudServiceLog,
        # Tenant-scoped models (have school_id)
        Guardian,
        Student,
        Teacher,
        Admission,
        AcademicYear,
        Class,
        Section,
        Subject,
        ClassSubjectTeacher,
        TimetableSlot,
        CalendarEvent,
        StudentAttendance,
        StaffAttendance,
        Homework,
        HomeworkSubmission,
        HomeworkValidation,
        CurriculumUnit,
        LeaveRequest,
        Notification,
        UserNotificationRead,
        Book,
        BookIssue,
        Vehicle,
        Route,
        StudentTransport,
        Exam,
        ExamSubject,
        Mark,
        FeeCategory,
        FeeStructure,
        FeeAssignment,
        Invoice,
        Payment,
        DocumentModel,
        AIConversation,
    ]


# Backwards compatibility aliases
def get_platform_models() -> list:
    from app.models.tenant import Tenant
    from app.models.user import User
    from app.models.audit_log import AuditLog
    from app.models.cloud_service_log import CloudServiceLog
    return [Tenant, User, AuditLog, CloudServiceLog]


def get_tenant_models() -> list:
    all_models = get_all_models()
    platform = get_platform_models()
    return [m for m in all_models if m not in platform]


def get_document_models() -> list:
    return get_all_models()


async def init_db() -> None:
    """Initialize Beanie with all models in a single database."""
    db = get_database()
    await init_beanie(database=db, document_models=get_all_models())


async def close_db() -> None:
    close_client()
