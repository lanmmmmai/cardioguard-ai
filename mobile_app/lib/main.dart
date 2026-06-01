import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';

import 'screens/splash_screen.dart';
import 'screens/login_screen.dart';
import 'screens/register_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/patients_screen.dart';
import 'screens/alerts_screen.dart';
import 'screens/icu_camera_screen.dart';
import 'screens/settings_screen.dart';

import 'providers/auth_provider.dart';
import 'providers/patient_provider.dart';
import 'providers/alert_provider.dart';
import 'providers/chat_provider.dart';
import 'providers/appointment_provider.dart';

void main() {
  runApp(const HeartMonitorApp());
}

class HeartMonitorApp extends StatefulWidget {
  const HeartMonitorApp({super.key});

  @override
  State<HeartMonitorApp> createState() => _HeartMonitorAppState();
}

class _HeartMonitorAppState extends State<HeartMonitorApp> {
  bool _isDarkTheme = true;

  void _toggleTheme() {
    setState(() {
      _isDarkTheme = !_isDarkTheme;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => PatientProvider()),
        ChangeNotifierProvider(create: (_) => AlertProvider()),
        ChangeNotifierProvider(create: (_) => ChatProvider()),
        ChangeNotifierProvider(create: (_) => AppointmentProvider()),
      ],
      child: MaterialApp(
        title: 'Smart Heart Patient Monitoring',
        debugShowCheckedModeBanner: false,
        themeMode: _isDarkTheme ? ThemeMode.dark : ThemeMode.light,
        
        // Light Theme Style
        theme: ThemeData(
          brightness: Brightness.light,
          primaryColor: const Color(0xFFFF3366),
          scaffoldBackgroundColor: const Color(0xFFF5F6F8),
          colorScheme: const ColorScheme.light(
            primary: Color(0xFFFF3366),
            secondary: Color(0xFF00F2FE),
            surface: Colors.white,
          ),
          inputDecorationTheme: InputDecorationTheme(
            filled: true,
            fillColor: Colors.black.withValues(alpha: 0.03),
            labelStyle: TextStyle(color: Colors.black.withValues(alpha: 0.6)),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.black.withValues(alpha: 0.08)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFFF3366)),
            ),
          ),
        ),

        // Dark Theme Style
        darkTheme: ThemeData(
          brightness: Brightness.dark,
          primaryColor: const Color(0xFFFF3366),
          scaffoldBackgroundColor: const Color(0xFF07080A),
          colorScheme: const ColorScheme.dark(
            primary: Color(0xFFFF3366),
            secondary: Color(0xFF00F2FE),
            surface: Color(0xFF11151D),
          ),
          inputDecorationTheme: InputDecorationTheme(
            filled: true,
            fillColor: Colors.white.withValues(alpha: 0.03),
            labelStyle: TextStyle(color: Colors.white.withValues(alpha: 0.6)),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.07)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFFF3366)),
            ),
          ),
        ),

        // Initial route is splash for session verification
        initialRoute: '/splash',
        routes: {
          '/splash': (context) => const SplashScreen(),
          '/login': (context) => const LoginScreen(),
          '/register': (context) => const RegisterScreen(),
          '/dashboard': (context) => MainTabWrapper(
                isDarkTheme: _isDarkTheme,
                onToggleTheme: _toggleTheme,
              ),
        },
      ),
    );
  }
}

class MainTabWrapper extends StatefulWidget {
  final bool isDarkTheme;
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
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    final isDark = widget.isDarkTheme;
    final bottomBarBg = isDark ? const Color(0xFF11151D).withValues(alpha: 0.9) : Colors.white;
    const activeColor = Color(0xFFFF3366);
    final inactiveColor = isDark ? const Color(0xFF9EA5B4) : const Color(0xFF475467);
    final borderColor = isDark ? Colors.white.withValues(alpha: 0.07) : Colors.black.withValues(alpha: 0.08);

    final authProvider = Provider.of<AuthProvider>(context);
    final role = authProvider.currentUser?.role ?? 'patient';

    // Configure items and screens dynamically based on the active role
    final List<Widget> screens;
    final List<Map<String, dynamic>> tabConfig;

    if (role == 'admin' || role == 'doctor') {
      screens = [
        DashboardScreen(
          isDarkTheme: widget.isDarkTheme,
          onToggleTheme: widget.onToggleTheme,
        ),
        PatientsScreen(isDarkTheme: widget.isDarkTheme),
        AlertsScreen(isDarkTheme: widget.isDarkTheme),
        IcuCameraScreen(isDarkTheme: widget.isDarkTheme),
        SettingsScreen(
          isDarkTheme: widget.isDarkTheme,
          onToggleTheme: widget.onToggleTheme,
        ),
      ];
      tabConfig = [
        {'icon': LucideIcons.layoutDashboard, 'label': 'Giám sát'},
        {'icon': LucideIcons.users, 'label': 'Bệnh nhân'},
        {'icon': LucideIcons.bell, 'label': 'Cảnh báo'},
        {'icon': LucideIcons.video, 'label': 'Phòng ICU'},
        {'icon': LucideIcons.user, 'label': 'Cá nhân'},
      ];
    } else {
      // Patient Role Specific Tabbed Screen Views
      screens = [
        DashboardScreen(
          isDarkTheme: widget.isDarkTheme,
          onToggleTheme: widget.onToggleTheme,
        ),
        AlertsScreen(isDarkTheme: widget.isDarkTheme),
        SettingsScreen(
          isDarkTheme: widget.isDarkTheme,
          onToggleTheme: widget.onToggleTheme,
        ),
      ];
      tabConfig = [
        {'icon': LucideIcons.heart, 'label': 'Chỉ số'},
        {'icon': LucideIcons.bellRing, 'label': 'Cảnh báo'},
        {'icon': LucideIcons.user, 'label': 'Cá nhân'},
      ];
    }

    // Wrap in Safe Index Boundaries
    if (_currentIndex >= screens.length) {
      _currentIndex = 0;
    }

    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
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
                return _buildNavItem(
                  index, 
                  config['icon'] as IconData, 
                  config['label'] as String, 
                  activeColor, 
                  inactiveColor
                );
              }),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(int index, IconData icon, String label, Color activeColor, Color inactiveColor) {
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

