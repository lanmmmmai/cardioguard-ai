from datetime import datetime
from pydantic import BaseModel, Field, model_validator


class SensorDataCreate(BaseModel):
    patient_id: str
    heart_rate: int = Field(ge=0, le=300, description="Nhịp tim (bpm)")
    spo2: int = Field(ge=0, le=100, description="Nồng độ oxy trong máu (%)")
    systolic_bp: int = Field(ge=0, le=300, description="Huyết áp tâm thu (mmHg)")
    diastolic_bp: int = Field(ge=0, le=200, description="Huyết áp tâm trương (mmHg)")
    ecg_value: float = Field(description="Giá trị điện tâm đồ (mV)")

    @model_validator(mode="after")
    def validate_blood_pressure(self):
        if self.systolic_bp < self.diastolic_bp:
            raise ValueError("Huyết áp tâm thu (systolic_bp) phải lớn hơn hoặc bằng huyết áp tâm trương (diastolic_bp)")
        return self


class IotTelemetryReadings(BaseModel):
    heart_rate: int = Field(ge=0, le=300, description="Nhịp tim (bpm)")
    spo2: int = Field(ge=0, le=100, description="Nồng độ oxy trong máu (%)")
    ecg_value: float = Field(description="Giá trị điện tâm đồ (mV)")
    systolic_bp: int | None = Field(default=None, ge=0, le=300, description="Huyết áp tâm thu")
    diastolic_bp: int | None = Field(default=None, ge=0, le=200, description="Huyết áp tâm trương")
    body_temperature: float | None = Field(default=None, ge=30.0, le=45.0, description="Nhiệt độ cơ thể")
    motion_value: float | None = Field(default=None, ge=0.0, description="Giá trị vận động")

    @model_validator(mode="after")
    def validate_blood_pressure(self):
        if self.systolic_bp is not None and self.diastolic_bp is not None:
            if self.systolic_bp < self.diastolic_bp:
                raise ValueError("Huyết áp tâm thu (systolic_bp) phải lớn hơn hoặc bằng huyết áp tâm trương (diastolic_bp)")
        return self


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
