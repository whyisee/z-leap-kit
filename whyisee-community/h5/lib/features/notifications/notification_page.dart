import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/models.dart';
import '../../core/env.dart';
import '../../core/providers.dart';
import '../errors/error_view.dart';
import 'notification_controller.dart';

/// 原生通知页。
///
/// 网页版是「左侧按来源人分组 + 右侧列表」的两栏消息中心，手机上照搬只会变成
/// 满屏侧栏。这里换成：顶部分档（全部 / 回复 / @我 / 赞 / 系统）+ 单列时间线，
/// 按「今天 / 昨天 / 本周 / 更早」分段 —— 通知是时间敏感的东西，先按时间扫，
/// 比先按人扫有用。
///
/// 私信不在这里：服务端已经把 `direct_message` 排除了。私信是聊天，需要气泡、
/// 输入框、已读回执，塞进通知列表只会两边都不好用。
class NotificationPage extends ConsumerStatefulWidget {
  const NotificationPage({super.key});

  @override
  ConsumerState<NotificationPage> createState() => _NotificationPageState();
}

class _NotificationPageState extends ConsumerState<NotificationPage> {
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController
      ..removeListener(_onScroll)
      ..dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final position = _scrollController.position;
    if (position.pixels < position.maxScrollExtent - 500) return;
    ref.read(notificationControllerProvider.notifier).loadMore();
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final state = ref.watch(notificationControllerProvider);
    final controller = ref.read(notificationControllerProvider.notifier);

