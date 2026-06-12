// Cấu hình trung tâm của ứng dụng với các hằng số.
// Quy trình làm việc:
//   - Cung cấp baseUrl có thể ghi đè khi biên dịch và wsUrl dẫn xuất
//     cho kết nối WebSocket.
//   - Hiển thị các hằng số đường dẫn API và tên khóa lưu trữ an toàn.
//   - Đặt giá trị thời gian chờ mạng được điều chỉnh cho thời gian khởi động nguội của Render free-tier.
// Mối quan hệ:
//   - Được sử dụng bởi ApiClient, SecureStorage, WebSocketService,
//     và tất cả các lớp provider để giải quyết điểm cuối/cấu hình.
import 'package:flutter/foundation.dart';

class AppConfig {
  // Giá trị gốc có thể được ghi đè khi chạy ứng dụng:
  // flutter run --dart-define=API_BASE_URL=http://192.168.x.x:8000
  static const String _configuredBaseUrl = String.fromEnvironment('API_BASE_URL');

  /// Trả về origin backend mặc định phù hợp theo nền tảng chạy app.
  static String get _defaultBackendOrigin {
    if (kIsWeb) {
      return 'http://127.0.0.1:8000';
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.iOS:
      case TargetPlatform.macOS:
        return 'http://127.0.0.1:8000';
      case TargetPlatform.android:
      case TargetPlatform.fuchsia:
      case TargetPlatform.linux:
      case TargetPlatform.windows:
        return 'http://10.0.2.2:8000';
    }
  }

  /// URL cơ sở API luôn được chuẩn hóa để kết thúc bằng tiền tố `/api`.
  static String get baseUrl {
    final rawBaseUrl =
        _configuredBaseUrl.isNotEmpty ? _configuredBaseUrl : _defaultBackendOrigin;
    final uri = Uri.parse(rawBaseUrl);
    final normalizedPath = uri.path.replaceFirst(RegExp(r'/$'), '');
    final apiPath = normalizedPath.endsWith('/api')
        ? normalizedPath
        : '${normalizedPath.isEmpty ? '' : normalizedPath}/api';
    return uri.replace(path: apiPath).toString().replaceFirst(RegExp(r'/$'), '');
  }

  static String get wsUrl {
    const wsOverride = String.fromEnvironment('WS_URL');
    if (wsOverride.isNotEmpty) {
      return wsOverride;
    }
    final uri = Uri.parse(baseUrl);
    final wsScheme = uri.scheme == 'https' ? 'wss' : 'ws';
    final basePath = uri.path.replaceFirst(RegExp(r'/api/?$'), '');
    return Uri(
      scheme: wsScheme,
      host: uri.host,
      port: uri.hasPort ? uri.port : null,
      path: '${basePath.isEmpty ? '' : basePath}/ws/realtime',
    ).toString();
  }

  // Các điểm cuối API
  static const String loginEndpoint = '/auth/login';
  static const String registerEndpoint = '/auth/register';
  static const String requestOtpEndpoint = '/auth/register/request-otp';
  static const String forgotPasswordRequestOtpEndpoint =
      '/auth/forgot-password/request-otp';
  static const String forgotPasswordVerifyOtpEndpoint =
      '/auth/forgot-password/verify-otp';
  static const String googleLoginEndpoint = '/auth/google-login';
  static const String logoutEndpoint = '/auth/logout';
  static const String meEndpoint = '/auth/me';
  static const String patientsEndpoint = '/patients';
  static const String alertsEndpoint = '/alerts';
  static const String alertsWeeklyStatsEndpoint = '/alerts/stats/last-7-days';
  static const String notificationsEndpoint = '/notifications';
  static const String assignmentsEndpoint = '/admin/assignments';
  static const String cmsUsersEndpoint = '/cms/users';
  static const String appointmentsEndpoint = '/appointments';
  static const String chatSessionsEndpoint = '/chat/sessions';
  static const String chatHistoryEndpoint = '/chat/history';
  static const String chatSendEndpoint = '/chat/send';
  static const String facebookLoginEndpoint = '/auth/facebook-login';
  static const String changePasswordEndpoint = '/auth/change-password';
  static const String profileEndpoint = '/profile';

  // Khóa lưu trữ an toàn
  static const String keyToken = 'jwt_access_token';
  static const String keyUser = 'authenticated_user_profile';

  // Google OAuth client IDs được truyền qua `--dart-define` khi build.
  static const String googleServerClientId = String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');

  // Facebook App ID — truyền qua `--dart-define=FACEBOOK_APP_ID=...`
  static const String facebookAppId = String.fromEnvironment('FACEBOOK_APP_ID');

  // Cài đặt mạng
  static const int connectTimeoutMs = 45000; // 45 giây (tăng cho thời gian khởi động nguội Render)
  static const int receiveTimeoutMs = 15000; // 15 giây
}
