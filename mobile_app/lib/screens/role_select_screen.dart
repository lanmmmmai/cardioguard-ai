import 'package:flutter/material.dart';
import 'package:lucide_flutter/lucide_flutter.dart';
import '../ui/cg_tokens.dart';

class RoleSelectScreen extends StatelessWidget {
  const RoleSelectScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? CgColors.surface : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final subColor = isDark ? const Color(0xFF9EA5B4) : const Color(0xFF6B7280);

    return Scaffold(
      backgroundColor: isDark ? CgColors.background : const Color(0xFFF9FAFB),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const SizedBox(height: 24),
              // Logo
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFE11D48).withValues(alpha: 0.12),
                ),
                child: const Icon(LucideIcons.activity,
                    color: Color(0xFFE11D48), size: 38),
              ),
              const SizedBox(height: 20),
              Text(
                'CardioGuard AI',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  color: textColor,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Hệ thống giám sát tim mạch thông minh',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: subColor),
              ),
              const SizedBox(height: 48),
              Text(
                'Bạn là ai?',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: textColor,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Chọn vai trò để tiếp tục đăng nhập',
                style: TextStyle(fontSize: 14, color: subColor),
              ),
              const SizedBox(height: 32),
              _RoleCard(
                icon: LucideIcons.heart,
                iconColor: const Color(0xFFE11D48),
                iconBg: const Color(0xFFE11D48).withValues(alpha: 0.1),
                title: 'Bệnh nhân',
                subtitle: 'Theo dõi chỉ số tim mạch và lịch hẹn',
                onTap: () => Navigator.pushNamed(
                    context, '/login', arguments: {'role': 'patient'}),
                bg: bg,
                textColor: textColor,
                subColor: subColor,
              ),
              const SizedBox(height: 16),
              _RoleCard(
                icon: LucideIcons.stethoscope,
                iconColor: CgColors.primary,
                iconBg: CgColors.primary.withValues(alpha: 0.1),
                title: 'Bác sĩ',
                subtitle: 'Quản lý bệnh nhân và lịch khám',
                onTap: () => Navigator.pushNamed(
                    context, '/login', arguments: {'role': 'doctor'}),
                bg: bg,
                textColor: textColor,
                subColor: subColor,
              ),
              const SizedBox(height: 16),
              _RoleCard(
                icon: LucideIcons.shieldCheck,
                iconColor: const Color(0xFF7C3AED),
                iconBg: const Color(0xFF7C3AED).withValues(alpha: 0.1),
                title: 'Quản trị viên',
                subtitle: 'Quản lý toàn bộ hệ thống',
                onTap: () => Navigator.pushNamed(
                    context, '/login', arguments: {'role': 'admin'}),
                bg: bg,
                textColor: textColor,
                subColor: subColor,
              ),
              const SizedBox(height: 40),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('Chưa có tài khoản?',
                      style: TextStyle(color: subColor, fontSize: 14)),
                  const SizedBox(width: 4),
                  GestureDetector(
                    onTap: () => Navigator.pushNamed(context, '/register',
                        arguments: {'role': 'patient'}),
                    child: const Text(
                      'Đăng ký ngay',
                      style: TextStyle(
                          color: CgColors.primary,
                          fontWeight: FontWeight.w600,
                          fontSize: 14),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}

class _RoleCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final Color iconBg;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final Color bg;
  final Color textColor;
  final Color subColor;

  const _RoleCard({
    required this.icon,
    required this.iconColor,
    required this.iconBg,
    required this.title,
    required this.subtitle,
    required this.onTap,
    required this.bg,
    required this.textColor,
    required this.subColor,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isDark
                  ? Colors.white.withValues(alpha: 0.08)
                  : Colors.black.withValues(alpha: 0.06),
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: iconBg,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: iconColor, size: 26),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: textColor,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: TextStyle(fontSize: 13, color: subColor),
                    ),
                  ],
                ),
              ),
              Icon(LucideIcons.chevronRight,
                  color: subColor, size: 18),
            ],
          ),
        ),
      ),
    );
  }
}
