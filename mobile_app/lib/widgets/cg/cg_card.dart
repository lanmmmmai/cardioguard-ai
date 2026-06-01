import 'package:flutter/material.dart';
import '../../ui/cg_tokens.dart';

class CgCard extends StatelessWidget {
  final Widget child;
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
