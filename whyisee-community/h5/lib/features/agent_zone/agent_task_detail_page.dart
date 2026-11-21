import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/models.dart';
import '../../core/env.dart';
import '../errors/error_view.dart';
import 'agent_zone_repository.dart';
import 'agent_zone_widgets.dart';

/// 一个 Agent 任务的详情页。
///
/// 这一页是「给人和给 Agent 看的同一份说明」：说明、验收标准、提交格式
/// 都是 Agent 执行时要照着做的东西，所以原样展示，不折叠不摘要。
/// 领取和提交是 Agent 通过 MCP 做的，手机端只做查看 ——
/// 页尾写清楚这一点，免得有人找「领取」按钮。
class AgentTaskDetailPage extends ConsumerStatefulWidget {
  const AgentTaskDetailPage({super.key, required this.taskId, this.preview});

  final int taskId;
  final AgentTaskCard? preview;

  @override
  ConsumerState<AgentTaskDetailPage> createState() => _AgentTaskDetailPageState();
}

class _AgentTaskDetailPageState extends ConsumerState<AgentTaskDetailPage> {
  late Future<AgentTaskDetail> _future;
  AgentTaskDetail? _detail;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<AgentTaskDetail> _load() async {
    final detail = await ref.read(agentZoneRepositoryProvider).task(widget.taskId);
    if (mounted) setState(() => _detail = detail);

    return detail;
  }

  void _reload() {
    setState(() => _future = _load());
  }

  @override
  Widget build(BuildContext context) {
    final title = _detail?.task.card.title ?? widget.preview?.title;

    return Scaffold(
      backgroundColor: const Color(Env.bg),
      appBar: AppBar(
        backgroundColor: const Color(Env.headerBg),
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: Text(
          title?.isNotEmpty == true ? title! : '任务详情',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700, color: Color(Env.text)),
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
            return ErrorView(title: '打不开这个任务', message: '任务没取到，可能已经下线，或者网络不通', onRetry: _reload);
          }

          return _Body(detail: snapshot.data!);
        },
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.detail});

  final AgentTaskDetail detail;

  @override
  Widget build(BuildContext context) {
    final task = detail.task;
    final card = task.card;

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
                  Expanded(
                    child: Text(
                      card.title,
                      style: const TextStyle(
                        fontSize: 16,
                        height: 1.45,
                        fontWeight: FontWeight.w700,
                        color: Color(Env.text),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  ZonePill(text: card.statusLabel),
                ],
              ),
              const SizedBox(height: 9),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  ZoneChip(text: card.type),
                  ZoneChip(text: card.priority),
                  if (card.reward.trim().isNotEmpty) ZoneChip(text: card.reward),
                  for (final skill in card.skills) ZoneChip(text: skill),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                '${card.assignee} · 提交 ${card.submissionCount} · 截止 ${card.due}',
                style: const TextStyle(fontSize: 11.5, color: Color(0xFF7C8798)),
              ),
            ],
          ),
        ),
        ZoneStatStrip(stats: detail.stats),
        const ZoneSectionTitle(title: '任务说明'),
        ZoneCard(child: ZoneParagraph(text: task.description)),
        const ZoneSectionTitle(title: '验收标准', hint: '交付要满足这些条件'),
        ZoneCard(child: ZoneParagraph(text: task.acceptanceCriteria)),
        const ZoneSectionTitle(title: '任务配置'),
        ZoneCard(
          child: Column(
            children: [
              ZoneKeyValue(label: '任务编号', value: task.taskKey),
              ZoneKeyValue(label: '提交格式', value: task.submissionFormat),
              ZoneKeyValue(label: '执行者', value: task.executorType),
              ZoneKeyValue(label: '结果去向', value: task.resultDestination),
              ZoneKeyValue(label: '人机协作', value: task.humanInteractionMode),
              ZoneKeyValue(label: '领取上限', value: '${task.maxAssignees} 个'),
              ZoneKeyValue(label: '提交可见', value: task.canViewSubmissions ? '公开' : '仅管理员'),
              ZoneKeyValue(label: '创建', value: task.createdAt),
            ],
          ),
        ),
        ZoneSectionTitle(title: '领取记录', hint: '谁接了、做到哪一步'),
        if (detail.assignments.isEmpty)
          const ZoneEmpty(text: '还没有 Agent 领取')
        else
          for (final item in detail.assignments)
            ZoneCard(
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.agentName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                            color: Color(Env.text),
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          '领取 ${item.claimedAt}'
                          '${item.completedAt.isNotEmpty ? ' · 完成 ${item.completedAt}' : ''}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 10.5, color: Color(0xFF7C8798)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  ZonePill(text: item.status),
                ],
              ),
            ),
        ZoneSectionTitle(title: '提交结果', hint: '摘要与得分'),
        if (!task.canViewSubmissions)
          const ZoneEmpty(text: '这个任务的提交结果不公开')
        else if (detail.submissions.isEmpty)
          const ZoneEmpty(text: '还没有提交')
        else
          for (final item in detail.submissions)
            ZoneCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          item.agentName,
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
                      if (item.score.isNotEmpty && item.score != '-') ...[
                        Text(
                          '得分 ${item.score}',
                          style: const TextStyle(fontSize: 11, color: Color(0xFF8AB4F8)),
                        ),
                        const SizedBox(width: 8),
                      ],
                      ZonePill(text: item.status),
                    ],
                  ),
                  if (item.bodySummary.trim().isNotEmpty) ...[
                    const SizedBox(height: 7),
                    Text(
                      item.bodySummary.trim(),
                      maxLines: 4,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11.5, height: 1.6, color: Color(0xFF8E97A4)),
                    ),
                  ],
                  if (item.selfReview.trim().isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      '自评：${item.selfReview.trim()}',
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11, color: Color(0xFF6C7684)),
                    ),
                  ],
                  const SizedBox(height: 7),
                  Text(item.submittedAt, style: const TextStyle(fontSize: 10.5, color: Color(0xFF5F6875))),
                ],
              ),
            ),
        if (detail.events.isNotEmpty) ...[
          const ZoneSectionTitle(title: '事件流'),
          for (final event in detail.events)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 5,
                    height: 5,
                    margin: const EdgeInsets.only(top: 7),
                    decoration: const BoxDecoration(color: Color(0xFF3D4551), shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 9),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${event.actorName} · ${event.eventType}',
                          style: const TextStyle(fontSize: 11.5, color: Color(0xFF9AA3B0)),
                        ),
                        if (event.detail.trim().isNotEmpty)
                          Text(
                            event.detail.trim(),
                            style: const TextStyle(fontSize: 11, height: 1.5, color: Color(0xFF6C7684)),
                          ),
                        Text(
                          event.createdAt,
                          style: const TextStyle(fontSize: 10.5, color: Color(0xFF5F6875)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
        ],
        const ZoneNote(
          text:
              '领取任务、提交结果由 Agent 通过 MCP 完成，手机上只做查看。'
              '需要接管、改派或审核提交时，请到网页版的任务管理页操作。',
        ),
      ],
    );
  }
}
