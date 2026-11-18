import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/api_exception.dart';
import '../../core/api/models.dart';
import '../../core/env.dart';
import '../../core/format.dart';
import '../../core/providers.dart';
import '../errors/error_view.dart';
import '../feed/feed_controller.dart';
import 'reading_queue.dart';
import 'topic_entry.dart';
import 'topic_repository.dart';
import 'widgets/article_webview.dart';
import 'widgets/entry_banner.dart';
import 'widgets/float_dock.dart';
import 'widgets/post_tile.dart';
import 'widgets/reader_top_bar.dart';
import 'widgets/reply_bar.dart';
import 'widgets/topic_ai_sheet.dart';

/// 帖子详情，交互对齐网页版的沉浸阅读器：
///
/// - 滚动后顶栏变毛玻璃、文章标题浮出（ReaderTopBar）；
/// - 右下角竖排操作条（FloatDock），AI/点赞/收藏/回复/分享/关注作者；
/// - 已读到底后继续上滑，切到服务端推荐的下一篇；
/// - 正文用 WebView 保真渲染，回帖降级成纯文本。
///
/// 从通知点进来时多带两样东西：[entry] 说明来由（顶部一条），[postId] 指向
/// 被回复的那一层（滚过去并高亮）。
class TopicDetailPage extends ConsumerStatefulWidget {
  const TopicDetailPage({
    super.key,
    required this.topicId,
    this.entry,
    this.postId,
  });

  final int topicId;

  /// 来由，只有从通知进来时才有
  final TopicEntry? entry;

  /// 要定位的楼层 id（通知 href 里的 `#post-123`）
  final int? postId;

  @override
  ConsumerState<TopicDetailPage> createState() => _TopicDetailPageState();
}

class _TopicDetailPageState extends ConsumerState<TopicDetailPage> {
  /// 网页版参数：剩余滚动 ≤28px 算到底；触摸累计 108px 触发切篇。
  static const _boundaryDistance = 28.0;
  static const _switchThreshold = 108.0;

  final _scroll = ScrollController();
  final _offset = ValueNotifier<double>(0);
  final _repliesKey = GlobalKey();

  /// 每个楼层一个 GlobalKey，用来滚到被通知指向的那一条。
  /// 用 Map 复用：点赞等操作触发重建时不会重新造 key，滚动位置才不会跳。
  final _postKeys = <int, GlobalKey>{};

  /// 来由条可以收起来 —— 用户已经知道怎么回事了，别一直占着首屏
  bool _bannerOpen = true;

  /// 定位只做一次：下拉刷新不该把正在看的人拽回那条回复
  bool _locateScheduled = false;

  TopicDetail? _detail;
  ApiException? _error;
  bool _loading = true;
  bool _topicLikeBusy = false;
  bool _bookmarkBusy = false;
  bool _followBusy = false;
  final Set<int> _postLikeBusy = {};

