import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/api/models.dart';
import '../../core/providers.dart';

final userRepositoryProvider = Provider<UserRepository>(
  (ref) => UserRepository(ref.watch(apiClientProvider)),
);

/// 用户主页。
///
/// 接口登录可选：没登录也能看别人的主页，只是拿不到「我有没有关注他」。
class UserRepository {
  UserRepository(this._api);

  final ApiClient _api;

  Future<ProfilePageData> load(String username) async {
    final payload = await _api.get('/users/${Uri.encodeComponent(username)}');
    return ProfilePageData.fromJson(payload.data);
  }

  /// 关注 / 取关。复用互动接口（它本身是 toggle，不带方向），和网页同一张关系表。
  Future<bool> toggleFollow(int userId) async {
    final payload = await _api.post(
      '/interactions/follow',
      body: {'targetType': 'user', 'targetId': userId},
    );

    return payload.data['following'] as bool? ?? false;
  }
}
