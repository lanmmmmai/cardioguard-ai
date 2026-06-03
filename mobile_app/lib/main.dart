// Điểm vào và cây widget gốc cho ứng dụng di động CardioGuard AI.
// Quy trình làm việc:
//   1. main() khởi chạy HeartMonitorApp bọc MultiProvider với tất cả
//      các provider trạng thái (auth, patient, alert, chat, appointment).
//   2. MaterialApp sử dụng các route có tên bắt đầu từ /splash. Việc chuyển đổi
//      chủ đề tối/sáng được quản lý bởi _HeartMonitorAppState.
//   3. Sau xác thực, MainTabWrapper hiển thị thanh điều hướng dưới dựa trên vai trò với
//      IndexedStack để giữ trạng thái tab khi điều hướng.
// Mối quan hệ:
//   - Phụ thuộc vào providers/*, screens/*, ui/cg_theme.dart, ui/cg_tokens.dart.
//   - AuthProvider xác định vai trò hoạt động và trạng thái
//      buộc đổi mật khẩu, giúp cấu hình lại bố cục tab một cách động.
//   - MainTabWrapper nhận callback chuyển đổi chủ đề từ trạng thái cha.
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:provider/provider.dart';
import 'package:lucide_flutter/lucide_flutter.dart';

import 'screens/splash_screen.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'screens/forgot_password_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/patients_screen.dart';
import 'screens/alerts_screen.dart';
import 'screens/appointments_screen.dart';
import 'screens/chat_ai_screen.dart';
import 'screens/settings_screen.dart';

import 'providers/auth_provider.dart';
import 'providers/patient_provider.dart';
import 'providers/alert_provider.dart';
import 'providers/chat_provider.dart';
import 'providers/appointment_provider.dart';
import 'ui/cg_theme.dart';
import 'ui/cg_tokens.dart';

// Điểm vào chính của ứng dụng. Tạo widget HeartMonitorApp gốc.
void main() {
  debugPrint('[CardioGuard] App starting...');
  runApp(const HeartMonitorApp());
}

// Widget ứng dụng gốc. Bọc cây widget trong MultiProvider và
// cấu hình MaterialApp với các route có tên và hỗ trợ chủ đề.
class HeartMonitorApp extends StatefulWidget {
  const HeartMonitorApp({super.key});

  @override
  State<HeartMonitorApp> createState() => _HeartMonitorAppState();
}

class _HeartMonitorAppState extends State<HeartMonitorApp> {
  // Theo dõi xem ứng dụng có đang sử dụng bảng màu tối hay không.
  bool _isDarkTheme = true;

  // Chuyển đổi giữa chủ đề tối và sáng, kích hoạt xây dựng lại giao diện.
  void _toggleTheme() {
    setState(() {
      _isDarkTheme = !_isDarkTheme;
    });
    debugPrint('[CardioGuard] Theme toggled: ${_isDarkTheme ? "dark" : "light"}');
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) {
          debugPrint('[CardioGuard] Initializing AuthProvider');
          return AuthProvider()..init();
        }),
        ChangeNotifierProvider(create: (_) {
          debugPrint('[CardioGuard] Initializing PatientProvider');
          return PatientProvider();
        }),
        ChangeNotifierProvider(create: (_) {
          debugPrint('[CardioGuard] Initializing AlertProvider');
          return AlertProvider();
        }),
        ChangeNotifierProvider(create: (_) {
          debugPrint('[CardioGuard] Initializing ChatProvider');
          return ChatProvider();
        }),
        ChangeNotifierProvider(create: (_) {
          debugPrint('[CardioGuard] Initializing AppointmentProvider');
          return AppointmentProvider();
        }),
      ],
      child: MaterialApp(
        title: 'Smart Heart Patient Monitoring',
        debugShowCheckedModeBanner: false,
        themeMode: _isDarkTheme ? ThemeMode.dark : ThemeMode.light,
        theme: buildCgTheme(Brightness.light),
        darkTheme: buildCgTheme(Brightness.dark),

        // Bắt đầu tại màn hình splash để xác thực phiên trước khi điều hướng tiếp.
        initialRoute: '/splash',
        routes: {
          '/splash': (context) => const SplashScreen(),
          '/login': (context) => const LoginScreen(),
          '/register': (context) => const RegisterScreen(),
          '/forgot-password': (context) => const ForgotPasswordScreen(),
          '/dashboard': (context) => MainTabWrapper(
                isDarkTheme: _isDarkTheme,
                onToggleTheme: _toggleTheme,
              ),
        },
      ),
    );
  }
}

// Bọc điều hướng dưới dựa trên vai trò. Hiển thị IndexedStack gồm các màn hình
// và một thanh dưới tùy chỉnh, với các tab được cấu hình động theo vai trò người dùng.
class MainTabWrapper extends StatefulWidget {
  // Xem chủ đề hiện tại có phải tối hay không; được chuyển tiếp từ HeartMonitorApp.
  final bool isDarkTheme;

  // Callback được gọi khi người dùng chuyển đổi chủ đề.
  final VoidCallback onToggleTheme;

  const MainTabWrapper({
    super.key,
    required this.isDarkTheme,
    required this.onToggleTheme,
  });

  @override
  State<MainTabWrapper> createState() => _MainTabWrapperState();
}

class _MainTabWrapperState extends State<MainTabWrapper> {
  // Chỉ số của tab điều hướng dưới hiện đang được chọn.
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    final isDark = widget.isDarkTheme;
    final bottomBarBg =
        isDark ? const Color(0xFF11151D).withValues(alpha: 0.9) : Colors.white;
    const activeColor = CgColors.primary;
    final inactiveColor =
        isDark ? const Color(0xFF9EA5B4) : const Color(0xFF475467);
    final borderColor = isDark
        ? Colors.white.withValues(alpha: 0.07)
        : Colors.black.withValues(alpha: 0.08);

