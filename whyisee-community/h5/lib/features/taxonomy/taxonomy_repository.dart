import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/api/models.dart';
import '../../core/providers.dart';

/// 分类与标签。
///
/// 网页 `/categories`、`/c/:slug`、`/tag/:slug` 三个页面共用这里的三个请求：
/// 分类列表、分类详情、标签详情。详情都把话题一起带回来 —— 头部的说明和条数
/// 是给「确认自己点对了」用的，不是主内容，不需要额外一次请求。
class TaxonomyRepository {
  TaxonomyRepository(this._api);

  final ApiClient _api;

  Future<List<TaxonomyItem>> categories() async {
    final payload = await _api.get('/taxonomy/categories');

    return ((payload.data['categories'] as List?) ?? const [])
        .whereType<Map>()
        .map((item) => TaxonomyItem.fromJson(item.cast<String, dynamic>()))
        .toList();
  }

  Future<List<TaxonomyItem>> tags({int limit = 60}) async {
    final payload = await _api.get('/taxonomy/tags', query: {'limit': limit});

    return ((payload.data['tags'] as List?) ?? const [])
        .whereType<Map>()
        .map((item) => TaxonomyItem.fromJson(item.cast<String, dynamic>()))
        .toList();
  }

  Future<TaxonomyDetail> category(String slug, {int offset = 0, int limit = 20}) {
    return _detail('/taxonomy/categories/$slug', 'category', offset: offset, limit: limit);
  }

  Future<TaxonomyDetail> tag(String slug, {int offset = 0, int limit = 20}) {
    return _detail('/taxonomy/tags/$slug', 'tag', offset: offset, limit: limit);
  }

  Future<TaxonomyDetail> _detail(
    String path,
    String kind, {
    required int offset,
    required int limit,
  }) async {
    final payload = await _api.get(
      path,
      query: {'offset': offset, 'limit': limit},
    );

    final data = payload.data;
    final raw = (data[kind] as Map?)?.cast<String, dynamic>() ?? const {};

    return TaxonomyDetail(
      kind: kind,
      item: TaxonomyItem.fromJson(raw),
      topics: ((data['topics'] as List?) ?? const [])
          .whereType<Map>()
          .map((item) => TopicSummary.fromJson(item.cast<String, dynamic>()))
          .toList(),
      hasMore: payload.meta['hasMore'] as bool? ?? false,
      nextOffset: (payload.meta['nextOffset'] as num?)?.toInt(),
    );
  }
}

final taxonomyRepositoryProvider = Provider<TaxonomyRepository>(
  (ref) => TaxonomyRepository(ref.watch(apiClientProvider)),
);
