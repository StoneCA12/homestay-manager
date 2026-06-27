import logging
import logging.handlers
import os

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

app = FastAPI(title="Homestay Manager API")

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
