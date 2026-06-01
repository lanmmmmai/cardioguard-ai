import 'package:flutter/material.dart';
import '../core/app_logger.dart';
import '../core/api_client.dart';
import '../core/secure_storage.dart';
import '../models/models.dart';
import '../config/app_config.dart';

class AuthProvider extends ChangeNotifier {
  final ApiClient _apiClient = ApiClient();
  final SecureStorage _secureStorage = SecureStorage();

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  User? _currentUser;
  User? get currentUser => _currentUser;

  bool _isAuthenticated = false;
  bool get isAuthenticated => _isAuthenticated;

  // Initialize and register 401 callback
  void init() {
    ApiClient.onUnauthorized = () {
      _logoutSilent();
    };
  }

  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  void _setError(String? message) {
    _errorMessage = message;
    notifyListeners();
  }

  // Request Registration OTP
  Future<bool> requestRegisterOtp(String email, String fullName) async {
    _setLoading(true);
    _setError(null);
    try {
      final response = await _apiClient.post(
        AppConfig.requestOtpEndpoint,
        data: {
          'email': email,
          'full_name': fullName,
        },
      );
      _setLoading(false);
      
      // In development mode, the response may contain the dev_otp key
      if (response.statusCode == 200) {
        final data = response.data;
        if (data != null && data['dev_otp'] != null) {
          AppLogger.log('[DEV MODE] OTP generated: ${data['dev_otp']}');
        }
        return true;
      }
      return false;
    } catch (e) {
      _setLoading(false);
      _setError('Không thể gửi mã OTP. Vui lòng thử lại.');
      return false;
    }
  }

  // Complete Registration with OTP
  Future<bool> registerPatient({
    required String email,
    required String fullName,
    required String password,
    required String otp,
  }) async {
    _setLoading(true);
    _setError(null);
    try {
      final response = await _apiClient.post(
        AppConfig.registerEndpoint,
        data: {
          'email': email,
          'full_name': fullName,
          'password': password,
          'otp': otp,
        },
      );
      _setLoading(false);
      return response.statusCode == 200 || response.statusCode == 201;
    } catch (e) {
      _setLoading(false);
      _setError('Mã OTP không đúng hoặc đã hết hạn.');
      return false;
    }
  }

  // Login
  Future<bool> login(String email, String password) async {
    _setLoading(true);
    _setError(null);
    try {
      final response = await _apiClient.post(
        AppConfig.loginEndpoint,
        data: {
          'email': email,
          'password': password,
        },
      );

      if (response.statusCode == 200) {
        final data = response.data;
        final token = data['access_token'];
        final userJson = data['user'];

        if (token != null && userJson != null) {
          _currentUser = User.fromJson(userJson);
          _isAuthenticated = true;

          // Save to secure storage
          await _secureStorage.saveToken(token);
          await _secureStorage.saveUser(userJson);
          
          _setLoading(false);
          return true;
        }
      }
      _setLoading(false);
      _setError('Email hoặc mật khẩu không hợp lệ.');
      return false;
    } catch (e) {
      _setLoading(false);
      _setError('Lỗi kết nối máy chủ. Vui lòng kiểm tra mạng.');
      return false;
    }
  }

  // Auto-login check
  Future<bool> tryAutoLogin() async {
    _setError(null);
    final token = await _secureStorage.getToken();
    if (token == null) return false;

    try {
      final response = await _apiClient.get(AppConfig.meEndpoint);
      if (response.statusCode == 200) {
        final userJson = response.data['user'];
        if (userJson != null) {
          _currentUser = User.fromJson(userJson);
          _isAuthenticated = true;
          await _secureStorage.saveUser(userJson); // Update profile
          notifyListeners();
          return true;
        }
      }
      return false;
    } catch (e) {
      AppLogger.log('Auto login error: $e');
      // If network fails but token exists, we can still load from cache user
      final cachedUser = await _secureStorage.getUser();
      if (cachedUser != null) {
        _currentUser = User.fromJson(cachedUser);
        _isAuthenticated = true;
        notifyListeners();
        return true;
      }
      return false;
    }
  }

  // Logout
  Future<void> logout() async {
    _setLoading(true);
    try {
      await _secureStorage.clearSession();
      _currentUser = null;
      _isAuthenticated = false;
      _setError(null);
    } catch (e) {
      AppLogger.log('Logout error: $e');
    } finally {
      _setLoading(false);
    }
  }

  // Silent logout on 401
  void _logoutSilent() {
    _currentUser = null;
    _isAuthenticated = false;
    _errorMessage = 'Phiên làm việc hết hạn. Vui lòng đăng nhập lại.';
    notifyListeners();
  }
}

