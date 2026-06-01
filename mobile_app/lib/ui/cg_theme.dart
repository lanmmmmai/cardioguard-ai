import 'package:flutter/material.dart';
import 'cg_tokens.dart';

ThemeData buildCgTheme(Brightness brightness) {
  final isDark = brightness == Brightness.dark;
  final base = ThemeData(
    useMaterial3: true,
    brightness: brightness,
  );

  final scheme = isDark
      ? const ColorScheme.dark(
          primary: CgColors.primary,
          secondary: CgColors.spo2,
          surface: Color(0xFF11151D),
          error: CgColors.critical,
        )
      : const ColorScheme.light(
          primary: CgColors.primary,
          secondary: CgColors.spo2,
          surface: Colors.white,
          error: CgColors.critical,
        );

  return base.copyWith(
    colorScheme: scheme,
    primaryColor: CgColors.primary,
    scaffoldBackgroundColor:
        isDark ? const Color(0xFF07080A) : const Color(0xFFF4F6FA),
    textTheme: base.textTheme.copyWith(
      titleLarge: const TextStyle(fontWeight: FontWeight.w700, fontSize: 22),
      titleMedium: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
      bodyMedium: const TextStyle(fontSize: 14, height: 1.4),
      bodySmall: TextStyle(
          fontSize: 12,
          color: isDark ? const Color(0xFF98A2B3) : const Color(0xFF667085)),
      labelSmall: const TextStyle(
          fontSize: 11, letterSpacing: 0.2, fontWeight: FontWeight.w600),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: isDark
          ? Colors.white.withValues(alpha: 0.03)
          : Colors.black.withValues(alpha: 0.03),
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(CgRadius.md),
        borderSide: BorderSide(
            color: isDark
                ? Colors.white.withValues(alpha: 0.08)
                : Colors.black.withValues(alpha: 0.08)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(CgRadius.md),
        borderSide: BorderSide(
            color: isDark
                ? Colors.white.withValues(alpha: 0.08)
                : Colors.black.withValues(alpha: 0.08)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(CgRadius.md),
        borderSide: const BorderSide(color: CgColors.primary, width: 1.2),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        minimumSize: const Size(double.infinity, 48),
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(CgRadius.md)),
        backgroundColor: CgColors.primary,
        foregroundColor: Colors.white,
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
      ),
    ),
  );
}
