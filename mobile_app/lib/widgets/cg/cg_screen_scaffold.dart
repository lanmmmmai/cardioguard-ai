// Khung trang tiêu chuẩn cho các màn hình CardioGuard.
// Cung cấp bố cục nhất quán với hàng tiêu đề CgSectionTitle (tiêu đề +
// phụ đề tùy chọn + widget theo sau tùy chọn) và vùng nội dung mở rộng.
// Được sử dụng bởi hầu hết các widget cấp màn hình để duy trì tính nhất quán trực quan.
import 'package:flutter/material.dart';
import 'cg_section_title.dart';

class CgScreenScaffold extends StatelessWidget {
  // Tiêu đề màn hình hiển thị trong tiêu đề.
  final String title;
  // Phụ đề tùy chọn hiển thị bên dưới tiêu đề.
  final String? subtitle;
  // Nội dung chính có thể cuộn/co giãn của màn hình.
  final Widget body;
  // Widget tùy chọn đặt ở bên phải hàng tiêu đề (ví dụ: nút hành động).
  final Widget? trailing;

  const CgScreenScaffold({
    super.key,
    required this.title,
    required this.body,
    this.subtitle,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Row(
                children: [
                  Expanded(
                      child: CgSectionTitle(title: title, subtitle: subtitle)),
                  if (trailing != null) trailing!,
                ],
              ),
            ),
            Expanded(child: body),
          ],
        ),
      ),
    );
  }
}
