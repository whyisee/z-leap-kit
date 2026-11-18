import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:whyisee_app/core/api/models.dart';
import 'package:whyisee_app/core/providers.dart';
import 'package:whyisee_app/features/agent_zone/agent_zone_page.dart';
import 'package:whyisee_app/features/agent_zone/agent_zone_repository.dart';
import 'package:whyisee_app/features/projects/projects_page.dart';
import 'package:whyisee_app/features/projects/projects_repository.dart';
import 'package:whyisee_app/features/report/report_page.dart';
import 'package:whyisee_app/features/report/report_repository.dart';

/// 这一批（P3）锁四件事：
/// 1. 项目展示只渲染 topic 卡片，空数据说人话；
/// 2. Agent 专区三个 tab 各自有内容，切 tab 不重新发请求；
/// 3. 举报页未登录时不给表单（举报必须记名）；
/// 4. 举报原因太短不让提交 —— 服务端也会拦，但不该让用户白等一次往返。
void main() {
  testWidgets('项目展示：渲染话题卡片', (tester) async {
    await _pump(
      tester,
      ProviderScope(
        overrides: [
          projectsRepositoryProvider.overrideWithValue(
            _FakeProjectsRepo([
              _topicJson(id: 1, title: '一个用 Astro 写的小站'),
              _topicJson(id: 2, title: '把日报做成定时任务'),
            ]),
          ),
        ],
        child: const MaterialApp(home: ProjectsPage()),
      ),
    );

    expect(find.text('别人在做什么'), findsOneWidget);
    expect(find.text('一个用 Astro 写的小站'), findsOneWidget);
    expect(find.text('把日报做成定时任务'), findsOneWidget);
  });

  testWidgets('项目展示：空列表时给出空态而不是空白屏', (tester) async {
    await _pump(
      tester,
      ProviderScope(
        overrides: [projectsRepositoryProvider.overrideWithValue(_FakeProjectsRepo([]))],
        child: const MaterialApp(home: ProjectsPage()),
      ),
    );

    expect(find.text('还没有项目展示'), findsOneWidget);
  });

  testWidgets('Agent 专区：三个 tab 都能打开，切 tab 不重发请求', (tester) async {
    final repo = _FakeAgentZoneRepo();

    await _pump(
      tester,
      ProviderScope(
        overrides: [agentZoneRepositoryProvider.overrideWithValue(repo)],
        child: const MaterialApp(home: AgentZonePage()),
      ),
    );

    expect(find.text('测试 Agent'), findsOneWidget);
    expect(repo.plazaCalls, 1);

    await tester.tap(find.widgetWithText(Tab, '学院'));
    await tester.pumpAndSettle();
    expect(find.text('内容整理 Skill'), findsOneWidget);

    await tester.tap(find.widgetWithText(Tab, '任务'));
    await tester.pumpAndSettle();
    expect(find.text('整理一批行业资讯'), findsOneWidget);

    // 数据是一次性拉的，来回切 tab 不该再打接口
    expect(repo.plazaCalls, 1);
    expect(repo.academyCalls, 1);
    expect(repo.taskCalls, 1);
  });

  testWidgets('举报：未登录时只看到「登录后才能举报」', (tester) async {
    await _pump(
      tester,
      ProviderScope(
        overrides: [
          sessionProvider.overrideWith(_SignedOutSession.new),
          reportRepositoryProvider.overrideWithValue(_FakeReportRepo()),
        ],
        child: const MaterialApp(home: ReportPage(targetType: 'topic', targetId: 31)),
      ),
    );

    expect(find.text('登录后才能举报'), findsOneWidget);
    expect(find.text('提交举报'), findsNothing);
  });

  testWidgets('举报：原因不足时按钮不可点，填好后按参数提交', (tester) async {
    final repo = _FakeReportRepo();

    // 提交成功后会 pop 回来，所以这条要跑在真路由栈里（页面本身依赖 GoRouter）
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    const page = ReportPage(targetType: 'topic', targetId: 31, targetLabel: '一篇测试话题');
    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (_, _) => const Scaffold(body: SizedBox.shrink()),
        ),
        GoRoute(path: '/report', builder: (_, _) => page),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionProvider.overrideWith(_SignedInSession.new),
          reportRepositoryProvider.overrideWithValue(repo),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    router.push('/report');
    await tester.pumpAndSettle();

    expect(find.text('一篇测试话题'), findsOneWidget);

    FilledButton button() => tester.widget<FilledButton>(find.byType(FilledButton));
    expect(button().onPressed, isNull);

    // 点预设原因：不用打字也能提交
    await tester.tap(find.text('垃圾广告'));
    await tester.pumpAndSettle();
    expect(button().onPressed, isNotNull);

    await tester.tap(find.text('提交举报'));
    await tester.pumpAndSettle();

    expect(repo.calls, 1);
    expect(repo.lastTargetType, 'topic');
    expect(repo.lastTargetId, 31);
    expect(repo.lastReason, '垃圾广告');
    // 提交完就退回上一页，不把人留在表单上等回执
    expect(find.text('提交举报'), findsNothing);
  });
}

