import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/models.dart';
import '../../core/env.dart';
import '../errors/error_view.dart';
import 'go_controller.dart';
import 'go_repository.dart';
import 'widgets/participation_card.dart';

/// 原生「出发」页。
///
/// 网页版这一页是「左侧大色块 + 单列参与卡 + 右侧统计栏」，手机上两列会挤成一团。
/// 移动端重做取舍：
/// - 顶部只留标题 + 一句说明，筛选压成一行可横滚的胶囊（六个筛选一次看不全，但不抢高度）；
/// - 卡片内部把网页右侧的统计栏折到底部一行，行动按钮贴右下；
/// - 点击整张卡或按钮都进详情，帖子进原生阅读器，社区任务仍走网页版。
class GoPage extends ConsumerStatefulWidget {
  const GoPage({super.key});

  @override
  ConsumerState<GoPage> createState() => _GoPageState();
}

class _GoPageState extends ConsumerState<GoPage> {
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
    ref.read(goControllerProvider.notifier).loadMore();
  }

  void _resetScroll() {
    if (_scrollController.hasClients) _scrollController.jumpTo(0);
  }

  /// 帖子进原生详情（挂在 /go 这条栈下，返回回到本页）；其余页面仍用网页版。
  void _open(ParticipationItem item) {
    final topicId = item.topicId;
    if (topicId != null && topicId > 0) {
      context.push('/go/t/$topicId');
      return;
    }

    final path = item.href.isEmpty ? '/go' : item.href;
    context.push('/go/page?path=${Uri.encodeComponent(path)}&title=${Uri.encodeComponent(item.actionLabel)}');
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(goControllerProvider);
    final controller = ref.read(goControllerProvider.notifier);

    return Scaffold(
      backgroundColor: const Color(Env.bg),
      body: Column(
        children: [
          _Header(
            filter: state.filter,
            onFilterChanged: (filter) {
              _resetScroll();
              controller.changeFilter(filter);
            },
          ),
          Expanded(child: _buildContent(state, controller)),
        ],
      ),
    );
  }

  Widget _buildContent(GoState state, GoController controller) {
    if (state.isInitialLoading) return const _Skeleton();

    if (state.error != null && state.items.isEmpty) {
      final notDeployed = state.error!.code == 'not_found';
      return ErrorView(
        title: notDeployed ? '服务端还没更新' : '加载失败',
        message: notDeployed
            ? '线上还没有 /api/v1/participation，跑一次 deploy/release.sh 再回来。'
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
          ? _EmptyState(onRefresh: controller.refresh)
          : ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.only(top: 6, bottom: 96),
              physics: const AlwaysScrollableScrollPhysics(),
              itemCount: state.items.length + 1,
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
                return ParticipationCard(item: item, onTap: () => _open(item));
              },
            ),
    );
  }
}

/// 头部：标题 + 说明 + 筛选胶囊条。说明只留一行，手机上不值得占两行。
class _Header extends StatelessWidget {
  const _Header({required this.filter, required this.onFilterChanged});

  final GoFilter filter;
  final ValueChanged<GoFilter> onFilterChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 6, 0, 8),
      decoration: const BoxDecoration(
        color: Color(Env.bg),
        border: Border(bottom: BorderSide(color: Color(Env.line), width: 1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '出发',
            style: TextStyle(
              fontSize: 22,
              height: 1.2,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.2,
              color: Color(Env.text),
            ),
          ),
          const SizedBox(height: 4),
          const Padding(
            padding: EdgeInsets.only(right: 16),
            child: Text(
              '现在最值得参与的讨论、项目、问题和任务',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 11.5, height: 1.4, color: Color(0xFF737D8B)),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 30,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.only(right: 16),
              itemCount: GoFilter.values.length,
              separatorBuilder: (_, _) => const SizedBox(width: 7),
              itemBuilder: (context, index) {
                final item = GoFilter.values[index];
                return _FilterChip(
                  label: item.label,
                  selected: item == filter,
                  onTap: () => onFilterChanged(item),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 140),
        padding: const EdgeInsets.symmetric(horizontal: 12),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? const Color(0x268AB4F8) : const Color(0x0DFFFFFF),
          borderRadius: BorderRadius.circular(15),
          border: Border.all(
            color: selected ? const Color(0x558AB4F8) : const Color(0x14FFFFFF),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
            color: selected ? const Color(Env.blue) : const Color(0xFF8A939F),
          ),
        ),
      ),
    );
  }
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
        child: Center(
          child: TextButton(onPressed: onRetry, child: Text('$error 点击重试')),
        ),
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
          '就这些了',
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

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.onRefresh});

  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        const SizedBox(height: 110),
        Icon(
          Icons.explore_outlined,
          size: 30,
          color: const Color(Env.muted).withValues(alpha: 0.5),
        ),
        const SizedBox(height: 12),
        const Center(
          child: Text(
            '暂时没有匹配的参与项',
            style: TextStyle(fontSize: 13.5, color: Color(Env.muted)),
          ),
        ),
        const SizedBox(height: 6),
        Center(
          child: Text(
            '换个筛选，或者下拉刷新',
            style: TextStyle(
              fontSize: 11.5,
              color: const Color(Env.muted).withValues(alpha: 0.55),
            ),
          ),
        ),
      ],
    );
  }
}

/// 骨架：形状按真卡片走（徽章条 / 两行标题 / 摘要 / 底部统计），加载完不跳版。
class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.only(top: 6),
      itemCount: 5,
      itemBuilder: (context, index) => Container(
        margin: const EdgeInsets.fromLTRB(14, 5, 14, 5),
        padding: const EdgeInsets.fromLTRB(14, 13, 14, 14),
        decoration: BoxDecoration(
          color: const Color(Env.surface),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0x0FFFFFFF)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _bar(width: 58, height: 16, radius: 8),
            const SizedBox(height: 11),
            _bar(width: double.infinity, height: 15),
            const SizedBox(height: 7),
            _bar(width: 220, height: 12),
            const SizedBox(height: 14),
            Row(
              children: [
                _bar(width: 96, height: 9),
                const Spacer(),
                _bar(width: 62, height: 26, radius: 14),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _bar({required double width, required double height, double radius = 4}) =>
      Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: const Color(0xFF1D222C),
          borderRadius: BorderRadius.circular(radius),
        ),
      );
}
