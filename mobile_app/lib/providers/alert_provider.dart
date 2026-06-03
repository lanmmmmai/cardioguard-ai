// Provider quản lý cảnh báo bệnh nhân — tìm nạp, giải quyết, kích hoạt SOS và
// xử lý cập nhật cảnh báo thời gian thực qua WebSocket.
// Quy trình làm việc:
//   1. fetchAlerts lấy danh sách cảnh báo từ máy chủ.
//   2. resolveAlert đánh dấu cảnh báo đã được giải quyết qua PATCH và cập nhật trạng thái
//      cục bộ.
//   3. triggerSosAlert gửi một thông báo SOS mới, chèn kết quả vào
//      đầu danh sách cục bộ.
//   4. addOrUpdateRealtimeAlert xử lý các sự kiện WebSocket đến,
//      chèn hoặc cập nhật cảnh báo tại chỗ.
// Mối quan hệ:
//   - Phụ thuộc vào: ApiClient, AppLogger, Alert model.
//   - Hiển thị activeAlertCount cho hiển thị huy hiệu/thông báo trong giao diện người dùng.
import 'package:flutter/material.dart';
import '../core/app_logger.dart';
import '../core/api_client.dart';
import '../models/models.dart';
import '../config/app_config.dart';

class AlertProvider extends ChangeNotifier {
  // Phiên bản API client dùng chung.
  final ApiClient _apiClient = ApiClient();

  bool _isLoading = false;

  // Liệu một yêu cầu mạng có đang được tiến hành hay không.
  bool get isLoading => _isLoading;

  List<Alert> _alerts = [];

  // Danh sách đầy đủ các cảnh báo (cảnh báo mới nhất ở đầu sau khi chèn).
  List<Alert> get alerts => _alerts;

  // Số lượng cảnh báo chưa được giải quyết.
  int get activeAlertCount => _alerts.where((a) => !a.isResolved).length;

  // Cập nhật trạng thái tải và thông báo cho listeners.
  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  // Tìm nạp danh sách đầy đủ các cảnh báo từ máy chủ và thay thế trạng thái cục bộ.
  Future<void> fetchAlerts() async {
    _setLoading(true);
    try {
      final response = await _apiClient.get(AppConfig.alertsEndpoint);
      if (response.statusCode == 200) {
        if (response.data is! List) throw Exception("Dữ liệu trả về phải là một danh sách");
        final List<dynamic> list = response.data as List<dynamic>;
        _alerts = list.map((item) => Alert.fromJson(item)).toList();
      }
    } catch (e) {
      AppLogger.log('Lỗi tìm nạp cảnh báo: $e');
    } finally {
      _setLoading(false);
    }
  }

  // Đánh dấu một cảnh báo đã được giải quyết trên máy chủ và cập nhật trạng thái cục bộ.
  Future<bool> resolveAlert(String alertId) async {
    try {
      final response = await _apiClient.patch('/alerts/$alertId/resolve');
      if (response.statusCode == 200) {
        // Cập nhật danh sách cục bộ
        final index = _alerts.indexWhere((a) => a.id == alertId);
        if (index != -1) {
          final oldAlert = _alerts[index];
          _alerts[index] = Alert(
            id: oldAlert.id,
            patientId: oldAlert.patientId,
            fullName: oldAlert.fullName,
            alertType: oldAlert.alertType,
            message: oldAlert.message,
            severity: oldAlert.severity,
            isResolved: true,
            createdAt: oldAlert.createdAt,
          );
          notifyListeners();
        }
        return true;
      }
      return false;
    } catch (e) {
      AppLogger.log('Lỗi giải quyết cảnh báo: $e');
      return false;
    }
  }

  // Gửi một cảnh báo SOS mới cho bệnh nhân hiện tại; chèn kết quả khi thành công.
  Future<bool> triggerSosAlert(String message) async {
    try {
      final response = await _apiClient.post(
        AppConfig.alertsEndpoint,
        data: {'message': message},
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        final newAlert = Alert.fromJson(response.data);
        _alerts.insert(0, newAlert);
        notifyListeners();
        return true;
      }
      return false;
    } catch (e) {
      AppLogger.log('Lỗi kích hoạt SOS: $e');
      return false;
    }
  }

  // Xử lý một cảnh báo thời gian thực đến từ WebSocket — chèn mới hoặc
  // cập nhật cảnh báo hiện có trong danh sách cục bộ.
  void addOrUpdateRealtimeAlert(Map<String, dynamic> alertJson) {
    try {
      final incomingAlert = Alert.fromJson(alertJson);
      final index = _alerts.indexWhere((a) => a.id == incomingAlert.id);
      if (index != -1) {
        _alerts[index] = incomingAlert;
      } else {
        _alerts.insert(0, incomingAlert);
      }
      notifyListeners();
    } catch (e) {
      AppLogger.log('Lỗi xử lý cảnh báo thời gian thực: $e');
    }
  }
}
