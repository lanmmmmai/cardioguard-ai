/**
 * Tệp: CardioGuard AI – Cấu hình dựa trên môi trường
 * Mục đích: Tập trung các hằng số runtime được đọc từ biến môi trường Vite
 *           với giá trị dự phòng an toàn cho phát triển cục bộ.
 * Luồng xử lý: Các giá trị import.meta.env.VITE_* được Vite inject tại thời điểm
 *              build; nếu không có, giá trị mặc định cứng trỏ đến backend dev cục bộ.
 * Quan hệ:
 *   - Được sử dụng bởi: AuthContext (API_URL), useWebSocket (WS_URL), cmsApi (API_URL)
 */

/** URL cơ sở của REST API – dự phòng về localhost:8000 */
export const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:8000';

/** Điểm cuối WebSocket cho dữ liệu telemetry thời gian thực */
export const WS_URL =
  import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/realtime';
