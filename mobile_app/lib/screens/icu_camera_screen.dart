// Màn hình camera ICU mô phỏng cho mục đích demo.
// Quy trình làm việc:
// 1. Bắt đầu bộ điều khiển hoạt ảnh 60 FPS cho chu kỳ thở và cập nhật HUD.
// 2. Bộ đếm thời gian định kỳ 100 ms giữ cho mã thời gian trên màn hình luôn cập nhật.
// 3. Cổng nhìn hiển thị hai lớp CustomPainter: một lớp phủ quét CRT
//    (_CrtOverlayPainter) và giường/bóng ICU (_IcuCameraPainter).
// 4. Bóng bệnh nhân hiển thị sóng hình sin nâng ngực để mô phỏng nhịp thở.
// Mối quan hệ:
// - Màn hình độc lập; không sử dụng providers.
// - Sử dụng: CgScreenScaffold cho bố cục.
// - Vẽ: _IcuCameraPainter (giường, bóng, HUD) và
//           _CrtOverlayPainter (đường quét chuyển động).
import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:lucide_flutter/lucide_flutter.dart';
import '../widgets/cg_widgets.dart';

class IcuCameraScreen extends StatefulWidget {
  final bool isDarkTheme;
  const IcuCameraScreen({super.key, required this.isDarkTheme});

  @override
  State<IcuCameraScreen> createState() => _IcuCameraScreenState();
}

