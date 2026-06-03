// Quản lý xem, đặt lịch hẹn và cập nhật trạng thái (Quản lý lịch hẹn).
// Quy trình làm việc:
// 1. Khi khởi tạo, tải lịch hẹn, danh sách bệnh nhân và ánh xạ bác sĩ song song.
// 2. Lịch hẹn được lọc theo vai trò: bệnh nhân chỉ thấy của họ, bác sĩ thấy
//    bệnh nhân được phân công, quản trị viên thấy tất cả.
// 3. Mỗi thẻ hiển thị huy hiệu trạng thái, kênh, tiêu đề, ngày giờ, tên bác sĩ/bệnh nhân,
//    và ghi chú. Các lịch hẹn đã hết hạn đang chờ/đã duyệt được gắn cờ "QUÁ HẠN".
// 4. Bệnh nhân có thể đặt lịch qua BookAppointmentSheet; bác sĩ/quản trị viên có thể duyệt/từ chối.
// Mối quan hệ:
// - Sở hữu: AppointmentProvider, AuthProvider, PatientProvider.
// - Sử dụng: BookAppointmentSheet, CgScreenScaffold, CgInlineState, CgStatusBadge.
// - Ánh xạ tên bác sĩ được tìm nạp từ /cms/users qua ApiClient.
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_flutter/lucide_flutter.dart';
import '../providers/appointment_provider.dart';
import '../providers/auth_provider.dart';
import '../providers/patient_provider.dart';
import '../widgets/cg_widgets.dart';
import '../widgets/book_appointment_sheet.dart';
import '../core/api_client.dart';
import '../core/app_logger.dart';
import '../ui/cg_tokens.dart';

// Màn hình xem và quản lý lịch hẹn khám bệnh.
class AppointmentsScreen extends StatefulWidget {
  // Liệu màn hình có sử dụng màu chủ đề tối hay không.
  final bool isDarkTheme;

  const AppointmentsScreen({super.key, required this.isDarkTheme});

  @override
  State<AppointmentsScreen> createState() => _AppointmentsScreenState();
}

