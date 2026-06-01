import 'package:flutter/material.dart';
import '../core/app_logger.dart';
import '../core/api_client.dart';
import '../models/models.dart';
import '../config/app_config.dart';

class AlertProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  List<Alert> _alerts = [];
  List<Alert> get alerts => _alerts;

  // Real-time unread/unresolved alert count
  int get activeAlertCount => _alerts.where((a) => !a.isResolved).length;

  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  // Fetch alerts
  Future<void> fetchAlerts() async {
    _setLoading(true);
    try {
      final response = await _apiClient.get(AppConfig.alertsEndpoint);
      if (response.statusCode == 200) {
        final List<dynamic> list = response.data;
        _alerts = list.map((item) => Alert.fromJson(item)).toList();
      }
    } catch (e) {
      AppLogger.log('Fetch alerts error: $e');
    } finally {
      _setLoading(false);
    }
  }

  // Resolve alert
  Future<bool> resolveAlert(String alertId) async {
    try {
      final response = await _apiClient.patch('/alerts/$alertId/resolve');
      if (response.statusCode == 200) {
        // Update local list
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
      AppLogger.log('Resolve alert error: $e');
      return false;
    }
  }

  // Trigger SOS alert (Patient)
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
      AppLogger.log('Trigger SOS error: $e');
      return false;
    }
  }

  // Update list with a real-time WebSocket alert (Insert or Update if exists)
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
      AppLogger.log('Error handling realtime alert: $e');
    }
  }
}