    return Scaffold(
      backgroundColor: const Color(Env.bg),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _Header(
              counts: state.counts,
              markingAll: state.markingAll,
              onBack: () => context.pop(),
              onMarkAll: session.isSignedIn ? controller.markAllRead : null,
            ),
            if (session.isSignedIn)
              _FilterBar(
                filter: state.filter,
                counts: state.counts,
                onChanged: (filter) {
                  if (_scrollController.hasClients) _scrollController.jumpTo(0);
                  controller.changeFilter(filter);
                },
              ),
            Expanded(
              child: switch (session.status) {
                SessionStatus.unknown => const _Skeleton(),
                SessionStatus.signedOut => const _SignedOut(),
                SessionStatus.signedIn => _buildContent(state, controller),
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContent(NotificationState state, NotificationController controller) {
    if (state.isInitialLoading) return const _Skeleton();

    if (state.error != null && state.items.isEmpty) {
      // 404 = 线上还是旧版本、没有 /api/v1/notifications
      final notDeployed = state.error!.statusCode == 404;
      return ErrorView(
        title: notDeployed ? '服务端还没更新' : '加载失败',
        message: notDeployed
            ? '线上还没有 /api/v1/notifications，部署后这里就是你的通知。'
            : state.error!.message,
        onRetry: controller.refresh,
      );
    }

    final rows = _buildRows(state.items);

    return RefreshIndicator(
      color: const Color(Env.blue),
      backgroundColor: const Color(Env.surface),
      edgeOffset: 2,
      onRefresh: controller.refresh,
      child: state.isEmpty
          ? _Empty(filter: state.filter)
          : ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.only(bottom: 40),
              physics: const AlwaysScrollableScrollPhysics(),
              itemCount: rows.length + 1,
              itemBuilder: (context, index) {
                if (index == rows.length) {
                  return _Footer(
                    loading: state.loadingMore,
                    hasMore: state.hasMore,
                    error: state.loadingMore ? null : state.error?.message,
                    onRetry: controller.loadMore,
                  );
                }

                final row = rows[index];
                if (row.header != null) return _DateHeader(label: row.header!);

                final item = row.item!;
                return _NotificationRow(
                  item: item,
                  onTap: () => _open(item, controller),
                );
              },
            ),
    );
  }

  /// 点开：先本地置已读（返回时那一行不再亮着），再跳目标。
  ///
  /// 能解析出帖子 id 就走原生阅读器，其余的（任务、举报、设置类）交给网页容器。
  void _open(NotificationItem item, NotificationController controller) {
    controller.markRead(item);

    final topicId = item.topicId;
    if (topicId != null && topicId > 0) {
      context.push('/me/notifications/t/$topicId');
      return;
    }

    context.push(
      '/web?path=${Uri.encodeComponent(item.href)}&title=${Uri.encodeComponent('通知')}',
    );
  }
}

/// 把时间线摊平成「日期标题 + 条目」的序列，交给一个 ListView 渲染。
///
/// 分成两层会让分页续接变麻烦（每个分组各自维护 itemCount），摊平后
/// 续页只要在末尾追加条目，分组标题自然重复就再插一个。
List<_Row> _buildRows(List<NotificationItem> items) {
  final rows = <_Row>[];
  String? lastBucket;

  for (final item in items) {
    final bucket = _bucketOf(item.at);
    if (bucket != lastBucket) {
      rows.add(_Row.header(bucket));
      lastBucket = bucket;
    }
    rows.add(_Row.item(item));
  }

  return rows;
}

String _bucketOf(DateTime? at) {
  if (at == null) return '更早';

  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final day = DateTime(at.year, at.month, at.day);
  final diff = today.difference(day).inDays;

  if (diff <= 0) return '今天';
  if (diff == 1) return '昨天';
  if (diff < 7) return '本周';
  return '更早';
}

class _Row {
  const _Row.header(this.header) : item = null;
  const _Row.item(this.item) : header = null;

  final String? header;
  final NotificationItem? item;
}

class _Header extends StatelessWidget {
  const _Header({
    required this.counts,
    required this.markingAll,
    required this.onBack,
    required this.onMarkAll,
  });

  final NotificationCounts counts;
  final bool markingAll;
  final VoidCallback onBack;
  final VoidCallback? onMarkAll;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 46,
      padding: const EdgeInsets.only(left: 4, right: 8),
      decoration: const BoxDecoration(
        color: Color(Env.bg),
        border: Border(bottom: BorderSide(color: Color(Env.line), width: 1)),
      ),
      child: Row(
        children: [
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onBack,
            child: const SizedBox(
              width: 38,
              height: 46,
              child: Icon(Icons.arrow_back_ios_new, size: 16, color: Color(Env.text)),
            ),
          ),
          const Text(
            '通知',
            style: TextStyle(
              fontSize: 16.5,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.4,
              color: Color(Env.text),
            ),
          ),
          const Spacer(),
          if (counts.total > 0 && onMarkAll != null)
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: markingAll ? null : onMarkAll,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                child: Text(
                  markingAll ? '处理中' : '全部已读',
                  style: const TextStyle(fontSize: 12.5, color: Color(Env.blue)),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// 五档分段条：一次全可见，不分页不横滚。
///
/// 每档后面直接跟未读数 —— 通知页最痛的就是「哪一档有新东西」要靠一档档点进去找。
class _FilterBar extends StatelessWidget {
  const _FilterBar({
    required this.filter,
    required this.counts,
    required this.onChanged,
  });

  final NotificationFilter filter;
  final NotificationCounts counts;
  final ValueChanged<NotificationFilter> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 8, 12, 8),
      height: 34,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: const Color(0xFF12161E),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0x0FFFFFFF)),
      ),
      child: Row(
        children: [
          for (final item in NotificationFilter.values)
            Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => onChanged(item),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  curve: Curves.easeOut,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: item == filter ? const Color(0x268AB4F8) : Colors.transparent,
                    borderRadius: BorderRadius.circular(7),
                  ),
                  child: _FilterLabel(
                    label: item.label,
                    count: counts.of(item),
                    active: item == filter,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _FilterLabel extends StatelessWidget {
  const _FilterLabel({required this.label, required this.count, required this.active});

  final String label;
  final int count;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final color = active ? const Color(Env.blue) : const Color(0xFF8A939F);

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: active ? FontWeight.w700 : FontWeight.w500,
            color: color,
          ),
        ),
        if (count > 0) ...[
          const SizedBox(width: 3),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 0.5),
            decoration: BoxDecoration(
              // 未读计数用实心小胶囊：纯数字在深色底上容易糊进背景
              color: active ? const Color(0x338AB4F8) : const Color(0x1FF4737E),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              count > 99 ? '99+' : '$count',
              style: TextStyle(
                fontSize: 9.5,
                height: 1.3,
                fontWeight: FontWeight.w700,
                color: active ? const Color(Env.blue) : const Color(0xFFF4737E),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _DateHeader extends StatelessWidget {
  const _DateHeader({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
      child: Row(
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
              color: Color(0xFF6B7686),
            ),
          ),
          const SizedBox(width: 8),
          const Expanded(child: Divider(height: 1, color: Color(0x0FFFFFFF))),
        ],
      ),
    );
  }
}

/// 一条通知：头像 + 谁/什么时候 + 发生了什么 + 内容摘要。
class _NotificationRow extends StatelessWidget {
  const _NotificationRow({required this.item, required this.onTap});

  final NotificationItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final unread = !item.read;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Stack(
        children: [
          Container(
            // 未读底色非常克制：整行高亮会让十条未读变成一屏彩色块
            color: unread ? const Color(0x0A8AB4F8) : Colors.transparent,
            padding: const EdgeInsets.fromLTRB(16, 11, 16, 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _Avatar(item: item),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          if (unread) ...[
                            Container(
                              width: 5,
                              height: 5,
                              decoration: const BoxDecoration(
                                color: Color(Env.blue),
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 5),
                          ],
                          Flexible(
                            child: Text(
                              item.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 13,
                                height: 1.4,
                                fontWeight: unread ? FontWeight.w700 : FontWeight.w500,
                                color: unread
                                    ? const Color(Env.text)
                                    : const Color(0xFFA8B0BC),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            item.timeLabel,
                            style: const TextStyle(fontSize: 10.5, color: Color(0xFF5F6875)),
                          ),
                        ],
                      ),
                      if (item.body.trim().isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          item.body,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12.5,
                            height: 1.55,
                            color: Color(0xFF8A939F),
                          ),
                        ),
                      ],
                      const SizedBox(height: 5),
                      Row(
                        children: [
                          Icon(
                            _kindIcon(item.kind),
                            size: 11,
                            color: const Color(0xFF5F6875),
                          ),
                          const SizedBox(width: 4),
                          Flexible(
                            child: Text(
                              _kindLabel(item),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 11, color: Color(0xFF5F6875)),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          // 缩进对齐头像左缘：和网页版的通知列表一样，分隔线不顶到屏幕边
          const Positioned(
            left: 64,
            right: 16,
            bottom: 0,
            child: Divider(height: 1, thickness: 1, color: Color(0x0DFFFFFF)),
          ),
        ],
      ),
    );
  }

  /// 「谁做的」优先写人名；系统通知没有作者，就写通知类型。
  String _kindLabel(NotificationItem item) {
    final actor = item.actorName?.trim();
    final who = (actor != null && actor.isNotEmpty) ? actor : '系统';
    return switch (item.kind) {
      'mention' => '$who 在回复里提到了你',
      'like' => '$who 赞了你',
      'reply' => '$who 的这条回复',
      _ => item.type == 'topic_pending' ? '等待审核' : '$who · 系统通知',
    };
  }

  IconData _kindIcon(String kind) => switch (kind) {
        'mention' => Icons.alternate_email,
        'like' => Icons.favorite_border,
        'reply' => Icons.chat_bubble_outline,
        _ => Icons.campaign_outlined,
      };
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.item});

  final NotificationItem item;

  @override
  Widget build(BuildContext context) {
    final url = item.actorAvatarUrl;
    final initial = item.initial;

    return Container(
      width: 38,
      height: 38,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: const Color(Env.panel),
        shape: BoxShape.circle,
        border: Border.all(color: const Color(0x14FFFFFF)),
      ),
      child: url != null && url.isNotEmpty
          ? Image.network(
              url,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => _fallback(initial),
            )
          : _fallback(initial),
    );
  }

