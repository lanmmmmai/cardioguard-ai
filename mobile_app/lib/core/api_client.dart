import 'package:flutter/foundation.dart';
import 'app_logger.dart';
import 'package:dio/dio.dart';
import '../config/app_config.dart';
import 'secure_storage.dart';

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;
  late final Dio dio;

  // Callback to handle 401 unauthorized session expiration
  static VoidCallback? onUnauthorized;

  ApiClient._internal() {
    dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.baseUrl,
        connectTimeout: const Duration(milliseconds: AppConfig.connectTimeoutMs),
        receiveTimeout: const Duration(milliseconds: AppConfig.receiveTimeoutMs),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    // Add JWT Token and Error Interceptors
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // Fetch token dynamically from secure storage
          final token = await SecureStorage().getToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException e, handler) async {
          // Check for 401 Unauthorized
          if (e.response?.statusCode == 401) {
            AppLogger.log('Session expired (401 Unauthorized)');
            // Clear credentials in background
            await SecureStorage().clearSession();
            // Trigger logout redirect if callback registered
            if (onUnauthorized != null) {
              onUnauthorized!();
            }
          }
          return handler.next(e);
        },
      ),
    );
  }

  // GET Request
  Future<Response> get(
    String path, {
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await dio.get(path, queryParameters: queryParameters, options: options);
    } on DioException catch (e) {
      _handleDioError(e);
      rethrow;
    }
  }

  // POST Request
  Future<Response> post(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await dio.post(path, data: data, queryParameters: queryParameters, options: options);
    } on DioException catch (e) {
      _handleDioError(e);
      rethrow;
    }
  }

  // PUT Request
  Future<Response> put(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await dio.put(path, data: data, queryParameters: queryParameters, options: options);
    } on DioException catch (e) {
      _handleDioError(e);
      rethrow;
    }
  }

  // PATCH Request
  Future<Response> patch(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await dio.patch(path, data: data, queryParameters: queryParameters, options: options);
    } on DioException catch (e) {
      _handleDioError(e);
      rethrow;
    }
  }

  // DELETE Request
  Future<Response> delete(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParameters,
    Options? options,
  }) async {
    try {
      return await dio.delete(path, data: data, queryParameters: queryParameters, options: options);
    } on DioException catch (e) {
      _handleDioError(e);
      rethrow;
    }
  }

  // Clean error logging
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
        message = 'Máy chủ phản hồi lỗi: ${error.response?.statusCode} - ${error.response?.data}';
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

