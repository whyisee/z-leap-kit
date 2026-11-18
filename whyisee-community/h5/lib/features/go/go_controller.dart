import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/api/models.dart';
import 'go_repository.dart';

class GoState {
  const GoState({
    required this.filter,
    this.items = const [],
    this.cursor,
    this.hasMore = false,
    this.loadingFirst = false,
    this.loadingMore = false,
    this.error,
  });

  final GoFilter filter;
  final List<ParticipationItem> items;
  final String? cursor;
  final bool hasMore;
  final bool loadingFirst;
  final bool loadingMore;
  final ApiException? error;

  bool get isInitialLoading => loadingFirst && items.isEmpty;

  bool get isEmpty => !loadingFirst && items.isEmpty && error == null;

  GoState copyWith({
    GoFilter? filter,
    List<ParticipationItem>? items,
    String? cursor,
    bool? hasMore,
    bool? loadingFirst,
    bool? loadingMore,
    ApiException? error,
    bool clearError = false,
  }) =>
      GoState(
        filter: filter ?? this.filter,
        items: items ?? this.items,
        cursor: cursor ?? this.cursor,
        hasMore: hasMore ?? this.hasMore,
        loadingFirst: loadingFirst ?? this.loadingFirst,
        loadingMore: loadingMore ?? this.loadingMore,
        error: clearError ? null : (error ?? this.error),
      );
}

final goControllerProvider =
    NotifierProvider<GoController, GoState>(GoController.new);

/// 「出发」列表状态。结构和「看见」流一致：首屏 + 触底补页 + 切筛选重置。
class GoController extends Notifier<GoState> {
  @override
  GoState build() {
    // Riverpod 3 禁止在 build() 的同步链里写 state，推迟一个微任务
    Future.microtask(_loadFirstPage);
    return const GoState(filter: GoFilter.all, loadingFirst: true);
  }

  GoRepository get _repo => ref.read(goRepositoryProvider);

  Future<void> refresh() => _loadFirstPage(keepItems: true);

  /// 切筛选：游标作废、从头拿。旧请求回来时按 filter 校验丢弃。
  Future<void> changeFilter(GoFilter filter) async {
    if (filter == state.filter) return;
    state = GoState(filter: filter, loadingFirst: true);
    await _loadFirstPage();
  }

  Future<void> _loadFirstPage({bool keepItems = false}) async {
    final filter = state.filter;
    state = state.copyWith(
      items: keepItems ? state.items : const <ParticipationItem>[],
      loadingFirst: true,
      clearError: true,
    );

    try {
      final page = await _repo.load(filter: filter);
      if (state.filter != filter) return;
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

  /// 触底补页。排序在翻页间可能微变，按 targetType+targetId 去重。
  Future<void> loadMore() async {
    final cursor = state.cursor;
    if (state.loadingMore || state.loadingFirst) return;
    if (!state.hasMore || cursor == null) return;

    final filter = state.filter;
    state = state.copyWith(loadingMore: true, clearError: true);

    try {
      final page = await _repo.load(filter: filter, cursor: cursor);
      if (state.filter != filter) return;

      final seen = state.items.map((e) => '${e.targetType}:${e.targetId}').toSet();
      final merged = [
        ...state.items,
        ...page.items.where((e) => seen.add('${e.targetType}:${e.targetId}')),
      ];

      state = state.copyWith(
        items: merged,
        cursor: page.nextCursor,
        hasMore: page.hasMore,
        loadingMore: false,
      );
    } on ApiException catch (e) {
      state = state.copyWith(loadingMore: false, error: e);
    } catch (_) {
      state = state.copyWith(loadingMore: false);
    }
  }
}