  Widget _fallback(String initial) {
    if (initial.isEmpty) {
      return Center(
        child: Icon(_kindIcon(item.kind), size: 17, color: const Color(0xFF8A939F)),
      );
    }

    return Center(
      child: Text(
        initial,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w700,
          color: Color(0xFFA8B0BC),
        ),
      ),
    );
  }

  IconData _kindIcon(String kind) => switch (kind) {
        'mention' => Icons.alternate_email,
        'like' => Icons.favorite_border,
        'reply' => Icons.chat_bubble_outline,
        _ => Icons.campaign_outlined,
      };
}

class _Footer extends StatelessWidget {
  const _Footer({
    required this.loading,
    required this.hasMore,
    required this.onRetry,
    this.error,
  });

  final bool loading;
  final bool hasMore;
  final String? error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    if (error != null) {
      return Padding(
        padding: const EdgeInsets.only(top: 16),
        child: Center(child: TextButton(onPressed: onRetry, child: Text('$error 点击重试'))),
      );
    }

    if (loading) {
      return const Padding(
        padding: EdgeInsets.only(top: 20),
        child: Center(
          child: SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(strokeWidth: 2, color: Color(Env.muted)),
          ),
        ),
      );
    }

    if (hasMore) return const SizedBox(height: 8);

    return Padding(
      padding: const EdgeInsets.only(top: 20),
      child: Center(
        child: Text(
          '没有更多了',
          style: TextStyle(
            fontSize: 11.5,
            letterSpacing: 0.6,
            color: const Color(Env.muted).withValues(alpha: 0.6),
          ),
        ),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.filter});

  final NotificationFilter filter;

  @override
  Widget build(BuildContext context) {
    final hint = switch (filter) {
      NotificationFilter.all => '有人回复你、@ 你、赞你时，会出现在这里。',
      NotificationFilter.replies => '还没有人回复你的话题或评论。',
      NotificationFilter.mentions => '还没有人在回复里 @ 你。',
      NotificationFilter.likes => '还没有收到赞。',
      NotificationFilter.system => '没有系统通知。审核结果会发到这里。',
    };

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(24, 90, 24, 0),
      children: [
        Icon(
          Icons.notifications_none,
          size: 30,
          color: const Color(Env.muted).withValues(alpha: 0.5),
        ),
        const SizedBox(height: 12),
        const Center(
          child: Text(
            '这里还是空的',
            style: TextStyle(fontSize: 13.5, color: Color(Env.muted)),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          hint,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 11.5,
            height: 1.7,
            color: const Color(Env.muted).withValues(alpha: 0.6),
          ),
        ),
      ],
    );
  }
}

