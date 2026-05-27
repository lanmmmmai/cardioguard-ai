import uuid
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, MetaData, String, Table, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID


metadata = MetaData()


users = Table(
    "users",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
    Column("full_name", String),
    Column("email", String),
    Column("role", String),
)

doctor_patient = Table(
    "doctor_patient",
    metadata,
    Column("doctor_id", UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True),
    Column("patient_id", UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True),
)

appointments = Table(
    "appointments",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
    Column("patient_id", UUID(as_uuid=True), ForeignKey("users.id")),
    Column("doctor_id", UUID(as_uuid=True), ForeignKey("users.id")),
    Column("title", String),
    Column("status", String),
    Column("channel", String),
    Column("scheduled_at", DateTime(timezone=True)),
    Column("notes", Text),
    Column("created_at", DateTime(timezone=True)),
    Column("updated_at", DateTime(timezone=True)),
)

medical_records = Table(
    "medical_records",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
    Column("patient_id", UUID(as_uuid=True), ForeignKey("users.id")),
    Column("doctor_id", UUID(as_uuid=True), ForeignKey("users.id")),
    Column("type", String),
    Column("diagnosis", Text),
    Column("summary", Text),
    Column("files", JSONB),
    Column("created_at", DateTime(timezone=True)),
    Column("updated_at", DateTime(timezone=True)),
)

prescriptions = Table(
    "prescriptions",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
    Column("patient_id", UUID(as_uuid=True), ForeignKey("users.id")),
    Column("doctor_id", UUID(as_uuid=True), ForeignKey("users.id")),
    Column("medication_name", String),
    Column("dosage", String),
    Column("frequency", String),
    Column("instructions", Text),
    Column("status", String),
    Column("created_at", DateTime(timezone=True)),
    Column("updated_at", DateTime(timezone=True)),
)

devices = Table(
    "devices",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
    Column("patient_id", UUID(as_uuid=True), ForeignKey("users.id")),
    Column("name", String),
    Column("device_type", String),
    Column("status", String),
    Column("battery", Integer),
    Column("last_seen_at", DateTime(timezone=True)),
    Column("created_at", DateTime(timezone=True)),
    Column("updated_at", DateTime(timezone=True)),
)

notifications = Table(
    "notifications",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id")),
    Column("patient_id", UUID(as_uuid=True), ForeignKey("users.id")),
    Column("title", String),
    Column("message", Text),
    Column("type", String),
    Column("is_read", Boolean),
    Column("created_at", DateTime(timezone=True)),
    Column("updated_at", DateTime(timezone=True)),
)

chat_messages = Table(
    "chat_messages",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
    Column("patient_id", UUID(as_uuid=True), ForeignKey("users.id")),
    Column("doctor_id", UUID(as_uuid=True), ForeignKey("users.id")),
    Column("sender_id", UUID(as_uuid=True), ForeignKey("users.id")),
    Column("recipient_id", UUID(as_uuid=True), ForeignKey("users.id")),
    Column("message", Text),
    Column("is_read", Boolean),
    Column("created_at", DateTime(timezone=True)),
    Column("updated_at", DateTime(timezone=True)),
)

audit_logs = Table(
    "audit_logs",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id")),
    Column("action", String),
    Column("entity_type", String),
    Column("entity_id", UUID(as_uuid=True)),
    Column("details", JSONB),
    Column("created_at", DateTime(timezone=True)),
)

cameras = Table(
    "cameras",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
    Column("patient_id", UUID(as_uuid=True), ForeignKey("users.id")),
    Column("name", String),
    Column("location", String),
    Column("stream_url", Text),
    Column("status", String),
    Column("created_at", DateTime(timezone=True)),
    Column("updated_at", DateTime(timezone=True)),
)

reports = Table(
    "reports",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
    Column("patient_id", UUID(as_uuid=True), ForeignKey("users.id")),
    Column("doctor_id", UUID(as_uuid=True), ForeignKey("users.id")),
    Column("title", String),
    Column("report_type", String),
    Column("content", Text),
    Column("data", JSONB),
    Column("created_at", DateTime(timezone=True)),
    Column("updated_at", DateTime(timezone=True)),
)

camera_events = Table(
    "camera_events",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
    Column("camera_id", UUID(as_uuid=True), ForeignKey("cameras.id")),
    Column("patient_id", UUID(as_uuid=True), ForeignKey("users.id")),
    Column("event_type", String),
    Column("severity", String),
    Column("metadata", JSONB),
    Column("created_at", DateTime(timezone=True)),
)

sensor_data = Table(
    "sensor_data",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
    Column("patient_id", UUID(as_uuid=True), ForeignKey("users.id")),
    Column("heart_rate", Integer),
    Column("spo2", Integer),
    Column("systolic_bp", Integer),
    Column("diastolic_bp", Integer),
    Column("ecg_value", Float),
    Column("created_at", DateTime(timezone=True)),
)
