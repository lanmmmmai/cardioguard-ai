import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:fl_chart/fl_chart.dart';
import '../services/websocket_service.dart';

class PatientDetailScreen extends StatefulWidget {
  final Map<String, dynamic> patient;
  final bool isDarkTheme;

  const PatientDetailScreen({
    super.key,
    required this.patient,
    required this.isDarkTheme,
  });

  @override
  State<PatientDetailScreen> createState() => _PatientDetailScreenState();
}

class _PatientDetailScreenState extends State<PatientDetailScreen> {
  // Real-time histories (limited to last 15 points)
  final List<FlSpot> _hrSpots = [];
  final List<FlSpot> _spo2Spots = [];
  int _tickCount = 0;

  double _currentHr = 75.0;
  double _currentSpo2 = 98.0;
  double _currentSysBp = 120.0;
  double _currentDiaBp = 80.0;

  @override
  void initState() {
    super.initState();
    // Fill initially with dummy stable points
    for (int i = 0; i < 15; i++) {
      _hrSpots.add(FlSpot(i.toDouble(), 75.0));
      _spo2Spots.add(FlSpot(i.toDouble(), 98.0));
    }
    _tickCount = 15;

    // Listen to WebSocket broadcasts
    WebSocketService.addListener(_onTelemetryReceived);
  }

  void _onTelemetryReceived(Map<String, dynamic> data) {
    if (!mounted) return;

    if (data['patient_id'] == widget.patient['id']) {
      setState(() {
        _currentHr = (data['heart_rate'] as num).toDouble();
        _currentSpo2 = (data['spo2'] as num).toDouble();
        _currentSysBp = (data['systolic_bp'] as num).toDouble();
        _currentDiaBp = (data['diastolic_bp'] as num).toDouble();

        _tickCount++;
        
        // Push new spots
        _hrSpots.removeAt(0);
        _hrSpots.add(FlSpot(_tickCount.toDouble(), _currentHr));

        _spo2Spots.removeAt(0);
        _spo2Spots.add(FlSpot(_tickCount.toDouble(), _currentSpo2));
      });
    }
  }

  @override
  void dispose() {
    WebSocketService.removeListener(_onTelemetryReceived);
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

    final p = widget.patient;

    return Scaffold(
      backgroundColor: primaryBg,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: Icon(LucideIcons.arrowLeft, color: textColor),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Hồ Sơ Lâm Sàng Bệnh Nhân',
          style: TextStyle(
            fontFamily: 'Futura',
            fontWeight: FontWeight.bold,
            color: textColor,
            fontSize: 16,
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Patient details card
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
                    children: [
                      CircleAvatar(
                        backgroundColor: const Color(0xFFFF3366).withOpacity(0.1),
                        radius: 26,
                        child: Text(
                          p['full_name'].isNotEmpty ? p['full_name'].substring(0, 1).toUpperCase() : '?',
                          style: const TextStyle(
                            color: Color(0xFFFF3366),
                            fontWeight: FontWeight.bold,
                            fontSize: 20,
                            fontFamily: 'Futura',
                          ),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              p['full_name'],
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: textColor,
                                fontFamily: 'Futura',
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'ID: ${p['id']}',
                              style: TextStyle(color: textMuted, fontSize: 11, fontFamily: 'Futura'),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const Divider(height: 24, color: Colors.grey),
                  _buildDetailRow('Giới tính', p['gender'], textColor, textMuted),
                  _buildDetailRow('Tuổi', '${p['age']} tuổi', textColor, textMuted),
                  _buildDetailRow('Số điện thoại', p['phone'], textColor, textMuted),
                  _buildDetailRow('Địa chỉ', p['address'] ?? 'Chưa cập nhật', textColor, textMuted),
                  _buildDetailRow('Tiền sử bệnh lý', p['medical_history'] ?? 'Không có', textColor, textMuted),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Live Metrics Panel
            Row(
              children: [
                Expanded(
                  child: _buildMiniMetricCard(
                    title: 'NHỊP TIM',
                    value: '${_currentHr.toInt()}',
                    unit: 'BPM',
                    color: const Color(0xFFFF3366),
                    cardBg: cardBg,
                    textColor: textColor,
                    textMuted: textMuted,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildMiniMetricCard(
                    title: 'SPO2',
                    value: '${_currentSpo2.toInt()}',
                    unit: '%',
                    color: const Color(0xFF00F2FE),
                    cardBg: cardBg,
                    textColor: textColor,
                    textMuted: textMuted,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildMiniMetricCard(
                    title: 'HUYẾT ÁP',
                    value: '${_currentSysBp.toInt()}/${_currentDiaBp.toInt()}',
                    unit: 'mmHg',
                    color: const Color(0xFF39FF14),
                    cardBg: cardBg,
                    textColor: textColor,
                    textMuted: textMuted,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Heart Rate Line Chart
            _buildChartSection(
              title: 'XU HƯỚNG NHỊP TIM (HR TELEMETRY)',
              spots: _hrSpots,
              lineColor: const Color(0xFFFF3366),
              minY: 40,
              maxY: 160,
              cardBg: cardBg,
              textColor: textColor,
              textMuted: textMuted,
            ),
            const SizedBox(height: 16),

            // SpO2 Line Chart
            _buildChartSection(
              title: 'XU HƯỚNG NỒNG ĐỘ OXY TRONG MÁU (SPO2)',
              spots: _spo2Spots,
              lineColor: const Color(0xFF00F2FE),
              minY: 80,
              maxY: 100,
              cardBg: cardBg,
              textColor: textColor,
              textMuted: textMuted,
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, Color textColor, Color textMuted) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: TextStyle(color: textMuted, fontSize: 13, fontWeight: FontWeight.w500, fontFamily: 'Futura'),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(color: textColor, fontSize: 13, fontWeight: FontWeight.bold, fontFamily: 'Futura'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMiniMetricCard({
    required String title,
    required String value,
    required String unit,
    required Color color,
    required Color cardBg,
    required Color textColor,
    required Color textMuted,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: TextStyle(color: textMuted, fontSize: 9, fontWeight: FontWeight.bold)),
          const SizedBox(height: 6),
          Row(
            baseline: TextBaseline.alphabetic,
            crossAxisAlignment: CrossAxisAlignment.baseline,
            children: [
              Text(
                value,
                style: TextStyle(color: color, fontSize: 16, fontWeight: FontWeight.w900, fontFamily: 'Futura'),
              ),
              const SizedBox(width: 2),
              Text(
                unit,
                style: TextStyle(color: textMuted, fontSize: 9),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildChartSection({
    required String title,
    required List<FlSpot> spots,
    required Color lineColor,
    required double minY,
    required double maxY,
    required Color cardBg,
    required Color textColor,
    required Color textMuted,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: textMuted,
              fontFamily: 'Futura',
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 20),
          SizedBox(
            height: 150,
            child: LineChart(
              LineChartData(
                minY: minY,
                maxY: maxY,
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  getDrawingHorizontalLine: (val) => FlLine(
                    color: Colors.white.withOpacity(0.05),
                    strokeWidth: 1,
                  ),
                ),
                titlesData: const FlTitlesData(
                  show: true,
                  topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 32,
                      interval: 20,
                    ),
                  ),
                ),
                borderData: FlBorderData(show: false),
                lineBarsData: [
                  LineChartBarData(
                    spots: spots,
                    isCurved: true,
                    color: lineColor,
                    barWidth: 2.5,
                    isStrokeCapRound: true,
                    dotData: const FlDotData(show: false),
                    belowBarData: BarAreaData(
                      show: true,
                      color: lineColor.withOpacity(0.1),
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
