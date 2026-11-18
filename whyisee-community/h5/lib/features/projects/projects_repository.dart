import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/api/models.dart';
import '../../core/providers.dart';

final projectsRepositoryProvider = Provider<ProjectsRepository>(
  (ref) => ProjectsRepository(ref.watch(apiClientProvider)),
);

/// 项目展示。只读、只有一页一页往下翻，没有排序和筛选。
class ProjectsRepository {
  ProjectsRepository(this._api);

  final ApiClient _api;

  Future<ProjectPageResult> load({int offset = 0, int limit = 20}) async {
    final payload = await _api.get('/projects', query: {'offset': offset, 'limit': limit});
    return ProjectPageResult.fromJson(payload.data, payload.meta);
  }
}
