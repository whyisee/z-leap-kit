import 'package:material_ui/material_ui.dart';

import '../../../core/api/models.dart';
import '../../../core/env.dart';
import '../../../core/format.dart';

/// 一条回帖。
///
/// 内容走纯文本（服务端 HTML 已降级），不动不动就嵌 WebView——
/// 30 条回复就是 30 个 WebView，内存和首帧都受不了。
class PostTile extends StatelessWidget {
  const PostTile({
    super.key,
    required this.post,
    required this.floor,
    required this.onLike,
    this.likeBusy = false,
    this.highlighted = false,
  });

  final TopicPost post;
  final int floor;
  final VoidCallback onLike;
  final bool likeBusy;

  /// 从通知点进来时，把被回复的那一层标出来 —— 用户不必自己数楼层
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    final text = htmlToPlainText(post.contentHtml);

    return AnimatedContainer(
      duration: const Duration(milliseconds: 420),
      curve: Curves.easeOut,
      padding: const EdgeInsets.fromLTRB(16, 14, 12, 12),
      decoration: BoxDecoration(
        color: highlighted ? const Color(0x148AB4F8) : Colors.transparent,
        border: Border(
          // 左侧竖条常驻占位（透明的），高亮时不会把正文挤动 2.5px
          left: BorderSide(
            color: highlighted ? const Color(0xCC8AB4F8) : Colors.transparent,
            width: 2.5,
          ),
          bottom: const BorderSide(color: Color(Env.line), width: 1),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _Avatar(author: post.author),
              const SizedBox(width: 7),
              Flexible(
                child: Text(
                  post.author.displayName,
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
              Text(
                relativeTime(post.createdAt),
                style: const TextStyle(fontSize: 11.5, color: Color(0xFF6E7887)),
              ),
              const Spacer(),
              if (highlighted)
                Container(
                  margin: const EdgeInsets.only(right: 6),
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                  decoration: BoxDecoration(
                    color: const Color(0x268AB4F8),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: const Text(
                    '通知来源',
                    style: TextStyle(
                      fontSize: 9.5,
                      height: 1.3,
                      fontWeight: FontWeight.w700,
                      color: Color(Env.blue),
                    ),
                  ),
                ),
              Text(
                '#$floor',
                style: const TextStyle(fontSize: 11.5, color: Color(0xFF5C6675)),
              ),
              const SizedBox(width: 6),
              _LikeButton(
                liked: post.liked,
                count: post.likeCount,
                busy: likeBusy,
                onTap: onLike,
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            text.isEmpty ? '（内容为空）' : text,
            style: const TextStyle(
              fontSize: 14.5,
              height: 1.65,
              color: Color(0xFFDDE3EA),
            ),
          ),
        ],
      ),
    );
  }
}

class _LikeButton extends StatelessWidget {
  const _LikeButton({
    required this.liked,
    required this.count,
    required this.busy,
    required this.onTap,
  });

  final bool liked;
  final int count;
  final bool busy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = liked ? const Color(0xFFFF7A98) : const Color(0xFF6E7887);
    return InkWell(
      onTap: busy ? null : onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              liked ? Icons.favorite : Icons.favorite_border,
              size: 13.5,
              color: color,
            ),
            if (count > 0) ...[
              const SizedBox(width: 3),
              Text(
                compactCount(count),
                style: TextStyle(fontSize: 11.5, color: color),
              ),
            ],
          ],
        ),
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
          width: 22,
          height: 22,
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) => _fallback(),
        ),
      );
    }
    return _fallback();
  }

  Widget _fallback() => Container(
        width: 22,
        height: 22,
        alignment: Alignment.center,
        decoration: const BoxDecoration(
          color: Color(Env.panel),
          shape: BoxShape.circle,
        ),
        child: Text(
          author.initial,
          style: const TextStyle(fontSize: 10, color: Color(Env.muted)),
        ),
      );
}
