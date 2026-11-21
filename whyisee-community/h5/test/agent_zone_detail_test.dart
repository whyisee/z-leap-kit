import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:whyisee_app/core/api/models.dart';
import 'package:whyisee_app/features/agent_zone/agent_detail_page.dart';
import 'package:whyisee_app/features/agent_zone/agent_task_compose_page.dart';
import 'package:whyisee_app/features/agent_zone/agent_task_detail_page.dart';
import 'package:whyisee_app/features/agent_zone/agent_zone_repository.dart';

/// Agent 专区补的三页：谁会跑（Agent 详情）、在做什么（任务详情）、
/// 怎么派活（发任务）。这一批的断言只锁「该出现的信息出现了」和
/// 「不该放飞的操作被拦住了」——像素级排版不在这里管。
void main() {
  testWidgets('Agent 详情：身份、设备、运行、任务履历都在', (tester) async {
    await _pump(
      tester,
      ProviderScope(
        overrides: [agentZoneRepositoryProvider.overrideWithValue(_FakeRepo())],
        child: const MaterialApp(home: AgentDetailPage(agentId: 1)),
      ),
    );

    // 名字在标题栏和身份卡里各一次
    expect(find.text('整理员'), findsWidgets);
    expect(find.text('在线'), findsWidgets);
    expect(find.text('负责把行业资讯收拢成日报'), findsOneWidget);
    expect(find.text('content-sort'), findsOneWidget);

    expect(find.text('设备'), findsWidgets);
    expect(find.text('mac-mini'), findsOneWidget);

    expect(find.text('最近运行'), findsOneWidget);
    expect(find.text('skill-sort@1.4'), findsOneWidget);

    expect(find.text('任务履历'), findsOneWidget);
    expect(find.text('把上周资讯整理成一篇周报'), findsOneWidget);
  });

  testWidgets('任务详情：说明、验收、配置、领取与事件流都渲染', (tester) async {
    await _pump(
      tester,
      ProviderScope(
        overrides: [agentZoneRepositoryProvider.overrideWithValue(_FakeRepo(publicSubmissions: true))],
        child: const MaterialApp(home: AgentTaskDetailPage(taskId: 9)),
      ),
    );

    expect(find.text('把上周资讯整理成一篇周报'), findsWidgets);
    expect(find.text('任务说明'), findsOneWidget);
    expect(find.text('背景：本周有 42 条线索，需要合并成一篇。'), findsOneWidget);
    expect(find.text('验收标准'), findsOneWidget);
    expect(find.text('每条都要有来源链接。'), findsOneWidget);
    expect(find.text('task-9'), findsOneWidget);

    expect(find.text('领取记录'), findsOneWidget);
    expect(find.text('整理员'), findsWidgets);

    expect(find.text('提交结果'), findsOneWidget);
    expect(find.text('已交 3 条，合并成 1 篇。'), findsOneWidget);
    expect(find.text('得分 88'), findsOneWidget);

    expect(find.text('事件流'), findsOneWidget);
    expect(find.text('admin · published'), findsOneWidget);
  });

  testWidgets('任务详情：提交不公开时只给一句提示，不显示内容', (tester) async {
    await _pump(
      tester,
      ProviderScope(
        overrides: [agentZoneRepositoryProvider.overrideWithValue(_FakeRepo(publicSubmissions: false))],
        child: const MaterialApp(home: AgentTaskDetailPage(taskId: 9)),
      ),
    );

    expect(find.text('这个任务的提交结果不公开'), findsOneWidget);
    expect(find.text('已交 3 条，合并成 1 篇。'), findsNothing);
  });

  testWidgets('发任务：少写标题直接拦下，不打请求', (tester) async {
    final repo = _FakeRepo();

    await _pump(tester, _composeApp(repo));

    await tester.tap(find.text('发布任务'));
    await tester.pump();

    expect(repo.createdTitles, isEmpty);
    expect(find.text('标题至少 4 个字'), findsOneWidget);
  });

  testWidgets('发任务：填完能提交，提交后返回上一页', (tester) async {
    final repo = _FakeRepo();

    await _pump(tester, _composeApp(repo));

    await tester.enterText(find.byType(TextField).at(0), '整理上周资讯');
    await tester.enterText(find.byType(TextField).at(1), '把本周 42 条线索合并成一篇周报。');
    await tester.enterText(find.byType(TextField).at(2), '每条带来源链接');

    await tester.tap(find.text('发布任务'));
    await tester.pumpAndSettle();

    expect(repo.createdTitles, ['整理上周资讯']);
    expect(repo.createdDraft, isFalse);
    // 发布成功会 pop 回发起页
    expect(find.text('专区首页'), findsOneWidget);
  });
}

Widget _composeApp(_FakeRepo repo) {
  final router = GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => Scaffold(
          body: Center(
            child: TextButton(
              onPressed: () => context.push('/agent-zone/tasks/new'),
              child: const Text('专区首页'),
            ),
          ),
        ),
      ),
      GoRoute(path: '/agent-zone/tasks/new', builder: (context, state) => const AgentTaskComposePage()),
    ],
  );

  return ProviderScope(
    overrides: [agentZoneRepositoryProvider.overrideWithValue(repo)],
    child: MaterialApp.router(routerConfig: router),
  );
}

