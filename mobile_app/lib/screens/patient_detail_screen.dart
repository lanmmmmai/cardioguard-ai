// Màn hình chi tiết bệnh nhân với 4 tab: Chỉ số, Hồ sơ bệnh án, Đơn thuốc, Trò chuyện.
// Quy trình làm việc:
// 1. Khởi tạo các điểm xu hướng mô phỏng (HR/SpO2), lắng nghe WebSocket để cập nhật
//    số liệu trực tiếp và tin nhắn trò chuyện, và tìm nạp hồ sơ bệnh án/đơn thuốc/trò chuyện.
// 2. Tab 1: thẻ thông tin bệnh nhân + thẻ số liệu nhỏ + biểu đồ đường xu hướng HR/SpO2.
// 3. Tab 2: danh sách hồ sơ bệnh án; bác sĩ có thể thêm qua AddRecordSheetContent.
// 4. Tab 3: danh sách đơn thuốc; bác sĩ có thể thêm qua AddPrescriptionSheetContent.
// 5. Tab 4: trò chuyện thời gian thực với giao diện bong bóng; tin nhắn được gửi qua ChatProvider.
// Mối quan hệ:
// - Sở hữu: AuthProvider, PatientProvider, ChatProvider, WebSocketService.
// - Sử dụng: fl_chart cho biểu đồ xu hướng, CgCard, CgMetricValue, CgInlineState, CgStatusBadge.
// - Chứa: AddRecordSheetContent, AddPrescriptionSheetContent.
import 'package:flutter/material.dart';
import '../core/app_logger.dart';
import 'package:provider/provider.dart';
import 'package:lucide_flutter/lucide_flutter.dart';
import 'package:fl_chart/fl_chart.dart';

import '../providers/auth_provider.dart';
import '../providers/patient_provider.dart';
import '../providers/chat_provider.dart';
import '../services/websocket_service.dart';
import '../widgets/cg_widgets.dart';
import '../ui/cg_tokens.dart';

// Màn hình hiển thị thông tin chi tiết bệnh nhân qua 4 tab (Chỉ số / Hồ sơ bệnh án / Đơn thuốc / Trò chuyện).
class PatientDetailScreen extends StatefulWidget {
  // Dữ liệu bệnh nhân (từ API hoặc mô hình provider).
  final Map<String, dynamic> patient;
  // Liệu màn hình có sử dụng màu chủ đề tối hay không.
  final bool isDarkTheme;
  // Liệu có hiển thị nút quay lại trong AppBar hay không.
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
  // Cửa sổ cuộn của các điểm dữ liệu HR cho biểu đồ xu hướng.
  final List<FlSpot> _hrSpots = [];
  // Cửa sổ cuộn của các điểm dữ liệu SpO2 cho biểu đồ xu hướng.
  final List<FlSpot> _spo2Spots = [];
  // Bộ đếm tích tắc được sử dụng làm chỉ số trục X cho các điểm biểu đồ.
  int _tickCount = 0;

  double _currentHr = 75.0;
  double _currentSpo2 = 98.0;
  double _currentSysBp = 120.0;
  double _currentDiaBp = 80.0;

  // Bộ điều khiển văn bản tin nhắn trò chuyện
  final _messageController = TextEditingController();

