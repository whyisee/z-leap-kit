import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/api/models.dart';
import '../../core/providers.dart';

final composeRepositoryProvider = Provider<ComposeRepository>(
  (ref) => ComposeRepository(ref.watch(apiClientProvider)),
);

/// 发布页的选项：分类 / 标签 / 话题类型。
/// 走 `/meta/taxonomy`，服务端缓存 10 分钟，进发布页不会每次都打数据库。
///
/// `retry: null` 关掉 Riverpod 3 的默认指数退避重试：接口没部署时
/// 它会连打五六次 404，用户看到的只是「分类一直转圈」。
final taxonomyProvider = FutureProvider<Taxonomy>(
  (ref) async {
    final payload = await ref.watch(apiClientProvider).get('/meta/taxonomy');
    return Taxonomy.fromJson(payload.data);
  },
  retry: (_, _) => null,
);

class ComposeResult {
  const ComposeResult({required this.id, required this.status});

  final int id;

  /// draft / pending
  final String status;

  bool get isDraft => status == 'draft';
}

class ComposeRepository {
  ComposeRepository(this._api);

  final ApiClient _api;

  /// 提交话题。普通用户只能存草稿或提交审核，直接发布由服务端兜底拒绝。
  Future<ComposeResult> submit({
    required String title,
    required String contentMarkdown,
    required int categoryId,
    required String type,
    required List<String> tags,
    required bool draft,
    required String requestId,
  }) async {
    final payload = await _api.post('/topics', body: {
      'title': title,
      'contentMarkdown': contentMarkdown,
      'categoryId': categoryId,
      'type': type,
      'tags': tags,
      'status': draft ? 'draft' : 'pending',
      'clientRequestId': requestId,
    });

    return ComposeResult(
      id: (payload.data['id'] as num?)?.toInt() ?? 0,
      status: payload.data['status'] as String? ?? (draft ? 'draft' : 'pending'),
    );
  }
}

/// 一次编辑会话一个 id：网络抖动后重试不会发出两篇一模一样的帖子。
String newComposeRequestId() {
  final random = Random();
  final suffix = List.generate(4, (_) => random.nextInt(0x10000).toRadixString(16)).join();
  return 'compose-${DateTime.now().millisecondsSinceEpoch}-$suffix';
}
