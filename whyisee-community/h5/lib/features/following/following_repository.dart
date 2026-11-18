import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/api/models.dart';
import '../../core/providers.dart';

final followingRepositoryProvider = Provider<FollowingRepository>(
  (ref) => FollowingRepository(ref.watch(apiClientProvider)),
);

/// 「关注」= 订阅流。
///
/// 数据来自 `/following`（服务端复用网页 `/following` 的 `listFollowingFeed`），
/// 不是推荐接口 —— 这里的每一条都必须能说清「你订阅的谁带来了它」。
class FollowingRepository {
  FollowingRepository(this._api);

  final ApiClient _api;

  Future<FollowingPageResult> load({
    FollowingFilter filter = FollowingFilter.all,
    String? cursor,
  }) async {
    final payload = await _api.get('/following', query: {
      'filter': filter.wire,
      'limit': 20,
      // 首屏不带游标：服务端 decodeCursor 对空值返回 0
      'cursor': ?cursor,
    });

    return FollowingPageResult.fromJson(payload.data, payload.meta);
  }
}
