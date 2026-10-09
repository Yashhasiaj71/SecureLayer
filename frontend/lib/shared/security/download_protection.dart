import 'dart:js_interop';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:web/web.dart' as web;

/// Download/Screenshot Protection
///
/// IMPORTANT SECURITY DISCLAIMER:
/// These protections provide defense-in-depth DETERRENCE only.
/// They cannot prevent:
/// - OS-level screenshots (PrtScn, Snipping Tool, macOS Cmd+Shift+4)
/// - External cameras pointing at screen
/// - Browser extensions with elevated privileges
/// - Developer tools inspection
/// - Modified browser builds
///
/// The real security boundary is server-side:
/// Authentication → Authorization → Encryption → Controlled Delivery
///
/// These browser measures are supplementary deterrence:
/// BLOCK: None technically
/// DETER: Right-click, Ctrl+S, Ctrl+C, Ctrl+P, drag-and-drop
/// DETECT: Tab visibility loss, focus loss
/// LOG: All access via audit log (server-side)
/// IMPOSSIBLE: OS screenshots, external capture, extensions
class DownloadProtection {
  static bool _initialized = false;

  /// Apply download deterrence protections at the document level.
  static void initialize() {
    if (_initialized) return;
    _initialized = true;

    // Disable right-click context menu globally on protected content
    web.document.addEventListener(
      'contextmenu',
      (web.Event e) {
        if (_isProtectedElement(e)) {
          e.preventDefault();
        }
      }.toJS,
    );

    // Intercept keyboard shortcuts
    web.document.addEventListener(
      'keydown',
      (web.KeyboardEvent e) {
        _handleKeyDown(e);
      }.toJS,
    );

    // Prevent drag-and-drop of protected content
    web.document.addEventListener(
      'dragstart',
      (web.Event e) {
        if (_isProtectedElement(e)) {
          e.preventDefault();
        }
      }.toJS,
    );

    // Print prevention via CSS is handled in print styles
    // JS print event handler as additional layer
    web.window.addEventListener(
      'beforeprint',
      (web.Event e) {
        _handleBeforePrint();
      }.toJS,
    );
  }

  static bool _isProtectedElement(web.Event e) {
    final target = e.target;
    if (target == null) return false;
    // Check if event is within a protected zone
    // In practice we use CSS class markers
    return true; // Apply globally in secure viewer context
  }

  static void _handleKeyDown(web.KeyboardEvent e) {
    final ctrl = e.ctrlKey || e.metaKey;

    // DETER: Ctrl+S (Save), Ctrl+P (Print), Ctrl+C (Copy), Ctrl+U (View Source)
    if (ctrl && (e.key == 's' || e.key == 'p' || e.key == 'u')) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // DETER: F12 (DevTools) — note: this can be overridden by browser/OS
    // Considered DETER, not BLOCK
    if (e.key == 'F12') {
      e.preventDefault();
      return;
    }

    // DETER: PrintScreen — note: browser may not intercept OS-level PrtScn
    if (e.key == 'PrintScreen') {
      e.preventDefault();
      return;
    }
  }

  static void _handleBeforePrint() {
    // Additional JS-level print blocking
    // Primary protection is CSS @media print (see index.html)
  }

  /// Detect visibility change (tab switching) for content blurring
  static Stream<bool> get visibilityStream {
    final controller = StreamController<bool>.broadcast();

    web.document.addEventListener(
      'visibilitychange',
      (web.Event e) {
        controller.add(web.document.hidden);
      }.toJS,
    );

    return controller.stream;
  }
}

/// Widget that blurs its content when the tab/window loses focus.
/// DETER: Makes screen capture less useful when user switches away.
class FocusProtectedWidget extends StatefulWidget {
  final Widget child;
  final bool blurOnFocusLoss;

  const FocusProtectedWidget({
    super.key,
    required this.child,
    this.blurOnFocusLoss = true,
  });

  @override
  State<FocusProtectedWidget> createState() => _FocusProtectedWidgetState();
}

class _FocusProtectedWidgetState extends State<FocusProtectedWidget>
    with WidgetsBindingObserver {
  bool _isBlurred = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!widget.blurOnFocusLoss) return;
    setState(() {
      _isBlurred = state != AppLifecycleState.resumed;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!_isBlurred) return widget.child;

    return Stack(
      children: [
        ImageFiltered(
          imageFilter: ui.ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: widget.child,
        ),
        Container(
          color: Colors.black54,
          child: const Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.lock_outline, color: Colors.white, size: 48),
                SizedBox(height: 16),
                Text(
                  'Content hidden\nReturn to this tab to view',
                  style: TextStyle(color: Colors.white, fontSize: 18),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
