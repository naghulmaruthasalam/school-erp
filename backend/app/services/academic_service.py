from datetime import date, time

from app.core.exceptions import ConflictError, NotFoundError, ValidationAppError
from app.models.academic import (
    AcademicYear,
    CalendarEvent,
    Class,
    ClassSubjectTeacher,
    Section,
    Subject,
    TimetableSlot,
)
from app.models.base import utcnow
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

# ---------------------------------------------------------------------------
# Output converters
# ---------------------------------------------------------------------------


def to_academic_year_out(y: AcademicYear) -> AcademicYearOut:
    return AcademicYearOut(
        id=str(y.id), school_id=y.school_id, name=y.name, start_date=y.start_date, end_date=y.end_date,
        is_current=y.is_current,
    )


def to_class_out(c: Class) -> ClassOut:
    return ClassOut(
        id=str(c.id), school_id=c.school_id, academic_year_id=c.academic_year_id, name=c.name, order=c.order
    )


def to_section_out(s: Section) -> SectionOut:
    return SectionOut(
        id=str(s.id), school_id=s.school_id, class_id=s.class_id, name=s.name,
        class_teacher_id=s.class_teacher_id, room_no=s.room_no,
    )


def to_subject_out(s: Subject) -> SubjectOut:
    return SubjectOut(id=str(s.id), school_id=s.school_id, name=s.name, code=s.code)


def to_class_subject_teacher_out(c: ClassSubjectTeacher) -> ClassSubjectTeacherOut:
    return ClassSubjectTeacherOut(
        id=str(c.id), school_id=c.school_id, section_id=c.section_id, subject_id=c.subject_id,
        teacher_id=c.teacher_id,
    )


def to_timetable_slot_out(t: TimetableSlot) -> TimetableSlotOut:
    return TimetableSlotOut(
        id=str(t.id), school_id=t.school_id, section_id=t.section_id, day_of_week=t.day_of_week,
        period_number=t.period_number, start_time=time.fromisoformat(t.start_time),
        end_time=time.fromisoformat(t.end_time), subject_id=t.subject_id, teacher_id=t.teacher_id,
    )


def to_calendar_event_out(e: CalendarEvent) -> CalendarEventOut:
    return CalendarEventOut(
        id=str(e.id), school_id=e.school_id, academic_year_id=e.academic_year_id, title=e.title,
        description=e.description, event_date=e.event_date, event_type=e.event_type,
    )


# ---------------------------------------------------------------------------
# AcademicYear
# ---------------------------------------------------------------------------


async def _unset_current_academic_year(school_id: str) -> None:
    current = await AcademicYear.find(AcademicYear.school_id == school_id, AcademicYear.is_current == True).to_list()  # noqa: E712
    for y in current:
        y.is_current = False
        y.updated_at = utcnow()
        await y.save()


async def create_academic_year(school_id: str, payload: AcademicYearCreateRequest) -> AcademicYear:
    if payload.end_date <= payload.start_date:
        raise ValidationAppError("end_date must be after start_date")

    if payload.is_current:
        await _unset_current_academic_year(school_id)

    year = AcademicYear(school_id=school_id, **payload.model_dump())
    await year.insert()
    return year


async def list_academic_years(school_id: str) -> list[AcademicYear]:
    return await AcademicYear.find(AcademicYear.school_id == school_id).to_list()


async def get_academic_year(school_id: str, year_id: str) -> AcademicYear:
    year = await AcademicYear.get(year_id)
    if year is None or year.school_id != school_id:
        raise NotFoundError("Academic year not found")
    return year


async def update_academic_year(school_id: str, year_id: str, payload: AcademicYearUpdateRequest) -> AcademicYear:
    year = await get_academic_year(school_id, year_id)
    data = payload.model_dump(exclude_unset=True)

    new_start = data.get("start_date", year.start_date)
    new_end = data.get("end_date", year.end_date)
    if new_end <= new_start:
        raise ValidationAppError("end_date must be after start_date")

    make_current = data.pop("is_current", None)
    for field, value in data.items():
        setattr(year, field, value)

    if make_current is True and not year.is_current:
        await _unset_current_academic_year(school_id)
        year.is_current = True
    elif make_current is False:
        year.is_current = False

    year.updated_at = utcnow()
    await year.save()
    return year


