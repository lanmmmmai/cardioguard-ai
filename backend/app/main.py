"""CardioGuard AI — FastAPI application entry point.

Purpose:
  Initialises and configures the FastAPI ASGI application, registers all
  route handlers, wires CORS middleware, and manages the database lifecycle
  (connect / disconnect) on startup / shutdown.

Workflow:
  1. Configure structured JSON logging.
  2. Create the FastAPI app instance with metadata.
  3. Register CORS middleware with an allow-list of origins and a regex.
  4. Attach event handlers for startup (connect DB, ensure OTP table and
     performance indexes) and shutdown (disconnect DB).
  5. Include all API routers (auth, patients, sensors, alerts, realtime,
     CRUD, CMS, admin/doctor, email, features, chat).
  6. Expose health-check and root endpoints.

Relationships:
  - app.core.database  — async DB engine (connect / disconnect).
  - app.api.*           — per-domain route modules.
  - app.services.*      — support services (OTP, DB optimisation).
"""

import asyncio
import json
import logging
import os
import sys
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import connect_db, disconnect_db, database
from app.api.patient_api import router as patient_router
from app.api.sensor_api import router as sensor_router
from app.api.alert_api import router as alert_router
from app.api.realtime_api import router as realtime_router
from app.api.auth_api import router as auth_router
from app.api.feature_api import router as feature_router
from app.api.crud_api import router as crud_router
from app.api.user_api import router as user_router
from app.api.cms_api import router as cms_router
from app.api.admin_doctor_api import router as admin_doctor_router
from app.api.profile_api import router as profile_router
from app.api.email_api import cms_router as cms_email_router, router as email_router
from app.api.chat_api import router as chat_router
from app.services.otp_service import ensure_otp_table
from app.services.db_optimization import ensure_domain_links_schema, ensure_email_cms_schema, ensure_performance_indexes, ensure_profile_schema, ensure_user_account_timestamps


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
    force=True,
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Smart Heart Patient Monitoring API",
    version="1.0.0"
)

DEFAULT_CORS_ORIGINS = [
    "https://giatky.site",
    "https://www.giatky.site",
    "https://cardioguard-ai.vercel.app",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://192.168.1.64:5173",
    "http://192.168.1.64:5174",
    "http://192.168.1.13:5173",
    "http://192.168.1.13:5174",
    "http://192.168.1.64",
    "http://192.168.1.13",
]


