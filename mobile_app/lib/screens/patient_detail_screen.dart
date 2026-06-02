import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_flutter/lucide_flutter.dart';
import 'package:fl_chart/fl_chart.dart';

import '../providers/auth_provider.dart';
import '../providers/patient_provider.dart';
import '../providers/chat_provider.dart';
import '../services/websocket_service.dart';
import '../widgets/cg_widgets.dart';
import '../ui/cg_tokens.dart';

class PatientDetailScreen extends StatefulWidget {
  final Map<String, dynamic> patient;
  final bool isDarkTheme;
  final bool showBackButton;

  const PatientDetailScreen({
    super.key,
    required this.patient,
    required this.isDarkTheme,
    this.showBackButton = true,
  });

  @override
  State<PatientDetailScreen> createState() => _PatientDetailScreenState();
}

class _PatientDetailScreenState extends State<PatientDetailScreen> {
  final List<FlSpot> _hrSpots = [];
  final List<FlSpot> _spo2Spots = [];
  int _tickCount = 0;

  double _currentHr = 75.0;
  double _currentSpo2 = 98.0;
  double _currentSysBp = 120.0;
  double _currentDiaBp = 80.0;

  // Chat message text controller
  final _messageController = TextEditingController();

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
    WebSocketService.addListener(_onWebSocketEvent);

    // Initial API fetches
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final patientId = widget.patient['id'];
      final patientProvider =
          Provider.of<PatientProvider>(context, listen: false);
      final chatProvider = Provider.of<ChatProvider>(context, listen: false);

