import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'core/theme/app_theme.dart';
import 'core/providers/auth_provider.dart';
import 'features/auth/login_screen.dart';
import 'features/auth/otp_screen.dart';
import 'features/auth/register_screen.dart';
import 'features/dashboard/dashboard_screen.dart';
import 'features/files/file_manager_screen.dart';
import 'features/files/secure_viewer_screen.dart';
import 'features/admin/admin_screen.dart';

void main() {
  runApp(const ProviderScope(child: SecureLayerApp()));
}

class SecureLayerApp extends ConsumerWidget {
  const SecureLayerApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = _createRouter(ref);

    return MaterialApp.router(
      title: 'SecureLayer',
      theme: AppTheme.dark, // Dark mode premium UI
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }

  GoRouter _createRouter(WidgetRef ref) {
    return GoRouter(
      initialLocation: '/',
      redirect: (context, state) async {
        final authState = ref.read(authNotifierProvider);

        // Allow unauthenticated users to access auth routes
        if (state.uri.path.startsWith('/login') ||
            state.uri.path.startsWith('/register')) {
          if (authState is AuthAuthenticated) {
            return '/dashboard'; // Redirect authenticated users away from auth
          }
          return null; // Stay on auth route
        }

        // For all other routes, require authentication
        if (authState is AuthInitial || authState is AuthLoading) {
          return '/'; // Show splash/loading while resolving auth
        }
        if (authState is! AuthAuthenticated) {
          return '/login'; // Redirect to login if unauthenticated
        }

        // Admin-only route protection
        if (state.uri.path.startsWith('/admin') &&
            !authState.user.isAdmin) {
          return '/dashboard'; // Redirect non-admins away from admin routes
        }

        return null;
      },
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => const _SplashScreen(),
        ),
        GoRoute(
          path: '/login',
          builder: (context, state) => const LoginScreen(),
          routes: [
            GoRoute(
              path: 'verify',
              builder: (context, state) {
                final email = state.extra as String?;
                if (email == null) return const LoginScreen();
                return OtpScreen(email: email, isRegistration: false);
              },
            ),
          ],
        ),
        GoRoute(
          path: '/register',
          builder: (context, state) => const RegisterScreen(),
          routes: [
            GoRoute(
              path: 'verify',
              builder: (context, state) {
                final email = state.extra as String?;
                if (email == null) return const RegisterScreen();
                return OtpScreen(email: email, isRegistration: true);
              },
            ),
          ],
        ),
        // Authenticated routes
        ShellRoute(
          builder: (context, state, child) => child,
          routes: [
            GoRoute(
              path: '/dashboard',
              pageBuilder: (context, state) =>
                  const NoTransitionPage(child: DashboardScreen()),
            ),
            GoRoute(
              path: '/files',
              pageBuilder: (context, state) =>
                  const NoTransitionPage(child: FileManagerScreen()),
            ),
            GoRoute(
              path: '/viewer/:id',
              builder: (context, state) {
                final fileId = state.pathParameters['id']!;
                return SecureViewerScreen(fileId: fileId);
              },
            ),
            GoRoute(
              path: '/admin',
              pageBuilder: (context, state) =>
                  const NoTransitionPage(child: AdminScreen()),
            ),
          ],
        ),
      ],
    );
  }
}

class _SplashScreen extends ConsumerStatefulWidget {
  const _SplashScreen();

  @override
  ConsumerState<_SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<_SplashScreen> {
  @override
  void initState() {
    super.initState();
    // Attempt silent refresh on app start
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(authNotifierProvider.notifier).initialize().then((_) {
        if (mounted) {
          final authState = ref.read(authNotifierProvider);
          if (authState is AuthAuthenticated) {
            context.go('/dashboard');
          } else {
            context.go('/login');
          }
        }
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: AppTheme.background,
      body: Center(
        child: CircularProgressIndicator(color: AppTheme.primary),
      ),
    );
  }
}
