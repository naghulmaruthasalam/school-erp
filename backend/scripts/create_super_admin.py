"""One-off bootstrap: creates the platform SUPER_ADMIN user from env config.
Run with: python -m scripts.create_super_admin
"""

import asyncio

from app.core.config import get_settings
from app.core.database import close_db, init_db
from app.core.enums import Role
from app.core.security import hash_password
from app.models.user import User


async def main() -> None:
    settings = get_settings()
    await init_db()

    existing = await User.find_one(User.school_id == None, User.email == settings.super_admin_email)  # noqa: E711
    if existing:
        existing.hashed_password = hash_password(settings.super_admin_password)
        await existing.save()
        print(f"Super admin password reset: {settings.super_admin_email}")
    else:
        user = User(
            school_id=None,
            email=settings.super_admin_email,
            hashed_password=hash_password(settings.super_admin_password),
            role=Role.SUPER_ADMIN,
            full_name="Cogniitec Super Admin",
            must_change_password=True,
        )
        await user.insert()
        print(f"Created super admin: {settings.super_admin_email}")

    await close_db()


if __name__ == "__main__":
    asyncio.run(main())
