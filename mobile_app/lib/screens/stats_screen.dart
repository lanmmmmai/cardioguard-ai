import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:fl_chart/fl_chart.dart';
import '../services/api_service.dart';

class StatsScreen extends StatefulWidget {
  final bool isDarkTheme;
  const StatsScreen({super.key, required this.isDarkTheme});

  @override
  State<StatsScreen> createState() => _StatsScreenState();
}

class _StatsScreenState extends State<StatsScreen> {
  int _totalPatients = 0;
  int _totalAlerts = 0;
  int _criticalCount = 0;
  bool _isLoading = false;

  // Pie chart variables
  double _highAlertsVal = 5.0;
  double _medAlertsVal = 12.0;
  double _lowAlertsVal = 24.0;

  @override
  void initState() {
    super.initState();
    _loadStatsData();
  }

  void _loadStatsData() async {
    setState(() {
      _isLoading = true;
    });

    final patients = await ApiService.getPatients();
    final alerts = await ApiService.getAlerts();

    setState(() {
      _totalPatients = patients.length;
      _totalAlerts = alerts.length;

      // Group alerts by severity
      int high = 0;
      int med = 0;
      int low = 0;

      for (var a in alerts) {
        final severity = (a['severity'] as String? ?? '').toLowerCase();
        if (severity == 'high' || severity == 'critical') {
          high++;
        } else if (severity == 'medium' || severity == 'warning') {
          med++;
        } else {
          low++;
        }
      }

      _highAlertsVal = high > 0 ? high.toDouble() : 5.0;
      _medAlertsVal = med > 0 ? med.toDouble() : 12.0;
      _lowAlertsVal = low > 0 ? low.toDouble() : 24.0;

      // Count critical cases
      _criticalCount = high;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = widget.isDarkTheme;
    final primaryBg = isDark ? const Color(0xFF07080A) : const Color(0xFFF5F6F8);
    final cardBg = isDark ? const Color(0xFF11151D).withOpacity(0.7) : Colors.white.withOpacity(0.9);
    final textColor = isDark ? Colors.white : const Color(0xFF1D2939);
    final textMuted = isDark ? const Color(0xFF9EA5B4) : const Color(0xFF475467);
    final borderColor = isDark ? Colors.white.withOpacity(0.07) : Colors.black.withOpacity(0.08);

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
                        'Thống Kê Hệ Thống',
                        style: TextStyle(fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: textColor,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Phân tích sự cố và hiệu suất telemetry',
                        style: TextStyle(color: textMuted, fontSize: 13,),
                      ),
                    ],
                  ),
                  IconButton(
                    onPressed: _loadStatsData,
                    icon: Icon(LucideIcons.refreshCw, color: textColor),
                    style: IconButton.styleFrom(
                      backgroundColor: cardBg,
                      side: BorderSide(color: borderColor),
                    ),
                  )
                ],
              ),
            ),

            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(color: Color(0xFFFF3366)))
                  : SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(horizontal: 16.0),
                      child: Column(
                        children: [
                          // KPI widgets
                          GridView.count(
                            crossAxisCount: 3,
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            crossAxisSpacing: 10,
                            mainAxisSpacing: 10,
                            childAspectRatio: 1.1,
                            children: [
                              _buildKpiCard('BỆNH NHÂN', '$_totalPatients', LucideIcons.users, const Color(0xFF00F2FE), cardBg, textColor, textMuted),
                              _buildKpiCard('CẢNH BÁO', '$_totalAlerts', LucideIcons.bell, const Color(0xFFFFB606), cardBg, textColor, textMuted),
                              _buildKpiCard('NGUY KỊCH', '$_criticalCount', LucideIcons.alertTriangle, const Color(0xFFFF3366), cardBg, textColor, textMuted),
                            ],
                          ),
                          const SizedBox(height: 16),

                          // Donut severity distribution panel
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
                                const Text(
                                  'TỶ LỆ CẢNH BÁO THEO MỨC ĐỘ',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF9EA5B4),letterSpacing: 0.5,
                                  ),
                                ),
                                const SizedBox(height: 20),
                                SizedBox(
                                  height: 140,
                                  child: PieChart(
                                    PieChartData(
                                      sectionsSpace: 4,
                                      centerSpaceRadius: 40,
                                      sections: [
                                        PieChartSectionData(
                                          color: const Color(0xFFFF3366),
                                          value: _highAlertsVal,
                                          title: 'Nguy kịch',
                                          radius: 30,
                                          titleStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white,),
                                        ),
                                        PieChartSectionData(
                                          color: const Color(0xFFFFB606),
                                          value: _medAlertsVal,
                                          title: 'Cảnh báo',
                                          radius: 30,
                                          titleStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white,),
                                        ),
                                        PieChartSectionData(
                                          color: const Color(0xFF39FF14),
                                          value: _lowAlertsVal,
                                          title: 'Ổn định',
                                          radius: 30,
                                          titleStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white,),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 12),
                                // Legend
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                                  children: [
                                    _buildLegendItem('Cao', const Color(0xFFFF3366), textMuted),
                                    _buildLegendItem('Trung bình', const Color(0xFFFFB606), textMuted),
                                    _buildLegendItem('Thấp', const Color(0xFF39FF14), textMuted),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),

                          // Alarms line chart panel
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
                                const Text(
                                  'TẦN SUẤT SỰ CỐ (7 NGÀY QUA)',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF9EA5B4),letterSpacing: 0.5,
                                  ),
                                ),
                                const SizedBox(height: 24),
                                SizedBox(
                                  height: 150,
                                  child: LineChart(
                                    LineChartData(
                                      gridData: FlGridData(
                                        show: true,
                                        drawVerticalLine: false,
                                        getDrawingHorizontalLine: (val) => FlLine(
                                          color: Colors.white.withOpacity(0.05),
                                          strokeWidth: 1,
                                        ),
                                      ),
                                      titlesData: FlTitlesData(
                                        show: true,
                                        topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                                        rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                                        bottomTitles: AxisTitles(
                                          sideTitles: SideTitles(
                                            showTitles: true,
                                            getTitlesWidget: (val, meta) {
                                              const days = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
                                              int idx = val.toInt();
                                              if (idx >= 0 && idx < days.length) {
                                                return Padding(
                                                  padding: const EdgeInsets.only(top: 6),
                                                  child: Text(days[idx], style: TextStyle(color: textMuted, fontSize: 10,)),
                                                );
                                              }
                                              return const Text('');
                                            },
                                            interval: 1,
                                          ),
                                        ),
                                        leftTitles: const AxisTitles(
                                          sideTitles: SideTitles(
                                            showTitles: true,
                                            reservedSize: 22,
                                            interval: 4,
                                          ),
                                        ),
                                      ),
                                      borderData: FlBorderData(show: false),
                                      lineBarsData: [
                                        LineChartBarData(
                                          spots: const [
                                            FlSpot(0, 3),
                                            FlSpot(1, 7),
                                            FlSpot(2, 4),
                                            FlSpot(3, 10),
                                            FlSpot(4, 5),
                                            FlSpot(5, 12),
                                            FlSpot(6, 6),
                                          ],
                                          isCurved: true,
                                          color: const Color(0xFFFF3366),
                                          barWidth: 3,
                                          dotData: const FlDotData(show: true),
                                          belowBarData: BarAreaData(
                                            show: true,
                                            color: const Color(0xFFFF3366).withOpacity(0.1),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
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

  Widget _buildKpiCard(String label, String value, IconData icon, Color color, Color cardBg, Color textColor, Color textMuted) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Icon(icon, color: color, size: 16),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            value,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: textColor,),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(color: textMuted, fontSize: 8, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }

  Widget _buildLegendItem(String label, Color color, Color textMuted) {
    return Row(
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(3),
          ),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: TextStyle(color: textMuted, fontSize: 11,),
        ),
      ],
    );
  }
}
