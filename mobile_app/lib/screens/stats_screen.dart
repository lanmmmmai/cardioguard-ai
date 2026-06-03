// Màn hình thống kê hệ thống với thẻ KPI, biểu đồ donut mức độ nghiêm trọng và xu hướng hàng tuần.
// Quy trình làm việc:
// 1. Khi khởi tạo, thực hiện các lời gọi API song song đến /patients, /alerts và
//    điểm cuối thống kê hàng tuần từ AppConfig.
// 2. Hiển thị 3 thẻ KPI (tổng bệnh nhân, tổng cảnh báo, số lượng nguy kịch).
// 3. Biểu đồ tròn PieChart hiển thị phân bố mức độ nghiêm trọng của cảnh báo (cao/trung bình/thấp).
// 4. Biểu đồ đường LineChart hiển thị xu hướng tần suất cảnh báo trong 7 ngày với nhãn ngày trong tuần.
// 5. Nút làm mới tải lại tất cả dữ liệu qua _loadStatsData.
// Mối quan hệ:
// - Sử dụng: ApiClient, AppConfig, CgScreenScaffold, CgInlineState.
// - Biểu đồ: fl_chart (PieChart, LineChart).
// - Không có providers — tìm nạp dữ liệu API thô trực tiếp.
import 'package:flutter/material.dart';
import 'package:lucide_flutter/lucide_flutter.dart';
import 'package:fl_chart/fl_chart.dart';
import '../core/api_client.dart';
import '../core/app_logger.dart';
import '../config/app_config.dart';
import '../widgets/cg_widgets.dart';
import '../ui/cg_tokens.dart';

// Màn hình thống kê hệ thống với thẻ KPI, donut mức độ nghiêm trọng và xu hướng đường hàng tuần.
class StatsScreen extends StatefulWidget {
  // Liệu màn hình có sử dụng màu chủ đề tối hay không.
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

  // Giá trị cho số lượng cảnh báo mức độ cao (critical/high) trong biểu đồ donut.
  double _highAlertsVal = 0.0;
  // Giá trị cho số lượng cảnh báo mức độ trung bình (warning) trong biểu đồ donut.
  double _medAlertsVal = 0.0;
  // Giá trị cho số lượng cảnh báo mức độ thấp (info/low) trong biểu đồ donut.
  double _lowAlertsVal = 0.0;
  // Các điểm dữ liệu tần suất cảnh báo hàng tuần cho biểu đồ đường (khởi tạo thưa thớt).
  List<FlSpot> _weeklyAlertSpots = const [
    FlSpot(0, 0),
    FlSpot(1, 0),
    FlSpot(2, 0),
    FlSpot(3, 0),
    FlSpot(4, 0),
    FlSpot(5, 0),
    FlSpot(6, 0),
  ];
  // Nhãn cho mỗi ngày trong biểu đồ hàng tuần.
  List<String> _weeklyLabels = const ['-', '-', '-', '-', '-', '-', '-'];

  @override
  void initState() {
    super.initState();
    _loadStatsData();
  }

