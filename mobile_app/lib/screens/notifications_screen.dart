// Màn hình trung tâm thông báo của CardioGuard AI — xem danh sách, lọc,
// đánh dấu đã đọc, vuốt để đọc và tuỳ chỉnh cài đặt nhận thông báo.
// Quy trình làm việc:
//   1. Khởi tạo fetchNotifications() và fetchPreferences() trong initState.
//   2. RefreshIndicator hỗ trợ kéo để làm mới danh sách.
//   3. Sử dụng Dismissible hỗ trợ vuốt để đánh dấu đã đọc thông báo.
//   4. Settings icon mở bottom sheet để cấu hình tuỳ chọn bật/tắt thông báo.
// Mối quan hệ:
//   - Phụ thuộc: NotificationProvider, NotificationItem model.
//   - Được điều hướng từ Dashboard chính của ứng dụng.

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/notification_provider.dart';
import '../models/notification.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  String _selectedTab = 'all'; // 'all' hoặc 'unread'

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = Provider.of<NotificationProvider>(context, listen: false);
      provider.fetchNotifications();
      provider.fetchPreferences();
    });
  }

  // Lấy màu sắc phù hợp cho severity
  Color _getSeverityColor(String severity) {
    switch (severity.toLowerCase()) {
      case 'critical':
        return Colors.redAccent.shade700;
      case 'warning':
        return Colors.orange.shade700;
      case 'success':
        return Colors.green.shade700;
      default:
        return Colors.blue.shade700;
    }
  }

  // Lấy icon tương ứng cho category
  IconData _getCategoryIcon(String category) {
    switch (category.toLowerCase()) {
      case 'health':
        return Icons.favorite;
      case 'appointment':
        return Icons.calendar_month;
      case 'record':
        return Icons.description;
      case 'chat':
        return Icons.forum;
      case 'security':
        return Icons.shield;
      default:
        return Icons.notifications;
    }
  }

  // Tên hiển thị của category
  String _getCategoryLabel(String category) {
    switch (category.toLowerCase()) {
      case 'health':
        return 'Sức khỏe';
      case 'appointment':
        return 'Lịch hẹn';
      case 'record':
        return 'Hồ sơ bệnh án';
      case 'chat':
        return 'Tin nhắn';
      case 'security':
        return 'Bảo mật';
      default:
        return 'Hệ thống';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Thông báo hoạt động & y tế',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            tooltip: 'Tùy chọn nhận thông báo',
            onPressed: () => _showSettingsBottomSheet(context),
          ),
          Consumer<NotificationProvider>(
            builder: (context, provider, child) {
              if (provider.unreadCount > 0) {
                return IconButton(
                  icon: const Icon(Icons.done_all),
                  tooltip: 'Đọc tất cả',
                  onPressed: () async {
                    final success = await provider.markAllAsRead();
                    if (success && mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Đã đánh dấu tất cả thông báo là đã đọc'),
                          behavior: SnackBarBehavior.floating,
                        ),
                      );
                    }
                  },
                );
              }
              return const SizedBox.shrink();
            },
          ),
        ],
      ),
      body: Consumer<NotificationProvider>(
        builder: (context, provider, child) {
          final list = provider.notifications.where((n) {
            if (_selectedTab == 'unread' && n.isRead) return false;
            return true;
          }).toList();

          return Column(
            children: [
              // Thanh chọn Tabs lọc
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                color: Theme.of(context).cardColor.withOpacity(0.5),
                child: Row(
                  children: [
                    _buildTabButton('Tất cả', 'all', provider.notifications.length),
                    const SizedBox(width: 12),
                    _buildTabButton('Chưa đọc', 'unread', provider.unreadCount),
                  ],
                ),
              ),
              
              Expanded(
                child: provider.isLoading && list.isEmpty
                    ? const Center(child: CircularProgressIndicator())
                    : RefreshIndicator(
                        onRefresh: () async {
                          await provider.fetchNotifications();
                          await provider.fetchPreferences();
                        },
                        child: list.isEmpty
                            ? _buildEmptyState()
                            : ListView.builder(
                                padding: const EdgeInsets.symmetric(vertical: 8),
                                itemCount: list.length,
                                itemBuilder: (context, index) {
                                  final notif = list[index];
                                  return _buildNotificationTile(context, provider, notif);
                                },
                              ),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }

  // Widget hiển thị tab button
  Widget _buildTabButton(String label, String tabValue, int count) {
    final isActive = _selectedTab == tabValue;
    return ChoiceChip(
      label: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label),
          if (count > 0) ...[
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: isActive ? Colors.white : Colors.grey.shade300,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                count.toString(),
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: isActive ? Theme.of(context).primaryColor : Colors.black87,
                ),
              ),
            ),
          ],
        ],
      ),
      selected: isActive,
      onSelected: (selected) {
        if (selected) {
          setState(() {
            _selectedTab = tabValue;
          });
        }
      },
    );
  }

  Widget _buildEmptyState() {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        SizedBox(height: MediaQuery.of(context).size.height * 0.25),
        const Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.notifications_off_outlined, size: 64, color: Colors.grey),
              SizedBox(height: 16),
              Text(
                'Không có thông báo nào',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.grey),
              ),
              SizedBox(height: 8),
              Text(
                'Mọi cập nhật sức khỏe và lịch hẹn sẽ hiển thị ở đây.',
                textAlign: TextCenter,
                style: TextStyle(fontSize: 13, color: Colors.grey),
              ),
            ],
          ),
        ),
      ],
    );
  }

  // Widget thông báo đơn lẻ sử dụng Dismissible
  Widget _buildNotificationTile(
    BuildContext context,
    NotificationProvider provider,
    NotificationItem notif,
  ) {
    final severityColor = _getSeverityColor(notif.severity);
    final categoryIcon = _getCategoryIcon(notif.category);
    final isAI = notif.type == 'health_warning' || notif.message.contains('AI');

    return Dismissible(
      key: Key(notif.id),
      direction: notif.isRead ? DismissDirection.none : DismissDirection.endToStart,
      background: Container(
        color: Colors.blue.shade700,
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: const Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            Icon(Icons.mark_chat_read, color: Colors.white),
            SizedBox(width: 8),
            Text('Đọc', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ],
        ),
      ),
      onDismissed: (_) {
        provider.markAsRead(notif.id);
      },
      child: Card(
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        elevation: notif.isRead ? 0 : 2,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(
            color: notif.isRead ? Colors.grey.shade200 : severityColor.withOpacity(0.3),
            width: 1,
          ),
        ),
        color: notif.isRead ? Colors.grey.shade50 : Colors.white,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () {
            if (!notif.isRead) {
              provider.markAsRead(notif.id);
            }
            // Hỗ trợ điều hướng deep-link nếu actionUrl có định nghĩa
            if (notif.actionUrl != null && notif.actionUrl!.isNotEmpty) {
              // MVP chỉ xử lý in-app message
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('Chuyển hướng đến: ${notif.actionUrl}'),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            }
          },
          child: Padding(
            padding: const EdgeInsets.all(14.0),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Icon trái
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: notif.isRead ? Colors.grey.shade200 : severityColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    categoryIcon,
                    color: notif.isRead ? Colors.grey : severityColor,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 14),
                
                // Nội dung
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.between,
                        children: [
                          Expanded(
                            child: Text(
                              notif.title,
                              style: TextStyle(
                                fontWeight: notif.isRead ? FontWeight.normal : FontWeight.bold,
                                fontSize: 14,
                                color: notif.isRead ? Colors.black87 : Colors.black,
                              ),
                            ),
                          ),
                          // Chấm đỏ unread
                          if (!notif.isRead)
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: severityColor,
                                shape: BoxShape.circle,
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        notif.message,
                        style: TextStyle(
                          fontSize: 13,
                          color: notif.isRead ? Colors.grey.shade600 : Colors.black87,
                          height: 1.35,
                        ),
                      ),
                      
                      // Medical disclaimer cho cảnh báo AI
                      if (isAI) ...[
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.orange.shade50.withOpacity(0.5),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: Colors.orange.shade200.withOpacity(0.5)),
                          ),
                          child: Text(
                            '*Lưu ý: Đây là phân tích tham khảo từ trợ lý AI, không thay thế cho chẩn đoán y khoa chuyên nghiệp.*',
                            style: TextStyle(
                              fontSize: 10,
                              fontStyle: FontStyle.italic,
                              color: Colors.orange.shade900,
                            ),
                          ),
                        ),
                      ],
                      
                      const SizedBox(height: 8),
                      // Meta
                      Row(
                        mainAxisAlignment: MainAxisAlignment.between,
                        children: [
                          Text(
                            _getCategoryLabel(notif.category),
                            style: TextStyle(
                              fontSize: 10,
                              color: Colors.grey.shade500,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Text(
                            _formatDateTime(notif.createdAt),
                            style: TextStyle(
                              fontSize: 10,
                              color: Colors.grey.shade500,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _formatDateTime(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 60) {
      return '${diff.inMinutes} phút trước';
    } else if (diff.inHours < 24) {
      return '${diff.inHours} giờ trước';
    } else {
      return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    }
  }

  // Cấu hình preferences bottom sheet
  void _showSettingsBottomSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            final provider = Provider.of<NotificationProvider>(context);
            final prefs = provider.preferences;

            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade300,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Cài đặt nhận thông báo',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Tuỳ chọn thông báo bạn muốn nhận. Lưu ý các cảnh báo y tế khẩn cấp sẽ luôn được bật.',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                  ),
                  const SizedBox(height: 16),
                  Flexible(
                    child: ListView(
                      shrinkWrap: true,
                      children: prefs.keys.map((key) {
                        final isHealth = key.toLowerCase() == 'health';
                        return SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(
                            _getCategoryLabel(key),
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                          ),
                          subtitle: isHealth
                              ? Text(
                                  'Luôn bật',
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: Colors.redAccent.shade700,
                                    fontWeight: FontWeight.bold,
                                  ),
                                )
                              : null,
                          value: isHealth ? true : (prefs[key] ?? true),
                          onChanged: isHealth
                              ? null
                              : (value) async {
                                  final Map<String, bool> newPrefs = Map.from(prefs);
                                  newPrefs[key] = value;
                                  // Cập nhật trạng thái tạm thời trong modal
                                  setModalState(() {});
                                  // Gửi lên server
                                  await provider.updatePreferences(newPrefs);
                                },
                        );
                      }).toList(),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
              ),
            );
          },
        );
      },
    );
  }
}
