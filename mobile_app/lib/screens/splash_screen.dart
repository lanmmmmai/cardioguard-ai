import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';

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

  Future<void> _initializeApp() async {
    // Wait for the widgets binding to finish
    await Future.delayed(const Duration(milliseconds: 1500));
    if (!mounted) return;

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    authProvider.init(); // Initialize token hooks
    
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
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: isDark
                ? [const Color(0xFF07080A), const Color(0xFF11151D)]
                : [const Color(0xFFF5F6F8), Colors.white],
          ),
        ),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Beautiful pulsing heartbeat icon
              Container(
                width: 90,
                height: 90,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFFF3366).withOpacity(0.1),
                ),
                child: const Icon(
                  Icons.favorite,
                  color: Color(0xFFFF3366),
                  size: 45,
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'CardioGuard AI',
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.2,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Hệ thống giám sát sức khỏe thông minh',
                style: TextStyle(
                  fontSize: 13,
                  color: isDark ? Colors.white.withOpacity(0.5) : Colors.black.withOpacity(0.5),
                ),
              ),
              const SizedBox(height: 48),
              const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFFF3366)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
