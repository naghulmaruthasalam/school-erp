"""Read-only ERP data for the Copilot tools, fetched through the SAME permission-checked services the
REST API and the ERP assistant use (app/ai/tools.py) - so a student only ever sees their own records and a
parent only their own children's."""
import logging
from typing import Any

from app.ai.tools import get_tools_for_role
from app.core.deps import CurrentUser

logger = logging.getLogger("copilot.erp_data")


async def call(current: CurrentUser, tool: str, args: dict | None = None) -> Any:
    """Run an ERP assistant tool; returns None (never raises) if there is no data or it isn't allowed."""
    _, dispatch = get_tools_for_role(current.role)
    fn = dispatch.get(tool)
    if fn is None:
        return None
    try:
        return await fn(current, args or {})
    except Exception as exc:  # noqa: BLE001 - e.g. no marks yet / not found: the report just omits it
        logger.info("ERP tool %s unavailable: %s", tool, type(exc).__name__)
        return None
