import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:dio/browser.dart';

/// Base URL for the API — configure via build-time environment or const
const String _kBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://localhost:5000',
);

/// Riverpod provider for the configured Dio instance.
/// Shared across all API services via Riverpod.
final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: _kBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // CSRF protection: custom header that SameSite cookies still allow
        // but cross-site forged requests won't include
        'X-Requested-With': 'XMLHttpRequest',
      },
      // SECURITY: withCredentials=true required for HttpOnly refresh cookie
      extra: {'withCredentials': true},
    ),
  );

  // Web adapter with credentials
  // ignore: undefined_prefixed_name
  final adapter = BrowserHttpClientAdapter();
  (adapter as dynamic).withCredentials = true;
  dio.httpClientAdapter = adapter;

  // Request/Response logging in debug mode
  assert(() {
    dio.interceptors.add(LogInterceptor(
      requestBody: false, // SECURITY: Never log request bodies (may have tokens)
      responseBody: false,
      logPrint: (obj) => print('[HTTP] $obj'),
    ));
    return true;
  }());

  return dio;
});

/// Standard API response wrapper
class ApiResponse<T> {
  final bool success;
  final T? data;
  final String? errorCode;
  final String? errorMessage;

  const ApiResponse({
    required this.success,
    this.data,
    this.errorCode,
    this.errorMessage,
  });

  factory ApiResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>)? fromData,
  ) {
    if (json['success'] == true) {
      return ApiResponse(
        success: true,
        data: fromData != null && json['data'] != null
            ? fromData(json['data'])
            : json['data'],
      );
    } else {
      final error = json['error'] as Map<String, dynamic>?;
      return ApiResponse(
        success: false,
        errorCode: error?['code'] as String?,
        errorMessage: error?['message'] as String?,
      );
    }
  }
}
