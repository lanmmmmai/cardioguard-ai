import 'package:flutter/material.dart';
import 'package:lucide_flutter/lucide_flutter.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../ui/cg_tokens.dart';

class DoctorRejectedScreen extends StatelessWidget {
  const DoctorRejectedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final subColor = isDark ? const Color(0xFF9EA5B4) : const Color(0xFF6B7280);
    final args = ModalRoute.of(context)?.settings.arguments as Map?;
    final reason = args?['reason'] as String?;

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
                    color: CgColors.critical.withValues(alpha: 0.12),
                  ),
                  child: const Icon(LucideIcons.xCircle,
                      color: CgColors.critical, size: 44),
                ),
                const SizedBox(height: 28),
                Text(
                  'Tài khoản bị từ chối',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: textColor,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  'Yêu cầu đăng ký tài khoản bác sĩ của bạn không được phê duyệt.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 15, color: subColor, height: 1.6),
                ),
                if (reason != null && reason.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: CgColors.critical.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: CgColors.critical.withValues(alpha: 0.25)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: const [
                            Icon(LucideIcons.messageSquare,
                                size: 15, color: CgColors.critical),
                            SizedBox(width: 6),
                            Text(
                              'Lý do từ quản trị viên:',
                              style: TextStyle(
                                  color: CgColors.critical,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 13),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(reason,
                            style: TextStyle(
                                fontSize: 14,
                                color: isDark
                                    ? Colors.white70
                                    : const Color(0xFF374151),
                                height: 1.5)),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 32),
                Text(
                  'Bạn có thể liên hệ bộ phận hỗ trợ để biết thêm chi tiết hoặc đăng ký lại với thông tin đầy đủ hơn.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13, color: subColor, height: 1.6),
                ),
                const SizedBox(height: 36),
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton.icon(
                    onPressed: () async {
                      final authProvider =
                          Provider.of<AuthProvider>(context, listen: false);
                      await authProvider.logout();
                      if (context.mounted) {
                        Navigator.pushReplacementNamed(context, '/register',
                            arguments: {'role': 'doctor'});
                      }
                    },
                    icon: const Icon(LucideIcons.refreshCw, size: 18),
                    label: const Text('Đăng ký lại'),
                    style: ElevatedButton.styleFrom(
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
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
