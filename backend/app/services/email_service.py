import asyncio
import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger("email")


def _send_smtp(to: str, subject: str, body: str) -> None:
    settings = get_settings()
    msg = EmailMessage()
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
        if settings.smtp_use_tls:
            server.starttls()
        if settings.smtp_username:
            server.login(settings.smtp_username, settings.smtp_password or "")
        server.send_message(msg)


async def send_email(to: str, subject: str, body: str) -> None:
    """Deliver an email via SMTP when SMTP_HOST is configured, otherwise log it.

    Every caller in the codebase goes through here, so this is the only place
    to change if you move to SES/SendGrid. Delivery failures are logged and
    never break the request that triggered the email.
    """
    settings = get_settings()
    if not settings.smtp_host:
        logger.info("EMAIL (SMTP not configured, logged only) to=%s subject=%r\n%s", to, subject, body)
        return
    try:
        await asyncio.to_thread(_send_smtp, to, subject, body)
        logger.info("EMAIL sent to=%s subject=%r", to, subject)
    except Exception:  # noqa: BLE001 - never fail the caller because of mail
        logger.exception("EMAIL delivery failed to=%s subject=%r", to, subject)