Future<void> _pump(WidgetTester tester, Widget child) async {
  // 详情页比一屏长：给个高一点的画布，让整页都构建出来，
  // 否则 ListView 懒加载会让后面的区块压根不存在，断言就成了「测滚动」。
  tester.view.physicalSize = const Size(400, 4200);
  tester.view.devicePixelRatio = 1;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });

  await tester.pumpWidget(child);

  final trigger = find.text('专区首页');
  if (trigger.evaluate().isNotEmpty) {
    await tester.tap(trigger);
    await tester.pumpAndSettle();
    return;
  }

  await tester.pumpAndSettle();
}

class _FakeRepo implements AgentZoneRepository {
  _FakeRepo({this.publicSubmissions = true});

  final bool publicSubmissions;
  final List<String> createdTitles = [];
  bool? createdDraft;

  @override
  Future<AgentDetail> agent(int id) async => AgentDetail.fromJson(_agentJson);

  @override
  Future<AgentTaskDetail> task(int id) async =>
      AgentTaskDetail.fromJson(_taskJson(publicSubmissions: publicSubmissions));

  @override
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
    createdTitles.add(title);
    createdDraft = draft;

    return (id: 12, status: draft ? 'draft' : 'open');
  }

  @override
  Future<AgentPlaza> plaza() => throw UnimplementedError();

  @override
  Future<AgentAcademy> academy() => throw UnimplementedError();

  @override
  Future<AgentTaskHall> tasks() => throw UnimplementedError();
}

const _agentJson = {
  'agent': {
    'id': 1,
    'name': '整理员',
    'role': '资讯整理',
    'status': '在线',
    'owner': 'whyisee',
    'summary': '负责把行业资讯收拢成日报',
    'skills': ['content-sort'],
    'metrics': [
      {'label': '质量', 'value': '88'},
    ],
    'current': '整理本周线索',
    'lastActive': '3 分钟前',
  },
  'stats': [
    {'label': '质量', 'value': '88'},
    {'label': '运行', 'value': '12'},
    {'label': '设备', 'value': '1'},
  ],
  'devices': [
    {'id': 1, 'deviceName': 'mac-mini', 'status': '在线', 'lastSeen': '2 分钟前', 'createdAt': '2026-10-01 10:00'},
  ],
  'runs': [
    {
      'id': 1,
      'runKey': 'run-1',
      'skillVersion': 'skill-sort@1.4',
      'task': '日报',
      'status': '成功',
      'outputSummary': '生成了 3 条摘要',
      'qualityScore': '90',
      'createdAt': '2026-11-20 21:00',
    },
  ],
  'assignments': [
    {
      'id': 1,
      'taskId': 9,
      'title': '把上周资讯整理成一篇周报',
      'type': '内容创作',
      'taskStatus': '进行中',
      'assignmentStatus': '已领取',
      'claimedAt': '2026-11-19 09:00',
      'completedAt': '',
      'submissionStatus': '',
      'submittedAt': '',
    },
  ],
};

Map<String, dynamic> _taskJson({required bool publicSubmissions}) => {
  'task': {
    'id': 9,
    'title': '把上周资讯整理成一篇周报',
    'type': '内容创作',
    'statusLabel': '进行中',
    'priority': 'P2',
    'reward': '质量分',
    'assignee': '整理员',
    'due': '2026-11-25',
    'skills': ['content-sort'],
    'acceptance': '每条都要有来源链接。',
    'submissionCount': 1,
    'taskKey': 'task-9',
    'description': '背景：本周有 42 条线索，需要合并成一篇。',
    'acceptanceCriteria': '每条都要有来源链接。',
    'submissionFormat': 'markdown',
    'executorType': 'agent',
    'resultDestination': 'agent_artifacts',
    'humanInteractionMode': 'read_only',
    'submissionVisibility': publicSubmissions ? 'public' : 'private',
    'canViewSubmissions': publicSubmissions,
    'maxAssignees': 1,
    'createdAt': '2026-11-18 09:00',
    'updatedAt': '2026-11-19 09:00',
  },
  'stats': [
    {'label': '状态', 'value': '进行中'},
    {'label': '领取', 'value': '1/1'},
    {'label': '提交', 'value': '1'},
  ],
  'assignments': [
    {
      'id': 1,
      'agentName': '整理员',
      'status': '已领取',
      'claimedAt': '2026-11-19 09:00',
      'dueAt': '2026-11-25',
      'completedAt': '',
    },
  ],
  'submissions': [
    {
      'id': 1,
      'agentName': '整理员',
      'status': '待审核',
      'score': '88',
      'decision': 'pending',
      'bodySummary': '已交 3 条，合并成 1 篇。',
      'selfReview': '来源都补了',
      'submittedAt': '2026-11-20 20:00',
    },
  ],
  'events': [
    {'id': 1, 'actorName': 'admin', 'eventType': 'published', 'detail': '', 'createdAt': '2026-11-18 09:00'},
  ],
};
