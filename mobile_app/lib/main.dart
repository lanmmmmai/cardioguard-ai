import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/patients_screen.dart';
import 'screens/icu_camera_screen.dart';
import 'screens/stats_screen.dart';

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
    return MaterialApp(
      title: 'Smart Heart Patient Monitoring',
      debugShowCheckedModeBanner: false,
      themeMode: _isDarkTheme ? ThemeMode.dark : ThemeMode.light,
      
      // Light Theme Style
      theme: ThemeData(
        brightness: Brightness.light,
        primaryColor: const Color(0xFFFF3366),
        fontFamily: 'Futura',
        scaffoldBackgroundColor: const Color(0xFFF5F6F8),
        colorScheme: const ColorScheme.light(
          primary: Color(0xFFFF3366),
          secondary: Color(0xFF00F2FE),
          background: Color(0xFFF5F6F8),
          surface: Colors.white,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.black.withOpacity(0.03),
          labelStyle: TextStyle(color: Colors.black.withOpacity(0.6)),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide(color: Colors.black.withOpacity(0.08)),
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
        fontFamily: 'Futura',
        scaffoldBackgroundColor: const Color(0xFF07080A),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFFFF3366),
          secondary: Color(0xFF00F2FE),
          background: Color(0xFF07080A),
          surface: Color(0xFF11151D),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white.withOpacity(0.03),
          labelStyle: TextStyle(color: Colors.white.withOpacity(0.6)),
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

      // Initial route
      initialRoute: '/login',
      routes: {
        '/login': (context) => const LoginScreen(),
        '/dashboard': (context) => MainTabWrapper(
              isDarkTheme: _isDarkTheme,
              onToggleTheme: _toggleTheme,
            ),
      },
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
    final bottomBarBg = isDark ? const Color(0xFF11151D).withOpacity(0.9) : Colors.white;
    final activeColor = const Color(0xFFFF3366);
    final inactiveColor = isDark ? const Color(0xFF9EA5B4) : const Color(0xFF475467);
    final borderColor = isDark ? Colors.white.withOpacity(0.07) : Colors.black.withOpacity(0.08);

    // List of screens corresponding to bottom tabs
    final List<Widget> screens = [
      DashboardScreen(
        isDarkTheme: widget.isDarkTheme,
        onToggleTheme: widget.onToggleTheme,
      ),
      PatientsScreen(isDarkTheme: widget.isDarkTheme),
      IcuCameraScreen(isDarkTheme: widget.isDarkTheme),
      StatsScreen(isDarkTheme: widget.isDarkTheme),
    ];

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
              children: [
                _buildNavItem(0, LucideIcons.layoutDashboard, 'Giám sát', activeColor, inactiveColor),
                _buildNavItem(1, LucideIcons.users, 'Bệnh nhân', activeColor, inactiveColor),
                _buildNavItem(2, LucideIcons.video, 'Phòng ICU', activeColor, inactiveColor),
                _buildNavItem(3, LucideIcons.barChart2, 'Thống kê', activeColor, inactiveColor),
              ],
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
        width: 80,
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
                fontFamily: 'Futura',
              ),
            ),
          ],
        ),
      ),
    );
  }
}
