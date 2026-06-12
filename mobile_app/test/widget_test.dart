// Kiểm thử đơn vị để xác minh các hằng số cấu hình ứng dụng CardioGuard.
// Quy trình làm việc:
// 1. Kiểm tra AppConfig.baseUrl bắt đầu bằng http.
// 2. Kiểm tra AppConfig.wsUrl bắt đầu bằng ws.
// 3. Kiểm tra AppConfig.loginEndpoint bằng /auth/login.
// Mối quan hệ:
// - Kiểm thử: AppConfig từ config/app_config.dart.
import 'package:flutter_test/flutter_test.dart';
import 'package:heart_monitor_app/config/app_config.dart';

void main() {
  test('AppConfig hiển thị các điểm cuối API và WS hợp lệ', () {
    expect(AppConfig.baseUrl, startsWith('http'));
    expect(AppConfig.wsUrl, startsWith('ws'));
    expect(AppConfig.loginEndpoint, '/auth/login');
  });
}
