import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/models.dart';
import '../../../core/env.dart';
import '../../../core/providers.dart';
import '../topic_repository.dart';
import 'post_tile.dart';
import 'reply_composer.dart';

/// 从底部上滑打开评论区。
///
/// 文章页不再把评论挂在正文下面：一篇长文加几十条回复，滚到底就等于
/// 从头再读一遍；想让用户看评论，入口应该是「点一下冒出来」。
///
/// [onChanged] 每次列表变动（发评论、点赞）都会回调一次 —— 用回调而不是
/// pop 返回值，是因为下滑关闭走的是默认 pop，那条路上拿不到返回值，
/// 计数就会停在旧值。[focusPostId] 非空时（从通知点进来）打开后直接滚到那层。
Future<void> showCommentSheet(
  BuildContext context, {
  required int topicId,
  required List<TopicPost> posts,
  required ValueChanged<List<TopicPost>> onChanged,
  int? focusPostId,
  double initialSize = 0.78,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    barrierColor: const Color(0x8C000000),
    builder: (_) => _CommentSheet(
      topicId: topicId,
      posts: posts,
      onChanged: onChanged,
      focusPostId: focusPostId,
      initialSize: initialSize,
    ),
  );
}

class _CommentSheet extends ConsumerStatefulWidget {
  const _CommentSheet({
    required this.topicId,
    required this.posts,
    required this.onChanged,
    this.focusPostId,
    this.initialSize = 0.78,
  });

  final int topicId;
  final List<TopicPost> posts;
  final ValueChanged<List<TopicPost>> onChanged;
  final int? focusPostId;
  final double initialSize;

  @override
  ConsumerState<_CommentSheet> createState() => _CommentSheetState();
}

class _CommentSheetState extends ConsumerState<_CommentSheet> {
  late List<TopicPost> _posts = widget.posts;

  /// 正在等接口的那几条：只挡住重复点击，不做乐观更新的拦截
  final _busy = <int>{};
  final _keys = <int, GlobalKey>{};

  bool get _signedIn => ref.read(sessionProvider).isSignedIn;

  @override
  void initState() {
    super.initState();
    if (widget.focusPostId != null) {
      // 楼层要等第一帧布局完才有 RenderObject
      WidgetsBinding.instance.addPostFrameCallback((_) => _jumpTo(widget.focusPostId!, animate: false));
    }
  }

  void _setPosts(List<TopicPost> next) {
    setState(() => _posts = next);
    widget.onChanged(next);
  }

  GlobalKey _keyFor(int postId) =>
      _keys.putIfAbsent(postId, () => GlobalKey(debugLabel: 'sheet-post-$postId'));

  void _jumpTo(int postId, {bool animate = true}) {
    final ctx = _keys[postId]?.currentContext;
    if (ctx == null) return;
    Scrollable.ensureVisible(
      ctx,
      alignment: 0.04,
      duration: animate ? const Duration(milliseconds: 280) : Duration.zero,
      curve: Curves.easeOutCubic,
    );
  }

