// Bộ ghi nhật ký đơn giản trên toàn ứng dụng với tính năng che dấu PII tuân thủ HIPAA.
// Quy trình làm việc:
//   - Cung cấp các phương thức tĩnh info, warn và error ủy quyền cho
//     _print sau khi che dấu email và số điện thoại.
//   - Ở chế độ phát hành, các thông báo cấp info bị ẩn để tránh
//     chi phí hiệu suất và rò rỉ thông tin.
// Mối quan hệ:
//   - Được tiêu thụ trên toàn bộ ứng dụng (providers, services, core utilities)
//     để ghi nhật ký nhất quán và an toàn về quyền riêng tư.
import 'package:flutter/foundation.dart';

// Mức độ nghiêm trọng của nhật ký được sử dụng bởi AppLogger.
enum LogLevel { info, warn, error }

// Bộ ghi nhật ký trung tâm với lọc cấp độ và che dấu PII.
class AppLogger {
  // Phương thức dự phòng kế thừa; ủy quyền cho info.
  static void log(Object? message) {
    info(message);
  }

  // Ghi nhật ký cấp info (bị ẩn trong bản dựng phát hành).
  static void info(Object? message) => _print(LogLevel.info, message);

  // Ghi nhật ký cấp cảnh báo.
  static void warn(Object? message) => _print(LogLevel.warn, message);

  // Ghi nhật ký cấp lỗi.
  static void error(Object? message) => _print(LogLevel.error, message);

  // Trợ giúp in nội bộ che dấu PII và lọc theo chế độ phát hành.
  static void _print(LogLevel level, Object? message) {
    // Ở chế độ phát hành, chỉ ghi lỗi/cảnh báo để tránh chi phí hiệu suất/rò rỉ
    if (kReleaseMode && level == LogLevel.info) return;
    
    String text = message?.toString() ?? 'null';
    
    // Tuân thủ HIPAA: Che dấu thông tin nhạy cảm đơn giản
    // Che dấu email
    text = text.replaceAllMapped(RegExp(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'), (m) => '***@***.***');
    // Che dấu số điện thoại tiềm năng (10-11 chữ số)
    text = text.replaceAllMapped(RegExp(r'\b\d{10,11}\b'), (m) => '***-***-****');
    
    debugPrint('[${level.name.toUpperCase()}] $text');
  }
}
