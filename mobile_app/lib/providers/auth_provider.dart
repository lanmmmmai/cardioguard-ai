// Provider xác thực — đăng nhập, đăng ký, tự động đăng nhập, đăng xuất và
// xử lý hết hạn phiên.
// Quy trình làm việc:
//   1. init đăng ký callback ApiClient.onUnauthorized để đăng xuất im lặng
//      khi nhận phản hồi 401.
//   2. registerPatient và login xác thực với máy chủ và
//      lưu trữ JWT + hồ sơ người dùng qua SecureStorage.
//   3. tryAutoLogin khôi phục phiên từ thông tin xác thực đã lưu khi khởi động
//      ứng dụng.
//   4. logout ngắt kết nối WebSocket, gọi điểm cuối đăng xuất máy chủ,
//      và xóa bộ nhớ an toàn.
// Mối quan hệ:
//   - Phụ thuộc vào: ApiClient, SecureStorage, WebSocketService,
//     AppLogger, User model, AppConfig.
//   - Hiển thị currentUser, isAuthenticated, requiresPasswordChange
//     cho lớp giao diện người dùng và cấu hình tab trong MainTabWrapper.
import 'package:flutter/material.dart';
import '../core/app_logger.dart';
import '../core/api_client.dart';
import '../core/secure_storage.dart';
import '../models/models.dart';
import '../config/app_config.dart';
import '../services/websocket_service.dart';

class AuthProvider extends ChangeNotifier {
  // Phiên bản API client dùng chung.
  final ApiClient _apiClient = ApiClient();

  // Phiên bản bộ nhớ an toàn dùng chung.
  final SecureStorage _secureStorage = SecureStorage();

  bool _isLoading = false;

  // Liệu một yêu cầu mạng có đang được tiến hành hay không.
  bool get isLoading => _isLoading;

  String? _errorMessage;

  // Thông báo lỗi cuối cùng được tạo ra bởi một thao tác xác thực, hoặc null.
  String? get errorMessage => _errorMessage;

  User? _currentUser;

  // Người dùng hiện đã được xác thực, hoặc null nếu chưa đăng nhập.
  User? get currentUser => _currentUser;

  bool _isAuthenticated = false;

  // Liệu một phiên người dùng hợp lệ có tồn tại hay không.
  bool get isAuthenticated => _isAuthenticated;

  // Liệu người dùng hiện tại có phải thay đổi mật khẩu trước khi sử dụng ứng dụng hay không.
  bool get requiresPasswordChange => _currentUser?.mustChangePassword == true;

  // Khởi tạo provider: đăng ký callback 401 unauthorized để
  // phiên được xóa im lặng khi máy chủ từ chối token.
  void init() {
    ApiClient.onUnauthorized = () {
      _logoutSilent();
    };
  }

  // Cập nhật trạng thái tải và thông báo cho listeners.
  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  // Đặt thông báo lỗi và thông báo cho listeners.
  void _setError(String? message) {
    _errorMessage = message;
    notifyListeners();
  }

  // Yêu cầu gửi OTP để đăng ký bệnh nhân.
  // Ở chế độ phát triển, ghi lại OTP từ khóa dev_otp trong phản hồi.
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

      // Ở chế độ phát triển, phản hồi có thể chứa khóa dev_otp
      if (response.statusCode == 200) {
        final data = response.data;
        if (data != null && data['dev_otp'] != null) {
          AppLogger.log('[CHẾ ĐỘ DEV] OTP được tạo: ${data['dev_otp']}');
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

  // Hoàn tất đăng ký bệnh nhân bằng cách gửi OTP, email và mật khẩu.
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

  // Xác thực người dùng với email và password. Khi thành công, lưu
  // JWT và hồ sơ người dùng vào bộ nhớ an toàn. Trả về true nếu đăng nhập
  // thành công.
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

          // Lưu vào bộ nhớ an toàn
          await _secureStorage.saveToken(token);
          await _secureStorage.saveUser(userJson);

          if (_currentUser?.mustChangePassword == true) {
            _setError(
                'Bạn phải đổi mật khẩu trước khi tiếp tục sử dụng hệ thống.');
          }

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

  // Cố gắng khôi phục phiên trước đó bằng token đã lưu.
  // Gọi /auth/me để xác thực token và làm mới hồ sơ người dùng.
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
          await _secureStorage.saveUser(userJson); // Cập nhật hồ sơ
          notifyListeners();
          return true;
        }
      }
      return false;
    } catch (e) {
      AppLogger.log('Lỗi tự động đăng nhập: $e');
      _currentUser = null;
      _isAuthenticated = false;
      _errorMessage =
          'Không thể xác minh phiên đăng nhập. Vui lòng kiểm tra mạng và đăng nhập lại.';
      notifyListeners();
      return false;
    }
  }

  // Thực hiện đăng xuất hoàn toàn: ngắt kết nối WebSocket, gọi điểm cuối đăng xuất
  // máy chủ, xóa bộ nhớ an toàn và đặt lại trạng thái cục bộ.
  Future<void> logout() async {
    _setLoading(true);
    try {
      WebSocketService.disconnect();
      try {
        await _apiClient.post('/auth/logout');
      } catch (e) {
        AppLogger.log('Đăng xuất máy chủ thất bại: $e');
      }
      await _secureStorage.clearSession();
      _currentUser = null;
      _isAuthenticated = false;
      _setError(null);
    } catch (e) {
      AppLogger.log('Lỗi đăng xuất: $e');
    } finally {
      _setLoading(false);
    }
  }

  // Đăng xuất im lặng được kích hoạt bởi phản hồi 401 Unauthorized từ API.
  // Xóa trạng thái phiên mà không gọi điểm cuối đăng xuất máy chủ.
  void _logoutSilent() {
    WebSocketService.disconnect();
    _currentUser = null;
    _isAuthenticated = false;
    _errorMessage = 'Phiên làm việc hết hạn. Vui lòng đăng nhập lại.';
    notifyListeners();
  }
}
