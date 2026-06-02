import 'package:flutter/material.dart';
import '../core/app_logger.dart';
import '../core/api_client.dart';
import '../models/models.dart';

class ChatProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  List<ChatMessage> _messages = [];
  List<ChatMessage> get messages => _messages;

  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  // Fetch chat history between a specific doctor and patient
  Future<void> fetchChatHistory(String patientId) async {
    _setLoading(true);
    try {
      final response = await _apiClient.get(
        '/chat-messages',
        queryParameters: {'patient_id': patientId},
      );
      if (response.statusCode == 200) {
        if (response.data is! List) throw Exception("Expected a list from server");
        final List<dynamic> list = response.data as List<dynamic>;
        _messages = list.map((item) => ChatMessage.fromJson(item)).toList();
        // Sort oldest first for chat flow
        _messages.sort((a, b) => a.createdAt.compareTo(b.createdAt));
      }
    } catch (e) {
      AppLogger.log('Fetch chat history error: $e');
    } finally {
      _setLoading(false);
    }
  }

  // Send message
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
        // The real-time message will be appended via WebSocket listener or manually if needed
        final msg = ChatMessage.fromJson(response.data);
        _appendMessageIfNotExists(msg);
        return true;
      }
      return false;
    } catch (e) {
      AppLogger.log('Send message error: $e');
      return false;
    }
  }

  // Append websocket-received messages
  void addRealtimeMessage(Map<String, dynamic> messageJson) {
    try {
      final msg = ChatMessage.fromJson(messageJson);
      _appendMessageIfNotExists(msg);
    } catch (e) {
      AppLogger.log('Error parsing realtime message: $e');
    }
  }

  void _appendMessageIfNotExists(ChatMessage msg) {
    final index = _messages.indexWhere((m) => m.id == msg.id);
    if (index == -1) {
      _messages.add(msg);
      _messages.sort((a, b) => a.createdAt.compareTo(b.createdAt));
      notifyListeners();
    }
  }
}

