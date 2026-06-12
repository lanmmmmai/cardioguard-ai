import 'package:flutter/material.dart';
import 'package:lucide_flutter/lucide_flutter.dart';
import 'package:provider/provider.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:flutter_facebook_auth/flutter_facebook_auth.dart';

import '../config/app_config.dart';
import '../providers/auth_provider.dart';
import '../ui/cg_tokens.dart';
import '../widgets/cg_widgets.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  String? _localError;

  String get _role {
    final args =
        ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
    return (args?['role'] as String?) ?? 'patient';
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    setState(() => _localError = null);
    if (!_formKey.currentState!.validate()) return;

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final success = await authProvider.login(
      _emailController.text.trim(),
      _passwordController.text,
    );

    if (success && mounted) {
      _navigateToDashboard();
    }
  }

  Future<void> _handleGoogleSignIn() async {
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

      final authentication = await account.authentication;
      final idToken = authentication.idToken;
      if (idToken == null || idToken.isEmpty) {
        setState(() => _localError =
            'Không thể lấy mã xác thực Google. Vui lòng thử lại.');
        return;
      }

      final success = await authProvider.loginWithGoogle(
        idToken: idToken,
        avatarUrl: account.photoUrl,
      );

      if (success && mounted) _navigateToDashboard();
    } catch (e) {
      setState(() => _localError = 'Đăng nhập Google thất bại.');
    }
  }

  Future<void> _handleFacebookSignIn() async {
    setState(() => _localError = null);
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    try {
      final result = await FacebookAuth.instance.login(
        permissions: ['email', 'public_profile'],
      );

      if (result.status != LoginStatus.success) {
        if (result.status == LoginStatus.cancelled) return;
        setState(() => _localError = 'Đăng nhập Facebook bị hủy hoặc thất bại.');
        return;
      }

      final accessToken = result.accessToken?.tokenString;
      if (accessToken == null || accessToken.isEmpty) {
        setState(
            () => _localError = 'Không nhận được token từ Facebook.');
        return;
      }

      final userData = await FacebookAuth.instance.getUserData(
          fields: 'name,email,picture.width(200)');
      final avatarUrl = userData['picture']?['data']?['url'] as String?;

      final success = await authProvider.loginWithFacebook(
        accessToken: accessToken,
        role: _role,
        avatarUrl: avatarUrl,
      );

      if (success && mounted) _navigateToDashboard();
    } catch (e) {
      setState(() => _localError = 'Đăng nhập Facebook thất bại.');
    }
  }

  void _navigateToDashboard() {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final user = authProvider.currentUser;
    if (user?.role == 'doctor') {
      final status = user?.verificationStatus ?? 'active';
      if (status == 'pending') {
        Navigator.pushReplacementNamed(context, '/doctor-pending');
        return;
      } else if (status == 'rejected') {
        Navigator.pushReplacementNamed(context, '/doctor-rejected',
            arguments: {'reason': user?.rejectionReason});
        return;
      }
    }
    Navigator.pushReplacementNamed(context, '/dashboard');
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : const Color(0xFF111827);
    final subColor = isDark ? const Color(0xFF9EA5B4) : const Color(0xFF6B7280);
    final activeError = _localError ?? authProvider.errorMessage;
    final role = _role;

    final roleLabel = role == 'doctor'
        ? 'Bác sĩ'
        : role == 'admin'
            ? 'Quản trị viên'
            : 'Bệnh nhân';
    final roleIcon = role == 'doctor'
        ? LucideIcons.stethoscope
        : role == 'admin'
            ? LucideIcons.shieldCheck
            : LucideIcons.heart;
    final roleColor = role == 'doctor'
        ? CgColors.primary
        : role == 'admin'
            ? const Color(0xFF7C3AED)
            : const Color(0xFFE11D48);

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
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: Column(
            children: [
              CgCard(
                padding: const EdgeInsets.all(28),
                child: Form(
                  key: _formKey,
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
                              'Đăng nhập — $roleLabel',
                              style: TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 20,
                                color: textColor,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'CardioGuard AI',
                              style: TextStyle(
                                  fontSize: 13,
                                  color: subColor,
                                  fontWeight: FontWeight.w500),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Error banner
                      if (activeError != null) ...[
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: CgColors.critical.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                                color: CgColors.critical.withValues(alpha: 0.3)),
                          ),
                          child: Row(
                            children: [
                              Icon(LucideIcons.alertCircle,
                                  color: CgColors.critical, size: 16),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  activeError,
                                  style: const TextStyle(
                                      color: CgColors.critical, fontSize: 13),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],

                      // Email
                      Text('Email',
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: textColor)),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        decoration: const InputDecoration(
                          hintText: 'example@email.com',
                          prefixIcon: Icon(LucideIcons.mail, size: 18),
                        ),
                        validator: (v) {
                          if (v == null || v.trim().isEmpty)
                            return 'Vui lòng nhập email';
                          if (!v.contains('@')) return 'Email không hợp lệ';
                          return null;
                        },
                      ),
                      const SizedBox(height: 14),

                      // Password
                      Text('Mật khẩu',
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: textColor)),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _passwordController,
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
                        validator: (v) {
                          if (v == null || v.isEmpty)
                            return 'Vui lòng nhập mật khẩu';
                          if (v.length < 6) return 'Mật khẩu phải từ 6 ký tự';
                          return null;
                        },
                      ),
                      Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: () =>
                              Navigator.pushNamed(context, '/forgot-password'),
                          style: TextButton.styleFrom(
                              padding: EdgeInsets.zero,
                              minimumSize: const Size(0, 30)),
                          child: Text(
                            'Quên mật khẩu?',
                            style: TextStyle(
                                fontSize: 12,
                                color: roleColor,
                                fontWeight: FontWeight.w600),
                          ),
                        ),
                      ),
                      const SizedBox(height: 4),

                      // Login button
                      SizedBox(
                        width: double.infinity,
                        height: 50,
                        child: ElevatedButton(
                          onPressed:
                              authProvider.isLoading ? null : _handleLogin,
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
                                      strokeWidth: 2, color: Colors.white))
                              : const Text('Đăng nhập',
                                  style: TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 15)),
                        ),
                      ),

                      // Social divider (not for admin)
                      if (role != 'admin') ...[
                        const SizedBox(height: 20),
                        Row(
                          children: [
                            Expanded(
                                child: Divider(
                                    color: isDark
                                        ? Colors.white24
                                        : Colors.black12)),
                            Padding(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 12),
                              child: Text('hoặc',
                                  style: TextStyle(
                                      color: subColor, fontSize: 12)),
                            ),
                            Expanded(
                                child: Divider(
                                    color: isDark
                                        ? Colors.white24
                                        : Colors.black12)),
                          ],
                        ),
                        const SizedBox(height: 16),

                        // Google
                        SizedBox(
                          width: double.infinity,
                          height: 48,
                          child: OutlinedButton(
                            onPressed: authProvider.isLoading
                                ? null
                                : _handleGoogleSignIn,
                            style: OutlinedButton.styleFrom(
                              side: BorderSide(
                                  color: isDark
                                      ? Colors.white.withValues(alpha: 0.15)
                                      : Colors.black.withValues(alpha: 0.12)),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12)),
                              backgroundColor: isDark
                                  ? Colors.white.withValues(alpha: 0.03)
                                  : Colors.white,
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(Icons.g_mobiledata_rounded,
                                    color: Color(0xFFEA4335), size: 24),
                                const SizedBox(width: 8),
                                Text(
                                  'Tiếp tục với Google',
                                  style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600,
                                      color: textColor),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 10),

                        // Facebook
                        SizedBox(
                          width: double.infinity,
                          height: 48,
                          child: ElevatedButton(
                            onPressed: authProvider.isLoading
                                ? null
                                : _handleFacebookSignIn,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF1877F2),
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12)),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: const [
                                _FacebookIcon(size: 18),
                                SizedBox(width: 8),
                                Text(
                                  'Tiếp tục với Facebook',
                                  style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w600),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],

                      // Register link (not for admin)
                      if (role != 'admin') ...[
                        const SizedBox(height: 20),
                        Center(
                          child: GestureDetector(
                            onTap: () => Navigator.pushNamed(
                                context, '/register',
                                arguments: {'role': role}),
                            child: RichText(
                              text: TextSpan(
                                text: 'Chưa có tài khoản? ',
                                style: TextStyle(
                                    color: subColor, fontSize: 14),
                                children: [
                                  TextSpan(
                                    text: 'Đăng ký',
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
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
              // Policy links
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

class _FacebookIcon extends StatelessWidget {
  final double size;
  const _FacebookIcon({this.size = 18});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(painter: _FbPainter()),
    );
  }
}

class _FbPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.white;
    final path = Path();
    final w = size.width;
    final h = size.height;
    path.moveTo(w * 0.6, h * 0.08);
    path.lineTo(w * 0.6, h * 0.27);
    path.lineTo(w * 0.45, h * 0.27);
    path.lineTo(w * 0.45, h * 0.45);
    path.lineTo(w * 0.6, h * 0.45);
    path.lineTo(w * 0.6, h);
    path.lineTo(w * 0.42, h);
    path.lineTo(w * 0.42, h * 0.45);
    path.lineTo(w * 0.27, h * 0.45);
    path.lineTo(w * 0.27, h * 0.27);
    path.lineTo(w * 0.42, h * 0.27);
    path.lineTo(w * 0.42, h * 0.15);
    path.close();
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _PolicyLink extends StatelessWidget {
  final String label;
  final String route;
  const _PolicyLink({required this.label, required this.route});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => Navigator.pushNamed(context, route),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 11,
          color: Colors.grey,
          decoration: TextDecoration.underline,
        ),
      ),
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
