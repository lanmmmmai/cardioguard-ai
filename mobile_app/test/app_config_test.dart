// CardioGuard AI — kiểm tra chuẩn hóa cấu hình endpoint mobile.
import 'package:flutter_test/flutter_test.dart';
import 'package:heart_monitor_app/config/app_config.dart';

void main() {
  group('AppConfig', () {
    test('normalizes the HTTP base URL to include the /api prefix', () {
      expect(AppConfig.baseUrl, endsWith('/api'));
    });

    test('derives the realtime websocket URL outside the /api namespace', () {
      expect(AppConfig.wsUrl, contains('/ws/realtime'));
      expect(AppConfig.wsUrl, isNot(contains('/api/ws/realtime')));
    });
  });
}
