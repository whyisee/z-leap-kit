import 'package:material_ui/material_ui.dart';

import '../../../core/env.dart';
import '../topic_entry.dart';

/// 正文上方的「来由条」：说明这篇是从哪条通知点开的，并给一个重新定位的入口。
///
/// 不做成常驻悬浮条：它只回答「我为什么在这儿」，看完就该让位给正文。
class EntryBanner extends StatelessWidget {
  const EntryBanner({
    super.key,
    required this.entry,
    required this.located,
    required this.hasTarget,
    required this.onLocate,
    required this.onDismiss,
  });

  final TopicEntry entry;

  /// 目标楼层当前是否在列表里（找不到时说明可能已删除）
  final bool located;

  /// 这条通知是否指向某个楼层；点赞这类没有楼层，就不给「跳到楼层」
  final bool hasTarget;

  final VoidCallback onLocate;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final hint = switch (true) {
      _ when !hasTarget => null,
      _ when located => '点这里看这条回复',
      _ => '这条回复可能已被删除',
    };

    return Container(
      decoration: const BoxDecoration(
        color: Color(0x148AB4F8),
        border: Border(bottom: BorderSide(color: Color(0x1F8AB4F8))),
      ),
      child: InkWell(
        onTap: hasTarget && located ? onLocate : null,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 8, 10),
          child: Row(
            children: [
              Container(
                width: 26,
                height: 26,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  color: Color(0x1F8AB4F8),
                  shape: BoxShape.circle,
                ),
                child: Icon(_icon, size: 14, color: const Color(Env.blue)),
              ),
              const SizedBox(width: 9),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      entry.headline,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12.5,
                        height: 1.35,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFFDCE4EE),
                      ),
                    ),
                    if (hint != null || entry.timeLabel.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          [
                            if (entry.timeLabel.isNotEmpty) entry.timeLabel,
                            ?hint,
                          ].join(' · '),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 11,
                            height: 1.3,
                            color: located || !hasTarget
                                ? const Color(0xFF7C8798)
                                : const Color(0xFFCC9A9A),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              if (hasTarget && located)
                Padding(
                  padding: const EdgeInsets.only(left: 4),
                  child: Text(
                    '定位',
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      color: const Color(Env.blue).withValues(alpha: 0.9),
                    ),
                  ),
                ),
              IconButton(
                onPressed: onDismiss,
                iconSize: 16,
                color: const Color(0xFF6E7887),
                tooltip: '收起',
                icon: const Icon(Icons.close),
              ),
            ],
          ),
        ),
      ),
    );
  }

  IconData get _icon => switch (entry.kind) {
        'reply' => Icons.chat_bubble_outline,
        'mention' => Icons.alternate_email,
        'like' => Icons.favorite_border,
        _ => Icons.campaign_outlined,
      };
}
