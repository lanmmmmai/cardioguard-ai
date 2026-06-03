"""Lược đồ Pydantic cho tải trọng tạo bệnh nhân.

Mục đích:
  Định nghĩa mô hình yêu cầu được sử dụng khi đăng ký một hồ sơ bệnh nhân mới.

Luồng công việc:
  1. Máy khách gửi dữ liệu nhân khẩu học qua điểm cuối đăng ký bệnh nhân.
  2. Lược đồ xác thực loại trường; xác thực logic nghiệp vụ bổ sung
     (phạm vi tuổi, liệt kê giới tính) được xử lý ở lớp dịch vụ.

Quan hệ:
  - Được tiêu thụ bởi các điểm cuối app.api.patient_api.
  - Mô hình ``PatientMeUpdate`` trong ``user_schema.py`` cung cấp một
    đối tác cập nhật linh hoạt hơn cho tự phục vụ của bệnh nhân.
"""

from pydantic import BaseModel


class PatientCreate(BaseModel):
    """Mô hình yêu cầu để tạo bản ghi bệnh nhân mới.

    Thuộc tính:
        full_name: Tên đầy đủ của bệnh nhân.
        age: Tuổi tính theo năm.
        gender: Chuỗi nhận dạng giới tính (được xác thực ở lớp dịch vụ).
        phone: Số điện thoại liên hệ.
        address: Địa chỉ vật lý hoặc địa chỉ gửi thư.
        medical_history: Tóm tắt văn bản tự do về tiền sử liên quan.
    """
    full_name: str
    age: int
    gender: str
    phone: str
    address: str
    medical_history: str
