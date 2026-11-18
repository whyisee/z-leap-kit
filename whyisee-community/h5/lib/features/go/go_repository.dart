import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/api/models.dart';
import '../../core/providers.dart';

/// 「出发」的筛选。取值与网页 `/go?filter=` 完全一致，服务端 readFilter 只认这六个。
enum GoFilter {
  all('all', '全部'),
  questions('questions', '待回答'),
  feedback('feedback', '求反馈'),
  tasks('tasks', '可领取'),
  supplement('supplement', '可补充'),
  stale('stale', '可更新');

  const GoFilter(this.wire, this.label);

  final String wire;
  final String label;
}

final goRepositoryProvider = Provider<GoRepository>(
  (ref) => GoRepository(ref.watch(apiClientProvider)),
);

class GoRepository {
  GoRepository(this._api);

  final ApiClient _api;

  /// 一次 24 条：手机上滚一屏约 4~5 张卡，24 条够翻好几屏，又不会一次拖太久。
  Future<ParticipationPageResult> load({
    required GoFilter filter,
    String? cursor,
    int limit = 24,
  }) async {
    final payload = await _api.get('/participation', query: {
      'filter': filter.wire,
      'limit': limit,
      'cursor': cursor,
    });
    return ParticipationPageResult.fromJson(payload.data, payload.meta);
  }
}
