import 'package:material_ui/material_ui.dart';

import '../../../core/api/models.dart';
import '../../../core/env.dart';
import '../../../core/format.dart';

/// 右下角竖排操作条，对齐网页 `.topic-floating-actions`。
///
/// 网页在 ≤720px 的实测参数：右侧 10px、底部 42px、每项 38×48、图标 18、
/// 数字 11px、透明底。这里按同样的尺寸做，操作顺序也一致：
/// AI（网页是 `.ai-tool-mark` 的方形标记）→ 作者（带关注角标）→ 喜欢 →
/// 收藏 → 回复 → 分享。
class FloatDock extends StatelessWidget {
  const FloatDock({
    super.key,
    required this.author,
    required this.interactions,
    required this.replyCount,
    required this.likeBusy,
    required this.followBusy,
    required this.onLike,
    required this.onBookmark,
    required this.onReply,
    required this.onShare,
    required this.onFollow,
    required this.onAi,
  });

  final Author author;
  final TopicInteractions interactions;
  final int replyCount;
  final bool likeBusy;
  final bool followBusy;
  final VoidCallback onLike;
  final VoidCallback onBookmark;
  final VoidCallback onReply;
  final VoidCallback onShare;
  final VoidCallback onFollow;
  final VoidCallback onAi;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _AiButton(onTap: onAi),
        const SizedBox(height: 10),
        _AuthorBubble(
          author: author,
          followed: interactions.followed,
          busy: followBusy,
          onFollow: onFollow,
        ),
        const SizedBox(height: 8),
        _DockAction(
          icon: interactions.liked ? Icons.favorite : Icons.favorite_border,
          color: interactions.liked ? const Color(0xFFFF7A98) : null,
          label: compactCount(interactions.likeCount),
          onTap: likeBusy ? null : onLike,
        ),
        _DockAction(
          icon: interactions.bookmarked ? Icons.bookmark : Icons.bookmark_border,
          color: interactions.bookmarked ? const Color(Env.blue) : null,
          label: compactCount(interactions.bookmarkCount),
          onTap: onBookmark,
        ),
        _DockAction(
          icon: Icons.mode_comment_outlined,
          label: compactCount(replyCount),
          onTap: onReply,
        ),
        _DockAction(
          icon: Icons.send_outlined,
          label: '分享',
          onTap: onShare,
        ),
      ],
    );
  }
}

/// AI 入口：网页是 34px 方形 `AI` 标记，这里做成同尺寸的圆形按钮。
class _AiButton extends StatelessWidget {
  const _AiButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: 38,
        height: 38,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: const Color(0x1F8AB4F8),
          border: Border.all(color: const Color(0x4D8AB4F8)),
        ),
        child: const Text(
          'AI',
          style: TextStyle(
            fontSize: 12,
            height: 1,
            fontWeight: FontWeight.w900,
            letterSpacing: 0.3,
            color: Color(Env.blue),
          ),
        ),
      ),
    );
  }
}

class _DockAction extends StatelessWidget {
  const _DockAction({
    required this.icon,
    required this.label,
    required this.onTap,
    this.color,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final tint = color ?? const Color(Env.muted);
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: 38,
        height: 48,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 21,
              color: tint,
              shadows: const [
                Shadow(color: Color(0x66000000), blurRadius: 8),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                height: 1,
                fontWeight: FontWeight.w600,
                color: tint,
                shadows: const [
                  Shadow(color: Color(0x66000000), blurRadius: 8),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 作者头像 + 右下角关注角标。网页是 34px 头像 + 20px 关注圆点。
class _AuthorBubble extends StatelessWidget {
  const _AuthorBubble({
    required this.author,
    required this.followed,
    required this.busy,
    required this.onFollow,
  });

  final Author author;
  final bool followed;
  final bool busy;
  final VoidCallback onFollow;

  @override
  Widget build(BuildContext context) {
    final url = author.avatarUrl;
    final avatar = ClipOval(
      child: SizedBox(
        width: 38,
        height: 38,
        child: url != null && url.isNotEmpty
            ? Image.network(
                url,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => _initial(),
              )
            : _initial(),
      ),
    );

    return SizedBox(
      width: 38,
      height: 46,
      child: Stack(
        alignment: Alignment.topCenter,
        children: [
          avatar,
          Positioned(
            bottom: 0,
            child: GestureDetector(
              onTap: busy ? null : onFollow,
              behavior: HitTestBehavior.opaque,
              child: Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: followed ? const Color(0xFF2A3140) : const Color(0xFFFF5A7A),
                  border: Border.all(color: const Color(Env.bg), width: 1.5),
                ),
                child: Icon(
                  followed ? Icons.check : Icons.add,
                  size: 13,
                  color: followed ? const Color(Env.muted) : Colors.white,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _initial() => Container(
        alignment: Alignment.center,
        color: const Color(0x248AB4F8),
        child: Text(
          author.initial,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w900,
            color: Color(Env.text),
          ),
        ),
      );
}
