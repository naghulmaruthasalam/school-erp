from fastapi import APIRouter

from app.api.v1.academics import router as academics_router
from app.api.v1.analytics import router as analytics_router
from app.api.v1.admissions import router as admissions_router
from app.api.v1.ai import router as ai_router
from app.api.v1.copilot import router as copilot_router
from app.api.v1.copilot_grading import router as copilot_grading_router
from app.api.v1.copilot_qpg import router as copilot_qpg_router
from app.api.v1.attendance import router as attendance_router
from app.api.v1.auth import router as auth_router
from app.api.v1.exams import router as exams_router
from app.api.v1.fees import router as fees_router
from app.api.v1.guardians import router as guardians_router
from app.api.v1.homework import router as homework_router
from app.api.v1.payments import router as payments_router
from app.api.v1.schools import router as schools_router
from app.api.v1.students import router as students_router
from app.api.v1.teachers import router as teachers_router
from app.api.v1.uploads import router as uploads_router
from app.api.v1.users import router as users_router
from app.api.v1.leave import router as leave_router
from app.api.v1.notifications import router as notifications_router
from app.api.v1.library import router as library_router
from app.api.v1.transport import router as transport_router
from app.api.v1.syllabus import router as syllabus_router
from app.api.v1.admin import router as admin_router
from app.api.v1.reports import router as reports_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(schools_router)
api_router.include_router(academics_router)
api_router.include_router(admissions_router)
api_router.include_router(students_router)
api_router.include_router(guardians_router)
api_router.include_router(teachers_router)
api_router.include_router(uploads_router)
api_router.include_router(attendance_router)
api_router.include_router(homework_router)
api_router.include_router(exams_router)
api_router.include_router(fees_router)
api_router.include_router(payments_router)
api_router.include_router(ai_router)
api_router.include_router(copilot_router)
api_router.include_router(copilot_qpg_router)
api_router.include_router(copilot_grading_router)
api_router.include_router(analytics_router)
api_router.include_router(users_router)
api_router.include_router(leave_router)
api_router.include_router(notifications_router)
api_router.include_router(library_router)
api_router.include_router(transport_router)
api_router.include_router(syllabus_router)
api_router.include_router(admin_router)
api_router.include_router(reports_router)
