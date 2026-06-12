// Một widget cột tiêu đề + phụ đề tùy chọn được sử dụng trong tiêu đề CgScreenScaffold.
// Tiêu đề sử dụng kiểu văn bản titleLarge của Theme; phụ đề sử dụng bodySmall với
// màu mờ.
import 'package:flutter/material.dart';

class CgSectionTitle extends StatelessWidget {
  // Văn bản tiêu đề chính.
  final String title;
  // Văn bản phụ tùy chọn hiển thị bên dưới tiêu đề.
  final String? subtitle;

  const CgSectionTitle({super.key, required this.title, this.subtitle});

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).textTheme.bodySmall?.color;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleLarge),
        if (subtitle != null) ...[
          const SizedBox(height: 4),
          Text(subtitle!,
              style: Theme.of(context)
                  .textTheme
                  .bodySmall
                  ?.copyWith(color: muted)),
        ]
      ],
    );
  }
}
