// Trình vẽ CustomPainter tùy chỉnh hiển thị dạng sóng ECG thời gian thực với lưới neon.
// Quy trình làm việc:
// 1. Vẽ nền tối/sáng, sau đó các đường lưới nhỏ (10 px) và lớn (50 px)
//    với tông màu hồng trong suốt.
// 2. Vẽ đồ thị dataPoints dưới dạng đường liên tục được chia tỷ lệ theo chiều cao canvas.
// 3. Áp dụng hiệu ứng phát sáng xanh lơ (MaskFilter.blur) phía sau nét ECG chính.
// 4. Vẽ một chấm trắng dẫn đầu tại điểm dữ liệu mới nhất với quầng sáng phát sáng.
// Mối quan hệ:
// - Được sử dụng bởi: DashboardScreen bên trong AnimatedBuilder.
// - Dữ liệu: nhận một List<double> các biên độ ECG từ bộ đệm số liệu trực tiếp.
// - Vẽ lại: được kiểm soát bởi shouldRepaint qua so sánh listEquals.
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';

// Vẽ dạng sóng ECG với nền lưới neon và chấm dẫn đầu phát sáng.
class EcgPainter extends CustomPainter {
  // Danh sách có thứ tự các giá trị biên độ ECG (chuẩn hóa ~ -1.0 đến 1.0).
  final List<double> dataPoints;
  // Nhịp tim hiện tại tính bằng BPM (được sử dụng trong so sánh shouldRepaint).
  final double heartRate;
  // Công tắc chế độ tối/sáng cho màu nền.
  final bool isDarkTheme;

  EcgPainter({
    required this.dataPoints,
    required this.heartRate,
    required this.isDarkTheme,
  });

  @override
  void paint(Canvas canvas, Size size) {
    // Vẽ nền
    final bgPaint = Paint()
      ..color = isDarkTheme ? const Color(0xFF0A0D14) : const Color(0xFFFAFAFA)
      ..style = PaintingStyle.fill;
    canvas.drawRect(Offset.zero & size, bgPaint);

    final width = size.width;
    final height = size.height;
    final centerY = height / 2;

    // Lưới nhỏ (mỗi 10px) — lưới mịn cho thẩm mỹ màn hình y tế
    final gridPaintSmall = Paint()
      ..color = const Color(0xFFFF3366).withValues(alpha: 0.04)
      ..strokeWidth = 0.5
      ..style = PaintingStyle.stroke;

    for (double x = 0; x < width; x += 10) {
      canvas.drawLine(Offset(x, 0), Offset(x, height), gridPaintSmall);
    }
    for (double y = 0; y < height; y += 10) {
      canvas.drawLine(Offset(0, y), Offset(width, y), gridPaintSmall);
    }

    // Ô lưới lớn (mỗi 50px)
    final gridPaintLarge = Paint()
      ..color = const Color(0xFFFF3366).withValues(alpha: 0.12)
      ..strokeWidth = 1.0
      ..style = PaintingStyle.stroke;

    for (double x = 0; x < width; x += 50) {
      canvas.drawLine(Offset(x, 0), Offset(x, height), gridPaintLarge);
    }
    for (double y = 0; y < height; y += 50) {
      canvas.drawLine(Offset(0, y), Offset(width, y), gridPaintLarge);
    }

    if (dataPoints.isEmpty) return;

    // Vẽ đường cong ECG
    final step = width / (dataPoints.length - 1);
    final path = Path();

    double startY = centerY - dataPoints[0] * (height * 0.35);
    path.moveTo(0, startY);

    for (int i = 1; i < dataPoints.length; i++) {
      double x = i * step;
      double y = centerY - dataPoints[i] * (height * 0.35);
      path.lineTo(x, y);
    }

    // Đường nền phát sáng neon
    final glowPaint = Paint()
      ..color = const Color(0xFF00F2FE).withValues(alpha: 0.4)
      ..strokeWidth = 5.0
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4.0);

    canvas.drawPath(path, glowPaint);

    // Đường ECG chính nét căng
    final ecgPaint = Paint()
      ..color = const Color(0xFF00F2FE)
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    canvas.drawPath(path, ecgPaint);

    // Vẽ chấm xung dẫn đầu
    final lastX = width - 4;
    final lastY = centerY - dataPoints.last * (height * 0.35);

    // Chấm phát sáng
    final dotGlow = Paint()
      ..color = const Color(0xFFFFFFFF).withValues(alpha: 0.8)
      ..style = PaintingStyle.fill
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6.0);
    canvas.drawCircle(Offset(lastX - 4, lastY), 8.0, dotGlow);

    // Chấm trắng lõi
    final dotPaint = Paint()
      ..color = const Color(0xFFFFFFFF)
      ..style = PaintingStyle.fill;
    canvas.drawCircle(Offset(lastX - 4, lastY), 3.5, dotPaint);
  }

  @override
  bool shouldRepaint(covariant EcgPainter oldDelegate) {
    return !listEquals(oldDelegate.dataPoints, dataPoints) ||
        oldDelegate.heartRate != heartRate ||
        oldDelegate.isDarkTheme != isDarkTheme;
  }
}