def get_cors_origins() -> list[str]:
    configured = [
        origin.strip()
        for origin in settings.FRONTEND_ORIGINS.split(",")
        if origin.strip()
    ]
    return list(dict.fromkeys([*DEFAULT_CORS_ORIGINS, *configured]))


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_origin_regex=(
        r"^(https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?"
        r"|https://([A-Za-z0-9-]+\.)*giatky\.site"
        r"|https://[A-Za-z0-9-]+\.vercel\.app)$"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


_mv_refresh_task: asyncio.Task[None] | None = None


async def _periodic_mv_refresh() -> None:
    """Periodically refresh reports_summary_mv every 5 minutes."""
    while True:
        try:
            await asyncio.sleep(300)  # 5 minutes
            await database.execute("SELECT safe_refresh_reports_summary_mv()")
            logger.info("Materialized view reports_summary_mv refreshed")
        except Exception:
            logger.exception("Failed to refresh materialized view")


def split_sql_statements(sql: str) -> list[str]:
    """Split SQL string into separate statements, respecting dollar quotes ($$)."""
    statements = []
    current_stmt = []
    in_dollar_quote = False
    dollar_quote_tag = ""
    i = 0
    n = len(sql)
    while i < n:
        char = sql[i]
        if char == '$':
            j = i + 1
            while j < n and (sql[j].isalnum() or sql[j] == '_'):
                j += 1
            if j < n and sql[j] == '$':
                tag = sql[i:j+1]
                if in_dollar_quote:
                    if tag == dollar_quote_tag:
                        in_dollar_quote = False
                        dollar_quote_tag = ""
                else:
                    in_dollar_quote = True
                    dollar_quote_tag = tag
                current_stmt.append(tag)
                i = j + 1
                continue
        if char == ';' and not in_dollar_quote:
            statements.append("".join(current_stmt).strip())
            current_stmt = []
        else:
            current_stmt.append(char)
        i += 1
    if current_stmt:
        remainder = "".join(current_stmt).strip()
        if remainder:
            statements.append(remainder)
    return [s for s in statements if s]


@app.on_event("startup")
async def startup():
    """Connect to the database, ensure the OTP tracking table and performance
    indexes exist before accepting traffic."""
    logger.info("Starting CardioGuard AI backend...")
    await connect_db()
    await ensure_otp_table()
    await ensure_user_account_timestamps()
    await ensure_profile_schema()
    await ensure_email_cms_schema()
    await ensure_domain_links_schema()
    await ensure_performance_indexes()

    # Schedule deferred MV trigger migration (best-effort)
    try:
        migration_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "migrations",
            "016_optimize_mv_refresh.sql",
        )
        if os.path.exists(migration_path):
            with open(migration_path, "r", encoding="utf-8") as f:
                sql = f.read()
            # Clean comments and split statements respecting dollar quotes
            clean_lines = []
            for line in sql.split("\n"):
                stripped = line.strip()
                if stripped and not stripped.startswith("--"):
                    clean_lines.append(line)
            clean_sql = "\n".join(clean_lines)
            
            for stmt in split_sql_statements(clean_sql):
                if stmt.strip():
                    await database.execute(stmt)
            logger.info("MV refresh migration applied")
    except Exception:
        logger.exception("Failed to apply MV refresh migration")

    # Start periodic refresh background task
    global _mv_refresh_task
    _mv_refresh_task = asyncio.create_task(_periodic_mv_refresh())

    logger.info("Application startup complete")


@app.on_event("shutdown")
async def shutdown():
    """Gracefully close the database connection pool during shutdown."""
    logger.info("Shutting down CardioGuard AI backend...")
    await disconnect_db()
    logger.info("Application shutdown complete")

app.include_router(realtime_router)

# Đăng ký các router REST API dưới tiền tố /api thống nhất (mỗi router chỉ include 1 lần duy nhất)
app.include_router(auth_router, prefix="/api")
app.include_router(user_router, prefix="/api")
app.include_router(patient_router, prefix="/api")
app.include_router(sensor_router, prefix="/api")
app.include_router(alert_router, prefix="/api")
app.include_router(crud_router, prefix="/api")
app.include_router(admin_doctor_router, prefix="/api")
app.include_router(cms_email_router, prefix="/api")
app.include_router(cms_router, prefix="/api")
app.include_router(email_router, prefix="/api")
app.include_router(feature_router, prefix="/api")
app.include_router(chat_router, prefix="/api/chat", tags=["Chatbot"])
app.include_router(profile_router, prefix="/api")



@app.get("/health", tags=["System"])
async def health():
    """Return the overall health status of the service, including a live
    database connectivity check via a simple ``SELECT 1`` probe.

    Returns:
      dict: ``{"status": "healthy", "database": "connected", …}`` when the
            database responds.  Returns HTTP 500 with equivalent JSON on
            failure.
    """
    try:
        # Probe the database with a no-op query to verify connectivity
        await database.execute("SELECT 1")
        return {
            "status": "healthy",
            "database": "connected",
            "services": {
                "web_server": "running"
            }
        }
    except Exception as e:
        logger.exception("Database health check failed")
        return Response(
            content=json.dumps({
                "status": "unhealthy",
                "database": "error: unavailable",
                "services": {
                    "web_server": "running"
                }
            }),
            status_code=500,
            media_type="application/json"
        )


@app.get("/")
def root():
    """Simple root endpoint returning a static status payload.

    Returns:
      dict: A fixed message confirming the backend is operational.
    """
    return {
        "message": "CardioGuard AI Backend is running",
        "status": "running",
        "database_configured": True,
        "database_connected": True
    }
