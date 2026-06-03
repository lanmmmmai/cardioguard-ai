// Dịch vụ WebSocket cho giao tiếp thời gian thực với máy chủ CardioGuard.
// Quy trình làm việc:
//   1. connect đọc JWT từ SecureStorage, mở một
//      IOWebSocketChannel và gửi một thông điệp auth với token.
//   2. Các thông điệp JSON đến được phân phối đến tất cả _listeners đã đăng ký.
//   3. Khi mất kết nối bất ngờ, _handleDisconnect lên lịch kết nối lại
//      với back-off theo cấp số nhân (tối đa 60 giây). Ngắt kết nối chủ ý bỏ qua việc thử lại.
// Mối quan hệ:
//   - Được tiêu thụ bởi các provider để đăng ký callback cho cảnh báo thời gian thực,
//     lịch hẹn và cập nhật trò chuyện.
//   - Phụ thuộc vào: SecureStorage, AppConfig, AppLogger.
import 'dart:convert';
import '../core/app_logger.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:web_socket_channel/io.dart';
import '../core/secure_storage.dart';
import '../config/app_config.dart';

class WebSocketService {
  // URL máy chủ WebSocket (dẫn xuất từ AppConfig.wsUrl hoặc được ghi đè).
  static String wsUrl = AppConfig.wsUrl;

  // Phiên bản WebSocketChannel đang hoạt động, hoặc null nếu chưa kết nối.
  static WebSocketChannel? _channel;

  // Liệu socket có đang kết nối hay không.
  static bool _isConnected = false;

  // Cờ được đặt thành true khi disconnect được gọi chủ ý để bỏ qua
  // tự động kết nối lại.
  static bool _isIntentionalDisconnect = false;

  // Các callback listener đã đăng ký nhận các thông điệp JSON đã phân tích.
  static final List<Function(Map<String, dynamic>)> _listeners = [];

  // Số lần thử kết nối lại kể từ lần kết nối thành công cuối cùng.
  static int _reconnectAttempts = 0;

  // Ghi đè URL WebSocket mặc định tại thời gian chạy (ví dụ cho thử nghiệm).
  static void setWsUrl(String url) {
    wsUrl = url;
  }

  // Đăng ký một callback để nhận tất cả các thông điệp WebSocket đến.
  static void addListener(Function(Map<String, dynamic>) callback) {
    if (!_listeners.contains(callback)) {
      _listeners.add(callback);
    }
  }

  // Hủy đăng ký một callback đã được thêm trước đó.
  static void removeListener(Function(Map<String, dynamic>) callback) {
    _listeners.remove(callback);
  }

  // Mở một kết nối WebSocket đến máy chủ và xác thực với JWT.
  // Nếu đã kết nối, đây là một no-op. Khi mất kết nối hoặc lỗi,
  // _handleDisconnect được gọi để lên lịch thử lại.
  static Future<void> connect() async {
    if (_isConnected) return;
    _isIntentionalDisconnect = false;

    try {
      final token = await SecureStorage().getToken();
      if (token == null || token.isEmpty) {
        AppLogger.log('Bỏ qua kết nối WebSocket: thiếu token xác thực');
        return;
      }
      final uri = Uri.parse(wsUrl);

      _channel = IOWebSocketChannel.connect(uri);
      _isConnected = true;
      _reconnectAttempts = 0;
      AppLogger.log('Kết nối WebSocket đến $wsUrl');
      _channel!.sink.add(json.encode({"type": "auth", "token": token}));

      _channel!.stream.listen(
        (message) {
          try {
            final Map<String, dynamic> data = json.decode(message);
            for (var listener in List.from(_listeners)) {
              listener(data);
            }
          } catch (e) {
            AppLogger.log('Lỗi phân tích thông điệp WebSocket: $e');
          }
        },
        onError: (err) {
          AppLogger.log('Lỗi WebSocket: $err');
          _handleDisconnect();
        },
        onDone: () {
          final closeCode = _channel?.closeCode;
          final closeReason = _channel?.closeReason;
          AppLogger.log('Kết nối WebSocket đã đóng. code=$closeCode reason=$closeReason');
          if (closeCode == 1008) {
            _isIntentionalDisconnect = true;
          }
          _handleDisconnect();
        },
      );
    } catch (e) {
      AppLogger.log('Kết nối WebSocket thất bại: $e');
      _handleDisconnect();
    }
  }

  // Xử lý mất kết nối bằng cách xóa trạng thái và lên lịch kết nối lại
  // với back-off theo cấp số nhân trừ khi ngắt kết nối là chủ ý.
  static void _handleDisconnect() {
    _isConnected = false;
    _channel = null;
    
    if (_isIntentionalDisconnect) {
      AppLogger.log('WebSocket ngắt kết nối chủ ý, bỏ qua tự động kết nối lại.');
      return;
    }
    
    // Back-off theo cấp số nhân: 3, 6, 12, 24, 48, 60 (tối đa) giây
    int delaySeconds = 3 * (1 << _reconnectAttempts);
    if (delaySeconds > 60) delaySeconds = 60;
    _reconnectAttempts++;
    
    Future.delayed(Duration(seconds: delaySeconds), () async {
      if (!_isConnected && !_isIntentionalDisconnect) {
        AppLogger.log('Đang thử kết nối lại WebSocket (Lần thử $_reconnectAttempts)...');
        await connect();
      }
    });
  }

  // Đóng WebSocket chủ ý và ngăn tự động kết nối lại.
  static void disconnect() {
    _isIntentionalDisconnect = true;
    _channel?.sink.close();
    _isConnected = false;
    _channel = null;
  }
}
