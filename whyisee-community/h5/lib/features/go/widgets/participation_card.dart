import 'package:material_ui/material_ui.dart';

import '../../../core/api/models.dart';
import '../../../core/env.dart';
import '../../../core/format.dart';

/// 「出发」的一张参与卡。
///
/// 网页是「左正文 + 右统计栏」两列，手机宽度放不下两列，所以压成三层：
/// 类型/分类 → 标题 → 摘要 → 理由 →（统计 + 行动按钮）一行。
/// 类型徽章沿用网页的绿色语义，任务类单独用金色，扫一眼能分出「该我答」还是「该我领」。
class ParticipationCard extends StatelessWidget {
  const ParticipationCard({
    super.key,
    required this.item,
    required this.onTap,
  });

  final ParticipationItem item;
  final VoidCallback onTap;

  static const _green = Color(0xFF66D08C);
  static const _gold = Color(0xFFF3C969);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 5, 14, 5),
      child: Material(
        color: const Color(Env.surface),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: Color(0x0FFFFFFF)),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 13, 14, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildKicker(),
                const SizedBox(height: 8),
                Text(
                  item.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 15.5,
                    height: 1.4,
                    fontWeight: FontWeight.w600,
                    color: Color(Env.text),
                  ),
                ),
                if (item.summary.trim().isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    item.summary.trim(),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12.5,
                      height: 1.55,
                      color: Color(0xFF8E97A4),
                    ),
                  ),
                ],
                if (item.reason.trim().isNotEmpty) ...[
                  const SizedBox(height: 8),
                  _Reason(text: item.reason.trim()),
                ],
                const SizedBox(height: 11),
                _buildFooter(),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildKicker() {
    final accent = item.targetType == 'community_task' ? _gold : _green;
    final category = item.category;

    return Row(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: accent.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: accent.withValues(alpha: 0.24)),
          ),
          child: Text(
            item.typeLabel,
            style: TextStyle(
              fontSize: 11,
              height: 1.1,
              fontWeight: FontWeight.w900,
              color: accent,
            ),
          ),
        ),
        if (category != null && category.name.isNotEmpty) ...[
          const SizedBox(width: 7),
          Container(
            width: 5,
            height: 5,
            decoration: BoxDecoration(
              color: colorFromHex(category.color),
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              category.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 11.5,
                height: 1.2,
                fontWeight: FontWeight.w500,
                color: Color(Env.muted),
              ),
            ),
          ),
        ],
        const Spacer(),
        if (item.tags.isNotEmpty)
          Flexible(
            child: Text(
              item.tags.take(3).map((t) => '#${t.name}').join(' '),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.right,
              style: const TextStyle(fontSize: 11, color: Color(0xFF737D8B)),
            ),
          ),
      ],
    );
  }

  Widget _buildFooter() {
    final stats = <String>[
      if (item.replyCount != null) '${compactCount(item.replyCount!)} 回复',
      if (item.viewCount != null) '${compactCount(item.viewCount!)} 浏览',
      if (item.submissionCount != null) '${compactCount(item.submissionCount!)} 提交',
      if (item.rewardLabel != null && item.rewardLabel!.isNotEmpty)
        '奖励 ${item.rewardLabel}',
    ];

    return Row(
      children: [
        Expanded(
          child: Text(
            stats.join(' · '),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 11.5, color: Color(0xFF737D8B)),
          ),
        ),
        const SizedBox(width: 10),
        Container(
          height: 29,
          padding: const EdgeInsets.symmetric(horizontal: 13),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: const Color(0x2E8AB4F8),
            borderRadius: BorderRadius.circular(15),
            border: Border.all(color: const Color(0x448AB4F8)),
          ),
          child: Text(
            item.actionLabel,
            style: const TextStyle(
              fontSize: 12,
              height: 1.1,
              fontWeight: FontWeight.w700,
              color: Color(Env.blue),
            ),
          ),
        ),
      ],
    );
  }
}

/// 推荐理由：左侧一条短竖线，弱于摘要但不至于看不出。
class _Reason extends StatelessWidget {
  const _Reason({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 2,
          height: 13,
          margin: const EdgeInsets.only(top: 2, right: 7),
          decoration: BoxDecoration(
            color: const Color(0x3366D08C),
            borderRadius: BorderRadius.circular(1),
          ),
        ),
        Expanded(
          child: Text(
            text,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 11.5,
              height: 1.45,
              fontWeight: FontWeight.w600,
              color: Color(0xFF7F8896),
            ),
          ),
        ),
      ],
    );
  }
}
