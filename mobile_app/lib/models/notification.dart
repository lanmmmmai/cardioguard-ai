// Các mô hình dữ liệu cho thông báo hoạt động và y tế.
// Quy trình làm việc:
//   - NotificationItem đại diện cho một thông báo đơn lẻ từ backend.
//   - Trích xuất dữ liệu thô bao gồm metadata dạng Map và xử lý parse thời gian an toàn.

class NotificationItem {
  final String id;
  final String userId;
  final String? patientId;
  final String? actorId;
  final String type;
  final String category;
  final String severity;
  final String title;
  final String message;
  final String? sourceTable;
  final String? sourceId;
  final Map<String, dynamic> metadata;
  final String? actionUrl;
  final bool isRead;
  final DateTime? readAt;
  final DateTime createdAt;

  NotificationItem({
    required this.id,
    required this.userId,
    this.patientId,
    this.actorId,
    required this.type,
    required this.category,
    required this.severity,
    required this.title,
    required this.message,
    this.sourceTable,
    this.sourceId,
    required this.metadata,
    this.actionUrl,
    required this.isRead,
    this.readAt,
    required this.createdAt,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    return NotificationItem(
      id: json['id'] ?? '',
      userId: json['user_id'] ?? '',
      patientId: json['patient_id'],
      actorId: json['actor_id'],
      type: json['type'] ?? '',
      category: json['category'] ?? 'system',
      severity: json['severity'] ?? 'info',
      title: json['title'] ?? '',
      message: json['message'] ?? '',
      sourceTable: json['source_table'],
      sourceId: json['source_id'],
      metadata: json['metadata'] is Map<String, dynamic>
          ? Map<String, dynamic>.from(json['metadata'])
          : {},
      actionUrl: json['action_url'],
      isRead: json['is_read'] == true,
      readAt: json['read_at'] != null ? DateTime.tryParse(json['read_at'].toString()) : null,
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString()) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'patient_id': patientId,
      'actor_id': actorId,
      'type': type,
      'category': category,
      'severity': severity,
      'title': title,
      'message': message,
      'source_table': sourceTable,
      'source_id': sourceId,
      'metadata': metadata,
      'action_url': actionUrl,
      'is_read': isRead,
      'read_at': readAt?.toIso8601String(),
      'created_at': createdAt.toIso8601String(),
    };
  }
}
