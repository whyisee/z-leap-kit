import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/api/models.dart';
import '../../core/providers.dart';
import 'following_repository.dart';

class FollowingState {
  const FollowingState({
    this.filter = FollowingFilter.all,
    this.items = const [],
    this.cursor,
    this.hasMore = false,
    this.loadingFirst = false,
    this.loadingMore = false,
    this.error,
  });

  final FollowingFilter filter;
  final List<FollowingItem> items;
  final String? cursor;
  final bool hasMore;
  final bool loadingFirst;
  final bool loadingMore;
  final ApiException? error;

  bool get isInitialLoading => loadingFirst && items.isEmpty;

  /// 拉完了、确实没有内容 —— 和「还在加载」「加载失败」分开，空态文案不一样。
  bool get isEmpty => !loadingFirst && items.isEmpty && error == null;

  FollowingState copyWith({
    FollowingFilter? filter,
    List<FollowingItem>? items,
    String? cursor,
    bool? hasMore,
    bool? loadingFirst,
    bool? loadingMore,
    ApiException? error,
    bool clearError = false,
  }) =>
      FollowingState(
        filter: filter ?? this.filter,
        items: items ?? this.items,
        cursor: cursor ?? this.cursor,
        hasMore: hasMore ?? this.hasMore,
        loadingFirst: loadingFirst ?? this.loadingFirst,
        loadingMore: loadingMore ?? this.loadingMore,
        error: clearError ? null : (error ?? this.error),
      );
}

final followingControllerProvider =
    NotifierProvider<FollowingController, FollowingState>(FollowingController.new);

/// 订阅流状态：切过滤维度 = 从头拉，触底续页，下拉刷新保留旧列表。
///
/// 未登录不发请求（关注关系是账号私有的），页面直接出登录引导 ——
/// 否则每次切到这个 tab 都打一次 401。
class FollowingController extends Notifier<FollowingState> {
  @override
  FollowingState build() {
    final session = ref.watch(sessionProvider);
    if (!session.isSignedIn) return const FollowingState();

    // Riverpod 3 禁止在 build() 的同步链里写 state，推迟一个微任务
    Future.microtask(_loadFirstPage);
    return const FollowingState(loadingFirst: true);
  }

  FollowingRepository get _repo => ref.read(followingRepositoryProvider);

  /// 下拉刷新：不清空已有列表，失败时保留旧内容
  Future<void> refresh() => _loadFirstPage(keepItems: true);

  Future<void> changeFilter(FollowingFilter filter) async {
    if (filter == state.filter) return;
    state = FollowingState(filter: filter, loadingFirst: true);
    await _loadFirstPage();
  }

  Future<void> _loadFirstPage({bool keepItems = false}) async {
    if (!ref.read(sessionProvider).isSignedIn) return;

    final filter = state.filter;
    state = state.copyWith(
      items: keepItems ? state.items : const <FollowingItem>[],
      loadingFirst: true,
      clearError: true,
    );

    try {
      final page = await _repo.load(filter: filter);
      // 请求返回时过滤维度已被切走就丢弃，避免串台
      if (!ref.mounted || state.filter != filter) return;
      state = state.copyWith(
        items: page.items,
        cursor: page.nextCursor,
        hasMore: page.hasMore,
        loadingFirst: false,
        clearError: true,
      );
    } on ApiException catch (e) {
      if (!ref.mounted) return;
      state = state.copyWith(loadingFirst: false, error: e);
    } catch (_) {
      if (!ref.mounted) return;
      state = state.copyWith(
        loadingFirst: false,
        error: ApiException(code: 'unknown', message: '加载失败，下拉重试。'),
      );
    }
  }

  Future<void> loadMore() async {
    final cursor = state.cursor;
    if (state.loadingMore || state.loadingFirst) return;
    if (!state.hasMore || cursor == null) return;

    final filter = state.filter;
    state = state.copyWith(loadingMore: true, clearError: true);

    try {
      final page = await _repo.load(filter: filter, cursor: cursor);
      if (!ref.mounted || state.filter != filter) return;

      // 服务端排序是内存打分，翻页之间可能轻微变动，按帖子 id 去重
      final seen = state.items.map((e) => e.topicId).toSet();
      final merged = [
        ...state.items,
        ...page.items.where((e) => seen.add(e.topicId)),
      ];

      state = state.copyWith(
        items: merged,
        cursor: page.nextCursor,
        hasMore: page.hasMore,
        loadingMore: false,
      );
    } on ApiException catch (e) {
      if (!ref.mounted) return;
      state = state.copyWith(loadingMore: false, error: e);
    } catch (_) {
      if (!ref.mounted) return;
      state = state.copyWith(loadingMore: false);
    }
  }
}
