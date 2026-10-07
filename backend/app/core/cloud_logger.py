"""Utility to log cloud service usage (AWS, GCP) for tracking and auditing."""

from typing import Any
import logging

from app.models.cloud_service_log import CloudServiceLog

logger = logging.getLogger(__name__)


async def log_cloud_service(
    service_provider: str,
    service_name: str,
    operation: str,
    school_id: str | None = None,
    user_id: str | None = None,
    details: dict[str, Any] | None = None,
    success: bool = True,
    error_message: str | None = None,
) -> CloudServiceLog:
    """Log a cloud service operation to the database."""
    log_entry = CloudServiceLog(
        service_provider=service_provider,
        service_name=service_name,
        operation=operation,
        school_id=school_id,
        user_id=user_id,
        details=details or {},
        success=success,
        error_message=error_message,
    )
    await log_entry.insert()
    logger.info(
        f"Cloud service: {service_provider}/{service_name} - {operation} "
        f"(school={school_id}, success={success})"
    )
    return log_entry


async def log_aws_s3(
    operation: str,
    bucket: str,
    key: str,
    school_id: str | None = None,
    user_id: str | None = None,
    success: bool = True,
    error_message: str | None = None,
) -> CloudServiceLog:
    """Log an AWS S3 operation."""
    return await log_cloud_service(
        service_provider="aws",
        service_name="s3",
        operation=operation,
        school_id=school_id,
        user_id=user_id,
        details={"bucket": bucket, "key": key},
        success=success,
        error_message=error_message,
    )


async def log_gcp_vertex_ai(
    operation: str,
    model_name: str,
    school_id: str | None = None,
    user_id: str | None = None,
    tokens_used: int | None = None,
    success: bool = True,
    error_message: str | None = None,
) -> CloudServiceLog:
    """Log a GCP Vertex AI (Gemini) operation."""
    details = {"model": model_name}
    if tokens_used is not None:
        details["tokens_used"] = tokens_used
    return await log_cloud_service(
        service_provider="gcp",
        service_name="vertex_ai",
        operation=operation,
        school_id=school_id,
        user_id=user_id,
        details=details,
        success=success,
        error_message=error_message,
    )
