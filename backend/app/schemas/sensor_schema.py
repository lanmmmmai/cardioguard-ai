"""Lược đồ Pydantic cho việc tiếp nhận dữ liệu cảm biến và tải trọng đo xa IoT.

Mục đích:
  Định nghĩa các mô hình xác thực cho cả điểm cuối dữ liệu cảm biến REST
  (``SensorDataCreate``) và luồng đo xa thiết bị IoT thô
  (``IotTelemetryPayload`` và các mô hình con của nó). Tính nhất quán của huyết áp
  (tâm thu >= tâm trương) được thực thi thông qua các bộ xác thực mô hình.

Luồng công việc:
  1. ``SensorDataCreate`` được sử dụng bởi API REST khi một cổng hoặc máy khách
     đẩy một ảnh chụp nhanh cảm biến đơn lẻ.
  2. ``IotTelemetryPayload`` là phong bì cấp cao nhất cho dữ liệu đo xa do thiết bị
     báo cáo; nó lồng ``IotTelemetryReadings`` (các dấu hiệu sinh tồn bắt buộc),
     ``IotTelemetrySignal`` (cờ chất lượng tín hiệu) và
     ``IotTelemetryDevice`` (pin / phần sụn / RSSI).
  3. Cả hai mô hình đều xác thực rằng huyết áp tâm thu >= huyết áp tâm trương khi
     cả hai được cung cấp.

Quan hệ:
  - Được tiêu thụ bởi các tuyến REST app.api.sensor_api và đường ống tiếp nhận
    dữ liệu thời gian thực WebSocket.
"""

from datetime import datetime
from pydantic import BaseModel, Field, model_validator


class SensorDataCreate(BaseModel):
    """Mô hình API REST cho một lần gửi dữ liệu cảm biến đơn lẻ.

    Thuộc tính:
        patient_id: Chuỗi UUID xác định bệnh nhân.
        heart_rate: Nhịp tim mỗi phút (0–300).
        spo2: Phần trăm oxy trong máu (0–100).
        systolic_bp: Huyết áp tâm thu tính bằng mmHg (0–300).
        diastolic_bp: Huyết áp tâm trương tính bằng mmHg (0–200).
        ecg_value: Giá trị điện áp chuyển đạo ECG tính bằng mV.
    """
    patient_id: str
    heart_rate: int = Field(ge=0, le=300, description="Nhịp tim (bpm)")
    spo2: int = Field(ge=0, le=100, description="Nồng độ oxy trong máu (%)")
    systolic_bp: int = Field(ge=0, le=300, description="Huyết áp tâm thu (mmHg)")
    diastolic_bp: int = Field(ge=0, le=200, description="Huyết áp tâm trương (mmHg)")
    ecg_value: float = Field(description="Giá trị điện tâm đồ (mV)")

    @model_validator(mode="after")
    def validate_blood_pressure(self):
        """Đảm bảo huyết áp tâm thu không nhỏ hơn huyết áp tâm trương."""
        if self.systolic_bp < self.diastolic_bp:
            raise ValueError("Huyết áp tâm thu (systolic_bp) phải lớn hơn hoặc bằng huyết áp tâm trương (diastolic_bp)")
        return self


