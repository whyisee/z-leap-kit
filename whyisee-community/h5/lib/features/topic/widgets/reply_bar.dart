import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/models.dart';
import '../../../core/env.dart';
import '../../../shared/widgets/markdown_editor.dart';
import '../topic_repository.dart';

/// 详情页底部的「写回复」条。
///
/// 之前这一屏只能读：读完想回一句话，得点右上角开浏览器，在网页里重新登录一次。
/// 现在把入口放在拇指够得到的位置，点开就是一个和发帖同款的分块编辑器。
class ReplyBar extends StatelessWidget {
  const ReplyBar({
    super.key,
    required this.signedIn,
    required this.onTap,
  });

  final bool signedIn;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(Env.headerBg),
        border: Border(top: BorderSide(color: Color(Env.line), width: 1)),
      ),
      padding: EdgeInsets.fromLTRB(14, 8, 14, 8 + MediaQuery.of(context).padding.bottom),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onTap,
              child: Container(
                height: 38,
                alignment: Alignment.centerLeft,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: const Color(0x12FFFFFF),
                  borderRadius: BorderRadius.circular(19),
                  border: Border.all(color: const Color(Env.line)),
                ),
                child: Row(
                  children: [
                    Icon(
                      signedIn ? Icons.edit_outlined : Icons.lock_outline,
                      size: 15,
                      color: const Color(0xFF6B7686),
                    ),
                    const SizedBox(width: 7),
                    Text(
                      signedIn ? '写回复…' : '登录后回复',
                      style: const TextStyle(fontSize: 13, color: Color(0xFF7C8798)),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 打开回复编辑层。发布成功返回新楼层，取消返回 null。
Future<TopicPost?> showReplyComposer(
  BuildContext context, {
  required int topicId,
  int? parentPostId,
}) {
  return showModalBottomSheet<TopicPost>(
    context: context,
    isScrollControlled: true,
    // 编辑层要吃掉键盘上方的所有空间
    useSafeArea: true,
    backgroundColor: const Color(Env.bg),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (_) => _ReplyComposer(topicId: topicId, parentPostId: parentPostId),
  );
}

class _ReplyComposer extends ConsumerStatefulWidget {
  const _ReplyComposer({required this.topicId, this.parentPostId});

  final int topicId;
  final int? parentPostId;

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

  Future<void> _send() async {
    if (!_canSend) return;

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final post = await ref.read(topicRepositoryProvider).createPost(
            topicId: widget.topicId,
            contentMarkdown: _doc.markdown,
            parentPostId: widget.parentPostId,
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
    final height = (MediaQuery.of(context).size.height * 0.72)
        .clamp(280.0, MediaQuery.of(context).size.height - viewInsets - 60);

    return Padding(
      padding: EdgeInsets.only(bottom: viewInsets),
      child: SizedBox(
        height: height,
        child: Column(
          children: [
            _Handle(),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 8, 8),
              child: Row(
                children: [
                  const Text(
                    '回复',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Color(Env.text),
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
                        : const Text(
                            '发布',
                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                          ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, thickness: 1, color: Color(Env.line)),
            if (_error != null)
              Container(
                width: double.infinity,
                color: const Color(0x1AFF6B7A),
                padding: const EdgeInsets.fromLTRB(16, 9, 16, 9),
                child: Text(
                  _error!,
                  style: const TextStyle(fontSize: 12, color: Color(0xFFFF9AA6)),
                ),
              ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(left: 12, right: 8),
                child: MarkdownEditor(
                  controller: _doc,
                  enabled: !_busy,
                  hintText: '说点什么…',
                ),
              ),
            ),
          ],
        ),
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
        decoration: BoxDecoration(
          color: const Color(0xFF2C343F),
          borderRadius: BorderRadius.circular(2),
        ),
      ),
    );
  }
}
