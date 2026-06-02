import 'package:flutter/foundation.dart';

enum LogLevel { info, warn, error }

class AppLogger {
  // Fallback for legacy calls
  static void log(Object? message) {
    info(message);
  }

  static void info(Object? message) => _print(LogLevel.info, message);
  static void warn(Object? message) => _print(LogLevel.warn, message);
  static void error(Object? message) => _print(LogLevel.error, message);

  static void _print(LogLevel level, Object? message) {
    // In release mode, only log errors/warnings to avoid performance overhead/leakage
    if (kReleaseMode && level == LogLevel.info) return;
    
    String text = message?.toString() ?? 'null';
    
    // HIPAA Compliance: Simple masking for sensitive information
    // Mask emails
    text = text.replaceAllMapped(RegExp(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'), (m) => '***@***.***');
    // Mask potential phone numbers (10-11 digits)
    text = text.replaceAllMapped(RegExp(r'\b\d{10,11}\b'), (m) => '***-***-****');
    
    debugPrint('[${level.name.toUpperCase()}] $text');
  }
}
