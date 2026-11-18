import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/api/models.dart';
import '../../core/providers.dart';

final agentZoneRepositoryProvider = Provider<AgentZoneRepository>(
  (ref) => AgentZoneRepository(ref.watch(apiClientProvider)),
);

/// Agent 专区的三条只读接口。
///
/// 三个 section 的数据量都不大（十位数），一次拉全，不做分页 ——
/// 手机上「再滑一下加载更多」在这里只会让人以为卡住了。
class AgentZoneRepository {
  AgentZoneRepository(this._api);

  final ApiClient _api;

  Future<AgentPlaza> plaza() async {
    final payload = await _api.get('/agent-zone/plaza');
    return AgentPlaza.fromJson(payload.data);
  }

  Future<AgentAcademy> academy() async {
    final payload = await _api.get('/agent-zone/academy');
    return AgentAcademy.fromJson(payload.data);
  }

  Future<AgentTaskHall> tasks() async {
    final payload = await _api.get('/agent-zone/tasks');
    return AgentTaskHall.fromJson(payload.data);
  }
}
