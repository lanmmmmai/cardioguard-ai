import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../services/api_service.dart';
import '../services/websocket_service.dart';
import '../widgets/ecg_painter.dart';
import '../widgets/heart_3d_painter.dart';

class DashboardScreen extends StatefulWidget {
  final VoidCallback onToggleTheme;
  final bool isDarkTheme;

  const DashboardScreen({
    super.key,
    required this.onToggleTheme,
    required this.isDarkTheme,
  });

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> with TickerProviderStateMixin {
  // Telemetry state
  Map<String, dynamic>? _telemetry;
  List<double> _ecgPoints = List.filled(300, 0.0);
  List<dynamic> _patients = [];
  String? _selectedPatientId;
  String _selectedPatientName = 'Chưa chọn';

  // Flashing banner alert
  String? _activeBannerMessage;
  bool _isBannerFlash = false;
  Timer? _bannerTimer;

  // 3D Heart rotation ticker
  late AnimationController _tickerController;
  late List<Point3D> _heartPoints;
  double _angleY = 0.0;
  double _angleX = 0.0;
  double _pulse = 0.0;
  double _heartRate = 75.0;

  @override
  void initState() {
    super.initState();
    _heartPoints = Heart3dPainter.generateHeartPoints();

    // 60FPS animation ticker for 3D heart rotation & beating pulse
    _tickerController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3600), // long duration
    )..addListener(_onAnimationTick);
    _tickerController.forward();

    // Load initial patients database
    _loadPatients();

