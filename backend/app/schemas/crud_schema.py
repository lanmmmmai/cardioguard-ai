from typing import Any, Optional, List, Dict
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class FlexibleBaseModel(BaseModel):
    model_config = ConfigDict(extra="allow")


class CrudCreate(FlexibleBaseModel):
    pass


class CrudUpdate(FlexibleBaseModel):
    pass


class CrudRead(FlexibleBaseModel):
    id: UUID


class AppointmentCreate(CrudCreate):
    patient_id: Optional[UUID] = None
    doctor_id: Optional[UUID] = None
    title: Optional[str] = None
    status: Optional[str] = None
    channel: Optional[str] = None


class AppointmentUpdate(CrudUpdate):
    patient_id: Optional[UUID] = None
    doctor_id: Optional[UUID] = None
    title: Optional[str] = None
    status: Optional[str] = None
    channel: Optional[str] = None


class MedicalRecordCreate(CrudCreate):
    patient_id: Optional[UUID] = None
    doctor_id: Optional[UUID] = None
    type: Optional[str] = None
    diagnosis: Optional[str] = None
    summary: Optional[str] = None
    files: Optional[List[Any]] = None


class MedicalRecordUpdate(MedicalRecordCreate):
    pass


class PrescriptionCreate(CrudCreate):
    patient_id: Optional[UUID] = None
    doctor_id: Optional[UUID] = None
    medication_name: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    instructions: Optional[str] = None
    status: Optional[str] = None


class PrescriptionUpdate(PrescriptionCreate):
    pass


class DeviceCreate(CrudCreate):
    patient_id: Optional[UUID] = None
    name: Optional[str] = None
    device_type: Optional[str] = None
    status: Optional[str] = None
    battery: Optional[int] = Field(default=None, ge=0, le=100)


class DeviceUpdate(DeviceCreate):
    pass


class NotificationCreate(CrudCreate):
    user_id: Optional[UUID] = None
    patient_id: Optional[UUID] = None
    title: Optional[str] = None
    message: Optional[str] = None
    type: Optional[str] = None
    is_read: Optional[bool] = None


class NotificationUpdate(NotificationCreate):
    pass


class ChatMessageCreate(CrudCreate):
    patient_id: Optional[UUID] = None
    doctor_id: Optional[UUID] = None
    sender_id: Optional[UUID] = None
    recipient_id: Optional[UUID] = None
    message: Optional[str] = None
    is_read: Optional[bool] = None


class ChatMessageUpdate(ChatMessageCreate):
    pass


class AuditLogCreate(CrudCreate):
    user_id: Optional[UUID] = None
    action: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[UUID] = None
    details: Optional[Dict[str, Any]] = None


class AuditLogUpdate(AuditLogCreate):
    pass


class CameraCreate(CrudCreate):
    patient_id: Optional[UUID] = None
    name: Optional[str] = None
    location: Optional[str] = None
    stream_url: Optional[str] = None
    status: Optional[str] = None


class CameraUpdate(CameraCreate):
    pass


class ReportCreate(CrudCreate):
    patient_id: Optional[UUID] = None
    doctor_id: Optional[UUID] = None
    title: Optional[str] = None
    report_type: Optional[str] = None
    content: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


class ReportUpdate(ReportCreate):
    pass