  void _toast(String text) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(text), behavior: SnackBarBehavior.floating));
  }

  Future<void> _compose({TopicPost? replyTo}) async {
    if (!_signedIn) {
      context.push('/login?reason=${Uri.encodeComponent('登录后就能参与评论。')}');
      return;
    }

    final post = await showReplyComposer(context, topicId: widget.topicId, replyTo: replyTo);
    if (!mounted || post == null) return;

    // 服务端会把「回复回复」归并到同一根楼层，所以以它回的 parentPostId 为准，
    // 不拿本地那点信息去猜「回复 @谁」
    _setPosts([..._posts, post]);

    // 自己刚说的话必须立刻看得见，否则会以为没发出去再发一遍
    WidgetsBinding.instance.addPostFrameCallback((_) => _jumpTo(post.id));
  }

  Future<void> _toggleLike(TopicPost post) async {
    if (_busy.contains(post.id)) return;
    if (!_signedIn) {
      context.push('/login?reason=${Uri.encodeComponent('登录后才能点赞。')}');
      return;
    }

    final at = _posts.indexWhere((p) => p.id == post.id);
    if (at < 0) return;

    final optimistic = post.copyWith(
      liked: !post.liked,
      likeCount: (post.likeCount + (post.liked ? -1 : 1)).clamp(0, 1 << 30),
    );

    setState(() => _busy.add(post.id));
    _setPosts(_replace(at, optimistic));

    try {
      final result = await ref
          .read(topicRepositoryProvider)
          .toggleLike(targetType: 'post', targetId: post.id);
      if (!mounted) return;
      final now = _posts.indexWhere((p) => p.id == post.id);
      if (now < 0) return;
      _setPosts(_replace(now, _posts[now].copyWith(liked: result.liked, likeCount: result.likeCount)));
    } on ApiException catch (e) {
      if (!mounted) return;
      final now = _posts.indexWhere((p) => p.id == post.id);
      if (now >= 0) _setPosts(_replace(now, post));
      _toast(e.message);
    } finally {
      if (mounted) setState(() => _busy.remove(post.id));
    }
  }

  List<TopicPost> _replace(int index, TopicPost next) {
    final copy = List<TopicPost>.of(_posts);
    copy[index] = next;
    return copy;
  }

  TopicPost? _parentOf(TopicPost post) {
    final parentId = post.parentPostId;
    if (parentId == null) return null;
    for (final p in _posts) {
      if (p.id == parentId) return p;
    }
    return null;
  }

  void _close() => Navigator.of(context).pop();

  @override
  Widget build(BuildContext context) {
    final viewInsets = MediaQuery.of(context).viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: viewInsets),
      child: DraggableScrollableSheet(
        initialChildSize: widget.initialSize,
        minChildSize: 0.45,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, controller) => Container(
          decoration: const BoxDecoration(
            color: Color(Env.panel),
            borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
          ),
          child: Column(
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
              _Header(count: _posts.length, onClose: _close),
              const Divider(height: 1, thickness: 1, color: Color(Env.line)),
              Expanded(
                child: _posts.isEmpty
                    ? const _Empty()
                    : ListView(
                        controller: controller,
                        padding: const EdgeInsets.only(bottom: 8),
                        children: [
                          for (var i = 0; i < _posts.length; i++)
                            PostTile(
                              key: _keyFor(_posts[i].id),
                              post: _posts[i],
                              floor: i + 1,
                              parent: _parentOf(_posts[i]),
                              highlighted: widget.focusPostId != null && _posts[i].id == widget.focusPostId,
                              likeBusy: _busy.contains(_posts[i].id),
                              onLike: () => _toggleLike(_posts[i]),
                              onReply: () => _compose(replyTo: _posts[i]),
                              onJumpToParent: () {
                                final parentId = _posts[i].parentPostId;
                                if (parentId != null) _jumpTo(parentId);
                              },
                            ),
                        ],
                      ),
              ),
              _ComposerBar(signedIn: _signedIn, onTap: () => _compose()),
            ],
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.count, required this.onClose});

  final int count;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 46,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Text(
            count == 0 ? '评论' : '$count 条评论',
            style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: Color(Env.text)),
          ),
          Positioned(
            right: 4,
            child: IconButton(
              onPressed: onClose,
              icon: const Icon(Icons.close, size: 19, color: Color(Env.muted)),
              tooltip: '关闭评论',
            ),
          ),
        ],
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Text('还没有评论，说两句', style: TextStyle(fontSize: 13, color: Color(Env.muted))),
    );
  }
}

/// 底部那条「输入框」。
///
/// 长成输入框是为了让位置一眼能认，但点下去是升起回复面板，不是就地编辑：
/// 面板自己管焦点、键盘和错误，两种输入状态混在一起只会互相抢焦点。
class _ComposerBar extends StatelessWidget {
  const _ComposerBar({required this.signedIn, required this.onTap});

  final bool signedIn;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: Color(Env.line), width: 1)),
      ),
      // showModalBottomSheet 的 useSafeArea 只顶不管底，home indicator 得自己躲
      padding: EdgeInsets.fromLTRB(14, 9, 10, 9 + MediaQuery.of(context).padding.bottom),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              onTap: onTap,
              behavior: HitTestBehavior.opaque,
              child: Container(
                height: 36,
                padding: const EdgeInsets.symmetric(horizontal: 13),
                alignment: Alignment.centerLeft,
                decoration: BoxDecoration(
                  color: const Color(0x14FFFFFF),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Text(
                  signedIn ? '留下你的评论…' : '登录后参与评论',
                  style: const TextStyle(fontSize: 13, color: Color(0xFF5F6875)),
                ),
              ),
            ),
          ),
          const SizedBox(width: 4),
          IconButton(
            onPressed: onTap,
            icon: const Icon(Icons.send_outlined, size: 19, color: Color(Env.blue)),
            tooltip: '写评论',
          ),
        ],
      ),
    );
  }
}
