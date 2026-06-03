// Màn hình chờ/tải được hiển thị khi khởi động ứng dụng.
// Quy trình làm việc:
// 1. Hiển thị logo CardioGuard AI với độ trễ ngắn (1.5 giây) cho nhãn hiệu.
// 2. Khởi tạo các hook token của AuthProvider, sau đó thử tự động đăng nhập.
// 3. Khi thành công, điều hướng đến /dashboard; nếu không thì đến /login.
// Mối quan hệ:
// - Sở hữu: AuthProvider để khôi phục phiên.
// - Điều hướng: đến /dashboard (tự động đăng nhập OK) hoặc /login (không có phiên).
import 'package:flutter/material.dart';
import 'package:lucide_flutter/lucide_flutter.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../widgets/cg_widgets.dart';

// Màn hình splash được hiển thị trong quá trình khởi tạo ứng dụng và tự động đăng nhập.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _initializeApp();
  }

  // Trì hoãn cho nhãn hiệu, sau đó thử tự động đăng nhập và điều hướng tương ứng.
  Future<void> _initializeApp() async {
    // Đợi cho widgets binding hoàn tất
    await Future.delayed(const Duration(milliseconds: 1500));
    if (!mounted) return;

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    authProvider.init(); // Khởi tạo các hook token

    final autoLoginSuccess = await authProvider.tryAutoLogin();
    if (!mounted) return;

    if (autoLoginSuccess) {
      Navigator.pushReplacementNamed(context, '/dashboard');
    } else {
      Navigator.pushReplacementNamed(context, '/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: CgCard(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: const Color(0xFFE11D48).withValues(alpha: 0.12),
                  ),
                  child: const Icon(LucideIcons.activity,
                      color: Color(0xFFE11D48), size: 34),
                ),
                const SizedBox(height: 16),
                const Text('CardioGuard AI',
                    style:
                        TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                Text(
                  'Đang xác thực phiên đăng nhập và kết nối hệ thống',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      fontSize: 13,
                      color: isDark ? Colors.white70 : Colors.black54),
                ),
                const SizedBox(height: 20),
                const SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(strokeWidth: 2.4),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