  @override
  void initState() {
    super.initState();
    AppLogger.info(
        '[CardioGuard] PatientDetailScreen initState | patientId=${widget.patient['id']}');

    // Điển ban đầu với các điểm giả định ổn định
    for (int i = 0; i < 15; i++) {
      _hrSpots.add(FlSpot(i.toDouble(), 75.0));
      _spo2Spots.add(FlSpot(i.toDouble(), 98.0));
    }
    _tickCount = 15;

    // Lắng nghe các chương trình phát sóng WebSocket
    WebSocketService.addListener(_onWebSocketEvent);

    // Tìm nạp API ban đầu
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final patientId = widget.patient['id'];
      final patientProvider =
          Provider.of<PatientProvider>(context, listen: false);
      final chatProvider = Provider.of<ChatProvider>(context, listen: false);

      AppLogger.info(
          '[CardioGuard] PatientDetailScreen fetching data for patientId=$patientId');
      patientProvider.fetchMedicalRecords(patientId);
      patientProvider.fetchPrescriptions(patientId);
      chatProvider.fetchChatHistory(patientId);
      
      patientProvider.fetchSensorHistory(patientId).then((_) {
        if (!mounted) return;
        final history = patientProvider.sensorHistory;
        if (history.isNotEmpty) {
          AppLogger.info(
              '[CardioGuard] PatientDetailScreen sensorHistory loaded | count=${history.length}');
          setState(() {
            _hrSpots.clear();
            _spo2Spots.clear();
            final reversedHistory = history.reversed.toList();
            for (int i = 0; i < reversedHistory.length; i++) {
              final item = reversedHistory[i];
              final hr = (item['heart_rate'] as num?)?.toDouble() ?? 75.0;
              final spo2 = (item['spo2'] as num?)?.toDouble() ?? 98.0;
              _hrSpots.add(FlSpot(i.toDouble(), hr));
              _spo2Spots.add(FlSpot(i.toDouble(), spo2));
            }
            _tickCount = reversedHistory.length;
            if (reversedHistory.isNotEmpty) {
              final latest = reversedHistory.last;
              _currentHr = (latest['heart_rate'] as num?)?.toDouble() ?? 75.0;
              _currentSpo2 = (latest['spo2'] as num?)?.toDouble() ?? 98.0;
              _currentSysBp = (latest['systolic_bp'] as num?)?.toDouble() ?? 120.0;
              _currentDiaBp = (latest['diastolic_bp'] as num?)?.toDouble() ?? 80.0;
            }
          });
        }
      });
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    AppLogger.info(
        '[CardioGuard] PatientDetailScreen didChangeDependencies | patientId=${widget.patient['id']}');
  }

  // Xử lý các sự kiện WebSocket: tin nhắn chat cập nhật giao diện trò chuyện;
  // health_metrics cập nhật các chỉ số sinh tồn trực tiếp và dữ liệu biểu đồ xu hướng.
  void _onWebSocketEvent(Map<String, dynamic> event) {
    if (!mounted) return;

    final type = event['type'];
    if (type == 'chat') {
      final msg = event['data'];
      Provider.of<ChatProvider>(context, listen: false).addRealtimeMessage(msg);
    } else if (type == 'health_metrics' &&
        event['patient_id'] == widget.patient['id']) {
      final metrics = event['data'] as Map<String, dynamic>;
      AppLogger.info(
          '[CardioGuard] PatientDetailScreen WS health_metrics | HR=${metrics['heart_rate']} SpO2=${metrics['spo2']} BP=${metrics['systolic_bp']}/${metrics['diastolic_bp']}');
      setState(() {
        _currentHr = (metrics['heart_rate'] as num?)?.toDouble() ?? 75.0;
        _currentSpo2 = (metrics['spo2'] as num?)?.toDouble() ?? 98.0;
        _currentSysBp = (metrics['systolic_bp'] as num?)?.toDouble() ?? 120.0;
        _currentDiaBp = (metrics['diastolic_bp'] as num?)?.toDouble() ?? 80.0;

        _tickCount++;
        _hrSpots.add(FlSpot(_tickCount.toDouble(), _currentHr));
        if (_hrSpots.length > 30) {
          _hrSpots.removeAt(0);
        }

        _spo2Spots.add(FlSpot(_tickCount.toDouble(), _currentSpo2));
        if (_spo2Spots.length > 30) {
          _spo2Spots.removeAt(0);
        }
      });
    }
  }

  @override
  void dispose() {
    AppLogger.info(
        '[CardioGuard] PatientDetailScreen dispose | patientId=${widget.patient['id']}');
    WebSocketService.removeListener(_onWebSocketEvent);
    _messageController.dispose();
    super.dispose();
  }

