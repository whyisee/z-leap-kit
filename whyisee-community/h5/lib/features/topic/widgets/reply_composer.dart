import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/models.dart';
import '../../../core/env.dart';
import '../../../core/format.dart';
import '../../../shared/widgets/markdown_editor.dart';
import '../topic_repository.dart';

/// 打开回复编辑层。发布成功返回新楼层，取消返回 null。
///
/// [replyTo] 非空表示回复某一条评论，而不是回复整篇。带上它之后：
/// 标题变成「回复 @某人」、编辑器上方多一块被回复内容的摘要、请求里带
/// `parentPostId`。没带就是给主楼回一条，和以前一样。
///
/// 服务端只有两层（回复「回复」会归并到同一个根楼层，网页也是这么存的），
/// 所以这里只负责把「点的是哪一条」传上去，层级归并交给服务端。
Future<TopicPost?> showReplyComposer(BuildContext context, {required int topicId, TopicPost? replyTo}) {
  return showModalBottomSheet<TopicPost>(
    context: context,
    isScrollControlled: true,
    // 编辑层要吃掉键盘上方的所有空间
    useSafeArea: true,
    backgroundColor: const Color(Env.bg),
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
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
  final _doc = MarkdownDocController();

  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    // 字数变化要刷新「发送」按钮的可用状态
    _doc.addListener(_onChanged);

    // 这一层存在的唯一目的就是写字，弹出来还得再点一下输入框才出键盘，
    // 等于白弹一次。布局完成就抢焦点。
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _doc.blocks.first.focus.requestFocus();
    });
  }

  @override
  void dispose() {
    _doc.removeListener(_onChanged);
    _doc.dispose();
    super.dispose();
  }

  void _onChanged() {
    if (mounted) setState(() {});
  }

  bool get _canSend => !_busy && !_doc.isEmpty;

  String get _title {
    final target = widget.replyTo;
    if (target == null) return '回复';
    return '回复 @${target.author.displayName}';
  }

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
            contentMarkdown: _doc.markdown,
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
          _ => e.isNetwork ? '网络不通，这条先留着，稍后再发' : e.message,
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
    // 键盘弹起时只留键盘上方那一块，收起来最多占 7 成屏 ——
    // 别盖住帖子上下文，用户常要一边看上面一边回
    final height = (MediaQuery.of(context).size.height * 0.72).clamp(
      280.0,
      MediaQuery.of(context).size.height - viewInsets - 60,
    );

    final target = widget.replyTo;

    return Padding(
      padding: EdgeInsets.only(bottom: viewInsets),
      child: SizedBox(
        height: height,
        child: Column(
          children: [
            const _Handle(),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 8, 8),
              child: Row(
                children: [
                  Flexible(
                    child: Text(
                      _title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: Color(Env.text),
                      ),
                    ),
                  ),
                  const Spacer(),
                  TextButton(
                    onPressed: _busy ? null : () => Navigator.of(context).pop(),
                    style: TextButton.styleFrom(foregroundColor: const Color(Env.muted)),
                    child: const Text('取消', style: TextStyle(fontSize: 13)),
                  ),
                  const SizedBox(width: 2),
                  FilledButton(
                    onPressed: _canSend ? _send : null,
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(78, 36),
                      backgroundColor: const Color(0xFF8AB4F8),
                      foregroundColor: const Color(0xFF0D1016),
                      disabledBackgroundColor: const Color(0x1FFFFFFF),
                      disabledForegroundColor: const Color(0xFF5F6875),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(9)),
                    ),
                    child: _busy
                        ? const SizedBox(
                            width: 15,
                            height: 15,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation(Color(0xFF0D1016)),
                            ),
                          )
                        : const Text('发布', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, thickness: 1, color: Color(Env.line)),
            if (target != null) _QuotedPost(post: target),
            if (_error != null)
              Container(
                width: double.infinity,
                color: const Color(0x1AFF6B7A),
                padding: const EdgeInsets.fromLTRB(16, 9, 16, 9),
                child: Text(_error!, style: const TextStyle(fontSize: 12, color: Color(0xFFFF9AA6))),
              ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(left: 12, right: 8),
                child: MarkdownEditor(
                  controller: _doc,
                  enabled: !_busy,
                  hintText: target == null ? '说点什么…' : '回复 @${target.author.displayName}…',
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 被回复的那一条的摘要。
///
/// 写回复时最怕「回错了楼层」—— 列表里几十条，滚上来已经忘了原话。
/// 贴一条灰底摘要，作者名 + 前两行，够确认对象了。
class _QuotedPost extends StatelessWidget {
  const _QuotedPost({required this.post});

  final TopicPost post;

  @override
  Widget build(BuildContext context) {
    final text = htmlToPlainText(post.contentHtml).replaceAll(RegExp(r'\s+'), ' ').trim();

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(16, 10, 16, 0),
      padding: const EdgeInsets.fromLTRB(11, 9, 11, 9),
      decoration: BoxDecoration(
        color: const Color(Env.panel),
        borderRadius: BorderRadius.circular(10),
        border: const Border(left: BorderSide(color: Color(0x668AB4F8), width: 2.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            post.author.displayName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Color(Env.blue)),
          ),
          const SizedBox(height: 3),
          Text(
            text.isEmpty ? '（内容为空）' : text,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 12.5, height: 1.5, color: Color(Env.muted)),
          ),
        ],
      ),
    );
  }
}

/// 顶部那条拖拽指示条：告诉用户这层可以下滑关掉
class _Handle extends StatelessWidget {
  const _Handle();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Container(
        width: 36,
        height: 4,
        decoration: BoxDecoration(color: const Color(0xFF2C343F), borderRadius: BorderRadius.circular(2)),
      ),
    );
  }
}
