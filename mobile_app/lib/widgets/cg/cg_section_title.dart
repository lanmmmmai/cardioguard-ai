import 'package:flutter/material.dart';

class CgSectionTitle extends StatelessWidget {
  final String title;
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
