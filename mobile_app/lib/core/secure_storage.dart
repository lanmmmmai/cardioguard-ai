// Bọc bộ nhớ an toàn đã mã hóa (singleton) cho token JWT và hồ sơ người dùng.
// Quy trình làm việc:
//   1. Sử dụng FlutterSecureStorage với các tùy chọn mã hóa theo nền tảng
//      (Android EncryptedSharedPreferences, iOS Keychain accessibility).
//   2. Mỗi thao tác đọc/ghi/xóa được bọc trong _safeOperation để thử lại
//      khi thất bại và tùy chọn xóa khóa hỏng để phục hồi.
//   3. Lưu trữ JWT dưới AppConfig.keyToken và JSON người dùng dưới
//      AppConfig.keyUser; clearSession xóa tất cả các mục.
// Mối quan hệ:
//   - Được tiêu thụ bởi ApiClient (chèn token) và AuthProvider
//     (duy trì và dọn dẹp phiên).
//   - Phụ thuộc vào: AppLogger để ghi lỗi.
import 'dart:convert';
import 'app_logger.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/app_config.dart';

class SecureStorage {
  // Phiên bản nội bộ singleton.
  static final SecureStorage _instance = SecureStorage._internal();

  // Trả về phiên bản singleton SecureStorage.
  factory SecureStorage() => _instance;

  // Hàm tạo riêng tư.
  SecureStorage._internal();

  final _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  // Thực thi an toàn một thao tác lưu trữ với logic thử lại và xóa khóa tùy chọn khi thất bại.
  // Thử lại tối đa 2 lần để xử lý lỗi thoáng qua của kho khóa Android.
  // Nếu tất cả các lần thử đều thất bại và keyToDeleteOnError được cung cấp, khóa hỏng
  // sẽ bị xóa để khôi phục tính toàn vẹn của bộ nhớ.
  Future<T?> _safeOperation<T>(Future<T?> Function() operation, {String? keyToDeleteOnError}) async {
    int retries = 2;
    while (retries > 0) {
      try {
        return await operation();
      } catch (e) {
        retries--;
        if (retries == 0) {
          AppLogger.log('Lỗi SecureStorage sau khi thử lại: $e.');
          if (keyToDeleteOnError != null) {
            AppLogger.log('Đang xóa khóa: $keyToDeleteOnError để phục hồi.');
            try {
              await _storage.delete(key: keyToDeleteOnError);
            } catch (deleteError) {
              AppLogger.log('Không thể xóa khóa $keyToDeleteOnError: $deleteError');
            }
          }
          return null;
        }
        await Future.delayed(const Duration(milliseconds: 100));
      }
    }
    return null;
  }

  // Lưu trữ token JWT vào bộ nhớ an toàn.
  Future<void> saveToken(String token) async {
    await _safeOperation<void>(() => _storage.write(key: AppConfig.keyToken, value: token));
  }

  // Lấy token JWT đã lưu, hoặc null nếu không có.
  Future<String?> getToken() async {
    return await _safeOperation<String>(
      () => _storage.read(key: AppConfig.keyToken),
      keyToDeleteOnError: AppConfig.keyToken,
    );
  }

  // Xóa token JWT khỏi bộ nhớ an toàn.
  Future<void> deleteToken() async {
    await _safeOperation<void>(() => _storage.delete(key: AppConfig.keyToken));
  }

  // Lưu trữ bản đồ hồ sơ người dùng đã xác thực vào bộ nhớ an toàn dưới dạng JSON.
  Future<void> saveUser(Map<String, dynamic> userMap) async {
    final userJson = json.encode(userMap);
    await _safeOperation<void>(() => _storage.write(key: AppConfig.keyUser, value: userJson));
  }

  // Lấy bản đồ hồ sơ người dùng đã lưu, hoặc null nếu không có.
  Future<Map<String, dynamic>?> getUser() async {
    final userJson = await _safeOperation<String>(
      () => _storage.read(key: AppConfig.keyUser),
      keyToDeleteOnError: AppConfig.keyUser,
    );
    if (userJson != null) {
      try {
        return json.decode(userJson) as Map<String, dynamic>;
      } catch (e) {
        AppLogger.log('Lỗi giải mã người dùng đã lưu: $e');
        return null;
      }
    }
    return null;
  }

  // Xóa hồ sơ người dùng đã lưu khỏi bộ nhớ an toàn.
  Future<void> deleteUser() async {
    await _safeOperation<void>(() => _storage.delete(key: AppConfig.keyUser));
  }

  // Xóa tất cả các mục khỏi bộ nhớ an toàn (token + hồ sơ người dùng).
  Future<void> clearSession() async {
    await _safeOperation<void>(() => _storage.deleteAll());
  }
}