  /// 到底后继续拖的累计距离，够了就切篇。
  double _overscroll = 0;
  bool _switching = false;
  Timer? _overscrollReset;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    _load();
  }

  @override
  void dispose() {
    _overscrollReset?.cancel();
    _scroll
      ..removeListener(_onScroll)
      ..dispose();
    _offset.dispose();
    super.dispose();
  }

  void _onScroll() {
    _offset.value = _scroll.offset;
  }

  /// 要定位的楼层 id；没有就是普通进入
  int? get _targetPostId {
    final id = widget.postId;
    return (id != null && id > 0) ? id : null;
  }

  /// 滚到被通知指向的那一层。
  ///
  /// 正文是 WebView，高度靠 JS 异步上报（最长 1.5s 才稳定）。跳一次会被后来
  /// 的长高顶走，所以分几拍：先跳，随后在高度稳定前后各纠一次偏。
  void _scheduleLocate() {
    final id = _targetPostId;
    if (id == null) return;

    for (final ms in const [160, 480, 900, 1500, 2400]) {
      Timer(Duration(milliseconds: ms), () {
        if (!mounted) return;
        _locatePost(id, first: ms == 160);
      });
    }
  }

  void _locatePost(int postId, {bool first = false}) {
    final ctx = _postKeys[postId]?.currentContext;
    if (ctx == null) return;

    // 0.12 屏高 ≈ 100px，正好落在顶栏下方而不是被毛玻璃压住
    const alignment = 0.12;

    if (first) {
      Scrollable.ensureVisible(
        ctx,
        alignment: alignment,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOutCubic,
      );
      return;
    }

    // 纠偏只补「已经看不见了」的情况，否则每一拍都把用户往上拽一下
    final box = ctx.findRenderObject();
    if (box is! RenderBox || !box.attached) return;

    final top = box.localToGlobal(Offset.zero).dy;
    final screen = MediaQuery.of(context).size.height;
    final barBottom = MediaQuery.of(context).padding.top + kToolbarHeight;
    if (top < barBottom - 12 || top > screen * 0.62) {
      Scrollable.ensureVisible(
        ctx,
        alignment: alignment,
        duration: const Duration(milliseconds: 240),
        curve: Curves.easeOutCubic,
      );
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final detail = await ref.read(topicRepositoryProvider).detail(widget.topicId);
      if (!mounted) return;

      // 先把这篇记成已读、把它带来的候选倒进队列，再刷新 UI，
      // 否则底部的「继续下滑 · 标题」会先渲染成上一批的旧值。
      final queue = ref.read(readingQueueProvider);
      queue.markSeen(widget.topicId);
      queue.push(detail.nextCandidates);

      // 上报已读：服务端据此把这批从推荐池里剔除，也用来算兴趣画像。
      unawaited(ref.read(topicRepositoryProvider).trackRead(widget.topicId));

      setState(() {
        _detail = detail;
        _loading = false;
      });

      if (!_locateScheduled) {
        _locateScheduled = true;
        _scheduleLocate();
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = ApiException(code: 'unknown', message: '加载失败，稍后重试。');
        _loading = false;
      });
    }
  }

  bool get _signedIn => ref.read(sessionProvider).isSignedIn;

  bool _needLogin() {
    context.push('/login?reason=${Uri.encodeComponent('登录后才能点赞、回复和关注。')}');
    return false;
  }

  void _toast(String text) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(text),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
        ),
      );
  }

  // ---------------------------------------------------------------- 互动

  Future<void> _toggleTopicLike() async {
    final detail = _detail;
    if (detail == null || _topicLikeBusy) return;
    if (!_signedIn) {
      _needLogin();
      return;
    }

    final before = detail.interactions;
    final optimisticLiked = !before.liked;

    setState(() {
      _topicLikeBusy = true;
      _detail = detail.copyWith(
        interactions: before.copyWith(
          liked: optimisticLiked,
          likeCount: (before.likeCount + (optimisticLiked ? 1 : -1)).clamp(0, 1 << 30),
        ),
      );
    });

    try {
      final result = await ref.read(topicRepositoryProvider).toggleLike(
            targetType: 'topic',
            targetId: widget.topicId,
          );
      if (!mounted) return;
      setState(() {
        _detail = _detail!.copyWith(
          interactions: _detail!.interactions.copyWith(
            liked: result.liked,
            likeCount: result.likeCount,
          ),
        );
      });
      ref.read(feedControllerProvider.notifier).patchLike(widget.topicId, likeCount: result.likeCount);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _detail = _detail!.copyWith(interactions: before));
      _toast(e.isRateLimited ? '手太快了，歇一下' : e.message);
    } finally {
      if (mounted) setState(() => _topicLikeBusy = false);
    }
  }

  Future<void> _toggleBookmark() async {
    final detail = _detail;
    if (detail == null || _bookmarkBusy) return;
    if (!_signedIn) {
      _needLogin();
      return;
    }

    final before = detail.interactions;
    final next = !before.bookmarked;

    setState(() {
      _bookmarkBusy = true;
      _detail = detail.copyWith(
        interactions: before.copyWith(
          bookmarked: next,
          bookmarkCount: (before.bookmarkCount + (next ? 1 : -1)).clamp(0, 1 << 30),
        ),
      );
    });

    try {
      final bookmarked = await ref.read(topicRepositoryProvider).toggleBookmark(widget.topicId);
      if (!mounted) return;
      setState(() {
        _detail = _detail!.copyWith(
          interactions: _detail!.interactions.copyWith(bookmarked: bookmarked),
        );
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _detail = _detail!.copyWith(interactions: before));
      _toast(e.message);
    } finally {
      if (mounted) setState(() => _bookmarkBusy = false);
    }
  }

  Future<void> _toggleFollow() async {
    final detail = _detail;
    if (detail == null || _followBusy) return;
    if (!_signedIn) {
      _needLogin();
      return;
    }

    final authorId = detail.topic.author.id;
    if (authorId <= 0) return;

    final before = detail.interactions;
    setState(() {
      _followBusy = true;
      _detail = detail.copyWith(
        interactions: before.copyWith(followed: !before.followed),
      );
    });

    try {
      final following = await ref.read(topicRepositoryProvider).toggleFollowUser(authorId);
      if (!mounted) return;
      setState(() {
        _detail = _detail!.copyWith(
          interactions: _detail!.interactions.copyWith(followed: following),
        );
      });
      _toast(following ? '已关注' : '已取消关注');
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _detail = _detail!.copyWith(interactions: before));
      _toast(e.message);
    } finally {
      if (mounted) setState(() => _followBusy = false);
    }
  }

  /// 作者 / 管理员的长按菜单：编辑、删除。
  ///
  /// 只做这两件事。改分区、置顶、加精这些留给网页后台 —— 手机上处理一篇
  /// 内容时，99% 的需求是「有个错字」或「发错地方了」。
  Future<void> _openMoreMenu() async {
    final topic = _detail?.topic;
    if (topic == null) return;

    // canEdit 由服务端给（作者本人或管理员）。举报对所有登录用户开放 ——
    // 之前菜单只对作者出现，读者想举报还得自己拼 URL 去网页。
    final canEdit = _detail?.me.canEdit == true;

    final action = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => SafeArea(
        child: Container(
          margin: const EdgeInsets.fromLTRB(10, 0, 10, 10),
          decoration: BoxDecoration(
            color: const Color(Env.surface),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (canEdit) ...[
                ListTile(
                  leading: const Icon(Icons.edit_outlined, size: 20, color: Color(Env.text)),
                  title: const Text(
                    '编辑这篇',
                    style: TextStyle(fontSize: 14, color: Color(Env.text)),
                  ),
                  subtitle: const Text(
                    '改完要重新过一遍审核',
                    style: TextStyle(fontSize: 11.5, color: Color(0xFF5F6875)),
                  ),
                  onTap: () => Navigator.of(context).pop('edit'),
                ),
                const Divider(height: 1, color: Color(Env.line)),
                ListTile(
                  leading: const Icon(Icons.delete_outline, size: 20, color: Color(0xFFF08A8A)),
                  title: const Text(
                    '删除',
                    style: TextStyle(fontSize: 14, color: Color(0xFFF08A8A)),
                  ),
                  subtitle: const Text(
                    '会从列表里下线，回复不会丢',
                    style: TextStyle(fontSize: 11.5, color: Color(0xFF5F6875)),
                  ),
                  onTap: () => Navigator.of(context).pop('delete'),
                ),
                const Divider(height: 1, color: Color(Env.line)),
              ],
              ListTile(
                leading: const Icon(Icons.flag_outlined, size: 20, color: Color(Env.text)),
                title: const Text(
                  '举报这篇',
                  style: TextStyle(fontSize: 14, color: Color(Env.text)),
                ),
                subtitle: const Text(
                  '广告、骚扰、抄袭都可以报',
                  style: TextStyle(fontSize: 11.5, color: Color(0xFF5F6875)),
                ),
                onTap: () => Navigator.of(context).pop('report'),
              ),
            ],
          ),
        ),
      ),
    );

    if (!mounted) return;

    if (action == 'edit') {
      await context.push('/compose/edit/${topic.id}');
      if (!mounted) return;
      await _refreshQuietly();
    } else if (action == 'delete') {
      await _confirmDelete(topic.id);
    } else if (action == 'report') {
      final reported = await context.push<bool>(
        '/report?type=topic&id=${topic.id}&label=${Uri.encodeComponent(topic.title)}',
      );
      if (reported != true || !mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(const SnackBar(content: Text('已提交，管理员会看到')));
    }
  }

  Future<void> _confirmDelete(int topicId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(Env.surface),
        title: const Text('删除这篇？', style: TextStyle(fontSize: 15, color: Color(Env.text))),
        content: const Text(
          '删除后列表里就看不到了，回复记录仍然保留。这个动作在手机上去不掉。',
          style: TextStyle(fontSize: 13, height: 1.6, color: Color(Env.muted)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('算了', style: TextStyle(color: Color(Env.muted))),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('删除', style: TextStyle(color: Color(0xFFF08A8A))),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    try {
      await ref.read(topicRepositoryProvider).deleteTopic(topicId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('已删除')),
      );
      // 这篇已经不在列表里了，留在详情页只会到处 404
      context.pop();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('删除失败，稍后再试')),
      );
    }
  }

  /// 编辑回来后的静默刷新：不置 loading，避免整页闪一下骨架再回到原位。
  Future<void> _refreshQuietly() async {
    try {
      final detail = await ref.read(topicRepositoryProvider).detail(widget.topicId);
      if (!mounted) return;
      setState(() => _detail = detail);
    } catch (_) {
      // 刷新失败不打断阅读，用户下拉一下还能手动重来
    }
  }

  void _scrollToReplies() {
    final ctx = _repliesKey.currentContext;
    if (ctx == null) return;
    Scrollable.ensureVisible(
      ctx,
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
      alignment: 0.02,
    );
  }

  /// 写回复：没登录先去登录，登录完直接接着编辑，不用再点一次。
  ///
  /// 发布成功后把服务端回的那一层直接插进列表并滚过去 —— 自己刚说的话
  /// 必须马上看得见，否则用户会以为没发出去再发一遍。
  Future<void> _openReply() async {
    if (!_signedIn) {
      await context.push('/login?reason=${Uri.encodeComponent('登录后就能回复这篇。')}');
      if (!mounted || !_signedIn) return;
    }

    final post = await showReplyComposer(context, topicId: widget.topicId);
    if (!mounted || post == null) return;

    final detail = _detail;
    if (detail == null) return;

    setState(() {
      _detail = detail.copyWith(posts: [...detail.posts, post]);
    });
    _toast('已发布');
    _scrollToPost(post.id);
  }

  /// 滚到刚发出的那一层。列表可能刚插入新行，要等一帧布局完再算位置。
  void _scrollToPost(int postId) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final ctx = _postKeys[postId]?.currentContext;
      if (ctx == null) return;
      Scrollable.ensureVisible(
        ctx,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOutCubic,
        alignment: 0.2,
      );
    });
  }

  Future<void> _share() async {
    final url = '${Env.siteBase}/t/${widget.topicId}';
    await Clipboard.setData(ClipboardData(text: url));
    _toast('链接已复制');
  }

  void _openInBrowser() {
    launchUrl(Env.uri('/t/${widget.topicId}'), mode: LaunchMode.externalApplication);
  }

  /// AI 菜单走服务端鉴权（`/api/v1/ai/topic` 要登录），未登录先提示再退出。
  void _openAi() {
    if (!_signedIn) {
      _needLogin();
      return;
    }
    showTopicAiSheet(context, topicId: widget.topicId);
  }

  Future<void> _togglePostLike(TopicPost post) async {
    if (_postLikeBusy.contains(post.id)) return;
    if (!_signedIn) {
      _needLogin();
      return;
    }

    final detail = _detail;
    if (detail == null) return;

    final index = detail.posts.indexWhere((p) => p.id == post.id);
    if (index < 0) return;

    final optimistic = post.copyWith(
      liked: !post.liked,
      likeCount: (post.likeCount + (post.liked ? -1 : 1)).clamp(0, 1 << 30),
    );

    setState(() {
      _postLikeBusy.add(post.id);
      _detail = detail.copyWith(posts: _replacePost(detail.posts, index, optimistic));
    });

    try {
      final result = await ref.read(topicRepositoryProvider).toggleLike(
            targetType: 'post',
            targetId: post.id,
          );
      if (!mounted) return;
      final current = _detail;
      if (current == null) return;
      final at = current.posts.indexWhere((p) => p.id == post.id);
      if (at < 0) return;
      setState(() {
        _detail = current.copyWith(
          posts: _replacePost(
            current.posts,
            at,
            current.posts[at].copyWith(liked: result.liked, likeCount: result.likeCount),
          ),
        );
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      final current = _detail;
      if (current == null) return;
      final at = current.posts.indexWhere((p) => p.id == post.id);
      if (at >= 0) {
        setState(() {
          _detail = current.copyWith(posts: _replacePost(current.posts, at, post));
        });
      }
      _toast(e.message);
    } finally {
      if (mounted) setState(() => _postLikeBusy.remove(post.id));
    }
  }

  static List<TopicPost> _replacePost(List<TopicPost> posts, int index, TopicPost next) {
    final copy = List<TopicPost>.of(posts);
    copy[index] = next;
    return copy;
  }

  // ---------------------------------------------------------------- 切篇

  bool _onScrollNotification(ScrollNotification n) {
    // 从通知进来时不允许「到底继续滑 → 换下一篇」：那是推荐流的行为，
    // 在这里会把用户从「看某条回复」的任务里甩出去（快速上滑很容易误触）
    if (_switching || widget.entry != null) return false;

    if (n is OverscrollNotification) {
      // 只有「已到底还继续往上看」才算，顶部回弹不算
      final atBottom = n.metrics.pixels >= n.metrics.maxScrollExtent - _boundaryDistance;
      if (atBottom && n.overscroll > 0) {
        _overscroll += n.overscroll;
        _overscrollReset?.cancel();
        _overscrollReset = Timer(const Duration(milliseconds: 600), () => _overscroll = 0);
        if (_overscroll >= _switchThreshold) {
          _overscroll = 0;
          _goNext();
        }
      } else {
        _overscroll = 0;
      }
    } else if (n is ScrollEndNotification) {
      _overscroll = 0;
    }
    return false;
  }

  Future<void> _goNext() async {
    if (_switching) return;

    final queue = ref.read(readingQueueProvider);
    final repo = ref.read(topicRepositoryProvider);

    var next = queue.take();

    // 队列啃完了就去服务端补一批，带上已读 id 做排除，否则又会算回同一批。
    if (next == null) {
      _switching = true;
      try {
        queue.push(
          await repo.nextCandidates(topicId: widget.topicId, exclude: queue.seenIds),
        );
        next = queue.take();
      } on ApiException catch (e) {
        _toast(e.message);
      } finally {
        _switching = false;
      }
    }

    if (next == null) {
      _toast('下面没有了');
      return;
    }

    if (!mounted) return;

    _switching = true;
    final id = next.id;
    unawaited(repo.trackRecommendationClick(id));
    context.pushReplacement('/t/$id');
    // 新页面接管后本 State 会被销毁；这里延迟复位，兜底替换失败的情况
    Timer(const Duration(milliseconds: 400), () {
      if (mounted) _switching = false;
    });
  }

  // ---------------------------------------------------------------- 内容

  GlobalKey _keyFor(int postId) =>
      _postKeys.putIfAbsent(postId, () => GlobalKey(debugLabel: 'post-$postId'));

  List<Widget> _content() {
    final detail = _detail!;
    final topic = detail.topic;
    final targetId = _targetPostId;
    final targetFound = targetId != null && detail.posts.any((p) => p.id == targetId);
    final entry = widget.entry;

    return [
      if (entry != null && _bannerOpen)
        EntryBanner(
          entry: entry,
          located: targetFound,
          hasTarget: targetId != null,
          onLocate: () => _locatePost(targetId!, first: true),
          onDismiss: () => setState(() => _bannerOpen = false),
        ),
      _Header(topic: topic),
      if (topic.contentHtml.trim().isNotEmpty)
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
          child: ArticleWebView(html: topic.contentHtml),
        ),
      if (topic.tags.isNotEmpty) _Tags(tags: topic.tags),
      _RepliesHeader(key: _repliesKey, count: detail.posts.length),
      if (detail.posts.isEmpty)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 26),
          child: Center(
            child: Text(
              '还没有回复，去做第一个',
              style: TextStyle(fontSize: 13, color: Color(Env.muted)),
            ),
          ),
        )
      else
        for (var i = 0; i < detail.posts.length; i++)
          PostTile(
            key: _keyFor(detail.posts[i].id),
            post: detail.posts[i],
            floor: i + 1,
            highlighted: targetId != null && detail.posts[i].id == targetId,
            likeBusy: _postLikeBusy.contains(detail.posts[i].id),
            onLike: () => _togglePostLike(detail.posts[i]),
          ),
      // 从通知进来不串推荐：用户带着「看那条回复」的任务来，
      // 快速上滑到底就被换成另一篇，是会让人愣住的那种意外
      if (entry == null) _NextHint(next: ref.read(readingQueueProvider).peek),
      const SizedBox(height: 96),
    ];
  }

  Widget _scrollArea(double topInset) {
    final children = _content();
    final padding = EdgeInsets.only(top: topInset + kToolbarHeight);

    // 需要定位到某一层时改成全量构建：ListView 只建视口附近的子项，
    // 深层的楼层根本没有 Element，ensureVisible 拿不到目标（不是位置算错）。
    if (_targetPostId != null) {
      return SingleChildScrollView(
        controller: _scroll,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: padding,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: children,
        ),
      );
    }

    return ListView(
      controller: _scroll,
      physics: const AlwaysScrollableScrollPhysics(),
      padding: padding,
      children: children,
    );
  }

  // ---------------------------------------------------------------- 构建

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.of(context).padding.top;
    final signedIn = ref.watch(sessionProvider).isSignedIn;

    return Scaffold(
      backgroundColor: const Color(Env.bg),
      body: _buildBody(topInset),
      // 读到一半想回一句，入口就在拇指下面；详情没加载出来时不摆这一条，
      // 免得点了对着骨架发呆
      bottomNavigationBar: _detail == null
          ? null
          : ReplyBar(signedIn: signedIn, onTap: _openReply),
    );
  }

  Widget _buildBody(double topInset) {
    if (_loading) {
      return _SkeletonBody(topInset: topInset);
    }

    final error = _error;
    if (error != null || _detail == null) {
      return Padding(
        padding: EdgeInsets.only(top: topInset),
        child: ErrorView(
          title: error?.isNetwork == true ? '网络不通' : '打不开这篇',
          message: error?.message ?? '内容不存在。',
          onRetry: _load,
        ),
      );
    }

    final detail = _detail!;
    final topic = detail.topic;

    return Stack(
      children: [
        // 列表顶部留出顶栏高度，顶栏浮在上面做毛玻璃
        Positioned.fill(
          child: NotificationListener<ScrollNotification>(
            onNotification: _onScrollNotification,
            child: RefreshIndicator(
              color: const Color(Env.blue),
              backgroundColor: const Color(Env.surface),
              onRefresh: _load,
              child: _scrollArea(topInset),
            ),
          ),
        ),
        // 右下角竖排操作条
        Positioned(
          right: 10,
          bottom: 42,
          child: FloatDock(
            author: topic.author,
            interactions: detail.interactions,
            replyCount: detail.posts.length,
            likeBusy: _topicLikeBusy,
            followBusy: _followBusy,
            onLike: _toggleTopicLike,
            onBookmark: _toggleBookmark,
            onReply: _scrollToReplies,
            onShare: _share,
            onFollow: _toggleFollow,
            onAi: _openAi,
          ),
        ),
        // 顶栏放最上层，遮住滚上来的内容并做模糊
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: ValueListenableBuilder<double>(
            valueListenable: _offset,
            builder: (_, offset, _) => ReaderTopBar(
              offset: offset,
              title: topic.title,
              topInset: topInset,
              onBack: () => context.pop(),
              onOpenBrowser: _openInBrowser,
              // canEdit 由服务端判（作者本人或管理员），客户端不自己比 id。
              // 菜单对所有人都在：作者看到编辑/删除，其他人看到举报。
              onMore: _openMoreMenu,
            ),
          ),
        ),
      ],
    );
  }
}

