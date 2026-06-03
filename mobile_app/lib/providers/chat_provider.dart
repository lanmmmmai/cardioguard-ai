// Provider trò chuyện — tìm nạp lịch sử, gửi tin nhắn và xử lý
// cập nhật tin nhắn thời gian thực qua WebSocket.
// Quy trình làm việc:
//   1. fetchChatHistory lấy tin nhắn cho một bệnh nhân cụ thể và sắp xếp
//      cũ nhất trước (thứ tự luồng trò chuyện).
//   2. sendMessage đăng một tin nhắn mới và thêm nó vào danh sách cục bộ.
//   3. addRealtimeMessage xử lý các tin nhắn WebSocket đến, ủy quyền
//      cho _appendMessageIfNotExists để tránh trùng lặp.
// Mối quan hệ:
//   - Phụ thuộc vào: ApiClient, AppLogger, ChatMessage model.
//   - Tin nhắn thời gian thực đến qua callbacks của WebSocketService.
import 'package:flutter/material.dart';
import '../core/app_logger.dart';
import '../core/api_client.dart';
import '../models/models.dart';

class ChatProvider extends ChangeNotifier {
  // Phiên bản API client dùng chung.
  final ApiClient _apiClient = ApiClient();

  bool _isLoading = false;

  // Liệu một yêu cầu mạng có đang được tiến hành hay không.
  bool get isLoading => _isLoading;

  List<ChatMessage> _messages = [];

  // Danh sách tin nhắn trò chuyện (sắp xếp cũ nhất trước cho luồng hiển thị).
  List<ChatMessage> get messages => _messages;

  // Cập nhật trạng thái tải và thông báo cho listeners.
  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  // Tìm nạp lịch sử trò chuyện cho patientId đã cho, sắp xếp cũ nhất trước.
  Future<void> fetchChatHistory(String patientId) async {
    _setLoading(true);
    try {
      final response = await _apiClient.get(
        '/chat-messages',
        queryParameters: {'patient_id': patientId},
      );
      if (response.statusCode == 200) {
        if (response.data is! List) throw Exception("Dữ liệu trả về phải là một danh sách");
        final List<dynamic> list = response.data as List<dynamic>;
        _messages = list.map((item) => ChatMessage.fromJson(item)).toList();
        // Sắp xếp cũ nhất trước cho luồng trò chuyện
        _messages.sort((a, b) => a.createdAt.compareTo(b.createdAt));
      }
    } catch (e) {
      AppLogger.log('Lỗi tìm nạp lịch sử trò chuyện: $e');
    } finally {
      _setLoading(false);
    }
  }

  // Gửi tin nhắn trò chuyện qua API và thêm vào danh sách cục bộ.
  Future<bool> sendMessage({
    required String patientId,
    required String doctorId,
    required String senderId,
    required String recipientId,
    required String messageText,
  }) async {
    try {
      final response = await _apiClient.post(
        '/chat-messages',
        data: {
          'patient_id': patientId,
          'doctor_id': doctorId,
          'sender_id': senderId,
          'recipient_id': recipientId,
          'message': messageText,
          'is_read': false,
        },
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        // Tin nhắn thời gian thực sẽ được thêm qua bộ lắng nghe WebSocket hoặc thủ công nếu cần
        final msg = ChatMessage.fromJson(response.data);
        _appendMessageIfNotExists(msg);
        return true;
      }
      return false;
    } catch (e) {
      AppLogger.log('Lỗi gửi tin nhắn: $e');
      return false;
    }
  }

  // Xử lý một tin nhắn thời gian thực đến từ WebSocket — thêm vào nếu mới.
  void addRealtimeMessage(Map<String, dynamic> messageJson) {
    try {
      final msg = ChatMessage.fromJson(messageJson);
      _appendMessageIfNotExists(msg);
    } catch (e) {
      AppLogger.log('Lỗi phân tích tin nhắn thời gian thực: $e');
    }
  }

  // Thêm msg vào danh sách cục bộ chỉ khi nó chưa tồn tại,
  // sau đó sắp xếp lại theo createdAt (cũ nhất trước).
  void _appendMessageIfNotExists(ChatMessage msg) {
    final index = _messages.indexWhere((m) => m.id == msg.id);
    if (index == -1) {
      _messages.add(msg);
      _messages.sort((a, b) => a.createdAt.compareTo(b.createdAt));
      notifyListeners();
    }
  }
}
