from datetime import datetime
from pydantic import BaseModel


class SensorDataCreate(BaseModel):
    patient_id: str
    heart_rate: int
    spo2: int
    systolic_bp: int
    diastolic_bp: int
    ecg_value: float


class IotTelemetryReadings(BaseModel):
    heart_rate: int
    spo2: int
    ecg_value: float
    systolic_bp: int | None = None
    diastolic_bp: int | None = None
    body_temperature: float | None = None
    motion_value: float | None = None


class IotTelemetryDevice(BaseModel):
    battery: int | None = None
    rssi: int | None = None
    firmware_version: str | None = None
    uptime_ms: int | None = None


class IotTelemetrySignal(BaseModel):
    ppg_quality: str | None = None
    ecg_quality: str | None = None
    leads_off: bool | None = None
    motion_detected: bool | None = None


class IotTelemetryPayload(BaseModel):
    timestamp: datetime | None = None
    sequence: int | None = None
    mode: str | None = None
    readings: IotTelemetryReadings
    signal: IotTelemetrySignal | None = None
    device: IotTelemetryDevice | None = None