  // Mở bottom sheet để bác sĩ thêm hồ sơ bệnh án mới.
  void _showAddRecordSheet() {
    AppLogger.info(
        '[CardioGuard] PatientDetailScreen opening AddRecordSheet | patientId=${widget.patient['id']}');
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor:
          widget.isDarkTheme ? const Color(0xFF11151D) : Colors.white,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) {
        return AddRecordSheetContent(
          patient: widget.patient,
          isDarkTheme: widget.isDarkTheme,
        );
      },
    ).whenComplete(() => AppLogger.info(
        '[CardioGuard] PatientDetailScreen AddRecordSheet closed'));
  }

  // Mở bottom sheet để bác sĩ thêm đơn thuốc mới.
  void _showAddPrescriptionSheet() {
    AppLogger.info(
        '[CardioGuard] PatientDetailScreen opening AddPrescriptionSheet | patientId=${widget.patient['id']}');
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor:
          widget.isDarkTheme ? const Color(0xFF11151D) : Colors.white,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) {
        return AddPrescriptionSheetContent(
          patient: widget.patient,
          isDarkTheme: widget.isDarkTheme,
        );
      },
    ).whenComplete(() => AppLogger.info(
        '[CardioGuard] PatientDetailScreen AddPrescriptionSheet closed'));
  }

  // Gửi tin nhắn trò chuyện qua ChatProvider.sendMessage và xóa đầu vào.
  void _sendChatMessage() {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final chatProvider = Provider.of<ChatProvider>(context, listen: false);
    
    final currentUser = authProvider.currentUser;
    if (currentUser == null) {
      AppLogger.log('[CardioGuard] currentUser is null in _sendChatMessage');
      return;
    }
    
    final currentUserId = currentUser.id;
    final patientId = widget.patient['id'];

    // Bác sĩ hoặc Quản trị viên
    final doctorId = currentUser.role == 'doctor'
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
            labelColor: CgColors.accent,
            unselectedLabelColor: textMuted,
            indicatorColor: CgColors.accent,
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
            // Tab 1: Chỉ số và biểu đồ
            SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                children: [
                  // Thông tin bệnh nhân
                  CgCard(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: Column(
                      children: [
                        _buildDetailRow(
                          icon: LucideIcons.userCheck,
                          label: 'Giới tính & Tuổi',
                          value: '${p['gender']} • ${p['age']} tuổi',
                          textColor: textColor,
                          textMuted: textMuted,
                        ),
                        _buildDetailRow(
                          icon: LucideIcons.mail,
                          label: 'Email liên hệ',
                          value: p['email'] ?? p['user']?['email'] ?? 'Chưa cập nhật',
                          textColor: textColor,
                          textMuted: textMuted,
                        ),
                        _buildDetailRow(
                          icon: LucideIcons.phone,
                          label: 'Số điện thoại',
                          value: p['phone'] ?? 'Chưa cập nhật',
                          textColor: textColor,
                          textMuted: textMuted,
                        ),
                        _buildDetailRow(
                          icon: LucideIcons.mapPin,
                          label: 'Địa chỉ',
                          value: p['address'] ?? 'Chưa cập nhật',
                          textColor: textColor,
                          textMuted: textMuted,
                        ),
                        _buildDetailRow(
                          icon: LucideIcons.fileText,
                          label: 'Tiền sử bệnh lý',
                          value: (p['medical_history'] != null && p['medical_history'].toString().trim().isNotEmpty)
                              ? p['medical_history']
                              : 'Không có',
                          textColor: textColor,
                          textMuted: textMuted,
                          showDivider: false,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Thẻ số liệu nhỏ
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

                  // Xu hướng nhịp tim
                  RepaintBoundary(
                    child: _buildChartSection('XU HƯỚNG NHỊP TIM (HR)',
                        _hrSpots, CgColors.hr, 40, 160, cardBg, textMuted),
                  ),
                  const SizedBox(height: 16),

                  // Xu hướng SpO2
                  RepaintBoundary(
                    child: _buildChartSection('XU HƯỚNG NỒNG ĐỘ OXY (SPO2)',
                        _spo2Spots, CgColors.spo2, 80, 100, cardBg, textMuted),
                  ),
                ],
              ),
            ),

            // Tab 2: Hồ sơ bệnh án
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
                      backgroundColor: CgColors.accent,
                      child:
                          const Icon(LucideIcons.filePlus, color: Colors.white),
                    )
                  : null,
            ),

            // Tab 3: Đơn thuốc
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
                                        color: CgColors.accent,
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
                      backgroundColor: CgColors.accent,
                      child: const Icon(LucideIcons.plus, color: Colors.white),
                    )
                  : null,
            ),

            // Tab 4: Trò chuyện
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
                                msg.senderId == (authProvider.currentUser?.id ?? '');
                            final bubbleColor = isMe
                                ? CgColors.accent
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
                            color: CgColors.accent),
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

  Widget _buildDetailRow({
    required IconData icon,
    required String label,
    required String value,
    required Color textColor,
    required Color textMuted,
    bool showDivider = true,
  }) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 12.0),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 18, color: CgColors.primary),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: TextStyle(
                        color: textMuted,
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      value,
                      style: TextStyle(
                        color: textColor,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        if (showDivider)
          Divider(
            color: textColor.withValues(alpha: 0.08),
            height: 1,
            thickness: 0.8,
          ),
      ],
    );
  }

  // Xây dựng một thẻ số liệu nhỏ cho HR / SpO2 / BP hiển thị trong tab chỉ số.
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

  // Xây dựng một phần chứa biểu đồ đường với tiêu đề và LineChart sử dụng fl_chart.
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

  // Xây dựng một hàng chi tiết duy nhất cho đơn thuốc (tên thuốc, liều lượng, tần suất, v.v.).
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

