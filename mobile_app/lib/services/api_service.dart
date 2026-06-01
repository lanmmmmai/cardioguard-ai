import 'dart:convert';
import 'dart:math' as math;
import 'package:http/http.dart' as http;

class ApiService {
  // Use production Render URL instead of local URL
  static String baseUrl = 'https://cardioguard-ai-1-27vd.onrender.com'; 
  static String? token;
  static Map<String, dynamic>? currentUser;

  static void setBaseUrl(String url) {
    baseUrl = url;
  }

  static Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (token != null) 'Authorization': 'Bearer $token',
  };

  // Auth: Login
  static Future<bool> login(String email, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'email': email,
          'password': password,
        }),
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        token = data['access_token'];
        final user = data['user'] ?? {};
        currentUser = {
          'email': user['email'] ?? email,
          'full_name': user['full_name'] ?? email.split('@')[0],
          'role': user['role'] ?? 'patient',
        };
        return true;
      }
      return false;
    } catch (e) {
      print('Login error: $e');
      return false;
    }
  }

  // Auth: Register
  static Future<bool> register(String email, String fullName, String password, String role) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/register'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({
          'email': email,
          'full_name': fullName,
          'password': password,
          'role': role,
        }),
      );
      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      print('Register error: $e');
      return false;
    }
  }

  // Get Patients List
  static Future<List<dynamic>> getPatients() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/patients'),
        headers: _headers,
      );
      if (response.statusCode == 200) {
        return json.decode(utf8.decode(response.bodyBytes));
      }
      return [];
    } catch (e) {
      print('Fetch patients error: $e');
      return [];
    }
  }

  // Add Patient
  static Future<bool> addPatient(
    String fullName,
    int age,
    String gender,
    String phone,
    String address,
    String medicalHistory,
  ) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/patients'),
        headers: _headers,
        body: json.encode({
          'full_name': fullName,
          'age': age,
          'gender': gender,
          'phone': phone,
          'address': address,
          'medical_history': medicalHistory,
        }),
      );
      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      print('Add patient error: $e');
      return false;
    }
  }

  // Get Alerts List
  static Future<List<dynamic>> getAlerts() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/alerts'),
        headers: _headers,
      );
      if (response.statusCode == 200) {
        return json.decode(utf8.decode(response.bodyBytes));
      }
      return [];
    } catch (e) {
      print('Fetch alerts error: $e');
      return [];
    }
  }

  // Trigger Telemetry Simulator (Normal / Abnormal)
  static Future<bool> triggerSimulation(String patientId, bool isAbnormal) async {
    try {
      final rand = math.Random();
      int hr = rand.nextInt(40) + 60; // 60 - 100 normal
      int o2 = rand.nextInt(5) + 95;  // 95 - 100 normal
      int sys = rand.nextInt(25) + 110; // 110 - 135 normal
      int dia = rand.nextInt(15) + 70;  // 70 - 85 normal
      double ecg = (rand.nextDouble() - 0.5) * 0.3;

      if (isAbnormal) {
        final randType = rand.nextDouble();
        if (randType < 0.33) {
          hr = rand.nextBool() ? 135 : 45; // high/low heart rate
        } else if (randType < 0.66) {
          o2 = rand.nextInt(6) + 85; // 85 - 91 low oxygen
        } else {
          sys = 155; // high blood pressure
          dia = 95;
        }
      }

      final response = await http.post(
        Uri.parse('$baseUrl/sensor-data'),
        headers: _headers,
        body: json.encode({
          'patient_id': patientId,
          'heart_rate': hr,
          'spo2': o2,
          'systolic_bp': sys,
          'diastolic_bp': dia,
          'ecg_value': ecg,
        }),
      );
      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      print('Trigger simulation error: $e');
      return false;
    }
  }
}