# ---------------------------------------------------------------------------
# Class
# ---------------------------------------------------------------------------


async def create_class(school_id: str, payload: ClassCreateRequest) -> Class:
    await get_academic_year(school_id, payload.academic_year_id)
    cls = Class(school_id=school_id, **payload.model_dump())
    await cls.insert()
    return cls


async def list_classes(school_id: str, academic_year_id: str | None = None) -> list[Class]:
    query = {"school_id": school_id}
    if academic_year_id is not None:
        query["academic_year_id"] = academic_year_id
    return await Class.find(query).to_list()


async def get_class(school_id: str, class_id: str) -> Class:
    cls = await Class.get(class_id)
    if cls is None or cls.school_id != school_id:
        raise NotFoundError("Class not found")
    return cls


async def update_class(school_id: str, class_id: str, payload: ClassUpdateRequest) -> Class:
    cls = await get_class(school_id, class_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(cls, field, value)
    cls.updated_at = utcnow()
    await cls.save()
    return cls


async def delete_class(school_id: str, class_id: str) -> None:
    cls = await get_class(school_id, class_id)
    # Delete all sections for this class first
    await Section.find(Section.school_id == school_id, Section.class_id == class_id).delete()
    await cls.delete()


async def seed_classes_and_sections(school_id: str, academic_year_id: str) -> dict:
    """Seed all standard classes (LKG to 12th) with sections (A-D)."""
    # Verify academic year exists
    year = await get_academic_year(school_id, academic_year_id)

    CLASS_NAMES = [
        ("LKG", 1), ("UKG", 2),
        ("Class 1", 3), ("Class 2", 4), ("Class 3", 5), ("Class 4", 6),
        ("Class 5", 7), ("Class 6", 8), ("Class 7", 9), ("Class 8", 10),
        ("Class 9", 11), ("Class 10", 12), ("Class 11", 13), ("Class 12", 14),
    ]
    SECTIONS = ["A", "B", "C", "D"]

    created_classes = 0
    created_sections = 0

    for class_name, order in CLASS_NAMES:
        # Check if class exists
        existing = await Class.find_one(
            Class.school_id == school_id,
            Class.academic_year_id == academic_year_id,
            Class.name == class_name
        )

        if existing:
            cls = existing
        else:
            cls = Class(
                school_id=school_id,
                academic_year_id=academic_year_id,
                name=class_name,
                order=order
            )
            await cls.insert()
            created_classes += 1

        # Create sections
        for section_name in SECTIONS:
            existing_section = await Section.find_one(
                Section.school_id == school_id,
                Section.class_id == str(cls.id),
                Section.name == section_name
            )
            if not existing_section:
                section = Section(
                    school_id=school_id,
                    class_id=str(cls.id),
                    name=section_name
                )
                await section.insert()
                created_sections += 1

    return {
        "message": f"Seeded {created_classes} classes and {created_sections} sections",
        "classes_created": created_classes,
        "sections_created": created_sections
    }


# ---------------------------------------------------------------------------
# Section
# ---------------------------------------------------------------------------


async def _check_teacher_exists(school_id: str, teacher_id: str) -> None:
    from app.models.teacher import Teacher

    teacher = await Teacher.get(teacher_id)
    if teacher is None or teacher.school_id != school_id:
        raise NotFoundError("Teacher not found")


async def create_section(school_id: str, payload: SectionCreateRequest) -> Section:
    await get_class(school_id, payload.class_id)
    if payload.class_teacher_id is not None:
        await _check_teacher_exists(school_id, payload.class_teacher_id)

    section = Section(school_id=school_id, **payload.model_dump())
    await section.insert()
    return section


async def list_sections(school_id: str, class_id: str | None = None) -> list[Section]:
    query = {"school_id": school_id}
    if class_id is not None:
        query["class_id"] = class_id
    return await Section.find(query).to_list()


async def get_section(school_id: str, section_id: str) -> Section:
    section = await Section.get(section_id)
    if section is None or section.school_id != school_id:
        raise NotFoundError("Section not found")
    return section


async def update_section(school_id: str, section_id: str, payload: SectionUpdateRequest) -> Section:
    section = await get_section(school_id, section_id)
    data = payload.model_dump(exclude_unset=True)
    if "class_teacher_id" in data and data["class_teacher_id"] is not None:
        await _check_teacher_exists(school_id, data["class_teacher_id"])
    for field, value in data.items():
        setattr(section, field, value)
    section.updated_at = utcnow()
    await section.save()
    return section


async def delete_section(school_id: str, section_id: str) -> None:
    section = await get_section(school_id, section_id)
    await section.delete()


# ---------------------------------------------------------------------------
# Subject
# ---------------------------------------------------------------------------


async def create_subject(school_id: str, payload: SubjectCreateRequest) -> Subject:
    existing = await Subject.find_one(Subject.school_id == school_id, Subject.code == payload.code)
    if existing is not None:
        raise ConflictError(f"Subject code '{payload.code}' already exists for this school")

    subject = Subject(school_id=school_id, **payload.model_dump())
    await subject.insert()
    return subject


async def list_subjects(school_id: str) -> list[Subject]:
    return await Subject.find(Subject.school_id == school_id).to_list()


async def get_subject(school_id: str, subject_id: str) -> Subject:
    subject = await Subject.get(subject_id)
    if subject is None or subject.school_id != school_id:
        raise NotFoundError("Subject not found")
    return subject


async def update_subject(school_id: str, subject_id: str, payload: SubjectUpdateRequest) -> Subject:
    subject = await get_subject(school_id, subject_id)
    data = payload.model_dump(exclude_unset=True)

    new_code = data.get("code")
    if new_code is not None and new_code != subject.code:
        existing = await Subject.find_one(Subject.school_id == school_id, Subject.code == new_code)
        if existing is not None:
            raise ConflictError(f"Subject code '{new_code}' already exists for this school")

    for field, value in data.items():
        setattr(subject, field, value)
    subject.updated_at = utcnow()
    await subject.save()
    return subject


async def delete_subject(school_id: str, subject_id: str) -> None:
    subject = await get_subject(school_id, subject_id)
    await subject.delete()


# ---------------------------------------------------------------------------
# ClassSubjectTeacher
# ---------------------------------------------------------------------------


async def create_class_subject_teacher(school_id: str, payload: ClassSubjectTeacherCreateRequest) -> ClassSubjectTeacher:
    await get_section(school_id, payload.section_id)
    await get_subject(school_id, payload.subject_id)
    await _check_teacher_exists(school_id, payload.teacher_id)

    cst = ClassSubjectTeacher(school_id=school_id, **payload.model_dump())
    await cst.insert()
    return cst


async def list_class_subject_teachers(
    school_id: str, section_id: str | None = None, teacher_id: str | None = None
) -> list[ClassSubjectTeacher]:
    query = {"school_id": school_id}
    if section_id is not None:
        query["section_id"] = section_id
    if teacher_id is not None:
        query["teacher_id"] = teacher_id
    return await ClassSubjectTeacher.find(query).to_list()


async def delete_class_subject_teacher(school_id: str, cst_id: str) -> None:
    cst = await ClassSubjectTeacher.get(cst_id)
    if cst is None or cst.school_id != school_id:
        raise NotFoundError("Class-subject-teacher mapping not found")
    await cst.delete()


# ---------------------------------------------------------------------------
# TimetableSlot
# ---------------------------------------------------------------------------


async def create_timetable_slot(school_id: str, payload: TimetableSlotCreateRequest) -> TimetableSlot:
    if payload.end_time <= payload.start_time:
        raise ValidationAppError("end_time must be after start_time")

    await get_section(school_id, payload.section_id)
    await get_subject(school_id, payload.subject_id)
    await _check_teacher_exists(school_id, payload.teacher_id)

    # Note: double-booking conflict detection (teacher/section overlap) is
    # intentionally out of scope for v1.
    data = payload.model_dump(exclude={"start_time", "end_time"})
    slot = TimetableSlot(
        school_id=school_id,
        start_time=payload.start_time.isoformat(),
        end_time=payload.end_time.isoformat(),
        **data,
    )
    await slot.insert()
    return slot


async def list_timetable_slots(
    school_id: str, section_id: str | None = None, teacher_id: str | None = None
) -> list[TimetableSlot]:
    query = {"school_id": school_id}
    if section_id is not None:
        query["section_id"] = section_id
    if teacher_id is not None:
        query["teacher_id"] = teacher_id
    return await TimetableSlot.find(query).to_list()


async def get_timetable_slot(school_id: str, slot_id: str) -> TimetableSlot:
    slot = await TimetableSlot.get(slot_id)
    if slot is None or slot.school_id != school_id:
        raise NotFoundError("Timetable slot not found")
    return slot


async def update_timetable_slot(school_id: str, slot_id: str, payload: TimetableSlotUpdateRequest) -> TimetableSlot:
    slot = await get_timetable_slot(school_id, slot_id)
    data = payload.model_dump(exclude_unset=True)

    # slot.start_time/end_time are stored as "HH:MM:SS" strings; incoming
    # updated values (if present) are `time` objects — normalize both sides
    # to `time` for comparison, then store back as strings.
    new_start: time = data["start_time"] if "start_time" in data else time.fromisoformat(slot.start_time)
    new_end: time = data["end_time"] if "end_time" in data else time.fromisoformat(slot.end_time)
    if new_end <= new_start:
        raise ValidationAppError("end_time must be after start_time")

    if "start_time" in data:
        data["start_time"] = data["start_time"].isoformat()
    if "end_time" in data:
        data["end_time"] = data["end_time"].isoformat()

    if "subject_id" in data:
        await get_subject(school_id, data["subject_id"])
    if "teacher_id" in data:
        await _check_teacher_exists(school_id, data["teacher_id"])

    for field, value in data.items():
        setattr(slot, field, value)
    slot.updated_at = utcnow()
    await slot.save()
    return slot


async def delete_timetable_slot(school_id: str, slot_id: str) -> None:
    slot = await get_timetable_slot(school_id, slot_id)
    await slot.delete()


# ---------------------------------------------------------------------------
# CalendarEvent
# ---------------------------------------------------------------------------


async def create_calendar_event(school_id: str, payload: CalendarEventCreateRequest) -> CalendarEvent:
    await get_academic_year(school_id, payload.academic_year_id)
    event = CalendarEvent(school_id=school_id, **payload.model_dump())
    await event.insert()
    return event


async def list_calendar_events(
    school_id: str,
    academic_year_id: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[CalendarEvent]:
    query = {"school_id": school_id}
    if academic_year_id is not None:
        query["academic_year_id"] = academic_year_id

    date_filter = {}
    if start_date is not None:
        date_filter["$gte"] = start_date
    if end_date is not None:
        date_filter["$lte"] = end_date
    if date_filter:
        query["event_date"] = date_filter

    return await CalendarEvent.find(query).to_list()


async def get_calendar_event(school_id: str, event_id: str) -> CalendarEvent:
    event = await CalendarEvent.get(event_id)
    if event is None or event.school_id != school_id:
        raise NotFoundError("Calendar event not found")
    return event


async def update_calendar_event(school_id: str, event_id: str, payload: CalendarEventUpdateRequest) -> CalendarEvent:
    event = await get_calendar_event(school_id, event_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(event, field, value)
    event.updated_at = utcnow()
    await event.save()
    return event


async def delete_calendar_event(school_id: str, event_id: str) -> None:
    event = await get_calendar_event(school_id, event_id)
    await event.delete()
