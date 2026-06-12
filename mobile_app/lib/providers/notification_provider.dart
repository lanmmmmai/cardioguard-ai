// Provider quản lý thông báo hoạt động và y tế — tìm nạp, đánh dấu đã đọc,
// quản lý tuỳ chọn nhận thông báo và tích hợp sự kiện realtime qua WebSocket.
// Quy trình làm việc:
//   1. fetchNotifications lấy danh sách thông báo từ máy chủ.
//   2. fetchUnreadCount lấy số lượng chưa đọc.
//   3. markAsRead đánh dấu đã đọc cho 1 thông báo.
//   4. markAllAsRead đánh dấu đã đọc cho tất cả thông báo.
//   5. addOrUpdateRealtimeNotification chèn thông báo realtime vào danh sách cục bộ.
// Mối quan hệ:
//   - Phụ thuộc: ApiClient, AppLogger, NotificationItem model.
//   - Được sử dụng bởi: NotificationScreen, các widgets Bell Icon.

import 'package:flutter/material.dart';
import '../core/app_logger.dart';
import '../core/api_client.dart';
import '../models/notification.dart';
import '../config/app_config.dart';

class NotificationProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  List<NotificationItem> _notifications = [];
  List<NotificationItem> get notifications => _notifications;

  int _unreadCount = 0;
  int get unreadCount => _unreadCount;

  Map<String, bool> _preferences = {
    'health': true,
    'appointment': true,
    'record': true,
    'chat': true,
    'system': true,
    'security': true,
  };
  Map<String, bool> get preferences => _preferences;

  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  // Tìm nạp danh sách thông báo từ server
  Future<void> fetchNotifications({int limit = 100, int offset = 0}) async {
    _setLoading(true);
    try {
      final response = await _apiClient.get(
        AppConfig.notificationsEndpoint,
        queryParameters: {'limit': limit, 'offset': offset},
      );
      if (response.statusCode == 200) {
        final List<dynamic> list = ApiClient.extractListData(response.data);
        _notifications = list.map((item) => NotificationItem.fromJson(item)).toList();
        
        // Cập nhật số unread dựa trên danh sách hoặc gọi riêng
        _unreadCount = _notifications.where((n) => !n.isRead).length;
        notifyListeners();
      }
    } catch (e) {
      AppLogger.log('Lỗi tìm nạp thông báo: $e');
    } finally {
      _setLoading(false);
    }
  }

  // Lấy số lượng chưa đọc
  Future<void> fetchUnreadCount() async {
    try {
      final response = await _apiClient.get('${AppConfig.notificationsEndpoint}/unread-count');
      if (response.statusCode == 200 && response.data != null) {
        _unreadCount = response.data['count'] ?? 0;
        notifyListeners();
      }
    } catch (e) {
      AppLogger.log('Lỗi lấy số lượng chưa đọc: $e');
    }
  }

  // Đánh dấu đã đọc 1 thông báo
  Future<bool> markAsRead(String notificationId) async {
    try {
      final response = await _apiClient.patch(
        '${AppConfig.notificationsEndpoint}/$notificationId/read',
      );
      if (response.statusCode == 200) {
        final index = _notifications.indexWhere((n) => n.id == notificationId);
        if (index != -1) {
          final old = _notifications[index];
          _notifications[index] = NotificationItem(
            id: old.id,
            userId: old.userId,
            patientId: old.patientId,
            actorId: old.actorId,
            type: old.type,
            category: old.category,
            severity: old.severity,
            title: old.title,
            message: old.message,
            sourceTable: old.sourceTable,
            sourceId: old.sourceId,
            metadata: old.metadata,
            actionUrl: old.actionUrl,
            isRead: true,
            readAt: DateTime.now(),
            createdAt: old.createdAt,
          );
          _unreadCount = _unreadCount > 0 ? _unreadCount - 1 : 0;
          notifyListeners();
        }
        return true;
      }
      return false;
    } catch (e) {
      AppLogger.log('Lỗi đánh dấu đã đọc thông báo: $e');
      return false;
    }
  }

  // Đánh dấu đã đọc toàn bộ thông báo
  Future<bool> markAllAsRead() async {
    try {
      final response = await _apiClient.patch('${AppConfig.notificationsEndpoint}/read-all');
      if (response.statusCode == 200) {
        _notifications = _notifications.map((n) {
          if (n.isRead) return n;
          return NotificationItem(
            id: n.id,
            userId: n.userId,
            patientId: n.patientId,
            actorId: n.actorId,
            type: n.type,
            category: n.category,
            severity: n.severity,
            title: n.title,
            message: n.message,
            sourceTable: n.sourceTable,
            sourceId: n.sourceId,
            metadata: n.metadata,
            actionUrl: n.actionUrl,
            isRead: true,
            readAt: DateTime.now(),
            createdAt: n.createdAt,
          );
        }).toList();
        _unreadCount = 0;
        notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      AppLogger.log('Lỗi đánh dấu đã đọc tất cả: $e');
      return false;
    }
  }

  // Lấy tùy chọn preferences
  Future<void> fetchPreferences() async {
    try {
      final response = await _apiClient.get('${AppConfig.notificationsEndpoint}/preferences');
      if (response.statusCode == 200 && response.data != null) {
        _preferences = Map<String, bool>.from(response.data);
        notifyListeners();
      }
    } catch (e) {
      AppLogger.log('Lỗi lấy tuỳ chọn thông báo: $e');
    }
  }

  // Cập nhật tùy chọn preferences
  Future<bool> updatePreferences(Map<String, bool> newPrefs) async {
    try {
      final response = await _apiClient.patch(
        '${AppConfig.notificationsEndpoint}/preferences',
        data: newPrefs,
      );
      if (response.statusCode == 200 && response.data != null) {
        _preferences = Map<String, bool>.from(response.data);
        notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      AppLogger.log('Lỗi cập nhật tuỳ chọn thông báo: $e');
      return false;
    }
  }

  // Xử lý đẩy thông báo realtime từ WebSocket
  void addOrUpdateRealtimeNotification(Map<String, dynamic> notifJson) {
    try {
      // Hỗ trợ đồng bộ hóa đọc tất cả
      if (notifJson['type'] == 'read_all_sync') {
        _notifications = _notifications.map((n) {
          if (n.isRead) return n;
          return NotificationItem(
            id: n.id,
            userId: n.userId,
            patientId: n.patientId,
            actorId: n.actorId,
            type: n.type,
            category: n.category,
            severity: n.severity,
            title: n.title,
            message: n.message,
            sourceTable: n.sourceTable,
            sourceId: n.sourceId,
            metadata: n.metadata,
            actionUrl: n.actionUrl,
            isRead: true,
            readAt: DateTime.now(),
            createdAt: n.createdAt,
          );
        }).toList();
        _unreadCount = 0;
        notifyListeners();
        return;
      }

      final incoming = NotificationItem.fromJson(notifJson);
      final index = _notifications.indexWhere((n) => n.id == incoming.id);
      
      if (index != -1) {
        _notifications[index] = incoming;
      } else {
        _notifications.insert(0, incoming);
        if (!incoming.isRead) {
          _unreadCount += 1;
        }
      }
      notifyListeners();
    } catch (e) {
      AppLogger.log('Lỗi xử lý thông báo thời gian thực: $e');
    }
  }
}
