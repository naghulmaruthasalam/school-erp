import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import get_settings
from app.core.enums import DocumentModule

settings = get_settings()

_s3_client = None
_use_local_storage = not settings.aws_access_key_id or not settings.s3_bucket_name

LOCAL_UPLOADS_DIR = Path(__file__).parent.parent.parent / "uploads"


def _ensure_local_dir():
    LOCAL_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


def get_s3_client():
    global _s3_client
    if _use_local_storage:
        return None
    if _s3_client is None:
        import boto3
        from botocore.client import Config as BotoConfig
        _s3_client = boto3.client(
            "s3",
            aws_access_key_id=settings.aws_access_key_id,
            aws_secret_access_key=settings.aws_secret_access_key,
            region_name=settings.aws_region,
            config=BotoConfig(signature_version="s3v4"),
        )
    return _s3_client


def build_object_key(school_id: str, module: DocumentModule, original_filename: str) -> str:
    ext = ""
    if "." in original_filename:
        ext = "." + original_filename.rsplit(".", 1)[-1].lower()
    date_prefix = datetime.now(timezone.utc).strftime("%Y/%m")
    key = f"{school_id}/{module.value.lower()}/{date_prefix}/{uuid.uuid4().hex}{ext}"
    if settings.s3_key_prefix:
        return f"{settings.s3_key_prefix.strip('/')}/{key}"
    return key


def upload_bytes(key: str, data: bytes, content_type: str) -> None:
    if _use_local_storage:
        _ensure_local_dir()
        file_path = LOCAL_UPLOADS_DIR / key.replace("/", "_")
        file_path.write_bytes(data)
        return
    client = get_s3_client()
    client.put_object(
        Bucket=settings.s3_bucket_name,
        Key=key,
        Body=data,
        ContentType=content_type,
    )


def delete_object(key: str) -> None:
    if _use_local_storage:
        file_path = LOCAL_UPLOADS_DIR / key.replace("/", "_")
        if file_path.exists():
            file_path.unlink()
        return
    client = get_s3_client()
    client.delete_object(Bucket=settings.s3_bucket_name, Key=key)


def generate_presigned_get_url(key: str, expires_in: int | None = None) -> str:
    if _use_local_storage:
        return f"/api/v1/uploads/local/{key.replace('/', '_')}"
    client = get_s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket_name, "Key": key},
        ExpiresIn=expires_in or settings.s3_presigned_url_expire_seconds,
    )


async def upload_bytes_with_log(
    key: str,
    data: bytes,
    content_type: str,
    school_id: str | None = None,
    user_id: str | None = None,
) -> None:
    """Upload and log the operation."""
    try:
        upload_bytes(key, data, content_type)
        if not _use_local_storage:
            from app.core.cloud_logger import log_aws_s3
            await log_aws_s3(
                operation="upload",
                bucket=settings.s3_bucket_name,
                key=key,
                school_id=school_id,
                user_id=user_id,
            )
    except Exception as e:
        if not _use_local_storage:
            from app.core.cloud_logger import log_aws_s3
            await log_aws_s3(
                operation="upload",
                bucket=settings.s3_bucket_name,
                key=key,
                school_id=school_id,
                user_id=user_id,
                success=False,
                error_message=str(e),
            )
        raise


async def delete_object_with_log(
    key: str,
    school_id: str | None = None,
    user_id: str | None = None,
) -> None:
    """Delete and log the operation."""
    try:
        delete_object(key)
        if not _use_local_storage:
            from app.core.cloud_logger import log_aws_s3
            await log_aws_s3(
                operation="delete",
                bucket=settings.s3_bucket_name,
                key=key,
                school_id=school_id,
                user_id=user_id,
            )
    except Exception as e:
        if not _use_local_storage:
            from app.core.cloud_logger import log_aws_s3
            await log_aws_s3(
                operation="delete",
                bucket=settings.s3_bucket_name,
                key=key,
                school_id=school_id,
                user_id=user_id,
                success=False,
                error_message=str(e),
            )
        raise


async def generate_presigned_url_with_log(
    key: str,
    expires_in: int | None = None,
    school_id: str | None = None,
    user_id: str | None = None,
) -> str:
    """Generate URL and log the operation."""
    url = generate_presigned_get_url(key, expires_in)
    if not _use_local_storage:
        from app.core.cloud_logger import log_aws_s3
        await log_aws_s3(
            operation="presigned_url",
            bucket=settings.s3_bucket_name,
            key=key,
            school_id=school_id,
            user_id=user_id,
        )
    return url
