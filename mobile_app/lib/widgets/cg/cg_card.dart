// Một thẻ chứa có chủ đề thích ứng với chế độ tối/sáng sử dụng CgTokens.
// Cung cấp một thẻ hình chữ nhật bo góc nhất quán với đường viền và màu nền
// dẫn xuất từ độ sáng Theme hiện tại.
// Được sử dụng trong toàn bộ ứng dụng như thùng chứa bề mặt chính.
import 'package:flutter/material.dart';
import '../../ui/cg_tokens.dart';

class CgCard extends StatelessWidget {
  // Nội dung widget bên trong thẻ.
  final Widget child;
  // Đệm tùy chọn; mặc định là CgSpacing.md.
  final EdgeInsetsGeometry? padding;

  const CgCard({super.key, required this.child, this.padding});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: padding ?? const EdgeInsets.all(CgSpacing.md),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF11151D) : Colors.white,
        borderRadius: BorderRadius.circular(CgRadius.lg),
        border: Border.all(
          color: isDark
              ? Colors.white.withValues(alpha: 0.08)
              : Colors.black.withValues(alpha: 0.08),
        ),
      ),
      child: child,
    );
  }
}