    // Listen to live websockets
    WebSocketService.connect();
    WebSocketService.addListener(_onTelemetryReceived);
  }

  void _loadPatients() async {
    final list = await ApiService.getPatients();
    setState(() {
      _patients = list;
      if (list.isNotEmpty) {
        _selectedPatientId = list.first['id'];
        _selectedPatientName = list.first['full_name'];
      }
    });
  }

  void _onTelemetryReceived(Map<String, dynamic> data) {
    if (!mounted) return;

    // Filter telemetry matching selected patient
    if (_selectedPatientId == null || data['patient_id'] == _selectedPatientId) {
      setState(() {
        _telemetry = data;
        _heartRate = (data['heart_rate'] as num).toDouble();

        // Feed ECG point
        final double ecgVal = (data['ecg_value'] as num).toDouble();
        _ecgPoints.removeAt(0);
        _ecgPoints.add(ecgVal);

        // Handle abnormal alert triggers
        if (data['is_abnormal'] == true && data['alerts'] != null && (data['alerts'] as List).isNotEmpty) {
          final firstAlert = data['alerts'][0];
          _activeBannerMessage = '${_selectedPatientName} - ${firstAlert['message']}!';
          _triggerAlertBannerFlash();
        }
      });
    }
  }

  void _triggerAlertBannerFlash() {
    _bannerTimer?.cancel();
    _isBannerFlash = true;
    _bannerTimer = Timer.periodic(const Duration(milliseconds: 500), (timer) {
      if (mounted) {
        setState(() {
          _isBannerFlash = !_isBannerFlash;
        });
      }
    });

    // Auto-dismiss alert after 7 seconds
    Future.delayed(const Duration(seconds: 7), () {
      _bannerTimer?.cancel();
      if (mounted) {
        setState(() {
          _activeBannerMessage = null;
        });
      }
    });
  }

  void _onAnimationTick() {
    final elapsedMs = DateTime.now().millisecondsSinceEpoch;
    
    // Rotate heart
    setState(() {
      _angleY += 0.015;
      _angleX = 0.2 * math.sin(elapsedMs * 0.0005);

      // Simulating heartbeat pulses if no live incoming telemetry is present
      final cycleDuration = (60 / math.max(_heartRate, 40)) * 1000;
      final t = (elapsedMs % cycleDuration) / cycleDuration;
      
      if (t < 0.1) {
        _pulse = 0.04 * math.sin(t * math.pi / 0.1);
      } else if (t >= 0.15 && t < 0.22) {
        _pulse = 0.22 * math.sin((t - 0.15) * math.pi / 0.07);
      } else if (t >= 0.22 && t < 0.38) {
        _pulse = 0.06 * math.sin((t - 0.22) * math.pi / 0.16);
      } else {
        _pulse = 0.0;
      }

      // If there is no live WS telemetry, push mock points into ECG so it keeps running
      if (_telemetry == null) {
        final double tSim = (elapsedMs % cycleDuration) / cycleDuration;
        double simEcg = 0.0;

        if (tSim > 0.1 && tSim < 0.15) {
          simEcg = 0.15 * math.sin((tSim - 0.1) * math.pi / 0.05);
        } else if (tSim >= 0.18 && tSim < 0.2) {
          simEcg = -0.2 * (tSim - 0.18) / 0.02;
        } else if (tSim >= 0.2 && tSim < 0.23) {
          simEcg = -0.2 + 1.2 * (tSim - 0.2) / 0.03;
        } else if (tSim >= 0.23 && tSim < 0.26) {
          simEcg = 1.0 - 1.4 * (tSim - 0.23) / 0.03;
        } else if (tSim >= 0.26 && tSim < 0.29) {
          simEcg = -0.4 + 0.4 * (tSim - 0.26) / 0.03;
        } else if (tSim >= 0.35 && tSim < 0.45) {
          simEcg = 0.25 * math.sin((tSim - 0.35) * math.pi / 0.1);
        } else {
          simEcg = (math.Random().nextDouble() - 0.5) * 0.02;
        }

        _ecgPoints.removeAt(0);
        _ecgPoints.add(simEcg);
      }
    });
  }

  void _triggerSimulator(bool isAbnormal) async {
    if (_selectedPatientId != null) {
      await ApiService.triggerSimulation(_selectedPatientId!, isAbnormal);
    }
  }

  @override
  void dispose() {
    _tickerController.dispose();
    WebSocketService.removeListener(_onTelemetryReceived);
    _bannerTimer?.cancel();
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

    // Read live metric variables
    final hrVal = _telemetry != null ? (_telemetry!['heart_rate'] as num).toInt() : 75;
    final spo2Val = _telemetry != null ? (_telemetry!['spo2'] as num).toInt() : 98;
    final sysBp = _telemetry != null ? (_telemetry!['systolic_bp'] as num).toInt() : 120;
    final diaBp = _telemetry != null ? (_telemetry!['diastolic_bp'] as num).toInt() : 80;
    final isAbnormal = _telemetry != null ? _telemetry!['is_abnormal'] as bool : false;

    return Scaffold(
      backgroundColor: primaryBg,
      body: SafeArea(
        child: Column(
          children: [
            // Flashing Warning Banner
            if (_activeBannerMessage != null)
              AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                color: _isBannerFlash ? const Color(0xFFFF0055) : const Color(0xFFB2003B),
                padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
                width: double.infinity,
                child: Row(
                  children: [
                    const Icon(LucideIcons.alertOctagon, color: Colors.white, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'CẢNH BÁO NGUY KỊCH: $_activeBannerMessage',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                          fontFamily: 'Futura',
                        ),
                      ),
                    ),
                  ],
                ),
              ),

            // Top bar
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Giám Sát Trung Tâm',
                        style: TextStyle(
                          fontFamily: 'Futura',
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: textColor,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Text('Bệnh nhân đang theo dõi: ', style: TextStyle(color: textMuted, fontSize: 13, fontFamily: 'Futura')),
                          DropdownButton<String>(
                            value: _selectedPatientId,
                            dropdownColor: isDark ? const Color(0xFF131720) : Colors.white,
                            style: TextStyle(color: const Color(0xFFFF3366), fontWeight: FontWeight.bold, fontFamily: 'Futura', fontSize: 13),
                            underline: const SizedBox(),
                            items: _patients.map<DropdownMenuItem<String>>((p) {
                              return DropdownMenuItem<String>(
                                value: p['id'],
                                child: Text(p['full_name']),
                              );
                            }).toList(),
                            onChanged: (id) {
                              if (id != null) {
                                final p = _patients.firstWhere((element) => element['id'] == id);
                                setState(() {
                                  _selectedPatientId = id;
                                  _selectedPatientName = p['full_name'];
                                  _telemetry = null; // Clear previous telemetry
                                });
                              }
                            },
                          ),
                        ],
                      ),
                    ],
                  ),
                  // Theme switch button
                  IconButton(
                    onPressed: widget.onToggleTheme,
                    icon: Icon(
                      widget.isDarkTheme ? LucideIcons.sun : LucideIcons.moon,
                      color: widget.isDarkTheme ? const Color(0xFFFFB606) : const Color(0xFF475467),
                    ),
                    style: IconButton.styleFrom(
                      backgroundColor: cardBg,
                      shape: const CircleBorder(),
                      side: BorderSide(color: borderColor),
                    ),
                  )
                ],
              ),
            ),

            // Metrics grid
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 16.0),
                child: Column(
                  children: [
                    // Grid containing 3 vital indicators
                    LayoutBuilder(
                      builder: (context, constraints) {
                        return GridView.count(
                          crossAxisCount: constraints.maxWidth > 500 ? 3 : 1,
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 12,
                          childAspectRatio: 2.2,
                          children: [
                            // Heart Rate
                            _buildMetricCard(
                              title: 'NHỊP TIM',
                              value: '$hrVal',
                              unit: 'BPM',
                              icon: LucideIcons.heart,
                              accentColor: const Color(0xFFFF3366),
                              glowColor: const Color(0xFFFF3366).withOpacity(0.12),
                              isCritical: isAbnormal && hrVal > 120,
                              cardBg: cardBg,
                              textColor: textColor,
                              textMuted: textMuted,
                              borderColor: borderColor,
                            ),
                            // SpO2
                            _buildMetricCard(
                              title: 'NỒNG ĐỘ OXY (SPO2)',
                              value: '$spo2Val',
                              unit: '%',
                              icon: LucideIcons.droplet,
                              accentColor: const Color(0xFF00F2FE),
                              glowColor: const Color(0xFF00F2FE).withOpacity(0.12),
                              isCritical: isAbnormal && spo2Val < 92,
                              cardBg: cardBg,
                              textColor: textColor,
                              textMuted: textMuted,
                              borderColor: borderColor,
                            ),
                            // Blood Pressure
                            _buildMetricCard(
                              title: 'HUYẾT ÁP (BP)',
                              value: '$sysBp/$diaBp',
                              unit: 'mmHg',
                              icon: LucideIcons.activity,
                              accentColor: const Color(0xFF39FF14),
                              glowColor: const Color(0xFF39FF14).withOpacity(0.12),
                              isCritical: isAbnormal && (sysBp > 140 || sysBp < 90),
                              cardBg: cardBg,
                              textColor: textColor,
                              textMuted: textMuted,
                              borderColor: borderColor,
                            ),
                          ],
                        );
                      },
                    ),
                    const SizedBox(height: 16),

                    // ECG Widget Panel
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: cardBg,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: borderColor),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'TÍN HIỆU ĐIỆN TÂM ĐỒ (ECG)',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: textMuted,
                                  fontFamily: 'Futura',
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF00F2FE).withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: const Text(
                                  'LIVE MONITOR',
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: Color(0xFF00F2FE),
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: SizedBox(
                              height: 160,
                              width: double.infinity,
                              child: CustomPaint(
                                painter: EcgPainter(
                                  dataPoints: _ecgPoints,
                                  heartRate: _heartRate,
                                  isDarkTheme: isDark,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // 3D Heart point cloud & simulation controls panel
                    LayoutBuilder(
                      builder: (context, constraints) {
                        return Flex(
                          direction: constraints.maxWidth > 500 ? Axis.horizontal : Axis.vertical,
                          children: [
                            // 3D Heart display
                            Expanded(
                              flex: constraints.maxWidth > 500 ? 1 : 0,
                              child: Container(
                                height: 260,
                                margin: EdgeInsets.only(bottom: constraints.maxWidth > 500 ? 0 : 16),
                                decoration: BoxDecoration(
                                  color: cardBg,
                                  borderRadius: BorderRadius.circular(18),
                                  border: Border.all(color: borderColor),
                                ),
                                child: Stack(
                                  alignment: Alignment.center,
                                  children: [
                                    CustomPaint(
                                      size: const Size(200, 200),
                                      painter: Heart3dPainter(
                                        points: _heartPoints,
                                        angleY: _angleY,
                                        angleX: _angleX,
                                        pulse: _pulse,
                                        isDarkTheme: isDark,
                                      ),
                                    ),
                                    Positioned(
                                      bottom: 12,
                                      child: Text(
                                        '3D CARDIAC BEAT (${_heartRate.toInt()} BPM)',
                                        style: const TextStyle(
                                          color: Color(0xFFFF3366),
                                          fontSize: 11,
                                          fontWeight: FontWeight.bold,
                                          letterSpacing: 1,
                                          fontFamily: 'Futura',
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            if (constraints.maxWidth > 500) const SizedBox(width: 16),
                            // Simulator Control
                            Expanded(
                              flex: constraints.maxWidth > 500 ? 1 : 0,
                              child: Container(
                                height: 260,
                                padding: const EdgeInsets.all(20),
                                decoration: BoxDecoration(
                                  color: cardBg,
                                  borderRadius: BorderRadius.circular(18),
                                  border: Border.all(color: borderColor),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                      'TRÌNH GIẢ LẬP CẢM BIẾN',
                                      style: TextStyle(
                                        fontFamily: 'Futura',
                                        fontSize: 14,
                                        fontWeight: FontWeight.bold,
                                        color: textColor,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    Text(
                                      'Mô phỏng dữ liệu sinh lý học từ xa của thiết bị cầm tay để kiểm thử chuông báo động.',
                                      style: TextStyle(color: textMuted, fontSize: 12, fontFamily: 'Futura'),
                                    ),
                                    const SizedBox(height: 24),
                                    Row(
                                      children: [
                                        Expanded(
                                          child: SizedBox(
                                            height: 44,
                                            child: OutlinedButton.icon(
                                              onPressed: () => _triggerSimulator(false),
                                              icon: const Icon(LucideIcons.heartHandshake, color: Color(0xFF39FF14), size: 16),
                                              label: const Text('Bình thường', style: TextStyle(color: Color(0xFF39FF14), fontFamily: 'Futura')),
                                              style: OutlinedButton.styleFrom(
                                                side: const BorderSide(color: Color(0xFF39FF14)),
                                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                              ),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: SizedBox(
                                            height: 44,
                                            child: ElevatedButton.icon(
                                              onPressed: () => _triggerSimulator(true),
                                              icon: const Icon(LucideIcons.alertCircle, color: Colors.white, size: 16),
                                              label: const Text('Bất thường', style: TextStyle(color: Colors.white, fontFamily: 'Futura')),
                                              style: ElevatedButton.styleFrom(
                                                backgroundColor: const Color(0xFFFF3366),
                                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                              ),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricCard({
    required String title,
    required String value,
    required String unit,
    required IconData icon,
    required Color accentColor,
    required Color glowColor,
    required bool isCritical,
    required Color cardBg,
    required Color textColor,
    required Color textMuted,
    required Color borderColor,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isCritical ? const Color(0xFFFF0055) : borderColor,
          width: isCritical ? 2.0 : 1.0,
        ),
        boxShadow: isCritical
            ? [
                BoxShadow(
                  color: const Color(0xFFFF0055).withOpacity(0.2),
                  blurRadius: 12,
                  spreadRadius: 2,
                )
              ]
            : [],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: textMuted,
                    letterSpacing: 0.5,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  color: glowColor,
                ),
                child: Icon(icon, color: accentColor, size: 14),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            baseline: TextBaseline.alphabetic,
            crossAxisAlignment: CrossAxisAlignment.baseline,
            children: [
              Text(
                value,
                style: TextStyle(
                  fontFamily: 'Futura',
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                  color: textColor,
                  letterSpacing: -1,
                ),
              ),
              const SizedBox(width: 4),
              Text(
                unit,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: textMuted,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
