from datetime import date

from fastapi import APIRouter, Depends

from app.core.deps import CurrentUser, require_roles, require_tenant_user
from app.core.enums import Role
from app.schemas.academic import (
    AcademicYearCreateRequest,
    AcademicYearOut,
    AcademicYearUpdateRequest,
    CalendarEventCreateRequest,
    CalendarEventOut,
    CalendarEventUpdateRequest,
    ClassCreateRequest,
    ClassOut,
    ClassSubjectTeacherCreateRequest,
    ClassSubjectTeacherOut,
    ClassUpdateRequest,
    SectionCreateRequest,
    SectionOut,
    SectionUpdateRequest,
    SubjectCreateRequest,
    SubjectOut,
    SubjectUpdateRequest,
    TimetableSlotCreateRequest,
    TimetableSlotOut,
    TimetableSlotUpdateRequest,
)
from app.services import academic_service

router = APIRouter(prefix="/academics", tags=["academics"])

_write_roles = require_roles(Role.SCHOOL_ADMIN, Role.PRINCIPAL)

# ---------------------------------------------------------------------------
# AcademicYear
# ---------------------------------------------------------------------------


@router.post("/years", response_model=AcademicYearOut, status_code=201)
async def create_academic_year(
    payload: AcademicYearCreateRequest, current: CurrentUser = Depends(_write_roles)
) -> AcademicYearOut:
    year = await academic_service.create_academic_year(current.school_id, payload)
    return academic_service.to_academic_year_out(year)


@router.get("/years", response_model=list[AcademicYearOut])
async def list_academic_years(current: CurrentUser = Depends(require_tenant_user)) -> list[AcademicYearOut]:
    years = await academic_service.list_academic_years(current.school_id)
    return [academic_service.to_academic_year_out(y) for y in years]


@router.get("/years/{year_id}", response_model=AcademicYearOut)
async def get_academic_year(year_id: str, current: CurrentUser = Depends(require_tenant_user)) -> AcademicYearOut:
    year = await academic_service.get_academic_year(current.school_id, year_id)
    return academic_service.to_academic_year_out(year)


@router.patch("/years/{year_id}", response_model=AcademicYearOut)
async def update_academic_year(
    year_id: str, payload: AcademicYearUpdateRequest, current: CurrentUser = Depends(_write_roles)
) -> AcademicYearOut:
    year = await academic_service.update_academic_year(current.school_id, year_id, payload)
    return academic_service.to_academic_year_out(year)


# ---------------------------------------------------------------------------
# Class
# ---------------------------------------------------------------------------


@router.post("/classes", response_model=ClassOut, status_code=201)
async def create_class(payload: ClassCreateRequest, current: CurrentUser = Depends(_write_roles)) -> ClassOut:
    cls = await academic_service.create_class(current.school_id, payload)
    return academic_service.to_class_out(cls)


@router.get("/classes", response_model=list[ClassOut])
async def list_classes(
    academic_year_id: str | None = None, current: CurrentUser = Depends(require_tenant_user)
) -> list[ClassOut]:
    classes = await academic_service.list_classes(current.school_id, academic_year_id)
    return [academic_service.to_class_out(c) for c in classes]


@router.get("/classes/{class_id}", response_model=ClassOut)
async def get_class(class_id: str, current: CurrentUser = Depends(require_tenant_user)) -> ClassOut:
    cls = await academic_service.get_class(current.school_id, class_id)
    return academic_service.to_class_out(cls)


@router.patch("/classes/{class_id}", response_model=ClassOut)
async def update_class(
    class_id: str, payload: ClassUpdateRequest, current: CurrentUser = Depends(_write_roles)
) -> ClassOut:
    cls = await academic_service.update_class(current.school_id, class_id, payload)
    return academic_service.to_class_out(cls)


@router.delete("/classes/{class_id}", status_code=204)
async def delete_class(class_id: str, current: CurrentUser = Depends(_write_roles)) -> None:
    await academic_service.delete_class(current.school_id, class_id)


