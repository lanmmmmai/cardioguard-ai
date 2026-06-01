import json
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
from app.api.email_api import router as email_router
from app.api.chat_api import router as chat_router
from app.services.otp_service import ensure_otp_table
from app.services.db_optimization import ensure_performance_indexes


app = FastAPI(
    title="Smart Heart Patient Monitoring API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://giatky.site",
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
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|172\.\d+\.\d+\.\d+)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await connect_db()
    await ensure_otp_table()
    await ensure_performance_indexes()


@app.on_event("shutdown")
async def shutdown():
    await disconnect_db()

app.include_router(realtime_router)
app.include_router(auth_router)
app.include_router(user_router)
app.include_router(patient_router)
app.include_router(sensor_router)
app.include_router(alert_router)
app.include_router(crud_router)
app.include_router(cms_router)
app.include_router(admin_doctor_router)
app.include_router(email_router)
app.include_router(feature_router)
app.include_router(chat_router, prefix="/api/chat", tags=["Chatbot"])


@app.get("/health", tags=["System"])
async def health():
    try:
        # Kiểm tra kết nối cơ sở dữ liệu thật
        await database.execute("SELECT 1")
        return {
            "status": "healthy",
            "database": "connected",
            "services": {
                "web_server": "running"
            }
        }
    except Exception as e:
        return Response(
            content=json.dumps({
                "status": "unhealthy",
                "database": f"error: {str(e)}",
                "services": {
                    "web_server": "running"
                }
            }),
            status_code=500,
            media_type="application/json"
        )


@app.get("/")
def root():
    return {
        "message": "CardioGuard AI Backend is running",
        "status": "running",
        "database_configured": True,
        "database_connected": True
    }
