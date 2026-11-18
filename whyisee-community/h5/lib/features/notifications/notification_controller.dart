import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/api/models.dart';
import '../../core/providers.dart';
import 'notification_repository.dart';

class NotificationState {
  const NotificationState({
    this.filter = NotificationFilter.all,
    this.items = const [],
    this.counts = const NotificationCounts(),
    this.cursor,
    this.hasMore = false,
    this.loadingFirst = false,
    this.loadingMore = false,
    this.markingAll = false,
    this.error,
  });

  final NotificationFilter filter;
  final List<NotificationItem> items;

  /// 各档未读数。它是账号级的全量统计，跟当前档位无关 ——
  /// 切档时不能清空，否则角标会跟着一起闪没。
  final NotificationCounts counts;

  final String? cursor;
  final bool hasMore;
  final bool loadingFirst;
  final bool loadingMore;
  final bool markingAll;
  final ApiException? error;

  bool get isInitialLoading => loadingFirst && items.isEmpty;

  bool get isEmpty => !loadingFirst && items.isEmpty && error == null;

  NotificationState copyWith({
    NotificationFilter? filter,
    List<NotificationItem>? items,
    NotificationCounts? counts,
    String? cursor,
    bool? hasMore,
    bool? loadingFirst,
    bool? loadingMore,
    bool? markingAll,
    ApiException? error,
    bool clearError = false,
  }) =>
      NotificationState(
        filter: filter ?? this.filter,
        items: items ?? this.items,
        counts: counts ?? this.counts,
        cursor: cursor ?? this.cursor,
        hasMore: hasMore ?? this.hasMore,
        loadingFirst: loadingFirst ?? this.loadingFirst,
        loadingMore: loadingMore ?? this.loadingMore,
        markingAll: markingAll ?? this.markingAll,
        error: clearError ? null : (error ?? this.error),
      );
}

final notificationControllerProvider =
    NotifierProvider<NotificationController, NotificationState>(NotificationController.new);

/// 通知列表：切档从头拉、触底续页、下拉刷新保留旧内容。
///
/// 标记已读先在本地改状态再发请求 —— 通知列表点开一条，回到列表时
/// 那一条还亮着蓝条会非常刺眼；接口失败也不回滚，下次刷新会自愈。
class NotificationController extends Notifier<NotificationState> {
  @override
  NotificationState build() {
    final session = ref.watch(sessionProvider);
    if (!session.isSignedIn) return const NotificationState();

    Future.microtask(_loadFirstPage);
    return const NotificationState(loadingFirst: true);
  }

  NotificationRepository get _repo => ref.read(notificationRepositoryProvider);

  Future<void> refresh() => _loadFirstPage(keepItems: true);

  Future<void> changeFilter(NotificationFilter filter) async {
    if (filter == state.filter) return;
    state = NotificationState(
      filter: filter,
      counts: state.counts,
      loadingFirst: true,
    );
    await _loadFirstPage();
  }

  Future<void> _loadFirstPage({bool keepItems = false}) async {
    if (!ref.read(sessionProvider).isSignedIn) return;

    final filter = state.filter;
    state = state.copyWith(
      items: keepItems ? state.items : const <NotificationItem>[],
      loadingFirst: true,
      clearError: true,
    );

    try {
      final page = await _repo.load(filter: filter);
      if (!ref.mounted || state.filter != filter) return;
      state = state.copyWith(
        items: page.items,
        counts: page.counts,
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

      // 翻页期间可能来了新通知把 offset 顶走，按 id 去重
      final seen = state.items.map((e) => e.id).toSet();
      state = state.copyWith(
        items: [
          ...state.items,
          ...page.items.where((e) => seen.add(e.id)),
        ],
        counts: page.counts,
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

  /// 点开一条：本地立刻置已读，再通知服务端。已经读过的直接跳过。
  Future<void> markRead(NotificationItem item) async {
    if (item.read) return;

    final index = state.items.indexWhere((e) => e.id == item.id);
    if (index < 0) return;

    final items = [...state.items];
    items[index] = items[index].asRead();
    state = state.copyWith(items: items, counts: state.counts.markRead(item.filterOf));

    try {
      final counts = await _repo.markRead(ids: [item.id]);
      if (!ref.mounted) return;
      state = state.copyWith(counts: counts);
    } catch (_) {
      // 失败就留在本地已读状态：用户已经看过了，下次刷新会和服务端对齐
    }
  }

  /// 右上角一键全清。清的是当前筛选范围内所有未读，界面上的列表原地转为已读态。
  Future<void> markAllRead() async {
    if (state.markingAll || state.counts.total == 0) return;

    state = state.copyWith(markingAll: true);
    final items = state.items.map((e) => e.asRead()).toList(growable: false);
    state = state.copyWith(items: items, counts: const NotificationCounts());

    try {
      final counts = await _repo.markRead(all: true);
      if (!ref.mounted) return;
      state = state.copyWith(counts: counts, markingAll: false);
    } catch (_) {
      if (!ref.mounted) return;
      state = state.copyWith(markingAll: false);
    }
  }
}
