import 'package:flutter/material.dart';
import 'cg_section_title.dart';

class CgScreenScaffold extends StatelessWidget {
  final String title;
  final String? subtitle;
  final Widget body;
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
