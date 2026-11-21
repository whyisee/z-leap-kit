import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/models.dart';
import '../../core/env.dart';
import '../errors/error_view.dart';
import 'agent_zone_repository.dart';
import 'agent_zone_widgets.dart';

/// 单个 Agent 的身份页。
///
/// 网页版是「左侧 Agent 列表 + 右侧详情」，手机上一屏放不下，所以列表点进来
/// 单独一页。四块内容按「他是谁 → 他跑得怎么样 → 他领过什么」排：
/// 身份与指标、设备、最近运行、任务履历。
class AgentDetailPage extends ConsumerStatefulWidget {
  const AgentDetailPage({super.key, required this.agentId, this.preview});

  final int agentId;

  /// 从列表点进来时带上的那张卡：详情还没回来就能先把名字显示出来，
  /// 避免加载期间标题是空的、返回时又跳一下。
  final AgentCard? preview;

  @override
  ConsumerState<AgentDetailPage> createState() => _AgentDetailPageState();
}

class _AgentDetailPageState extends ConsumerState<AgentDetailPage> {
  late Future<AgentDetail> _future;
  AgentDetail? _detail;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<AgentDetail> _load() async {
    final detail = await ref.read(agentZoneRepositoryProvider).agent(widget.agentId);
    if (mounted) setState(() => _detail = detail);

    return detail;
  }

  void _reload() {
    setState(() => _future = _load());
  }

  @override
  Widget build(BuildContext context) {
    final agent = _detail?.agent ?? widget.preview;

    return Scaffold(
      backgroundColor: const Color(Env.bg),
      appBar: AppBar(
        backgroundColor: const Color(Env.headerBg),
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: Text(
          agent?.name.isNotEmpty == true ? agent!.name : 'Agent',
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(Env.text)),
        ),
        iconTheme: const IconThemeData(color: Color(Env.muted)),
      ),
      body: FutureBuilder(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(
              child: SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2, color: Color(Env.blue)),
              ),
            );
          }

          if (snapshot.hasError || !snapshot.hasData) {
            return ErrorView(title: '打不开这个 Agent', message: '详情没取到，检查一下网络', onRetry: _reload);
          }

          return _Body(detail: snapshot.data!);
        },
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.detail});

  final AgentDetail detail;

  @override
  Widget build(BuildContext context) {
    final agent = detail.agent;

    return ListView(
      padding: const EdgeInsets.only(bottom: 32),
      children: [
        ZoneCard(
          margin: const EdgeInsets.fromLTRB(14, 14, 14, 4),
          padding: const EdgeInsets.fromLTRB(15, 15, 15, 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: const Color(0x1F8AB4F8),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      agent.initial,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Color(Env.blue),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          agent.name,
                          style: const TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                            color: Color(Env.text),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${agent.role} · ${agent.owner}',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 11.5, color: Color(0xFF7C8798)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  ZonePill(text: agent.status),
                ],
              ),
              if (agent.summary.trim().isNotEmpty) ...[
                const SizedBox(height: 12),
                ZoneParagraph(text: agent.summary.trim()),
              ],
              if (agent.skills.isNotEmpty) ...[
                const SizedBox(height: 12),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [for (final skill in agent.skills) ZoneChip(text: skill)],
                ),
              ],
              const SizedBox(height: 12),
              Text(
                agent.current.trim().isEmpty ? '当前没有在跑的任务' : '正在做：${agent.current}',
                style: const TextStyle(fontSize: 11.5, height: 1.5, color: Color(0xFF8E97A4)),
              ),
              const SizedBox(height: 4),
              Text(
                '最近活动 ${agent.lastActive}',
                style: const TextStyle(fontSize: 11, color: Color(0xFF5F6875)),
              ),
            ],
          ),
        ),
        ZoneStatStrip(stats: detail.stats),
        if (detail.devices.isNotEmpty) ...[
          const ZoneSectionTitle(title: '设备', hint: '接了哪几台机器'),
          for (final device in detail.devices)
            ZoneCard(
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          device.deviceName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Color(Env.text),
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          '最后在线 ${device.lastSeen}',
                          style: const TextStyle(fontSize: 11, color: Color(0xFF7C8798)),
                        ),
                      ],
                    ),
                  ),
                  ZonePill(text: device.status),
                ],
              ),
            ),
        ],
        const ZoneSectionTitle(title: '最近运行', hint: 'Skill 版本与产出质量'),
        if (detail.runs.isEmpty)
          const ZoneEmpty(text: '还没有运行记录')
        else
          for (final run in detail.runs.take(12))
            ZoneCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          run.skillVersion.isEmpty ? run.runKey : run.skillVersion,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                            color: Color(Env.text),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      ZonePill(text: run.status),
                      if (run.qualityScore.isNotEmpty && run.qualityScore != '-') ...[
                        const SizedBox(width: 6),
                        Text(
                          '质量 ${run.qualityScore}',
                          style: const TextStyle(fontSize: 11, color: Color(0xFF8AB4F8)),
                        ),
                      ],
                    ],
                  ),
                  if (run.outputSummary.trim().isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      run.outputSummary.trim(),
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11.5, height: 1.55, color: Color(0xFF8E97A4)),
                    ),
                  ],
                  const SizedBox(height: 7),
                  Text(run.createdAt, style: const TextStyle(fontSize: 10.5, color: Color(0xFF5F6875))),
                ],
              ),
            ),
        ZoneSectionTitle(title: '任务履历', hint: '点标题看任务详情'),
        if (detail.assignments.isEmpty)
          const ZoneEmpty(text: '还没领过任务')
        else
          for (final item in detail.assignments)
            ZoneCard(
              onTap: item.taskId > 0 ? () => context.push('/agent-zone/tasks/${item.taskId}') : null,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          item.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 13,
                            height: 1.4,
                            fontWeight: FontWeight.w600,
                            color: Color(Env.text),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      ZonePill(text: item.assignmentStatus),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${item.type} · 任务${item.taskStatus}'
                    '${item.submittedAt.isNotEmpty ? ' · 提交 ${item.submittedAt}' : ''}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11, color: Color(0xFF7C8798)),
                  ),
                ],
              ),
            ),
      ],
    );
  }
}
