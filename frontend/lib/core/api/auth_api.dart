import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../models/models.dart';

/// Auth API service
class AuthApi {
  final Dio _dio;
  AuthApi(this._dio);

  Future<Map<String, dynamic>> requestRegisterOtp(String email) async {
    final res = await _dio.post('/api/auth/register/request-otp',
        data: {'email': email});
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> verifyRegisterOtp(
      String email, String otp) async {
    final res = await _dio.post('/api/auth/register/verify-otp',
        data: {'email': email, 'otp': otp});
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> requestLoginOtp(String email) async {
    final res = await _dio.post('/api/auth/login', data: {'email': email});
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> verifyLoginOtp(
      String email, String otp) async {
    final res = await _dio.post('/api/auth/login/verify',
        data: {'email': email, 'otp': otp});
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> logout() async {
    final res = await _dio.post('/api/auth/logout');
    return res.data as Map<String, dynamic>;
  }

  /// Silent refresh — uses HttpOnly cookie automatically
  Future<Map<String, dynamic>?> refresh() async {
    try {
      final res = await _dio.post('/api/auth/refresh');
      return res.data as Map<String, dynamic>;
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return null;
      rethrow;
    }
  }

  Future<Map<String, dynamic>> getMe() async {
    final res = await _dio.get('/api/auth/me');
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> resendOtp(String email) async {
    final res = await _dio.post('/api/auth/resend-otp', data: {'email': email});
    return res.data as Map<String, dynamic>;
  }
}

final authApiProvider = Provider<AuthApi>((ref) {
  return AuthApi(ref.read(dioProvider));
});
