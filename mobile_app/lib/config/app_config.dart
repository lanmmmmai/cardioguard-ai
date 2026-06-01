class AppConfig {
  // Android emulator default. Override on real device:
  // flutter run --dart-define=API_BASE_URL=http://192.168.x.x:8000
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://cardioguard-ai-backend.onrender.com',
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

  // API Endpoints
  static const String loginEndpoint = '/auth/login';
  static const String registerEndpoint = '/auth/register';
  static const String requestOtpEndpoint = '/auth/register/request-otp';
  static const String meEndpoint = '/auth/me';
  static const String patientsEndpoint = '/patients';
  static const String alertsEndpoint = '/alerts';
  static const String assignmentsEndpoint = '/admin/assignments';

  // Secure Storage Keys
  static const String keyToken = 'jwt_access_token';
  static const String keyUser = 'authenticated_user_profile';

  // Network Settings
  static const int connectTimeoutMs = 10000; // 10 seconds
  static const int receiveTimeoutMs = 15000; // 15 seconds
}
