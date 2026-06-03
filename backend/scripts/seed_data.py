"""Trình tạo dữ liệu mẫu cho cơ sở dữ liệu, điền vào các bảng tham chiếu với dữ liệu mẫu.

Mục đích:
  Chèn các bản ghi mẫu thực tế vào các bảng ``cameras``, ``reports``,
  ``audit_logs``, ``devices``, ``appointments`` và ``medical_records``.
  Khám phá tên cột thực tế thông qua ``information_schema`` để
  duy trì tương thích với các biến thể lược đồ trên các môi trường.

Luồng công việc:
  1. Kết nối với cơ sở dữ liệu và lấy ID bệnh nhân/bác sĩ/quản trị viên hiện có.
  2. Nếu không có bản ghi ``patients`` nào tồn tại, tạo các hàng tạm thời từ
     bảng ``users`` (người dùng có vai trò bệnh nhân) để đáp ứng các ràng buộc khóa ngoại.
  3. Đối với mỗi bảng mục tiêu (cameras, reports, audit_logs, devices,
     appointments, medical_records), xem xét tên cột thực tế.
  4. Nếu bảng trống, xây dựng các câu lệnh INSERT động chỉ đặt các cột
     thực sự có mặt trong lược đồ.
  5. Ngắt kết nối sạch sẽ.

Quan hệ:
  - app.core.database — động cơ cơ sở dữ liệu không đồng bộ.
  - app.core.config — cài đặt ứng dụng (được sử dụng ngầm cho URL DB).
  - Được thiết kế để an toàn khi chạy nhiều lần (kiểm tra ``COUNT(*)`` trước khi
    tạo dữ liệu cho mỗi bảng).
"""

import asyncio
import uuid
import json
from datetime import datetime, timedelta, timezone
from app.core.config import settings
from app.core.database import database

async def get_real_columns(table_name: str) -> set:
    """Truy vấn ``information_schema.columns`` cho bảng đã cho.

    Args:
        table_name: Tên bảng công khai để xem xét.

    Trả về:
        Một tập hợp các chuỗi tên cột.
    """
    rows = await database.fetch_all(
        """
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = :table_name
        """,
        {"table_name": table_name}
    )
    return {row["column_name"] for row in rows}

