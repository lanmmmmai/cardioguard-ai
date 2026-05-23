import 'package:flutter/material.dart';

class EcgPainter extends CustomPainter {
  final List<double> dataPoints;
  final double heartRate;
  final bool isDarkTheme;

  EcgPainter({
    required this.dataPoints,
    required this.heartRate,
    required this.isDarkTheme,
  });

  @override
  void paint(Canvas canvas, Size size) {
    // Clear / draw background
    final bgPaint = Paint()
      ..color = isDarkTheme ? const Color(0xFF0A0D14) : const Color(0xFFFAFAFA)
      ..style = PaintingStyle.fill;
    canvas.drawRect(Offset.zero & size, bgPaint);

    final width = size.width;
    final height = size.height;
    final centerY = height / 2;

    // Small grids (every 10px)
    final gridPaintSmall = Paint()
      ..color = const Color(0xFFFF3366).withOpacity(0.04)
      ..strokeWidth = 0.5
      ..style = PaintingStyle.stroke;

    for (double x = 0; x < width; x += 10) {
      canvas.drawLine(Offset(x, 0), Offset(x, height), gridPaintSmall);
    }
    for (double y = 0; y < height; y += 10) {
      canvas.drawLine(Offset(0, y), Offset(width, y), gridPaintSmall);
    }

    // Large grid squares (every 50px)
    final gridPaintLarge = Paint()
      ..color = const Color(0xFFFF3366).withOpacity(0.12)
      ..strokeWidth = 1.0
      ..style = PaintingStyle.stroke;

    for (double x = 0; x < width; x += 50) {
      canvas.drawLine(Offset(x, 0), Offset(x, height), gridPaintLarge);
    }
    for (double y = 0; y < height; y += 50) {
      canvas.drawLine(Offset(0, y), Offset(width, y), gridPaintLarge);
    }

    if (dataPoints.isEmpty) return;

    // Draw ECG Curve path
    final step = width / (dataPoints.length - 1);
    final path = Path();

    double startY = centerY - dataPoints[0] * (height * 0.35);
    path.moveTo(0, startY);

    for (int i = 1; i < dataPoints.length; i++) {
      double x = i * step;
      double y = centerY - dataPoints[i] * (height * 0.35);
      path.lineTo(x, y);
    }

    // Neon Glow background path
    final glowPaint = Paint()
      ..color = const Color(0xFF00F2FE).withOpacity(0.4)
      ..strokeWidth = 5.0
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4.0);

    canvas.drawPath(path, glowPaint);

    // Front crisp ECG path
    final ecgPaint = Paint()
      ..color = const Color(0xFF00F2FE)
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    canvas.drawPath(path, ecgPaint);

    // Draw leading sweeping pulse dot
    final lastX = width;
    final lastY = centerY - dataPoints.last * (height * 0.35);

    // Glow dot
    final dotGlow = Paint()
      ..color = const Color(0xFFFFFFFF).withOpacity(0.8)
      ..style = PaintingStyle.fill
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6.0);
    canvas.drawCircle(Offset(lastX - 4, lastY), 8.0, dotGlow);

    // Core white dot
    final dotPaint = Paint()
      ..color = const Color(0xFFFFFFFF)
      ..style = PaintingStyle.fill;
    canvas.drawCircle(Offset(lastX - 4, lastY), 3.5, dotPaint);
  }

  @override
  bool shouldRepaint(covariant EcgPainter oldDelegate) {
    return oldDelegate.dataPoints != dataPoints || oldDelegate.isDarkTheme != isDarkTheme;
  }
}
