import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/api/models.dart';
import 'feed_repository.dart';

class FeedState {
  const FeedState({
    required this.sort,
    this.categorySlug,
    this.categories = const [],
    this.items = const [],
    this.cursor,
    this.hasMore = false,
    this.loadingFirst = false,
    this.loadingMore = false,
    this.error,
  });

  final FeedSort sort;

  /// 当前分类。null = 全部，服务端就不带 `category` 参数。
  final String? categorySlug;

  /// 分类筛选项，启动时拉一次；拉不到就只有「全部」。
  final List<CategoryRef> categories;

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
    List<CategoryRef>? categories,
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
        // 分类只由 changeCategory 换，这里原样带过，避免 copyWith 传 null 时被误判成「全部」
        categorySlug: categorySlug,
        categories: categories ?? this.categories,
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
    Future.microtask(_bootstrap);
    return const FeedState(sort: FeedSort.recommend, loadingFirst: true);
  }

  FeedRepository get _repo => ref.read(feedRepositoryProvider);

  Future<void> _bootstrap() async {
    // 分类和首屏并行拉，别让分类接口把首屏拖慢
    unawaited(_loadCategories());
    await _loadFirstPage();
  }

  Future<void> _loadCategories() async {
    final categories = await _repo.categories();
    if (categories.isEmpty || !ref.mounted) return;
    state = state.copyWith(categories: categories);
  }

  /// 下拉刷新：保留当前列表，失败时只在顶部提示，不清空已有内容。
  Future<void> refresh() => _loadFirstPage(keepItems: true);

  Future<void> changeSort(FeedSort sort) async {
    if (sort == state.sort) return;
    state = FeedState(
      sort: sort,
      categorySlug: state.categorySlug,
      categories: state.categories,
      loadingFirst: true,
    );
    await _loadFirstPage();
  }

  /// 切分类。null = 全部。切了就从头拿，游标作废。
  Future<void> changeCategory(String? slug) async {
    if (slug == state.categorySlug) return;
    state = FeedState(
      sort: state.sort,
      categorySlug: slug,
      categories: state.categories,
      loadingFirst: true,
    );
    await _loadFirstPage();
  }

  Future<void> _loadFirstPage({bool keepItems = false}) async {
    final sort = state.sort;
    final slug = state.categorySlug;
    state = state.copyWith(
      items: keepItems ? state.items : const <TopicSummary>[],
      loadingFirst: true,
      clearError: true,
    );

    try {
      final page = await _repo.load(sort: sort, categorySlug: slug);
      // 请求返回时若排序或分类已被切走，丢弃这批结果，避免串台
      if (state.sort != sort || state.categorySlug != slug) return;
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
    final slug = state.categorySlug;
    state = state.copyWith(loadingMore: true, clearError: true);

    try {
      final page = await _repo.load(sort: sort, cursor: cursor, categorySlug: slug);
      if (state.sort != sort || state.categorySlug != slug) return;

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
