# Python
# CardioGuard AI — Device Provisioning Script
#
# File Purpose:
#   Automates the registration and pairing of a physical IoT device (e.g. ESP32-S3)
#   with a patient in the database.
#
# Overall Workflow/Logic:
#   1. Connect to the PostgreSQL database.
#   2. Inspect target tables and columns dynamically.
#   3. Retrieve the first patient user to link with the device. If none exist,
#      attempt to create a patient from a user account with the 'patient' role.
#   4. Insert or update a device record mapped to the selected patient, using the
#      device's MAC address (e.g., 'a842e3112233').
#   5. Log operations and output success.
#
# System Component Relationships:
#   - Integrates with app.core.database to execute SQL commands.
#   - Prepares the devices table database state for app.api.sensor_api.

import asyncio
import logging
import sys
import uuid
from datetime import datetime, timezone
import os

# Ensure the parent directory is in the system path to load the app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import database, connect_db, disconnect_db


async def get_table_columns(table_name: str) -> set[str]:
    """Retrieve the set of column names for a given table.

    Args:
        table_name: Name of the database table to query.

    Returns:
        A set of column name strings.
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


async def provision_device(mac_address: str, device_name: str) -> None:
    """Register and map a device with a patient in the database.

    Args:
        mac_address: The physical MAC address of the device (hex string).
        device_name: Friendly name for the device.

    Raises:
        ValueError: If no valid patient is found to pair the device.
    """
    print(f"Bắt đầu đăng ký thiết bị: {device_name} (MAC: {mac_address})...")
    
    # 1. Tìm patient để liên kết
    real_patients = await database.fetch_all("SELECT id FROM patients")
    patient_id = None
    
    if real_patients:
        patient_id = str(real_patients[0]["id"])
    else:
        # Dự phòng: Tạo patient từ user có role 'patient'
        user_patients = await database.fetch_all("SELECT id, full_name FROM users WHERE lower(role) = 'patient'")
        if user_patients:
            target_user = user_patients[0]
            patient_id = str(target_user["id"])
            print(f"Tự động tạo bản ghi patients cho người dùng: {target_user['full_name']} (ID: {patient_id})")
            await database.execute(
                "INSERT INTO patients (id, full_name, age, gender) VALUES (:id, :full_name, 40, 'Nam')",
                {"id": patient_id, "full_name": target_user["full_name"]}
            )
            
    if not patient_id:
        raise ValueError("Không tìm thấy bệnh nhân nào trong hệ thống. Hãy tạo tài khoản Patient trước khi chạy script.")
        
    print(f"Gán thiết bị cho Bệnh nhân có ID: {patient_id}")
    
    # 2. Kiểm tra schema của bảng devices
    cols = await get_table_columns("devices")
    print(f"Columns in devices: {cols}")
    dev_data = {}
    
    # Chuẩn hóa MAC address
    clean_mac = mac_address.strip().lower().replace(":", "").replace("-", "")
    
    # Điền các cột khả dụng
    if "id" in cols:
        # Kiểm tra xem thiết bị với MAC này đã tồn tại chưa
        existing = await database.fetch_one(
            """
            SELECT id FROM devices 
            WHERE lower(replace(replace(device_mac, ':', ''), '-', '')) = :mac
            """,
            {"mac": clean_mac}
        )
        if existing:
            dev_data["id"] = str(existing["id"])
        else:
            dev_data["id"] = str(uuid.uuid4())
            
    if "device_name" in cols:
        dev_data["device_name"] = device_name
    elif "name" in cols:
        dev_data["name"] = device_name
        
    if "device_type" in cols:
        dev_data["device_type"] = "Wearable"
    if "status" in cols:
        dev_data["status"] = "online"
        
    if "battery_level" in cols:
        dev_data["battery_level"] = 100
    elif "battery" in cols:
        dev_data["battery"] = 100
        
    if "device_mac" in cols:
        dev_data["device_mac"] = clean_mac
        
    if "last_seen" in cols:
        dev_data["last_seen"] = datetime.now(timezone.utc).replace(tzinfo=None)
    elif "last_seen_at" in cols:
        dev_data["last_seen_at"] = datetime.now(timezone.utc).replace(tzinfo=None)
        
    if "created_at" in cols:
        dev_data["created_at"] = datetime.now(timezone.utc).replace(tzinfo=None)
    if "updated_at" in cols:
        dev_data["updated_at"] = datetime.now(timezone.utc).replace(tzinfo=None)
        
    if "patient_id" in cols:
        dev_data["patient_id"] = patient_id
    elif "assigned_patient_id" in cols:
        dev_data["assigned_patient_id"] = patient_id
        
    # Xây dựng câu lệnh chèn/cập nhật động
    keys = list(dev_data.keys())
    insert_cols = ", ".join(keys)
    bind_cols = ", ".join(f":{k}" for k in keys)
    
    # Ràng buộc trùng lặp trên cột MAC address
    update_parts = []
    for k in keys:
        if k not in ("id", "created_at", "device_mac"):
            update_parts.append(f"{k} = EXCLUDED.{k}")
    update_sql = ", ".join(update_parts)
    
    conflict_update = update_sql
    if "updated_at" in cols:
        conflict_update += ", updated_at = NOW()"
    
    query = f"""
    INSERT INTO devices ({insert_cols}) 
    VALUES ({bind_cols})
    ON CONFLICT (lower(replace(replace(device_mac, ':', ''), '-', '')))
    DO UPDATE SET {conflict_update}
    """
    
    await database.execute(query, dev_data)
    print(f"Đăng ký thiết bị thành công! MAC: {clean_mac} -> Patient ID: {patient_id}")


async def main() -> None:
    """Main entry point to connect, run provisioning, and disconnect."""
    await connect_db()
    try:
        # Sử dụng địa chỉ MAC mặc định trong kế hoạch kết nối
        target_mac = "a8:42:e3:11:22:33"
        target_name = "ESP32-S3 Wearable Prototype"
        await provision_device(target_mac, target_name)
    except Exception as e:
        print(f"Lỗi: {e}", file=sys.stderr)
    finally:
        await disconnect_db()


if __name__ == "__main__":
    asyncio.run(main())
