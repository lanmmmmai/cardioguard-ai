import 'package:flutter/material.dart';

class CgMetricValue extends StatelessWidget {
  final String value;
  final String unit;
  final Color? color;
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
    return Row(
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
    );
  }
}
