import 'package:material_ui/material_ui.dart';

import '../../../core/api/models.dart';
import '../../../core/env.dart';
import '../../../core/format.dart';

/// 「看见」流的一张卡片。
///
/// 移动端的排版取舍：
/// - 卡片独立成块（圆角 14 + 1px 描边 + 留白），不用网页那种贯穿全宽的分隔线；
/// - 标题 16/w600 最多两行，摘要 12.5 两行，元信息从 11.5 抬到 12 —— 手机上一臂距离读得清；
/// - 有封面右侧 92×92 圆角缩略图，没有就不留空位（不硬凑占位图）。
class TopicCard extends StatelessWidget {
  const TopicCard({super.key, required this.topic, required this.onTap});

  final TopicSummary topic;
  final VoidCallback onTap;

  /// 封面在手机上按 92 方图裁，和两行标题 + 元信息的高度接近。
  static const _coverSize = 92.0;

  @override
  Widget build(BuildContext context) {
    final cover = topic.coverImage;

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
            padding: const EdgeInsets.fromLTRB(14, 13, 14, 13),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: _buildBody()),
                if (cover != null && cover.isNotEmpty) ...[
                  const SizedBox(width: 12),
                  _Cover(url: cover, size: _coverSize),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBody() {
    final category = topic.category;
    final summary = topic.summary.trim();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (category != null || topic.isPinned || topic.isFeatured)
          Padding(
            padding: const EdgeInsets.only(bottom: 7),
            child: Row(
              children: [
                if (category != null) ...[
                  Container(
                    width: 5,
                    height: 5,
                    decoration: BoxDecoration(
                      color: _categoryColor(category.color),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
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
            height: 1.42,
            fontWeight: FontWeight.w600,
            color: Color(Env.text),
          ),
        ),
        if (summary.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(
            summary,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 12.5,
              height: 1.55,
              color: Color(0xFF8E97A4),
            ),
          ),
        ],
        const SizedBox(height: 11),
        Row(
          children: [
            _Avatar(author: topic.author),
            const SizedBox(width: 7),
            Flexible(
              child: Text(
                topic.author.displayName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12, color: Color(0xFF9AA3B0)),
              ),
            ),
            const SizedBox(width: 6),
            Text(
              '·',
              style: TextStyle(fontSize: 12, color: const Color(Env.muted).withValues(alpha: 0.5)),
            ),
            const SizedBox(width: 6),
            Text(
              relativeTime(topic.displayTime),
              style: const TextStyle(fontSize: 11.5, color: Color(0xFF737D8B)),
            ),
            const Spacer(),
            _Metric(icon: Icons.mode_comment_outlined, value: topic.replyCount),
            const SizedBox(width: 12),
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
  const _Cover({required this.url, required this.size});

  final String url;
  final double size;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(10),
      child: Image.network(
        url,
        width: size,
        height: size,
        fit: BoxFit.cover,
        // 图片挂了不影响卡片：留一块底色，不显示报错图标
        errorBuilder: (_, _, _) => _placeholder(),
        loadingBuilder: (_, child, progress) => progress == null ? child : _placeholder(),
      ),
    );
  }

  Widget _placeholder() => Container(
        width: size,
        height: size,
        color: const Color(Env.panel),
      );
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.author});

  final Author author;

  static const _size = 18.0;

  @override
  Widget build(BuildContext context) {
    final url = author.avatarUrl;
    if (url != null && url.isNotEmpty) {
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

  Widget _fallback() => Container(
        width: _size,
        height: _size,
        alignment: Alignment.center,
        decoration: const BoxDecoration(
          color: Color(Env.panel),
          shape: BoxShape.circle,
        ),
        child: Text(
          author.initial,
          style: const TextStyle(fontSize: 9.5, color: Color(Env.muted)),
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
        Icon(icon, size: 13, color: const Color(0xFF737D8B)),
        const SizedBox(width: 3.5),
        Text(
          compactCount(value),
          style: const TextStyle(fontSize: 11.5, color: Color(0xFF737D8B)),
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
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
      decoration: BoxDecoration(
        color: const Color(0x1F8AB4F8),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 9.5,
          height: 1.4,
          fontWeight: FontWeight.w600,
          color: Color(Env.blue),
        ),
      ),
    );
  }
}
