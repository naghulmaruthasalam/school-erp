from enum import Enum


class StrEnum(str, Enum):
    """Python 3.10 compatible StrEnum."""
    pass


class Role(StrEnum):
    SUPER_ADMIN = "SUPER_ADMIN"
    SCHOOL_ADMIN = "SCHOOL_ADMIN"
    PRINCIPAL = "PRINCIPAL"
    TEACHER = "TEACHER"
    PARENT = "PARENT"
    STUDENT = "STUDENT"


# Roles that manage a school's day-to-day operations (used for broad admin-style guards)
STAFF_ROLES = (Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.TEACHER)
ADMIN_ROLES = (Role.SCHOOL_ADMIN, Role.PRINCIPAL)


class StudentStatus(StrEnum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    TRANSFERRED = "TRANSFERRED"
    GRADUATED = "GRADUATED"
    ALUMNI = "ALUMNI"


class TeacherStatus(StrEnum):
    ACTIVE = "ACTIVE"
    ON_LEAVE = "ON_LEAVE"
    INACTIVE = "INACTIVE"


class AdmissionStatus(StrEnum):
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CONVERTED = "CONVERTED"


class AttendanceStatus(StrEnum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    LATE = "LATE"
    HALF_DAY = "HALF_DAY"
    EXCUSED = "EXCUSED"


class HomeworkSubmissionStatus(StrEnum):
    PENDING = "PENDING"
    SUBMITTED = "SUBMITTED"
    LATE = "LATE"


class CalendarEventType(StrEnum):
    HOLIDAY = "HOLIDAY"
    EXAM = "EXAM"
    EVENT = "EVENT"
    OTHER = "OTHER"


class InvoiceStatus(StrEnum):
    PENDING = "PENDING"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    PAID = "PAID"
    OVERDUE = "OVERDUE"
    CANCELLED = "CANCELLED"


class PaymentMethod(StrEnum):
    CASH = "CASH"
    CHEQUE = "CHEQUE"
    BANK_TRANSFER = "BANK_TRANSFER"
    PAYU = "PAYU"


class PaymentStatus(StrEnum):
    CREATED = "CREATED"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    REFUND_PENDING = "REFUND_PENDING"
    REFUNDED = "REFUNDED"
    REFUND_FAILED = "REFUND_FAILED"


class FeeFrequency(StrEnum):
    ONE_TIME = "ONE_TIME"
    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    ANNUAL = "ANNUAL"


class DocumentModule(StrEnum):
    STUDENT_PHOTO = "STUDENT_PHOTO"
    TEACHER_PHOTO = "TEACHER_PHOTO"
    SCHOOL_LOGO = "SCHOOL_LOGO"
    ADMISSION_DOCUMENT = "ADMISSION_DOCUMENT"
    STUDENT_DOCUMENT = "STUDENT_DOCUMENT"
    TEACHER_DOCUMENT = "TEACHER_DOCUMENT"
    HOMEWORK_ATTACHMENT = "HOMEWORK_ATTACHMENT"
    HOMEWORK_SUBMISSION = "HOMEWORK_SUBMISSION"
    FEE_RECEIPT = "FEE_RECEIPT"
    REPORT_CARD = "REPORT_CARD"
    OTHER = "OTHER"
