from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.core.deps import CurrentUser, require_roles
from app.core.enums import Role
from app.models.cloud_service_log import CloudServiceLog

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/cloud-logs")
async def get_cloud_logs(
    current: CurrentUser = Depends(require_roles(Role.SUPER_ADMIN)),
    service_provider: str | None = Query(None, description="Filter by provider: aws, gcp"),
    service_name: str | None = Query(None, description="Filter by service: s3, vertex_ai"),
    school_id: str | None = Query(None, description="Filter by school"),
    success: bool | None = Query(None, description="Filter by success/failure"),
    start_date: datetime | None = Query(None, description="Filter from date"),
    end_date: datetime | None = Query(None, description="Filter to date"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    """Get cloud service usage logs for tracking AWS/GCP usage."""
    query = {}

    if service_provider:
        query["service_provider"] = service_provider
    if service_name:
        query["service_name"] = service_name
    if school_id:
        query["school_id"] = school_id
    if success is not None:
        query["success"] = success
    if start_date or end_date:
        query["timestamp"] = {}
        if start_date:
            query["timestamp"]["$gte"] = start_date
        if end_date:
            query["timestamp"]["$lte"] = end_date

    total = await CloudServiceLog.find(query).count()
    logs = await CloudServiceLog.find(query).sort("-timestamp").skip(skip).limit(limit).to_list()

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "logs": [log.model_dump() for log in logs],
    }


@router.get("/cloud-logs/stats")
async def get_cloud_logs_stats(
    current: CurrentUser = Depends(require_roles(Role.SUPER_ADMIN)),
    days: int = Query(7, ge=1, le=90, description="Stats for last N days"),
) -> dict[str, Any]:
    """Get aggregated stats of cloud service usage."""
    from datetime import timedelta, timezone

    since = datetime.now(timezone.utc) - timedelta(days=days)

    pipeline = [
        {"$match": {"timestamp": {"$gte": since}}},
        {"$group": {
            "_id": {"provider": "$service_provider", "service": "$service_name"},
            "total_calls": {"$sum": 1},
            "successful": {"$sum": {"$cond": ["$success", 1, 0]}},
            "failed": {"$sum": {"$cond": ["$success", 0, 1]}},
        }},
    ]

    results = await CloudServiceLog.aggregate(pipeline).to_list()

    stats = []
    for r in results:
        stats.append({
            "provider": r["_id"]["provider"],
            "service": r["_id"]["service"],
            "total_calls": r["total_calls"],
            "successful": r["successful"],
            "failed": r["failed"],
        })

    return {"days": days, "stats": stats}
