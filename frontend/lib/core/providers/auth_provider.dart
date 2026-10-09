import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../models/models.dart';
import '../api/auth_api.dart';
import '../api/api_client.dart';

/// Auth state notifier — holds access token in memory ONLY.
/// SECURITY: Access token is NEVER written to SharedPreferences,
/// localStorage, or any persistent storage.
///
/// Lifecycle:
/// - App start: attempt silent refresh via HttpOnly cookie
/// - Login: store access token in state (in-memory)
/// - Page reload: access token lost → silent refresh re-establishes session
/// - Logout: revoke refresh token + clear state
class AuthNotifier extends StateNotifier<AuthState> {
  final AuthApi _authApi;
  final Dio _dio;

  AuthNotifier(this._authApi, this._dio) : super(const AuthInitial());

  /// Called on app start — attempt silent refresh using HttpOnly cookie.
  /// If cookie is valid, user is silently re-authenticated.
  Future<void> initialize() async {
    state = const AuthLoading();
    try {
      final response = await _authApi.refresh();
      if (response == null || response['success'] != true) {
        state = const AuthUnauthenticated();
        return;
      }

      final data = response['data'] as Map<String, dynamic>;
      final accessToken = data['accessToken'] as String;
      final user = UserModel.fromJson(data['user'] as Map<String, dynamic>);

      // Set access token in Dio headers for subsequent requests
      _setAccessToken(accessToken);
      state = AuthAuthenticated(user: user, accessToken: accessToken);
    } catch (_) {
      state = const AuthUnauthenticated();
    }
  }

  /// Register: verify OTP → issue tokens → authenticate
  Future<AuthResult> verifyRegisterOtp(String email, String otp) async {
    try {
      final response = await _authApi.verifyRegisterOtp(email, otp);
      if (response['success'] == true) {
        return _handleAuthSuccess(response);
      }
      final error = response['error'] as Map<String, dynamic>?;
      return AuthResult.failure(error?['message'] as String? ?? 'Verification failed');
    } on DioException catch (e) {
      return _handleDioError(e);
    }
  }

  /// Login: verify OTP → issue tokens → authenticate
  Future<AuthResult> verifyLoginOtp(String email, String otp) async {
    try {
      final response = await _authApi.verifyLoginOtp(email, otp);
      if (response['success'] == true) {
        return _handleAuthSuccess(response);
      }
      final error = response['error'] as Map<String, dynamic>?;
      return AuthResult.failure(error?['message'] as String? ?? 'Login failed');
    } on DioException catch (e) {
      return _handleDioError(e);
    }
  }

  Future<void> logout() async {
    try {
      await _authApi.logout();
    } catch (_) {
      // Best-effort logout — clear state regardless
    } finally {
      _clearAccessToken();
      state = const AuthUnauthenticated();
    }
  }

  AuthResult _handleAuthSuccess(Map<String, dynamic> response) {
    final data = response['data'] as Map<String, dynamic>;
    final accessToken = data['accessToken'] as String;
    final user = UserModel.fromJson(data['user'] as Map<String, dynamic>);

    _setAccessToken(accessToken);
    state = AuthAuthenticated(user: user, accessToken: accessToken);
    return AuthResult.success();
  }

  AuthResult _handleDioError(DioException e) {
    final data = e.response?.data as Map<String, dynamic>?;
    final error = data?['error'] as Map<String, dynamic>?;
    return AuthResult.failure(error?['message'] as String? ?? 'An error occurred');
  }

  void _setAccessToken(String token) {
    _dio.options.headers['Authorization'] = 'Bearer $token';
  }

  void _clearAccessToken() {
    _dio.options.headers.remove('Authorization');
  }

  String? get accessToken {
    final s = state;
    if (s is AuthAuthenticated) return s.accessToken;
    return null;
  }
}

class AuthResult {
  final bool success;
  final String? error;
  const AuthResult._({required this.success, this.error});
  factory AuthResult.success() => const AuthResult._(success: true);
  factory AuthResult.failure(String message) =>
      AuthResult._(success: false, error: message);
}

final authNotifierProvider =
    StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(
    ref.read(authApiProvider),
    ref.read(dioProvider),
  );
});

/// Convenience provider for current user
final currentUserProvider = Provider<UserModel?>((ref) {
  final state = ref.watch(authNotifierProvider);
  if (state is AuthAuthenticated) return state.user;
  return null;
});

/// Convenience provider for access token
final accessTokenProvider = Provider<String?>((ref) {
  final state = ref.watch(authNotifierProvider);
  if (state is AuthAuthenticated) return state.accessToken;
  return null;
});
