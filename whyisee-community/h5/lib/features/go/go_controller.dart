import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_exception.dart';
import '../../core/api/models.dart';
import '../../core/providers.dart';
import 'go_repository.dart';

class GoState {
  const GoState({
    this.board = const TodoBoard(),
    this.loading = false,
    this.error,
  });

  final TodoBoard board;
  final bool loading;
  final ApiException? error;

  bool get isInitialLoading => loading && board.isEmpty;

  /// 拉完确实没事可做 —— 和「还在加载」「加载失败」要区分开。
  bool get isClear => !loading && error == null && board.isEmpty;

  TodoSummary get summary => board.summary;
  List<TodoGroup> get groups => board.groups;

  GoState copyWith({
    TodoBoard? board,
    bool? loading,
    ApiException? error,
    bool clearError = false,
  }) =>
      GoState(
        board: board ?? this.board,
        loading: loading ?? this.loading,
        error: clearError ? null : (error ?? this.error),
      );
}

final goControllerProvider =
    NotifierProvider<GoController, GoState>(GoController.new);

/// 「我该做的事」状态：只有下拉刷新，没有分页 —— 待办本来就不该有几百条。
///
/// 未登录时不发请求（否则每次进 tab 都 401），页面直接显示登录引导。
class GoController extends Notifier<GoState> {
  @override
  GoState build() {
    final session = ref.watch(sessionProvider);
    if (!session.isSignedIn) {
      return const GoState();
    }

    // Riverpod 3 禁止在 build() 的同步链里写 state，推迟一个微任务
    Future.microtask(refresh);
    return const GoState(loading: true);
  }

  GoRepository get _repo => ref.read(goRepositoryProvider);

  Future<void> refresh() async {
    if (!ref.read(sessionProvider).isSignedIn) return;

    state = state.copyWith(loading: true, clearError: true);

    try {
      final board = await _repo.load();
      if (!ref.mounted) return;
      state = GoState(board: board);
    } on ApiException catch (e) {
      if (!ref.mounted) return;
      state = state.copyWith(loading: false, error: e);
    } catch (_) {
      if (!ref.mounted) return;
      state = state.copyWith(
        loading: false,
        error: ApiException(code: 'unknown', message: '加载失败，下拉重试。'),
      );
    }
  }

  /// 处理完一条后本地摘掉，不用整页重拉：用户刚回到列表就少一行，反馈更快。
  /// 同时把通知标已读，否则下拉刷新它又会回来。
  void dismiss(String id) {
    _dropLocally(id);

    if (id.startsWith('n-')) {
      // 标已读失败不该挡住用户看内容，静默即可
      unawaited(_repo.markRead([id]).catchError((_) {}));
    }
  }

  void _dropLocally(String id) {
    final groups = <TodoGroup>[];
    for (final group in state.board.groups) {
      final items = group.items.where((item) => item.id != id).toList(growable: false);
      if (items.isEmpty) continue;
      groups.add(TodoGroup(key: group.key, label: group.label, items: items));
    }

    final remaining = groups.fold<int>(0, (sum, group) => sum + group.items.length);
    final actionable = groups
        .where((group) => group.key != 'followed')
        .fold<int>(0, (sum, group) => sum + group.items.length);

    state = state.copyWith(
      board: TodoBoard(
        summary: TodoSummary(
          total: remaining,
          unread: state.board.summary.unread,
          actionable: actionable,
        ),
        groups: groups,
      ),
    );
  }
}
