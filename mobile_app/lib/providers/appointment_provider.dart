import 'package:flutter/material.dart';
import '../core/api_client.dart';
import '../models/models.dart';

class AppointmentProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  List<Appointment> _appointments = [];
  List<Appointment> get appointments => _appointments;

  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  // Fetch appointments list
  Future<void> fetchAppointments() async {
    _setLoading(true);
    try {
      final response = await _apiClient.get('/appointments');
      if (response.statusCode == 200) {
        final List<dynamic> list = response.data;
        _appointments = list.map((item) => Appointment.fromJson(item)).toList();
        // Sort newest scheduled date first
        _appointments.sort((a, b) => b.scheduledAt.compareTo(a.scheduledAt));
      }
    } catch (e) {
      print('Fetch appointments error: $e');
    } finally {
      _setLoading(false);
    }
  }

  // Book appointment (Patient)
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
      print('Book appointment error: $e');
      _setLoading(false);
      return false;
    }
  }

  // Update appointment status (Doctor/Admin)
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
      print('Update appointment status error: $e');
      return false;
    }
  }

  // Handle WebSocket updates
  void addOrUpdateRealtimeAppointment(Map<String, dynamic> apptJson) {
    try {
      final appt = Appointment.fromJson(apptJson);
      _addOrUpdateLocal(appt);
    } catch (e) {
      print('Error parsing realtime appointment: $e');
    }
  }

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
