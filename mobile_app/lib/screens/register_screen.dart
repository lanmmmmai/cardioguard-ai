// Màn hình đăng ký bệnh nhân với xác thực OTP qua email.
// Quy trình làm việc:
// 1. Người dùng điền tên, email, mật khẩu (với xác thực mật khẩu mạnh).
// 2. Bước 1: nhấn "Nhận mã OTP" -> AuthProvider.requestRegisterOtp gửi OTP đến email.
// 3. Bước 2: nhập mã OTP 6 chữ số và nhấn "Hoàn tất đăng ký"
//    -> AuthProvider.registerPatient tạo tài khoản.
// 4. Khi thành công, tự động quay lại đăng nhập sau 2 giây.
// Mối quan hệ:
// - Sở hữu: AuthProvider cho yêu cầu OTP và đăng ký.
// - Sử dụng: CgCard cho thẻ biểu mẫu.
// - Điều hướng: quay lại /login (pop sau khi thành công).
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../widgets/cg_widgets.dart';

// Màn hình đăng ký bệnh nhân với quy trình xác thực OTP qua email.
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _otpController = TextEditingController();

  // Liệu OTP đã được gửi hay chưa (chuyển biểu mẫu sang chế độ nhập OTP).
  bool _isOtpSent = false;
  bool _agreedToTerms = false;
  // Thông báo lỗi được quản lý cục bộ.
  String? _localError;
  // Thông báo thành công hiển thị sau khi OTP được gửi hoặc đăng ký hoàn tất.
  String? _successMessage;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  // Xác thực độ mạnh mật khẩu: >= 8 ký tự, chữ hoa, chữ cái, chữ số, ký tự đặc biệt.
  String? _validatePassword(String? value) {
    final v = value ?? '';
    if (v.length < 8) return 'Mật khẩu phải từ 8 ký tự';
    if (!RegExp(r'[A-Z]').hasMatch(v)) return 'Mật khẩu cần ít nhất 1 chữ hoa';
    if (!RegExp(r'[a-zA-Z]').hasMatch(v)) return 'Mật khẩu cần chứa chữ cái';
    if (!RegExp(r'\d').hasMatch(v)) return 'Mật khẩu cần ít nhất 1 chữ số';
    if (!RegExp(r'[^A-Za-z\d]').hasMatch(v)) {
      return 'Mật khẩu cần ít nhất 1 ký tự đặc biệt';
    }
    return null;
  }

  // Gửi OTP đến email đã cung cấp qua AuthProvider.requestRegisterOtp.
  Future<void> _requestOtp() async {
    setState(() {
      _localError = null;
      _successMessage = null;
    });
    if (!_formKey.currentState!.validate()) return;

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final success = await authProvider.requestRegisterOtp(
      _emailController.text.trim(),
      _nameController.text.trim(),
    );

    if (success && mounted) {
      setState(() {
        _isOtpSent = true;
        _successMessage = 'Mã OTP đã được gửi về email của bạn.';
      });
    }
  }

  // Hoàn tất đăng ký với xác thực OTP qua AuthProvider.registerPatient.
  Future<void> _handleRegister() async {
    setState(() {
      _localError = null;
      _successMessage = null;
    });

    final otp = _otpController.text.trim();
    if (!RegExp(r'^\d{6}$').hasMatch(otp)) {
      setState(() => _localError = 'Vui lòng nhập mã OTP gồm 6 chữ số');
      return;
    }

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final success = await authProvider.registerPatient(
      email: _emailController.text.trim(),
      fullName: _nameController.text.trim(),
      password: _passwordController.text,
      otp: otp,
      agreePrivacy: _agreedToTerms,
      agreeTerms: _agreedToTerms,
      consentVersion: '1.0',
    );

    if (success && mounted) {
      setState(() =>
          _successMessage = 'Đăng ký thành công. Đang quay lại đăng nhập...');
      Future.delayed(const Duration(seconds: 2), () {
        if (mounted) Navigator.pop(context);
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
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Đăng ký tài khoản bệnh nhân',
                  style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 22,
                      color: textColor),
                ),
                const SizedBox(height: 6),
                Text('Xác thực OTP qua email để kích hoạt tài khoản',
                    style: TextStyle(color: muted, fontSize: 12)),
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
                if (_successMessage != null) ...[
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF12B76A).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(_successMessage!,
                        style: const TextStyle(
                            color: Color(0xFF12B76A), fontSize: 12)),
                  ),
                  const SizedBox(height: 12),
                ],
                Form(
                  key: _formKey,
                  child: Column(
                    children: [
                      TextFormField(
                        controller: _nameController,
                        enabled: !_isOtpSent,
                        decoration:
                            const InputDecoration(labelText: 'Họ và tên'),
                        validator: (v) => (v == null || v.isEmpty)
                            ? 'Vui lòng nhập họ tên'
                            : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _emailController,
                        enabled: !_isOtpSent,
                        keyboardType: TextInputType.emailAddress,
                        decoration:
                            const InputDecoration(labelText: 'Email liên hệ'),
                        validator: (v) {
                          if (v == null || v.isEmpty) {
                            return 'Vui lòng nhập email';
                          }
                          if (!v.contains('@')) return 'Email không hợp lệ';
                          return null;
                        },
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _passwordController,
                        enabled: !_isOtpSent,
                        obscureText: true,
                        decoration:
                            const InputDecoration(labelText: 'Mật khẩu'),
                        validator: _validatePassword,
                      ),
                      if (_isOtpSent) ...[
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _otpController,
                          keyboardType: TextInputType.number,
                          decoration:
                              const InputDecoration(labelText: 'Mã OTP (6 số)'),
                        ),
                      ],
                      const SizedBox(height: 12),
                      CheckboxListTile(
                        contentPadding: EdgeInsets.zero,
                        value: _agreedToTerms,
                        controlAffinity: ListTileControlAffinity.leading,
                        onChanged: authProvider.isLoading
                            ? null
                            : (value) {
                                setState(() {
                                  _agreedToTerms = value ?? false;
                                });
                              },
                        title: const Text(
                          'Tôi đồng ý với Chính sách quyền riêng tư và Điều khoản dịch vụ',
                          style: TextStyle(fontSize: 13),
                        ),
                        subtitle: const Text(
                          'Bắt buộc để tạo tài khoản.',
                          style: TextStyle(fontSize: 11),
                        ),
                      ),
                      const SizedBox(height: 18),
                      SizedBox(
                        width: double.infinity,
                        height: 48,
                        child: ElevatedButton(
                          onPressed: authProvider.isLoading
                              ? null
                              : (_isOtpSent
                                  ? () {
                                      if (!_agreedToTerms) {
                                        setState(() {
                                          _localError =
                                              'Bạn phải đồng ý với chính sách quyền riêng tư và điều khoản dịch vụ.';
                                        });
                                        return;
                                      }
                                      _handleRegister();
                                    }
                                  : _requestOtp),
                          child: authProvider.isLoading
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2, color: Colors.white))
                              : Text(_isOtpSent
                                  ? 'Hoàn tất đăng ký'
                                  : 'Nhận mã OTP'),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Đã có tài khoản? Đăng nhập'),
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
    );
  }
}
