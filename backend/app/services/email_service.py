import logging

logger = logging.getLogger("email")


async def send_email(to: str, subject: str, body: str) -> None:
    """Pluggable email delivery. v1 backend just logs — swap this out for
    SES/SendGrid/etc. by replacing this function's body; every caller in the
    codebase goes through here so there's exactly one place to change."""
    logger.info("EMAIL to=%s subject=%r\n%s", to, subject, body)
