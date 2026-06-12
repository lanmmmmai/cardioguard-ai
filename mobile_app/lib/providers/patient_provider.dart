// Provider dữ liệu bệnh nhân — danh sách, hồ sơ, hồ sơ bệnh án, đơn thuốc,
// telemetry trực tiếp và mô phỏng cảm biến.
// Quy trình làm việc:
//   1. fetchPatients lấy danh sách bệnh nhân (quản trị viên/bác sĩ) hoặc
//      hồ sơ tự thân (bệnh nhân). fetchMyProfile lấy hồ sơ người dùng đã đăng nhập.
//   2. updateMyProfile tạo hoặc cập nhật hồ sơ của chính bệnh nhân.
//   3. fetchMedicalRecords / addMedicalRecord và fetchPrescriptions
//      / addPrescription quản lý dữ liệu lâm sàng theo từng bệnh nhân.
//   4. updateLiveMetrics lưu trữ đệm các chỉ số sinh tồn thời gian thực từ sự kiện WebSocket.
//   5. triggerSimulation đăng các kết quả đọc cảm biến thử nghiệm (quản trị viên/bác sĩ).
// Mối quan hệ:
//   - Phụ thuộc vào: ApiClient, AppLogger, Patient, MedicalRecord,
//     Prescription models, AppConfig.
//   - liveMetrics được cập nhật từ callbacks của WebSocketService và điều khiển
//     hiển thị bảng điều khiển thời gian thực.
import 'package:flutter/material.dart';
import '../core/app_logger.dart';
import '../core/api_client.dart';
import '../models/models.dart';
import '../config/app_config.dart';

class PatientProvider extends ChangeNotifier {
  // Phiên bản API client dùng chung.
  final ApiClient _apiClient = ApiClient();

  bool _isLoading = false;

  // Liệu một yêu cầu mạng có đang được tiến hành hay không.
  bool get isLoading => _isLoading;

  List<Patient> _patients = [];

  // Danh sách bệnh nhân (quản trị viên/bác sĩ) hoặc mục tự thân (bệnh nhân).
  List<Patient> get patients => _patients;

  Patient? _currentPatientProfile;

  // Hồ sơ của bệnh nhân hiện đang đăng nhập (nếu vai trò là bệnh nhân).
  Patient? get currentPatientProfile => _currentPatientProfile;

  Device? _pairedDevice;

  // Thiết bị IoT đã liên kết với bệnh nhân hiện tại.
  Device? get pairedDevice => _pairedDevice;

  bool _isLoadingDevice = false;

  // Trạng thái đang tải thông tin thiết bị.
  bool get isLoadingDevice => _isLoadingDevice;

  void _setLoadingDevice(bool loading) {
    _isLoadingDevice = loading;
    notifyListeners();
  }

  List<MedicalRecord> _medicalRecords = [];

  // Hồ sơ bệnh án lâm sàng cho bệnh nhân đã chọn.
  List<MedicalRecord> get medicalRecords => _medicalRecords;

  List<Prescription> _prescriptions = [];

  // Đơn thuốc cho bệnh nhân đã chọn.
  List<Prescription> get prescriptions => _prescriptions;

  // Bộ đệm telemetry thời gian thực cho bệnh nhân đang được theo dõi, được cập nhật
  // qua các sự kiện WebSocket. Mặc định là các giá trị nghỉ ngơi bình thường.
  Map<String, dynamic> _liveMetrics = {
    'heart_rate': 75,
    'spo2': 98,
    'systolic_bp': 120,
    'diastolic_bp': 80,
    'ecg_value': 0.0,
    'is_abnormal': false,
  };

  // Các chỉ số sinh tồn trực tiếp mới nhất.
  Map<String, dynamic> get liveMetrics => _liveMetrics;

  // Cập nhật trạng thái tải và thông báo cho listeners.
  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  // Tìm nạp danh sách bệnh nhân (quản trị viên/bác sĩ) hoặc mục tự thân (bệnh nhân).
  Future<void> fetchPatients() async {
    _setLoading(true);
    try {
      final response = await _apiClient.get(AppConfig.patientsEndpoint);
      if (response.statusCode == 200) {
        final List<dynamic> list = ApiClient.extractListData(response.data);
        _patients = list.map((item) => Patient.fromJson(item)).toList();
      }
    } catch (e) {
      AppLogger.log('Lỗi tìm nạp bệnh nhân: $e');
    } finally {
      _setLoading(false);
    }
  }

