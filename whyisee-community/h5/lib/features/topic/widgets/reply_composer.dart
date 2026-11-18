import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/models.dart';
import '../../../core/env.dart';
import '../../../core/format.dart';
import '../topic_repository.dart';

/// 打开回复层。发布成功返回新楼层，取消返回 null。
///
/// [replyTo] 非空表示回复某一条评论，而不是回复整篇。带上它之后，
/// 面板顶部会先摆出那条评论（头像 + 昵称 + 原话），请求里也带
/// `parentPostId`；没带就是给主楼留一条。
///
/// 形状照抖音的评论输入走：从底部升起一条窄面板，里面只有「正在回复谁」
/// 和一行输入框，键盘一弹就顶上来。之前那版做成占 7 成屏的编辑器，
/// 点一下半屏全黑，看着像要写篇文章。
Future<TopicPost?> showReplyComposer(BuildContext context, {required int topicId, TopicPost? replyTo}) {
  return showModalBottomSheet<TopicPost>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    // 面板本身要贴着键盘走，外边留透明才不会出现一条生硬的直角边
    backgroundColor: Colors.transparent,
    barrierColor: const Color(0x66000000),
    builder: (_) => _ReplyComposer(topicId: topicId, replyTo: replyTo),
  );
}

class _ReplyComposer extends ConsumerStatefulWidget {
  const _ReplyComposer({required this.topicId, this.replyTo});

  final int topicId;
  final TopicPost? replyTo;

  @override
  ConsumerState<_ReplyComposer> createState() => _ReplyComposerState();
}

class _ReplyComposerState extends ConsumerState<_ReplyComposer> {
  final _text = TextEditingController();
  final _focus = FocusNode();

  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _text.addListener(_onChanged);
  }

  @override
  void dispose() {
    _text.removeListener(_onChanged);
    _text.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _onChanged() {
    if (!mounted) return;
    setState(() => _error = null);
  }

  bool get _canSend => !_busy && _text.text.trim().isNotEmpty;

  Future<void> _send() async {
    if (!_canSend) return;

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final post = await ref
          .read(topicRepositoryProvider)
          .createPost(
            topicId: widget.topicId,
            contentMarkdown: _text.text.trim(),
            parentPostId: widget.replyTo?.id,
          );
      if (!mounted) return;
      Navigator.of(context).pop(post);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = switch (e.code) {
          'rate_limited' => '发得太频繁了，歇一会儿再发',
          'validation_failed' => e.message,
          _ => e.isNetwork ? '网络不通，内容还留着' : e.message,
        };
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = '没发出去，稍后重试';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final viewInsets = MediaQuery.of(context).viewInsets.bottom;
    final target = widget.replyTo;

    return Padding(
      padding: EdgeInsets.only(bottom: viewInsets),
      child: Container(
        decoration: const BoxDecoration(
          color: Color(Env.panel),
          borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 7),
              Container(
                width: 32,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFF2C343F),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              if (target != null) _ReplyContext(post: target),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(_error!, style: const TextStyle(fontSize: 11.5, color: Color(0xFFFF9AA6))),
                  ),
                ),
              Padding(
                padding: EdgeInsets.fromLTRB(12, 10, 10, 10),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _text,
                        focusNode: _focus,
                        autofocus: true,
                        enabled: !_busy,
                        minLines: 1,
                        maxLines: 4,
                        textInputAction: TextInputAction.newline,
                        keyboardType: TextInputType.multiline,
                        cursorColor: const Color(Env.blue),
                        style: const TextStyle(fontSize: 14.5, height: 1.45, color: Color(Env.text)),
                        decoration: InputDecoration(
                          isDense: true,
                          filled: true,
                          fillColor: const Color(0x14FFFFFF),
                          hintText: target == null ? '留下你的评论…' : '回复 @${target.author.displayName}…',
                          hintStyle: const TextStyle(fontSize: 13.5, color: Color(0xFF5F6875)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 13, vertical: 10),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(18),
                            borderSide: BorderSide.none,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    _SendButton(busy: _busy, enabled: _canSend, onTap: _send),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 发送：内容为空时是灰的，但不是灰按钮 —— 抖音那个位置一直是亮字，
/// 只是点不动。做成一整块禁用按钮反而显得沉重。
class _SendButton extends StatelessWidget {
  const _SendButton({required this.busy, required this.enabled, required this.onTap});

  final bool busy;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      enabled: enabled,
      label: '发送',
      child: GestureDetector(
        onTap: enabled ? onTap : null,
        behavior: HitTestBehavior.opaque,
        child: Container(
          height: 38,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          alignment: Alignment.center,
          child: busy
              ? const SizedBox(
                  width: 15,
                  height: 15,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation(Color(Env.blue)),
                  ),
                )
              : Text(
                  '发送',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: enabled ? const Color(Env.blue) : const Color(0xFF4A5260),
                  ),
                ),
        ),
      ),
    );
  }
}

/// 正在回复的那一条：头像 + 昵称 + 原话两行。
///
/// 「回错楼层」是这类社区最常见的尴尬 —— 列表里几十条，滚上来早忘了原话。
/// 面板一升起就把对象摆在输入框上方，答谁一目了然。
class _ReplyContext extends StatelessWidget {
  const _ReplyContext({required this.post});

  final TopicPost post;

  @override
  Widget build(BuildContext context) {
    final text = htmlToPlainText(post.contentHtml).replaceAll(RegExp(r'\s+'), ' ').trim();

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.fromLTRB(11, 9, 11, 9),
      decoration: BoxDecoration(color: const Color(0x14FFFFFF), borderRadius: BorderRadius.circular(10)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              ClipOval(child: _Avatar(author: post.author)),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  '回复 @${post.author.displayName}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Color(Env.blue)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 5),
          Text(
            text.isEmpty ? '（内容为空）' : text,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 12.5, height: 1.5, color: Color(0xFF8B95A5)),
          ),
        ],
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
      return Image.network(
        url,
        width: 18,
        height: 18,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => _fallback(),
      );
    }
    return _fallback();
  }

  Widget _fallback() => Container(
    width: 18,
    height: 18,
    alignment: Alignment.center,
    decoration: const BoxDecoration(color: Color(Env.surface), shape: BoxShape.circle),
    child: Text(author.initial, style: const TextStyle(fontSize: 8.5, color: Color(Env.muted))),
  );
}
