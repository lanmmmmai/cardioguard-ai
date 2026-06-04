// Màn hình đăng nhập cho CardioGuard AI.
// Quy trình làm việc:
// 1. Người dùng nhập email + mật khẩu trong Form có xác thực.
// 2. Khi gửi, gọi AuthProvider.login và điều hướng đến /dashboard khi thành công.
// 3. Hiển thị thông báo lỗi từ AuthProvider.errorMessage hoặc xác thực cục bộ.
// 4. Liên kết "Chưa có tài khoản?" điều hướng đến /register.
// Mối quan hệ:
// - Sở hữu: AuthProvider để xác thực.
// - Sử dụng: CgCard cho thẻ chứa trung tâm.
// - Điều hướng: đến /dashboard (thành công) hoặc /register (đăng ký).
import 'package:flutter/material.dart';
import 'package:lucide_flutter/lucide_flutter.dart';
import 'package:provider/provider.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../providers/auth_provider.dart';
import '../widgets/cg_widgets.dart';

// Màn hình biểu mẫu đăng nhập với xác thực email/mật khẩu.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  // Thông báo lỗi được quản lý cục bộ (ưu tiên hơn lỗi provider).
  String? _localError;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  // Xác thực biểu mẫu và thử đăng nhập qua AuthProvider.
  Future<void> _handleLogin() async {
    setState(() => _localError = null);
    if (!_formKey.currentState!.validate()) return;

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final success = await authProvider.login(
      _emailController.text.trim(),
      _passwordController.text,
    );

    if (success && mounted) {
      Navigator.pushReplacementNamed(context, '/dashboard');
    }
  }

  Future<void> _handleGoogleSignIn() async {
    setState(() => _localError = null);
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    try {
      final googleSignIn = GoogleSignIn(
        scopes: ['email', 'profile'],
      );
      final account = await googleSignIn.signIn();
      if (account == null) {
        // User cancelled sign-in
        return;
      }
      
      final success = await authProvider.loginWithGoogle(
        email: account.email,
        fullName: account.displayName ?? 'Người dùng Google',
        googleId: account.id,
        avatarUrl: account.photoUrl,
      );

      if (success && mounted) {
        Navigator.pushReplacementNamed(context, '/dashboard');
      }
    } catch (e) {
      setState(() {
        _localError = 'Đăng nhập Google thất bại: $e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : Colors.black;
    final muted = isDark ? Colors.white70 : Colors.black54;
    final activeError = _localError ?? authProvider.errorMessage;

    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: CgCard(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(LucideIcons.activity,
                      color: Color(0xFFE11D48), size: 36),
                  const SizedBox(height: 12),
                  Text(
                    'Đăng nhập CardioGuard AI',
                    style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 22,
                        color: textColor),
                  ),
                  const SizedBox(height: 4),
                  Text('Giám sát y tế theo thời gian thực',
                      style: TextStyle(fontSize: 12, color: muted)),
                  const SizedBox(height: 20),
                  if (activeError != null) ...[
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFD92D20).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(activeError,
                          style: const TextStyle(
                              color: Color(0xFFD92D20), fontSize: 12)),
                    ),
                    const SizedBox(height: 12),
                  ],
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    decoration:
                        const InputDecoration(labelText: 'Email tài khoản'),
                    validator: (v) {
                      if (v == null || v.isEmpty) return 'Vui lòng nhập email';
                      if (!v.contains('@')) return 'Email không hợp lệ';
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _passwordController,
                    obscureText: true,
                    decoration: const InputDecoration(labelText: 'Mật khẩu'),
                    validator: (v) {
                      if (v == null || v.isEmpty) {
                        return 'Vui lòng nhập mật khẩu';
                      }
                      if (v.length < 6) return 'Mật khẩu phải từ 6 ký tự';
                      return null;
                    },
                  ),
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: () => Navigator.pushNamed(context, '/forgot-password'),
                      style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 30)),
                      child: Text(
                        'Quên mật khẩu?',
                        style: TextStyle(
                          fontSize: 12,
                          color: Theme.of(context).primaryColor,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      onPressed: authProvider.isLoading ? null : _handleLogin,
                      child: authProvider.isLoading
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white),
                            )
                          : const Text('Đăng nhập hệ thống'),
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: OutlinedButton(
                      onPressed: authProvider.isLoading ? null : _handleGoogleSignIn,
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(
                          color: isDark
                              ? Colors.white.withValues(alpha: 0.15)
                              : Colors.black.withValues(alpha: 0.15),
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        backgroundColor: isDark
                            ? Colors.white.withValues(alpha: 0.03)
                            : Colors.white,
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.g_mobiledata_rounded, color: Colors.red, size: 24),
                          const SizedBox(width: 10),
                          Text(
                            'Đăng nhập bằng Google',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: isDark ? Colors.white : Colors.black87,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: () => Navigator.pushNamed(context, '/register'),
                    child: const Text('Chưa có tài khoản? Đăng ký ngay'),
                  ),
                  const SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      GestureDetector(
                        onTap: () => Navigator.pushNamed(context, '/privacy'),
                        child: const Text(
                          'Bảo mật',
                          style: TextStyle(fontSize: 11, color: Colors.grey, decoration: TextDecoration.underline),
                        ),
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 8),
                        child: Text('|', style: TextStyle(fontSize: 11, color: Colors.grey)),
                      ),
                      GestureDetector(
                        onTap: () => Navigator.pushNamed(context, '/terms'),
                        child: const Text(
                          'Điều khoản',
                          style: TextStyle(fontSize: 11, color: Colors.grey, decoration: TextDecoration.underline),
                        ),
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 8),
                        child: Text('|', style: TextStyle(fontSize: 11, color: Colors.grey)),
                      ),
                      GestureDetector(
                        onTap: () => Navigator.pushNamed(context, '/data-deletion'),
                        child: const Text(
                          'Xóa dữ liệu',
                          style: TextStyle(fontSize: 11, color: Colors.grey, decoration: TextDecoration.underline),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
