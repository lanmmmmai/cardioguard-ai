import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_flutter/lucide_flutter.dart';
import '../providers/auth_provider.dart';
import '../widgets/cg_widgets.dart';
import '../ui/cg_tokens.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _otpController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _isOtpSent = false;
  String? _successMessage;

  @override
  void dispose() {
    _emailController.dispose();
    _otpController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  String? _validatePassword(String? value) {
    final v = (value ?? '').trim();
    if (v.length < 8 || v.length > 72) {
      return 'Mật khẩu phải từ 8 đến 72 ký tự';
    }
    if (!RegExp(r'[A-Z]').hasMatch(v)) {
      return 'Mật khẩu phải có ít nhất 1 chữ hoa';
    }
    if (!RegExp(r'[A-Za-z]').hasMatch(v)) {
      return 'Mật khẩu phải chứa chữ cái';
    }
    if (!RegExp(r'\d').hasMatch(v)) {
      return 'Mật khẩu phải có ít nhất 1 chữ số';
    }
    if (!RegExp(r'[^A-Za-z\d]').hasMatch(v)) {
      return 'Mật khẩu phải có nhất 1 ký tự đặc biệt';
    }
    return null;
  }

  Future<void> _requestOtp() async {
    setState(() {
      _successMessage = null;
    });
    if (!_formKey.currentState!.validate()) return;

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final success = await authProvider.requestForgotPasswordOtp(
      _emailController.text.trim(),
    );

    if (success && mounted) {
      setState(() {
        _isOtpSent = true;
        _successMessage = 'Mã OTP khôi phục mật khẩu đã gửi đến email của bạn.';
      });
    }
  }

  Future<void> _handleResetPassword() async {
    setState(() {
      _successMessage = null;
    });

    final otp = _otpController.text.trim();
    if (!RegExp(r'^\d{6}$').hasMatch(otp)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Vui lòng nhập mã OTP gồm 6 chữ số'), backgroundColor: Colors.red),
      );
      return;
    }

    if (_newPasswordController.text != _confirmPasswordController.text) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Mật khẩu xác nhận không khớp'), backgroundColor: Colors.red),
      );
      return;
    }

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final success = await authProvider.verifyForgotPasswordOtp(
      email: _emailController.text.trim(),
      otp: otp,
      newPassword: _newPasswordController.text,
    );

    if (success && mounted) {
      setState(() {
        _successMessage = 'Đặt lại mật khẩu thành công! Đang chuyển hướng...';
      });
      Future.delayed(const Duration(seconds: 2), () {
        if (mounted) {
          Navigator.pushReplacementNamed(context, '/login');
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : Colors.black;
    final muted = isDark ? Colors.white70 : Colors.black54;
    final activeError = authProvider.errorMessage;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: Icon(LucideIcons.arrowLeft, color: textColor),
          onPressed: () => Navigator.pop(context),
        ),
      ),
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
                  const Icon(LucideIcons.lock, color: CgColors.primary, size: 36),
                  const SizedBox(height: 12),
                  Text(
                    'Khôi phục mật khẩu',
                    style: TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 22,
                        color: textColor),
                  ),
                  const SizedBox(height: 6),
                  Text('Nhập email đăng ký để nhận mã khôi phục OTP',
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
                  TextFormField(
                    controller: _emailController,
                    enabled: !_isOtpSent,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(labelText: 'Email tài khoản'),
                    validator: (v) {
                      if (v == null || v.isEmpty) return 'Vui lòng nhập email';
                      if (!v.contains('@')) return 'Email không hợp lệ';
                      return null;
                    },
                  ),
                  if (_isOtpSent) ...[
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _otpController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Mã OTP (6 số)'),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _newPasswordController,
                      obscureText: true,
                      decoration: const InputDecoration(labelText: 'Mật khẩu mới'),
                      validator: _validatePassword,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _confirmPasswordController,
                      obscureText: true,
                      decoration: const InputDecoration(labelText: 'Xác nhận mật khẩu mới'),
                      validator: (v) {
                        if (v != _newPasswordController.text) {
                          return 'Mật khẩu xác nhận không khớp';
                        }
                        return null;
                      },
                    ),
                  ],
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      onPressed: authProvider.isLoading
                          ? null
                          : (_isOtpSent ? _handleResetPassword : _requestOtp),
                      child: authProvider.isLoading
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white))
                          : Text(_isOtpSent ? 'Xác nhận đổi mật khẩu' : 'Gửi mã OTP'),
                    ),
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