    final authProvider = Provider.of<AuthProvider>(context);
    final role = authProvider.currentUser?.role ?? 'patient';
    final forcePasswordChange = authProvider.requiresPasswordChange;

    // Cấu hình động các mục tab và màn hình dựa trên vai trò đang hoạt động
    // và liệu có yêu cầu thay đổi mật khẩu bắt buộc hay không.
    final List<Widget> screens;
    final List<Map<String, dynamic>> tabConfig;

    if (forcePasswordChange) {
      screens = [
        SettingsScreen(
          isDarkTheme: widget.isDarkTheme,
          onToggleTheme: widget.onToggleTheme,
        ),
      ];
      tabConfig = [
        {'icon': LucideIcons.lock, 'label': 'Đổi mật khẩu'},
      ];
    } else if (role == 'admin') {
      screens = [
        DashboardScreen(
          isDarkTheme: widget.isDarkTheme,
          onToggleTheme: widget.onToggleTheme,
        ),
        PatientsScreen(isDarkTheme: widget.isDarkTheme),
        AlertsScreen(isDarkTheme: widget.isDarkTheme),
        AppointmentsScreen(isDarkTheme: widget.isDarkTheme),
        SettingsScreen(
          isDarkTheme: widget.isDarkTheme,
          onToggleTheme: widget.onToggleTheme,
        ),
      ];
      tabConfig = [
        {'icon': LucideIcons.layoutDashboard, 'label': 'Giám sát'},
        {'icon': LucideIcons.users, 'label': 'Bệnh nhân'},
        {'icon': LucideIcons.bell, 'label': 'Cảnh báo'},
        {'icon': LucideIcons.calendar, 'label': 'Lịch hẹn'},
        {'icon': LucideIcons.user, 'label': 'Cá nhân'},
      ];
    } else if (role == 'doctor') {
      screens = [
        DashboardScreen(
          isDarkTheme: widget.isDarkTheme,
          onToggleTheme: widget.onToggleTheme,
        ),
        PatientsScreen(isDarkTheme: widget.isDarkTheme),
        AlertsScreen(isDarkTheme: widget.isDarkTheme),
        AppointmentsScreen(isDarkTheme: widget.isDarkTheme),
        ChatAiScreen(isDarkTheme: widget.isDarkTheme),
        SettingsScreen(
          isDarkTheme: widget.isDarkTheme,
          onToggleTheme: widget.onToggleTheme,
        ),
      ];
      tabConfig = [
        {'icon': LucideIcons.layoutDashboard, 'label': 'Giám sát'},
        {'icon': LucideIcons.users, 'label': 'Bệnh nhân'},
        {'icon': LucideIcons.bell, 'label': 'Cảnh báo'},
        {'icon': LucideIcons.calendar, 'label': 'Lịch hẹn'},
        {'icon': LucideIcons.bot, 'label': 'Chat AI'},
        {'icon': LucideIcons.user, 'label': 'Cá nhân'},
      ];
    } else {
      // Chế độ xem tab dành riêng cho vai trò bệnh nhân
      screens = [
        DashboardScreen(
          isDarkTheme: widget.isDarkTheme,
          onToggleTheme: widget.onToggleTheme,
        ),
        AlertsScreen(isDarkTheme: widget.isDarkTheme),
        AppointmentsScreen(isDarkTheme: widget.isDarkTheme),
        ChatAiScreen(isDarkTheme: widget.isDarkTheme),
        SettingsScreen(
          isDarkTheme: widget.isDarkTheme,
          onToggleTheme: widget.onToggleTheme,
        ),
      ];
      tabConfig = [
        {'icon': LucideIcons.heart, 'label': 'Chỉ số'},
        {'icon': LucideIcons.bellRing, 'label': 'Cảnh báo'},
        {'icon': LucideIcons.calendar, 'label': 'Lịch hẹn'},
        {'icon': LucideIcons.bot, 'label': 'Chat AI'},
        {'icon': LucideIcons.user, 'label': 'Cá nhân'},
      ];
    }

    // Kẹp chỉ số hiện tại để nó không vượt quá số lượng màn hình có sẵn
    final safeIndex = _currentIndex >= screens.length ? 0 : _currentIndex;
    if (_currentIndex >= screens.length) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          setState(() {
            _currentIndex = 0;
          });
        }
      });
    }

    return Scaffold(
      body: IndexedStack(
        index: safeIndex,
        children: screens,
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: borderColor, width: 0.8)),
          color: bottomBarBg,
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: List.generate(tabConfig.length, (index) {
                final config = tabConfig[index];
                return _buildNavItem(index, config['icon'] as IconData,
                    config['label'] as String, activeColor, inactiveColor);
              }),
            ),
          ),
        ),
      ),
    );
  }

  // Xây dựng một mục điều hướng dưới dạng biểu tượng và nhãn.
  // index là vị trí tab, icon và label xác định hình ảnh trực quan,
  // activeColor / inactiveColor phản ánh trạng thái chọn.
  Widget _buildNavItem(int index, IconData icon, String label,
      Color activeColor, Color inactiveColor) {
    final isSelected = _currentIndex == index;
    final color = isSelected ? activeColor : inactiveColor;

    return GestureDetector(
      onTap: () {
        setState(() {
          _currentIndex = index;
        });
      },
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: 70,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 10,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
