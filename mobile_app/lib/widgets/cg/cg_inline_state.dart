// Liệt kê các loại trạng thái nội tuyến cho widget CgInlineState.
// - loading: hiển thị vòng tròn tải với tiêu đề + tin nhắn.
// - empty, error, disconnected, permissionDenied: hiển thị biểu tượng.
import 'package:flutter/material.dart';
import 'package:lucide_flutter/lucide_flutter.dart';

enum CgStateType { loading, empty, error, disconnected, permissionDenied }

// Một widget trạng thái nội tuyến có thể tái sử dụng (loading / empty / error / disconnected /
// permission denied) được sử dụng trên tất cả các màn hình cho trải nghiệm trạng thái rỗng nhất quán.
class CgInlineState extends StatelessWidget {
  // Loại trạng thái cần hiển thị; xác định biểu tượng và màu sắc.
  final CgStateType type;
  // Văn bản tiêu đề hiển thị bên dưới biểu tượng/vòng tròn tải.
  final String title;
  // Văn bản nội dung mô tả.
  final String message;
  // Callback thử lại tùy chọn (hiển thị dưới dạng nút cho các trạng thái không phải loading).
  final VoidCallback? onRetry;

  const CgInlineState({
    super.key,
    required this.type,
    required this.title,
    required this.message,
    this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    IconData icon;
    Color color;

    switch (type) {
      case CgStateType.loading:
        icon = LucideIcons.loader;
        color = const Color(0xFFE11D48);
        break;
      case CgStateType.empty:
        icon = LucideIcons.inbox;
        color = const Color(0xFF667085);
        break;
      case CgStateType.error:
        icon = LucideIcons.alertTriangle;
        color = const Color(0xFFD92D20);
        break;
      case CgStateType.disconnected:
        icon = LucideIcons.wifiOff;
        color = const Color(0xFFF79009);
        break;
      case CgStateType.permissionDenied:
        icon = LucideIcons.lock;
        color = const Color(0xFFD92D20);
        break;
    }

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (type == CgStateType.loading)
              CircularProgressIndicator(color: color)
            else
              Icon(icon, color: color, size: 36),
            const SizedBox(height: 12),
            Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text(message,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall),
            if (onRetry != null && type != CgStateType.loading) ...[
              const SizedBox(height: 12),
              OutlinedButton(onPressed: onRetry, child: const Text('Thử lại')),
            ]
          ],
        ),
      ),
    );
  }
}
