import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/api/file_api.dart';
import '../../core/models/models.dart';

final _fileListProvider = FutureProvider.autoDispose<List<FileModel>>((ref) async {
  final accessToken = ref.watch(accessTokenProvider);
  if (accessToken == null) return [];
  final fileApi = ref.read(fileApiProvider);
  return fileApi.listFiles(accessToken);
});

/// Dashboard Screen
class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final filesAsync = ref.watch(_fileListProvider);

    return Scaffold(
      backgroundColor: AppTheme.background,
      body: Row(
        children: [
          _buildSidebar(context, ref, user),
          Expanded(
            child: Column(
              children: [
                _buildTopBar(context, ref, user),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildWelcome(context, user),
                        const SizedBox(height: 32),
                        filesAsync.when(
                          data: (files) => Column(
                            children: [
                              _buildStatCards(context, files),
                              const SizedBox(height: 32),
                              _buildRecentFiles(context, files),
                            ],
                          ),
                          loading: () => const Center(child: CircularProgressIndicator()),
                          error: (e, _) => _buildError(e.toString()),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSidebar(BuildContext context, WidgetRef ref, UserModel? user) {
    return Container(
      width: 240,
      color: AppTheme.surface,
      child: Column(
        children: [
          // Logo
          Container(
            padding: const EdgeInsets.all(24),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    gradient: AppTheme.primaryGradient,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.shield_outlined, color: Colors.white, size: 20),
                ),
                const SizedBox(width: 12),
                const Text(
                  'SecureLayer',
                  style: TextStyle(
                    color: AppTheme.textPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                  ),
                ),
              ],
            ),
          ),
          const Divider(color: AppTheme.border, height: 1),
          const SizedBox(height: 16),
          _buildNavItem(context, Icons.dashboard_outlined, 'Dashboard', '/dashboard', true),
          _buildNavItem(context, Icons.folder_outlined, 'Files', '/files', false),
          if (user?.isAdmin == true)
            _buildNavItem(context, Icons.admin_panel_settings_outlined, 'Admin', '/admin', false),
          const Spacer(),
          const Divider(color: AppTheme.border),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      radius: 18,
                      backgroundColor: AppTheme.primary.withOpacity(0.2),
                      child: Text(
                        (user?.email.isNotEmpty == true)
                            ? user!.email[0].toUpperCase()
                            : '?',
                        style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.w700),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            user?.email.split('@').first ?? '',
                            style: const TextStyle(
                              color: AppTheme.textPrimary,
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                          Container(
                            margin: const EdgeInsets.only(top: 2),
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: AppTheme.primary.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              user?.role ?? '',
                              style: const TextStyle(
                                color: AppTheme.primary,
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: TextButton.icon(
                    onPressed: () async {
                      await ref.read(authNotifierProvider.notifier).logout();
                      if (context.mounted) context.go('/login');
                    },
                    icon: const Icon(Icons.logout, size: 16, color: AppTheme.textMuted),
                    label: const Text('Sign out',
                        style: TextStyle(color: AppTheme.textMuted, fontSize: 13)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNavItem(
      BuildContext context, IconData icon, String label, String route, bool active) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      child: ListTile(
        leading: Icon(icon,
            color: active ? AppTheme.primary : AppTheme.textMuted, size: 20),
        title: Text(
          label,
          style: TextStyle(
            color: active ? AppTheme.primary : AppTheme.textSecondary,
            fontSize: 14,
            fontWeight: active ? FontWeight.w600 : FontWeight.w400,
          ),
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        tileColor: active ? AppTheme.primary.withOpacity(0.1) : null,
        onTap: () => context.go(route),
        dense: true,
      ),
    );
  }

  Widget _buildTopBar(BuildContext context, WidgetRef ref, UserModel? user) {
    return Container(
      height: 64,
      padding: const EdgeInsets.symmetric(horizontal: 32),
      decoration: const BoxDecoration(
        color: AppTheme.surface,
        border: Border(bottom: BorderSide(color: AppTheme.border)),
      ),
      child: Row(
        children: [
          const Spacer(),
          _buildSecurityIndicator(),
        ],
      ),
    );
  }

  Widget _buildSecurityIndicator() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: AppTheme.success.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppTheme.success.withOpacity(0.3)),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.lock_outline, color: AppTheme.success, size: 14),
          SizedBox(width: 6),
          Text(
            'End-to-end encrypted',
            style: TextStyle(
              color: AppTheme.success,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWelcome(BuildContext context, UserModel? user) {
    final hour = DateTime.now().hour;
    final greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    final name = user?.email.split('@').first ?? 'User';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '$greeting, $name 👋',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 4),
        const Text(
          'Your files are encrypted and secure',
          style: TextStyle(color: AppTheme.textSecondary, fontSize: 15),
        ),
      ],
    );
  }

  Widget _buildStatCards(BuildContext context, List<FileModel> files) {
    final totalSize = files.fold<int>(0, (sum, f) => sum + f.size);
    final sizeStr = totalSize < 1024 * 1024
        ? '${(totalSize / 1024).toStringAsFixed(1)} KB'
        : '${(totalSize / (1024 * 1024)).toStringAsFixed(1)} MB';

    final stats = [
      _StatData(
        label: 'Total Files',
        value: '${files.length}',
        icon: Icons.folder_outlined,
        color: AppTheme.primary,
      ),
      _StatData(
        label: 'Storage Used',
        value: sizeStr,
        icon: Icons.storage_outlined,
        color: AppTheme.secondary,
      ),
      _StatData(
        label: 'Encryption',
        value: 'AES-256-GCM',
        icon: Icons.lock_outline,
        color: AppTheme.success,
      ),
      _StatData(
        label: 'Access Control',
        value: 'Active',
        icon: Icons.security_outlined,
        color: AppTheme.accent,
      ),
    ];

    return GridView.count(
      crossAxisCount: 4,
      crossAxisSpacing: 16,
      mainAxisSpacing: 16,
      childAspectRatio: 1.8,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: stats.map(_buildStatCard).toList(),
    );
  }

  Widget _buildStatCard(_StatData stat) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: AppTheme.radiusMd,
        border: Border.all(color: AppTheme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: stat.color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(stat.icon, color: stat.color, size: 18),
              ),
              const Spacer(),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            stat.value,
            style: TextStyle(
              color: AppTheme.textPrimary,
              fontSize: 22,
              fontWeight: FontWeight.w700,
            ),
          ),
          Text(
            stat.label,
            style: const TextStyle(
              color: AppTheme.textMuted,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecentFiles(BuildContext context, List<FileModel> files) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Recent Files',
              style: TextStyle(
                color: AppTheme.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
            TextButton(
              onPressed: () => context.go('/files'),
              child: const Text('View all', style: TextStyle(color: AppTheme.primary)),
            ),
          ],
        ),
        const SizedBox(height: 16),
        if (files.isEmpty)
          _buildEmptyState()
        else
          ...files.take(5).map((f) => _buildFileRow(context, f)),
      ],
    );
  }

  Widget _buildEmptyState() {
    return Container(
      padding: const EdgeInsets.all(48),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: AppTheme.radiusLg,
        border: Border.all(color: AppTheme.border, style: BorderStyle.solid),
      ),
      child: Center(
        child: Column(
          children: [
            Icon(Icons.cloud_upload_outlined,
                color: AppTheme.textMuted, size: 48),
            const SizedBox(height: 16),
            const Text(
              'No files yet',
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 16, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            const Text(
              'Upload your first encrypted file to get started',
              style: TextStyle(color: AppTheme.textMuted, fontSize: 14),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFileRow(BuildContext context, FileModel file) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: AppTheme.radiusMd,
        border: Border.all(color: AppTheme.border),
      ),
      child: Row(
        children: [
          Text(file.fileIcon, style: const TextStyle(fontSize: 24)),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  file.originalFilename,
                  style: const TextStyle(
                    color: AppTheme.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  '${file.sizeFormatted} · ${DateFormat('MMM d, y').format(file.createdAt)}',
                  style: const TextStyle(color: AppTheme.textMuted, fontSize: 12),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: () => context.go('/viewer/${file.id}'),
            child: const Text('View', style: TextStyle(color: AppTheme.primary)),
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
}

class _StatData {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  const _StatData({required this.label, required this.value, required this.icon, required this.color});
}