class IotTelemetryReadings(BaseModel):
    """Các chỉ số dấu hiệu sinh tồn do thiết bị đeo IoT báo cáo.

    Thuộc tính:
        heart_rate: Nhịp tim mỗi phút (0–300).
        spo2: Phần trăm oxy trong máu (0–100).
        ecg_value: Điện áp ECG tính bằng mV.
        systolic_bp: Huyết áp tâm thu tùy chọn tính bằng mmHg.
        diastolic_bp: Huyết áp tâm trương tùy chọn tính bằng mmHg.
        body_temperature: Nhiệt độ cơ thể tùy chọn tính bằng °C (30–45).
        motion_value: Giá trị gia tốc kế / vận động tùy chọn (>= 0).
    """
    heart_rate: int = Field(ge=0, le=300, description="Nhịp tim (bpm)")
    spo2: int = Field(ge=0, le=100, description="Nồng độ oxy trong máu (%)")
    ecg_value: float = Field(description="Giá trị điện tâm đồ (mV)")
    systolic_bp: int | None = Field(default=None, ge=0, le=300, description="Huyết áp tâm thu")
    diastolic_bp: int | None = Field(default=None, ge=0, le=200, description="Huyết áp tâm trương")
    body_temperature: float | None = Field(default=None, ge=30.0, le=45.0, description="Nhiệt độ cơ thể")
    motion_value: float | None = Field(default=None, ge=0.0, description="Giá trị vận động")

    @model_validator(mode="after")
    def validate_blood_pressure(self):
        """Đảm bảo tâm thu >= tâm trương khi cả hai giá trị đều có mặt."""
        if self.systolic_bp is not None and self.diastolic_bp is not None:
            if self.systolic_bp < self.diastolic_bp:
                raise ValueError("Huyết áp tâm thu (systolic_bp) phải lớn hơn hoặc bằng huyết áp tâm trương (diastolic_bp)")
        return self


class IotTelemetryDevice(BaseModel):
    """Siêu dữ liệu trạng thái thiết bị được báo cáo cùng với dữ liệu đo xa.

    Thuộc tính:
        battery: Mức pin phần trăm (0–100).
        rssi: Chỉ số cường độ tín hiệu nhận được tính bằng dBm.
        firmware_version: Chuỗi phiên bản phần sụn.
        uptime_ms: Thời gian hoạt động của thiết bị tính bằng mili giây.
    """
    battery: int | None = None
    rssi: int | None = None
    firmware_version: str | None = None
    uptime_ms: int | None = None


class IotTelemetrySignal(BaseModel):
    """Cờ chất lượng tín hiệu và trạng thái chuyển đạo từ thiết bị.

    Thuộc tính:
        ppg_quality: Mô tả chất lượng tín hiệu PPG.
        ecg_quality: Mô tả chất lượng tín hiệu ECG.
        leads_off: Cho biết các chuyển đạo ECG có bị ngắt kết nối hay không.
        motion_detected: Cho biết chuyển động / nhiễu tạo tác có được phát hiện hay không.
    """
    ppg_quality: str | None = None
    ecg_quality: str | None = None
    leads_off: bool | None = None
    motion_detected: bool | None = None


class IotTelemetryPayload(BaseModel):
    """Phong bì cấp cao nhất cho dữ liệu đo xa được đẩy bởi một thiết bị IoT.

    Thuộc tính:
        timestamp: Thời điểm dữ liệu đo xa được thu thập.
        sequence: Số thứ tự đơn điệu để sắp xếp / khử trùng lặp.
        mode: Chế độ hoạt động của thiết bị (ví dụ: ``"continuous"``, ``"spot"``).
        readings: Các chỉ số dấu hiệu sinh tồn bắt buộc.
        signal: Cờ chất lượng tín hiệu tùy chọn.
        device: Siêu dữ liệu trạng thái thiết bị tùy chọn.
    """
    timestamp: datetime | None = None
    sequence: int | None = None
    mode: str | None = None
    readings: IotTelemetryReadings
    signal: IotTelemetrySignal | None = None
    device: IotTelemetryDevice | None = None


class DeviceClaim(BaseModel):
    """Mô hình yêu cầu liên kết thiết bị.

    Thuộc tính:
        device_mac: Địa chỉ MAC của thiết bị phần cứng.
        device_name: Tên gợi nhớ tùy chọn.
        device_type: Loại thiết bị tùy chọn (mặc định "Wearable").
    """
    device_mac: str = Field(..., description="Địa chỉ MAC của thiết bị")
    device_name: str | None = Field(default=None, description="Tên thiết bị")
    device_type: str | None = Field(default="Wearable", description="Loại thiết bị")


class DeviceUnclaim(BaseModel):
    """Mô hình yêu cầu hủy liên kết thiết bị.

    Thuộc tính:
        device_mac: Địa chỉ MAC của thiết bị phần cứng.
    """
    device_mac: str = Field(..., description="Địa chỉ MAC của thiết bị")

