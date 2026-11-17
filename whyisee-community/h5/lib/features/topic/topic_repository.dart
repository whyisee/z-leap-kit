import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/api/models.dart';
import '../../core/providers.dart';

final topicRepositoryProvider = Provider<TopicRepository>(
  (ref) => TopicRepository(ref.watch(apiClientProvider)),
);

class TopicRepository {
  TopicRepository(this._api);

  final ApiClient _api;

  /// 详情页只发这一条请求：topic + posts + interactions + related 一次拿全。
  Future<TopicDetail> detail(int topicId) async {
    final payload = await _api.get('/topics/$topicId');
    return TopicDetail.fromJson(payload.data);
  }

  /// 点赞是 toggle，返回服务端裁决后的真实状态，避免乐观更新和实际不一致。
  Future<({bool liked, int likeCount})> toggleLike({
    required String targetType,
    required int targetId,
  }) async {
    final payload = await _api.post('/interactions/like', body: {
      'targetType': targetType,
      'targetId': targetId,
    });
    return (
      liked: payload.data['liked'] as bool? ?? false,
      likeCount: (payload.data['likeCount'] as num?)?.toInt() ?? 0,
    );
  }

  Future<bool> toggleBookmark(int topicId) async {
    final payload = await _api.post('/interactions/bookmark', body: {
      'topicId': topicId,
    });
    return payload.data['bookmarked'] as bool? ?? false;
  }

  /// 关注作者。返回服务端裁决后的状态。
  Future<bool> toggleFollowUser(int userId) async {
    final payload = await _api.post('/interactions/follow', body: {
      'targetType': 'user',
      'targetId': userId,
    });
    return payload.data['following'] as bool? ?? false;
  }

  /// 帖子 AI（总结/回复草稿/翻译/行动项/相关/质检）。
  /// 服务端按用户限流，AI 未配置时返回 503。
  Future<TopicAiResult> aiTopic({
    required int topicId,
    required String action,
  }) async {
    final payload = await _api.post(
      '/ai/topic',
      body: {
        'topicId': topicId,
        'action': action,
      },
      receiveTimeout: const Duration(seconds: 90),
    );
    return TopicAiResult.fromJson(payload.data);
  }
}
