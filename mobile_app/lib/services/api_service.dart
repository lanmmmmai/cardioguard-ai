import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiService {
  // Use 10.0.2.2 for Android emulator to access localhost of host machine, or localhost for web/iOS
  static String baseUrl = 'http://10.0.2.2:8000'; 
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
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: {
          'username': email, // OAuth2 Password flow uses 'username'
          'password': password,
        },
      );

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        token = data['access_token'];
        currentUser = {
          'email': email,
          'full_name': data['full_name'] ?? email.split('@')[0],
          'role': data['role'] ?? 'Nhân viên y tế',
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
      final endpoint = isAbnormal ? 'abnormal' : 'normal';
      final response = await http.post(
        Uri.parse('$baseUrl/sensor/$patientId/$endpoint'),
        headers: _headers,
      );
      return response.statusCode == 200;
    } catch (e) {
      print('Trigger simulation error: $e');
      return false;
    }
  }
}