// Biểu mẫu bottom-sheet để thêm hồ sơ bệnh án mới cho bệnh nhân.
class AddRecordSheetContent extends StatefulWidget {
  final Map<String, dynamic> patient;
  final bool isDarkTheme;

  const AddRecordSheetContent({
    super.key,
    required this.patient,
    required this.isDarkTheme,
  });

  @override
  State<AddRecordSheetContent> createState() => _AddRecordSheetContentState();
}

class _AddRecordSheetContentState extends State<AddRecordSheetContent> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _typeController;
  late final TextEditingController _diagnosisController;
  late final TextEditingController _summaryController;

  @override
  void initState() {
    super.initState();
    _typeController = TextEditingController(text: 'Khám lâm sàng');
    _diagnosisController = TextEditingController();
    _summaryController = TextEditingController();
  }

  @override
  void dispose() {
    _typeController.dispose();
    _diagnosisController.dispose();
    _summaryController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 20,
        right: 20,
        top: 20,
      ),
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Thêm Bệnh Án Mới',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              TextFormField(
                  controller: _typeController,
                  decoration: const InputDecoration(labelText: 'Loại khám'),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Vui lòng nhập loại khám' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                  controller: _diagnosisController,
                  decoration: const InputDecoration(labelText: 'Chẩn đoán'),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Vui lòng nhập chẩn đoán' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                  controller: _summaryController,
                  maxLines: 3,
                  decoration: const InputDecoration(labelText: 'Tóm tắt / Kết luận'),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Vui lòng nhập tóm tắt/kết luận' : null,
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                      backgroundColor: CgColors.accent),
                  onPressed: () async {
                    if (!_formKey.currentState!.validate()) return;
                    final patientProvider =
                        Provider.of<PatientProvider>(context, listen: false);
                    final success = await patientProvider.addMedicalRecord(
                      patientId: widget.patient['id'],
                      type: _typeController.text.trim(),
                      diagnosis: _diagnosisController.text.trim(),
                      summary: _summaryController.text.trim(),
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
      ),
    );
  }
}

// Biểu mẫu bottom-sheet để thêm đơn thuốc mới cho bệnh nhân.
class AddPrescriptionSheetContent extends StatefulWidget {
  final Map<String, dynamic> patient;
  final bool isDarkTheme;

  const AddPrescriptionSheetContent({
    super.key,
    required this.patient,
    required this.isDarkTheme,
  });

  @override
  State<AddPrescriptionSheetContent> createState() => _AddPrescriptionSheetContentState();
}

class _AddPrescriptionSheetContentState extends State<AddPrescriptionSheetContent> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _medController;
  late final TextEditingController _dosageController;
  late final TextEditingController _freqController;
  late final TextEditingController _instructController;

  @override
  void initState() {
    super.initState();
    _medController = TextEditingController();
    _dosageController = TextEditingController();
    _freqController = TextEditingController();
    _instructController = TextEditingController();
  }

  @override
  void dispose() {
    _medController.dispose();
    _dosageController.dispose();
    _freqController.dispose();
    _instructController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 20,
        right: 20,
        top: 20,
      ),
      child: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Kê Đơn Thuốc Mới',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              TextFormField(
                  controller: _medController,
                  decoration: const InputDecoration(labelText: 'Tên thuốc'),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Vui lòng nhập tên thuốc' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                  controller: _dosageController,
                  decoration: const InputDecoration(
                      labelText: 'Liều lượng (e.g. 500mg)'),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Vui lòng nhập liều lượng' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                  controller: _freqController,
                  decoration: const InputDecoration(
                      labelText: 'Tần suất (e.g. 2 lần/ngày)'),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Vui lòng nhập tần suất' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                  controller: _instructController,
                  decoration: const InputDecoration(labelText: 'Hướng dẫn sử dụng'),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Vui lòng nhập hướng dẫn sử dụng' : null,
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                      backgroundColor: CgColors.accent),
                  onPressed: () async {
                    if (!_formKey.currentState!.validate()) return;
                    final patientProvider =
                        Provider.of<PatientProvider>(context, listen: false);
                    final success = await patientProvider.addPrescription(
                      patientId: widget.patient['id'],
                      medicationName: _medController.text.trim(),
                      dosage: _dosageController.text.trim(),
                      frequency: _freqController.text.trim(),
                      instructions: _instructController.text.trim(),
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
      ),
    );
  }
}
