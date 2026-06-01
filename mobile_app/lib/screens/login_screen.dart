import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_flutter/lucide_flutter.dart';
import '../providers/auth_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  String? _localError;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    setState(() => _localError = null);
    if (!_formKey.currentState!.validate()) return;

    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final success = await authProvider.login(email, password);

    if (success) {
      if (mounted) {
        Navigator.pushReplacementNamed(context, '/dashboard');
      }
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
            // Glowing background elements (decorative)
            Positioned(
              top: -100,
              left: -100,
              child: Container(
                width: 300,
                height: 300,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFFF3366).withValues(alpha: 0.06),
                ),
              ),
            ),
            Positioned(
              bottom: -100,
              right: -100,
              child: Container(
                width: 300,
                height: 300,
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
                      child: Form(
                        key: _formKey,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // Brand icon
                            Container(
                              width: 60,
                              height: 60,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(16),
                                gradient: const LinearGradient(
                                  colors: [Color(0xFFFF3366), Color(0xFFFF0055)],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(0xFFFF3366).withValues(alpha: 0.2),
                                    blurRadius: 15,
                                    spreadRadius: 2,
                                  )
                                ],
                              ),
                              child: const Icon(
                                LucideIcons.activity,
                                color: Colors.white,
                                size: 32,
                              ),
                            ),
                            const SizedBox(height: 20),
                            Text(
                              'CARDIO GUARD AI',
                              style: TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.bold,
                                color: textColor,
                                letterSpacing: 1.5,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Hệ thống giám sát y tế trung tâm',
                              style: TextStyle(
                                fontSize: 12,
                                color: textMutedColor,
                              ),
                            ),
                            const SizedBox(height: 28),
                            
                            // Error box
                            if (activeError != null) ...[
                              Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFF0055).withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                    color: const Color(0xFFFF0055).withValues(alpha: 0.3),
                                  ),
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
                            
                            // Email Field
                            TextFormField(
                              controller: _emailController,
                              style: TextStyle(color: textColor),
                              keyboardType: TextInputType.emailAddress,
                              decoration: InputDecoration(
                                labelText: 'Email tài khoản',
                                labelStyle: TextStyle(color: textMutedColor),
                                prefixIcon: Icon(LucideIcons.mail, color: textMutedColor.withValues(alpha: 0.8), size: 18),
                              ),
                              validator: (v) {
                                if (v == null || v.isEmpty) return 'Vui lòng nhập email';
                                if (!v.contains('@')) return 'Email không hợp lệ';
                                return null;
                              },
                            ),
                            const SizedBox(height: 18),
                            
                            // Password Field
                            TextFormField(
                              controller: _passwordController,
                              obscureText: true,
                              style: TextStyle(color: textColor),
                              decoration: InputDecoration(
                                labelText: 'Mật khẩu',
                                labelStyle: TextStyle(color: textMutedColor),
                                prefixIcon: Icon(LucideIcons.lock, color: textMutedColor.withValues(alpha: 0.8), size: 18),
                              ),
                              validator: (v) {
                                if (v == null || v.isEmpty) return 'Vui lòng nhập mật khẩu';
                                if (v.length < 6) return 'Mật khẩu phải từ 6 ký tự';
                                return null;
                              },
                            ),
                            const SizedBox(height: 28),
                            
                            // Login Button
                            SizedBox(
                              width: double.infinity,
                              height: 48,
                              child: ElevatedButton(
                                onPressed: authProvider.isLoading ? null : _handleLogin,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFFFF3366),
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  elevation: 5,
                                  shadowColor: const Color(0xFFFF3366).withValues(alpha: 0.35),
                                ),
                                child: authProvider.isLoading
                                    ? const SizedBox(
                                        width: 20,
                                        height: 20,
                                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                      )
                                    : const Text(
                                        'Đăng nhập hệ thống',
                                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                                      ),
                              ),
                            ),
                            const SizedBox(height: 24),
                            
                            // Navigate to register link
                            GestureDetector(
                              onTap: () {
                                Navigator.pushNamed(context, '/register');
                              },
                              child: RichText(
                                text: TextSpan(
                                  text: 'Chưa có tài khoản? ',
                                  style: TextStyle(color: textMutedColor, fontSize: 13),
                                  children: const [
                                    TextSpan(
                                      text: 'Đăng ký ngay',
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
            ),
          ],
        ),
      ),
    );
  }
}