@router.post("/classes/seed", response_model=dict, status_code=201)
async def seed_classes_and_sections(
    academic_year_id: str,
    current: CurrentUser = Depends(_write_roles)
) -> dict:
    """Seed all standard classes (LKG to 12th) with sections (A-D)."""
    result = await academic_service.seed_classes_and_sections(current.school_id, academic_year_id)
    return result


# ---------------------------------------------------------------------------
# Section
# ---------------------------------------------------------------------------


@router.post("/sections", response_model=SectionOut, status_code=201)
async def create_section(payload: SectionCreateRequest, current: CurrentUser = Depends(_write_roles)) -> SectionOut:
    section = await academic_service.create_section(current.school_id, payload)
    return academic_service.to_section_out(section)


@router.get("/sections", response_model=list[SectionOut])
async def list_sections(
    class_id: str | None = None, current: CurrentUser = Depends(require_tenant_user)
) -> list[SectionOut]:
    sections = await academic_service.list_sections(current.school_id, class_id)
    return [academic_service.to_section_out(s) for s in sections]


@router.get("/sections/{section_id}", response_model=SectionOut)
async def get_section(section_id: str, current: CurrentUser = Depends(require_tenant_user)) -> SectionOut:
    section = await academic_service.get_section(current.school_id, section_id)
    return academic_service.to_section_out(section)


@router.patch("/sections/{section_id}", response_model=SectionOut)
async def update_section(
    section_id: str, payload: SectionUpdateRequest, current: CurrentUser = Depends(_write_roles)
) -> SectionOut:
    section = await academic_service.update_section(current.school_id, section_id, payload)
    return academic_service.to_section_out(section)


@router.delete("/sections/{section_id}", status_code=204)
async def delete_section(section_id: str, current: CurrentUser = Depends(_write_roles)) -> None:
    await academic_service.delete_section(current.school_id, section_id)


# ---------------------------------------------------------------------------
# Subject
# ---------------------------------------------------------------------------


@router.post("/subjects", response_model=SubjectOut, status_code=201)
async def create_subject(payload: SubjectCreateRequest, current: CurrentUser = Depends(_write_roles)) -> SubjectOut:
    subject = await academic_service.create_subject(current.school_id, payload)
    return academic_service.to_subject_out(subject)


@router.get("/subjects", response_model=list[SubjectOut])
async def list_subjects(current: CurrentUser = Depends(require_tenant_user)) -> list[SubjectOut]:
    subjects = await academic_service.list_subjects(current.school_id)
    return [academic_service.to_subject_out(s) for s in subjects]


@router.get("/subjects/{subject_id}", response_model=SubjectOut)
async def get_subject(subject_id: str, current: CurrentUser = Depends(require_tenant_user)) -> SubjectOut:
    subject = await academic_service.get_subject(current.school_id, subject_id)
    return academic_service.to_subject_out(subject)


@router.patch("/subjects/{subject_id}", response_model=SubjectOut)
async def update_subject(
    subject_id: str, payload: SubjectUpdateRequest, current: CurrentUser = Depends(_write_roles)
) -> SubjectOut:
    subject = await academic_service.update_subject(current.school_id, subject_id, payload)
    return academic_service.to_subject_out(subject)


@router.delete("/subjects/{subject_id}", status_code=204)
async def delete_subject(subject_id: str, current: CurrentUser = Depends(_write_roles)) -> None:
    await academic_service.delete_subject(current.school_id, subject_id)


# ---------------------------------------------------------------------------
# ClassSubjectTeacher
# ---------------------------------------------------------------------------


@router.post("/class-subject-teacher", response_model=ClassSubjectTeacherOut, status_code=201)
async def create_class_subject_teacher(
    payload: ClassSubjectTeacherCreateRequest, current: CurrentUser = Depends(_write_roles)
) -> ClassSubjectTeacherOut:
    cst = await academic_service.create_class_subject_teacher(current.school_id, payload)
    return academic_service.to_class_subject_teacher_out(cst)


