// Trình vẽ CustomPainter tùy chỉnh hiển thị một trái tim đám mây điểm 3D có thể xoay.
// Quy trình làm việc:
// 1. Phương thức tĩnh generateHeartPoints tạo một đám mây điểm 3D sử dụng
//    phương trình tham số trái tim (vĩ độ × kinh độ) cộng với các điểm thể tích
//    bên trong cho chiều sâu ảnh ba chiều.
// 2. Mỗi khung hình áp dụng ma trận xoay trục Y và X, sau đó chiếu phối cảnh
//    lên mặt phẳng canvas 2D.
// 3. Các điểm được sắp xếp theo độ sâu (Giải thuật của Họa sĩ) và vẽ từ sau ra trước
//    với độ mờ và bán kính thay đổi dựa trên độ sâu.
// 4. Các nút phía trước được tô sáng ngẫu nhiên để tạo hiệu ứng lấp lánh.
// Mối quan hệ:
// - Được sử dụng bởi: DashboardScreen bên trong AnimatedBuilder.
// - Dữ liệu: nhận danh sách điểm đã tạo trước, góc xoay và hệ số xung.
// - Vật lý xung: được điều khiển bởi DashboardScreen._onAnimationTick.
import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../ui/cg_tokens.dart';

// Một điểm 3D trong đám mây điểm trái tim.
class Point3D {
  final double x;
  final double y;
  final double z;

  Point3D(this.x, this.y, this.z);
}

// Một điểm 3D sau khi chiếu phối cảnh lên khung nhìn 2D.
class ProjectedPoint {
  final double x;
  final double y;
  final double z;
  // Hệ số tỷ lệ phối cảnh (gần hơn = lớn hơn).
  final double scale;

  ProjectedPoint(this.x, this.y, this.z, this.scale);
}

// Vẽ một trái tim đám mây điểm 3D với xoay, xung và hiển thị sắp xếp theo độ sâu.
class Heart3dPainter extends CustomPainter {
  // Danh sách các điểm bề mặt và thể tích trái tim 3D đã tạo trước.
  final List<Point3D> points;
  // Góc xoay trục Y tính bằng radian (xoay ngang).
  final double angleY;
  // Góc nghiêng trục X tính bằng radian (lắc dọc).
  final double angleX;
  // Hệ số giãn nở xung (0.0 đến 0.22) từ mô phỏng chu kỳ tim.
  final double pulse;
  // Cờ chủ đề tối/sáng (hiện không được sử dụng nhưng có sẵn cho kiểu dáng tương lai).
  final bool isDarkTheme;

  Heart3dPainter({
    required this.points,
    required this.angleY,
    required this.angleX,
    required this.pulse,
    required this.isDarkTheme,
  });

  // Tạo đám mây điểm 3D sử dụng phương trình bề mặt trái tim tham số
  // với các điểm thể tích bên trong được thêm vào cho chiều sâu. Gọi một lần bên ngoài vòng lặp vẽ.
  static List<Point3D> generateHeartPoints() {
    final List<Point3D> points = [];
    const int numLatitudes = 30;
    const int numLongitudes = 30;

    for (int i = 0; i < numLatitudes; i++) {
      double theta = (i / numLatitudes) * math.pi;
      for (int j = 0; j < numLongitudes; j++) {
        double phi = (j / numLongitudes) * 2 * math.pi;

        double sinTheta = math.sin(theta);
        double cosTheta = math.cos(theta);
        double sin3Theta = math.pow(sinTheta, 3).toDouble();

        double x = 16 * sin3Theta * math.sin(phi);
        double y = 13 * cosTheta - 5 * math.cos(2 * theta) - 2 * math.cos(3 * theta) - math.cos(4 * theta);
        double z = 16 * sin3Theta * math.cos(phi);

        points.add(Point3D(x, y * 0.9, z));
      }
    }

    // Thêm các điểm thể tích bên trong cho chiều sâu ảnh ba chiều
    final random = math.Random(42); // Hạt giống cho tính nhất quán
    for (int k = 0; k < 250; k++) {
      double theta = random.nextDouble() * math.pi;
      double phi = random.nextDouble() * 2 * math.pi;
      double r = random.nextDouble();

      double sinTheta = math.sin(theta);
      double cosTheta = math.cos(theta);
      double sin3Theta = math.pow(sinTheta, 3).toDouble();

      double x = 16 * sin3Theta * math.sin(phi) * r;
      double y = (13 * cosTheta - 5 * math.cos(2 * theta) - 2 * math.cos(3 * theta) - math.cos(4 * theta)) * r;
      double z = 16 * sin3Theta * math.cos(phi) * r;

      points.add(Point3D(x, y * 0.9, z));
    }

    return points;
  }

  @override
  void paint(Canvas canvas, Size size) {
    final double width = size.width;
    final double height = size.height;
    final double centerX = width / 2;
    final double centerY = height / 2 - 10;

    const double cameraDistance = 60.0;
    final double pulseScale = 4.2 * (1.0 + pulse);

    final double cosY = math.cos(angleY);
    final double sinY = math.sin(angleY);
    final double cosX = math.cos(angleX);
    final double sinX = math.sin(angleX);

    // Chiếu các điểm 3D lên khung nhìn 2D qua xoay trục Y rồi trục X,
    // tiếp theo là phép chia phối cảnh theo độ sâu (z).
    final List<ProjectedPoint> projected = [];
    for (var p in points) {
      // Xoay Y
      double x1 = p.x * cosY - p.z * sinY;
      double z1 = p.x * sinY + p.z * cosY;

      // Xoay X
      double y2 = p.y * cosX - z1 * sinX;
      double z2 = p.y * sinX + z1 * cosX;

      // Chiếu phối cảnh
      double scale = cameraDistance / (cameraDistance + z2);
      double screenX = centerX + x1 * pulseScale * scale;
      double screenY = centerY - y2 * pulseScale * scale;

      projected.add(ProjectedPoint(screenX, screenY, z2, scale));
    }

    // Sắp xếp theo độ sâu (Giải thuật của Họa sĩ)
    projected.sort((a, b) => b.z.compareTo(a.z));

    // Vẽ các nút
    final randomHighlight = math.Random(1337);
    for (var p in projected) {
      // Chuẩn hóa độ sâu (phạm vi độ sâu -18 đến 18)
      double depthAlpha = (1.0 - (p.z + 18.0) / 36.0).clamp(0.15, 1.0);

      final paint = Paint()
        ..color = CgColors.accent.withValues(alpha: depthAlpha * 0.85)
        ..style = PaintingStyle.fill;

      double radius = (1.5 * p.scale).clamp(0.6, 4.0);
      canvas.drawCircle(Offset(p.x, p.y), radius, paint);

      // Tô sáng các nút phía trước
      if (p.z < -10.0 && randomHighlight.nextDouble() < 0.04) {
        final highlightPaint = Paint()
          ..color = Colors.white.withValues(alpha: depthAlpha * 0.9)
          ..style = PaintingStyle.fill;
        canvas.drawCircle(Offset(p.x, p.y), radius * 1.3, highlightPaint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant Heart3dPainter oldDelegate) {
    return oldDelegate.angleY != angleY ||
        oldDelegate.angleX != angleX ||
        oldDelegate.pulse != pulse ||
        oldDelegate.isDarkTheme != isDarkTheme;
  }
}
