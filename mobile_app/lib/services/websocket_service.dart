import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:web_socket_channel/io.dart';
import '../core/secure_storage.dart';
import '../config/app_config.dart';

class WebSocketService {
  static String wsUrl = AppConfig.wsUrl;
  static WebSocketChannel? _channel;
  static bool _isConnected = false;
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

    try {
      final token = await SecureStorage().getToken();
      final uriStr = token != null ? '$wsUrl?token=$token' : wsUrl;
      final uri = Uri.parse(uriStr);

      _channel = IOWebSocketChannel.connect(uri);
      _isConnected = true;
      print('WebSocket authenticated connection opened to $wsUrl');

      _channel!.stream.listen(
        (message) {
          try {
            final Map<String, dynamic> data = json.decode(message);
            for (var listener in List.from(_listeners)) {
              listener(data);
            }
          } catch (e) {
            print('Error parsing WebSocket message: $e');
          }
        },
        onError: (err) {
          print('WebSocket error: $err');
          _handleDisconnect();
        },
        onDone: () {
          print('WebSocket connection closed.');
          _handleDisconnect();
        },
      );
    } catch (e) {
      print('WebSocket connection failed: $e');
      _handleDisconnect();
    }
  }

  static void _handleDisconnect() {
    _isConnected = false;
    _channel = null;
    
    // Auto-reconnect after 3 seconds
    Future.delayed(const Duration(seconds: 3), () async {
      if (!_isConnected) {
        print('Attempting to reconnect WebSocket...');
        await connect();
      }
    });
  }

  static void disconnect() {
    _channel?.sink.close();
    _isConnected = false;
    _channel = null;
  }
}
