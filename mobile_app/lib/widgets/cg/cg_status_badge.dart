// Một huy hiệu nhỏ có màu được sử dụng để hiển thị thẻ trạng thái hoặc mức độ nghiêm trọng.
// Hiển thị văn bản label ở dạng chữ hoa trên nền color bán trong suốt
// với các góc bo tròn. Được sử dụng trong thẻ cảnh báo và lịch hẹn.
import 'package:flutter/material.dart';

class CgStatusBadge extends StatelessWidget {
  // Văn bản hiển thị bên trong huy hiệu (tự động viết hoa kiểu).
  final String label;
  // Màu nhấn cho nền huy hiệu (ở độ mờ 12%) và văn bản.
  final Color color;

  const CgStatusBadge({super.key, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style:
            TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w700),
      ),
    );
  }
}