/// 统一 390 宽 + 等首帧。`root` 由调用方自己包 ProviderScope，
/// 这样各条用例要覆盖哪些 provider 一眼可见（也不用在这里导出 Override 类型）。
Future<void> _pump(WidgetTester tester, Widget root) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(root);
  await tester.pumpAndSettle();
}

Map<String, dynamic> _topicJson({required int id, required String title}) => {
  'id': id,
  'title': title,
  'slug': 'topic-$id',
  'summary': '$title 的摘要',
  'type': 'project',
  'author': {'id': 7, 'username': 'zoukehui', 'displayName': '邹轲辉', 'role': 'member'},
  'replyCount': 2,
  'likeCount': 3,
  'viewCount': 10,
  'publishedAt': '2026-11-18T10:00:00.000Z',
};

class _FakeProjectsRepo implements ProjectsRepository {
  _FakeProjectsRepo(List<Map<String, dynamic>> items) : _items = items;

  final List<Map<String, dynamic>> _items;

  @override
  Future<ProjectPageResult> load({int offset = 0, int limit = 20}) async => ProjectPageResult(
    items: _items.map(TopicSummary.fromJson).toList(growable: false),
    hasMore: false,
    nextOffset: null,
  );
}

class _FakeAgentZoneRepo implements AgentZoneRepository {
  int plazaCalls = 0;
  int academyCalls = 0;
  int taskCalls = 0;

  @override
  Future<AgentPlaza> plaza() async {
    plazaCalls += 1;
    return AgentPlaza.fromJson({
      'stats': [
        {'label': 'Agent', 'value': '1'},
        {'label': '任务', 'value': '1'},
      ],
      'agents': [
        {
          'id': 1,
          'name': '测试 Agent',
          'role': '整理',
          'status': '在线',
          'owner': 'whyisee',
          'summary': '负责整理行业资讯',
          'skills': ['content-sort'],
          'metrics': [
            {'label': '质量', 'value': '88'},
          ],
          'current': '整理资讯',
          'lastActive': '3 分钟前',
        },
      ],
      'capabilities': [
        {'capability': '资讯整理', 'owner': 'whyisee', 'state': '在线'},
      ],
    });
  }

  @override
  Future<AgentAcademy> academy() async {
    academyCalls += 1;
    return AgentAcademy.fromJson({
      'stats': [
        {'label': 'Skill', 'value': '1'},
      ],
      'skills': [
        {
          'id': 'content-sort',
          'name': '内容整理 Skill',
          'kind': '核心包',
          'summary': '把零散资讯整理成结构化条目',
          'status': '可用',
          'sourceLabel': '内置',
          'taskCount': 1,
          'agentCount': 1,
          'runCount': 4,
          'successRate': '100%',
          'qualityScore': '86',
          'lastUsedAt': '2026-11-18',
          'relatedTasks': [
            {'id': 1, 'title': '整理一批行业资讯'},
          ],
        },
      ],
      'practiceTasks': [],
    });
  }

  @override
  Future<AgentTaskHall> tasks() async {
    taskCalls += 1;
    return AgentTaskHall.fromJson({
      'stats': [
        {'label': '任务', 'value': '1'},
      ],
      'tasks': [
        {
          'id': 1,
          'title': '整理一批行业资讯',
          'type': '内容整理',
          'statusLabel': '进行中',
          'priority': '高',
          'reward': '质量分',
          'assignee': '测试 Agent',
          'due': '2026-11-20',
          'skills': ['content-sort'],
          'acceptance': '每条带来源链接',
          'submissionCount': 0,
        },
      ],
      'submissions': [],
    });
  }
}

class _FakeReportRepo implements ReportRepository {
  int calls = 0;
  String? lastTargetType;
  int? lastTargetId;
  String? lastReason;

  @override
  Future<void> submit({
    required String targetType,
    required int targetId,
    required String reason,
    required String details,
  }) async {
    calls += 1;
    lastTargetType = targetType;
    lastTargetId = targetId;
    lastReason = reason;
  }
}

class _SignedInSession extends SessionController {
  @override
  SessionState build() => const SessionState(
    status: SessionStatus.signedIn,
    user: SessionUser(id: 7, username: 'zoukehui', displayName: '邹轲辉'),
  );
}

class _SignedOutSession extends SessionController {
  @override
  SessionState build() => const SessionState(status: SessionStatus.signedOut);
}
