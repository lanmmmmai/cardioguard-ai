// Trình khách HTTP API (singleton) được xây dựng trên Dio.
// Quy trình làm việc:
//   1. Phiên bản singleton được cấu hình với URL cơ sở và thời gian chờ từ
//      AppConfig. Trên mỗi yêu cầu, một token JWT động được đính kèm
//      từ SecureStorage.
//   2. Bộ chặn phản hồi bắt các lỗi 401, xóa phiên,
//      và gọi onUnauthorized để buộc chuyển hướng đăng xuất.
//   3. Hiển thị các phương thức đã được định kiểu (get, post, put, patch, delete) bao bọc
//      các lời gọi Dio và ghi lại lỗi thông qua AppLogger.
// Mối quan hệ:
//   - Phụ thuộc vào: AppConfig, SecureStorage, AppLogger
//   - Được tiêu thụ bởi tất cả các lớp provider để giao tiếp với máy chủ.
import 'package:flutter/foundation.dart';
import 'app_logger.dart';
import 'package:dio/dio.dart';
import '../config/app_config.dart';
import 'secure_storage.dart';

class ApiClient {
  // Phiên bản nội bộ singleton.
  static final ApiClient _instance = ApiClient._internal();

  // Trả về phiên bản singleton ApiClient.
  factory ApiClient() => _instance;

  // Chuẩn hóa phản hồi danh sách từ backend.
  // Hỗ trợ cả dạng mảng trực tiếp lẫn envelope phân trang { items, total, ... }.
  static List<dynamic> extractListData(dynamic data) {
    if (data is List<dynamic>) {
      return data;
    }
    if (data is Map<String, dynamic>) {
      final items = data['items'];
      if (items is List<dynamic>) {
        return items;
      }
    }
    throw Exception(
        'Dữ liệu trả về phải là một danh sách hoặc chứa trường items');
  }

  // Trình khách HTTP Dio bên dưới.
  late final Dio dio;

  // Callback được gọi khi nhận được phản hồi 401 Unauthorized,
  // được sử dụng để kích hoạt đăng xuất im lặng từ AuthProvider.
  VoidCallback? _onUnauthorized;

  // Hàm tạo riêng tư cấu hình Dio với các tùy chọn cơ sở, thời gian chờ,
  // và các bộ chặn JWT/xác thực.
  ApiClient._internal() {
    dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.baseUrl,
        connectTimeout:
            const Duration(milliseconds: AppConfig.connectTimeoutMs),
        receiveTimeout:
            const Duration(milliseconds: AppConfig.receiveTimeoutMs),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    // Bộ chặn: đính kèm JWT khi yêu cầu; xử lý 401 khi có lỗi
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // Lấy token động từ bộ nhớ an toàn
          final token = await SecureStorage().getToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException e, handler) async {
          // Kiểm tra lỗi 401 Unauthorized
          if (e.response?.statusCode == 401) {
            AppLogger.log('Phiên hết hạn (401 Unauthorized)');
            // Xóa thông tin xác thực trong nền
            await SecureStorage().clearSession();
            // Kích hoạt chuyển hướng đăng xuất nếu callback đã được đăng ký
            if (_onUnauthorized != null) {
              _onUnauthorized!();
            }
          }
          return handler.next(e);
        },
      ),
    );
  }

  void setOnUnauthorized(VoidCallback? callback) {
    _onUnauthorized = callback;
  }

  // Gửi yêu cầu HTTP GET đến path đã cho.
  Future<Response> get(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await dio.get(path,
          queryParameters: queryParameters, options: options);
    } on DioException catch (e) {
      _handleDioError(e);
      rethrow;
    }
  }

  // Gửi yêu cầu HTTP POST đến path đã cho với phần thân data tùy chọn.
  Future<Response> post(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await dio.post(path,
          data: data, queryParameters: queryParameters, options: options);
    } on DioException catch (e) {
      _handleDioError(e);
      rethrow;
    }
  }

  // Gửi yêu cầu HTTP PUT đến path đã cho với phần thân data tùy chọn.
  Future<Response> put(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await dio.put(path,
          data: data, queryParameters: queryParameters, options: options);
    } on DioException catch (e) {
      _handleDioError(e);
      rethrow;
    }
  }

  // Gửi yêu cầu HTTP PATCH đến path đã cho với phần thân data tùy chọn.
  Future<Response> patch(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await dio.patch(path,
          data: data, queryParameters: queryParameters, options: options);
    } on DioException catch (e) {
      _handleDioError(e);
      rethrow;
    }
  }

  // Gửi yêu cầu HTTP DELETE đến path đã cho với phần thân data tùy chọn.
  Future<Response> delete(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await dio.delete(path,
          data: data, queryParameters: queryParameters, options: options);
    } on DioException catch (e) {
      _handleDioError(e);
      rethrow;
    }
  }

  // Ghi lại thông báo lỗi thân thiện bằng tiếng Việt dựa trên loại DioException.
  void _handleDioError(DioException error) {
    String message = '';
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
        message = 'Kết nối mạng hết hạn (Connection Timeout).';
        break;
      case DioExceptionType.sendTimeout:
        message = 'Gửi dữ liệu hết hạn (Send Timeout).';
        break;
      case DioExceptionType.receiveTimeout:
        message = 'Nhận dữ liệu hết hạn (Receive Timeout).';
        break;
      case DioExceptionType.badResponse:
        message =
            'Máy chủ phản hồi lỗi: ${error.response?.statusCode} - ${error.response?.data}';
        break;
      case DioExceptionType.cancel:
        message = 'Yêu cầu bị hủy (Request cancelled).';
        break;
      case DioExceptionType.connectionError:
        message = 'Không có kết nối mạng. Vui lòng kiểm tra lại thiết bị.';
        break;
      default:
        message = 'Đã xảy ra lỗi không xác định.';
        break;
    }
    AppLogger.log('[Dio API Client Error] $message');
  }
}
