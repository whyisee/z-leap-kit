import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/api/models.dart';
import '../../core/providers.dart';

final goRepositoryProvider = Provider<GoRepository>(
  (ref) => GoRepository(ref.watch(apiClientProvider)),
);

/// 「出发」= 我该做的事。
///
/// 数据来自 `/me/todo`（通知 + 任务提交的聚合），不是话题推荐 ——
/// 这条链路决定了它不可能长成第二个「看见」。
class GoRepository {
  GoRepository(this._api);

  final ApiClient _api;

  Future<TodoBoard> load() async {
    final payload = await _api.get('/me/todo');
    return TodoBoard.fromJson(payload.data);
  }

  /// 点开一条就标已读，避免下拉刷新时它又冒出来。
  Future<void> markRead(List<String> ids) async {
    if (ids.isEmpty) return;
    await _api.post('/me/todo/read', body: {'ids': ids});
  }
}
