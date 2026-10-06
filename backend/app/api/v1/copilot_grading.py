"""Answer-sheet grading endpoints (OWNED BY THE GRADING PORT). Mounted at /api/v1/copilot/<area>; use app.copilot.deps.copilot_teacher for auth."""
from fastapi import APIRouter

router = APIRouter(prefix="/copilot/grading", tags=["copilot"])
