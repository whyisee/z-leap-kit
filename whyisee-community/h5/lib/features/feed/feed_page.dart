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
/// 这是 P1 的核心：把首页从 WebView 换成能下拉刷新、无限滚动的原生列表。
/// 其余三个 tab 仍是 WebView（见 §6 分期）。
class FeedPage extends ConsumerStatefulWidget {
  const FeedPage({super.key});

  @override
  ConsumerState<FeedPage> createState() => _FeedPageState();
}

class _FeedPageState extends ConsumerState<FeedPage> {
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

  /// 距底部还有约两屏时预取，避免用户滑到底才开始等。
  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final position = _scrollController.position;
    if (position.pixels < position.maxScrollExtent - 600) return;
    ref.read(feedControllerProvider.notifier).loadMore();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(feedControllerProvider);
    final controller = ref.read(feedControllerProvider.notifier);

    return Scaffold(
      backgroundColor: const Color(Env.bg),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _Header(
              sort: state.sort,
              onSortChanged: controller.changeSort,
              onRefresh: controller.refresh,
            ),
            Expanded(
              child: state.isInitialLoading
                  ? const _Skeleton()
                  : state.error != null && state.items.isEmpty
                      ? ErrorView(
                          title: '加载失败',
                          message: state.error!.message,
                          onRetry: () => controller.changeSort(state.sort),
                        )
                      : RefreshIndicator(
                          color: const Color(Env.blue),
                          backgroundColor: const Color(Env.surface),
                          onRefresh: controller.refresh,
                          child: state.isEmpty
                              ? _EmptyState(onRefresh: controller.refresh)
                              : ListView.builder(
                                  controller: _scrollController,
                                  padding: EdgeInsets.zero,
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
                        ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.sort,
    required this.onSortChanged,
    required this.onRefresh,
  });

  final FeedSort sort;
  final ValueChanged<FeedSort> onSortChanged;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 8, 0),
      decoration: const BoxDecoration(
        color: Color(Env.headerBg),
        border: Border(bottom: BorderSide(color: Color(Env.line), width: 1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text(
                '看见',
                style: TextStyle(
                  fontSize: 19,
                  fontWeight: FontWeight.w700,
                  color: Color(Env.text),
                  letterSpacing: 0.5,
                ),
              ),
              const Spacer(),
              IconButton(
                onPressed: onRefresh,
                iconSize: 19,
                color: const Color(Env.muted),
                tooltip: '刷新',
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
          SizedBox(
            height: 34,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.only(bottom: 8),
              itemCount: FeedSort.values.length,
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final item = FeedSort.values[index];
                final selected = item == sort;
                return GestureDetector(
                  onTap: () => onSortChanged(item),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 140),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(
                      color: selected ? const Color(0x1F8AB4F8) : Colors.transparent,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: selected ? const Color(0x668AB4F8) : const Color(Env.line),
                      ),
                    ),
                    child: Text(
                      item.label,
                      style: TextStyle(
                        fontSize: 12.5,
                        height: 1.3,
                        fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                        color: selected ? const Color(Env.blue) : const Color(Env.muted),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
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
        padding: const EdgeInsets.symmetric(vertical: 18),
        child: Center(
          child: TextButton(
            onPressed: onRetry,
            child: Text('$error 点击重试'),
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 20),
      child: Center(
        child: loading
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(strokeWidth: 2, color: Color(Env.muted)),
              )
            : Text(
                hasMore ? '' : '到底了',
                style: const TextStyle(fontSize: 12, color: Color(0xFF5C6675)),
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
      children: const [
        SizedBox(height: 120),
        Center(
          child: Text(
            '这里还没有内容',
            style: TextStyle(fontSize: 14, color: Color(Env.muted)),
          ),
        ),
      ],
    );
  }
}

class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: EdgeInsets.zero,
      itemCount: 6,
      itemBuilder: (context, index) => Container(
        padding: const EdgeInsets.fromLTRB(16, 15, 16, 15),
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: Color(Env.line), width: 1)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _bar(width: 52, height: 9),
            const SizedBox(height: 9),
            _bar(width: double.infinity, height: 14),
            const SizedBox(height: 7),
            _bar(width: 210, height: 12),
            const SizedBox(height: 12),
            _bar(width: 130, height: 9),
          ],
        ),
      ),
    );
  }

  Widget _bar({required double width, required double height}) => Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: const Color(Env.panel),
          borderRadius: BorderRadius.circular(3),
        ),
      );
}
