import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/theme/app_theme.dart';
import '../../core/api/api_client.dart';
import '../../core/providers/auth_provider.dart';
import 'package:dio/dio.dart';

class AdminScreen extends ConsumerStatefulWidget {
  const AdminScreen({super.key});

  @override
  ConsumerState<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends ConsumerState<AdminScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<dynamic> _users = [];
  List<dynamic> _auditLogs = [];
  Map<String, dynamic> _stats = {};
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final dio = ref.read(dioProvider);
      final accessToken = ref.read(accessTokenProvider);
      dio.options.headers['Authorization'] = 'Bearer $accessToken';

      final results = await Future.wait([
        dio.get('/api/admin/users'),
        dio.get('/api/admin/audit'),
        dio.get('/api/admin/stats'),
      ]);

      setState(() {
        _users = results[0].data['data']['users'] as List<dynamic>;
        _auditLogs = results[1].data['data']['logs'] as List<dynamic>;
        _stats = results[2].data['data'] as Map<String, dynamic>;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(),
            const SizedBox(height: 24),
            _buildStatCards(),
            const SizedBox(height: 24),
            _buildTabBar(),
            const SizedBox(height: 16),
            Expanded(child: _loading ? _buildLoading() : _buildTabContent()),
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
            Row(
              children: [
                const Icon(Icons.admin_panel_settings_outlined,
                    color: AppTheme.warning, size: 24),
                const SizedBox(width: 10),
                Text('Admin Panel',
                    style: Theme.of(context).textTheme.headlineMedium),
              ],
            ),
            const SizedBox(height: 4),
            const Text(
              'System oversight and audit management',
              style: TextStyle(color: AppTheme.textMuted, fontSize: 14),
            ),
          ],
        ),
        const Spacer(),
        OutlinedButton.icon(
          onPressed: _loadData,
          icon: const Icon(Icons.refresh, size: 16),
          label: const Text('Refresh'),
          style: OutlinedButton.styleFrom(
            foregroundColor: AppTheme.textSecondary,
            side: const BorderSide(color: AppTheme.border),
          ),
        ),
      ],
    );
  }

  Widget _buildStatCards() {
    final statsData = [
      ('Total Users', _stats['totalUsers']?.toString() ?? '—', Icons.people_outline, AppTheme.primary),
      ('Total Files', _stats['totalFiles']?.toString() ?? '—', Icons.folder_outline, AppTheme.secondary),
      ('Audit Events', _auditLogs.length.toString(), Icons.history_outlined, AppTheme.accent),
      ('Security Status', 'Active', Icons.security_outlined, AppTheme.success),
    ];

    return Row(
      children: statsData.map((s) => Expanded(
        child: Container(
          margin: const EdgeInsets.only(right: 16),
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: AppTheme.surfaceElevated,
            borderRadius: AppTheme.radiusMd,
            border: Border.all(color: AppTheme.border),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: s.$4.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(s.$3, color: s.$4, size: 20),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(s.$2,
                      style: const TextStyle(
                          color: AppTheme.textPrimary,
                          fontSize: 20,
                          fontWeight: FontWeight.w700)),
                  Text(s.$1,
                      style: const TextStyle(
                          color: AppTheme.textMuted, fontSize: 12)),
                ],
              ),
            ],
          ),
        ),
      )).toList(),
    );
  }

  Widget _buildTabBar() {
    return TabBar(
      controller: _tabController,
      tabs: const [
        Tab(text: 'Users'),
        Tab(text: 'Audit Log'),
        Tab(text: 'Activity'),
      ],
      labelColor: AppTheme.primary,
      unselectedLabelColor: AppTheme.textMuted,
      indicatorColor: AppTheme.primary,
      dividerColor: AppTheme.border,
    );
  }

  Widget _buildLoading() {
    return const Center(child: CircularProgressIndicator());
  }

  Widget _buildTabContent() {
    return TabBarView(
      controller: _tabController,
      children: [
        _buildUsersTab(),
        _buildAuditTab(),
        _buildActivityTab(),
      ],
    );
  }

  Widget _buildUsersTab() {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: AppTheme.radiusMd,
        border: Border.all(color: AppTheme.border),
      ),
      child: ListView.separated(
        itemCount: _users.length,
        separatorBuilder: (_, __) => const Divider(color: AppTheme.border, height: 1),
        itemBuilder: (context, i) {
          final user = _users[i] as Map<String, dynamic>;
          return ListTile(
            leading: CircleAvatar(
              backgroundColor: AppTheme.primary.withOpacity(0.2),
              child: Text(
                (user['email'] as String? ?? '?')[0].toUpperCase(),
                style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.w700),
              ),
            ),
            title: Text(user['email'] as String? ?? '—',
                style: const TextStyle(color: AppTheme.textPrimary, fontSize: 14)),
            subtitle: Text(
              'Last login: ${user['lastLoginAt'] != null ? DateFormat('MMM d, y HH:mm').format(DateTime.parse(user['lastLoginAt'] as String)) : 'Never'}',
              style: const TextStyle(color: AppTheme.textMuted, fontSize: 12),
            ),
            trailing: _buildRoleBadge(user['role'] as String? ?? 'USER'),
          );
        },
      ),
    );
  }

  Widget _buildRoleBadge(String role) {
    final color = role == 'ADMIN' ? AppTheme.warning : AppTheme.primary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        role,
        style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600),
      ),
    );
  }

  Widget _buildAuditTab() {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: AppTheme.radiusMd,
        border: Border.all(color: AppTheme.border),
      ),
      child: ListView.separated(
        itemCount: _auditLogs.length,
        separatorBuilder: (_, __) => const Divider(color: AppTheme.border, height: 1),
        itemBuilder: (context, i) {
          final log = _auditLogs[i] as Map<String, dynamic>;
          final action = log['action'] as String? ?? '—';
          final success = log['success'] as bool? ?? false;
          final ts = log['timestamp'] as String?;
          final user = log['userId'] as Map<String, dynamic>?;

          return ListTile(
            leading: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: success
                    ? AppTheme.success.withOpacity(0.1)
                    : AppTheme.error.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                success ? Icons.check_circle_outline : Icons.cancel_outlined,
                color: success ? AppTheme.success : AppTheme.error,
                size: 18,
              ),
            ),
            title: Text(action,
                style: const TextStyle(
                    color: AppTheme.textPrimary,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    fontFamily: 'monospace')),
            subtitle: Text(
              '${user?['email'] ?? 'Anonymous'} · ${ts != null ? DateFormat('MMM d, y HH:mm:ss').format(DateTime.parse(ts)) : '—'}',
              style: const TextStyle(color: AppTheme.textMuted, fontSize: 12),
            ),
          );
        },
      ),
    );
  }

  Widget _buildActivityTab() {
    final recent = _stats['recentActivity'] as List<dynamic>? ?? [];
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surfaceElevated,
        borderRadius: AppTheme.radiusMd,
        border: Border.all(color: AppTheme.border),
      ),
      child: recent.isEmpty
          ? const Center(
              child: Text('No recent activity',
                  style: TextStyle(color: AppTheme.textMuted)))
          : ListView.separated(
              itemCount: recent.length,
              separatorBuilder: (_, __) => const Divider(color: AppTheme.border, height: 1),
              itemBuilder: (context, i) {
                final log = recent[i] as Map<String, dynamic>;
                return ListTile(
                  leading: const Icon(Icons.timeline, color: AppTheme.accent, size: 20),
                  title: Text(log['action'] as String? ?? '—',
                      style: const TextStyle(color: AppTheme.textPrimary, fontSize: 13)),
                  trailing: Text(
                    log['timestamp'] != null
                        ? DateFormat('HH:mm:ss').format(DateTime.parse(log['timestamp'] as String))
                        : '',
                    style: const TextStyle(color: AppTheme.textMuted, fontSize: 11),
                  ),
                );
              },
            ),
    );
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }
}
