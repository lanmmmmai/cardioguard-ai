import 'package:flutter_test/flutter_test.dart';
import 'package:heart_monitor_app/config/app_config.dart';

void main() {
  test('AppConfig exposes valid API and WS endpoints', () {
    expect(AppConfig.baseUrl, startsWith('http'));
    expect(AppConfig.wsUrl, startsWith('ws'));
    expect(AppConfig.loginEndpoint, '/auth/login');
  });
}
