import 'dart:math' as math;
import 'package:flutter/material.dart';

class Point3D {
  final double x;
  final double y;
  final double z;

  Point3D(this.x, this.y, this.z);
}

class ProjectedPoint {
  final double x;
  final double y;
  final double z;
  final double scale;

  ProjectedPoint(this.x, this.y, this.z, this.scale);
}

class Heart3dPainter extends CustomPainter {
  final List<Point3D> points;
  final double angleY;
  final double angleX;
  final double pulse;
  final bool isDarkTheme;

  Heart3dPainter({
    required this.points,
    required this.angleY,
    required this.angleX,
    required this.pulse,
    required this.isDarkTheme,
  });

  // Generate 3D point cloud coordinates (run once outside of paint loop for performance)
  static List<Point3D> generateHeartPoints() {
    final List<Point3D> points = [];
    const int numLatitudes = 30;
    const int numLongitudes = 30;

    for (int i = 0; i < numLatitudes; i++) {
      double theta = (i / numLatitudes) * math.pi;
      for (int j = 0; j < numLongitudes; j++) {
        double phi = (j / numLongitudes) * 2 * math.pi;

        double sinTheta = math.sin(theta);
        double cosTheta = math.cos(theta);
        double sin3Theta = math.pow(sinTheta, 3).toDouble();

        double x = 16 * sin3Theta * math.sin(phi);
        double y = 13 * cosTheta - 5 * math.cos(2 * theta) - 2 * math.cos(3 * theta) - math.cos(4 * theta);
        double z = 16 * sin3Theta * math.cos(phi);

        points.add(Point3D(x, y * 0.9, z));
      }
    }

    // Add internal volume points for holographic depth
    final random = math.Random(42); // Seeded for consistency
    for (int k = 0; k < 250; k++) {
      double theta = random.nextDouble() * math.pi;
      double phi = random.nextDouble() * 2 * math.pi;
      double r = random.nextDouble();

      double sinTheta = math.sin(theta);
      double cosTheta = math.cos(theta);
      double sin3Theta = math.pow(sinTheta, 3).toDouble();

      double x = 16 * sin3Theta * math.sin(phi) * r;
      double y = (13 * cosTheta - 5 * math.cos(2 * theta) - 2 * math.cos(3 * theta) - math.cos(4 * theta)) * r;
      double z = 16 * sin3Theta * math.cos(phi) * r;

      points.add(Point3D(x, y * 0.9, z));
    }

    return points;
  }

  @override
  void paint(Canvas canvas, Size size) {
    final double width = size.width;
    final double height = size.height;
    final double centerX = width / 2;
    final double centerY = height / 2 - 10;

    const double cameraDistance = 60.0;
    final double pulseScale = 4.2 * (1.0 + pulse);

    final double cosY = math.cos(angleY);
    final double sinY = math.sin(angleY);
    final double cosX = math.cos(angleX);
    final double sinX = math.sin(angleX);

    // Project 3D points onto 2D viewport
    final List<ProjectedPoint> projected = [];
    for (var p in points) {
      // Rotation Y
      double x1 = p.x * cosY - p.z * sinY;
      double z1 = p.x * sinY + p.z * cosY;

      // Rotation X
      double y2 = p.y * cosX - z1 * sinX;
      double z2 = p.y * sinX + z1 * cosX;

      // Perspective Projection
      double scale = cameraDistance / (cameraDistance + z2);
      double screenX = centerX + x1 * pulseScale * scale;
      double screenY = centerY - y2 * pulseScale * scale;

      projected.add(ProjectedPoint(screenX, screenY, z2, scale));
    }

    // Depth sort (Painter's Algorithm)
    projected.sort((a, b) => b.z.compareTo(a.z));

    // Draw nodes
    final randomHighlight = math.Random(1337);
    for (var p in projected) {
      // Normalize depth (-18 to 18 depth range)
      double depthAlpha = (1.0 - (p.z + 18.0) / 36.0).clamp(0.15, 1.0);

      final paint = Paint()
        ..color = const Color(0xFFFF3366).withValues(alpha: depthAlpha * 0.85)
        ..style = PaintingStyle.fill;

      double radius = (1.5 * p.scale).clamp(0.6, 4.0);
      canvas.drawCircle(Offset(p.x, p.y), radius, paint);

      // Highlight front-most nodes
      if (p.z < -10.0 && randomHighlight.nextDouble() < 0.04) {
        final highlightPaint = Paint()
          ..color = Colors.white.withValues(alpha: depthAlpha * 0.9)
          ..style = PaintingStyle.fill;
        canvas.drawCircle(Offset(p.x, p.y), radius * 1.3, highlightPaint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant Heart3dPainter oldDelegate) {
    return oldDelegate.angleY != angleY ||
        oldDelegate.angleX != angleX ||
        oldDelegate.pulse != pulse ||
        oldDelegate.isDarkTheme != isDarkTheme;
  }
}

