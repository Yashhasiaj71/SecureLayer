import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';

/// Visible watermark overlay for confidential content.
///
/// SECURITY NOTES:
/// - Frontend watermark provides DETERRENCE against casual redistribution
/// - It can be removed by: dev tools, screenshot cropping, CSS injection
/// - Server-side watermark burning would be stronger but requires more infra
/// - This is acknowledged as best-effort — real security is server-side auth/encryption
///
/// Watermark contains: email, userId, timestamp, fileId, access marker
/// Goal: attribution traceback if content is leaked
class WatermarkOverlay extends StatelessWidget {
  final String email;
  final String userId;
  final String fileId;
  final DateTime accessTime;
  final double opacity;

  const WatermarkOverlay({
    super.key,
    required this.email,
    required this.userId,
    required this.fileId,
    required this.accessTime,
    this.opacity = 0.12,
  });

  @override
  Widget build(BuildContext context) {
    final formattedTime = DateFormat('yyyy-MM-dd HH:mm').format(accessTime.toLocal());
    final shortUserId = userId.length > 8 ? userId.substring(userId.length - 8) : userId;
    final shortFileId = fileId.length > 8 ? fileId.substring(fileId.length - 8) : fileId;

    final watermarkText =
        'CONFIDENTIAL\n$email\nUser: ...$shortUserId\nFile: ...$shortFileId\n$formattedTime';

    return IgnorePointer(
      child: ClipRect(
        child: CustomPaint(
          painter: _WatermarkPainter(
            text: watermarkText,
            opacity: opacity,
          ),
          child: const SizedBox.expand(),
        ),
      ),
    );
  }
}

class _WatermarkPainter extends CustomPainter {
  final String text;
  final double opacity;

  _WatermarkPainter({required this.text, required this.opacity});

  @override
  void paint(Canvas canvas, Size size) {
    final textStyle = TextStyle(
      color: AppTheme.textPrimary.withOpacity(opacity),
      fontSize: 13,
      fontWeight: FontWeight.w600,
      letterSpacing: 0.5,
    );

    final textPainter = TextPainter(
      text: TextSpan(text: text, style: textStyle),
      textDirection: TextDirection.ltr,
    );

    textPainter.layout();

    // Draw watermark diagonally in a repeating grid
    const angleRad = -0.4; // ~23 degrees
    final stepX = textPainter.width + 80;
    final stepY = textPainter.height + 60;

    for (double x = -size.width; x < size.width * 2; x += stepX) {
      for (double y = -size.height; y < size.height * 2; y += stepY) {
        canvas.save();
        canvas.translate(x, y);
        canvas.rotate(angleRad);
        textPainter.paint(canvas, Offset.zero);
        canvas.restore();
      }
    }
  }

  @override
  bool shouldRepaint(_WatermarkPainter oldDelegate) =>
      oldDelegate.text != text || oldDelegate.opacity != opacity;
}

/// Security badge shown in the viewer header
class SecurityBadge extends StatelessWidget {
  final String label;
  final Color color;
  final IconData icon;

  const SecurityBadge({
    super.key,
    required this.label,
    required this.color,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 12),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }
}
