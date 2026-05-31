import asyncio
import uuid
import json
from datetime import datetime, timedelta
from app.core.config import settings
from app.core.database import database

async def get_real_columns(table_name: str) -> set:
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
    print("Đang kết nối cơ sở dữ liệu...")
    await database.connect()
    
    try:
        # Lấy danh sách patients thật
        print("Đang đọc dữ liệu bệnh nhân thật...")
        real_patients = await database.fetch_all("SELECT id FROM patients")
        if not real_patients:
            # Nếu chưa có patient nào, lấy tạm từ users có vai trò patient
            print("Không tìm thấy bản ghi nào trong bảng patients. Đang thử đọc bảng users...")
            users_patients = await database.fetch_all("SELECT id FROM users WHERE lower(role) = 'patient'")
            if users_patients:
                # Tạo bản ghi patient lâm sàng tạm thời để đảm bảo FK
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
        
        # Lấy danh sách doctors thật
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

        # 1. Bảng cameras
        cameras_cols = await get_real_columns("cameras")
        print(f"Cột thực tế của bảng 'cameras': {cameras_cols}")
        if cameras_cols:
            camera_count = await database.fetch_val("SELECT COUNT(*) FROM cameras")
            print(f"Số lượng camera hiện tại: {camera_count}")
            if camera_count == 0:
                print("Đang seed dữ liệu cho bảng 'cameras'...")
                
                # Tạo bản ghi 1
                cam_data1 = {}
                if "id" in cameras_cols: cam_data1["id"] = str(uuid.uuid4())
                if "camera_name" in cameras_cols: cam_data1["camera_name"] = "Camera Giường Bệnh Nhân 1"
                elif "name" in cameras_cols: cam_data1["name"] = "Camera Giường Bệnh Nhân 1"
                if "location" in cameras_cols: cam_data1["location"] = "Phòng Cấp cứu ICU 01"
                if "stream_url" in cameras_cols: cam_data1["stream_url"] = "https://www.w3schools.com/html/mov_bbb.mp4"
                if "status" in cameras_cols: cam_data1["status"] = "online"
                if "created_at" in cameras_cols: cam_data1["created_at"] = datetime.now()
                if "updated_at" in cameras_cols: cam_data1["updated_at"] = datetime.now()
                
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
                
                # Tạo bản ghi 2
                cam_data2 = {}
                if "id" in cameras_cols: cam_data2["id"] = str(uuid.uuid4())
                if "camera_name" in cameras_cols: cam_data2["camera_name"] = "Camera Giám sát Thân nhiệt 3D"
                elif "name" in cameras_cols: cam_data2["name"] = "Camera Giám sát Thân nhiệt 3D"
                if "location" in cameras_cols: cam_data2["location"] = "Phòng Điều trị Đặc biệt 302"
                if "stream_url" in cameras_cols: cam_data2["stream_url"] = "https://www.w3schools.com/html/movie.mp4"
                if "status" in cameras_cols: cam_data2["status"] = "online"
                if "created_at" in cameras_cols: cam_data2["created_at"] = datetime.now()
                if "updated_at" in cameras_cols: cam_data2["updated_at"] = datetime.now()
                
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

        # 2. Bảng reports
        reports_cols = await get_real_columns("reports")
        print(f"Cột thực tế của bảng 'reports': {reports_cols}")
        if reports_cols:
            report_count = await database.fetch_val("SELECT COUNT(*) FROM reports")
            print(f"Số lượng báo cáo hiện tại: {report_count}")
            if report_count == 0:
                print("Đang seed dữ liệu cho bảng 'reports'...")
                
                # Bản ghi 1
                rep_data1 = {}
                if "id" in reports_cols: rep_data1["id"] = str(uuid.uuid4())
                
                if "title" in reports_cols: rep_data1["title"] = "Báo cáo Đánh giá Chỉ số Nhịp tim & ECG Định kỳ"
                elif "report_title" in reports_cols: rep_data1["report_title"] = "Báo cáo Đánh giá Chỉ số Nhịp tim & ECG Định kỳ"
                
                if "report_type" in reports_cols: rep_data1["report_type"] = "ECG Analysis"
                if "content" in reports_cols: rep_data1["content"] = "Bệnh nhân có chỉ số ECG tương đối ổn định. Xuất hiện một vài nhịp ngoại tâm thu thất thưa thớt nhưng không nguy kịch. Khuyến nghị theo dõi thêm và duy trì chế độ dinh dưỡng giảm muối."
                if "data" in reports_cols: rep_data1["data"] = json.dumps({"avg_heart_rate": 78, "max_heart_rate": 112, "ecg_quality": "High"})
                if "created_at" in reports_cols: rep_data1["created_at"] = datetime.now() - timedelta(days=1)
                if "updated_at" in reports_cols: rep_data1["updated_at"] = datetime.now() - timedelta(days=1)
                
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
                
                # Bản ghi 2
                rep_data2 = {}
                if "id" in reports_cols: rep_data2["id"] = str(uuid.uuid4())
                
                if "title" in reports_cols: rep_data2["title"] = "Báo cáo Phân tích Cảnh báo Huyết áp & SpO2 Tuần 22"
                elif "report_title" in reports_cols: rep_data2["report_title"] = "Báo cáo Phân tích Cảnh báo Huyết áp & SpO2 Tuần 22"
                
                if "report_type" in reports_cols: rep_data2["report_type"] = "Clinical Summary"
                if "content" in reports_cols: rep_data2["content"] = "Ghi nhận chỉ số huyết áp tâm thu có dấu hiệu tăng nhẹ vào các khung giờ chiều tối (150/90 mmHg). Chỉ số oxy máu SpO2 duy trì tốt trên 96%. Đã điều chỉnh liều lượng thuốc hạ huyết áp."
                if "data" in reports_cols: rep_data2["data"] = json.dumps({"avg_systolic_bp": 138, "avg_diastolic_bp": 86, "avg_spo2": 97.5})
                if "created_at" in reports_cols: rep_data2["created_at"] = datetime.now() - timedelta(days=3)
                if "updated_at" in reports_cols: rep_data2["updated_at"] = datetime.now() - timedelta(days=3)
                
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

        # 3. Bảng audit_logs
        audit_cols = await get_real_columns("audit_logs")
        print(f"Cột thực tế của bảng 'audit_logs': {audit_cols}")
        if audit_cols:
            log_count = await database.fetch_val("SELECT COUNT(*) FROM audit_logs")
            print(f"Số lượng nhật ký hệ thống hiện tại: {log_count}")
            if log_count == 0:
                print("Đang seed dữ liệu cho bảng 'audit_logs'...")
                
                # Bản ghi 1
                log_data1 = {}
                if "id" in audit_cols: log_data1["id"] = str(uuid.uuid4())
                if "action" in audit_cols: log_data1["action"] = "USER_LOGIN_SUCCESS"
                if "entity_type" in audit_cols: log_data1["entity_type"] = "users"
                if "entity_id" in audit_cols: log_data1["entity_id"] = target_admin_id if target_admin_id else str(uuid.uuid4())
                if "details" in audit_cols: log_data1["details"] = json.dumps({"ip_address": "127.0.0.1", "browser": "Chrome/MacOS", "status": "success"})
                if "created_at" in audit_cols: log_data1["created_at"] = datetime.now() - timedelta(minutes=15)
                
                if "user_id" in audit_cols and target_admin_id:
                    log_data1["user_id"] = target_admin_id
                
                insert_cols1 = ", ".join(log_data1.keys())
                bind_cols1 = ", ".join(f":{k}" for k in log_data1.keys())
                await database.execute(
                    f"INSERT INTO audit_logs ({insert_cols1}) VALUES ({bind_cols1})",
                    log_data1
                )
                
                # Bản ghi 2
                log_data2 = {}
                if "id" in audit_cols: log_data2["id"] = str(uuid.uuid4())
                if "action" in audit_cols: log_data2["action"] = "PATIENT_VERIFICATION_OTP_SENT"
                if "entity_type" in audit_cols: log_data2["entity_type"] = "patients"
                if "entity_id" in audit_cols: log_data2["entity_id"] = target_patient_id if target_patient_id else str(uuid.uuid4())
                if "details" in audit_cols: log_data2["details"] = json.dumps({"email": "patient@gmail.com", "gateway": "SMTP"})
                if "created_at" in audit_cols: log_data2["created_at"] = datetime.now() - timedelta(hours=2)
                
                if "user_id" in audit_cols and target_admin_id:
                    log_data2["user_id"] = target_admin_id
                
                insert_cols2 = ", ".join(log_data2.keys())
                bind_cols2 = ", ".join(f":{k}" for k in log_data2.keys())
                await database.execute(
                    f"INSERT INTO audit_logs ({insert_cols2}) VALUES ({bind_cols2})",
                    log_data2
                )
                print("Đã seed thành công 2 nhật ký hệ thống mẫu!")
            
    except Exception as e:
        print(f"Lỗi khi seed dữ liệu: {e}")
    finally:
        await database.disconnect()
        print("Đã ngắt kết nối cơ sở dữ liệu.")

if __name__ == "__main__":
    asyncio.run(main())
