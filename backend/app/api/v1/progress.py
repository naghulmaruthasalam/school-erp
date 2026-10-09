from fastapi import APIRouter, Depends, Query

from app.core.deps import CurrentUser, get_current_user
from app.core.enums import ADMIN_ROLES, Role
from app.core.exceptions import PermissionDeniedError
from app.services import progress_service

router = APIRouter(prefix="/progress", tags=["progress"])


@router.post("/scan")
async def scan(summary: bool = Query(False), current: CurrentUser = Depends(get_current_user)) -> dict:
    """Run the progress check now (it also runs on a schedule): student attendance and homework, teacher performance, and
    optionally the weekly summaries. The principal and school admins run it for their school; a super admin for every school."""
    if current.role == Role.SUPER_ADMIN:
        return {"schools": await progress_service.run_all_schools(summary=summary)}
    if current.role not in ADMIN_ROLES:
        raise PermissionDeniedError("Only the principal and school admins can run the progress check")
    return await progress_service.run_scan(current.school_id, summary=summary)
