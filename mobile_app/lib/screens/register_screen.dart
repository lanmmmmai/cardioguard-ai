import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../services/api_service.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  String _selectedRole = 'Bác sĩ';
  bool _isLoading = false;
  String? _errorMessage;
  String? _successMessage;

  final List<String> _roles = ['Bác sĩ', 'Y tá', 'Kỹ thuật viên', 'Nghiên cứu viên'];

  Future<void> _handleRegister() async {
    final name = _nameController.text.trim();
    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();

    if (name.isEmpty || email.isEmpty || password.isEmpty) {
      setState(() {
        _errorMessage = 'Vui lòng điền đầy đủ tất cả các trường';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _successMessage = null;
    });

    final success = await ApiService.register(email, name, password, _selectedRole);

    setState(() {
      _isLoading = false;
    });

    if (success) {
      setState(() {
        _successMessage = 'Đăng ký tài khoản thành công! Hãy đăng nhập.';
      });
      Future.delayed(const Duration(seconds: 2), () {
        if (mounted) {
          Navigator.pop(context);
        }
      });
    } else {
      setState(() {
        _errorMessage = 'Đăng ký thất bại. Email có thể đã tồn tại trên hệ thống.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(color: Color(0xFF07080A)),
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
                  color: const Color(0xFFFF3366).withOpacity(0.06),
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
                  color: const Color(0xFF00F2FE).withOpacity(0.06),
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
                        color: const Color(0xFF11151D).withOpacity(0.7),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: Colors.white.withOpacity(0.07),
                          width: 1.0,
                        ),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text(
                            'ĐĂNG KÝ TÀI KHOẢN',
                            style: TextStyle(
                              fontFamily: 'Futura',
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                              letterSpacing: 1.2,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Tạo tài khoản cán bộ y tế giám sát',
                            style: TextStyle(
                              fontFamily: 'Futura',
                              fontSize: 12,
                              color: Colors.white.withOpacity(0.5),
                            ),
                          ),
                          const SizedBox(height: 24),
                          if (_errorMessage != null) ...[
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFF0055).withOpacity(0.1),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: const Color(0xFFFF0055).withOpacity(0.3)),
                              ),
                              child: Row(
                                children: [
                                  const Icon(LucideIcons.alertTriangle, color: Color(0xFFFF0055), size: 16),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      _errorMessage!,
                                      style: const TextStyle(color: Color(0xFFFF0055), fontSize: 12, fontFamily: 'Futura'),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 16),
                          ],
                          if (_successMessage != null) ...[
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: const Color(0xFF39FF14).withOpacity(0.1),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: const Color(0xFF39FF14).withOpacity(0.3)),
                              ),
                              child: Row(
                                children: [
                                  const Icon(LucideIcons.checkCircle, color: Color(0xFF39FF14), size: 16),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      _successMessage!,
                                      style: const TextStyle(color: Color(0xFF39FF14), fontSize: 12, fontFamily: 'Futura'),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 16),
                          ],
                          // Full Name Field
                          TextFormField(
                            controller: _nameController,
                            style: const TextStyle(color: Colors.white, fontFamily: 'Futura'),
                            decoration: InputDecoration(
                              labelText: 'Họ và tên',
                              labelStyle: TextStyle(color: Colors.white.withOpacity(0.6), fontFamily: 'Futura'),
                              prefixIcon: Icon(LucideIcons.user, color: Colors.white.withOpacity(0.5), size: 18),
                              filled: true,
                              fillColor: Colors.white.withOpacity(0.03),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: BorderSide(color: Colors.white.withOpacity(0.07)),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(color: Color(0xFFFF3366)),
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          // Email Field
                          TextFormField(
                            controller: _emailController,
                            style: const TextStyle(color: Colors.white, fontFamily: 'Futura'),
                            decoration: InputDecoration(
                              labelText: 'Email công tác',
                              labelStyle: TextStyle(color: Colors.white.withOpacity(0.6), fontFamily: 'Futura'),
                              prefixIcon: Icon(LucideIcons.mail, color: Colors.white.withOpacity(0.5), size: 18),
                              filled: true,
                              fillColor: Colors.white.withOpacity(0.03),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: BorderSide(color: Colors.white.withOpacity(0.07)),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(color: Color(0xFFFF3366)),
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          // Password Field
                          TextFormField(
                            controller: _passwordController,
                            obscureText: true,
                            style: const TextStyle(color: Colors.white, fontFamily: 'Futura'),
                            decoration: InputDecoration(
                              labelText: 'Mật khẩu',
                              labelStyle: TextStyle(color: Colors.white.withOpacity(0.6), fontFamily: 'Futura'),
                              prefixIcon: Icon(LucideIcons.lock, color: Colors.white.withOpacity(0.5), size: 18),
                              filled: true,
                              fillColor: Colors.white.withOpacity(0.03),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: BorderSide(color: Colors.white.withOpacity(0.07)),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(color: Color(0xFFFF3366)),
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          // Role Dropdown Field
                          DropdownButtonFormField<String>(
                            value: _selectedRole,
                            dropdownColor: const Color(0xFF131720),
                            style: const TextStyle(color: Colors.white, fontFamily: 'Futura'),
                            decoration: InputDecoration(
                              labelText: 'Vai trò y tế',
                              labelStyle: TextStyle(color: Colors.white.withOpacity(0.6), fontFamily: 'Futura'),
                              prefixIcon: Icon(LucideIcons.shield, color: Colors.white.withOpacity(0.5), size: 18),
                              filled: true,
                              fillColor: Colors.white.withOpacity(0.03),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: BorderSide(color: Colors.white.withOpacity(0.07)),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                                borderSide: const BorderSide(color: Color(0xFFFF3366)),
                              ),
                            ),
                            items: _roles.map((role) {
                              return DropdownMenuItem<String>(
                                value: role,
                                child: Text(role),
                              );
                            }).toList(),
                            onChanged: (val) {
                              if (val != null) {
                                setState(() {
                                  _selectedRole = val;
                                });
                              }
                            },
                          ),
                          const SizedBox(height: 24),
                          // Register Button
                          SizedBox(
                            width: double.infinity,
                            height: 48,
                            child: ElevatedButton(
                              onPressed: _isLoading ? null : _handleRegister,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFFFF3366),
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                              child: _isLoading
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                    )
                                  : const Text(
                                      'Hoàn tất đăng ký',
                                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, fontFamily: 'Futura'),
                                    ),
                            ),
                          ),
                          const SizedBox(height: 20),
                          // Back to Login link
                          GestureDetector(
                            onTap: () {
                              Navigator.pop(context);
                            },
                            child: RichText(
                              text: const TextSpan(
                                text: 'Đã có tài khoản? ',
                                style: TextStyle(color: Color(0xFF9EA5B4), fontSize: 13, fontFamily: 'Futura'),
                                children: [
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
