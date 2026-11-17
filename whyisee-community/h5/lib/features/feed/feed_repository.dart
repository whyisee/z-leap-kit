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
  /// categorySlug 为空表示「全部」，服务端不传这个参数就不做分类过滤。
  Future<FeedPageResult> load({
    required FeedSort sort,
    String? cursor,
    String? categorySlug,
    int limit = 20,
  }) async {
    final payload = await _api.get('/feed', query: {
      'sort': sort.wire,
      'limit': limit,
      'cursor': cursor,
      'category': categorySlug,
      'surface': 'see',
    });
    return FeedPageResult.fromJson(payload.data, payload.meta);
  }

  /// 分类筛选项。失败不抛错：拿不到就只显示「全部」，不能因此让整页报错。
  Future<List<CategoryRef>> categories() async {
    try {
      final payload = await _api.get('/meta/filters');
      return ((payload.data['categories'] as List?) ?? const [])
          .whereType<Map>()
          .map((e) => CategoryRef.fromJson(e.cast<String, dynamic>()))
          .toList(growable: false);
    } catch (_) {
      return const [];
    }
  }
}
