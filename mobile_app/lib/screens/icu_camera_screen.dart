import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

class IcuCameraScreen extends StatefulWidget {
  final bool isDarkTheme;
  const IcuCameraScreen({super.key, required this.isDarkTheme});

  @override
  State<IcuCameraScreen> createState() => _IcuCameraScreenState();
}

class _IcuCameraScreenState extends State<IcuCameraScreen> with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  Timer? _timer;
  String _timeString = '';

  @override
  void initState() {
    super.initState();
    // 60FPS ticker for breathing cycles & blinking dots
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3600),
    )..addListener(() {
        if (mounted) setState(() {});
      });
    _animationController.forward();

    // Timecode clock timer
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
    final primaryBg = isDark ? const Color(0xFF07080A) : const Color(0xFFF5F6F8);
    final cardBg = isDark ? const Color(0xFF11151D).withOpacity(0.7) : Colors.white.withOpacity(0.9);
    final textColor = isDark ? Colors.white : const Color(0xFF1D2939);
    final textMuted = isDark ? const Color(0xFF9EA5B4) : const Color(0xFF475467);
    final borderColor = isDark ? Colors.white.withOpacity(0.07) : Colors.black.withOpacity(0.08);

    final double timestamp = DateTime.now().millisecondsSinceEpoch.toDouble();

    return Scaffold(
      backgroundColor: primaryBg,
      body: SafeArea(
        child: Column(
          children: [
            // Page Header
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Camera Giả Lập ICU',
                        style: TextStyle(fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: textColor,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Theo dõi luồng video trực tiếp từ giường bệnh hồi sức',
                        style: TextStyle(color: textMuted, fontSize: 13,),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFF39FF14).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFF39FF14).withOpacity(0.3)),
                    ),
                    child: Row(
                      children: const [
                        Icon(LucideIcons.radio, size: 12, color: Color(0xFF39FF14)),
                        SizedBox(width: 6),
                        Text(
                          'LIVE STREAM',
                          style: TextStyle(
                            fontSize: 10,
                            color: Color(0xFF39FF14),
                            fontWeight: FontWeight.bold,),
                        ),
                      ],
                    ),
                  )
                ],
              ),
            ),

            // Camera viewport wrapper
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                child: Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: const Color(0xFF030A03),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: const Color(0xFF39FF14).withOpacity(0.2),
                      width: 1.5,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.5),
                        blurRadius: 15,
                        spreadRadius: 2,
                      )
                    ],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(18),
                    child: Stack(
                      children: [
                        // CRT Scanline Overlay Effect
                        Positioned.fill(
                          child: CustomPaint(
                            painter: _CrtOverlayPainter(timestamp: timestamp),
                          ),
                        ),
                        // Bed & Silhouette Vector Painter
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
            
            // Camera details info
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
                    const Icon(LucideIcons.alertCircle, color: Color(0xFF39FF14), size: 18),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Hệ thống đang hiển thị tín hiệu hồng ngoại từ Giường 04. Cảm biến lồng ngực thở (biên độ chest rise) đang hoạt động tự động.',
                        style: TextStyle(
                          color: textMuted,
                          fontSize: 12,),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// Custom Painter for ICU Bed & Silhouette
class _IcuCameraPainter extends CustomPainter {
  final double timestamp;
  final String timeString;

  _IcuCameraPainter({required this.timestamp, required this.timeString});

  @override
  void paint(Canvas canvas, Size size) {
    final width = size.width;
    final height = size.height;

    // 1. Draw green thermal grid
    final gridPaint = Paint()
      ..color = const Color(0xFF39FF14).withOpacity(0.04)
      ..strokeWidth = 1.0;

    for (double x = 0; x < width; x += 40) {
      canvas.drawLine(Offset(x, 0), Offset(x, height), gridPaint);
    }
    for (double y = 0; y < height; y += 40) {
      canvas.drawLine(Offset(0, y), Offset(width, y), gridPaint);
    }

    // 2. Draw viewfinder corners
    final bracketPaint = Paint()
      ..color = const Color(0xFF39FF14).withOpacity(0.6)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;

    const double margin = 20.0;
    const double len = 15.0;

    // Top Left
    canvas.drawPath(Path()..moveTo(margin + len, margin)..lineTo(margin, margin)..lineTo(margin, margin + len), bracketPaint);
    // Top Right
    canvas.drawPath(Path()..moveTo(width - margin - len, margin)..lineTo(width - margin, margin)..lineTo(width - margin, margin + len), bracketPaint);
    // Bottom Left
    canvas.drawPath(Path()..moveTo(margin + len, height - margin)..lineTo(margin, height - margin)..lineTo(margin, height - margin - len), bracketPaint);
    // Bottom Right
    canvas.drawPath(Path()..moveTo(width - margin - len, height - margin)..lineTo(width - margin, height - margin)..lineTo(width - margin, height - margin - len), bracketPaint);

    // 3. Draw center crosshair
    canvas.drawLine(Offset(width / 2 - 10, height / 2), Offset(width / 2 + 10, height / 2), bracketPaint);
    canvas.drawLine(Offset(width / 2, height / 2 - 10), Offset(width / 2, height / 2 + 10), bracketPaint);

    // 4. Draw Bed & Silhouette
    final bedPaint = Paint()
      ..color = const Color(0xFF39FF14).withOpacity(0.25)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;

    final bedY = height * 0.65;
    final bedX1 = width * 0.15;
    final bedX2 = width * 0.85;

    // Bed base frame & legs
    canvas.drawLine(Offset(bedX1, bedY), Offset(bedX2, bedY), bedPaint);
    canvas.drawLine(Offset(bedX1 + 30, bedY), Offset(bedX1 + 30, bedY + 45), bedPaint);
    canvas.drawLine(Offset(bedX2 - 30, bedY), Offset(bedX2 - 30, bedY + 45), bedPaint);
    canvas.drawLine(Offset(bedX1, bedY), Offset(bedX1 - 12, bedY - 30), bedPaint); // headrest

    // Chest rise animation expansion (sine wave breathing)
    final breathTime = timestamp / 4000.0;
    final chestExpansion = 5.0 * math.sin(breathTime * 2 * math.pi);

    final patientPaint = Paint()
      ..color = const Color(0xFF39FF14).withOpacity(0.55)
      ..strokeWidth = 2.0
      ..style = PaintingStyle.stroke;

    final pHeadX = bedX1 + 60;
    final pHeadY = bedY - 25;
    final pChestX = pHeadX + 45;
    final pChestY = bedY - 15;

    // Pillow
    canvas.drawArc(Rect.fromCircle(center: Offset(pHeadX - 10, bedY - 8), radius: 10), math.pi, math.pi, false, bedPaint);
    
    // Head
    canvas.drawCircle(Offset(pHeadX, pHeadY), 10.0, patientPaint);
    
    // Neck & Shoulder
    canvas.drawLine(Offset(pHeadX + 8, pHeadY + 5), Offset(pHeadX + 16, bedY - 8), patientPaint);

    // Chest & body path with breathing
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

    // IV Stand
    final ivX = pHeadX - 25;
    canvas.drawLine(Offset(ivX, bedY + 30), Offset(ivX, bedY - 90), bedPaint);
    canvas.drawLine(Offset(ivX - 10, bedY - 90), Offset(ivX + 10, bedY - 90), bedPaint);
    canvas.drawRect(Rect.fromLTWH(ivX - 8, bedY - 82, 6, 14), bedPaint); // fluid bag
    // drip wire
    final wirePath = Path()
      ..moveTo(ivX - 5, bedY - 68)
      ..cubicTo(ivX - 5, bedY - 30, pChestX - 10, bedY, pChestX + 5, bedY - 6);
    canvas.drawPath(wirePath, bedPaint);

    // HUD Text Overlay
    final textPainter = TextPainter(textDirection: TextDirection.ltr);

    // REC text (flashing)
    final bool isRecFlash = (timestamp ~/ 600) % 2 == 0;
    if (isRecFlash) {
      // Red dot
      canvas.drawCircle(const Offset(margin + 10, margin + 12), 4.0, Paint()..color = const Color(0xFFFF073A));
      
      textPainter.text = const TextSpan(
        text: 'REC',
        style: TextStyle(color: Color(0xFFFF3366), fontSize: 10, fontWeight: FontWeight.bold,),
      );
      textPainter.layout();
      textPainter.paint(canvas, const Offset(margin + 20, margin + 6));
    }

    // Camera name
    textPainter.text = const TextSpan(
      text: 'CAM 04 - ICU ROOM',
      style: TextStyle(color: Color(0xFF39FF14), fontSize: 10, fontWeight: FontWeight.bold,),
    );
    textPainter.layout();
    textPainter.paint(canvas, const Offset(margin + 10, margin + 26));

    // Connection status
    textPainter.text = const TextSpan(
      text: 'CONN: ACTIVE',
      style: TextStyle(color: Color(0xFF39FF14), fontSize: 9, fontWeight: FontWeight.bold,),
    );
    textPainter.layout();
    textPainter.paint(canvas, Offset(width - margin - 80, margin + 10));

    // Clock Timecode
    textPainter.text = TextSpan(
      text: timeString,
      style: const TextStyle(color: Color(0xFF39FF14), fontSize: 10, fontWeight: FontWeight.bold,),
    );
    textPainter.layout();
    textPainter.paint(canvas, Offset(margin + 10, height - margin - 15));
  }

  @override
  bool shouldRepaint(covariant _IcuCameraPainter oldDelegate) {
    return oldDelegate.timestamp != timestamp || oldDelegate.timeString != timeString;
  }
}

// Custom Painter for CRT Scanline Overlay
class _CrtOverlayPainter extends CustomPainter {
  final double timestamp;

  _CrtOverlayPainter({required this.timestamp});

  @override
  void paint(Canvas canvas, Size size) {
    final width = size.width;
    final height = size.height;

    // Moving scanline
    final scanlinePaint = Paint()
      ..color = const Color(0xFF39FF14).withOpacity(0.08)
      ..strokeWidth = 2.0;

    final double speed = (timestamp / 12) % height;
    canvas.drawLine(Offset(0, speed), Offset(width, speed), scanlinePaint);
    canvas.drawLine(Offset(0, (speed + 8) % height), Offset(width, (speed + 8) % height), scanlinePaint..color = const Color(0xFF39FF14).withOpacity(0.04));
  }

  @override
  bool shouldRepaint(covariant _CrtOverlayPainter oldDelegate) => true;
}
