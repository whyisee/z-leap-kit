import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/api/models.dart';
import '../../core/providers.dart';

final goRepositoryProvider = Provider<GoRepository>(
  (ref) => GoRepository(ref.watch(apiClientProvider)),
);

class GoRepository {
  GoRepository(this._api);

  final ApiClient _api;

  /// 任务台一次拿全量（服务端上限 100，这里 60 覆盖现有规模），
  /// 分组在客户端做，不按类型分别请求。
  Future<ParticipationPageResult> load({String? cursor, int limit = 60}) async {
    final payload = await _api.get('/participation', query: {
      'filter': 'all',
      'limit': limit,
      'cursor': cursor,
    });
    return ParticipationPageResult.fromJson(payload.data, payload.meta);
  }
}
