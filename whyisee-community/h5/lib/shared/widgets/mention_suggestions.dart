import 'package:material_ui/material_ui.dart';

import '../../core/api/mention_repository.dart';
import '../../core/env.dart';

/// 光标前正在输入的 `@` 片段。
class MentionQuery {
  const MentionQuery({required this.start, required this.query});

  /// `@` 在可见文本里的下标（不含哨兵）
  final int start;

  /// `@` 后面的部分，可能为空串（刚打完 `@`）
  final String query;
}

/// 从「可见文本 + 光标」里读出 `@` 触发（没有就返回 null）。
///
/// 规则和网页 `MentionAutocomplete` 一致：`@` 必须在行首或空白/括号之后，
/// 用户名只认 `[a-zA-Z0-9_-]`，最多 32 位。区别只在这里不解析 Markdown，
/// 因为块编辑器里正文就是纯文本。
MentionQuery? mentionQueryAt(String text, int caret) {
  final position = caret.clamp(0, text.length);
  final before = text.substring(0, position);
  final match = RegExp(r'(^|[\s([{])@([a-zA-Z0-9_-]{0,32})$').firstMatch(before);
  if (match == null) return null;

  final username = match.group(2) ?? '';
  return MentionQuery(start: position - username.length - 1, query: username);
}

/// 把 `@片段` 替换成 `@username `，返回新文本和落点。
({String text, int caret}) applyMention(String text, MentionQuery trigger, String username) {
  final end = (trigger.start + 1 + trigger.query.length).clamp(0, text.length);
  final insert = '@$username ';
  final next = text.replaceRange(trigger.start.clamp(0, end), end, insert);
  return (text: next, caret: (trigger.start + insert.length).clamp(0, next.length));
}

/// `@` 候选条：贴在输入区上方的一行头像 + 昵称。
///
/// 不做浮层：手机上浮层要么盖住正文、要么在键盘弹起后算出错误位置；
/// 直接占一行让内容区往上让，位置永远对。
class MentionSuggestionBar extends StatelessWidget {
  const MentionSuggestionBar({super.key, required this.targets, required this.onPick, this.loading = false});

  final List<MentionTarget> targets;
  final ValueChanged<MentionTarget> onPick;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 56,
      decoration: const BoxDecoration(
        color: Color(Env.surface),
        border: Border(top: BorderSide(color: Color(Env.line), width: 1)),
      ),
      child: loading && targets.isEmpty
          ? const Align(
              alignment: Alignment.centerLeft,
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: 16),
                child: SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                    strokeWidth: 1.6,
                    valueColor: AlwaysStoppedAnimation(Color(0xFF5F6875)),
                  ),
                ),
              ),
            )
          : targets.isEmpty
          ? const Align(
              alignment: Alignment.centerLeft,
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: 16),
                child: Text('没有找到这个用户', style: TextStyle(fontSize: 12.5, color: Color(0xFF6B7686))),
              ),
            )
          : ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
              itemCount: targets.length,
              separatorBuilder: (_, _) => const SizedBox(width: 6),
              itemBuilder: (context, index) {
                final target = targets[index];
                return _SuggestionChip(
                  target: target,
                  // 用 GestureDetector 而不是 InkWell：InkWell 会抢焦点，
                  // 点一下候选键盘就收了，接着要再点一次输入框
                  onTap: () => onPick(target),
                );
              },
            ),
    );
  }
}

class _SuggestionChip extends StatelessWidget {
  const _SuggestionChip({required this.target, required this.onTap});

  final MentionTarget target;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.fromLTRB(6, 0, 11, 0),
        decoration: BoxDecoration(color: const Color(0x12FFFFFF), borderRadius: BorderRadius.circular(18)),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _Avatar(target: target),
            const SizedBox(width: 7),
            Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  target.displayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12.5,
                    height: 1.3,
                    fontWeight: FontWeight.w600,
                    color: Color(Env.text),
                  ),
                ),
                Text(
                  '@${target.username}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 10.5, height: 1.3, color: Color(0xFF7C8798)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.target});

  final MentionTarget target;

  @override
  Widget build(BuildContext context) {
    final url = target.avatarUrl;
    // 站内不少账号的头像是内联 SVG（data: URI），NetworkImage 解不了，
    // 直接走首字兜底，别在候选条里挂一串报错
    if (url != null && url.isNotEmpty && !url.startsWith('data:')) {
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
    decoration: const BoxDecoration(color: Color(Env.panel), shape: BoxShape.circle),
    child: Text(
      target.initial,
      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(Env.muted)),
    ),
  );
}
