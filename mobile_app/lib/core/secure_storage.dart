import 'dart:convert';
import 'app_logger.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/app_config.dart';

class SecureStorage {
  // Singleton instance
  static final SecureStorage _instance = SecureStorage._internal();
  factory SecureStorage() => _instance;
  SecureStorage._internal();

  final _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  // Safe wrapper for all storage operations to handle Android key-store cryptographic issues
  Future<T?> _safeOperation<T>(Future<T?> Function() operation) async {
    try {
      return await operation();
    } catch (e) {
      AppLogger.log('SecureStorage error: $e. Clearing storage to recover.');
      try {
        await _storage.deleteAll();
      } catch (clearError) {
        AppLogger.log('Failed to clear SecureStorage: $clearError');
      }
      return null;
    }
  }

  // Write token
  Future<void> saveToken(String token) async {
    await _safeOperation<void>(() => _storage.write(key: AppConfig.keyToken, value: token));
  }

  // Read token
  Future<String?> getToken() async {
    return await _safeOperation<String>(() => _storage.read(key: AppConfig.keyToken));
  }

  // Delete token
  Future<void> deleteToken() async {
    await _safeOperation<void>(() => _storage.delete(key: AppConfig.keyToken));
  }

  // Write user profile
  Future<void> saveUser(Map<String, dynamic> userMap) async {
    final userJson = json.encode(userMap);
    await _safeOperation<void>(() => _storage.write(key: AppConfig.keyUser, value: userJson));
  }

  // Read user profile
  Future<Map<String, dynamic>?> getUser() async {
    final userJson = await _safeOperation<String>(() => _storage.read(key: AppConfig.keyUser));
    if (userJson != null) {
      try {
        return json.decode(userJson) as Map<String, dynamic>;
      } catch (e) {
        AppLogger.log('Error decoding stored user: $e');
        return null;
      }
    }
    return null;
  }

  // Delete user profile
  Future<void> deleteUser() async {
    await _safeOperation<void>(() => _storage.delete(key: AppConfig.keyUser));
  }

  // Clear all session storage
  Future<void> clearSession() async {
    await _safeOperation<void>(() => _storage.deleteAll());
  }
}

