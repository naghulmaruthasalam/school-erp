"""Question paper generator endpoints (OWNED BY THE QPG PORT). Mounted at /api/v1/copilot/<area>; use app.copilot.deps.copilot_teacher for auth."""
from fastapi import APIRouter

router = APIRouter(prefix="/copilot/qpg", tags=["copilot"])