class _SignedOut extends StatelessWidget {
  const _SignedOut();

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 30, 16, 0),
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 22),
          decoration: BoxDecoration(
            color: const Color(Env.surface),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(Env.line)),
          ),
          child: Column(
            children: [
              Container(
                width: 54,
                height: 54,
                decoration: const BoxDecoration(color: Color(Env.panel), shape: BoxShape.circle),
                child: const Icon(Icons.notifications_none, size: 24, color: Color(Env.muted)),
              ),
              const SizedBox(height: 14),
              const Text(
                '登录后查看通知',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: Color(Env.text),
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                '谁回复了你、谁 @ 了你、谁的赞，\n都收在这里。',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12.5, height: 1.6, color: Color(Env.muted)),
              ),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => context.push(
                    '/web?path=${Uri.encodeComponent('/login')}&title=${Uri.encodeComponent('登录')}',
                  ),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(Env.blue),
                    foregroundColor: const Color(0xFF0D1016),
                    minimumSize: const Size.fromHeight(42),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: const Text(
                    '去登录',
                    style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// 骨架：按真实行的形状画（头像 + 标题 + 摘要），加载完不跳版。
class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.only(top: 8),
      itemCount: 6,
      itemBuilder: (context, index) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 11, 16, 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: const BoxDecoration(color: Color(0xFF1D222C), shape: BoxShape.circle),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _bar(width: 150, height: 9),
                  const SizedBox(height: 8),
                  _bar(width: double.infinity, height: 11),
                  const SizedBox(height: 6),
                  _bar(width: 90, height: 8),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _bar({required double width, required double height}) => Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: const Color(0xFF1D222C),
          borderRadius: BorderRadius.circular(3),
        ),
      );
}
