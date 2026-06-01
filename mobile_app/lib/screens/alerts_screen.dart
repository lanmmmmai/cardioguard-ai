import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_flutter/lucide_flutter.dart';
import '../providers/alert_provider.dart';
import '../providers/auth_provider.dart';

class AlertsScreen extends StatefulWidget {
  final bool isDarkTheme;
  const AlertsScreen({super.key, required this.isDarkTheme});

  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';
  String _severityFilter = 'all';

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
    final primaryBg = isDark ? const Color(0xFF07080A) : const Color(0xFFF5F6F8);
    final cardBg = isDark ? const Color(0xFF11151D) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF1D2939);
    final textMuted = isDark ? const Color(0xFF9EA5B4) : const Color(0xFF475467);
    final borderColor = isDark ? Colors.white.withValues(alpha: 0.07) : Colors.black.withValues(alpha: 0.08);

    final role = authProvider.currentUser?.role ?? 'patient';

    // Apply local search and severity filtering
    final filtered = alertProvider.alerts.where((a) {
      final name = a.fullName.toLowerCase();
      final msg = a.message.toLowerCase();
      final type = a.alertType.toLowerCase();
      final matchesSearch = name.contains(_searchQuery) || msg.contains(_searchQuery) || type.contains(_searchQuery);

      if (!matchesSearch) return false;

      if (_severityFilter == 'all') return true;
      final sev = a.severity.toLowerCase();
      if (_severityFilter == 'high') return (sev == 'high' || sev == 'critical' || sev == 'sos');
      if (_severityFilter == 'medium') return (sev == 'medium' || sev == 'warning');
      if (_severityFilter == 'low') return (sev == 'low' || sev == 'info');
      return true;
    }).toList();

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
                        'Nhật Ký Cảnh Báo',
                        style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: textColor),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Hồ sơ ghi nhận các cảnh báo y tế (${filtered.length})',
                        style: TextStyle(color: textMuted, fontSize: 13),
                      ),
                    ],
                  ),
                  IconButton(
                    onPressed: alertProvider.fetchAlerts,
                    icon: Icon(LucideIcons.refreshCw, color: textColor),
                    style: IconButton.styleFrom(
                      backgroundColor: cardBg,
                      side: BorderSide(color: borderColor),
                    ),
                  )
                ],
              ),
            ),

            // Search and Filters Bar
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
                        prefixIcon: Icon(LucideIcons.search, color: textMuted, size: 16),
                        filled: true,
                        fillColor: isDark ? Colors.white.withValues(alpha: 0.01) : Colors.black.withValues(alpha: 0.02),
                        contentPadding: const EdgeInsets.symmetric(vertical: 8),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Icon(LucideIcons.filter, color: textMuted, size: 14),
                        const SizedBox(width: 6),
                        Text('Độ nghiêm trọng:', style: TextStyle(color: textMuted, fontSize: 12, fontWeight: FontWeight.bold)),
                        const SizedBox(width: 10),
                        Expanded(
                          child: SizedBox(
                            height: 34,
                            child: DropdownButtonFormField<String>(
                              initialValue: _severityFilter,
                              dropdownColor: cardBg,
                              style: TextStyle(color: textColor, fontSize: 12),
                              decoration: InputDecoration(
                                contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 0),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(8),
                                  borderSide: BorderSide(color: borderColor),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(8),
                                  borderSide: const BorderSide(color: Color(0xFFFF3366)),
                                ),
                              ),
                              items: const [
                                DropdownMenuItem(value: 'all', child: Text('Tất cả')),
                                DropdownMenuItem(value: 'high', child: Text('Nguy kịch (High)')),
                                DropdownMenuItem(value: 'medium', child: Text('Chú ý (Medium)')),
                                DropdownMenuItem(value: 'low', child: Text('Thông tin (Low)')),
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

            // Alerts Timeline List
            Expanded(
              child: alertProvider.isLoading
                  ? const Center(child: CircularProgressIndicator(color: Color(0xFFFF3366)))
                  : filtered.isEmpty
                      ? RefreshIndicator(
                          onRefresh: alertProvider.fetchAlerts,
                          color: const Color(0xFFFF3366),
                          child: ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: [
                              SizedBox(height: MediaQuery.of(context).size.height * 0.2),
                              Icon(LucideIcons.shieldCheck, color: const Color(0xFF39FF14).withValues(alpha: 0.8), size: 48),
                              const SizedBox(height: 14),
                              Center(child: Text('Không có cảnh báo nào', style: TextStyle(color: textColor, fontWeight: FontWeight.bold, fontSize: 15))),
                              const SizedBox(height: 4),
                              Center(child: Text('Hệ thống đang hoạt động an toàn.', style: TextStyle(color: textMuted, fontSize: 12))),
                            ],
                          ),
                        )
                      : RefreshIndicator(
                          onRefresh: alertProvider.fetchAlerts,
                          color: const Color(0xFFFF3366),
                          child: ListView.builder(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            itemCount: filtered.length,
                            itemBuilder: (context, index) {
                              final alert = filtered[index];
                              final severity = alert.severity.toLowerCase();

                              Color leftBorderColor;
                              Color alertStripBg;
                              Color iconColor;

                              if (severity == 'high' || severity == 'critical' || severity == 'sos') {
                                leftBorderColor = const Color(0xFFFF3366);
                                alertStripBg = const Color(0xFFFF3366).withValues(alpha: 0.04);
                                iconColor = const Color(0xFFFF3366);
                              } else if (severity == 'medium' || severity == 'warning') {
                                leftBorderColor = const Color(0xFFFFB606);
                                alertStripBg = const Color(0xFFFFB606).withValues(alpha: 0.03);
                                iconColor = const Color(0xFFFFB606);
                              } else {
                                leftBorderColor = const Color(0xFF39FF14);
                                alertStripBg = cardBg;
                                iconColor = const Color(0xFF39FF14);
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
                                    left: BorderSide(color: leftBorderColor, width: 4.0),
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
                                        alert.alertType == 'SOS' ? LucideIcons.shieldAlert : LucideIcons.alertTriangle, 
                                        color: iconColor, 
                                        size: 20
                                      ),
                                      const SizedBox(width: 14),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                              children: [
                                                Expanded(
                                                  child: Row(
                                                    children: [
                                                      Text(
                                                        alert.fullName,
                                                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: textColor),
                                                      ),
                                                      const SizedBox(width: 6),
                                                      Container(
                                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                        decoration: BoxDecoration(
                                                          color: leftBorderColor.withValues(alpha: 0.12),
                                                          borderRadius: BorderRadius.circular(8),
                                                        ),
                                                        child: Text(
                                                          alert.severity.toUpperCase(),
                                                          style: TextStyle(color: leftBorderColor, fontSize: 8, fontWeight: FontWeight.bold),
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                                Text(
                                                  _formatDateTime(alert.createdAt),
                                                  style: TextStyle(color: textMuted, fontSize: 10),
                                                ),
                                              ],
                                            ),
                                            const SizedBox(height: 6),
                                            Text(
                                              alert.alertType,
                                              style: TextStyle(color: textColor, fontSize: 12, fontWeight: FontWeight.w600),
                                            ),
                                            const SizedBox(height: 2),
                                            Text(alert.message, style: TextStyle(color: textMuted, fontSize: 12)),
                                            
                                            // Action Resolve Button (Doctor/Admin only)
                                            if ((role == 'doctor' || role == 'admin') && !alert.isResolved) ...[
                                              const SizedBox(height: 12),
                                              Align(
                                                alignment: Alignment.centerRight,
                                                child: TextButton.icon(
                                                  onPressed: () => alertProvider.resolveAlert(alert.id),
                                                  icon: const Icon(LucideIcons.checkSquare, size: 14, color: Colors.green),
                                                  label: const Text('Xác nhận xử lý', style: TextStyle(color: Colors.green, fontSize: 12, fontWeight: FontWeight.bold)),
                                                  style: TextButton.styleFrom(
                                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                                    backgroundColor: Colors.green.withValues(alpha: 0.1),
                                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
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
      ),
    );
  }
}


