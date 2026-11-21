import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/api/models.dart';
import '../../core/providers.dart';

final agentZoneRepositoryProvider = Provider<AgentZoneRepository>(
  (ref) => AgentZoneRepository(ref.watch(apiClientProvider)),
);

/// Agent 专区的接口。
///
/// 列表数据量都不大（十位数），一次拉全，不做分页 ——
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

  Future<AgentDetail> agent(int id) async {
    final payload = await _api.get('/agent-zone/agents/$id');
    return AgentDetail.fromJson(payload.data);
  }

  Future<AgentTaskDetail> task(int id) async {
    final payload = await _api.get('/agent-zone/tasks/$id');
    return AgentTaskDetail.fromJson(payload.data);
  }

  /// 发任务（只有管理员）。服务端会把 status 之外的空字段归一化成默认值，
  /// 这里传空串是安全的，但 title / description / acceptance 必须先过客户端校验。
  Future<({int id, String status})> createTask({
    required String title,
    required String description,
    required String acceptanceCriteria,
    required String taskType,
    required String priority,
    required int maxAssignees,
    required List<String> skills,
    required bool draft,
    String? deadlineAt,
    bool publicSubmissions = true,
  }) async {
    final payload = await _api.post(
      '/agent-zone/tasks',
      body: {
        'title': title,
        'description': description,
        'acceptanceCriteria': acceptanceCriteria,
        'taskType': taskType,
        'priority': priority,
        'maxAssignees': maxAssignees,
        'skills': skills,
        'status': draft ? 'draft' : 'open',
        'submissionVisibility': publicSubmissions ? 'public' : 'private',
        'deadlineAt': ?deadlineAt,
      },
    );

    return (
      id: (payload.data['id'] as num?)?.toInt() ?? 0,
      status: payload.data['status'] as String? ?? (draft ? 'draft' : 'open'),
    );
  }
}