  // Tìm nạp số lượng bệnh nhân, danh sách cảnh báo và thống kê hàng tuần song song từ API.
  void _loadStatsData() async {
    setState(() {
      _isLoading = true;
    });
    try {
      final client = ApiClient();
      final responses = await Future.wait([
        client.get('/patients'),
        client.get('/alerts'),
        client.get(AppConfig.alertsWeeklyStatsEndpoint),
      ]);
      final patients = (responses[0].data as List<dynamic>? ?? const []);
      final alerts = (responses[1].data as List<dynamic>? ?? const []);
      final weeklyStats = (responses[2].data as List<dynamic>? ?? const []);

      if (!mounted) return;
      setState(() {
        _totalPatients = patients.length;
        _totalAlerts = alerts.length;

        // Nhóm cảnh báo theo mức độ nghiêm trọng
        int high = 0;
        int med = 0;
        int low = 0;

        for (final a in alerts) {
          final row = a as Map<String, dynamic>? ?? const {};
          final severity = (row['severity'] as String? ?? '').toLowerCase();
          if (severity == 'high' || severity == 'critical') {
            high++;
          } else if (severity == 'medium' || severity == 'warning') {
            med++;
          } else {
            low++;
          }
        }

        _highAlertsVal = high.toDouble();
        _medAlertsVal = med.toDouble();
        _lowAlertsVal = low.toDouble();
        if (weeklyStats.isNotEmpty) {
          _weeklyLabels = weeklyStats
              .map((e) =>
                  (e as Map<String, dynamic>)['label']?.toString() ?? '-')
              .toList();
          _weeklyAlertSpots = weeklyStats.asMap().entries.map((entry) {
            final row = entry.value as Map<String, dynamic>;
            final count = (row['count'] as num?)?.toDouble() ?? 0.0;
            return FlSpot(entry.key.toDouble(), count);
          }).toList();
        } else {
          _weeklyLabels = const ['-', '-', '-', '-', '-', '-', '-'];
          _weeklyAlertSpots = const [
            FlSpot(0, 0),
            FlSpot(1, 0),
            FlSpot(2, 0),
            FlSpot(3, 0),
            FlSpot(4, 0),
            FlSpot(5, 0),
            FlSpot(6, 0),
          ];
        }

        // Đếm số ca nguy kịch
        _criticalCount = high;
        _isLoading = false;
      });
    } catch (e) {
      AppLogger.log('Lỗi tải thống kê: $e');
      if (!mounted) return;
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = widget.isDarkTheme;
    final cardBg = isDark
        ? const Color(0xFF11151D).withValues(alpha: 0.7)
        : Colors.white.withValues(alpha: 0.9);
    final textColor = isDark ? Colors.white : const Color(0xFF1D2939);
    final textMuted =
        isDark ? const Color(0xFF9EA5B4) : const Color(0xFF475467);
    final borderColor = isDark
        ? Colors.white.withValues(alpha: 0.07)
        : Colors.black.withValues(alpha: 0.08);

    return CgScreenScaffold(
      title: 'Thống kê hệ thống',
      subtitle: 'Phân tích cảnh báo và hiệu suất telemetry',
      trailing: IconButton(
        onPressed: _loadStatsData,
        icon: Icon(LucideIcons.refreshCw, color: textColor),
        style: IconButton.styleFrom(
          backgroundColor: cardBg,
          side: BorderSide(color: borderColor),
        ),
      ),
      body: _isLoading
          ? const CgInlineState(
              type: CgStateType.loading,
              title: 'Đang tải thống kê',
              message: 'Hệ thống đang tổng hợp dữ liệu bệnh nhân và cảnh báo.',
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: Column(
                children: [
                  // Widget KPI
                  GridView.count(
                    crossAxisCount: 3,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisSpacing: 10,
                    mainAxisSpacing: 10,
                    childAspectRatio: 1.1,
                    children: [
                      _buildKpiCard(
                          'BỆNH NHÂN',
                          '$_totalPatients',
                          LucideIcons.users,
                          CgColors.spo2,
                          cardBg,
                          textColor,
                          textMuted),
                      _buildKpiCard(
                          'CẢNH BÁO',
                          '$_totalAlerts',
                          LucideIcons.bell,
                          CgColors.warning,
                          cardBg,
                          textColor,
                          textMuted),
                      _buildKpiCard(
                          'NGUY KỊCH',
                          '$_criticalCount',
                          LucideIcons.alertTriangle,
                          CgColors.critical,
                          cardBg,
                          textColor,
                          textMuted),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Bảng phân bố donut mức độ nghiêm trọng
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
                            color: Color(0xFF9EA5B4),
                            letterSpacing: 0.5,
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
                                  titleStyle: const TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                  ),
                                ),
                                PieChartSectionData(
                                  color: const Color(0xFFFFB606),
                                  value: _medAlertsVal,
                                  title: 'Cảnh báo',
                                  radius: 30,
                                  titleStyle: const TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                  ),
                                ),
                                PieChartSectionData(
                                  color: const Color(0xFF39FF14),
                                  value: _lowAlertsVal,
                                  title: 'Ổn định',
                                  radius: 30,
                                  titleStyle: const TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        // Chú thích
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceAround,
                          children: [
                            _buildLegendItem(
                                'Cao', const Color(0xFFFF3366), textMuted),
                            _buildLegendItem('Trung bình',
                                const Color(0xFFFFB606), textMuted),
                            _buildLegendItem(
                                'Thấp', const Color(0xFF39FF14), textMuted),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Bảng biểu đồ đường cảnh báo
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
                          'TẦN SUẤT SỰ CỐ (7 NGÀY GẦN NHẤT)',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF9EA5B4),
                            letterSpacing: 0.5,
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
                                  color: Colors.white.withValues(alpha: 0.05),
                                  strokeWidth: 1,
                                ),
                              ),
                              titlesData: FlTitlesData(
                                show: true,
                                topTitles: const AxisTitles(
                                    sideTitles: SideTitles(showTitles: false)),
                                rightTitles: const AxisTitles(
                                    sideTitles: SideTitles(showTitles: false)),
                                bottomTitles: AxisTitles(
                                  sideTitles: SideTitles(
                                    showTitles: true,
                                    getTitlesWidget: (val, meta) {
                                      int idx = val.toInt();
                                      if (idx >= 0 &&
                                          idx < _weeklyLabels.length) {
                                        return Padding(
                                          padding:
                                              const EdgeInsets.only(top: 6),
                                          child: Text(_weeklyLabels[idx],
                                              style: TextStyle(
                                                color: textMuted,
                                                fontSize: 9,
                                              )),
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
                                  spots: _weeklyAlertSpots,
                                  isCurved: true,
                                  color: const Color(0xFFFF3366),
                                  barWidth: 3,
                                  dotData: const FlDotData(show: true),
                                  belowBarData: BarAreaData(
                                    show: true,
                                    color: const Color(0xFFFF3366)
                                        .withValues(alpha: 0.1),
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
    );
  }

  // Xây dựng một thẻ tóm tắt KPI hiển thị giá trị số liệu và biểu tượng.
  Widget _buildKpiCard(String label, String value, IconData icon, Color color,
      Color cardBg, Color textColor, Color textMuted) {
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
              color: textColor,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
                color: textMuted, fontSize: 8, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }

  // Xây dựng một hàng chấm chú thích màu + nhãn cho chú thích biểu đồ donut.
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
          style: TextStyle(
            color: textMuted,
            fontSize: 11,
          ),
        ),
      ],
    );
  }
}
