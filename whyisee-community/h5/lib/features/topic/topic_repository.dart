import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
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

  /// 发回复。服务端会回一条完整的楼层 DTO（含渲染好的 HTML 和作者），
  /// 客户端直接插进列表就行，不用为了看见自己那句话再拉一次详情。
  Future<TopicPost> createPost({
    required int topicId,
    required String contentMarkdown,
    int? parentPostId,
  }) async {
    final payload = await _api.post(
      '/topics/$topicId/posts',
      body: {
        'contentMarkdown': contentMarkdown,
        if (parentPostId != null && parentPostId > 0) 'parentPostId': parentPostId,
      },
    );

    final post = (payload.data['post'] as Map?)?.cast<String, dynamic>();
    if (post == null) {
      // 服务端说成功却没回内容：宁可报错，也不要凭空造一条空楼层
      throw ApiException(code: 'unknown', message: '发出去了，但没取回内容，下拉刷新看看');
    }
    return TopicPost.fromJson(post);
  }

  /// 编辑前取原文（只有作者本人 / 管理员拿得到）。
  Future<TopicDraft> editDraft(int topicId) async {
    final payload = await _api.get('/topics/$topicId/edit');

    return TopicDraft.fromJson(
      (payload.data['topic'] as Map?)?.cast<String, dynamic>() ?? const {},
    );
  }

  /// 保存编辑。服务端对普通作者会打回 `pending` 重新审核，返回新状态。
  Future<String> saveEdit({
    required int topicId,
    required String title,
    required String contentMarkdown,
    required int categoryId,
    required String type,
    required List<String> tags,
  }) async {
    final payload = await _api.post(
      '/topics/$topicId/update',
      body: {
        'title': title,
        'contentMarkdown': contentMarkdown,
        'categoryId': categoryId,
        'type': type,
        'tags': tags,
      },
    );

    return payload.data['status'] as String? ?? 'pending';
  }

  Future<void> deleteTopic(int topicId) => _api.post('/topics/$topicId/delete');

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

  /// 候选池补货：客户端把当前这篇的 12 条啃完后调用，exclude 传已读 id。
  Future<List<TopicRef>> nextCandidates({
    required int topicId,
    required List<int> exclude,
    int limit = 12,
  }) async {
    final payload = await _api.get(
      '/topics/$topicId/next',
      query: {
        'limit': limit,
        'exclude': exclude.isEmpty ? null : exclude.join(','),
      },
    );
    return ((payload.data['items'] as List?) ?? const [])
        .whereType<Map>()
        .map((e) => TopicRef.fromJson(e.cast<String, dynamic>()))
        .where((e) => e.id > 0)
        .toList(growable: false);
  }

  /// 埋点：读过 / 点了推荐。服务端据此把读过的从推荐池里排除，
  /// 并更新兴趣画像 —— 不上报的话推荐只能靠全局热度，必然反复推同一批。
  Future<void> trackRead(int topicId) => _track('topic_read', topicId);

  Future<void> trackRecommendationClick(int topicId, {int position = 0}) =>
      _track('feed_click', topicId, position: position);

  Future<void> _track(String type, int topicId, {int position = 0}) async {
    try {
      await _api.post('/events', body: {
        'events': [
          {'type': type, 'targetId': topicId, 'position': position, 'surface': 'reading'},
        ],
      });
    } on ApiException {
      // 埋点失败不影响阅读
    }
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
