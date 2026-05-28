class AppConfig {
  // Use 10.0.2.2 for Android emulator to access localhost of host machine, or localhost for web/iOS/physical device
  static const String baseUrl = 'http://10.0.2.2:8000';
  static const String wsUrl = 'ws://10.0.2.2:8000/ws/realtime';

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
