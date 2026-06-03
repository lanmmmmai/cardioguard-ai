// Hiển thị một giá trị số liệu với đơn vị của nó, sử dụng chữ số dạng bảng cho
// chiều rộng ổn định và FittedBox để co giãn đáp ứng.
// Được sử dụng trong các chỉ số bảng điều khiển, thẻ chi tiết bệnh nhân và widget tóm tắt KPI.
import 'package:flutter/material.dart';

class CgMetricValue extends StatelessWidget {
  // Giá trị số dưới dạng chuỗi (ví dụ: "75", "120/80").
  final String value;
  // Nhãn đơn vị (ví dụ: "BPM", "%", "mmHg").
  final String unit;
  // Màu nhấn cho văn bản giá trị; mặc định là màu on-surface của chủ đề.
  final Color? color;
  // Kích thước phông chữ cho phần giá trị (đơn vị luôn là 11 dp).
  final double valueSize;

  const CgMetricValue({
    super.key,
    required this.value,
    required this.unit,
    this.color,
    this.valueSize = 26,
  });

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).textTheme.bodySmall?.color;
    return FittedBox(
      fit: BoxFit.scaleDown,
      alignment: Alignment.bottomLeft,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          Text(
            value,
            style: TextStyle(
              fontFeatures: const [FontFeature.tabularFigures()],
              fontSize: valueSize,
              fontWeight: FontWeight.w800,
              color: color ?? Theme.of(context).colorScheme.onSurface,
            ),
          ),
          const SizedBox(width: 4),
          Text(unit,
              style: TextStyle(
                  color: muted, fontSize: 11, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