/// 加载骨架：顶栏 + 标题占位，避免深色背景上一片空白被误认为卡死。
class _SkeletonBody extends StatelessWidget {
  const _SkeletonBody({required this.topInset});

  final double topInset;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(height: topInset + kToolbarHeight),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _bar(64, 12),
              const SizedBox(height: 10),
              _bar(double.infinity, 20),
              const SizedBox(height: 8),
              _bar(220, 20),
              const SizedBox(height: 18),
              _bar(120, 12),
              const SizedBox(height: 22),
              _bar(double.infinity, 14),
              const SizedBox(height: 10),
              _bar(double.infinity, 14),
              const SizedBox(height: 10),
              _bar(260, 14),
            ],
          ),
        ),
      ],
    );
  }

  Widget _bar(double width, double height) => Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: const Color(0xFF1A1F28),
          borderRadius: BorderRadius.circular(4),
        ),
      );
}

class _Header extends StatelessWidget {
  const _Header({required this.topic});

  final TopicSummary topic;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (topic.category != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                topic.category!.name,
                style: const TextStyle(fontSize: 11.5, color: Color(Env.blue)),
              ),
            ),
          Padding(
            // 给右侧浮动操作条让位，标题不撞到点赞按钮
            padding: const EdgeInsets.only(right: 34),
            child: Text(
              topic.title,
              style: const TextStyle(
                fontSize: 21,
                height: 1.38,
                fontWeight: FontWeight.w700,
                color: Color(Env.text),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              // 头像和昵称一起可点：这是「想看看这个人还写过什么」最自然的落点
              GestureDetector(
                onTap: () => context.push('/u/${topic.author.username}'),
                behavior: HitTestBehavior.opaque,
                child: Row(
                  children: [
                    _Avatar(author: topic.author),
                    const SizedBox(width: 8),
                    Text(
                      topic.author.displayName,
                      style: const TextStyle(fontSize: 12.5, color: Color(Env.text)),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Text(
                relativeTime(topic.publishedAt),
                style: const TextStyle(fontSize: 12, color: Color(0xFF6E7887)),
              ),
              const Spacer(),
              const Icon(Icons.visibility_outlined, size: 13, color: Color(0xFF5C6675)),
              const SizedBox(width: 4),
              Text(
                compactCount(topic.viewCount),
                style: const TextStyle(fontSize: 11.5, color: Color(0xFF5C6675)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Tags extends StatelessWidget {
  const _Tags({required this.tags});

  final List<TagRef> tags;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final tag in tags)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(Env.panel),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                '#${tag.name}',
                style: const TextStyle(fontSize: 11.5, color: Color(Env.muted)),
              ),
            ),
        ],
      ),
    );
  }
}

class _RepliesHeader extends StatelessWidget {
  const _RepliesHeader({super.key, required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 8),
      child: Row(
        children: [
          Text(
            count == 0 ? '回复' : '$count 条回复',
            style: const TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w600,
              color: Color(Env.text),
            ),
          ),
        ],
      ),
    );
  }
}

/// 列表末尾的「继续下滑」提示，呼应网页的滑到底切篇。
class _NextHint extends StatelessWidget {
  const _NextHint({required this.next});

  final TopicRef? next;

  @override
  Widget build(BuildContext context) {
    final target = next;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 26, 16, 0),
      child: Column(
        children: [
          Icon(
            Icons.keyboard_double_arrow_down,
            size: 18,
            color: const Color(Env.muted).withValues(alpha: 0.7),
          ),
          const SizedBox(height: 6),
          Text(
            target == null ? '继续下滑 · 换一批推荐' : '继续下滑 · ${target.title}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 12,
              color: const Color(Env.muted).withValues(alpha: 0.8),
            ),
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
      return ClipOval(
        child: Image.network(
          url,
          width: 24,
          height: 24,
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) => _fallback(),
        ),
      );
    }
    return _fallback();
  }

  Widget _fallback() => Container(
        width: 24,
        height: 24,
        alignment: Alignment.center,
        decoration: const BoxDecoration(
          color: Color(Env.panel),
          shape: BoxShape.circle,
        ),
        child: Text(
          author.initial,
          style: const TextStyle(fontSize: 10.5, color: Color(Env.muted)),
        ),
      );
}
