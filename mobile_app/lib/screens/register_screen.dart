import 'package:flutter/material.dart';
import 'package:lucide_flutter/lucide_flutter.dart';
import 'package:provider/provider.dart';
import 'package:flutter_facebook_auth/flutter_facebook_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../config/app_config.dart';
import '../providers/auth_provider.dart';
import '../ui/cg_tokens.dart';
import '../widgets/cg_widgets.dart';

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
  final _confirmPasswordController = TextEditingController();
  final _otpController = TextEditingController();
  final _specialtyController = TextEditingController();
  final _departmentController = TextEditingController();

  bool _isOtpSent = false;
  bool _agreedToTerms = false;
  bool _obscurePassword = true;
  String? _localError;
  String? _successMessage;

  String get _role {
    final args =
        ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
    return (args?['role'] as String?) ?? 'patient';
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _otpController.dispose();
    _specialtyController.dispose();
    _departmentController.dispose();
    super.dispose();
  }

  String? _validatePassword(String? value) {
    final v = value ?? '';
    if (v.length < 8) return 'Mật khẩu phải từ 8 ký tự';
    if (!RegExp(r'[A-Z]').hasMatch(v)) return 'Mật khẩu cần ít nhất 1 chữ hoa';
    if (!RegExp(r'\d').hasMatch(v)) return 'Mật khẩu cần ít nhất 1 chữ số';
    if (!RegExp(r'[^A-Za-z\d]').hasMatch(v))
      return 'Mật khẩu cần ít nhất 1 ký tự đặc biệt';
    return null;
  }

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
        _successMessage = 'Mã OTP đã được gửi tới email của bạn.';
      });
    }
  }

  Future<void> _handleRegister() async {
    setState(() {
      _localError = null;
      _successMessage = null;
    });

    if (!_agreedToTerms) {
      setState(() => _localError =
          'Bạn phải đồng ý với chính sách quyền riêng tư và điều khoản.');
      return;
    }

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
          _successMessage = 'Đăng ký thành công! Đang chuyển đến đăng nhập...');
      Future.delayed(const Duration(seconds: 2), () {
        if (mounted) {
          Navigator.pushReplacementNamed(context, '/login',
              arguments: {'role': _role});
        }
      });
    }
  }

  Future<void> _handleGoogleSignUp() async {
    setState(() => _localError = null);
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    try {
      final googleSignIn = AppConfig.googleServerClientId.isNotEmpty
          ? GoogleSignIn(
              scopes: const ['email', 'profile'],
              serverClientId: AppConfig.googleServerClientId,
            )
          : GoogleSignIn(scopes: const ['email', 'profile']);
      final account = await googleSignIn.signIn();
      if (account == null) return;

      final auth = await account.authentication;
      final idToken = auth.idToken;
      if (idToken == null) return;

      final success = await authProvider.loginWithGoogle(
        idToken: idToken,
        avatarUrl: account.photoUrl,
      );

      if (success && mounted) {
        Navigator.pushReplacementNamed(context, '/dashboard');
      }
    } catch (e) {
      setState(() => _localError = 'Đăng ký Google thất bại.');
    }
  }

  Future<void> _handleFacebookSignUp() async {
    setState(() => _localError = null);
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    try {
      final result = await FacebookAuth.instance.login(
        permissions: ['email', 'public_profile'],
      );

      if (result.status != LoginStatus.success) return;
      final accessToken = result.accessToken?.tokenString;
      if (accessToken == null) return;

      final userData = await FacebookAuth.instance.getUserData(
          fields: 'name,email,picture.width(200)');
      final avatarUrl = userData['picture']?['data']?['url'] as String?;

      final success = await authProvider.loginWithFacebook(
        accessToken: accessToken,
        role: _role,
        avatarUrl: avatarUrl,
      );

      if (success && mounted) {
        Navigator.pushReplacementNamed(context, '/dashboard');
      }
    } catch (e) {
      setState(() => _localError = 'Đăng ký Facebook thất bại.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final subColor = isDark ? const Color(0xFF9EA5B4) : const Color(0xFF6B7280);
    final activeError = _localError ?? authProvider.errorMessage;
    final role = _role;

    final roleLabel =
        role == 'doctor' ? 'Bác sĩ' : 'Bệnh nhân';
    final roleColor =
        role == 'doctor' ? CgColors.primary : const Color(0xFFE11D48);
    final roleIcon =
        role == 'doctor' ? LucideIcons.stethoscope : LucideIcons.heart;

    return Scaffold(
      backgroundColor: isDark ? CgColors.background : const Color(0xFFF9FAFB),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: Navigator.canPop(context)
            ? IconButton(
                icon: Icon(LucideIcons.arrowLeft, color: textColor, size: 20),
                onPressed: () => Navigator.pop(context),
              )
            : null,
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
          child: Column(
            children: [
              CgCard(
                padding: const EdgeInsets.all(28),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Header
                    Center(
                      child: Column(
                        children: [
                          Container(
                            width: 64,
                            height: 64,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: roleColor.withValues(alpha: 0.12),
                            ),
                            child: Icon(roleIcon, color: roleColor, size: 30),
                          ),
                          const SizedBox(height: 14),
                          Text(
                            'Đăng ký — $roleLabel',
                            style: TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 20,
                                color: textColor),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Xác thực OTP qua email để kích hoạt',
                            style: TextStyle(fontSize: 13, color: subColor),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Error / success banners
                    if (activeError != null) ...[
                      _Banner(
                          message: activeError,
                          isError: true,
                          isDark: isDark),
                      const SizedBox(height: 14),
                    ],
                    if (_successMessage != null) ...[
                      _Banner(
                          message: _successMessage!,
                          isError: false,
                          isDark: isDark),
                      const SizedBox(height: 14),
                    ],

                    Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _Label('Họ và tên', textColor),
                          const SizedBox(height: 6),
                          TextFormField(
                            controller: _nameController,
                            enabled: !_isOtpSent,
                            decoration: const InputDecoration(
                              hintText: 'Nguyễn Văn A',
                              prefixIcon: Icon(LucideIcons.user, size: 18),
                            ),
                            validator: (v) => (v == null || v.trim().length < 2)
                                ? 'Vui lòng nhập họ tên đầy đủ'
                                : null,
                          ),
                          const SizedBox(height: 14),
                          _Label('Email', textColor),
                          const SizedBox(height: 6),
                          TextFormField(
                            controller: _emailController,
                            enabled: !_isOtpSent,
                            keyboardType: TextInputType.emailAddress,
                            decoration: const InputDecoration(
                              hintText: 'example@email.com',
                              prefixIcon: Icon(LucideIcons.mail, size: 18),
                            ),
                            validator: (v) {
                              if (v == null || v.isEmpty)
                                return 'Vui lòng nhập email';
                              if (!v.contains('@')) return 'Email không hợp lệ';
                              return null;
                            },
                          ),
                          const SizedBox(height: 14),
                          _Label('Mật khẩu', textColor),
                          const SizedBox(height: 6),
                          TextFormField(
                            controller: _passwordController,
                            enabled: !_isOtpSent,
                            obscureText: _obscurePassword,
                            decoration: InputDecoration(
                              hintText: '••••••••',
                              prefixIcon:
                                  const Icon(LucideIcons.lock, size: 18),
                              suffixIcon: GestureDetector(
                                onTap: () => setState(
                                    () => _obscurePassword = !_obscurePassword),
                                child: Icon(
                                  _obscurePassword
                                      ? LucideIcons.eyeOff
                                      : LucideIcons.eye,
                                  size: 18,
                                ),
                              ),
                            ),
                            validator: _validatePassword,
                          ),

                          // Doctor-specific fields
                          if (role == 'doctor' && !_isOtpSent) ...[
                            const SizedBox(height: 14),
                            _Label('Chuyên khoa', textColor),
                            const SizedBox(height: 6),
                            TextFormField(
                              controller: _specialtyController,
                              decoration: const InputDecoration(
                                hintText: 'Tim mạch, Nội khoa...',
                                prefixIcon:
                                    Icon(LucideIcons.stethoscope, size: 18),
                              ),
                            ),
                            const SizedBox(height: 14),
                            _Label('Khoa / Đơn vị', textColor),
                            const SizedBox(height: 6),
                            TextFormField(
                              controller: _departmentController,
                              decoration: const InputDecoration(
                                hintText: 'Khoa Tim mạch...',
                                prefixIcon:
                                    Icon(LucideIcons.building2, size: 18),
                              ),
                            ),
                          ],

                          // OTP field
                          if (_isOtpSent) ...[
                            const SizedBox(height: 14),
                            _Label('Mã OTP (6 chữ số)', textColor),
                            const SizedBox(height: 6),
                            TextFormField(
                              controller: _otpController,
                              keyboardType: TextInputType.number,
                              maxLength: 6,
                              decoration: const InputDecoration(
                                hintText: '123456',
                                prefixIcon:
                                    Icon(LucideIcons.keyRound, size: 18),
                                counterText: '',
                              ),
                            ),
                          ],

                          const SizedBox(height: 16),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              SizedBox(
                                width: 24,
                                height: 24,
                                child: Checkbox(
                                  value: _agreedToTerms,
                                  onChanged: authProvider.isLoading
                                      ? null
                                      : (v) => setState(
                                          () => _agreedToTerms = v ?? false),
                                  shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(4)),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: GestureDetector(
                                  onTap: () => setState(
                                      () => _agreedToTerms = !_agreedToTerms),
                                  child: Text(
                                    'Tôi đồng ý với Chính sách quyền riêng tư và Điều khoản dịch vụ',
                                    style: TextStyle(
                                        fontSize: 13, color: textColor),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 20),

                          SizedBox(
                            width: double.infinity,
                            height: 50,
                            child: ElevatedButton(
                              onPressed: authProvider.isLoading
                                  ? null
                                  : (_isOtpSent
                                      ? _handleRegister
                                      : _requestOtp),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: roleColor,
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(12)),
                              ),
                              child: authProvider.isLoading
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          color: Colors.white))
                                  : Text(
                                      _isOtpSent
                                          ? 'Hoàn tất đăng ký'
                                          : 'Nhận mã OTP',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w700,
                                          fontSize: 15)),
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Social signup
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        Expanded(
                            child: Divider(
                                color: isDark
                                    ? Colors.white24
                                    : Colors.black12)),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          child: Text('hoặc đăng ký bằng',
                              style:
                                  TextStyle(color: subColor, fontSize: 12)),
                        ),
                        Expanded(
                            child: Divider(
                                color: isDark
                                    ? Colors.white24
                                    : Colors.black12)),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: authProvider.isLoading
                                ? null
                                : _handleGoogleSignUp,
                            icon: const Icon(Icons.g_mobiledata_rounded,
                                color: Color(0xFFEA4335), size: 22),
                            label: Text('Google',
                                style: TextStyle(
                                    fontSize: 13, color: textColor)),
                            style: OutlinedButton.styleFrom(
                              side: BorderSide(
                                  color: isDark
                                      ? Colors.white24
                                      : Colors.black12),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10)),
                              padding:
                                  const EdgeInsets.symmetric(vertical: 12),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: authProvider.isLoading
                                ? null
                                : _handleFacebookSignUp,
                            icon: const Icon(Icons.facebook, size: 20),
                            label: const Text('Facebook',
                                style: TextStyle(fontSize: 13)),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF1877F2),
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10)),
                              padding:
                                  const EdgeInsets.symmetric(vertical: 12),
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 20),
                    Center(
                      child: GestureDetector(
                        onTap: () => Navigator.pushReplacementNamed(
                            context, '/login',
                            arguments: {'role': role}),
                        child: RichText(
                          text: TextSpan(
                            text: 'Đã có tài khoản? ',
                            style:
                                TextStyle(color: subColor, fontSize: 14),
                            children: [
                              TextSpan(
                                text: 'Đăng nhập',
                                style: TextStyle(
                                    color: roleColor,
                                    fontWeight: FontWeight.w700),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _PolicyLink(label: 'Bảo mật', route: '/privacy'),
                  const _Dot(),
                  _PolicyLink(label: 'Điều khoản', route: '/terms'),
                  const _Dot(),
                  _PolicyLink(label: 'Xóa dữ liệu', route: '/data-deletion'),
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

class _Label extends StatelessWidget {
  final String text;
  final Color color;
  const _Label(this.text, this.color);

  @override
  Widget build(BuildContext context) {
    return Text(text,
        style: TextStyle(
            fontSize: 13, fontWeight: FontWeight.w600, color: color));
  }
}

class _Banner extends StatelessWidget {
  final String message;
  final bool isError;
  final bool isDark;
  const _Banner(
      {required this.message,
      required this.isError,
      required this.isDark});

  @override
  Widget build(BuildContext context) {
    final color =
        isError ? CgColors.critical : const Color(0xFF10B981);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(
            isError ? LucideIcons.alertCircle : LucideIcons.checkCircle,
            color: color,
            size: 16,
          ),
          const SizedBox(width: 8),
          Expanded(
              child:
                  Text(message, style: TextStyle(color: color, fontSize: 13))),
        ],
      ),
    );
  }
}

class _PolicyLink extends StatelessWidget {
  final String label;
  final String route;
  const _PolicyLink({required this.label, required this.route});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => Navigator.pushNamed(context, route),
      child: Text(label,
          style: const TextStyle(
              fontSize: 11,
              color: Colors.grey,
              decoration: TextDecoration.underline)),
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(horizontal: 8),
      child: Text('·', style: TextStyle(fontSize: 11, color: Colors.grey)),
    );
  }
}
