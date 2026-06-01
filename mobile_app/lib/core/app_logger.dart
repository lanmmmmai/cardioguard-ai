import 'package:flutter/foundation.dart';

class AppLogger {
  static void log(Object? message) {
    debugPrint(message?.toString() ?? 'null');
  }
}
