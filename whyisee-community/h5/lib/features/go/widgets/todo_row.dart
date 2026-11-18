import 'package:material_ui/material_ui.dart';

import '../../../core/api/models.dart';
import '../../../core/env.dart';
import '../../../core/format.dart';

/// 「我该做的事」的一行。
///
/// 和「看见」的卡片是两种东西：这里第一行说的是**谁做了什么**（人的动作），
/// 标题只是被涉及的对象，所以头像比封面重要、时间比摘要重要。
class TodoRow extends StatelessWidget {
  const TodoRow({
    super.key,
    required this.item,
    required this.onTap,
  });

  final TodoItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final accent = _accent(item.kind);

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 11, 14, 11),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _Leading(item: item, accent: accent),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      if (item.unread) ...[
                        Container(
                          width: 5,
                          height: 5,
                          margin: const EdgeInsets.only(right: 6),
                          decoration: BoxDecoration(color: accent, shape: BoxShape.circle),
                        ),
                      ],
                      Expanded(
                        child: Text(
                          item.reason,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 13.5,
                            height: 1.3,
                            fontWeight: FontWeight.w600,
                            color: Color(Env.text),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        relativeTime(item.at),
                        style: const TextStyle(fontSize: 10.5, height: 1.3, color: Color(0xFF5F6875)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    item.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12, height: 1.35, color: Color(0xFF8B95A3)),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            _ActionPill(label: item.actionLabel, accent: accent),
          ],
        ),
      ),
    );
  }

  static Color _accent(String kind) => switch (kind) {
        'review' => const Color(0xFFF3C969),
        'followed' => const Color(0xFF94A3B8),
        _ => const Color(0xFF8AB4F8),
      };
}

/// 头像：任务是图标，其余是说话的人。没有头像退回首字母。
class _Leading extends StatelessWidget {
  const _Leading({required this.item, required this.accent});

  final TodoItem item;
  final Color accent;

  static const _size = 32.0;

  @override
  Widget build(BuildContext context) {
    if (item.kind == 'review') {
      return Container(
        width: _size,
        height: _size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: accent.withValues(alpha: 0.14),
          shape: BoxShape.circle,
        ),
        child: Icon(Icons.inbox_outlined, size: 16, color: accent),
      );
    }

    final url = absoluteImageUrl(item.actorAvatarUrl);
    if (url != null) {
      return ClipOval(
        child: Image.network(
          url,
          width: _size,
          height: _size,
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) => _fallback(),
        ),
      );
    }
    return _fallback();
  }

  Widget _fallback() {
    final name = (item.actorName ?? '').trim();
    final initial = name.isEmpty ? '·' : name.substring(0, 1).toUpperCase();

    return Container(
      width: _size,
      height: _size,
      alignment: Alignment.center,
      decoration: const BoxDecoration(color: Color(Env.panel), shape: BoxShape.circle),
      child: Text(
        initial,
        style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(Env.muted)),
      ),
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
      padding: const EdgeInsets.symmetric(horizontal: 10),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.13),
        borderRadius: BorderRadius.circular(13),
        border: Border.all(color: accent.withValues(alpha: 0.3)),
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
