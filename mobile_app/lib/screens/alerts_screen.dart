// Hiển thị dòng thời gian cảnh báo y tế có thể lọc và tìm kiếm (Nhật ký cảnh báo).
// Quy trình làm việc:
// 1. Khi khởi tạo, tìm nạp cảnh báo từ AlertProvider qua callback sau khung hình.
// 2. Người dùng có thể lọc theo mức độ nghiêm trọng (tất cả / cao / trung bình / thấp) và tìm kiếm theo tên,
//    tin nhắn hoặc loại cảnh báo thông qua TextField và dropdown cục bộ.
// 3. Mỗi thẻ cảnh báo hiển thị đường viền trái theo màu mức độ, biểu tượng, dấu thời gian,
//    tên bệnh nhân, loại cảnh báo và tin nhắn.
// 4. Người dùng bác sĩ/quản trị viên thấy nút "xác nhận xử lý" trên các cảnh báo chưa giải quyết; nhấn vào nó
//    gọi AlertProvider.resolveAlert và hiển thị snackbar kết quả.
// Mối quan hệ:
// - Sở hữu: AlertProvider cho dữ liệu cảnh báo, AuthProvider cho kiểm tra vai trò.
// - Được sử dụng bởi: Điều hướng tab ứng dụng.
// - Sử dụng: cg_widgets.dart cho CgScreenScaffold, CgInlineState, CgStatusBadge.
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_flutter/lucide_flutter.dart';
import '../providers/alert_provider.dart';
import '../providers/auth_provider.dart';
import '../widgets/cg_widgets.dart';
import '../ui/cg_tokens.dart';

// Màn hình liệt kê tất cả các cảnh báo y tế với tìm kiếm và lọc mức độ nghiêm trọng.
class AlertsScreen extends StatefulWidget {
  // Liệu màn hình có được hiển thị ở chế độ tối hay không.
  final bool isDarkTheme;
  const AlertsScreen({super.key, required this.isDarkTheme});

  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  // Bộ điều khiển cho trường văn bản tìm kiếm.
  final _searchController = TextEditingController();
  // Truy vấn tìm kiếm đã được chuyển thành chữ thường (cập nhật sau mỗi lần gõ phím).
  String _searchQuery = '';
  // Giá trị bộ lọc mức độ nghiêm trọng hiện tại: 'all', 'high', 'medium', hoặc 'low'.
  String _severityFilter = 'all';
  // Tập hợp các ID cảnh báo hiện đang được giải quyết (hiển thị vòng tròn tải trên mỗi thẻ).
  final Set<String> _resolvingIds = <String>{};

