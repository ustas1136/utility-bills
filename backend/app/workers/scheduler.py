import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import get_settings
from app.workers.tasks.send_reminders import process_reminders

logger = logging.getLogger(__name__)
settings = get_settings()


def create_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(
        process_reminders,
        trigger="interval",
        minutes=settings.scheduler_interval_minutes,
        id="process_reminders",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )
    logger.info(
        "Scheduler configured: interval=%d min",
        settings.scheduler_interval_minutes,
    )
    return scheduler