import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../providers/auth_provider.dart';

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

  bool _isOtpSent = false;
  String? _localError;
  String? _successMessage;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  // Step 1: Request OTP
  Future<void> _requestOtp() async {
    setState(() {
      _localError = null;
      _successMessage = null;
    });

    if (!_formKey.currentState!.validate()) return;

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final email = _emailController.text.trim();
    final name = _nameController.text.trim();

    final success = await authProvider.requestRegisterOtp(email, name);

    if (success) {
      setState(() {
        _isOtpSent = true;
        _successMessage = 'Mã OTP đã được gửi về email của bạn. Vui lòng kiểm tra hộp thư.';
      });
    }
  }

  // Step 2: Verify OTP and Register
  Future<void> _handleRegister() async {
    setState(() {
      _localError = null;
      _successMessage = null;
    });

    final otp = _otpController.text.trim();
    if (otp.isEmpty || otp.length < 6) {
      setState(() => _localError = 'Vui lòng nhập mã OTP gồm 6 chữ số');
      return;
    }

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final email = _emailController.text.trim();
    final name = _nameController.text.trim();
    final password = _passwordController.text.trim();

    final success = await authProvider.registerPatient(
      email: email,
      fullName: name,
      password: password,
      otp: otp,
    );

    if (success) {
      setState(() {
        _successMessage = 'Đăng ký tài khoản Bệnh nhân thành công!';
      });
      Future.delayed(const Duration(seconds: 2), () {
        if (mounted) {
          Navigator.pop(context);
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    final cardBg = isDark ? const Color(0xFF11151D).withValues(alpha: 0.7) : Colors.white.withValues(alpha: 0.85);
    final textColor = isDark ? Colors.white : Colors.black;
    final textMutedColor = isDark ? Colors.white.withValues(alpha: 0.6) : Colors.black.withValues(alpha: 0.6);
    final borderColor = isDark ? Colors.white.withValues(alpha: 0.07) : Colors.black.withValues(alpha: 0.08);

    final String? activeError = _localError ?? authProvider.errorMessage;

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF07080A) : const Color(0xFFF5F6F8),
        ),
        child: Stack(
          children: [
            // Glowing background circles
            Positioned(
              top: -50,
              right: -50,
              child: Container(
                width: 250,
                height: 250,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFFF3366).withValues(alpha: 0.06),
                ),
              ),
            ),
            Positioned(
              bottom: -50,
              left: -50,
              child: Container(
                width: 250,
                height: 250,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFF00F2FE).withValues(alpha: 0.06),
                ),
              ),
            ),
            Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(20),
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 12.0, sigmaY: 12.0),
                    child: Container(
                      padding: const EdgeInsets.all(28.0),
                      decoration: BoxDecoration(
                        color: cardBg,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: borderColor,
                          width: 1.0,
                        ),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'ĐĂNG KÝ BỆNH NHÂN',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: textColor,
                              letterSpacing: 1.2,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Tạo tài khoản và xác thực OTP qua email',
                            style: TextStyle(
                              fontSize: 12,
                              color: textMutedColor,
                            ),
                          ),
                          const SizedBox(height: 24),
                          
                          // Error Alert
                          if (activeError != null) ...[
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFF0055).withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: const Color(0xFFFF0055).withValues(alpha: 0.3)),
                              ),
                              child: Row(
                                children: [
                                  const Icon(LucideIcons.alertTriangle, color: Color(0xFFFF0055), size: 16),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      activeError,
                                      style: const TextStyle(color: Color(0xFFFF0055), fontSize: 12),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 16),
                          ],
                          
                          // Success Alert
                          if (_successMessage != null) ...[
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: const Color(0xFF39FF14).withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: const Color(0xFF39FF14).withValues(alpha: 0.3)),
                              ),
                              child: Row(
                                children: [
                                  const Icon(LucideIcons.checkCircle, color: Color(0xFF39FF14), size: 16),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      _successMessage!,
                                      style: const TextStyle(color: Color(0xFF39FF14), fontSize: 12),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 16),
                          ],
                          
                          // Form
                          Form(
                            key: _formKey,
                            child: Column(
                              children: [
                                // Step 1 inputs (Always visible but disabled after OTP is sent)
                                TextFormField(
                                  controller: _nameController,
                                  enabled: !_isOtpSent,
                                  style: TextStyle(color: textColor),
                                  decoration: InputDecoration(
                                    labelText: 'Họ và tên',
                                    labelStyle: TextStyle(color: textMutedColor),
                                    prefixIcon: Icon(LucideIcons.user, color: textMutedColor.withValues(alpha: 0.8), size: 18),
                                  ),
                                  validator: (v) => (v == null || v.isEmpty) ? 'Vui lòng nhập họ tên' : null,
                                ),
                                const SizedBox(height: 16),
                                TextFormField(
                                  controller: _emailController,
                                  enabled: !_isOtpSent,
                                  style: TextStyle(color: textColor),
                                  keyboardType: TextInputType.emailAddress,
                                  decoration: InputDecoration(
                                    labelText: 'Email liên hệ',
                                    labelStyle: TextStyle(color: textMutedColor),
                                    prefixIcon: Icon(LucideIcons.mail, color: textMutedColor.withValues(alpha: 0.8), size: 18),
                                  ),
                                  validator: (v) {
                                    if (v == null || v.isEmpty) return 'Vui lòng nhập email';
                                    if (!v.contains('@')) return 'Email không hợp lệ';
                                    return null;
                                  },
                                ),
                                const SizedBox(height: 16),
                                TextFormField(
                                  controller: _passwordController,
                                  enabled: !_isOtpSent,
                                  obscureText: true,
                                  style: TextStyle(color: textColor),
                                  decoration: InputDecoration(
                                    labelText: 'Mật khẩu',
                                    labelStyle: TextStyle(color: textMutedColor),
                                    prefixIcon: Icon(LucideIcons.lock, color: textMutedColor.withValues(alpha: 0.8), size: 18),
                                  ),
                                  validator: (v) => (v == null || v.length < 6) ? 'Mật khẩu phải từ 6 ký tự' : null,
                                ),
                                
                                // Step 2 input (Visible only after OTP is sent)
                                if (_isOtpSent) ...[
                                  const SizedBox(height: 16),
                                  TextFormField(
                                    controller: _otpController,
                                    keyboardType: TextInputType.number,
                                    style: TextStyle(color: textColor),
                                    decoration: InputDecoration(
                                      labelText: 'Nhập mã OTP (6 số)',
                                      labelStyle: TextStyle(color: textMutedColor),
                                      prefixIcon: Icon(LucideIcons.key, color: textMutedColor.withValues(alpha: 0.8), size: 18),
                                    ),
                                  ),
                                ],
                                
                                const SizedBox(height: 24),
                                
                                // Action Button
                                SizedBox(
                                  width: double.infinity,
                                  height: 48,
                                  child: ElevatedButton(
                                    onPressed: authProvider.isLoading
                                        ? null
                                        : (_isOtpSent ? _handleRegister : _requestOtp),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFFFF3366),
                                      foregroundColor: Colors.white,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                    ),
                                    child: authProvider.isLoading
                                        ? const SizedBox(
                                            width: 20,
                                            height: 20,
                                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                          )
                                        : Text(
                                            _isOtpSent ? 'Hoàn tất đăng ký' : 'Nhận mã OTP qua email',
                                            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                                          ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 20),
                          
                          // Back to login link
                          GestureDetector(
                            onTap: () => Navigator.pop(context),
                            child: RichText(
                              text: TextSpan(
                                text: 'Đã có tài khoản? ',
                                style: TextStyle(color: textMutedColor, fontSize: 13),
                                children: const [
                                  TextSpan(
                                    text: 'Đăng nhập',
                                    style: TextStyle(color: Color(0xFFFF3366), fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

