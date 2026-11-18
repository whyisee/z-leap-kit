import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/api_exception.dart';
import '../../core/api/models.dart';
import '../../core/env.dart';
import '../../core/format.dart';
import '../errors/error_view.dart';
import 'settings_repository.dart';
import 'widgets/settings_top_bar.dart';

/// 「设置 → Agent 设备」。
///
/// 网页版这一页的大头是「一条命令让 Agent 自己绑上来」，手机上跑终端命令
/// 本来就不现实，所以只保留能在这里做的事：看哪些设备绑着、解绑。
class SettingsAgentsPage extends ConsumerStatefulWidget {
  const SettingsAgentsPage({super.key});

  @override
  ConsumerState<SettingsAgentsPage> createState() => _SettingsAgentsPageState();
}

class _SettingsAgentsPageState extends ConsumerState<SettingsAgentsPage> {
  List<AgentDevice>? _devices;
  String? _error;
  bool _loading = true;
  int? _unbinding;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final devices = await ref.read(settingsRepositoryProvider).loadAgents();
      if (!mounted) return;
      setState(() {
        _devices = devices;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.statusCode == 404 ? '线上还没有设备接口，部署后可用。' : error.message;
        _loading = false;
      });
    }
  }

  Future<void> _unbind(AgentDevice device) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: const Color(Env.surface),
        title: const Text('解绑这台设备？', style: TextStyle(fontSize: 16)),
        content: Text(
          '「${device.deviceName}」的 token 会立即失效，之后要重新绑定才能写内容。',
          style: const TextStyle(fontSize: 13, height: 1.6),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: TextButton.styleFrom(foregroundColor: const Color(0xFFFF8A80)),
            child: const Text('解绑'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _unbinding = device.id);
    try {
      await ref.read(settingsRepositoryProvider).unbindAgent(device.id);
      if (!mounted) return;
      setState(() {
        _devices = [...?_devices]..removeWhere((item) => item.id == device.id);
        _unbinding = null;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _unbinding = null);
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.of(context).padding.top;
    final devices = _devices ?? const <AgentDevice>[];

    return Scaffold(
      backgroundColor: const Color(Env.bg),
      body: Column(
        children: [
          SettingsTopBar(
            topInset: topInset,
            title: 'Agent 设备',
            onBack: () => context.pop(),
            action: _loading
                ? null
                : IconButton(
                    onPressed: _load,
                    icon: const Icon(Icons.refresh, size: 18),
                    color: const Color(Env.muted),
                    visualDensity: VisualDensity.compact,
                  ),
          ),
          Expanded(child: _buildBody(devices)),
        ],
      ),
    );
  }

  Widget _buildBody(List<AgentDevice> devices) {
    if (_loading) return const Center(child: CircularProgressIndicator(strokeWidth: 2));

    if (_error != null) {
      return ErrorView(title: '打不开设备列表', message: _error!, onRetry: _load);
    }

    if (devices.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: 40),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.smart_toy_outlined, size: 32, color: Color(0xFF3A424F)),
              SizedBox(height: 12),
              Text(
                '还没有绑定设备',
                style: TextStyle(fontSize: 14, color: Color(Env.text)),
              ),
              SizedBox(height: 6),
              Text(
                '在电脑上按网页「Agent 设备」的说明绑定，绑好后会出现在这里。',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12.5, height: 1.6, color: Color(Env.muted)),
              ),
            ],
          ),
        ),
      );
    }

    return RefreshIndicator(
      color: const Color(Env.blue),
      backgroundColor: const Color(Env.surface),
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(0, 4, 0, 40),
        physics: const AlwaysScrollableScrollPhysics(),
        itemCount: devices.length,
        separatorBuilder: (context, index) => const Divider(
          height: 1,
          thickness: 1,
          indent: 16,
          endIndent: 16,
          color: Color(Env.line),
        ),
        itemBuilder: (context, index) {
          final device = devices[index];
          return _DeviceRow(
            device: device,
            busy: _unbinding == device.id,
            onUnbind: () => _unbind(device),
          );
        },
      ),
    );
  }
}

class _DeviceRow extends StatelessWidget {
  const _DeviceRow({
    required this.device,
    required this.busy,
    required this.onUnbind,
  });

  final AgentDevice device;
  final bool busy;
  final VoidCallback onUnbind;

  @override
  Widget build(BuildContext context) {
    final seen = device.lastSeenAt;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 12, 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: const Color(Env.surface),
              borderRadius: BorderRadius.circular(9),
              border: Border.all(color: const Color(0x0FFFFFFF)),
            ),
            child: const Icon(Icons.memory, size: 17, color: Color(Env.blue)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        device.deviceName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Color(Env.text),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                      decoration: BoxDecoration(
                        color: device.active ? const Color(0x1A38D39F) : const Color(0x14FFFFFF),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        device.active ? '有效' : '已停用',
                        style: TextStyle(
                          fontSize: 10,
                          color: device.active
                              ? const Color(0xFF38D39F)
                              : const Color(Env.muted),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  [
                    if (device.agentName.isNotEmpty) device.agentName,
                    seen == null ? '还没连过' : '${relativeTime(seen)}活跃',
                    if ((device.tokenPrefix ?? '').isNotEmpty) 'token ${device.tokenPrefix}…',
                  ].join(' · '),
                  maxLines: 2,
                  style: const TextStyle(fontSize: 11.5, height: 1.5, color: Color(Env.muted)),
                ),
              ],
            ),
          ),
          const SizedBox(width: 6),
          TextButton(
            onPressed: busy ? null : onUnbind,
            style: TextButton.styleFrom(
              foregroundColor: const Color(0xFFFF8A80),
              minimumSize: const Size(52, 34),
              padding: const EdgeInsets.symmetric(horizontal: 8),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: busy
                ? const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 1.8),
                  )
                : const Text('解绑', style: TextStyle(fontSize: 12.5)),
          ),
        ],
      ),
    );
  }
}
