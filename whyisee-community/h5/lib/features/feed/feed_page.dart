import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/env.dart';
import '../errors/error_view.dart';
import 'feed_controller.dart';
import 'feed_repository.dart';
import 'widgets/topic_card.dart';

/// 原生「看见」流。
///
/// 移动端重新设计的一版：
/// - 顶部是常驻的紧凑头部（大标题 + 等分分段控件），不再是可横向滚动的小胶囊；
/// - 列表用卡片 + 留白分隔，替代网页那种贯穿全宽的 1px 分隔线；
/// - 滚动超过一屏出现「回到顶部」，长列表里不用一路往回搓。
class FeedPage extends ConsumerStatefulWidget {
  const FeedPage({super.key});

  @override
  ConsumerState<FeedPage> createState() => _FeedPageState();
}

class _FeedPageState extends ConsumerState<FeedPage> {
  final _scrollController = ScrollController();
  final _showToTop = ValueNotifier<bool>(false);

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
    _showToTop.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final position = _scrollController.position;

    // 堆了两屏以上才值得给「回到顶部」，短列表里冒出来反而碍事
    final showToTop = position.pixels > 1400;
    if (_showToTop.value != showToTop) _showToTop.value = showToTop;

    // 距底部还有约一屏半时预取
    if (position.pixels < position.maxScrollExtent - 600) return;
    ref.read(feedControllerProvider.notifier).loadMore();
  }

  void _backToTop() {
    _scrollController.animateTo(
      0,
      duration: const Duration(milliseconds: 420),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(feedControllerProvider);
    final controller = ref.read(feedControllerProvider.notifier);

    return Scaffold(
      backgroundColor: const Color(Env.bg),
      body: Column(
        children: [
          _Header(
            sort: state.sort,
            onSortChanged: controller.changeSort,
          ),
          Expanded(
            child: Stack(
              children: [
                Positioned.fill(child: _buildContent(state, controller)),
                Positioned(
                  right: 14,
                  bottom: 20,
                  child: ValueListenableBuilder<bool>(
                    valueListenable: _showToTop,
                    builder: (_, visible, _) => AnimatedScale(
                      duration: const Duration(milliseconds: 160),
                      scale: visible ? 1 : 0.6,
                      child: AnimatedOpacity(
                        duration: const Duration(milliseconds: 160),
                        opacity: visible ? 1 : 0,
                        child: IgnorePointer(
                          ignoring: !visible,
                          child: _ToTopButton(onTap: _backToTop),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContent(FeedState state, FeedController controller) {
    if (state.isInitialLoading) return const _Skeleton();

    if (state.error != null && state.items.isEmpty) {
      return ErrorView(
        title: '加载失败',
        message: state.error!.message,
        onRetry: () => controller.changeSort(state.sort),
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

                final topic = state.items[index];
                return TopicCard(
                  topic: topic,
                  onTap: () => context.push('/t/${topic.id}'),
                );
              },
            ),
    );
  }
}

/// 头部：大标题 + 等分分段控件。不做滚动收缩，避免每帧重建和高度跳变。
class _Header extends StatelessWidget {
  const _Header({required this.sort, required this.onSortChanged});

  final FeedSort sort;
  final ValueChanged<FeedSort> onSortChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 8),
      decoration: const BoxDecoration(
        color: Color(Env.bg),
        border: Border(bottom: BorderSide(color: Color(Env.line), width: 1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.only(left: 2, bottom: 10),
            child: Text(
              '看见',
              style: TextStyle(
                fontSize: 24,
                height: 1.2,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.2,
                color: Color(Env.text),
              ),
            ),
          ),
          _SortBar(sort: sort, onSortChanged: onSortChanged),
        ],
      ),
    );
  }
}

/// 等分分段控件：4 个选项一次全可见，比横向滚动的小胶囊更好点、也更整齐。
class _SortBar extends StatelessWidget {
  const _SortBar({required this.sort, required this.onSortChanged});

  final FeedSort sort;
  final ValueChanged<FeedSort> onSortChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 36,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: const Color(0xFF12161E),
        borderRadius: BorderRadius.circular(11),
        border: Border.all(color: const Color(0x0FFFFFFF)),
      ),
      child: Row(
        children: [
          for (final item in FeedSort.values)
            Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => onSortChanged(item),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  curve: Curves.easeOut,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: item == sort ? const Color(0x268AB4F8) : Colors.transparent,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    item.label,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: item == sort ? FontWeight.w700 : FontWeight.w500,
                      color: item == sort ? const Color(Env.blue) : const Color(0xFF8A939F),
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

class _ToTopButton extends StatelessWidget {
  const _ToTopButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40,
        height: 40,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: const Color(0xF21A1F28),
          border: Border.all(color: const Color(0x1FFFFFFF)),
          boxShadow: const [
            BoxShadow(color: Color(0x66000000), blurRadius: 14, offset: Offset(0, 6)),
          ],
        ),
        child: const Icon(Icons.arrow_upward, size: 18, color: Color(Env.muted)),
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
          child: TextButton(
            onPressed: onRetry,
            child: Text('$error 点击重试'),
          ),
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

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.onRefresh});

  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    // 必须是可滚动子节点，否则 RefreshIndicator 拉不动
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        const SizedBox(height: 110),
        Icon(
          Icons.dynamic_feed_outlined,
          size: 30,
          color: const Color(Env.muted).withValues(alpha: 0.5),
        ),
        const SizedBox(height: 12),
        const Center(
          child: Text(
            '这里还没有内容',
            style: TextStyle(fontSize: 13.5, color: Color(Env.muted)),
          ),
        ),
        const SizedBox(height: 6),
        Center(
          child: Text(
            '下拉刷新试试',
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

/// 骨架屏：形状照着真卡片走，加载完不会突然跳版。
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
            _bar(width: 46, height: 9),
            const SizedBox(height: 11),
            _bar(width: double.infinity, height: 15),
            const SizedBox(height: 7),
            _bar(width: 200, height: 13),
            const SizedBox(height: 14),
            Row(
              children: [
                _bar(width: 18, height: 18, radius: 9),
                const SizedBox(width: 7),
                _bar(width: 62, height: 9),
                const Spacer(),
                _bar(width: 40, height: 9),
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
