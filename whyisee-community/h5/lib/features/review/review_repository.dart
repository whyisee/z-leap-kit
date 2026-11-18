import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/api/models.dart';
import '../../core/providers.dart';

final reviewRepositoryProvider = Provider<ReviewRepository>(
  (ref) => ReviewRepository(ref.watch(apiClientProvider)),
);

/// 审核队列的读写口子。
///
/// 只有两个动作：读一条待审、给它一个结论。没有列表接口 —— 队列就是通知列表，
/// 再做一个「待审列表」会和通知里的同一批东西重复。
class ReviewRepository {
  ReviewRepository(this._api);

  final ApiClient _api;

  Future<ReviewDetail> detail(int topicId) async {
    final payload = await _api.get('/admin/review/topics/$topicId');
    return ReviewDetail.fromJson(payload.data);
  }

  /// [action] 只接受 `publish`（通过并发布）或 `draft`（退回草稿）。
  Future<ReviewActionResult> act(int topicId, String action) async {
    final payload = await _api.post(
      '/admin/review/topics/$topicId',
      body: {'action': action},
    );
    return ReviewActionResult.fromJson(payload.data);
  }
}
