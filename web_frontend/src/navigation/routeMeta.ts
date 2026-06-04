/**
 * Tệp: CardioGuard AI – Siêu dữ liệu tuyến đường và phân giải vai trò
 * Mục đích: Cung cấp ánh xạ từ đường dẫn URL đến UserRole cần thiết và
 *           bảng tiêu đề/phụ đề trang cho thanh tiêu đề bố cục dựa trên vai trò.
 * Luồng xử lý: privateRouteRole() kiểm tra tiền tố đường dẫn (/admin, /doctor, /patient)
 *              để suy ra vai trò sở hữu. pageTitles là một từ điển tĩnh được khóa theo đường dẫn.
 * Quan hệ:
 *   - Được sử dụng bởi: App.tsx (logic bảo vệ vai trò), RoleLayout (tiêu đề động)
 */

import type { UserRole } from "../auth/roles";

/**
 * Xác định vai trò cần thiết cho một đường dẫn tuyến đường riêng nhất định.
 * Trả về null nếu đường dẫn không thuộc bất kỳ tiền tố vai trò nào.
 */
export const privateRouteRole = (path: string): UserRole | null => {
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/doctor")) return "doctor";
  if (path.startsWith("/patient")) return "patient";
  return null;
};

/** Từ điển tiêu đề và phụ đề trang cho thanh tiêu đề bố cục (tiếng Việt) */
export const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/admin/email": { title: "Email CMS", subtitle: "Quản lý mẫu email, gửi thông báo và theo dõi lịch sử." },
  "/admin/cms/domain-links": { title: "CMS Domain Links", subtitle: "Quản lý preview link cho Zalo, Messenger, Facebook và OG tags." },
  "/admin/medical-records": { title: "Bệnh án điện tử", subtitle: "Giám sát toàn bộ bệnh án, trạng thái ký xác nhận và audit log." },
  "/admin/patients": { title: "Quản lý bệnh nhân", subtitle: "Hồ sơ y tế, lịch sử khám và thông tin người bệnh." },
  "/patient/chatbot": { title: "Trợ lý AI", subtitle: "Giải đáp, phân tích và theo dõi sức khỏe tim mạch." },
  "/doctor/ai-assistant": { title: "AI Command Center", subtitle: "Trợ lý phân tích dữ liệu, tóm tắt bệnh án và phát hiện bất thường." },
  "/doctor/chatbot": { title: "Chatbot AI", subtitle: "Giải đáp, phân tích và hỗ trợ tư vấn sức khỏe tim mạch." },
  "/doctor/medical-records": { title: "Bệnh án điện tử", subtitle: "Tạo, sửa nháp, ký xác nhận và tạo bản bổ sung bệnh án." },
  "/admin/doctors": { title: "Quản lý bác sĩ", subtitle: "Danh sách bác sĩ, phân công chuyên khoa và quyền truy cập." },
  "/admin/users": { title: "Quản lý tài khoản", subtitle: "Phân quyền hệ thống, theo dõi trạng thái hoạt động và quản trị toàn bộ tài khoản người dùng CardioGuard." },
  "/admin/system-logs": { title: "Nhật ký hệ thống", subtitle: "Audit log, lịch sử đăng nhập và thao tác bảo mật." },
  "/admin/settings": { title: "Cài đặt hệ thống", subtitle: "Cấu hình nền tảng, API token và trạng thái kết nối." },
  "/admin/profile": { title: "Hồ sơ cá nhân", subtitle: "Thông tin tài khoản admin và đổi mật khẩu." },
  "/doctor/prescriptions": { title: "Đơn thuốc", subtitle: "Kê đơn, xem lịch sử đơn thuốc và AI hỗ trợ tham khảo." },
  "/doctor/chat": { title: "Chat tư vấn", subtitle: "Tư vấn trực tuyến bảo mật giữa bác sĩ và bệnh nhân." },
  "/doctor/messages": { title: "Nhắn tin tư vấn", subtitle: "Tư vấn trực tuyến bảo mật giữa bác sĩ và bệnh nhân." },
  "/doctor/ai-analysis": { title: "AI phân tích sức khỏe", subtitle: "Dự đoán nguy cơ tim mạch, phát hiện bất thường và gợi ý chẩn đoán tham khảo." },
  "/doctor/profile": { title: "Hồ sơ cá nhân", subtitle: "Thông tin bác sĩ, chuyên khoa và lịch làm việc." },
  "/doctor/settings": { title: "Cài đặt bác sĩ", subtitle: "Quản lý ngôn ngữ, thông báo và bảo mật tài khoản bác sĩ." },
  "/admin/delete-data": { title: "Hướng dẫn xóa dữ liệu", subtitle: "Quy trình xóa tài khoản và dữ liệu cá nhân CardioGuard AI" },
  "/doctor/delete-data": { title: "Hướng dẫn xóa dữ liệu", subtitle: "Quy trình xóa tài khoản và dữ liệu cá nhân CardioGuard AI" },
  "/patient/delete-data": { title: "Hướng dẫn xóa dữ liệu", subtitle: "Quy trình xóa tài khoản và dữ liệu cá nhân CardioGuard AI" },
  "/patient/home": { title: "Trang chủ bệnh nhân", subtitle: "Tổng quan chỉ số sức khỏe của bạn." },
  "/patient/dashboard": { title: "Trang chủ bệnh nhân", subtitle: "Tổng quan chỉ số sức khỏe của bạn." },
  "/patient/health": { title: "Chỉ số sức khỏe", subtitle: "Theo dõi nhịp tim, SpO2, huyết áp và ECG realtime." },
  "/patient/metrics": { title: "Chỉ số sức khỏe", subtitle: "Theo dõi nhịp tim, SpO2, huyết áp và ECG realtime." },
  "/patient/history": { title: "Lịch sử sức khỏe", subtitle: "Lưu trữ và phân tích chỉ số sức khỏe theo thời gian." },
  "/patient/prescriptions": { title: "Đơn thuốc của tôi", subtitle: "Danh sách đơn thuốc hiện tại và lịch sử kê đơn." },
  "/patient/sos": { title: "SOS khẩn cấp", subtitle: "Kích hoạt cảnh báo khẩn cấp gửi tới bác sĩ và hệ thống." },
  "/patient/chat": { title: "Chat với bác sĩ", subtitle: "Trao đổi nhanh với bác sĩ phụ trách." },
  "/patient/notifications": { title: "Thông báo", subtitle: "Lịch hẹn, cảnh báo sức khỏe và cập nhật hệ thống." },
  "/patient/medical-records": { title: "Bệnh án điện tử", subtitle: "Xem các bệnh án đã được bác sĩ ký xác nhận." },
  "/patient/profile": { title: "Hồ sơ cá nhân", subtitle: "Xem/cập nhật thông tin cá nhân và ảnh đại diện." },
  "/patient/settings": { title: "Cài đặt", subtitle: "Tùy chỉnh thông báo, bảo mật và giao diện." },
  "/patient/complete-profile": { title: "Hoàn thiện hồ sơ bệnh nhân", subtitle: "Vui lòng cập nhật đầy đủ thông tin để kích hoạt tài khoản." },
  "/doctor/complete-profile": { title: "Hoàn thiện hồ sơ bác sĩ", subtitle: "Tải lên chứng chỉ y khoa và thông tin chuyên môn." },
  "/doctor/pending-verification": { title: "Chờ xác thực tài khoản", subtitle: "Hồ sơ của bạn đang được ban quản trị kiểm tra và xét duyệt." },
  "/doctor/verification-rejected": { title: "Hồ sơ bị từ chối xác thực", subtitle: "Hồ sơ của bạn không đủ điều kiện phê duyệt." },
  "/admin/doctor-verification": { title: "Xác thực bác sĩ", subtitle: "Xét duyệt và phê duyệt hồ sơ bác sĩ đăng ký." },
};
