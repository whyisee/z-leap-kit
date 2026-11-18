import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/models.dart';
import '../../core/env.dart';
import '../../core/format.dart';
import '../../core/providers.dart';
import '../errors/error_view.dart';
import 'following_controller.dart';

/// 原生「关注」流 = 订阅流。
///
/// 和「看见」是两个东西，所以视觉也刻意不共用卡片：
/// - 看见是杂志式卡片（作者、封面、互动数），回答「现在有什么可读的」；
/// - 关注是扁平列表，每行第一句必须说清**这条是谁带来的**（来自某作者 / 某标签 / 某分类），
///   回答「我订阅的东西有动静了吗」。
///
/// 因此这里不画大卡片，改用细竖排列表 + 顶部来源行，密度更高，扫一眼能看七八条。
class FollowingPage extends ConsumerStatefulWidget {
  const FollowingPage({super.key});

  @override
  ConsumerState<FollowingPage> createState() => _FollowingPageState();
}

class _FollowingPageState extends ConsumerState<FollowingPage> {
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
    if (position.pixels < position.maxScrollExtent - 600) return;
    ref.read(followingControllerProvider.notifier).loadMore();
  }

  void _resetScroll() {
    if (_scrollController.hasClients) _scrollController.jumpTo(0);
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final state = ref.watch(followingControllerProvider);
    final controller = ref.read(followingControllerProvider.notifier);

    return Scaffold(
      backgroundColor: const Color(Env.bg),
      body: Column(
        children: [
          _Header(
            filter: state.filter,
            count: state.items.length,
            signedIn: session.isSignedIn,
            onFilterChanged: (filter) {
              _resetScroll();
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
    );
  }

  Widget _buildContent(FollowingState state, FollowingController controller) {
    if (state.isInitialLoading) return const _Skeleton();

    if (state.error != null && state.items.isEmpty) {
      // 404 = 线上还是旧版本、没有 /api/v1/following。这种要说人话，
      // 不然用户看到「接口不存在」只会以为 App 坏了。
      final notDeployed = state.error!.statusCode == 404;
      return ErrorView(
        title: notDeployed ? '服务端还没更新' : '加载失败',
        message: notDeployed
            ? '线上还没有 /api/v1/following，部署后这里就是你的订阅流。'
            : state.error!.message,
        onRetry: controller.refresh,
      );
    }

    return RefreshIndicator(
      color: const Color(Env.blue),
      backgroundColor: const Color(Env.surface),
      edgeOffset: 2,
      onRefresh: controller.refresh,
      child: state.isEmpty
          ? _Empty(filter: state.filter)
          : ListView.separated(
              controller: _scrollController,
              padding: const EdgeInsets.only(top: 2, bottom: 96),
              physics: const AlwaysScrollableScrollPhysics(),
              itemCount: state.items.length + 1,
              separatorBuilder: (context, index) => index == state.items.length - 1
                  ? const SizedBox.shrink()
                  : const Divider(
                      height: 1,
                      thickness: 1,
                      indent: 16,
                      endIndent: 16,
                      color: Color(0x0FFFFFFF),
                    ),
              itemBuilder: (context, index) {
                if (index == state.items.length) {
                  return _Footer(
                    loading: state.loadingMore,
                    hasMore: state.hasMore,
                    error: state.loadingMore ? null : state.error?.message,
                    onRetry: controller.loadMore,
                  );
                }

                final item = state.items[index];
                return _FollowingRow(
                  item: item,
                  onTap: () => context.push('/following/t/${item.topicId}'),
                );
              },
            ),
    );
  }
}

/// 头部：标题 + 已加载条数 + 五个过滤维度（一次全可见，不横滚）。
class _Header extends StatelessWidget {
  const _Header({
    required this.filter,
    required this.count,
    required this.signedIn,
    required this.onFilterChanged,
  });

  final FollowingFilter filter;
  final int count;
  final bool signedIn;
  final ValueChanged<FollowingFilter> onFilterChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 10),
      decoration: const BoxDecoration(
        color: Color(Env.bg),
        border: Border(bottom: BorderSide(color: Color(Env.line), width: 1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              const Text(
                '关注',
                style: TextStyle(
                  fontSize: 22,
                  height: 1.2,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1.2,
                  color: Color(Env.text),
                ),
              ),
              const Spacer(),
              if (signedIn && count > 0)
                Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Text(
                    '$count 条更新',
                    style: const TextStyle(fontSize: 11, color: Color(0xFF6B7686)),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          _FilterBar(filter: filter, onChanged: onFilterChanged),
        ],
      ),
    );
  }
}

class _FilterBar extends StatelessWidget {
  const _FilterBar({required this.filter, required this.onChanged});

  final FollowingFilter filter;
  final ValueChanged<FollowingFilter> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 34,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: const Color(0xFF12161E),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0x0FFFFFFF)),
      ),
      child: Row(
        children: [
          for (final item in FollowingFilter.values)
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
                  child: Text(
                    item.label,
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: item == filter ? FontWeight.w700 : FontWeight.w500,
                      color: item == filter ? const Color(Env.blue) : const Color(0xFF8A939F),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// 一行 = 「谁带来的」+ 标题 + 摘要 + 标签/时间。
class _FollowingRow extends StatelessWidget {
  const _FollowingRow({required this.item, required this.onTap});

  final FollowingItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final category = item.category;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 13),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(_sourceIcon(item.sourceType), size: 12, color: const Color(0xFF6B7686)),
                const SizedBox(width: 4),
                Flexible(
                  child: Text(
                    '${item.sourcePrefix} ${item.sourceLabel}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11.5, color: Color(0xFF7C8798)),
                  ),
                ),
                if (category != null) ...[
                  const SizedBox(width: 7),
                  Container(
                    width: 4,
                    height: 4,
                    decoration: BoxDecoration(
                      color: colorFromHex(category.color),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    category.name,
                    style: const TextStyle(fontSize: 11.5, color: Color(0xFF7C8798)),
                  ),
                ],
                const Spacer(),
                Text(
                  item.timeLabel,
                  style: const TextStyle(fontSize: 11, color: Color(0xFF5F6875)),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              item.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 15.5,
                height: 1.45,
                fontWeight: FontWeight.w600,
                color: Color(Env.text),
              ),
            ),
            if (item.summary.trim().isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                item.summary,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12.5, height: 1.6, color: Color(0xFF8A939F)),
              ),
            ],
            if (item.tags.isNotEmpty) ...[
              const SizedBox(height: 7),
              Row(
                children: [
                  for (final tag in item.tags.take(3)) ...[
                    Text(
                      '#${tag.name}',
                      style: const TextStyle(fontSize: 11.5, color: Color(0xFF6E9BD8)),
                    ),
                    const SizedBox(width: 9),
                  ],
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  IconData _sourceIcon(String sourceType) => switch (sourceType) {
        'user' => Icons.person_outline,
        'category' => Icons.folder_outlined,
        'tag' => Icons.tag,
        _ => Icons.forum_outlined,
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
        padding: const EdgeInsets.only(top: 18),
        child: Center(child: TextButton(onPressed: onRetry, child: Text('$error 点击重试'))),
      );
    }

    if (loading) {
      return const Padding(
        padding: EdgeInsets.only(top: 22),
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
      padding: const EdgeInsets.only(top: 22),
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

/// 登录后的空态：按过滤维度给不同说法 —— 「全部」为空和「标签」为空是两回事。
class _Empty extends StatelessWidget {
  const _Empty({required this.filter});

  final FollowingFilter filter;

  @override
  Widget build(BuildContext context) {
    final hint = switch (filter) {
      FollowingFilter.all => '你关注的话题、作者、分类和标签都还没有新动态。',
      FollowingFilter.topics => '你关注的话题还没有新回复。',
      FollowingFilter.users => '你关注的作者最近没发新帖。',
      FollowingFilter.categories => '你关注的分类里没有新内容。',
      FollowingFilter.tags => '你关注的标签暂时没有新帖。',
    };

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(24, 96, 24, 0),
      children: [
        Icon(
          Icons.people_outline,
          size: 30,
          color: const Color(Env.muted).withValues(alpha: 0.5),
        ),
        const SizedBox(height: 12),
        const Center(
          child: Text(
            '这里还没有动静',
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
        const SizedBox(height: 18),
        Center(
          child: TextButton(
            onPressed: () => context.go('/'),
            child: const Text(
              '去看见找点东西关注',
              style: TextStyle(fontSize: 12.5, color: Color(Env.blue)),
            ),
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
                child: const Icon(Icons.people_outline, size: 24, color: Color(Env.muted)),
              ),
              const SizedBox(height: 14),
              const Text(
                '登录后查看你的关注',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: Color(Env.text),
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                '关注话题、作者、分类和标签后，\n这里会变成你自己的订阅流。',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12.5, height: 1.6, color: Color(Env.muted)),
              ),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => context.push('/login'),
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

/// 骨架：按真实行的形状画（来源行 / 标题 / 摘要），加载完不跳版。
class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.only(top: 2),
      itemCount: 6,
      itemBuilder: (context, index) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 13),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _bar(width: 60, height: 8),
                const Spacer(),
                _bar(width: 34, height: 8),
              ],
            ),
            const SizedBox(height: 9),
            _bar(width: double.infinity, height: 14),
            const SizedBox(height: 6),
            _bar(width: 220, height: 11),
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
