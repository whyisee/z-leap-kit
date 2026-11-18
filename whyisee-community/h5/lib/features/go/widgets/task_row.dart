import 'package:material_ui/material_ui.dart';

import '../../../core/api/models.dart';
import '../../../core/env.dart';
import '../../../core/format.dart';

/// 参与项的类型色：扫一眼就知道这是「该回答」「该点评」还是「该领任务」。
Color participationAccent(String targetType) => switch (targetType) {
      'question' || 'topic' => const Color(0xFF8AB4F8),
      'community_task' => const Color(0xFFF3C969),
      'project' => const Color(0xFF66D08C),
      'resource' => const Color(0xFFA78BFA),
      'review_needed' => const Color(0xFFF0A868),
      'stale_content' => const Color(0xFF94A3B8),
      _ => const Color(0xFF8AB4F8),
    };

/// 任务台的一行。
///
/// 和「看见」的卡片刻意做成两种东西：这里不做摘要、不做封面、不做大标题，
/// 一行标题 + 一行「为什么找你」，右侧一个动作按钮，目的是让人快速扫完就动手。
class TaskRow extends StatelessWidget {
  const TaskRow({
    super.key,
    required this.item,
    required this.onTap,
  });

  final ParticipationItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final accent = participationAccent(item.targetType);

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 10, 14, 10),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // 左侧竖条：类型色，比图标省地方，又能一眼分出类型
            Container(
              width: 2.5,
              height: 32,
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.75),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13.5,
                      height: 1.35,
                      fontWeight: FontWeight.w600,
                      color: Color(Env.text),
                    ),
                  ),
                  const SizedBox(height: 4),
                  _subLine(accent),
                ],
              ),
            ),
            const SizedBox(width: 10),
            _ActionPill(
              label: item.actionLabel,
              accent: const Color(Env.blue),
            ),
          ],
        ),
      ),
    );
  }

  /// 第二行：分类 → 计数 → 推荐理由（理由放最后，截断也不丢关键信息）。
  ///
  /// 不再重复类型名——组头已经写了「待回答 / 求反馈」，行里再说一遍是啰嗦。
  Widget _subLine(Color accent) {
    final meta = <String>[
      if (item.category != null && item.category!.name.isNotEmpty) item.category!.name,
      if (item.replyCount != null) '${compactCount(item.replyCount!)} 回复',
      if (item.viewCount != null) '${compactCount(item.viewCount!)} 浏览',
      if (item.submissionCount != null) '${compactCount(item.submissionCount!)} 提交',
      if (item.rewardLabel != null && item.rewardLabel!.isNotEmpty) '奖励 ${item.rewardLabel}',
    ];

    return Row(
      children: [
        if (meta.isNotEmpty) ...[
          Text(
            meta.join(' · '),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 11,
              height: 1.2,
              fontWeight: FontWeight.w500,
              color: accent.withValues(alpha: 0.78),
            ),
          ),
        ],
        if (item.reason.trim().isNotEmpty) ...[
          if (meta.isNotEmpty) ...[
            const SizedBox(width: 5),
            Text(
              '·',
              style: TextStyle(fontSize: 11, color: const Color(Env.muted).withValues(alpha: 0.45)),
            ),
            const SizedBox(width: 5),
          ],
          // 理由让位给元信息：空间不够时先截理由，不挤掉分类和计数
          Flexible(
            child: Text(
              item.reason.trim(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 11, height: 1.2, color: Color(0xFF5F6875)),
            ),
          ),
        ],
      ],
    );
  }
}

class _ActionPill extends StatelessWidget {
  const _ActionPill({required this.label, required this.accent});

  final String label;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 26,
      padding: const EdgeInsets.symmetric(horizontal: 11),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(13),
        border: Border.all(color: accent.withValues(alpha: 0.32)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11.5,
          height: 1.1,
          fontWeight: FontWeight.w700,
          color: accent,
        ),
      ),
    );
  }
}
