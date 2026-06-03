"""Lược đồ Pydantic chung và theo miền cho các thao tác CRUD.

Mục đích:
  Cung cấp các mô hình cơ sở có thể tái sử dụng (``CrudCreate``, ``CrudUpdate``,
  ``CrudRead``) cho phép các trường bổ sung, cộng với các lược đồ cụ thể cho mọi
  thực thể trong miền: cuộc hẹn, hồ sơ bệnh án, đơn thuốc, thiết bị,
  thông báo, tin nhắn trò chuyện, nhật ký kiểm toán, camera và báo cáo.

Luồng công việc:
  1. Các trình xử lý API CRUD chấp nhận một lớp con ``CrudCreate`` / ``CrudUpdate``
     và giải nén các trường của nó để xây dựng câu lệnh SQL INSERT / UPDATE động.
  2. Mỗi lược đồ miền phản ánh các cột của bảng cơ sở dữ liệu tương ứng
     với các trường tùy chọn để cùng một mô hình hoạt động trên các bảng khác nhau.
  3. Các lớp ``*Update`` kế thừa từ ``*Create`` để giữ cho danh sách trường đồng bộ.

Quan hệ:
  - Được tiêu thụ bởi app.api.crud_api, nơi cung cấp điểm cuối CRUD chung cho
    bất kỳ bảng nào được đăng ký trong cấu hình định tuyến.
"""

from typing import Any, Optional, List, Dict
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class FlexibleBaseModel(BaseModel):
    """Mô hình cơ sở cho phép các trường bổ sung không được định nghĩa rõ ràng.

    Điều này rất cần thiết cho các điểm cuối CRUD chung vì các
    bảng khác nhau có các tập cột khác nhau.
    """
    model_config = ConfigDict(extra="allow")


class CrudCreate(FlexibleBaseModel):
    """Cơ sở đánh dấu cho tải trọng tạo (cho phép bất kỳ trường nào)."""
    pass


class CrudUpdate(FlexibleBaseModel):
    """Cơ sở đánh dấu cho tải trọng cập nhật (cho phép bất kỳ trường nào)."""
    pass


class CrudRead(FlexibleBaseModel):
    """Cơ sở phản hồi tối thiểu bao gồm UUID của thực thể.

    Thuộc tính:
        id: Khóa chính của bản ghi.
    """
    id: UUID


class AppointmentCreate(CrudCreate):
    """Tải trọng để tạo bản ghi cuộc hẹn."""
    patient_id: Optional[UUID] = None
    doctor_id: Optional[UUID] = None
    title: Optional[str] = None
    status: Optional[str] = None
    channel: Optional[str] = None


class AppointmentUpdate(CrudUpdate):
    """Tải trọng để cập nhật bản ghi cuộc hẹn."""
    patient_id: Optional[UUID] = None
    doctor_id: Optional[UUID] = None
    title: Optional[str] = None
    status: Optional[str] = None
    channel: Optional[str] = None


class MedicalRecordCreate(CrudCreate):
    """Tải trọng để tạo một mục hồ sơ bệnh án."""
    patient_id: Optional[UUID] = None
    doctor_id: Optional[UUID] = None
    type: Optional[str] = None
    diagnosis: Optional[str] = None
    summary: Optional[str] = None
    files: Optional[List[Any]] = None


class MedicalRecordUpdate(MedicalRecordCreate):
    """Tải trọng để cập nhật hồ sơ bệnh án (các trường giống với tạo)."""
    pass


class PrescriptionCreate(CrudCreate):
    """Tải trọng để tạo bản ghi đơn thuốc."""
    patient_id: Optional[UUID] = None
    doctor_id: Optional[UUID] = None
    medication_name: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    instructions: Optional[str] = None
    status: Optional[str] = None


class PrescriptionUpdate(PrescriptionCreate):
    """Tải trọng để cập nhật đơn thuốc (các trường giống với tạo)."""
    pass


class DeviceCreate(CrudCreate):
    """Tải trọng để tạo bản ghi thiết bị IoT."""
    patient_id: Optional[UUID] = None
    name: Optional[str] = None
    device_type: Optional[str] = None
    status: Optional[str] = None
    battery: Optional[int] = Field(default=None, ge=0, le=100)


class DeviceUpdate(DeviceCreate):
    """Tải trọng để cập nhật bản ghi thiết bị."""
    pass


class NotificationCreate(CrudCreate):
    """Tải trọng để tạo thông báo trong ứng dụng."""
    user_id: Optional[UUID] = None
    patient_id: Optional[UUID] = None
    title: Optional[str] = None
    message: Optional[str] = None
    type: Optional[str] = None
    is_read: Optional[bool] = None


class NotificationUpdate(NotificationCreate):
    """Tải trọng để cập nhật thông báo."""
    pass


class ChatMessageCreate(CrudCreate):
    """Tải trọng để tạo tin nhắn trò chuyện giữa bệnh nhân và bác sĩ."""
    patient_id: Optional[UUID] = None
    doctor_id: Optional[UUID] = None
    sender_id: Optional[UUID] = None
    recipient_id: Optional[UUID] = None
    message: Optional[str] = None
    is_read: Optional[bool] = None


class ChatMessageUpdate(ChatMessageCreate):
    """Tải trọng để cập nhật tin nhắn trò chuyện."""
    pass


class AuditLogCreate(CrudCreate):
    """Tải trọng để ghi lại một sự kiện bảo mật hoặc hệ thống có thể kiểm toán."""
    user_id: Optional[UUID] = None
    action: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[UUID] = None
    details: Optional[Dict[str, Any]] = None


class AuditLogUpdate(AuditLogCreate):
    """Tải trọng để cập nhật mục nhật ký kiểm toán."""
    pass


class CameraCreate(CrudCreate):
    """Tải trọng để thêm camera giám sát / theo dõi."""
    patient_id: Optional[UUID] = None
    name: Optional[str] = None
    location: Optional[str] = None
    stream_url: Optional[str] = None
    status: Optional[str] = None


class CameraUpdate(CameraCreate):
    """Tải trọng để cập nhật bản ghi camera."""
    pass


class ReportCreate(CrudCreate):
    """Tải trọng để tạo báo cáo lâm sàng."""
    patient_id: Optional[UUID] = None
    doctor_id: Optional[UUID] = None
    title: Optional[str] = None
    report_type: Optional[str] = None
    content: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


class ReportUpdate(ReportCreate):
    """Tải trọng để cập nhật bản ghi báo cáo."""
    pass
