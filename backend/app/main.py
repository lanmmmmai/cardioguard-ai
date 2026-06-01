from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import connect_db, disconnect_db
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
        "http://127.0.0.1:5173"
    ],
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


@app.get("/")
def root():
    return {
        "message": "CardioGuard AI Backend is running",
        "status": "running",
        "database_configured": True,
        "database_connected": True
    }
