/**
 * Tệp: CardioGuard AI – Định nghĩa kiểu miền dùng chung
 * Mục đích: Định nghĩa các hình dạng dữ liệu cốt lõi được sử dụng trên toàn bộ
 *           frontend: bản ghi Bệnh nhân, thông báo Cảnh báo và tải trọng
 *           dữ liệu cảm biến thời gian thực SensorData.
 * Luồng xử lý: Các interface được tiêu thụ bởi dịch vụ API, trình xử lý WebSocket,
 *              và các thành phần UI để đảm bảo an toàn kiểu.
 * Quan hệ:
 *   - Patient     → được sử dụng trong cmsApi, roleMenus, các view bệnh nhân
 *   - Alert       → được sử dụng trong tiện ích severity, thành phần UI cảnh báo
 *   - SensorData  → được sử dụng trong useWebSocket, widget dashboard
 */

/** Hồ sơ nhân khẩu học và y tế của bệnh nhân */
export interface Patient {
  id: string;
  full_name: string;
  age: number;
  gender: string;
  phone: string;
  address: string;
  medical_history: string;
  created_at?: string;
  updated_at?: string;
  must_change_password?: boolean;
}

/** Cảnh báo / thông báo được tạo bởi backend giám sát */
export interface Alert {
  id?: string;
  patient_id: string;
  full_name?: string;
  alert_type: string;
  message: string;
  severity: string;
  is_resolved?: boolean;
  created_at?: string;
}

/** Dữ liệu telemetry cảm biến thời gian thực được đẩy qua WebSocket */
export interface SensorData {
  patient_id: string;
  heart_rate: number;
  spo2: number;
  systolic_bp: number;
  diastolic_bp: number;
  ecg_value: number;
  is_abnormal: boolean;
  alerts: Array<{
    alert_type: string;
    message: string;
    severity: string;
  }>;
  timestamp?: string;
}
