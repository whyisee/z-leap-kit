import 'package:material_ui/material_ui.dart';

import '../../../core/api/models.dart';
import '../../../core/env.dart';
import '../../../core/format.dart';

/// 一条回帖。
///
/// 内容走纯文本（服务端 HTML 已降级），不动不动就嵌 WebView——
/// 30 条回复就是 30 个 WebView，内存和首帧都受不了。
///
/// 排版照抖音评论走：左边一条竖线，从上到下是「昵称 / 正文 /
/// 时间 · 回复」，点赞在右上角。原来那行把时间、楼层、点赞、回复
/// 全塞进顶部，读起来像表格；「回复」还带着图标和底色，比正文还显眼。
class PostTile extends StatelessWidget {
  const PostTile({
    super.key,
    required this.post,
    required this.floor,
    required this.onLike,
    required this.onReply,
    this.parent,
    this.onJumpToParent,
    this.likeBusy = false,
    this.highlighted = false,
  });

  final TopicPost post;
  final int floor;
  final VoidCallback onLike;

  /// 点「回复」：回这一条，而不是回主楼
  final VoidCallback onReply;

  /// 被回复的那一层。拿到它才显示得出「回复 @谁」；
  /// 楼层被删掉时是 null，那就只写「回复了某条评论」，别硬编个名字。
  final TopicPost? parent;

  /// 点「回复 @谁」跳回被回复的那一条
  final VoidCallback? onJumpToParent;

  final bool likeBusy;

  /// 从通知点进来时，把被回复的那一层标出来 —— 用户不必自己数楼层
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    final text = htmlToPlainText(post.contentHtml);

    return AnimatedContainer(
      duration: const Duration(milliseconds: 420),
      curve: Curves.easeOut,
      padding: const EdgeInsets.fromLTRB(16, 13, 14, 11),
      decoration: BoxDecoration(
        color: highlighted ? const Color(0x148AB4F8) : Colors.transparent,
        border: Border(
          // 左侧竖条常驻占位（透明的），高亮时不会把正文挤动 2.5px
          left: BorderSide(color: highlighted ? const Color(0xCC8AB4F8) : Colors.transparent, width: 2.5),
          bottom: const BorderSide(color: Color(Env.line), width: 1),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Avatar(author: post.author),
          const SizedBox(width: 9),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        post.author.displayName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF8B95A5),
                        ),
                      ),
                    ),
                    if (highlighted) ...[
                      const SizedBox(width: 6),
                      Container(
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
                    ],
                    const Spacer(),
                    _LikeButton(liked: post.liked, count: post.likeCount, busy: likeBusy, onTap: onLike),
                  ],
                ),
                // 这条是回某一层的，先把对象写出来 —— 平的列表里，
                // 「在跟谁说话」只能靠这一行
                if (post.parentPostId != null) ...[
                  const SizedBox(height: 4),
                  _ReplyTarget(
                    name: parent?.author.displayName,
                    onTap: parent == null ? null : onJumpToParent,
                  ),
                ],
                const SizedBox(height: 5),
                Text(
                  text.isEmpty ? '（内容为空）' : text,
                  style: const TextStyle(fontSize: 14.5, height: 1.62, color: Color(0xFFDDE3EA)),
                ),
                const SizedBox(height: 6),
                _MetaRow(floor: floor, createdAt: post.createdAt, onReply: onReply),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// 「时间 · 回复」那一行。
///
/// 抖音的「回复」就是两个小灰字，不带图标、不带底色 ——
/// 它是个次要动作，不该比正文还抢眼。点击热区靠内边距撑到 30 高。
class _MetaRow extends StatelessWidget {
  const _MetaRow({required this.floor, required this.createdAt, required this.onReply});

  final int floor;
  final DateTime? createdAt;
  final VoidCallback onReply;

  @override
  Widget build(BuildContext context) {
    const style = TextStyle(fontSize: 11.5, height: 1.45, color: Color(0xFF6E7887));

    return Row(
      children: [
        Text('#$floor', style: const TextStyle(fontSize: 11.5, height: 1.45, color: Color(0xFF525C6B))),
        if (createdAt != null) ...[
          const Text(' · ', style: TextStyle(fontSize: 11.5, height: 1.45, color: Color(0xFF3C4552))),
          Text(relativeTime(createdAt), style: style),
        ],
        const SizedBox(width: 4),
        InkWell(
          onTap: onReply,
          borderRadius: BorderRadius.circular(6),
          child: const Padding(
            padding: EdgeInsets.fromLTRB(4, 5, 8, 5),
            child: Text('回复', style: TextStyle(fontSize: 11.5, height: 1.45, color: Color(0xFF6E7887))),
          ),
        ),
      ],
    );
  }
}

/// 「回复 @某人」。点到名字就跳回那一条，和被 @ 的提醒一个用法。
class _ReplyTarget extends StatelessWidget {
  const _ReplyTarget({this.name, this.onTap});

  final String? name;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final label = name == null ? '回复了一条已删除的评论' : '回复 @$name';

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          fontSize: 12,
          height: 1.4,
          fontWeight: FontWeight.w500,
          color: name == null ? const Color(0xFF6E7887) : const Color(Env.blue),
        ),
      ),
    );
  }
}

class _LikeButton extends StatelessWidget {
  const _LikeButton({required this.liked, required this.count, required this.busy, required this.onTap});

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
        padding: const EdgeInsets.fromLTRB(8, 2, 2, 2),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(liked ? Icons.favorite : Icons.favorite_border, size: 14, color: color),
            if (count > 0) ...[
              const SizedBox(width: 3),
              Text(compactCount(count), style: TextStyle(fontSize: 11.5, height: 1.4, color: color)),
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
          width: 26,
          height: 26,
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) => _fallback(),
        ),
      );
    }
    return _fallback();
  }

  Widget _fallback() => Container(
    width: 26,
    height: 26,
    alignment: Alignment.center,
    decoration: const BoxDecoration(color: Color(Env.panel), shape: BoxShape.circle),
    child: Text(author.initial, style: const TextStyle(fontSize: 10.5, color: Color(Env.muted))),
  );
}
