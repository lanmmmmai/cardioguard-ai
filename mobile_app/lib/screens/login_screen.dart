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

  // Đăng nhập Google
  Future<void> _handleGoogleLogin({
    required String email,
    required String fullName,
    required String googleId,
    required String role,
  }) async {
    setState(() => _localError = null);
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    
    final success = await authProvider.loginWithGoogle(
      email: email,
      fullName: fullName,
      googleId: googleId,
      role: role,
    );

    if (success && mounted) {
      Navigator.pushReplacementNamed(context, '/dashboard');
    }
  }

  void _showGoogleAccountSelector() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : Colors.black87;
    final subtitleColor = isDark ? Colors.white60 : Colors.black54;
    final cardBg = isDark ? const Color(0xFF11151D) : Colors.white;

    showModalBottomSheet(
      context: context,
      backgroundColor: cardBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Đăng nhập bằng Google',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: textColor),
                    ),
                    IconButton(
                      icon: const Icon(LucideIcons.x, size: 20),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
                Text(
                  'Chọn một tài khoản để đăng nhập CardioGuard AI',
                  style: TextStyle(fontSize: 12, color: subtitleColor),
                ),
                const SizedBox(height: 16),
                
                // Account 1: Patient Demo
                ListTile(
                  leading: CircleAvatar(
                    backgroundColor: Colors.red.withValues(alpha: 0.1),
                    child: const Text('BN', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
                  ),
                  title: Text('Bệnh Nhân Demo', style: TextStyle(fontWeight: FontWeight.w600, color: textColor)),
                  subtitle: Text('patient.demo@gmail.com', style: TextStyle(color: subtitleColor, fontSize: 13)),
                  onTap: () {
                    Navigator.pop(context);
                    _handleGoogleLogin(
                      email: 'patient.demo@gmail.com',
                      fullName: 'Bệnh Nhân Demo',
                      googleId: 'google_patient_123',
                      role: 'patient',
                    );
                  },
                ),
                const Divider(),
                
                // Account 2: Doctor Demo
                ListTile(
                  leading: CircleAvatar(
                    backgroundColor: Colors.blue.withValues(alpha: 0.1),
                    child: const Text('BS', style: TextStyle(color: Colors.blue, fontWeight: FontWeight.bold)),
                  ),
                  title: Text('Bác Sĩ Demo', style: TextStyle(fontWeight: FontWeight.w600, color: textColor)),
                  subtitle: Text('doctor.demo@gmail.com', style: TextStyle(color: subtitleColor, fontSize: 13)),
                  onTap: () {
                    Navigator.pop(context);
                    _handleGoogleLogin(
                      email: 'doctor.demo@gmail.com',
                      fullName: 'Bác Sĩ Demo',
                      googleId: 'google_doctor_456',
                      role: 'doctor',
                    );
                  },
                ),
                const Divider(),
                
                // Option 3: Add other account
                ListTile(
                  leading: CircleAvatar(
                    backgroundColor: Colors.grey.withValues(alpha: 0.1),
                    child: Icon(LucideIcons.userPlus, color: textColor),
                  ),
                  title: Text('Sử dụng tài khoản khác...', style: TextStyle(fontWeight: FontWeight.w600, color: textColor)),
                  onTap: () {
                    Navigator.pop(context);
                    _showCustomGoogleAccountDialog();
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showCustomGoogleAccountDialog() {
    final nameController = TextEditingController();
    final emailController = TextEditingController();
    final formKey = GlobalKey<FormState>();

    showDialog(
      context: context,
      builder: (context) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        final textColor = isDark ? Colors.white : Colors.black87;

        return AlertDialog(
          backgroundColor: isDark ? const Color(0xFF11151D) : Colors.white,
          title: Text('Đăng nhập tài khoản Google khác', style: TextStyle(color: textColor, fontSize: 16, fontWeight: FontWeight.bold)),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: nameController,
                  decoration: const InputDecoration(labelText: 'Họ và tên Google'),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Vui lòng nhập tên' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: emailController,
                  decoration: const InputDecoration(labelText: 'Email Google'),
                  keyboardType: TextInputType.emailAddress,
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return 'Vui lòng nhập email';
                    if (!v.contains('@')) return 'Email không hợp lệ';
                    return null;
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Hủy'),
            ),
            ElevatedButton(
              onPressed: () {
                if (!formKey.currentState!.validate()) return;
                Navigator.pop(context);
                _handleGoogleLogin(
                  email: emailController.text.trim(),
                  fullName: nameController.text.trim(),
                  googleId: 'google_custom_${DateTime.now().millisecondsSinceEpoch}',
                  role: 'patient',
                );
              },
              child: const Text('Xác nhận'),
            ),
          ],
        );
      },
    );
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
                      onPressed: authProvider.isLoading ? null : _showGoogleAccountSelector,
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
                          const Icon(LucideIcons.chrome, color: Colors.red, size: 18),
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