  @override
  void initState() {
    super.initState();
    _searchController.addListener(() {
      setState(() {
        _searchQuery = _searchController.text.toLowerCase();
      });
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<AlertProvider>(context, listen: false).fetchAlerts();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  // Định dạng DateTime thành chuỗi HH:mm - dd/MM ngắn theo giờ địa phương.
  String _formatDateTime(DateTime dateTime) {
    final local = dateTime.toLocal();
    final hour = local.hour.toString().padLeft(2, '0');
    final minute = local.minute.toString().padLeft(2, '0');
    final day = local.day.toString().padLeft(2, '0');
    final month = local.month.toString().padLeft(2, '0');
    return '$hour:$minute - $day/$month';
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final alertProvider = Provider.of<AlertProvider>(context);

    final isDark = widget.isDarkTheme;
    final cardBg = isDark ? const Color(0xFF11151D) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF1D2939);
    final textMuted =
        isDark ? const Color(0xFF9EA5B4) : const Color(0xFF475467);
    final borderColor = isDark
        ? Colors.white.withValues(alpha: 0.07)
        : Colors.black.withValues(alpha: 0.08);

    final role = authProvider.currentUser?.role ?? 'patient';

    // Áp dụng lọc tìm kiếm và mức độ nghiêm trọng cục bộ:
    // - Tìm kiếm khớp tên bệnh nhân, tin nhắn hoặc loại cảnh báo (không phân biệt chữ hoa chữ thường).
    // - Nhóm mức độ nghiêm trọng: high=critical/sos, medium=warning, low=info.
    // - Các cảnh báo đã giải quyết được giữ trong danh sách nhưng hiển thị màu xám.
    final filtered = alertProvider.alerts.where((a) {
      final name = a.fullName.toLowerCase();
      final msg = a.message.toLowerCase();
      final type = a.alertType.toLowerCase();
      final matchesSearch = name.contains(_searchQuery) ||
          msg.contains(_searchQuery) ||
          type.contains(_searchQuery);

      if (!matchesSearch) return false;

      if (_severityFilter == 'all') return true;
      final sev = a.severity.toLowerCase();
      if (_severityFilter == 'high') {
        return (sev == 'high' || sev == 'critical' || sev == 'sos');
      }
      if (_severityFilter == 'medium') {
        return (sev == 'medium' || sev == 'warning');
      }
      if (_severityFilter == 'low') return (sev == 'low' || sev == 'info');
      return true;
    }).toList();

    return CgScreenScaffold(
      title: 'Nhật ký cảnh báo',
      subtitle: 'Hồ sơ ghi nhận cảnh báo y tế (${filtered.length})',
      trailing: IconButton(
        onPressed: alertProvider.fetchAlerts,
        icon: Icon(LucideIcons.refreshCw, color: textColor),
        style: IconButton.styleFrom(
          backgroundColor: cardBg,
          side: BorderSide(color: borderColor),
        ),
      ),
      body: Column(
        children: [
          // Thanh tìm kiếm và bộ lọc
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            child: Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: cardBg,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: borderColor),
              ),
              child: Column(
                children: [
                  TextField(
                    controller: _searchController,
                    style: TextStyle(color: textColor, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'Tìm kiếm tên hoặc nội dung cảnh báo...',
                      hintStyle: TextStyle(color: textMuted, fontSize: 13),
                      prefixIcon:
                          Icon(LucideIcons.search, color: textMuted, size: 16),
                      filled: true,
                      fillColor: isDark
                          ? Colors.white.withValues(alpha: 0.01)
                          : Colors.black.withValues(alpha: 0.02),
                      contentPadding: const EdgeInsets.symmetric(vertical: 8),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Icon(LucideIcons.filter, color: textMuted, size: 14),
                      const SizedBox(width: 6),
                      Text('Độ nghiêm trọng:',
                          style: TextStyle(
                              color: textMuted,
                              fontSize: 12,
                              fontWeight: FontWeight.bold)),
                      const SizedBox(width: 10),
                      Expanded(
                        child: SizedBox(
                          height: 34,
                          child: DropdownButtonFormField<String>(
                            value: _severityFilter,
                            dropdownColor: cardBg,
                            style: TextStyle(color: textColor, fontSize: 12),
                            decoration: InputDecoration(
                              contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 10, vertical: 0),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                                borderSide: BorderSide(color: borderColor),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(8),
                                borderSide:
                                    const BorderSide(color: Color(0xFFFF3366)),
                              ),
                            ),
                            items: const [
                              DropdownMenuItem(
                                  value: 'all', child: Text('Tất cả')),
                              DropdownMenuItem(
                                  value: 'high',
                                  child: Text('Nguy kịch (High)')),
                              DropdownMenuItem(
                                  value: 'medium',
                                  child: Text('Chú ý (Medium)')),
                              DropdownMenuItem(
                                  value: 'low', child: Text('Thông tin (Low)')),
                            ],
                            onChanged: (val) {
                              if (val != null) {
                                setState(() => _severityFilter = val);
                              }
                            },
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Danh sách dòng thời gian cảnh báo
          Expanded(
            child: alertProvider.isLoading
                ? const CgInlineState(
                    type: CgStateType.loading,
                    title: 'Đang tải cảnh báo',
                    message: 'Hệ thống đang đồng bộ nhật ký cảnh báo.',
                  )
                : filtered.isEmpty
                    ? RefreshIndicator(
                        onRefresh: alertProvider.fetchAlerts,
                        color: CgColors.primary,
                        child: ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: [
                            SizedBox(
                                height:
                                    MediaQuery.of(context).size.height * 0.15),
                            const CgInlineState(
                              type: CgStateType.empty,
                              title: 'Không có cảnh báo',
                              message:
                                  'Hệ thống đang hoạt động ổn định trong thời điểm hiện tại.',
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: alertProvider.fetchAlerts,
                        color: const Color(0xFFFF3366),
                        child: ListView.builder(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 8),
                          itemCount: filtered.length,
                          itemBuilder: (context, index) {
                            final alert = filtered[index];
                            final severity = alert.severity.toLowerCase();

                            Color leftBorderColor;
                            Color alertStripBg;
                            Color iconColor;

                            if (severity == 'high' ||
                                severity == 'critical' ||
                                severity == 'sos') {
                              leftBorderColor = CgColors.critical;
                              alertStripBg =
                                  CgColors.critical.withValues(alpha: 0.04);
                              iconColor = CgColors.critical;
                            } else if (severity == 'medium' ||
                                severity == 'warning') {
                              leftBorderColor = CgColors.warning;
                              alertStripBg =
                                  CgColors.warning.withValues(alpha: 0.03);
                              iconColor = CgColors.warning;
                            } else {
                              leftBorderColor = CgColors.normal;
                              alertStripBg = cardBg;
                              iconColor = CgColors.normal;
                            }

                            if (alert.isResolved) {
                              leftBorderColor = Colors.grey;
                              alertStripBg = cardBg.withValues(alpha: 0.5);
                              iconColor = Colors.grey;
                            }

                            return Container(
                              margin: const EdgeInsets.only(bottom: 12),
                              decoration: BoxDecoration(
                                color: alertStripBg,
                                borderRadius: BorderRadius.circular(14),
                                border: Border(
                                  left: BorderSide(
                                      color: leftBorderColor, width: 4.0),
                                  top: BorderSide(color: borderColor),
                                  right: BorderSide(color: borderColor),
                                  bottom: BorderSide(color: borderColor),
                                ),
                              ),
                              child: Padding(
                                padding: const EdgeInsets.all(16.0),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Icon(
                                        alert.alertType == 'SOS'
                                            ? LucideIcons.shieldAlert
                                            : LucideIcons.alertTriangle,
                                        color: iconColor,
                                        size: 20),
                                    const SizedBox(width: 14),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            mainAxisAlignment:
                                                MainAxisAlignment.spaceBetween,
                                            children: [
                                              Expanded(
                                                child: Row(
                                                  children: [
                                                    Text(
                                                      alert.fullName,
                                                      style: TextStyle(
                                                          fontWeight:
                                                              FontWeight.bold,
                                                          fontSize: 13,
                                                          color: textColor),
                                                    ),
                                                    const SizedBox(width: 6),
                                                    CgStatusBadge(
                                                        label: alert.severity
                                                            .toUpperCase(),
                                                        color: leftBorderColor),
                                                  ],
                                                ),
                                              ),
                                              Text(
                                                _formatDateTime(
                                                    alert.createdAt),
                                                style: TextStyle(
                                                    color: textMuted,
                                                    fontSize: 10),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 6),
                                          Text(
                                            alert.alertType,
                                            style: TextStyle(
                                                color: textColor,
                                                fontSize: 12,
                                                fontWeight: FontWeight.w600),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(alert.message,
                                              style: TextStyle(
                                                  color: textMuted,
                                                  fontSize: 12)),

                                          // Nút Xác nhận xử lý (chỉ dành cho bác sĩ/quản trị viên)
                                          if ((role == 'doctor' ||
                                                  role == 'admin') &&
                                              !alert.isResolved) ...[
                                            const SizedBox(height: 12),
                                            Align(
                                              alignment: Alignment.centerRight,
                                              child: TextButton.icon(
                                                onPressed: _resolvingIds
                                                        .contains(alert.id)
                                                    ? null
                                                    : () async {
                                                        setState(() =>
                                                            _resolvingIds
                                                                .add(alert.id));
                                                        final messenger =
                                                            ScaffoldMessenger
                                                                .of(context);
                                                        final ok =
                                                            await alertProvider
                                                                .resolveAlert(
                                                                    alert.id);
                                                        if (mounted) {
                                                          setState(() =>
                                                              _resolvingIds
                                                                  .remove(alert
                                                                      .id));
                                                          messenger
                                                              .showSnackBar(
                                                            SnackBar(
                                                              content: Text(ok
                                                                  ? 'Đã xác nhận cảnh báo.'
                                                                  : 'Không thể xác nhận. Vui lòng thử lại.'),
                                                              backgroundColor: ok
                                                                  ? CgColors
                                                                      .normal
                                                                  : CgColors
                                                                      .critical,
                                                            ),
                                                          );
                                                        }
                                                      },
                                                icon: _resolvingIds
                                                        .contains(alert.id)
                                                    ? const SizedBox(
                                                        width: 14,
                                                        height: 14,
                                                        child:
                                                            CircularProgressIndicator(
                                                                strokeWidth: 2))
                                                    : const Icon(
                                                        LucideIcons.checkSquare,
                                                        size: 14,
                                                        color: Colors.green),
                                                label: Text(
                                                    _resolvingIds
                                                            .contains(alert.id)
                                                        ? 'Đang xử lý...'
                                                        : 'Xác nhận xử lý',
                                                    style: const TextStyle(
                                                        color: Colors.green,
                                                        fontSize: 12,
                                                        fontWeight:
                                                            FontWeight.bold)),
                                                style: TextButton.styleFrom(
                                                  padding: const EdgeInsets
                                                      .symmetric(
                                                      horizontal: 10,
                                                      vertical: 6),
                                                  backgroundColor: Colors.green
                                                      .withValues(alpha: 0.1),
                                                  shape: RoundedRectangleBorder(
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                              8)),
                                                ),
                                              ),
                                            )
                                          ]
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}
