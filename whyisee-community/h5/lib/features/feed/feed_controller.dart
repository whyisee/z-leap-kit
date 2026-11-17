import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/api/models.dart';
import 'feed_repository.dart';

class FeedState {
  const FeedState({
    required this.sort,
    this.items = const [],
    this.cursor,
    this.hasMore = false,
    this.loadingFirst = false,
    this.loadingMore = false,
    this.error,
  });

  final FeedSort sort;
  final List<TopicSummary> items;
  final String? cursor;
  final bool hasMore;
  final bool loadingFirst;
  final bool loadingMore;
  final ApiException? error;

  /// 首屏还没拿到任何数据（骨架屏 vs 空态的分界）。
  bool get isInitialLoading => loadingFirst && items.isEmpty;

  bool get isEmpty => !loadingFirst && items.isEmpty && error == null;

  FeedState copyWith({
    FeedSort? sort,
    List<TopicSummary>? items,
    String? cursor,
    bool? hasMore,
    bool? loadingFirst,
    bool? loadingMore,
    ApiException? error,
    bool clearError = false,
  }) =>
      FeedState(
        sort: sort ?? this.sort,
        items: items ?? this.items,
        cursor: cursor ?? this.cursor,
        hasMore: hasMore ?? this.hasMore,
        loadingFirst: loadingFirst ?? this.loadingFirst,
        loadingMore: loadingMore ?? this.loadingMore,
        error: clearError ? null : (error ?? this.error),
      );
}

final feedControllerProvider =
    NotifierProvider<FeedController, FeedState>(FeedController.new);

class FeedController extends Notifier<FeedState> {
  @override
  FeedState build() {
    // 不能在 build() 同步链里写 state（Riverpod 3 会抛 "uninitialized provider"），
    // 推到微任务里跑，那时本 provider 已经初始化完。
    Future.microtask(() => _loadFirstPage(FeedSort.recommend));
    return const FeedState(sort: FeedSort.recommend, loadingFirst: true);
  }

  FeedRepository get _repo => ref.read(feedRepositoryProvider);

  /// 下拉刷新：保留当前列表，失败时只在顶部提示，不清空已有内容。
  Future<void> refresh() => _loadFirstPage(state.sort, keepItems: true);

  Future<void> changeSort(FeedSort sort) async {
    if (sort == state.sort) return;
    state = FeedState(sort: sort, loadingFirst: true);
    await _loadFirstPage(sort);
  }

  Future<void> _loadFirstPage(FeedSort sort, {bool keepItems = false}) async {
    final kept = keepItems ? state.items : const <TopicSummary>[];
    state = state.copyWith(
      sort: sort,
      items: kept,
      loadingFirst: true,
      clearError: true,
    );

    try {
      final page = await _repo.load(sort: sort);
      // 请求返回时若排序已被用户切走，丢弃这批结果，避免串台
      if (state.sort != sort) return;
      state = state.copyWith(
        items: page.items,
        cursor: page.nextCursor,
        hasMore: page.hasMore,
        loadingFirst: false,
        clearError: true,
      );
    } on ApiException catch (e) {
      state = state.copyWith(loadingFirst: false, error: e);
    } catch (_) {
      state = state.copyWith(
        loadingFirst: false,
        error: ApiException(code: 'unknown', message: '加载失败，下拉重试。'),
      );
    }
  }

  /// 触底加载。用 offset 游标，服务端排序可能在翻页间微变，所以按 id 去重。
  Future<void> loadMore() async {
    final cursor = state.cursor;
    if (state.loadingMore || state.loadingFirst) return;
    if (!state.hasMore || cursor == null) return;

    final sort = state.sort;
    state = state.copyWith(loadingMore: true, clearError: true);

    try {
      final page = await _repo.load(sort: sort, cursor: cursor);
      if (state.sort != sort) return;

      final seen = state.items.map((e) => e.id).toSet();
      final merged = [
        ...state.items,
        ...page.items.where((e) => seen.add(e.id)),
      ];

      state = state.copyWith(
        items: merged,
        cursor: page.nextCursor,
        // 一页全是重复内容时 nextCursor 可能推进但 hasMore 仍为真，
        // 这种情况靠 nextCursor 变化兜住，不额外处理
        hasMore: page.hasMore,
        loadingMore: false,
      );
    } on ApiException catch (e) {
      state = state.copyWith(loadingMore: false, error: e);
    } catch (_) {
      state = state.copyWith(loadingMore: false);
    }
  }

  /// 本地更新单个条目的点赞数（详情页操作后回写列表，避免返回时数字没变）。
  void patchLike(int topicId, {required int likeCount}) {
    if (state.items.isEmpty) return;
    state = state.copyWith(
      items: [
        for (final item in state.items)
          if (item.id == topicId) item.copyWith(likeCount: likeCount) else item,
      ],
    );
  }
}
