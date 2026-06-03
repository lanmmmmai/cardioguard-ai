// Cấu hình trung tâm của ứng dụng với các hằng số.
// Quy trình làm việc:
//   - Cung cấp baseUrl có thể ghi đè khi biên dịch và wsUrl dẫn xuất
//     cho kết nối WebSocket.
//   - Hiển thị các hằng số đường dẫn API và tên khóa lưu trữ an toàn.
//   - Đặt giá trị thời gian chờ mạng được điều chỉnh cho thời gian khởi động nguội của Render free-tier.
// Mối quan hệ:
//   - Được sử dụng bởi ApiClient, SecureStorage, WebSocketService,
//     và tất cả các lớp provider để giải quyết điểm cuối/cấu hình.
class AppConfig {
  // Mặc định cho giả lập Android. Ghi đè trên thiết bị thật:
  // flutter run --dart-define=API_BASE_URL=http://192.168.x.x:8000
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000',
  );

  static String get wsUrl {
    const wsOverride = String.fromEnvironment('WS_URL');
    if (wsOverride.isNotEmpty) {
      return wsOverride;
    }
    final uri = Uri.parse(baseUrl);
    final wsScheme = uri.scheme == 'https' ? 'wss' : 'ws';
    return Uri(
      scheme: wsScheme,
      host: uri.host,
      port: uri.hasPort ? uri.port : null,
      path: '/ws/realtime',
    ).toString();
  }

  // Các điểm cuối API
  static const String loginEndpoint = '/auth/login';
  static const String registerEndpoint = '/auth/register';
  static const String requestOtpEndpoint = '/auth/register/request-otp';
  static const String meEndpoint = '/auth/me';
  static const String patientsEndpoint = '/patients';
  static const String alertsEndpoint = '/alerts';
  static const String alertsWeeklyStatsEndpoint = '/alerts/stats/last-7-days';
  static const String assignmentsEndpoint = '/admin/assignments';

  // Khóa lưu trữ an toàn
  static const String keyToken = 'jwt_access_token';
  static const String keyUser = 'authenticated_user_profile';

  // Cài đặt mạng
  static const int connectTimeoutMs = 45000; // 45 giây (tăng cho thời gian khởi động nguội Render)
  static const int receiveTimeoutMs = 15000; // 15 giây
}