  // Tìm nạp hồ sơ cho bệnh nhân hiện đang đăng nhập.
  Future<void> fetchMyProfile() async {
    _setLoading(true);
    try {
      final response = await _apiClient.get('/patients/me');
      if (response.statusCode == 200 && response.data['patient'] != null) {
        _currentPatientProfile = Patient.fromJson(response.data['patient']);
      }
    } catch (e) {
      AppLogger.log('Lỗi tìm nạp hồ sơ bệnh nhân: $e');
    } finally {
      _setLoading(false);
    }
  }

  // Tạo hoặc cập nhật hồ sơ nhân khẩu học của bệnh nhân đã đăng nhập.
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
      AppLogger.log('Lỗi cập nhật hồ sơ bệnh nhân: $e');
      _setLoading(false);
      return false;
    }
  }

  // Tìm nạp hồ sơ bệnh án cho patientId đã cho.
  Future<void> fetchMedicalRecords(String patientId) async {
    _setLoading(true);
    try {
      final response = await _apiClient
          .get('/medical-records', queryParameters: {'patient_id': patientId});
      if (response.statusCode == 200) {
        final List<dynamic> list = ApiClient.extractListData(response.data);
        _medicalRecords =
            list.map((item) => MedicalRecord.fromJson(item)).toList();
      }
    } catch (e) {
      AppLogger.log('Lỗi tìm nạp hồ sơ bệnh án: $e');
    } finally {
      _setLoading(false);
    }
  }

  // Thêm một hồ sơ bệnh án mới cho bệnh nhân (thao tác của bác sĩ).
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
      AppLogger.log('Lỗi thêm hồ sơ bệnh án: $e');
      _setLoading(false);
      return false;
    }
  }

  // Tìm nạp đơn thuốc cho patientId đã cho.
  Future<void> fetchPrescriptions(String patientId) async {
    _setLoading(true);
    try {
      final response = await _apiClient
          .get('/prescriptions', queryParameters: {'patient_id': patientId});
      if (response.statusCode == 200) {
        final List<dynamic> list = ApiClient.extractListData(response.data);
        _prescriptions =
            list.map((item) => Prescription.fromJson(item)).toList();
      }
    } catch (e) {
      AppLogger.log('Lỗi tìm nạp đơn thuốc: $e');
    } finally {
      _setLoading(false);
    }
  }

  // Thêm một đơn thuốc mới cho bệnh nhân (thao tác của bác sĩ).
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
      AppLogger.log('Lỗi thêm đơn thuốc: $e');
      _setLoading(false);
      return false;
    }
  }

  // Cập nhật các chỉ số sinh tồn trực tiếp đã lưu trong bộ đệm từ một sự kiện WebSocket.
  // Dự phòng về giá trị trước đó cho bất kỳ trường nào bị thiếu.
  void updateLiveMetrics(Map<String, dynamic> metrics) {
    _liveMetrics = {
      'heart_rate': metrics['heart_rate'] ?? _liveMetrics['heart_rate'],
      'spo2': metrics['spo2'] ?? _liveMetrics['spo2'],
      'systolic_bp': metrics['systolic_bp'] ?? _liveMetrics['systolic_bp'],
      'diastolic_bp': metrics['diastolic_bp'] ?? _liveMetrics['diastolic_bp'],
      'ecg_value': metrics['ecg_value'] is num
          ? (metrics['ecg_value'] as num).toDouble()
          : _liveMetrics['ecg_value'],
      'is_abnormal': metrics['is_abnormal'] ?? _liveMetrics['is_abnormal'],
    };
    notifyListeners();
  }

  // Đăng dữ liệu cảm biến mô phỏng để thử nghiệm (bác sĩ/quản trị viên). Khi isAbnormal
  // là true, các giá trị bắt chước một sự kiện nguy kịch; nếu không thì các chỉ số sinh tồn nghỉ ngơi bình thường.
  Future<bool> triggerSimulation(String patientId, bool isAbnormal) async {
    try {
      // POST đến /sensor-data
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
      AppLogger.log('Lỗi kích hoạt mô phỏng: $e');
      return false;
    }
  }

  Future<void> fetchLatestSensorData(String patientId) async {
    try {
      final response = await _apiClient.get('/sensor-data', queryParameters: {
        'patient_id': patientId,
        'limit': 1,
      });
      if (response.statusCode == 200) {
        final List<dynamic> list = ApiClient.extractListData(response.data);
        if (list.isEmpty) {
          return;
        }
        final latest = list[0] as Map<String, dynamic>;
        _liveMetrics = {
          'heart_rate':
              latest['heart_rate'] ?? _liveMetrics['heart_rate'] ?? 75,
          'spo2': latest['spo2'] ?? _liveMetrics['spo2'] ?? 98,
          'systolic_bp':
              latest['systolic_bp'] ?? _liveMetrics['systolic_bp'] ?? 120,
          'diastolic_bp':
              latest['diastolic_bp'] ?? _liveMetrics['diastolic_bp'] ?? 80,
          'ecg_value': latest['ecg_value'] is num
              ? (latest['ecg_value'] as num).toDouble()
              : 0.0,
          'is_abnormal': latest['is_abnormal'] ?? false,
        };
        notifyListeners();
      }
    } catch (e) {
      AppLogger.log('Fetch latest sensor data error: $e');
    }
  }

  List<Map<String, dynamic>> _sensorHistory = [];
  List<Map<String, dynamic>> get sensorHistory => _sensorHistory;

  Future<void> fetchSensorHistory(String patientId) async {
    try {
      final response = await _apiClient.get('/sensor-data', queryParameters: {
        'patient_id': patientId,
        'limit': 30,
      });
      if (response.statusCode == 200) {
        final List<dynamic> list = ApiClient.extractListData(response.data);
        _sensorHistory =
            list.map((item) => item as Map<String, dynamic>).toList();
        notifyListeners();
      }
    } catch (e) {
      AppLogger.log('Fetch sensor history error: $e');
    }
  }

  Future<void> fetchPairedDevice(String currentUserId) async {
    _setLoadingDevice(true);
    try {
      final response = await _apiClient.get('/devices');
      if (response.statusCode == 200) {
        final List<dynamic> list = ApiClient.extractListData(response.data);
        Device? foundDevice;
        for (var item in list) {
          if (item is Map<String, dynamic> &&
              item['patient_id']?.toString() == currentUserId &&
              item['device_mac'] != null) {
            foundDevice = Device.fromJson(item);
            break;
          }
        }
        _pairedDevice = foundDevice;
      }
    } catch (e) {
      AppLogger.log('Lỗi tìm nạp thiết bị đã liên kết: $e');
      _pairedDevice = null;
    } finally {
      _setLoadingDevice(false);
    }
  }

  Future<Map<String, dynamic>> claimDevice({
    required String deviceMac,
    String? deviceName,
  }) async {
    _setLoadingDevice(true);
    try {
      final response = await _apiClient.post(
        '/iot/devices/claim',
        data: {
          'device_mac': deviceMac,
          if (deviceName != null && deviceName.isNotEmpty)
            'device_name': deviceName,
        },
      );
      if (response.statusCode == 200 && response.data != null) {
        final responseData = response.data as Map<String, dynamic>;
        if (responseData['device'] != null) {
          _pairedDevice = Device.fromJson(responseData['device']);
        }
        _setLoadingDevice(false);
        return {
          'success': true,
          'message': responseData['message'] ?? 'Liên kết thiết bị thành công',
        };
      }
      _setLoadingDevice(false);
      return {'success': false, 'message': 'Liên kết thiết bị thất bại'};
    } catch (e) {
      AppLogger.log('Lỗi liên kết thiết bị: $e');
      _setLoadingDevice(false);
      String errMsg = 'Lỗi kết nối máy chủ';
      if (e is Exception) {
        errMsg = e.toString().replaceAll('Exception: ', '');
      }
      return {'success': false, 'message': errMsg};
    }
  }

  Future<Map<String, dynamic>> unclaimDevice({
    required String deviceMac,
  }) async {
    _setLoadingDevice(true);
    try {
      final response = await _apiClient.post(
        '/iot/devices/unclaim',
        data: {
          'device_mac': deviceMac,
        },
      );
      if (response.statusCode == 200) {
        _pairedDevice = null;
        _setLoadingDevice(false);
        return {
          'success': true,
          'message': response.data['message'] ?? 'Hủy liên kết thiết bị thành công',
        };
      }
      _setLoadingDevice(false);
      return {'success': false, 'message': 'Hủy liên kết thiết bị thất bại'};
    } catch (e) {
      AppLogger.log('Lỗi hủy liên kết thiết bị: $e');
      _setLoadingDevice(false);
      String errMsg = 'Lỗi kết nối máy chủ';
      if (e is Exception) {
        errMsg = e.toString().replaceAll('Exception: ', '');
      }
      return {'success': false, 'message': errMsg};
    }
  }
}
