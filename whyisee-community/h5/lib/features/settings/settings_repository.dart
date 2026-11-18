import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/api/models.dart';
import '../../core/providers.dart';

final settingsRepositoryProvider = Provider<SettingsRepository>(
  (ref) => SettingsRepository(ref.watch(apiClientProvider)),
);

/// 设置页的数据出口。
///
/// 全部走 `/me/*`：这些接口只对本人开放，客户端不需要传 userId，
/// 也就没有「改到别人资料」这种可能。
class SettingsRepository {
  SettingsRepository(this._api);

  final ApiClient _api;

  Future<MyProfile> loadProfile() async {
    final payload = await _api.get('/me/profile');
    return MyProfile.fromJson(payload.data);
  }

  Future<void> saveProfile({
    required String displayName,
    required String bio,
    required String avatarUrl,
    required String websiteUrl,
    required String githubUrl,
    required String locale,
  }) async {
    await _api.patch('/me/profile', body: {
      'displayName': displayName,
      'bio': bio,
      'avatarUrl': avatarUrl,
      'websiteUrl': websiteUrl,
      'githubUrl': githubUrl,
      'locale': locale,
    });
  }

  Future<void> changePassword({
    required String currentPassword,
    required String nextPassword,
  }) async {
    await _api.post('/me/password', body: {
      'currentPassword': currentPassword,
      'nextPassword': nextPassword,
    });
  }

  Future<List<AgentDevice>> loadAgents() async {
    final payload = await _api.get('/me/agents');
    return ((payload.data['devices'] as List?) ?? const [])
        .whereType<Map>()
        .map((item) => AgentDevice.fromJson(item.cast<String, dynamic>()))
        .toList();
  }

  Future<void> unbindAgent(int id) async {
    await _api.post('/me/agents/$id/unbind', body: const {});
  }
}
