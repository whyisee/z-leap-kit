import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/api/models.dart';
import '../../core/providers.dart';

/// 「看见」流的排序。取值与网页 `/see?sort=` 一致，服务端 readSort 只认这四个。
enum FeedSort {
  recommend('recommend', '推荐'),
  latest('latest', '最新'),
  hot('hot', '热门'),
  featured('featured', '精选');

  const FeedSort(this.wire, this.label);

  final String wire;
  final String label;
}

final feedRepositoryProvider = Provider<FeedRepository>(
  (ref) => FeedRepository(ref.watch(apiClientProvider)),
);

class FeedRepository {
  FeedRepository(this._api);

  final ApiClient _api;

  /// cursor 是服务端编的 offset 串，客户端不解析、只回传。
  Future<FeedPage> load({
    required FeedSort sort,
    String? cursor,
    int limit = 20,
  }) async {
    final payload = await _api.get('/feed', query: {
      'sort': sort.wire,
      'limit': limit,
      'cursor': cursor,
      'surface': 'see',
    });
    return FeedPage.fromJson(payload.data, payload.meta);
  }
}
