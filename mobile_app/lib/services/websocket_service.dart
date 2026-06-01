import 'dart:convert';
import '../core/app_logger.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:web_socket_channel/io.dart';
import '../core/secure_storage.dart';
import '../config/app_config.dart';

class WebSocketService {
  static String wsUrl = AppConfig.wsUrl;
  static WebSocketChannel? _channel;
  static bool _isConnected = false;
  static bool _isIntentionalDisconnect = false;
  static final List<Function(Map<String, dynamic>)> _listeners = [];

  static void setWsUrl(String url) {
    wsUrl = url;
  }

  static void addListener(Function(Map<String, dynamic>) callback) {
    if (!_listeners.contains(callback)) {
      _listeners.add(callback);
    }
  }

  static void removeListener(Function(Map<String, dynamic>) callback) {
    _listeners.remove(callback);
  }

  static Future<void> connect() async {
    if (_isConnected) return;
    _isIntentionalDisconnect = false;

    try {
      final token = await SecureStorage().getToken();
      if (token == null || token.isEmpty) {
        AppLogger.log('Skip WebSocket connect: missing auth token');
        return;
      }
      final uri = Uri.parse(wsUrl);

      _channel = IOWebSocketChannel.connect(uri);
      _isConnected = true;
      AppLogger.log('WebSocket transport connected to $wsUrl');
      _channel!.sink.add(json.encode({"type": "auth", "token": token}));

      _channel!.stream.listen(
        (message) {
          try {
            final Map<String, dynamic> data = json.decode(message);
            for (var listener in List.from(_listeners)) {
              listener(data);
            }
          } catch (e) {
            AppLogger.log('Error parsing WebSocket message: $e');
          }
        },
        onError: (err) {
          AppLogger.log('WebSocket error: $err');
          _handleDisconnect();
        },
        onDone: () {
          final closeCode = _channel?.closeCode;
          final closeReason = _channel?.closeReason;
          AppLogger.log('WebSocket connection closed. code=$closeCode reason=$closeReason');
          if (closeCode == 1008) {
            _isIntentionalDisconnect = true;
          }
          _handleDisconnect();
        },
      );
    } catch (e) {
      AppLogger.log('WebSocket connection failed: $e');
      _handleDisconnect();
    }
  }

  static void _handleDisconnect() {
    _isConnected = false;
    _channel = null;
    
    if (_isIntentionalDisconnect) {
      AppLogger.log('WebSocket disconnected intentionally, skipping auto-reconnect.');
      return;
    }
    
    // Auto-reconnect after 3 seconds
    Future.delayed(const Duration(seconds: 3), () async {
      if (!_isConnected && !_isIntentionalDisconnect) {
        AppLogger.log('Attempting to reconnect WebSocket...');
        await connect();
      }
    });
  }

  static void disconnect() {
    _isIntentionalDisconnect = true;
    _channel?.sink.close();
    _isConnected = false;
    _channel = null;
  }
}
