import 'package:material_ui/material_ui.dart';

import '../../../core/api/models.dart';
import '../../../core/env.dart';
import '../../../core/format.dart';

/// 「看见」流的一张卡片。
///
/// 信息密度按网页列表对齐：分类 + 标题 + 摘要 + 作者/时间/计数。
/// 有封面图时右侧放 76×76 缩略图，没有就不留空位（不硬凑占位图）。
class TopicCard extends StatelessWidget {
  const TopicCard({super.key, required this.topic, required this.onTap});

  final TopicSummary topic;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 13),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: Color(Env.line), width: 1)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: _buildBody()),
            if (topic.coverImage != null && topic.coverImage!.isNotEmpty) ...[
              const SizedBox(width: 12),
              _Cover(url: topic.coverImage!),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildBody() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (topic.category != null || topic.isPinned || topic.isFeatured)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(
              children: [
                if (topic.category != null) ...[
                  Container(
                    width: 5,
                    height: 5,
                    decoration: BoxDecoration(
                      color: _categoryColor(topic.category!.color),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 5),
                  Text(
                    topic.category!.name,
                    style: const TextStyle(fontSize: 11.5, color: Color(Env.muted)),
                  ),
                ],
                if (topic.isPinned) const _MiniTag(text: '置顶'),
                if (topic.isFeatured) const _MiniTag(text: '精选'),
              ],
            ),
          ),
        Text(
          topic.title,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            fontSize: 16,
            height: 1.4,
            fontWeight: FontWeight.w600,
            color: Color(Env.text),
          ),
        ),
        if (topic.summary.trim().isNotEmpty) ...[
          const SizedBox(height: 5),
          Text(
            topic.summary.trim(),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 12.5,
              height: 1.5,
              color: Color(Env.muted),
            ),
          ),
        ],
        const SizedBox(height: 9),
        Row(
          children: [
            _Avatar(author: topic.author),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                topic.author.displayName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 11.5, color: Color(Env.muted)),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              relativeTime(topic.displayTime),
              style: const TextStyle(fontSize: 11.5, color: Color(0xFF6E7887)),
            ),
            const SizedBox(width: 10),
            _Metric(icon: Icons.mode_comment_outlined, value: topic.replyCount),
            const SizedBox(width: 10),
            _Metric(icon: Icons.favorite_border, value: topic.likeCount),
          ],
        ),
      ],
    );
  }

  static Color _categoryColor(String? raw) {
    if (raw == null || raw.isEmpty) return const Color(Env.blue);
    final hex = raw.replaceAll('#', '');
    final value = int.tryParse(hex, radix: 16);
    if (value == null) return const Color(Env.blue);
    return Color(hex.length <= 6 ? 0xFF000000 | value : value);
  }
}

class _Cover extends StatelessWidget {
  const _Cover({required this.url});

  final String url;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: Image.network(
        url,
        width: 76,
        height: 76,
        fit: BoxFit.cover,
        // 图片挂了不影响卡片：留一块底色，不显示报错图标
        errorBuilder: (_, _, _) => Container(
          width: 76,
          height: 76,
          color: const Color(Env.panel),
        ),
        loadingBuilder: (_, child, progress) {
          if (progress == null) return child;
          return Container(width: 76, height: 76, color: const Color(Env.panel));
        },
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.author});

  final Author author;

  @override
  Widget build(BuildContext context) {
    final url = author.avatarUrl;
    if (url != null && url.isNotEmpty) {
      return ClipOval(
        child: Image.network(
          url,
          width: 16,
          height: 16,
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) => _fallback(),
        ),
      );
    }
    return _fallback();
  }

  Widget _fallback() => Container(
        width: 16,
        height: 16,
        alignment: Alignment.center,
        decoration: const BoxDecoration(
          color: Color(Env.panel),
          shape: BoxShape.circle,
        ),
        child: Text(
          author.initial,
          style: const TextStyle(fontSize: 9, color: Color(Env.muted)),
        ),
      );
}

class _Metric extends StatelessWidget {
  const _Metric({required this.icon, required this.value});

  final IconData icon;
  final int value;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12.5, color: const Color(0xFF6E7887)),
        const SizedBox(width: 3),
        Text(
          compactCount(value),
          style: const TextStyle(fontSize: 11.5, color: Color(0xFF6E7887)),
        ),
      ],
    );
  }
}

class _MiniTag extends StatelessWidget {
  const _MiniTag({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(left: 6),
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
      decoration: BoxDecoration(
        color: const Color(0x1F8AB4F8),
        borderRadius: BorderRadius.circular(3),
      ),
      child: Text(
        text,
        style: const TextStyle(fontSize: 9.5, color: Color(Env.blue), height: 1.4),
      ),
    );
  }
}