@router.get("/class-subject-teacher", response_model=list[ClassSubjectTeacherOut])
async def list_class_subject_teachers(
    section_id: str | None = None,
    teacher_id: str | None = None,
    current: CurrentUser = Depends(require_tenant_user),
) -> list[ClassSubjectTeacherOut]:
    items = await academic_service.list_class_subject_teachers(current.school_id, section_id, teacher_id)
    return [academic_service.to_class_subject_teacher_out(i) for i in items]


@router.delete("/class-subject-teacher/{cst_id}", status_code=204)
async def delete_class_subject_teacher(cst_id: str, current: CurrentUser = Depends(_write_roles)) -> None:
    await academic_service.delete_class_subject_teacher(current.school_id, cst_id)


# ---------------------------------------------------------------------------
# TimetableSlot
# ---------------------------------------------------------------------------


@router.post("/timetable", response_model=TimetableSlotOut, status_code=201)
async def create_timetable_slot(
    payload: TimetableSlotCreateRequest, current: CurrentUser = Depends(_write_roles)
) -> TimetableSlotOut:
    slot = await academic_service.create_timetable_slot(current.school_id, payload)
    return academic_service.to_timetable_slot_out(slot)


@router.get("/timetable", response_model=list[TimetableSlotOut])
async def list_timetable_slots(
    section_id: str | None = None,
    teacher_id: str | None = None,
    current: CurrentUser = Depends(require_tenant_user),
) -> list[TimetableSlotOut]:
    slots = await academic_service.list_timetable_slots(current.school_id, section_id, teacher_id)
    return [academic_service.to_timetable_slot_out(s) for s in slots]


@router.patch("/timetable/{slot_id}", response_model=TimetableSlotOut)
async def update_timetable_slot(
    slot_id: str, payload: TimetableSlotUpdateRequest, current: CurrentUser = Depends(_write_roles)
) -> TimetableSlotOut:
    slot = await academic_service.update_timetable_slot(current.school_id, slot_id, payload)
    return academic_service.to_timetable_slot_out(slot)


@router.delete("/timetable/{slot_id}", status_code=204)
async def delete_timetable_slot(slot_id: str, current: CurrentUser = Depends(_write_roles)) -> None:
    await academic_service.delete_timetable_slot(current.school_id, slot_id)


# ---------------------------------------------------------------------------
# CalendarEvent
# ---------------------------------------------------------------------------


@router.post("/calendar", response_model=CalendarEventOut, status_code=201)
async def create_calendar_event(
    payload: CalendarEventCreateRequest, current: CurrentUser = Depends(_write_roles)
) -> CalendarEventOut:
    event = await academic_service.create_calendar_event(current.school_id, payload)
    return academic_service.to_calendar_event_out(event)


@router.get("/calendar", response_model=list[CalendarEventOut])
async def list_calendar_events(
    academic_year_id: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    current: CurrentUser = Depends(require_tenant_user),
) -> list[CalendarEventOut]:
    events = await academic_service.list_calendar_events(current.school_id, academic_year_id, start_date, end_date)
    return [academic_service.to_calendar_event_out(e) for e in events]


@router.patch("/calendar/{event_id}", response_model=CalendarEventOut)
async def update_calendar_event(
    event_id: str, payload: CalendarEventUpdateRequest, current: CurrentUser = Depends(_write_roles)
) -> CalendarEventOut:
    event = await academic_service.update_calendar_event(current.school_id, event_id, payload)
    return academic_service.to_calendar_event_out(event)


@router.delete("/calendar/{event_id}", status_code=204)
async def delete_calendar_event(event_id: str, current: CurrentUser = Depends(_write_roles)) -> None:
    await academic_service.delete_calendar_event(current.school_id, event_id)
