import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/api/models.dart';
import 'go_repository.dart';

/// 一组的标题与顺序：按「该动手的紧迫度」排，不跟随后端返回顺序。
///
/// 组内顺序仍用服务端的分数排序，客户端只负责归组，不重排。
const _groupMeta = <String, String>{
  'question': '待回答',
  'community_task': '可领取',
  'project': '求反馈',
  'resource': '可补充',
  'stale_content': '可更新',
  'topic': '可参与',
  'review_needed': '待判断',
};

class GoGroup {
  const GoGroup({required this.type, required this.label, required this.items});

  final String type;
  final String label;
  final List<ParticipationItem> items;
}

class GoState {
  const GoState({
    this.items = const [],
    this.cursor,
    this.hasMore = false,
    this.loadingFirst = false,
    this.loadingMore = false,
    this.error,
  });

  final List<ParticipationItem> items;
  final String? cursor;
  final bool hasMore;
  final bool loadingFirst;
  final bool loadingMore;
  final ApiException? error;

  bool get isInitialLoading => loadingFirst && items.isEmpty;

  bool get isEmpty => !loadingFirst && items.isEmpty && error == null;

  /// 按类型分组，空组不出现；未知类型归到「其他」并放到最后。
  List<GoGroup> get groups {
    final buckets = <String, List<ParticipationItem>>{};
    for (final item in items) {
      buckets.putIfAbsent(item.targetType, () => []).add(item);
    }

    final ordered = <GoGroup>[
      for (final entry in _groupMeta.entries)
        if (buckets[entry.key]?.isNotEmpty == true)
          GoGroup(type: entry.key, label: entry.value, items: buckets[entry.key]!),
    ];

    final rest = <GoGroup>[
      for (final entry in buckets.entries)
        if (!_groupMeta.containsKey(entry.key))
          GoGroup(type: entry.key, label: '其他', items: entry.value),
    ];

    return [...ordered, ...rest];
  }

  GoState copyWith({
    List<ParticipationItem>? items,
    String? cursor,
    bool? hasMore,
    bool? loadingFirst,
    bool? loadingMore,
    ApiException? error,
    bool clearError = false,
  }) =>
      GoState(
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

/// 任务台状态：一次拿全量，客户端只做「补一页」和「下拉刷新」。
class GoController extends Notifier<GoState> {
  @override
  GoState build() {
    // Riverpod 3 禁止在 build() 的同步链里写 state，推迟一个微任务
    Future.microtask(_load);
    return const GoState(loadingFirst: true);
  }

  GoRepository get _repo => ref.read(goRepositoryProvider);

  Future<void> refresh() => _load(keepItems: true);

  Future<void> _load({bool keepItems = false}) async {
    state = state.copyWith(
      items: keepItems ? state.items : const <ParticipationItem>[],
      loadingFirst: true,
      clearError: true,
    );

    try {
      final page = await _repo.load();
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

  /// 补页：按 targetType+targetId 去重，同一件事不会在清单里出现两次。
  Future<void> loadMore() async {
    final cursor = state.cursor;
    if (state.loadingMore || state.loadingFirst) return;
    if (!state.hasMore || cursor == null) return;

    state = state.copyWith(loadingMore: true, clearError: true);

    try {
      final page = await _repo.load(cursor: cursor);
      final seen = state.items.map((e) => '${e.targetType}:${e.targetId}').toSet();

      state = state.copyWith(
        items: [
          ...state.items,
          ...page.items.where((e) => seen.add('${e.targetType}:${e.targetId}')),
        ],
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
