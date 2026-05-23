from pydantic import BaseModel


class SensorDataCreate(BaseModel):
    patient_id: str
    heart_rate: int
    spo2: int
    systolic_bp: int
    diastolic_bp: int
    ecg_value: float