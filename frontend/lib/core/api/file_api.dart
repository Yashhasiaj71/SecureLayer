import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../models/models.dart';

/// File API service
class FileApi {
  final Dio _dio;
  FileApi(this._dio);

  void _setAuth(String accessToken) {
    _dio.options.headers['Authorization'] = 'Bearer $accessToken';
  }

  Future<List<FileModel>> listFiles(String accessToken) async {
    _setAuth(accessToken);
    final res = await _dio.get('/api/files');
    final data = res.data['data'] as Map<String, dynamic>;
    final files = data['files'] as List<dynamic>;
    return files
        .map((f) => FileModel.fromJson(f as Map<String, dynamic>))
        .toList();
  }

  /// Get file as bytes — decrypted by server, streamed securely
  Future<Uint8ListResponse> getFileBytes(
      String fileId, String accessToken) async {
    _setAuth(accessToken);
    final res = await _dio.get(
      '/api/files/$fileId',
      options: Options(responseType: ResponseType.bytes),
    );
    return Uint8ListResponse(
      bytes: res.data as List<int>,
      mimeType: res.headers.value('content-type') ?? 'application/octet-stream',
    );
  }

  Future<FileModel> uploadFile(
      String accessToken, MultipartFile file) async {
    _setAuth(accessToken);
    final formData = FormData.fromMap({'file': file});
    final res = await _dio.post('/api/files/upload', data: formData);
    final data = res.data['data'] as Map<String, dynamic>;
    return FileModel.fromJson(data['file'] as Map<String, dynamic>);
  }

  Future<void> deleteFile(String fileId, String accessToken) async {
    _setAuth(accessToken);
    await _dio.delete('/api/files/$fileId');
  }
}

class Uint8ListResponse {
  final List<int> bytes;
  final String mimeType;
  const Uint8ListResponse({required this.bytes, required this.mimeType});
}

final fileApiProvider = Provider<FileApi>((ref) {
  return FileApi(ref.read(dioProvider));
});
