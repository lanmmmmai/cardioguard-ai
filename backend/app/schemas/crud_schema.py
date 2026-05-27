from typing import Any
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
    patient_id: UUID | None = None
    doctor_id: UUID | None = None
    title: str | None = None
    status: str | None = None
    channel: str | None = None


class AppointmentUpdate(CrudUpdate):
    patient_id: UUID | None = None
    doctor_id: UUID | None = None
    title: str | None = None
    status: str | None = None
    channel: str | None = None


class MedicalRecordCreate(CrudCreate):
    patient_id: UUID | None = None
    doctor_id: UUID | None = None
    type: str | None = None
    diagnosis: str | None = None
    summary: str | None = None
    files: list[Any] | None = None


class MedicalRecordUpdate(MedicalRecordCreate):
    pass


class PrescriptionCreate(CrudCreate):
    patient_id: UUID | None = None
    doctor_id: UUID | None = None
    medication_name: str | None = None
    dosage: str | None = None
    frequency: str | None = None
    instructions: str | None = None
    status: str | None = None


class PrescriptionUpdate(PrescriptionCreate):
    pass


class DeviceCreate(CrudCreate):
    patient_id: UUID | None = None
    name: str | None = None
    device_type: str | None = None
    status: str | None = None
    battery: int | None = Field(default=None, ge=0, le=100)


class DeviceUpdate(DeviceCreate):
    pass


class NotificationCreate(CrudCreate):
    user_id: UUID | None = None
    patient_id: UUID | None = None
    title: str | None = None
    message: str | None = None
    type: str | None = None
    is_read: bool | None = None


class NotificationUpdate(NotificationCreate):
    pass


class ChatMessageCreate(CrudCreate):
    patient_id: UUID | None = None
    doctor_id: UUID | None = None
    sender_id: UUID | None = None
    recipient_id: UUID | None = None
    message: str | None = None
    is_read: bool | None = None


class ChatMessageUpdate(ChatMessageCreate):
    pass


class AuditLogCreate(CrudCreate):
    user_id: UUID | None = None
    action: str | None = None
    entity_type: str | None = None
    entity_id: UUID | None = None
    details: dict[str, Any] | None = None


class AuditLogUpdate(AuditLogCreate):
    pass


class CameraCreate(CrudCreate):
    patient_id: UUID | None = None
    name: str | None = None
    location: str | None = None
    stream_url: str | None = None
    status: str | None = None


class CameraUpdate(CameraCreate):
    pass


class ReportCreate(CrudCreate):
    patient_id: UUID | None = None
    doctor_id: UUID | None = None
    title: str | None = None
    report_type: str | None = None
    content: str | None = None
    data: dict[str, Any] | None = None


class ReportUpdate(ReportCreate):
    pass
