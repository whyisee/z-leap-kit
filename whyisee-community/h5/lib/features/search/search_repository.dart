import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/api/models.dart';
import '../../core/providers.dart';

final searchRepositoryProvider = Provider<SearchRepository>(
  (ref) => SearchRepository(ref.watch(apiClientProvider)),
);

/// 搜索。
///
/// 只调 `/search`，查询词怎么切、要不要解析 `category:` 这类指令全交给服务端 ——
/// 客户端再实现一遍必然和网页搜出不同结果。
class SearchRepository {
  SearchRepository(this._api);

  final ApiClient _api;

  Future<SearchOutcome> search(String term, {String mode = 'directive'}) async {
    final payload = await _api.get('/search', query: {
      'q': term,
      'mode': mode,
      'limit': 30,
    });

    return SearchOutcome.fromJson(payload.data);
  }
}
