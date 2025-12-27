from email.message import EmailMessage
import smtplib
from typing import Optional

from app.core.config import settings


def send_email(to_email: str, subject: str, body: str) -> Optional[str]:
	if not settings.SMTP_HOST or not settings.SMTP_FROM:
		return "SMTP not configured"

	msg = EmailMessage()
	msg["Subject"] = subject
	msg["From"] = settings.SMTP_FROM
	msg["To"] = to_email
	msg.set_content(body)

	try:
		server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
		if settings.SMTP_USE_TLS:
			server.starttls()
		if settings.SMTP_USER or settings.SMTP_PASSWORD:
			server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
		server.send_message(msg)
		server.quit()
		return None
	except Exception as exc:
		return str(exc)
