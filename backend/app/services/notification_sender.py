import logging
from abc import ABC, abstractmethod

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


class NotificationSender(ABC):
    channel: str

    @abstractmethod
    async def send(self, recipient: str, title: str, body: str) -> None:
        """Отправляет сообщение. Raise при ошибке."""


class EmailSender(NotificationSender):
    channel = "email"

    async def send(self, recipient: str, title: str, body: str) -> None:
        # Dev-режим: SMTP не настроен — пишем в лог
        if not settings.smtp_host:
            logger.info(
                "[EMAIL-DEV] to=%s subject=%s body=%s",
                recipient,
                title,
                body,
            )
            return

        from email.message import EmailMessage

        import aiosmtplib

        message = EmailMessage()
        message["From"] = settings.smtp_from
        message["To"] = recipient
        message["Subject"] = title
        message.set_content(body)

        await aiosmtplib.send(
            message,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user or None,
            password=settings.smtp_password or None,
            start_tls=settings.smtp_use_tls,
        )


class LogSender(NotificationSender):
    """Заглушка для каналов без реализации (push, telegram)."""

    def __init__(self, channel: str):
        self.channel = channel

    async def send(self, recipient: str, title: str, body: str) -> None:
        logger.info(
            "[%s-DEV] to=%s subject=%s body=%s",
            self.channel.upper(),
            recipient,
            title,
            body,
        )


def get_sender(channel: str) -> NotificationSender:
    if channel == "email":
        return EmailSender()
    return LogSender(channel)