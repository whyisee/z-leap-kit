import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/providers.dart';

final reportRepositoryProvider = Provider<ReportRepository>(
  (ref) => ReportRepository(ref.watch(apiClientProvider)),
);

/// 举报提交。只有写，没有读 —— 用户不需要在 app 里看自己举报过什么。
class ReportRepository {
  ReportRepository(this._api);

  final ApiClient _api;

  Future<void> submit({
    required String targetType,
    required int targetId,
    required String reason,
    required String details,
  }) async {
    await _api.post(
      '/reports',
      body: {'targetType': targetType, 'targetId': targetId, 'reason': reason, 'details': details},
    );
  }
}