class _AppointmentsScreenState extends State<AppointmentsScreen> {
  // Theo dõi các ID lịch hẹn hiện đang được cập nhật (trạng thái tải trên mỗi thẻ).
  final Set<String> _updatingIds = <String>{};
  // Bộ đệm ánh xạ ID bác sĩ đến tên hiển thị.
  Map<String, String> _doctorNames = {};
  // Bộ đệm ánh xạ ID bệnh nhân đến tên hiển thị.
  Map<String, String> _patientNames = {};
  // Liệu ánh xạ tên bác sĩ/bệnh nhân có đang tải hay không.
  bool _isLoadingMappings = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
  }

  // Tải lịch hẹn, bệnh nhân và ánh xạ tên bác sĩ đồng thời.
  Future<void> _loadData() async {
    final apptProvider = Provider.of<AppointmentProvider>(context, listen: false);
    final patientProvider = Provider.of<PatientProvider>(context, listen: false);

    setState(() {
      _isLoadingMappings = true;
    });

    await Future.wait([
      apptProvider.fetchAppointments(),
      patientProvider.fetchPatients(),
      _fetchDoctorMappings(),
    ]);

    // Xây dựng ánh xạ bệnh nhân
    final pNames = <String, String>{};
    for (final p in patientProvider.patients) {
      pNames[p.id] = p.fullName;
    }

    if (mounted) {
      setState(() {
        _patientNames = pNames;
        _isLoadingMappings = false;
      });
    }
  }

  // Tìm nạp danh sách bác sĩ từ API CMS và lưu trữ tên của họ vào bộ đệm.
  Future<void> _fetchDoctorMappings() async {
    try {
      final client = ApiClient();
      final response = await client.get('/cms/users',
          queryParameters: {'filter': 'role:doctor', 'limit': 100});
      final List<dynamic> items = response.data['items'] ?? [];
      final docNames = <String, String>{};
      for (final item in items) {
        docNames[item['id'] as String] = item['full_name'] as String;
      }
      if (mounted) {
        setState(() {
          _doctorNames = docNames;
        });
      }
    } catch (e) {
      AppLogger.log('Lỗi tìm nạp ánh xạ bác sĩ: $e');
    }
  }

  // Định dạng DateTime thành chuỗi HH:mm - dd/MM/yyyy có thể đọc được theo giờ địa phương.
  String _formatDateTime(DateTime dateTime) {
    final local = dateTime.toLocal();
    final hour = local.hour.toString().padLeft(2, '0');
    final minute = local.minute.toString().padLeft(2, '0');
    final day = local.day.toString().padLeft(2, '0');
    final month = local.month.toString().padLeft(2, '0');
    final year = local.year;
    return '$hour:$minute - $day/$month/$year';
  }

  // Mở bottom sheet để đặt lịch hẹn mới.
  void _showBookAppointmentSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor:
          widget.isDarkTheme ? const Color(0xFF11151D) : Colors.white,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) {
        return BookAppointmentSheet(isDarkTheme: widget.isDarkTheme);
      },
    ).then((success) {
      if (success == true && mounted) {
        _loadData();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Gửi yêu cầu đặt lịch hẹn thành công!'),
            backgroundColor: Colors.green,
          ),
        );
      }
    });
  }

  // Cập nhật trạng thái của một lịch hẹn và hiển thị snackbar kết quả.
  Future<void> _updateStatus(String appointmentId, String newStatus) async {
    setState(() => _updatingIds.add(appointmentId));
    final apptProvider = Provider.of<AppointmentProvider>(context, listen: false);
    final messenger = ScaffoldMessenger.of(context);

    final ok = await apptProvider.updateAppointmentStatus(appointmentId, newStatus);

    if (mounted) {
      setState(() => _updatingIds.remove(appointmentId));
      messenger.showSnackBar(
        SnackBar(
          content: Text(ok
              ? 'Cập nhật trạng thái lịch hẹn thành công.'
              : 'Cập nhật trạng thái thất bại. Vui lòng thử lại.'),
          backgroundColor: ok ? Colors.green : Colors.red,
        ),
      );
      if (ok) {
        apptProvider.fetchAppointments();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final apptProvider = Provider.of<AppointmentProvider>(context);

    final isDark = widget.isDarkTheme;
    final cardBg = isDark ? const Color(0xFF11151D) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF1D2939);
    final textMuted = isDark ? const Color(0xFF9EA5B4) : const Color(0xFF475467);
    final borderColor = isDark
        ? Colors.white.withValues(alpha: 0.07)
        : Colors.black.withValues(alpha: 0.08);

    final role = authProvider.currentUser?.role ?? 'patient';
    final currentUserId = authProvider.currentUser?.id;

    // Lọc lịch hẹn theo vai trò
    final rawList = apptProvider.appointments;
    final list = rawList.where((a) {
      if (role == 'patient') {
        return a.patientId == currentUserId;
      } else if (role == 'doctor') {
        return a.doctorId == currentUserId;
      }
      return true; // Quản trị viên xem tất cả
    }).toList();

    return CgScreenScaffold(
      title: 'Quản lý lịch hẹn',
      subtitle: role == 'patient'
         ? 'Danh sách lịch hẹn khám của bạn'
         : 'Danh sách ca hẹn khám bệnh nhân',
      trailing: role == 'patient'
          ? ElevatedButton.icon(
              onPressed: _showBookAppointmentSheet,
              icon: const Icon(LucideIcons.plus, size: 14, color: Colors.white),
              label: const Text('Đặt lịch hẹn', style: TextStyle(color: Colors.white)),
              style: ElevatedButton.styleFrom(
                backgroundColor: CgColors.primary,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              ),
            )
          : IconButton(
              onPressed: _loadData,
              icon: Icon(LucideIcons.refreshCw, color: textColor),
              style: IconButton.styleFrom(
                backgroundColor: cardBg,
                side: BorderSide(color: borderColor),
              ),
            ),
      body: (apptProvider.isLoading || _isLoadingMappings)
          ? const CgInlineState(
              type: CgStateType.loading,
              title: 'Đang tải lịch hẹn',
              message: 'Hệ thống đang đồng bộ danh sách cuộc hẹn khám.',
            )
          : list.isEmpty
              ? RefreshIndicator(
                  onRefresh: _loadData,
                  color: CgColors.primary,
                  child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    children: [
                      SizedBox(height: MediaQuery.of(context).size.height * 0.2),
                      const CgInlineState(
                        type: CgStateType.empty,
                        title: 'Chưa có lịch hẹn',
                        message: 'Bạn hiện chưa có lịch hẹn khám nào được ghi nhận.',
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _loadData,
                  color: CgColors.primary,
                  child: ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    itemCount: list.length,
                    itemBuilder: (context, index) {
                      final appt = list[index];
                      final isPast = appt.scheduledAt.isBefore(DateTime.now());
                      final status = appt.status.toLowerCase();

                      // Xử lý hết hạn
                      final bool isExpired = isPast && (status == 'pending' || status == 'approved');

                      Color statusColor;
                      String statusText;

                      if (isExpired) {
                        statusColor = Colors.orange;
                        statusText = 'QUÁ HẠN';
                      } else if (status == 'approved') {
                        statusColor = Colors.green;
                        statusText = 'ĐÃ DUYỆT';
                      } else if (status == 'cancelled') {
                        statusColor = Colors.red;
                        statusText = 'ĐÃ HỦY';
                      } else {
                        statusColor = Colors.blue;
                        statusText = 'ĐANG CHỜ';
                      }

                      final String doctorName = _doctorNames[appt.doctorId] ?? 'Bác sĩ điều trị';
                      final String patientName = _patientNames[appt.patientId] ?? 'Bệnh nhân';

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
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                CgStatusBadge(
                                  label: statusText,
                                  color: statusColor,
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: appt.channel.toLowerCase() == 'online'
                                        ? const Color(0xFF0891B2).withValues(alpha: 0.1)
                                        : const Color(0xFFF79009).withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        appt.channel.toLowerCase() == 'online' ? LucideIcons.video : LucideIcons.mapPin,
                                        size: 10,
                                        color: appt.channel.toLowerCase() == 'online'
                                            ? const Color(0xFF0891B2)
                                            : const Color(0xFFF79009),
                                      ),
                                      const SizedBox(width: 4),
                                      Text(
                                        appt.channel.toUpperCase(),
                                        style: TextStyle(
                                          fontSize: 9,
                                          fontWeight: FontWeight.w900,
                                          color: appt.channel.toLowerCase() == 'online'
                                              ? const Color(0xFF0891B2)
                                              : const Color(0xFFF79009),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Text(
                              appt.title,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: textColor,
                                  fontSize: 14),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Icon(LucideIcons.calendar, size: 12, color: textMuted),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    _formatDateTime(appt.scheduledAt),
                                    style: TextStyle(color: textMuted, fontSize: 12),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                Icon(
                                  role == 'patient' ? LucideIcons.userRoundCheck : LucideIcons.user,
                                  size: 12,
                                  color: textMuted,
                                ),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    role == 'patient'
                                        ? 'Bác sĩ: $doctorName'
                                        : 'Bệnh nhân: $patientName',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                        color: textColor,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600),
                                  ),
                                ),
                              ],
                            ),
                            if (appt.notes.isNotEmpty) ...[
                              const SizedBox(height: 8),
                              Text(
                                'Ghi chú: ${appt.notes}',
                                style: TextStyle(color: textMuted, fontSize: 11),
                              ),
                            ],
                            
                            // Nút hành động của bác sĩ cho các lịch hẹn đang chờ và chưa hết hạn
                            if ((role == 'doctor' || role == 'admin') &&
                                status == 'pending' &&
                                !isExpired) ...[
                              const Divider(height: 20),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.end,
                                children: [
                                  OutlinedButton.icon(
                                    onPressed: _updatingIds.contains(appt.id)
                                        ? null
                                        : () => _updateStatus(appt.id, 'cancelled'),
                                    icon: const Icon(LucideIcons.xCircle, size: 14, color: Colors.red),
                                    label: const Text('Từ chối', style: TextStyle(color: Colors.red, fontSize: 12)),
                                    style: OutlinedButton.styleFrom(
                                      side: const BorderSide(color: Colors.red),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  ElevatedButton.icon(
                                    onPressed: _updatingIds.contains(appt.id)
                                        ? null
                                        : () => _updateStatus(appt.id, 'approved'),
                                    icon: const Icon(LucideIcons.checkCircle, size: 14, color: Colors.white),
                                    label: const Text('Duyệt hẹn', style: TextStyle(color: Colors.white, fontSize: 12)),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.green,
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                    ),
                                  ),
                                ],
                              ),
                            ]
                          ],
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}
