from beanie.operators import RegEx

from app.core.deps import CurrentUser
from app.core.enums import Role
from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.models.guardian import Guardian
from app.schemas.common import PageParams, PageResponse
from app.schemas.guardian import GuardianCreateRequest, GuardianOut, GuardianUpdateRequest
from app.core.security import hash_password
from app.models.user import User
from app.services.user_provisioning import provision_user_account, _generate_temp_password


def to_out(guardian: Guardian) -> GuardianOut:
    return GuardianOut(
        id=str(guardian.id),
        school_id=guardian.school_id,
        full_name=guardian.full_name,
        relation=guardian.relation,
        phone=guardian.phone,
        email=guardian.email,
        occupation=guardian.occupation,
        address=guardian.address,
        student_ids=guardian.student_ids,
        photo_document_id=guardian.photo_document_id,
        created_at=guardian.created_at,
        updated_at=guardian.updated_at,
    )


async def create_guardian(current: CurrentUser, payload: GuardianCreateRequest) -> tuple[Guardian, dict | None]:
    if current.role not in (Role.SCHOOL_ADMIN, Role.PRINCIPAL):
        raise PermissionDeniedError()
    guardian = Guardian(school_id=current.school_id, **payload.model_dump())
    await guardian.insert()

    credentials = None
    # Auto-provision parent login account using phone as username
    try:
        _, password = await provision_user_account(
            school_id=current.school_id,
            role=Role.PARENT,
            full_name=guardian.full_name,
            username=guardian.phone,  # Login ID = Phone number
            phone=guardian.phone,
            email=guardian.email,
            guardian_id=str(guardian.id),
        )
        credentials = {"username": guardian.phone, "password": password}
    except ValueError:
        pass  # User already exists

    return guardian, credentials


async def list_guardians(
    current: CurrentUser,
    phone: str | None,
    name: str | None,
    page_params: PageParams,
) -> PageResponse[GuardianOut]:
    if current.role not in (Role.SCHOOL_ADMIN, Role.PRINCIPAL):
        raise PermissionDeniedError()

    query = Guardian.find(Guardian.school_id == current.school_id)
    if phone:
        query = query.find(Guardian.phone == phone)
    if name:
        query = query.find(RegEx(Guardian.full_name, name, options="i"))

    total = await query.count()
    guardians = await query.skip(page_params.skip).limit(page_params.page_size).to_list()
    return PageResponse(
        items=[to_out(g) for g in guardians],
        total=total,
        page=page_params.page,
        page_size=page_params.page_size,
    )


async def _get_for_admin(current: CurrentUser, guardian_id: str) -> Guardian:
    if current.role not in (Role.SCHOOL_ADMIN, Role.PRINCIPAL):
        raise PermissionDeniedError()
    guardian = await Guardian.get(guardian_id)
    if guardian is None or guardian.school_id != current.school_id:
        raise NotFoundError("Guardian not found")
    return guardian


async def get_guardian(current: CurrentUser, guardian_id: str) -> Guardian:
    return await _get_for_admin(current, guardian_id)


async def update_guardian(current: CurrentUser, guardian_id: str, payload: GuardianUpdateRequest) -> Guardian:
    guardian = await _get_for_admin(current, guardian_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(guardian, field, value)
    await guardian.save()
    return guardian


async def delete_guardian(current: CurrentUser, guardian_id: str) -> None:
    guardian = await _get_for_admin(current, guardian_id)
    await guardian.delete()


async def get_own_guardian(current: CurrentUser) -> Guardian:
    if current.role != Role.PARENT or not current.user.guardian_id:
        raise PermissionDeniedError()
    guardian = await Guardian.get(current.user.guardian_id)
    if guardian is None or guardian.school_id != current.school_id:
        raise NotFoundError("Guardian profile not found")
    return guardian


async def update_own_guardian(current: CurrentUser, payload: GuardianUpdateRequest) -> Guardian:
    guardian = await get_own_guardian(current)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(guardian, field, value)
    await guardian.save()
    return guardian


async def reset_guardian_password(current: CurrentUser, guardian_id: str) -> dict:
    """Reset or create login credentials for a guardian/parent."""
    guardian = await _get_for_admin(current, guardian_id)

    existing_user = await User.find_one(
        User.school_id == current.school_id,
        User.guardian_id == guardian_id,
    )

    new_password = _generate_temp_password()

    if existing_user:
        existing_user.hashed_password = hash_password(new_password)
        existing_user.must_change_password = True
        await existing_user.save()
    else:
        await provision_user_account(
            school_id=current.school_id,
            role=Role.PARENT,
            full_name=guardian.full_name,
            username=guardian.phone,
            phone=guardian.phone,
            email=guardian.email,
            password=new_password,
            guardian_id=str(guardian.id),
        )

    return {"username": guardian.phone, "password": new_password}
