import 'package:flutter/material.dart';
import '../core/app_logger.dart';
import '../core/api_client.dart';
import '../models/models.dart';
import '../config/app_config.dart';

class PatientProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  List<Patient> _patients = [];
  List<Patient> get patients => _patients;

  Patient? _currentPatientProfile;
  Patient? get currentPatientProfile => _currentPatientProfile;

  // Patient history logs
  List<MedicalRecord> _medicalRecords = [];
  List<MedicalRecord> get medicalRecords => _medicalRecords;

  List<Prescription> _prescriptions = [];
  List<Prescription> get prescriptions => _prescriptions;

  // Real-time telemetry cache for currently monitored patient
  Map<String, dynamic> _liveMetrics = {
    'heart_rate': 75,
    'spo2': 98,
    'systolic_bp': 120,
    'diastolic_bp': 80,
    'ecg_value': 0.0,
    'is_abnormal': false,
  };
  Map<String, dynamic> get liveMetrics => _liveMetrics;

  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  // Fetch list of patients (Doctor/Admin) or returns single list containing the patient themselves
  Future<void> fetchPatients() async {
    _setLoading(true);
    try {
      final response = await _apiClient.get(AppConfig.patientsEndpoint);
      if (response.statusCode == 200) {
        final List<dynamic> list = response.data;
        _patients = list.map((item) => Patient.fromJson(item)).toList();
      }
    } catch (e) {
      AppLogger.log('Fetch patients error: $e');
    } finally {
      _setLoading(false);
    }
  }

  // Fetch profile for the currently logged in patient
  Future<void> fetchMyProfile() async {
    _setLoading(true);
    try {
      final response = await _apiClient.get('/patients/me');
      if (response.statusCode == 200 && response.data['patient'] != null) {
        _currentPatientProfile = Patient.fromJson(response.data['patient']);
      }
    } catch (e) {
      AppLogger.log('Fetch patient profile error: $e');
    } finally {
      _setLoading(false);
    }
  }

  // Update profile for the patient (or create if not exists)
  Future<bool> updateMyProfile({
    required int age,
    required String gender,
    required String phone,
    required String address,
    required String medicalHistory,
  }) async {
    _setLoading(true);
    try {
      final response = await _apiClient.put(
        '/patients/me',
        data: {
          'age': age,
          'gender': gender,
          'phone': phone,
          'address': address,
          'medical_history': medicalHistory,
        },
      );
      if (response.statusCode == 200 && response.data['patient'] != null) {
        _currentPatientProfile = Patient.fromJson(response.data['patient']);
        _setLoading(false);
        return true;
      }
      _setLoading(false);
      return false;
    } catch (e) {
      AppLogger.log('Update patient profile error: $e');
      _setLoading(false);
      return false;
    }
  }

  // Fetch Clinical Records (Medical Records)
  Future<void> fetchMedicalRecords(String patientId) async {
    _setLoading(true);
    try {
      final response = await _apiClient.get('/medical-records', queryParameters: {'patient_id': patientId});
      if (response.statusCode == 200) {
        final List<dynamic> list = response.data;
        _medicalRecords = list.map((item) => MedicalRecord.fromJson(item)).toList();
      }
    } catch (e) {
      AppLogger.log('Fetch medical records error: $e');
    } finally {
      _setLoading(false);
    }
  }

  // Add Medical Record (Doctor)
  Future<bool> addMedicalRecord({
    required String patientId,
    required String type,
    required String diagnosis,
    required String summary,
  }) async {
    _setLoading(true);
    try {
      final response = await _apiClient.post(
        '/medical-records',
        data: {
          'patient_id': patientId,
          'type': type,
          'diagnosis': diagnosis,
          'summary': summary,
        },
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        final newRecord = MedicalRecord.fromJson(response.data);
        _medicalRecords.insert(0, newRecord);
        _setLoading(false);
        return true;
      }
      _setLoading(false);
      return false;
    } catch (e) {
      AppLogger.log('Add medical record error: $e');
      _setLoading(false);
      return false;
    }
  }

  // Fetch Prescriptions
  Future<void> fetchPrescriptions(String patientId) async {
    _setLoading(true);
    try {
      final response = await _apiClient.get('/prescriptions', queryParameters: {'patient_id': patientId});
      if (response.statusCode == 200) {
        final List<dynamic> list = response.data;
        _prescriptions = list.map((item) => Prescription.fromJson(item)).toList();
      }
    } catch (e) {
      AppLogger.log('Fetch prescriptions error: $e');
    } finally {
      _setLoading(false);
    }
  }

  // Add Prescription (Doctor)
  Future<bool> addPrescription({
    required String patientId,
    required String medicationName,
    required String dosage,
    required String frequency,
    required String instructions,
  }) async {
    _setLoading(true);
    try {
      final response = await _apiClient.post(
        '/prescriptions',
        data: {
          'patient_id': patientId,
          'medication_name': medicationName,
          'dosage': dosage,
          'frequency': frequency,
          'instructions': instructions,
          'status': 'active',
        },
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        final newPresc = Prescription.fromJson(response.data);
        _prescriptions.insert(0, newPresc);
        _setLoading(false);
        return true;
      }
      _setLoading(false);
      return false;
    } catch (e) {
      AppLogger.log('Add prescription error: $e');
      _setLoading(false);
      return false;
    }
  }

  // Update Live Vitals Cache (called from WebSocket)
  void updateLiveMetrics(Map<String, dynamic> metrics) {
    _liveMetrics = {
      'heart_rate': metrics['heart_rate'] ?? _liveMetrics['heart_rate'],
      'spo2': metrics['spo2'] ?? _liveMetrics['spo2'],
      'systolic_bp': metrics['systolic_bp'] ?? _liveMetrics['systolic_bp'],
      'diastolic_bp': metrics['diastolic_bp'] ?? _liveMetrics['diastolic_bp'],
      'ecg_value': metrics['ecg_value'] is num ? (metrics['ecg_value'] as num).toDouble() : _liveMetrics['ecg_value'],
      'is_abnormal': metrics['is_abnormal'] ?? _liveMetrics['is_abnormal'],
    };
    notifyListeners();
  }

  // Trigger simulation normal / abnormal (Doctor/Admin testing)
  Future<bool> triggerSimulation(String patientId, bool isAbnormal) async {
    try {
      // POST to /sensor-data
      final response = await _apiClient.post(
        '/sensor-data',
        data: {
          'patient_id': patientId,
          'heart_rate': isAbnormal ? 135 : 72,
          'spo2': isAbnormal ? 89 : 98,
          'systolic_bp': isAbnormal ? 150 : 120,
          'diastolic_bp': isAbnormal ? 95 : 80,
          'ecg_value': 0.1,
        },
      );
      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      AppLogger.log('Trigger simulation error: $e');
      return false;
    }
  }
}

