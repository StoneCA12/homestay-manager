import logging
import logging.handlers
import os
from contextlib import asynccontextmanager
from datetime import date, datetime

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api.v1.router import router as api_router
from app.core.config import settings
from app.core.limiter import limiter

# Persistent file logging — writes to /logs/app.log inside the container
_LOG_DIR = "/logs"
os.makedirs(_LOG_DIR, exist_ok=True)
_file_handler = logging.handlers.RotatingFileHandler(
    os.path.join(_LOG_DIR, "app.log"),
    maxBytes=5 * 1024 * 1024,  # 5 MB per file
    backupCount=5,
)
_file_handler.setFormatter(logging.Formatter(
    "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
))
logging.basicConfig(level=logging.INFO, handlers=[logging.StreamHandler(), _file_handler])
logger = logging.getLogger(__name__)


def _nightly_snapshot() -> None:
    """Auto-generate end-of-day snapshot at 23:59 each night."""
    from app.api.v1.endpoints.reports import generate_eod_report
    from app.core.database import SessionLocal
    from app.models.daily_snapshot import DailySnapshot

    today = date.today()
    db = SessionLocal()
    try:
        report = generate_eod_report(db, today)
        report_json = report.model_dump_json()
        existing = db.query(DailySnapshot).filter(DailySnapshot.report_date == today).first()
        if existing:
            existing.report_json = report_json
            existing.generated_at = datetime.utcnow()
        else:
            db.add(DailySnapshot(report_date=today, report_json=report_json))
        db.commit()
        logger.info("Nightly EOD snapshot saved for %s", today)
    except Exception as exc:
        logger.error("Nightly EOD snapshot failed: %s", exc)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = BackgroundScheduler(timezone="Asia/Ho_Chi_Minh")
    scheduler.add_job(_nightly_snapshot, CronTrigger(hour=23, minute=59))
    scheduler.start()
    logger.info("APScheduler started — EOD snapshot cron at 23:59 Asia/Ho_Chi_Minh")
    yield
    scheduler.shutdown()


app = FastAPI(title="Homestay Manager API", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/api/v1/health")
def health(db_ok: bool = True):
    """Health check — returns DB connectivity status."""
    from app.core.database import engine
    try:
        with engine.connect():
            pass
        return {"status": "ok", "db": "connected"}
    except Exception as e:
        logger.error("Health check DB failure: %s", e)
        return {"status": "degraded", "db": "unreachable"}
