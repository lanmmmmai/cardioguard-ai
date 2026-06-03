// Provider quản lý lịch hẹn — tìm nạp, đặt lịch, cập nhật trạng thái và
// xử lý cập nhật lịch hẹn thời gian thực qua WebSocket.
// Quy trình làm việc:
//   1. fetchAppointments lấy và sắp xếp (theo scheduledAt giảm dần).
//   2. bookAppointment tạo lịch hẹn mới qua POST và chèn vào danh sách.
//   3. updateAppointmentStatus cập nhật trạng thái lịch hẹn (bác sĩ/quản trị viên).
//   4. addOrUpdateRealtimeAppointment xử lý các sự kiện WebSocket đến,
//      ủy quyền cho _addOrUpdateLocal để loại bỏ trùng lặp và sắp xếp.
// Mối quan hệ:
//   - Phụ thuộc vào: ApiClient, AppLogger, Appointment model.
//   - Cập nhật thời gian thực đến qua callbacks của WebSocketService.
import 'package:flutter/material.dart';
import '../core/app_logger.dart';
import '../core/api_client.dart';
import '../models/models.dart';

class AppointmentProvider extends ChangeNotifier {
  // Phiên bản API client dùng chung.
  final ApiClient _apiClient = ApiClient();

  bool _isLoading = false;

  // Liệu một yêu cầu mạng có đang được tiến hành hay không.
  bool get isLoading => _isLoading;

  List<Appointment> _appointments = [];

  // Danh sách lịch hẹn đã sắp xếp (scheduledAt mới nhất ở đầu).
  List<Appointment> get appointments => _appointments;

  // Cập nhật trạng thái tải và thông báo cho listeners.
  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  // Tìm nạp lịch hẹn từ máy chủ và sắp xếp theo scheduledAt giảm dần.
  Future<void> fetchAppointments() async {
    _setLoading(true);
    try {
      final response = await _apiClient.get('/appointments');
      if (response.statusCode == 200) {
        if (response.data is! List) throw Exception("Dữ liệu trả về phải là một danh sách");
        final List<dynamic> list = response.data as List<dynamic>;
        _appointments = list.map((item) => Appointment.fromJson(item)).toList();
        // Sắp xếp ngày hẹn mới nhất ở đầu
        _appointments.sort((a, b) => b.scheduledAt.compareTo(a.scheduledAt));
      }
    } catch (e) {
      AppLogger.log('Lỗi tìm nạp lịch hẹn: $e');
    } finally {
      _setLoading(false);
    }
  }

  // Tạo một lịch hẹn mới qua API và chèn vào danh sách cục bộ.
  Future<bool> bookAppointment({
    required String doctorId,
    required String title,
    required DateTime scheduledAt,
    required String notes,
    String channel = 'offline',
  }) async {
    _setLoading(true);
    try {
      final response = await _apiClient.post(
        '/appointments',
        data: {
          'doctor_id': doctorId,
          'title': title,
          'status': 'pending',
          'channel': channel,
          'scheduled_at': scheduledAt.toIso8601String(),
          'notes': notes,
        },
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        final newAppt = Appointment.fromJson(response.data);
        _addOrUpdateLocal(newAppt);
        _setLoading(false);
        return true;
      }
      _setLoading(false);
      return false;
    } catch (e) {
      AppLogger.log('Lỗi đặt lịch hẹn: $e');
      _setLoading(false);
      return false;
    }
  }

  // Cập nhật trạng thái của một lịch hẹn (thao tác của bác sĩ/quản trị viên).
  Future<bool> updateAppointmentStatus(String appointmentId, String status) async {
    try {
      final response = await _apiClient.patch(
        '/appointments/$appointmentId',
        data: {'status': status},
      );
      if (response.statusCode == 200) {
        final updatedAppt = Appointment.fromJson(response.data);
        _addOrUpdateLocal(updatedAppt);
        return true;
      }
      return false;
    } catch (e) {
      AppLogger.log('Lỗi cập nhật trạng thái lịch hẹn: $e');
      return false;
    }
  }

  // Xử lý một lịch hẹn thời gian thực đến từ WebSocket — ủy quyền
  // cho _addOrUpdateLocal để loại bỏ trùng lặp và sắp xếp.
  void addOrUpdateRealtimeAppointment(Map<String, dynamic> apptJson) {
    try {
      final appt = Appointment.fromJson(apptJson);
      _addOrUpdateLocal(appt);
    } catch (e) {
      AppLogger.log('Lỗi phân tích lịch hẹn thời gian thực: $e');
    }
  }

  // Chèn hoặc cập nhật một lịch hẹn trong danh sách cục bộ và sắp xếp lại.
  void _addOrUpdateLocal(Appointment appt) {
    final index = _appointments.indexWhere((a) => a.id == appt.id);
    if (index != -1) {
      _appointments[index] = appt;
    } else {
      _appointments.insert(0, appt);
    }
    _appointments.sort((a, b) => b.scheduledAt.compareTo(a.scheduledAt));
    notifyListeners();
  }
}
