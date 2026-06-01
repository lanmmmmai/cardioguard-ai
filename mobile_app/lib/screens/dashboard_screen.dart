import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:lucide_flutter/lucide_flutter.dart';

import '../providers/auth_provider.dart';
import '../providers/patient_provider.dart';
import '../providers/alert_provider.dart';
import '../services/websocket_service.dart';
import '../widgets/ecg_painter.dart';
import '../widgets/heart_3d_painter.dart';
import '../widgets/cg_widgets.dart';
import '../ui/cg_tokens.dart';

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

class _DashboardScreenState extends State<DashboardScreen>
    with TickerProviderStateMixin {
  // Local ECG point buffer
  final List<double> _ecgPoints = List.filled(240, 0.0, growable: true);

  // Animation controller for 3D Heart
  late AnimationController _tickerController;
  late List<Point3D> _heartPoints;
  double _angleY = 0.0;
  double _angleX = 0.0;
  double _pulse = 0.0;

  // Selected Patient for Doctor/Admin
  String? _selectedPatientId;

  // SOS state
  bool _isSosCounting = false;
  int _sosCountdown = 3;
  Timer? _sosTimer;

  // Banner alert
  String? _activeBannerMessage;
  bool _isBannerFlash = false;
  Timer? _bannerTimer;

  @override
  void initState() {
    super.initState();
    _heartPoints = Heart3dPainter.generateHeartPoints();

    // 60FPS animation ticker for heart rotation and beat pulse
    _tickerController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3600),
    )..addListener(_onAnimationTick);
    _tickerController.forward();

    // Register WebSocket listeners
    WebSocketService.connect();
    WebSocketService.addListener(_onWebSocketEvent);

    // Initial load
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final authProvider = Provider.of<AuthProvider>(context, listen: false);
      final patientProvider =
          Provider.of<PatientProvider>(context, listen: false);

      if (authProvider.currentUser?.role == 'patient') {
        _selectedPatientId = authProvider.currentUser?.id;
        patientProvider.fetchMyProfile();
      } else {
        patientProvider.fetchPatients().then((_) {
          if (patientProvider.patients.isNotEmpty) {
            setState(() {
              _selectedPatientId = patientProvider.patients.first.id;
            });
          }
        });
      }
    });
  }

  @override
  void dispose() {
    _tickerController.dispose();
    WebSocketService.removeListener(_onWebSocketEvent);
    _bannerTimer?.cancel();
    _sosTimer?.cancel();
    super.dispose();
  }

  void _onWebSocketEvent(Map<String, dynamic> event) {
    if (!mounted) return;

    final type = event['type'];
    final patientId = event['patient_id'];

    if (type == 'health_metrics' && patientId == _selectedPatientId) {
      final metrics = event['data'] as Map<String, dynamic>;
      final patientProvider =
          Provider.of<PatientProvider>(context, listen: false);

      // Update provider state
      patientProvider.updateLiveMetrics(metrics);

      // Add ECG point
      final double ecgVal = (metrics['ecg_value'] as num).toDouble();
      setState(() {
        _ecgPoints.removeAt(0);
        _ecgPoints.add(ecgVal);
      });
    } else if (type == 'emergency_alerts') {
      final alertData = event['data'] as Map<String, dynamic>;
      final alertProvider = Provider.of<AlertProvider>(context, listen: false);

      // Update alert list
      alertProvider.addOrUpdateRealtimeAlert(alertData);

      // Trigger warning banner
      if (alertData['is_resolved'] == false) {
        setState(() {
          _activeBannerMessage =
              '${alertData['full_name'] ?? 'Bệnh nhân'}: ${alertData['message']}';
        });
        _triggerBannerFlash();
      }
    }
  }

  void _triggerBannerFlash() {
    _bannerTimer?.cancel();
    _isBannerFlash = true;

    // Auto dismiss banner after 8 seconds
    Future.delayed(const Duration(seconds: 8), () {
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
    final patientProvider =
        Provider.of<PatientProvider>(context, listen: false);
    final double hr = patientProvider.liveMetrics['heart_rate'].toDouble();

    setState(() {
      _angleY += 0.015;
      _angleX = 0.2 * math.sin(elapsedMs * 0.0005);

      // Pulse physics
      final cycleDuration = (60 / math.max(hr, 40)) * 1000;
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

      // If no live telemetry, generate mock ECG
      final hasLiveWS = patientProvider.liveMetrics['ecg_value'] != 0.0;
      if (!hasLiveWS) {
        double simEcg = 0.0;
        final tSim = (elapsedMs % cycleDuration) / cycleDuration;

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

  void _triggerSos() {
    HapticFeedback.heavyImpact();
    setState(() {
      _isSosCounting = true;
      _sosCountdown = 3;
    });

    _sosTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      setState(() {
        if (_sosCountdown > 1) {
          _sosCountdown--;
        } else {
          _sosTimer?.cancel();
          _isSosCounting = false;
          _sendSosAlert();
        }
      });
    });
  }

  void _cancelSos() {
    _sosTimer?.cancel();
    setState(() {
      _isSosCounting = false;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
          content: Text('Đã hủy yêu cầu SOS.'), backgroundColor: Colors.orange),
    );
  }

  Future<void> _sendSosAlert() async {
    final alertProvider = Provider.of<AlertProvider>(context, listen: false);
    final success = await alertProvider
        .triggerSosAlert('YÊU CẦU SOS KHẨN CẤP TỪ THIẾT BỊ DI ĐỘNG');
    if (mounted) {
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('ĐÃ GỬI TÍN HIỆU CỨU HỘ KHẨN CẤP SOS!'),
            backgroundColor: Color(0xFFFF0055),
            duration: Duration(seconds: 5),
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Gửi SOS thất bại. Kiểm tra kết nối mạng!'),
              backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final patientProvider = Provider.of<PatientProvider>(context);
    final alertProvider = Provider.of<AlertProvider>(context);

    final isDark = widget.isDarkTheme;
    final primaryBg =
        isDark ? const Color(0xFF07080A) : const Color(0xFFF5F6F8);
    final cardBg = isDark ? const Color(0xFF11151D) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF1D2939);
    final textMuted =
        isDark ? const Color(0xFF9EA5B4) : const Color(0xFF475467);
    final borderColor = isDark
        ? Colors.white.withValues(alpha: 0.07)
        : Colors.black.withValues(alpha: 0.08);

    final role = authProvider.currentUser?.role ?? 'patient';
    final liveMetrics = patientProvider.liveMetrics;
    final hrVal = liveMetrics['heart_rate'];
    final spo2Val = liveMetrics['spo2'];
    final sysBp = liveMetrics['systolic_bp'];
    final diaBp = liveMetrics['diastolic_bp'];
    final isAbnormal = liveMetrics['is_abnormal'] == true;

    return Scaffold(
      backgroundColor: primaryBg,
      body: SafeArea(
        child: Column(
          children: [
            // Warning Banner
            if (_activeBannerMessage != null)
              Container(
                color: _isBannerFlash
                    ? CgColors.critical
                    : const Color(0xFF7A271A),
                padding:
                    const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                width: double.infinity,
                child: Row(
                  children: [
                    const Icon(LucideIcons.alertTriangle,
                        color: Colors.white, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'CẢNH BÁO: $_activeBannerMessage',
                        style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 13),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(LucideIcons.x,
                          color: Colors.white, size: 16),
                      onPressed: () =>
                          setState(() => _activeBannerMessage = null),
                    ),
                  ],
                ),
              ),

            // Top Bar
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        role == 'patient'
                            ? 'Chỉ số sức khỏe'
                            : 'Giám Sát Trung Tâm',
                        style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            color: textColor),
                      ),
                      const SizedBox(height: 4),
                      if (role != 'patient' &&
                          patientProvider.patients.isNotEmpty)
                        Row(
                          children: [
                            Text('Bệnh nhân: ',
                                style:
                                    TextStyle(color: textMuted, fontSize: 13)),
                            DropdownButton<String>(
                              value: _selectedPatientId,
                              dropdownColor: cardBg,
                              style: const TextStyle(
                                  color: Color(0xFFFF3366),
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14),
                              underline: const SizedBox(),
                              items: patientProvider.patients.map((p) {
                                return DropdownMenuItem(
                                    value: p.id, child: Text(p.fullName));
                              }).toList(),
                              onChanged: (id) {
                                if (id != null) {
                                  setState(() {
                                    _selectedPatientId = id;
                                    _ecgPoints.fillRange(
                                        0, _ecgPoints.length, 0.0);
                                  });
                                }
                              },
                            ),
                          ],
                        )
                      else if (role == 'patient')
                        Text(
                          'Theo dõi sinh học trực tiếp của bạn',
                          style: TextStyle(color: textMuted, fontSize: 13),
                        ),
                    ],
                  ),
                  IconButton(
                    onPressed: widget.onToggleTheme,
                    icon: Icon(
                      isDark ? LucideIcons.sun : LucideIcons.moon,
                      color: isDark
                          ? const Color(0xFFFFB606)
                          : const Color(0xFF475467),
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

            // Main Content Area
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 16.0),
                child: Column(
                  children: [
                    // System Dashboard Cards (Admin Only)
                    if (role == 'admin') ...[
                      GridView.count(
                        crossAxisCount: 2,
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        crossAxisSpacing: 12,
                        mainAxisSpacing: 12,
                        childAspectRatio: 2.8,
                        children: [
                          _buildSummaryCard(
                              'Bệnh nhân',
                              '${patientProvider.patients.length}',
                              LucideIcons.users,
                              Colors.blue,
                              cardBg,
                              textColor,
                              textMuted,
                              borderColor),
                          _buildSummaryCard(
                              'Cảnh báo hoạt động',
                              '${alertProvider.activeAlertCount}',
                              LucideIcons.bell,
                              Colors.red,
                              cardBg,
                              textColor,
                              textMuted,
                              borderColor),
                        ],
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Vitals Grid
                    GridView.count(
                      crossAxisCount: 1,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      mainAxisSpacing: 12,
                      childAspectRatio: 3.5,
                      children: [
                        _buildMetricCard(
                            'NHỊP TIM',
                            '$hrVal',
                            'BPM',
                            LucideIcons.heart,
                            CgColors.hr,
                            isAbnormal && hrVal > 100,
                            cardBg,
                            textColor,
                            textMuted,
                            borderColor),
                        _buildMetricCard(
                            'NỒNG ĐỘ OXY (SPO2)',
                            '$spo2Val',
                            '%',
                            LucideIcons.droplet,
                            CgColors.spo2,
                            isAbnormal && spo2Val < 94,
                            cardBg,
                            textColor,
                            textMuted,
                            borderColor),
                        _buildMetricCard(
                            'HUYẾT ÁP (BP)',
                            '$sysBp/$diaBp',
                            'mmHg',
                            LucideIcons.activity,
                            CgColors.bp,
                            isAbnormal && (sysBp > 135 || sysBp < 95),
                            cardBg,
                            textColor,
                            textMuted,
                            borderColor),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // ECG Panel
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
                              Text('ĐIỆN TÂM ĐỒ (ECG)',
                                  style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.bold,
                                      color: textMuted)),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF00F2FE)
                                      .withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: const Text('LIVE MONITOR',
                                    style: TextStyle(
                                        fontSize: 9,
                                        color: Color(0xFF00F2FE),
                                        fontWeight: FontWeight.bold)),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Container(
                              height: 140,
                              color: isDark
                                  ? Colors.black.withValues(alpha: 0.2)
                                  : Colors.black.withValues(alpha: 0.02),
                              width: double.infinity,
                              child: CustomPaint(
                                painter: EcgPainter(
                                  dataPoints: List<double>.from(_ecgPoints),
                                  heartRate: hrVal.toDouble(),
                                  isDarkTheme: isDark,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // 3D Rotating Heart beat
                    Container(
                      height: 240,
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
                              'TRỰC QUAN TIM PHỔI (${hrVal.toInt()} BPM)',
                              style: const TextStyle(
                                  color: Color(0xFFFF3366),
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 1),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),

                    // SOS / Simulation Controls Panel
                    if (role == 'patient') ...[
                      // Patient SOS Button
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: cardBg,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: borderColor),
                        ),
                        child: Column(
                          children: [
                            const Text(
                              'GỬI CỨU HỘ KHẨN CẤP',
                              style: TextStyle(
                                  fontWeight: FontWeight.bold, fontSize: 14),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Nhấn giữ nút SOS bên dưới trong trường hợp bạn cần sự giúp đỡ lập tức từ bác sĩ điều trị.',
                              style: TextStyle(color: textMuted, fontSize: 12),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 20),
                            if (_isSosCounting) ...[
                              Column(
                                children: [
                                  Text(
                                    'ĐANG KÍCH HOẠT TRONG $_sosCountdown S',
                                    style: const TextStyle(
                                        color: Color(0xFFFF0055),
                                        fontWeight: FontWeight.bold,
                                        fontSize: 16),
                                  ),
                                  const SizedBox(height: 12),
                                  ElevatedButton(
                                    onPressed: _cancelSos,
                                    style: ElevatedButton.styleFrom(
                                        backgroundColor: Colors.grey),
                                    child: const Text('Hủy bỏ yêu cầu',
                                        style: TextStyle(color: Colors.white)),
                                  ),
                                ],
                              ),
                            ] else ...[
                              GestureDetector(
                                onLongPress: _triggerSos,
                                child: Container(
                                  width: 100,
                                  height: 100,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: const Color(0xFFFF0055)
                                        .withValues(alpha: 0.1),
                                    border: Border.all(
                                        color: const Color(0xFFFF0055),
                                        width: 3),
                                    boxShadow: [
                                      BoxShadow(
                                        color: const Color(0xFFFF0055)
                                            .withValues(alpha: 0.2),
                                        blurRadius: 16,
                                        spreadRadius: 2,
                                      )
                                    ],
                                  ),
                                  child: const Center(
                                    child: Text(
                                      'SOS',
                                      style: TextStyle(
                                        color: Color(0xFFFF0055),
                                        fontSize: 26,
                                        fontWeight: FontWeight.w900,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 10),
                              Text('Nhấn giữ nút để gửi',
                                  style: TextStyle(
                                      color: textMuted, fontSize: 11)),
                            ],
                          ],
                        ),
                      ),
                    ] else ...[
                      // Doctor/Admin Simulator Controls
                      Container(
                        padding: const EdgeInsets.all(20),
                        decoration: BoxDecoration(
                          color: cardBg,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: borderColor),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('THIẾT BỊ MÔ PHỎNG LÂM SÀNG',
                                style: TextStyle(
                                    fontWeight: FontWeight.bold, fontSize: 14)),
                            const SizedBox(height: 6),
                            Text(
                                'Mô phỏng trạng thái sinh học bất thường để kiểm tra hệ thống báo động.',
                                style:
                                    TextStyle(color: textMuted, fontSize: 12)),
                            const SizedBox(height: 16),
                            Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton(
                                    onPressed: _selectedPatientId == null
                                        ? null
                                        : () =>
                                            patientProvider.triggerSimulation(
                                                _selectedPatientId!, false),
                                    style: OutlinedButton.styleFrom(
                                      side: const BorderSide(
                                          color: Color(0xFF39FF14)),
                                      shape: RoundedRectangleBorder(
                                          borderRadius:
                                              BorderRadius.circular(12)),
                                    ),
                                    child: const Text('Bình thường',
                                        style: TextStyle(
                                            color: Color(0xFF39FF14))),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: ElevatedButton(
                                    onPressed: _selectedPatientId == null
                                        ? null
                                        : () =>
                                            patientProvider.triggerSimulation(
                                                _selectedPatientId!, true),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFFFF3366),
                                      shape: RoundedRectangleBorder(
                                          borderRadius:
                                              BorderRadius.circular(12)),
                                    ),
                                    child: const Text('Bất thường',
                                        style: TextStyle(color: Colors.white)),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 30),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryCard(
      String title,
      String value,
      IconData icon,
      Color color,
      Color cardBg,
      Color textColor,
      Color textMuted,
      Color borderColor) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: borderColor),
      ),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: color.withValues(alpha: 0.1),
            child: Icon(icon, color: color, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(title,
                    style: TextStyle(
                        fontSize: 10,
                        color: textMuted,
                        fontWeight: FontWeight.bold)),
                const SizedBox(height: 2),
                Text(value,
                    style: TextStyle(
                        fontSize: 18,
                        color: textColor,
                        fontWeight: FontWeight.bold)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricCard(
    String title,
    String value,
    String unit,
    IconData icon,
    Color accentColor,
    bool isCritical,
    Color cardBg,
    Color textColor,
    Color textMuted,
    Color borderColor,
  ) {
    final glowColor = accentColor.withValues(alpha: 0.1);
    return Container(
      margin: const EdgeInsets.only(bottom: 2),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isCritical ? const Color(0xFFFF0055) : borderColor,
          width: isCritical ? 1.8 : 1.0,
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            child: Container(color: accentColor),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(title,
                        style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                            color: textMuted,
                            letterSpacing: 0.5)),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        CgMetricValue(
                            value: value,
                            unit: unit,
                            color: textColor,
                            valueSize: 24),
                      ],
                    ),
                  ],
                ),
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                      color: glowColor, borderRadius: BorderRadius.circular(8)),
                  child: Icon(icon, color: accentColor, size: 14),
                )
              ],
            ),
          )
        ],
      ),
    );
  }
}
