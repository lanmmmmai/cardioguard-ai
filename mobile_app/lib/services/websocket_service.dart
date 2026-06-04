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
import 'dart:async';
import '../core/app_logger.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:web_socket_channel/io.dart';
import '../core/secure_storage.dart';
import '../config/app_config.dart';

class WebSocketService {
  static final WebSocketService _instance = WebSocketService._internal();

  factory WebSocketService() => _instance;

  WebSocketService._internal();

  String _wsUrl = AppConfig.wsUrl;
  WebSocketChannel? _channel;
  bool _isConnected = false;
  bool _isConnecting = false;
  bool _isIntentionalDisconnect = false;
  bool _reconnectScheduled = false;
  final List<Function(Map<String, dynamic>)> _listeners = [];
  int _reconnectAttempts = 0;

  static Future<void> connect() => _instance._connect();
  static void disconnect() => _instance._disconnect();
  static void addListener(Function(Map<String, dynamic>) callback) =>
      _instance._addListener(callback);
  static void removeListener(Function(Map<String, dynamic>) callback) =>
      _instance._removeListener(callback);
  static void setWsUrl(String url) => _instance._wsUrl = url;

  void _addListener(Function(Map<String, dynamic>) callback) {
    if (!_listeners.contains(callback)) {
      _listeners.add(callback);
    }
  }

  void _removeListener(Function(Map<String, dynamic>) callback) {
    _listeners.remove(callback);
  }

  Future<void> _connect() async {
    if (_isConnected || _isConnecting) return;
    _isConnecting = true;
    _isIntentionalDisconnect = false;
    _reconnectScheduled = false;

    try {
      final token = await SecureStorage().getToken();
      if (token == null || token.isEmpty) {
        AppLogger.log('Bỏ qua kết nối WebSocket: thiếu token xác thực');
        _isConnecting = false;
        return;
      }
      final uri = Uri.parse(_wsUrl);

      _channel = IOWebSocketChannel.connect(uri);
      _isConnected = true;
      _isConnecting = false;
      _reconnectAttempts = 0;
      AppLogger.log('Kết nối WebSocket đến $_wsUrl');
      _channel!.sink.add(json.encode({"type": "auth", "token": token}));

      _channel!.stream.listen(
        (message) {
          try {
            final Map<String, dynamic> data = json.decode(message as String) as Map<String, dynamic>;
            _reconnectScheduled = false;
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
      _isConnecting = false;
      AppLogger.log('Kết nối WebSocket thất bại: $e');
      _handleDisconnect();
    }
  }

  // Xử lý mất kết nối bằng cách xóa trạng thái và lên lịch kết nối lại
  // với back-off theo cấp số nhân trừ khi ngắt kết nối là chủ ý.
  void _handleDisconnect() {
    _isConnected = false;
    _isConnecting = false;
    _channel = null;
    
    if (_isIntentionalDisconnect) {
      AppLogger.log('WebSocket ngắt kết nối chủ ý, bỏ qua tự động kết nối lại.');
      return;
    }
    if (_reconnectScheduled) {
      return;
    }
    _reconnectScheduled = true;
    
    // Back-off theo cấp số nhân: 3, 6, 12, 24, 48, 60 (tối đa) giây
    int delaySeconds = 3 * (1 << _reconnectAttempts);
    if (delaySeconds > 60) delaySeconds = 60;
    _reconnectAttempts++;
    
    Future.delayed(Duration(seconds: delaySeconds), () async {
      _reconnectScheduled = false;
      if (!_isConnected && !_isIntentionalDisconnect) {
        AppLogger.log('Đang thử kết nối lại WebSocket (Lần thử $_reconnectAttempts)...');
        await _connect();
      }
    });
  }

  // Đóng WebSocket chủ ý và ngăn tự động kết nối lại.
  void _disconnect() {
    _isIntentionalDisconnect = true;
    _reconnectScheduled = false;
    _isConnecting = false;
    _channel?.sink.close();
    _isConnected = false;
    _channel = null;
  }
}
