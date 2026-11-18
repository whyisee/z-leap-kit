import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/api/models.dart';
import '../../core/providers.dart';

final notificationRepositoryProvider = Provider<NotificationRepository>(
  (ref) => NotificationRepository(ref.watch(apiClientProvider)),
);

/// 通知：只做「我收到的提醒」，私信不在这个列表里（服务端已排除 direct_message）。
///
/// 数据来自 `/notifications`，分类规则（回复 / @ / 赞 / 系统）由服务端给 ——
/// 客户端不解析 `type`，以后加新类型不用发版。
class NotificationRepository {
  NotificationRepository(this._api);

  final ApiClient _api;

  Future<NotificationPageResult> load({
    NotificationFilter filter = NotificationFilter.all,
    String? cursor,
  }) async {
    final payload = await _api.get('/notifications', query: {
      'filter': filter.wire,
      'limit': 20,
      // 首屏不带游标：服务端对空游标返回 0
      'cursor': ?cursor,
    });

    return NotificationPageResult.fromJson(payload.data, payload.meta);
  }

  /// 标记已读。`ids` 为空且 `all` 为 false 时服务端直接返回当前计数。
  Future<NotificationCounts> markRead({List<int> ids = const [], bool all = false}) async {
    final payload = await _api.post('/notifications/read', body: {
      if (all) 'all': true else 'ids': ids,
    });

    return NotificationCounts.fromJson(
      (payload.data['counts'] as Map?)?.cast<String, dynamic>(),
    );
  }
}
