import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/api/models.dart';
import '../../core/providers.dart';

/// 「我」页数据。只走一个聚合接口，避免进页面连打四五个请求。
class MeRepository {
  MeRepository(this._api);

  final ApiClient _api;

  Future<MeOverview> overview() async {
    final payload = await _api.get('/me/overview');
    return MeOverview.fromJson(payload.data);
  }

  /// 我的文章：含待审核与草稿（feed 和 overview 都只给已发布的）。
  Future<MyTopicsResult> myTopics() async {
    final payload = await _api.get('/me/topics');
    return MyTopicsResult.fromJson(payload.data);
  }
}

final meRepositoryProvider = Provider<MeRepository>(
  (ref) => MeRepository(ref.watch(apiClientProvider)),
);

/// 未登录时返回 null（不当作错误），页面据此渲染登录引导。
///
/// 关掉 Riverpod 3 的默认自动重试：接口 4xx（比如服务端还没部署这个端点）重试多少次
/// 都是同一个结果，只会在日志和网络上刷屏。失败后交给页面上的「重试」或下拉刷新。
final meOverviewProvider = AsyncNotifierProvider<MeOverviewController, MeOverview?>(
  MeOverviewController.new,
  retry: (retryCount, error) => null,
);

class MeOverviewController extends AsyncNotifier<MeOverview?> {
  @override
  Future<MeOverview?> build() async {
    final session = ref.watch(sessionProvider);
    if (!session.isSignedIn) return null;
    return ref.read(meRepositoryProvider).overview();
  }
}