class _IcuCameraScreenState extends State<IcuCameraScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  Timer? _timer;
  String _timeString = '';

  @override
  void initState() {
    super.initState();
    // Bộ đếm thời gian 60FPS cho chu kỳ thở và các dấu chấm nhấp nháy
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3600),
    )..addListener(() {
        if (mounted) setState(() {});
      });
    _animationController.forward();

    // Đồng hồ đếm thời gian
    _updateTime();
    _timer = Timer.periodic(const Duration(milliseconds: 100), (timer) {
      _updateTime();
    });
  }

  void _updateTime() {
    final now = DateTime.now();
    final ms = now.millisecond.toString().padLeft(3, '0');
    final seconds = now.second.toString().padLeft(2, '0');
    final minutes = now.minute.toString().padLeft(2, '0');
    final hours = now.hour.toString().padLeft(2, '0');
    if (mounted) {
      setState(() {
        _timeString = '$hours:$minutes:$seconds.$ms';
      });
    }
  }

  @override
  void dispose() {
    _animationController.dispose();
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = widget.isDarkTheme;
    final cardBg = isDark
        ? const Color(0xFF11151D).withValues(alpha: 0.7)
        : Colors.white.withValues(alpha: 0.9);
    final textMuted =
        isDark ? const Color(0xFF9EA5B4) : const Color(0xFF475467);
    final borderColor = isDark
        ? Colors.white.withValues(alpha: 0.07)
        : Colors.black.withValues(alpha: 0.08);

    final double timestamp = DateTime.now().millisecondsSinceEpoch.toDouble();

    return CgScreenScaffold(
      title: 'Camera giả lập ICU',
      subtitle: 'Màn hình mô phỏng camera ICU phục vụ demo giao diện',
      trailing: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(0xFF39FF14).withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(20),
          border:
              Border.all(color: const Color(0xFF39FF14).withValues(alpha: 0.3)),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(LucideIcons.radio, size: 12, color: Color(0xFF39FF14)),
            SizedBox(width: 6),
            Text(
              'SIMULATED FEED',
              style: TextStyle(
                  fontSize: 10,
                  color: Color(0xFF39FF14),
                  fontWeight: FontWeight.bold),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          // Bọc cổng nhìn camera
          Expanded(
            child: Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
              child: Container(
                width: double.infinity,
                decoration: BoxDecoration(
                  color: const Color(0xFF030A03),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: const Color(0xFF39FF14).withValues(alpha: 0.2),
                    width: 1.5,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.5),
                      blurRadius: 15,
                      spreadRadius: 2,
                    )
                  ],
                ),
                child: RepaintBoundary(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(18),
                    child: Stack(
                      children: [
                        Positioned.fill(
                          child: CustomPaint(
                            painter: _CrtOverlayPainter(timestamp: timestamp),
                          ),
                        ),
                        Positioned.fill(
                          child: CustomPaint(
                            painter: _IcuCameraPainter(
                              timestamp: timestamp,
                              timeString: _timeString,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),

          // Thông tin chi tiết camera
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: borderColor),
              ),
              child: Row(
                children: [
                  const Icon(LucideIcons.alertCircle,
                      color: Color(0xFF39FF14), size: 18),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Luồng hiển thị đang ở chế độ mô phỏng. Không sử dụng như nguồn camera lâm sàng thực tế.',
                      style: TextStyle(
                        color: textMuted,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// Trình vẽ tùy chỉnh cho Giường ICU và Bóng bệnh nhân
// Vẽ giường ICU, bóng bệnh nhân, hoạt ảnh thở và lớp phủ HUD.
class _IcuCameraPainter extends CustomPainter {
  final double timestamp;
  final String timeString;

  _IcuCameraPainter({required this.timestamp, required this.timeString});

  @override
  void paint(Canvas canvas, Size size) {
    final width = size.width;
    final height = size.height;

    // 1. Vẽ lưới nhiệt màu xanh lá
    final gridPaint = Paint()
      ..color = const Color(0xFF39FF14).withValues(alpha: 0.04)
      ..strokeWidth = 1.0;

    for (double x = 0; x < width; x += 40) {
      canvas.drawLine(Offset(x, 0), Offset(x, height), gridPaint);
    }
    for (double y = 0; y < height; y += 40) {
      canvas.drawLine(Offset(0, y), Offset(width, y), gridPaint);
    }

    // 2. Vẽ các góc khung ngắm
    final bracketPaint = Paint()
      ..color = const Color(0xFF39FF14).withValues(alpha: 0.6)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;

    const double margin = 20.0;
    const double len = 15.0;

    // Góc trên trái
    canvas.drawPath(
        Path()
          ..moveTo(margin + len, margin)
          ..lineTo(margin, margin)
          ..lineTo(margin, margin + len),
        bracketPaint);
    // Góc trên phải
    canvas.drawPath(
        Path()
          ..moveTo(width - margin - len, margin)
          ..lineTo(width - margin, margin)
          ..lineTo(width - margin, margin + len),
        bracketPaint);
    // Góc dưới trái
    canvas.drawPath(
        Path()
          ..moveTo(margin + len, height - margin)
          ..lineTo(margin, height - margin)
          ..lineTo(margin, height - margin - len),
        bracketPaint);
    // Góc dưới phải
    canvas.drawPath(
        Path()
          ..moveTo(width - margin - len, height - margin)
          ..lineTo(width - margin, height - margin)
          ..lineTo(width - margin, height - margin - len),
        bracketPaint);

    // 3. Vẽ chữ thập trung tâm
    canvas.drawLine(Offset(width / 2 - 10, height / 2),
        Offset(width / 2 + 10, height / 2), bracketPaint);
    canvas.drawLine(Offset(width / 2, height / 2 - 10),
        Offset(width / 2, height / 2 + 10), bracketPaint);

    // 4. Vẽ Giường và Bóng bệnh nhân
    final bedPaint = Paint()
      ..color = const Color(0xFF39FF14).withValues(alpha: 0.25)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;

    final bedY = height * 0.65;
    final bedX1 = width * 0.15;
    final bedX2 = width * 0.85;

    // Khung giường cơ bản và chân
    canvas.drawLine(Offset(bedX1, bedY), Offset(bedX2, bedY), bedPaint);
    canvas.drawLine(
        Offset(bedX1 + 30, bedY), Offset(bedX1 + 30, bedY + 45), bedPaint);
    canvas.drawLine(
        Offset(bedX2 - 30, bedY), Offset(bedX2 - 30, bedY + 45), bedPaint);
    canvas.drawLine(Offset(bedX1, bedY), Offset(bedX1 - 12, bedY - 30),
        bedPaint); // tựa đầu

    // Hoạt ảnh nâng ngực: sóng hình sin thở ở chu kỳ ~4 giây
    final breathTime = timestamp / 4000.0;
    final chestExpansion = 5.0 * math.sin(breathTime * 2 * math.pi);

    final patientPaint = Paint()
      ..color = const Color(0xFF39FF14).withValues(alpha: 0.55)
      ..strokeWidth = 2.0
      ..style = PaintingStyle.stroke;

    final pHeadX = bedX1 + 60;
    final pHeadY = bedY - 25;
    final pChestX = pHeadX + 45;
    final pChestY = bedY - 15;

    // Gối
    canvas.drawArc(
        Rect.fromCircle(center: Offset(pHeadX - 10, bedY - 8), radius: 10),
        math.pi,
        math.pi,
        false,
        bedPaint);

    // Đầu
    canvas.drawCircle(Offset(pHeadX, pHeadY), 10.0, patientPaint);

    // Cổ và vai
    canvas.drawLine(Offset(pHeadX + 8, pHeadY + 5),
        Offset(pHeadX + 16, bedY - 8), patientPaint);

    // Ngực và cơ thể với nhịp thở
    final bodyPath = Path()
      ..moveTo(pHeadX + 16, bedY - 8)
      ..quadraticBezierTo(
        pChestX,
        pChestY - 8 - math.max(0.0, chestExpansion),
        pHeadX + 90,
        bedY - 12,
      )
      ..lineTo(bedX2 - 20, bedY - 5);

    canvas.drawPath(bodyPath, patientPaint);

    // Giá đỡ IV
    final ivX = pHeadX - 25;
    canvas.drawLine(Offset(ivX, bedY + 30), Offset(ivX, bedY - 90), bedPaint);
    canvas.drawLine(
        Offset(ivX - 10, bedY - 90), Offset(ivX + 10, bedY - 90), bedPaint);
    canvas.drawRect(
        Rect.fromLTWH(ivX - 8, bedY - 82, 6, 14), bedPaint); // túi dịch
    // dây nhỏ giọt
    final wirePath = Path()
      ..moveTo(ivX - 5, bedY - 68)
      ..cubicTo(ivX - 5, bedY - 30, pChestX - 10, bedY, pChestX + 5, bedY - 6);
    canvas.drawPath(wirePath, bedPaint);

    // Lớp phủ văn bản HUD
    final textPainter = TextPainter(textDirection: TextDirection.ltr);

    // Văn bản REC (nhấp nháy)
    final bool isRecFlash = (timestamp ~/ 600) % 2 == 0;
    if (isRecFlash) {
      // Chấm đỏ
      canvas.drawCircle(const Offset(margin + 10, margin + 12), 4.0,
          Paint()..color = const Color(0xFFFF073A));

      textPainter.text = const TextSpan(
        text: 'REC',
        style: TextStyle(
          color: Color(0xFFFF3366),
          fontSize: 10,
          fontWeight: FontWeight.bold,
        ),
      );
      textPainter.layout();
      textPainter.paint(canvas, const Offset(margin + 20, margin + 6));
    }

    // Tên camera
    textPainter.text = const TextSpan(
      text: 'CAM 04 - ICU ROOM',
      style: TextStyle(
        color: Color(0xFF39FF14),
        fontSize: 10,
        fontWeight: FontWeight.bold,
      ),
    );
    textPainter.layout();
    textPainter.paint(canvas, const Offset(margin + 10, margin + 26));

    // Trạng thái kết nối
    textPainter.text = const TextSpan(
      text: 'CONN: ACTIVE',
      style: TextStyle(
        color: Color(0xFF39FF14),
        fontSize: 9,
        fontWeight: FontWeight.bold,
      ),
    );
    textPainter.layout();
    textPainter.paint(canvas, Offset(width - margin - 80, margin + 10));

    // Mã thời gian đồng hồ
    textPainter.text = TextSpan(
      text: timeString,
      style: const TextStyle(
        color: Color(0xFF39FF14),
        fontSize: 10,
        fontWeight: FontWeight.bold,
      ),
    );
    textPainter.layout();
    textPainter.paint(canvas, Offset(margin + 10, height - margin - 15));
  }

  @override
  bool shouldRepaint(covariant _IcuCameraPainter oldDelegate) {
    return oldDelegate.timestamp != timestamp ||
        oldDelegate.timeString != timeString;
  }
}

// Vẽ một lớp phủ quét CRT chuyển động để mô phỏng hiệu ứng màn hình cổ điển.
class _CrtOverlayPainter extends CustomPainter {
  final double timestamp;

  _CrtOverlayPainter({required this.timestamp});

  @override
  void paint(Canvas canvas, Size size) {
    final width = size.width;
    final height = size.height;

    // Đường quét chuyển động
    final scanlinePaint = Paint()
      ..color = const Color(0xFF39FF14).withValues(alpha: 0.08)
      ..strokeWidth = 2.0;

    final double speed = (timestamp / 12) % height;
    canvas.drawLine(Offset(0, speed), Offset(width, speed), scanlinePaint);
    canvas.drawLine(
        Offset(0, (speed + 8) % height),
        Offset(width, (speed + 8) % height),
        scanlinePaint..color = const Color(0xFF39FF14).withValues(alpha: 0.04));
  }

  @override
  bool shouldRepaint(covariant _CrtOverlayPainter oldDelegate) => true;
}
