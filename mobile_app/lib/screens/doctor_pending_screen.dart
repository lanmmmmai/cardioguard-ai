import 'package:flutter/material.dart';
import 'package:lucide_flutter/lucide_flutter.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../ui/cg_tokens.dart';

class DoctorPendingScreen extends StatelessWidget {
  const DoctorPendingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final subColor = isDark ? const Color(0xFF9EA5B4) : const Color(0xFF6B7280);

    return Scaffold(
      backgroundColor: isDark ? CgColors.background : const Color(0xFFF9FAFB),
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 88,
                  height: 88,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: const Color(0xFFF59E0B).withValues(alpha: 0.15),
                  ),
                  child: const Icon(LucideIcons.clock,
                      color: Color(0xFFF59E0B), size: 44),
                ),
                const SizedBox(height: 28),
                Text(
                  'Tài khoản đang chờ duyệt',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: textColor,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Tài khoản bác sĩ của bạn đang được quản trị viên xét duyệt. Quá trình này thường mất 1–2 ngày làm việc.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 15, color: subColor, height: 1.6),
                ),
                const SizedBox(height: 32),
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF59E0B).withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                        color:
                            const Color(0xFFF59E0B).withValues(alpha: 0.25)),
                  ),
                  child: Column(
                    children: [
                      _CheckItem(
                          text: 'Hồ sơ đã được gửi thành công',
                          done: true,
                          isDark: isDark),
                      const SizedBox(height: 12),
                      _CheckItem(
                          text: 'Đang chờ xét duyệt từ admin',
                          done: false,
                          isDark: isDark),
                      const SizedBox(height: 12),
                      _CheckItem(
                          text: 'Nhận thông báo khi được duyệt',
                          done: false,
                          isDark: isDark),
                    ],
                  ),
                ),
                const SizedBox(height: 36),
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      final authProvider =
                          Provider.of<AuthProvider>(context, listen: false);
                      await authProvider.logout();
                      if (context.mounted) {
                        Navigator.pushReplacementNamed(context, '/role-select');
                      }
                    },
                    icon: const Icon(LucideIcons.logOut, size: 18),
                    label: const Text('Đăng xuất'),
                    style: OutlinedButton.styleFrom(
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CheckItem extends StatelessWidget {
  final String text;
  final bool done;
  final bool isDark;
  const _CheckItem(
      {required this.text, required this.done, required this.isDark});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: done
                ? const Color(0xFF10B981).withValues(alpha: 0.2)
                : const Color(0xFFF59E0B).withValues(alpha: 0.15),
          ),
          child: Icon(
            done ? LucideIcons.check : LucideIcons.clock,
            size: 14,
            color: done ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            text,
            style: TextStyle(
              fontSize: 14,
              color: isDark ? Colors.white70 : const Color(0xFF374151),
            ),
          ),
        ),
      ],
    );
  }
}
