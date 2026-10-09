import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:file_picker/file_picker.dart';
import 'package:dio/dio.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/api/file_api.dart';
import '../../core/models/models.dart';

final fileListProvider = FutureProvider.autoDispose<List<FileModel>>((ref) async {
  final accessToken = ref.watch(accessTokenProvider);
  if (accessToken == null) return [];
  final fileApi = ref.read(fileApiProvider);
  return fileApi.listFiles(accessToken);
});

/// File Manager Screen
class FileManagerScreen extends ConsumerStatefulWidget {
  const FileManagerScreen({super.key});

  @override
  ConsumerState<FileManagerScreen> createState() => _FileManagerScreenState();
}

class _FileManagerScreenState extends ConsumerState<FileManagerScreen> {
  bool _uploading = false;
  String? _uploadError;

  @override
  Widget build(BuildContext context) {
    final filesAsync = ref.watch(fileListProvider);

    return Scaffold(
      backgroundColor: AppTheme.background,
      body: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(),
            const SizedBox(height: 32),
            if (_uploadError != null)
              _buildUploadError(_uploadError!),
            Expanded(
              child: filesAsync.when(
                data: (files) => _buildFileList(files),
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => _buildError(e.toString()),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('File Manager',
                style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 4),
            const Text(
              'All files are encrypted with AES-256-GCM',
              style: TextStyle(color: AppTheme.textMuted, fontSize: 14),
            ),
          ],
        ),
        const Spacer(),
        _buildUploadButton(),
      ],
    );
  }

  Widget _buildUploadButton() {
    return SizedBox(
      height: 44,
      child: ElevatedButton.icon(
        onPressed: _uploading ? null : _pickAndUpload,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppTheme.primary,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        ),
        icon: _uploading
            ? const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
              )
            : const Icon(Icons.upload_outlined, size: 18),
        label: Text(_uploading ? 'Uploading...' : 'Upload File'),
      ),
    );
  }

  Widget _buildUploadError(String error) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.error.withOpacity(0.1),
        borderRadius: AppTheme.radiusMd,
        border: Border.all(color: AppTheme.error.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: AppTheme.error, size: 16),
          const SizedBox(width: 8),
          Expanded(child: Text(error, style: const TextStyle(color: AppTheme.error, fontSize: 13))),
          IconButton(
            icon: const Icon(Icons.close, size: 16, color: AppTheme.error),
            onPressed: () => setState(() => _uploadError = null),
          ),
        ],
      ),
    );
  }

  Widget _buildFileList(List<FileModel> files) {
    if (files.isEmpty) {
      return _buildEmptyState();
    }

    return Column(
      children: [
        // Table header
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: AppTheme.surfaceElevated,
            borderRadius: const BorderRadius.only(
              topLeft: Radius.circular(10),
              topRight: Radius.circular(10),
            ),
            border: Border.all(color: AppTheme.border),
          ),
          child: const Row(
            children: [
              SizedBox(width: 40),
              Expanded(flex: 4, child: Text('Name', style: TextStyle(color: AppTheme.textMuted, fontSize: 12, fontWeight: FontWeight.w600))),
              Expanded(flex: 2, child: Text('Type', style: TextStyle(color: AppTheme.textMuted, fontSize: 12, fontWeight: FontWeight.w600))),
              Expanded(flex: 1, child: Text('Size', style: TextStyle(color: AppTheme.textMuted, fontSize: 12, fontWeight: FontWeight.w600))),
              Expanded(flex: 2, child: Text('Uploaded', style: TextStyle(color: AppTheme.textMuted, fontSize: 12, fontWeight: FontWeight.w600))),
              SizedBox(width: 120),
            ],
          ),
        ),
        Expanded(
          child: ListView.separated(
            itemCount: files.length,
            separatorBuilder: (_, __) => const SizedBox(height: 1),
            itemBuilder: (context, index) => _buildFileRow(files[index]),
          ),
        ),
      ],
    );
  }

  Widget _buildFileRow(FileModel file) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        border: Border(
          left: BorderSide(color: AppTheme.border),
          right: BorderSide(color: AppTheme.border),
          bottom: BorderSide(color: AppTheme.border),
        ),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 40,
            child: Text(file.fileIcon, style: const TextStyle(fontSize: 20)),
          ),
          Expanded(
            flex: 4,
            child: Text(
              file.originalFilename,
              style: const TextStyle(
                color: AppTheme.textPrimary,
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          Expanded(
            flex: 2,
            child: _buildMimeChip(file.mimeType),
          ),
          Expanded(
            flex: 1,
            child: Text(
              file.sizeFormatted,
              style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13),
            ),
          ),
          Expanded(
            flex: 2,
            child: Text(
              DateFormat('MMM d, y').format(file.createdAt),
              style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13),
            ),
          ),
          SizedBox(
            width: 120,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                IconButton(
                  icon: const Icon(Icons.visibility_outlined, size: 18, color: AppTheme.primary),
                  tooltip: 'View securely',
                  onPressed: () => context.go('/viewer/${file.id}'),
                ),
                IconButton(
                  icon: const Icon(Icons.delete_outline, size: 18, color: AppTheme.error),
                  tooltip: 'Delete',
                  onPressed: () => _confirmDelete(file),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMimeChip(String mimeType) {
    String label;
    Color color;
    if (mimeType == 'application/pdf') {
      label = 'PDF';
      color = AppTheme.error;
    } else if (mimeType.startsWith('image/')) {
      label = mimeType.split('/').last.toUpperCase();
      color = AppTheme.accent;
    } else {
      label = 'FILE';
      color = AppTheme.textMuted;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: AppTheme.primary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Icon(Icons.cloud_upload_outlined,
                color: AppTheme.primary, size: 40),
          ),
          const SizedBox(height: 24),
          Text('No files uploaded yet',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          const Text(
            'Upload PDF, PNG, or JPG files.\nAll files are encrypted with AES-256-GCM.',
            style: TextStyle(color: AppTheme.textMuted, fontSize: 14),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: _pickAndUpload,
            icon: const Icon(Icons.upload_outlined),
            label: const Text('Upload First File'),
          ),
        ],
      ),
    );
  }

  Widget _buildError(String message) {
    return Center(
      child: Text(message, style: const TextStyle(color: AppTheme.error)),
    );
  }

  Future<void> _pickAndUpload() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'png', 'jpg', 'jpeg'],
      withData: true,
    );

    if (result == null || result.files.isEmpty) return;

    final file = result.files.first;
    if (file.bytes == null) return;

    setState(() { _uploading = true; _uploadError = null; });

    try {
      final accessToken = ref.read(accessTokenProvider);
      if (accessToken == null) throw Exception('Not authenticated');

      final fileApi = ref.read(fileApiProvider);
      final multipartFile = MultipartFile.fromBytes(
        file.bytes!,
        filename: file.name,
      );

      await fileApi.uploadFile(accessToken, multipartFile);
      ref.invalidate(fileListProvider);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${file.name} uploaded and encrypted'),
            backgroundColor: AppTheme.success,
          ),
        );
      }
    } on DioException catch (e) {
      final data = e.response?.data as Map<String, dynamic>?;
      setState(() =>
          _uploadError = data?['error']?['message'] ?? 'Upload failed');
    } catch (e) {
      setState(() => _uploadError = 'Upload failed: ${e.toString()}');
    } finally {
      setState(() => _uploading = false);
    }
  }

  Future<void> _confirmDelete(FileModel file) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surface,
        shape: RoundedRectangleBorder(
            borderRadius: AppTheme.radiusLg,
            side: const BorderSide(color: AppTheme.border)),
        title: const Text('Delete File', style: TextStyle(color: AppTheme.textPrimary)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Are you sure you want to permanently delete:',
              style: const TextStyle(color: AppTheme.textSecondary),
            ),
            const SizedBox(height: 8),
            Text(
              file.originalFilename,
              style: const TextStyle(
                  color: AppTheme.textPrimary, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            const Text(
              'This action cannot be undone. The encrypted file will be permanently removed.',
              style: TextStyle(color: AppTheme.textMuted, fontSize: 13),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.error),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        final accessToken = ref.read(accessTokenProvider);
        if (accessToken == null) return;
        final fileApi = ref.read(fileApiProvider);
        await fileApi.deleteFile(file.id, accessToken);
        ref.invalidate(fileListProvider);
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Failed to delete file'),
              backgroundColor: AppTheme.error,
            ),
          );
        }
      }
    }
  }
}
