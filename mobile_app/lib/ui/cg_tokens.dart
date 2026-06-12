// Các token thiết kế cho giao diện CardioGuard: màu sắc, khoảng cách và bán kính viền.
// Quy trình làm việc:
//   - CgColors định nghĩa bảng màu ngữ nghĩa (primary, critical,
//     warning, normal và các màu chỉ số sinh tồn cụ thể).
//   - CgSpacing và CgRadius cung cấp các hằng số bố cục nhất quán được sử dụng
//     trên tất cả các màn hình và widget.
// Mối quan hệ:
//   - Được tiêu thụ bởi cg_theme.dart và tất cả các tệp màn hình/widget để
//     tạo kiểu hình ảnh nhất quán.
import 'package:flutter/material.dart';

// Bảng màu ngữ nghĩa được sử dụng trong toàn bộ giao diện CardioGuard.
class CgColors {
  static const critical = Color(0xFFD92D20);
  static const warning = Color(0xFFF79009);
  static const normal = Color(0xFF12B76A);
  static const hr = Color(0xFFE11D48);
  static const spo2 = Color(0xFF0891B2);
  static const bp = Color(0xFF7A5AF8);
  static const primary = Color(0xFF0369A1);
  static const accent = Color(0xFFFF3366);
}

class CgSpacing {
  static const xs = 6.0;
  static const sm = 10.0;
  static const md = 16.0;
  static const lg = 20.0;
  static const xl = 24.0;
}

class CgRadius {
  static const sm = 10.0;
  static const md = 14.0;
  static const lg = 18.0;
}