async def main():
    """Điểm vào: kết nối, tạo dữ liệu cho tất cả các bảng và ngắt kết nối."""
    print("Đang kết nối cơ sở dữ liệu...")
    await database.connect()
    
    try:
        # Lấy các bản ghi bệnh nhân hiện có (cần thiết cho tham chiếu FK)
        print("Đang đọc dữ liệu bệnh nhân thật...")
        real_patients = await database.fetch_all("SELECT id FROM patients")
        if not real_patients:
            # Dự phòng: tạo hàng bệnh nhân tạm thời từ người dùng có vai trò='patient'
            print("Không tìm thấy bản ghi nào trong bảng patients. Đang thử đọc bảng users...")
            users_patients = await database.fetch_all("SELECT id FROM users WHERE lower(role) = 'patient'")
            if users_patients:
                print("Đang tạo bản ghi tạm thời trong bảng patients để đảm bảo khóa ngoại...")
                for up in users_patients:
                    try:
                        await database.execute(
                            "INSERT INTO patients (id, full_name, age, gender) VALUES (:id, 'Bệnh nhân mẫu', 40, 'Nam')",
                            {"id": str(up["id"])}
                        )
                    except Exception as ex:
                        print(f"Bỏ qua lỗi tạo patient: {ex}")
                real_patients = await database.fetch_all("SELECT id FROM patients")
        
        # Lấy ID bác sĩ và quản trị viên hiện có
        print("Đang đọc dữ liệu bác sĩ thật...")
        real_doctors = await database.fetch_all("SELECT id FROM users WHERE lower(role) = 'doctor'")
        real_admins = await database.fetch_all("SELECT id FROM users WHERE lower(role) = 'admin'")
        
        target_patient_id = str(real_patients[0]["id"]) if real_patients else None
        target_doctor_id = str(real_doctors[0]["id"]) if real_doctors else None
        target_admin_id = str(real_admins[0]["id"]) if real_admins else (str(real_doctors[0]["id"]) if real_doctors else None)
        
        if not target_patient_id:
            print("Không tìm thấy bệnh nhân lâm sàng nào. Hãy đăng ký một tài khoản Patient và hoàn tất OTP trước!")
            return
            
        print(f"Sử dụng Patient ID: {target_patient_id}")
        print(f"Sử dụng Doctor ID: {target_doctor_id}")
        print(f"Sử dụng Admin/User ID: {target_admin_id}")

        # 1. cameras — 2 bản ghi camera mẫu
        cameras_cols = await get_real_columns("cameras")
        if cameras_cols:
            camera_count = await database.fetch_val("SELECT COUNT(*) FROM cameras")
            print(f"Số lượng camera hiện tại: {camera_count}")
            if camera_count == 0:
                print("Đang seed dữ liệu cho bảng 'cameras'...")
                
                cam_data1 = {}
                if "id" in cameras_cols: cam_data1["id"] = str(uuid.uuid4())
                if "camera_name" in cameras_cols: cam_data1["camera_name"] = "Camera Giường Bệnh Nhân 1"
                elif "name" in cameras_cols: cam_data1["name"] = "Camera Giường Bệnh Nhân 1"
                if "location" in cameras_cols: cam_data1["location"] = "Phòng Cấp cứu ICU 01"
                if "stream_url" in cameras_cols: cam_data1["stream_url"] = "https://www.w3schools.com/html/mov_bbb.mp4"
                if "status" in cameras_cols: cam_data1["status"] = "online"
                if "created_at" in cameras_cols: cam_data1["created_at"] = datetime.now(timezone.utc)
                if "updated_at" in cameras_cols: cam_data1["updated_at"] = datetime.now(timezone.utc)
                
                if "assigned_patient_id" in cameras_cols:
                    cam_data1["assigned_patient_id"] = target_patient_id
                elif "patient_id" in cameras_cols:
                    cam_data1["patient_id"] = target_patient_id
                
                insert_cols1 = ", ".join(cam_data1.keys())
                bind_cols1 = ", ".join(f":{k}" for k in cam_data1.keys())
                await database.execute(
                    f"INSERT INTO cameras ({insert_cols1}) VALUES ({bind_cols1})",
                    cam_data1
                )
                
                cam_data2 = {}
                if "id" in cameras_cols: cam_data2["id"] = str(uuid.uuid4())
                if "camera_name" in cameras_cols: cam_data2["camera_name"] = "Camera Giám sát Thân nhiệt 3D"
                elif "name" in cameras_cols: cam_data2["name"] = "Camera Giám sát Thân nhiệt 3D"
                if "location" in cameras_cols: cam_data2["location"] = "Phòng Điều trị Đặc biệt 302"
                if "stream_url" in cameras_cols: cam_data2["stream_url"] = "https://www.w3schools.com/html/movie.mp4"
                if "status" in cameras_cols: cam_data2["status"] = "online"
                if "created_at" in cameras_cols: cam_data2["created_at"] = datetime.now(timezone.utc)
                if "updated_at" in cameras_cols: cam_data2["updated_at"] = datetime.now(timezone.utc)
                
                if "assigned_patient_id" in cameras_cols:
                    cam_data2["assigned_patient_id"] = target_patient_id
                elif "patient_id" in cameras_cols:
                    cam_data2["patient_id"] = target_patient_id
                
                insert_cols2 = ", ".join(cam_data2.keys())
                bind_cols2 = ", ".join(f":{k}" for k in cam_data2.keys())
                await database.execute(
                    f"INSERT INTO cameras ({insert_cols2}) VALUES ({bind_cols2})",
                    cam_data2
                )
                print("Đã seed thành công 2 camera mẫu!")

        # 2. reports — 2 báo cáo lâm sàng mẫu
        reports_cols = await get_real_columns("reports")
        if reports_cols:
            report_count = await database.fetch_val("SELECT COUNT(*) FROM reports")
            print(f"Số lượng báo cáo hiện tại: {report_count}")
            if report_count == 0:
                print("Đang seed dữ liệu cho bảng 'reports'...")
                
                rep_data1 = {}
                if "id" in reports_cols: rep_data1["id"] = str(uuid.uuid4())
                if "title" in reports_cols: rep_data1["title"] = "Báo cáo Đánh giá Chỉ số Nhịp tim & ECG Định kỳ"
                elif "report_title" in reports_cols: rep_data1["report_title"] = "Báo cáo Đánh giá Chỉ số Nhịp tim & ECG Định kỳ"
                
                if "report_type" in reports_cols: rep_data1["report_type"] = "ECG Analysis"
                if "content" in reports_cols: rep_data1["content"] = "Bệnh nhân có chỉ số ECG tương đối ổn định. Xuất hiện một vài nhịp ngoại tâm thu thất thưa thớt nhưng không nguy kịch. Khuyến nghị theo dõi thêm và duy trì chế độ dinh dưỡng giảm muối."
                if "data" in reports_cols: rep_data1["data"] = json.dumps({"avg_heart_rate": 78, "max_heart_rate": 112, "ecg_quality": "High"})
                if "created_at" in reports_cols: rep_data1["created_at"] = datetime.now(timezone.utc) - timedelta(days=1)
                if "updated_at" in reports_cols: rep_data1["updated_at"] = datetime.now(timezone.utc) - timedelta(days=1)
                
                if "patient_id" in reports_cols:
                    rep_data1["patient_id"] = target_patient_id
                elif "assigned_patient_id" in reports_cols:
                    rep_data1["assigned_patient_id"] = target_patient_id
                
                if "doctor_id" in reports_cols and target_doctor_id:
                    rep_data1["doctor_id"] = target_doctor_id
                    
                insert_cols1 = ", ".join(rep_data1.keys())
                bind_cols1 = ", ".join(f":{k}" for k in rep_data1.keys())
                await database.execute(
                    f"INSERT INTO reports ({insert_cols1}) VALUES ({bind_cols1})",
                    rep_data1
                )
                
                rep_data2 = {}
                if "id" in reports_cols: rep_data2["id"] = str(uuid.uuid4())
                if "title" in reports_cols: rep_data2["title"] = "Báo cáo Phân tích Cảnh báo Huyết áp & SpO2 Tuần 22"
                elif "report_title" in reports_cols: rep_data2["report_title"] = "Báo cáo Phân tích Cảnh báo Huyết áp & SpO2 Tuần 22"
                
                if "report_type" in reports_cols: rep_data2["report_type"] = "Clinical Summary"
                if "content" in reports_cols: rep_data2["content"] = "Ghi nhận chỉ số huyết áp tâm thu có dấu hiệu tăng nhẹ vào các khung giờ chiều tối (150/90 mmHg). Chỉ số oxy máu SpO2 duy trì tốt trên 96%. Đã điều chỉnh liều lượng thuốc hạ huyết áp."
                if "data" in reports_cols: rep_data2["data"] = json.dumps({"avg_systolic_bp": 138, "avg_diastolic_bp": 86, "avg_spo2": 97.5})
                if "created_at" in reports_cols: rep_data2["created_at"] = datetime.now(timezone.utc) - timedelta(days=3)
                if "updated_at" in reports_cols: rep_data2["updated_at"] = datetime.now(timezone.utc) - timedelta(days=3)
                
                if "patient_id" in reports_cols:
                    rep_data2["patient_id"] = target_patient_id
                elif "assigned_patient_id" in reports_cols:
                    rep_data2["assigned_patient_id"] = target_patient_id
                
                if "doctor_id" in reports_cols and target_doctor_id:
                    rep_data2["doctor_id"] = target_doctor_id
                    
                insert_cols2 = ", ".join(rep_data2.keys())
                bind_cols2 = ", ".join(f":{k}" for k in rep_data2.keys())
                await database.execute(
                    f"INSERT INTO reports ({insert_cols2}) VALUES ({bind_cols2})",
                    rep_data2
                )
                print("Đã seed thành công 2 báo cáo lâm sàng mẫu!")

        # 3. audit_logs — 2 mục nhật ký kiểm toán bảo mật mẫu
        audit_cols = await get_real_columns("audit_logs")
        if audit_cols:
            log_count = await database.fetch_val("SELECT COUNT(*) FROM audit_logs")
            print(f"Số lượng nhật ký hệ thống hiện tại: {log_count}")
            if log_count == 0:
                print("Đang seed dữ liệu cho bảng 'audit_logs'...")
                
                log_data1 = {}
                if "id" in audit_cols: log_data1["id"] = str(uuid.uuid4())
                if "action" in audit_cols: log_data1["action"] = "USER_LOGIN_SUCCESS"
                if "entity_type" in audit_cols: log_data1["entity_type"] = "users"
                if "entity_id" in audit_cols: log_data1["entity_id"] = target_admin_id if target_admin_id else str(uuid.uuid4())
                if "details" in audit_cols: log_data1["details"] = json.dumps({"ip_address": "127.0.0.1", "browser": "Chrome/MacOS", "status": "success"})
                if "created_at" in audit_cols: log_data1["created_at"] = datetime.now(timezone.utc) - timedelta(minutes=15)
                
                if "user_id" in audit_cols and target_admin_id:
                    log_data1["user_id"] = target_admin_id
                
                insert_cols1 = ", ".join(log_data1.keys())
                bind_cols1 = ", ".join(f":{k}" for k in log_data1.keys())
                await database.execute(
                    f"INSERT INTO audit_logs ({insert_cols1}) VALUES ({bind_cols1})",
                    log_data1
                )
                
                log_data2 = {}
                if "id" in audit_cols: log_data2["id"] = str(uuid.uuid4())
                if "action" in audit_cols: log_data2["action"] = "PATIENT_VERIFICATION_OTP_SENT"
                if "entity_type" in audit_cols: log_data2["entity_type"] = "patients"
                if "entity_id" in audit_cols: log_data2["entity_id"] = target_patient_id if target_patient_id else str(uuid.uuid4())
                if "details" in audit_cols: log_data2["details"] = json.dumps({"email": "patient@gmail.com", "gateway": "SMTP"})
                if "created_at" in audit_cols: log_data2["created_at"] = datetime.now(timezone.utc) - timedelta(hours=2)
                
                if "user_id" in audit_cols and target_admin_id:
                    log_data2["user_id"] = target_admin_id
                
                insert_cols2 = ", ".join(log_data2.keys())
                bind_cols2 = ", ".join(f":{k}" for k in log_data2.keys())
                await database.execute(
                    f"INSERT INTO audit_logs ({insert_cols2}) VALUES ({bind_cols2})",
                    log_data2
                )
                print("Đã seed thành công 2 nhật ký hệ thống mẫu!")

        # 4. devices — 2 thiết bị đeo IoT mẫu
        devices_cols = await get_real_columns("devices")
        if devices_cols:
            device_count = await database.fetch_val("SELECT COUNT(*) FROM devices")
            print(f"Số lượng thiết bị IoT hiện tại: {device_count}")
            if device_count == 0:
                print("Đang seed dữ liệu cho bảng 'devices'...")
                
                dev1 = {}
                if "id" in devices_cols: dev1["id"] = str(uuid.uuid4())
                
                if "device_name" in devices_cols: dev1["device_name"] = "Apple Watch Ultra 2"
                elif "name" in devices_cols: dev1["name"] = "Apple Watch Ultra 2"
                
                if "device_type" in devices_cols: dev1["device_type"] = "Smartwatch"
                if "status" in devices_cols: dev1["status"] = "online"
                
                if "battery_level" in devices_cols: dev1["battery_level"] = 88
                elif "battery" in devices_cols: dev1["battery"] = 88
                
                if "last_seen" in devices_cols: dev1["last_seen"] = datetime.now(timezone.utc)
                elif "last_seen_at" in devices_cols: dev1["last_seen_at"] = datetime.now(timezone.utc)
                
                if "created_at" in devices_cols: dev1["created_at"] = datetime.now(timezone.utc)
                if "updated_at" in devices_cols: dev1["updated_at"] = datetime.now(timezone.utc)
                
                if "patient_id" in devices_cols: dev1["patient_id"] = target_patient_id
                elif "assigned_patient_id" in devices_cols: dev1["assigned_patient_id"] = target_patient_id
                
                insert_cols1 = ", ".join(dev1.keys())
                bind_cols1 = ", ".join(f":{k}" for k in dev1.keys())
                await database.execute(f"INSERT INTO devices ({insert_cols1}) VALUES ({bind_cols1})", dev1)
                
                dev2 = {}
                if "id" in devices_cols: dev2["id"] = str(uuid.uuid4())
                
                if "device_name" in devices_cols: dev2["device_name"] = "Samsung Galaxy Fit 3"
                elif "name" in devices_cols: dev2["name"] = "Samsung Galaxy Fit 3"
                
                if "device_type" in devices_cols: dev2["device_type"] = "Fitness Band"
                if "status" in devices_cols: dev2["status"] = "online"
                
                if "battery_level" in devices_cols: dev2["battery_level"] = 45
                elif "battery" in devices_cols: dev2["battery"] = 45
                
                if "last_seen" in devices_cols: dev2["last_seen"] = datetime.now(timezone.utc)
                elif "last_seen_at" in devices_cols: dev2["last_seen_at"] = datetime.now(timezone.utc)
                
                if "created_at" in devices_cols: dev2["created_at"] = datetime.now(timezone.utc)
                if "updated_at" in devices_cols: dev2["updated_at"] = datetime.now(timezone.utc)
                
                if "patient_id" in devices_cols: dev2["patient_id"] = target_patient_id
                elif "assigned_patient_id" in devices_cols: dev2["assigned_patient_id"] = target_patient_id
                
                insert_cols2 = ", ".join(dev2.keys())
                bind_cols2 = ", ".join(f":{k}" for k in dev2.keys())
                await database.execute(f"INSERT INTO devices ({insert_cols2}) VALUES ({bind_cols2})", dev2)
                print("Đã seed thành công 2 thiết bị IoT đeo mẫu!")

        # 5. appointments — 1 lịch hẹn mẫu
        app_cols = await get_real_columns("appointments")
        if app_cols:
            app_count = await database.fetch_val("SELECT COUNT(*) FROM appointments")
            print(f"Số lượng lịch hẹn hiện tại: {app_count}")
            if app_count == 0:
                print("Đang seed dữ liệu cho bảng 'appointments'...")
                
                app1 = {}
                if "id" in app_cols: app1["id"] = str(uuid.uuid4())
                
                if "reason" in app_cols: app1["reason"] = "Tư vấn điện tâm đồ và ECG định kỳ"
                elif "title" in app_cols: app1["title"] = "Tư vấn điện tâm đồ và ECG định kỳ"
                
                if "status" in app_cols: app1["status"] = "confirmed"
                if "channel" in app_cols: app1["channel"] = "Video Call trực tuyến"
                
                if "appointment_date" in app_cols: app1["appointment_date"] = datetime.now(timezone.utc) + timedelta(days=2)
                elif "scheduled_at" in app_cols: app1["scheduled_at"] = datetime.now(timezone.utc) + timedelta(days=2)
                
                if "note" in app_cols: app1["note"] = "Bệnh nhân có tiền sử suy tim độ 2, khám để điều chỉnh liều lượng thuốc."
                elif "notes" in app_cols: app1["notes"] = "Bệnh nhân có tiền sử suy tim độ 2, khám để điều chỉnh liều lượng thuốc."
                
                if "created_at" in app_cols: app1["created_at"] = datetime.now(timezone.utc)
                if "updated_at" in app_cols: app1["updated_at"] = datetime.now(timezone.utc)
                
                if "patient_id" in app_cols: app1["patient_id"] = target_patient_id
                elif "assigned_patient_id" in app_cols: app1["assigned_patient_id"] = target_patient_id
                
                if "doctor_id" in app_cols and target_doctor_id:
                    app1["doctor_id"] = target_doctor_id
                
                insert_cols1 = ", ".join(app1.keys())
                bind_cols1 = ", ".join(f":{k}" for k in app1.keys())
                await database.execute(f"INSERT INTO appointments ({insert_cols1}) VALUES ({bind_cols1})", app1)
                print("Đã seed thành công 1 lịch hẹn mẫu!")

        # 6. medical_records — 1 bệnh án mẫu
        rec_cols = await get_real_columns("medical_records")
        print(f"Cột thực tế của bảng 'medical_records': {rec_cols}")
        if rec_cols:
            rec_count = await database.fetch_val("SELECT COUNT(*) FROM medical_records")
            print(f"Số lượng bệnh án hiện tại: {rec_count}")
            if rec_count == 0:
                print("Đang seed dữ liệu cho bảng 'medical_records'...")
                
                rec1 = {}
                if "id" in rec_cols: rec1["id"] = str(uuid.uuid4())
                
                if "record_type" in rec_cols: rec1["record_type"] = "Chẩn đoán lâm sàng"
                elif "type" in rec_cols: rec1["type"] = "Chẩn đoán lâm sàng"
                
                if "diagnosis" in rec_cols: rec1["diagnosis"] = "Suy tim sung huyết mức độ 2, Cao huyết áp mãn tính"
                
                if "clinical_summary" in rec_cols: rec1["clinical_summary"] = "Nhịp tim không đều. ECG phát hiện ngoại tâm thu thất. Đã kê đơn thuốc và yêu cầu đeo Apple Watch giám sát 24/7."
                elif "summary" in rec_cols: rec1["summary"] = "Nhịp tim không đều. ECG phát hiện ngoại tâm thu thất. Đã kê đơn thuốc và yêu cầu đeo Apple Watch giám sát 24/7."
                
                if "files" in rec_cols: rec1["files"] = json.dumps([{"name": "Kết quả ECG.pdf", "url": "https://example.com/ecg_result.pdf"}])
                if "created_at" in rec_cols: rec1["created_at"] = datetime.now(timezone.utc) - timedelta(days=5)
                if "updated_at" in rec_cols: rec1["updated_at"] = datetime.now(timezone.utc) - timedelta(days=5)
                
                if "patient_id" in rec_cols: rec1["patient_id"] = target_patient_id
                elif "assigned_patient_id" in rec_cols: rec1["assigned_patient_id"] = target_patient_id
                
                if "doctor_id" in rec_cols and target_doctor_id:
                    rec1["doctor_id"] = target_doctor_id
                
                insert_cols1 = ", ".join(rec1.keys())
                bind_cols1 = ", ".join(f":{k}" for k in rec1.keys())
                await database.execute(f"INSERT INTO medical_records ({insert_cols1}) VALUES ({bind_cols1})", rec1)
                print("Đã seed thành công 1 bệnh án lâm sàng mẫu!")
            
    except Exception as e:
        print(f"Lỗi khi seed dữ liệu: {e}")
    finally:
        await database.disconnect()
        print("Đã ngắt kết nối cơ sở dữ liệu.")

if __name__ == "__main__":
    asyncio.run(main())
