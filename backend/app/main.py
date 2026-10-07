import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.database import close_db, init_db
from app.core.enums import Role
from app.core.security import hash_password
from app.models.user import User

settings = get_settings()

logging.basicConfig(level=logging.INFO if settings.debug else logging.WARNING, force=True)
logger = logging.getLogger(__name__)


async def ensure_super_admin():
    """Create super admin user if it doesn't exist."""
    existing = await User.find_one(User.email == settings.super_admin_email, User.school_id == None)
    if existing is None:
        user = User(
            email=settings.super_admin_email,
            hashed_password=hash_password(settings.super_admin_password),
            role=Role.SUPER_ADMIN,
            full_name="Super Admin",
            school_id=None,
            is_active=True,
        )
        await user.insert()
        logger.info(f"Super admin created: {settings.super_admin_email}")
    else:
        logger.info(f"Super admin already exists: {settings.super_admin_email}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await ensure_super_admin()
    yield
    await close_db()


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