      patientProvider.fetchMedicalRecords(patientId);
      patientProvider.fetchPrescriptions(patientId);
      chatProvider.fetchChatHistory(patientId);
    });
  }

  void _onWebSocketEvent(Map<String, dynamic> event) {
    if (!mounted) return;

    final type = event['type'];
    if (type == 'chat') {
      final msg = event['data'];
      Provider.of<ChatProvider>(context, listen: false).addRealtimeMessage(msg);
    } else if (type == 'health_metrics' &&
        event['patient_id'] == widget.patient['id']) {
      final metrics = event['data'] as Map<String, dynamic>;
      setState(() {
        _currentHr = (metrics['heart_rate'] as num?)?.toDouble() ?? 75.0;
        _currentSpo2 = (metrics['spo2'] as num?)?.toDouble() ?? 98.0;
        _currentSysBp = (metrics['systolic_bp'] as num?)?.toDouble() ?? 120.0;
        _currentDiaBp = (metrics['diastolic_bp'] as num?)?.toDouble() ?? 80.0;

        _tickCount++;
        _hrSpots.removeAt(0);
        _hrSpots.add(FlSpot(_tickCount.toDouble(), _currentHr));

        _spo2Spots.removeAt(0);
        _spo2Spots.add(FlSpot(_tickCount.toDouble(), _currentSpo2));
      });
    }
  }

  @override
  void dispose() {
    WebSocketService.removeListener(_onWebSocketEvent);
    _messageController.dispose();
    super.dispose();
  }

  // Doctor Sheet: Add Medical Record
  void _showAddRecordSheet() {
    final typeController = TextEditingController(text: 'Khám lâm sàng');
    final diagnosisController = TextEditingController();
    final summaryController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor:
          widget.isDarkTheme ? const Color(0xFF11151D) : Colors.white,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) {
        return Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom,
            left: 20,
            right: 20,
            top: 20,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Thêm Bệnh Án Mới',
                    style:
                        TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                const SizedBox(height: 16),
                TextField(
                    controller: typeController,
                    decoration: const InputDecoration(labelText: 'Loại khám')),
                const SizedBox(height: 12),
                TextField(
                    controller: diagnosisController,
                    decoration: const InputDecoration(labelText: 'Chẩn đoán')),
                const SizedBox(height: 12),
                TextField(
                    controller: summaryController,
                    maxLines: 3,
                    decoration:
                        const InputDecoration(labelText: 'Tóm tắt / Kết luận')),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFFF3366)),
                    onPressed: () async {
                      if (diagnosisController.text.isEmpty ||
                          summaryController.text.isEmpty) {
                        return;
                      }
                      final patientProvider =
                          Provider.of<PatientProvider>(context, listen: false);
                      final success = await patientProvider.addMedicalRecord(
                        patientId: widget.patient['id'],
                        type: typeController.text.trim(),
                        diagnosis: diagnosisController.text.trim(),
                        summary: summaryController.text.trim(),
                      );
                      if (success && context.mounted) {
                        Navigator.pop(context);
                      }
                    },
                    child: const Text('Lưu Bệnh Án',
                        style: TextStyle(
                            color: Colors.white, fontWeight: FontWeight.bold)),
                  ),
                ),
                const SizedBox(height: 20),
              ],
            ),
          ),
        );
      },
    );
  }

  // Doctor Sheet: Add Prescription
  void _showAddPrescriptionSheet() {
    final medController = TextEditingController();
    final dosageController = TextEditingController();
    final freqController = TextEditingController();
    final instructController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor:
          widget.isDarkTheme ? const Color(0xFF11151D) : Colors.white,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) {
        return Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom,
            left: 20,
            right: 20,
            top: 20,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Kê Đơn Thuốc Mới',
                    style:
                        TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                const SizedBox(height: 16),
                TextField(
                    controller: medController,
                    decoration: const InputDecoration(labelText: 'Tên thuốc')),
                const SizedBox(height: 12),
                TextField(
                    controller: dosageController,
                    decoration: const InputDecoration(
                        labelText: 'Liều lượng (e.g. 500mg)')),
                const SizedBox(height: 12),
                TextField(
                    controller: freqController,
                    decoration: const InputDecoration(
                        labelText: 'Tần suất (e.g. 2 lần/ngày)')),
                const SizedBox(height: 12),
                TextField(
                    controller: instructController,
                    decoration:
                        const InputDecoration(labelText: 'Hướng dẫn sử dụng')),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFFF3366)),
                    onPressed: () async {
                      if (medController.text.isEmpty ||
                          dosageController.text.isEmpty) {
                        return;
                      }
                      final patientProvider =
                          Provider.of<PatientProvider>(context, listen: false);
                      final success = await patientProvider.addPrescription(
                        patientId: widget.patient['id'],
                        medicationName: medController.text.trim(),
                        dosage: dosageController.text.trim(),
                        frequency: freqController.text.trim(),
                        instructions: instructController.text.trim(),
                      );
                      if (success && context.mounted) {
                        Navigator.pop(context);
                      }
                    },
                    child: const Text('Lưu Đơn Thuốc',
                        style: TextStyle(
                            color: Colors.white, fontWeight: FontWeight.bold)),
                  ),
                ),
                const SizedBox(height: 20),
              ],
            ),
          ),
        );
      },
    );
  }

  void _sendChatMessage() {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final chatProvider = Provider.of<ChatProvider>(context, listen: false);
    final currentUserId = authProvider.currentUser!.id;
    final patientId = widget.patient['id'];

    // Doctor or Admin
    final doctorId = authProvider.currentUser!.role == 'doctor'
        ? currentUserId
        : widget.patient['doctor_id'] ?? currentUserId;
    final recipientId = patientId;

    chatProvider.sendMessage(
      patientId: patientId,
      doctorId: doctorId,
      senderId: currentUserId,
      recipientId: recipientId,
      messageText: text,
    );

    _messageController.clear();
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final patientProvider = Provider.of<PatientProvider>(context);
    final chatProvider = Provider.of<ChatProvider>(context);

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

    final p = widget.patient;
    final role = authProvider.currentUser?.role ?? 'patient';

    return DefaultTabController(
      length: 4,
      child: Scaffold(
        backgroundColor: primaryBg,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          leading: widget.showBackButton
              ? IconButton(
                  icon: Icon(LucideIcons.arrowLeft, color: textColor),
                  onPressed: () => Navigator.pop(context),
                )
              : null,
          title: Text(
            p['full_name'],
            style: TextStyle(
                fontWeight: FontWeight.bold, color: textColor, fontSize: 16),
          ),
          bottom: TabBar(
            labelColor: const Color(0xFFFF3366),
            unselectedLabelColor: textMuted,
            indicatorColor: const Color(0xFFFF3366),
            tabs: const [
              Tab(text: 'Chỉ số'),
              Tab(text: 'Bệnh án'),
              Tab(text: 'Đơn thuốc'),
              Tab(text: 'Chat'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            // Tab 1: Vitals & Charts
            SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                children: [
                  // Patient Details
                  CgCard(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        _buildDetailRow(
                            'Tuổi', '${p['age']} tuổi', textColor, textMuted),
                        _buildDetailRow(
                            'Giới tính', p['gender'], textColor, textMuted),
                        _buildDetailRow(
                            'Số điện thoại', p['phone'], textColor, textMuted),
                        _buildDetailRow(
                            'Địa chỉ',
                            p['address'] ?? 'Chưa cập nhật',
                            textColor,
                            textMuted),
                        _buildDetailRow(
                            'Tiền sử bệnh lý',
                            p['medical_history'] ?? 'Không có',
                            textColor,
                            textMuted),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Mini Metrics Cards
                  Row(
                    children: [
                      Expanded(
                          child: _buildMiniMetricCard(
                              'NHỊP TIM',
                              '${_currentHr.toInt()}',
                              'BPM',
                              CgColors.hr,
                              cardBg,
                              textMuted)),
                      const SizedBox(width: 8),
                      Expanded(
                          child: _buildMiniMetricCard(
                              'SPO2',
                              '${_currentSpo2.toInt()}',
                              '%',
                              CgColors.spo2,
                              cardBg,
                              textMuted)),
                      const SizedBox(width: 8),
                      Expanded(
                          child: _buildMiniMetricCard(
                              'HUYẾT ÁP',
                              '${_currentSysBp.toInt()}/${_currentDiaBp.toInt()}',
                              'mmHg',
                              CgColors.bp,
                              cardBg,
                              textMuted)),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Heart Rate Trend
                  RepaintBoundary(
                    child: _buildChartSection('XU HƯỚNG NHỊP TIM (HR)',
                        _hrSpots, CgColors.hr, 40, 160, cardBg, textMuted),
                  ),
                  const SizedBox(height: 16),

                  // SpO2 Trend
                  RepaintBoundary(
                    child: _buildChartSection('XU HƯỚNG NỒNG ĐỘ OXY (SPO2)',
                        _spo2Spots, CgColors.spo2, 80, 100, cardBg, textMuted),
                  ),
                ],
              ),
            ),

            // Tab 2: Medical Records (Bệnh án)
            Scaffold(
              backgroundColor: Colors.transparent,
              body: patientProvider.medicalRecords.isEmpty
                  ? const CgInlineState(
                      type: CgStateType.empty,
                      title: 'Chưa có bệnh án',
                      message: 'Hiện chưa có hồ sơ bệnh án nào được ghi nhận.',
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: patientProvider.medicalRecords.length,
                      itemBuilder: (context, index) {
                        final record = patientProvider.medicalRecords[index];
                        return Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: cardBg,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: borderColor),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  CgStatusBadge(
                                      label: record.type,
                                      color: CgColors.primary),
                                  Text(
                                    '${record.createdAt.day}/${record.createdAt.month}/${record.createdAt.year}',
                                    style: TextStyle(
                                        color: textMuted, fontSize: 11),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Text('Chẩn đoán:',
                                  style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: textColor,
                                      fontSize: 13)),
                              Text(record.diagnosis,
                                  style: TextStyle(
                                      color: textColor, fontSize: 13)),
                              const SizedBox(height: 8),
                              Text('Tóm tắt & Kết luận:',
                                  style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: textColor,
                                      fontSize: 13)),
                              Text(record.summary,
                                  style: TextStyle(
                                      color: textMuted, fontSize: 13)),
                            ],
                          ),
                        );
                      },
                    ),
              floatingActionButton: role == 'doctor'
                  ? FloatingActionButton(
                      onPressed: _showAddRecordSheet,
                      backgroundColor: const Color(0xFFFF3366),
                      child:
                          const Icon(LucideIcons.filePlus, color: Colors.white),
                    )
                  : null,
            ),

            // Tab 3: Prescriptions (Đơn thuốc)
            Scaffold(
              backgroundColor: Colors.transparent,
              body: patientProvider.prescriptions.isEmpty
                  ? const CgInlineState(
                      type: CgStateType.empty,
                      title: 'Chưa có đơn thuốc',
                      message:
                          'Bệnh nhân chưa có đơn thuốc nào trong hệ thống.',
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: patientProvider.prescriptions.length,
                      itemBuilder: (context, index) {
                        final presc = patientProvider.prescriptions[index];
                        return Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: cardBg,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: borderColor),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    presc.medicationName,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        color: Color(0xFFFF3366),
                                        fontSize: 15),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color:
                                          Colors.green.withValues(alpha: 0.1),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: const Text('ĐANG DÙNG',
                                        style: TextStyle(
                                            color: Colors.green,
                                            fontSize: 9,
                                            fontWeight: FontWeight.bold)),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 10),
                              _buildPrescDetail(
                                  'Liều lượng:', presc.dosage, textColor),
                              _buildPrescDetail(
                                  'Tần suất:', presc.frequency, textColor),
                              _buildPrescDetail(
                                  'Hướng dẫn:', presc.instructions, textColor),
                            ],
                          ),
                        );
                      },
                    ),
              floatingActionButton: role == 'doctor'
                  ? FloatingActionButton(
                      onPressed: _showAddPrescriptionSheet,
                      backgroundColor: const Color(0xFFFF3366),
                      child: const Icon(LucideIcons.plus, color: Colors.white),
                    )
                  : null,
            ),

            // Tab 4: Chat (Trò chuyện)
            Column(
              children: [
                Expanded(
                  child: chatProvider.messages.isEmpty
                      ? const CgInlineState(
                          type: CgStateType.empty,
                          title: 'Chưa có hội thoại',
                          message:
                              'Nhập nội dung để bắt đầu trao đổi giữa bác sĩ và bệnh nhân.',
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: chatProvider.messages.length,
                          itemBuilder: (context, index) {
                            final msg = chatProvider.messages[index];
                            final isMe =
                                msg.senderId == authProvider.currentUser!.id;
                            final bubbleColor = isMe
                                ? const Color(0xFFFF3366)
                                : (isDark
                                    ? const Color(0xFF1C222D)
                                    : Colors.black.withValues(alpha: 0.04));
                            final textStyle = TextStyle(
                              color: isMe ? Colors.white : textColor,
                              fontSize: 13,
                            );

                            return Align(
                              alignment: isMe
                                  ? Alignment.centerRight
                                  : Alignment.centerLeft,
                              child: Container(
                                margin: const EdgeInsets.only(bottom: 8),
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 14, vertical: 10),
                                constraints: BoxConstraints(
                                    maxWidth:
                                        MediaQuery.of(context).size.width *
                                            0.7),
                                decoration: BoxDecoration(
                                  color: bubbleColor,
                                  borderRadius:
                                      BorderRadius.circular(16).copyWith(
                                    bottomRight: isMe
                                        ? const Radius.circular(0)
                                        : const Radius.circular(16),
                                    topLeft: !isMe
                                        ? const Radius.circular(0)
                                        : const Radius.circular(16),
                                  ),
                                ),
                                child: Text(msg.message, style: textStyle),
                              ),
                            );
                          },
                        ),
                ),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: cardBg,
                    border: Border(top: BorderSide(color: borderColor)),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _messageController,
                          style: TextStyle(color: textColor),
                          decoration: InputDecoration(
                            hintText: 'Nhập nội dung tư vấn...',
                            hintStyle: TextStyle(color: textMuted),
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                          ),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(LucideIcons.send,
                            color: Color(0xFFFF3366)),
                        style: IconButton.styleFrom(
                            minimumSize: const Size(48, 48)),
                        onPressed: _sendChatMessage,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(
      String label, String value, Color textColor, Color textMuted) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
              width: 120,
              child: Text(label,
                  style: TextStyle(
                      color: textMuted,
                      fontSize: 13,
                      fontWeight: FontWeight.w500))),
          Expanded(
              child: Text(value,
                  style: TextStyle(
                      color: textColor,
                      fontSize: 13,
                      fontWeight: FontWeight.bold))),
        ],
      ),
    );
  }

  Widget _buildMiniMetricCard(String title, String value, String unit,
      Color color, Color cardBg, Color textMuted) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: TextStyle(
                  color: textMuted, fontSize: 8, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          CgMetricValue(value: value, unit: unit, color: color, valueSize: 16),
        ],
      ),
    );
  }

  Widget _buildChartSection(String title, List<FlSpot> spots, Color lineColor,
      double minY, double maxY, Color cardBg, Color textMuted) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration:
          BoxDecoration(color: cardBg, borderRadius: BorderRadius.circular(18)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: textMuted,
                  letterSpacing: 0.5)),
          const SizedBox(height: 16),
          SizedBox(
            height: 120,
            child: LineChart(
              LineChartData(
                minY: minY,
                maxY: maxY,
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  getDrawingHorizontalLine: (val) => FlLine(
                      color: Colors.white.withValues(alpha: 0.04),
                      strokeWidth: 1),
                ),
                titlesData: const FlTitlesData(
                  show: true,
                  topTitles:
                      AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles:
                      AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  bottomTitles:
                      AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  leftTitles: AxisTitles(
                      sideTitles: SideTitles(
                          showTitles: true, reservedSize: 28, interval: 30)),
                ),
                borderData: FlBorderData(show: false),
                lineBarsData: [
                  LineChartBarData(
                    spots: spots,
                    isCurved: true,
                    color: lineColor,
                    barWidth: 2,
                    dotData: const FlDotData(show: false),
                    belowBarData: BarAreaData(
                        show: true, color: lineColor.withValues(alpha: 0.08)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPrescDetail(String label, String value, Color textColor) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
              width: 80,
              child: Text(label,
                  style: const TextStyle(fontSize: 12, color: Colors.grey))),
          Expanded(
              child: Text(value,
                  style: TextStyle(fontSize: 12, color: textColor))),
        ],
      ),
    );
  }
}
