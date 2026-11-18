import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:whyisee_app/core/api/models.dart';
import 'package:whyisee_app/core/providers.dart';
import 'package:whyisee_app/features/go/go_controller.dart';
import 'package:whyisee_app/features/go/go_page.dart';
import 'package:whyisee_app/features/go/go_repository.dart';

/// 「出发」= 我该做的事。钉住四件事：
/// 1. 分组顺序跟服务端走，空组不出现；
/// 2. 点掉一条后本地摘掉，并回写已读（否则下拉刷新会复活）；
/// 3. 未登录不发请求（不然每次进 tab 都 401）；
/// 4. 390 宽下渲染不溢出。
void main() {
  test('分组保留服务端顺序，空组不出现', () async {
    final repo = _FakeRepo();
    final container = _container(repo);

    container.listen(goControllerProvider, (_, _) {});
    await _settle();

    final board = container.read(goControllerProvider).board;
    expect(board.groups.map((g) => g.label), ['等你回应', '等你验收']);
    expect(board.groups.first.items.map((e) => e.id), ['n-1', 'n-2']);
    expect(board.summary.actionable, 3);
  });

  test('处理一条后本地摘掉，actionable 跟着减', () async {
    final repo = _FakeRepo();
    final container = _container(repo);

    container.listen(goControllerProvider, (_, _) {});
    await _settle();

    container.read(goControllerProvider.notifier).dismiss('n-1');
    await _settle();

    final state = container.read(goControllerProvider);
    expect(state.board.groups.first.items.map((e) => e.id), ['n-2']);
    expect(state.summary.actionable, 2);
    // 通知类必须回写已读，否则下拉刷新它又回来
    expect(repo.markedRead, ['n-1']);
  });

  test('未登录不发请求', () async {
    final repo = _FakeRepo();
    final container = ProviderContainer(
      overrides: [
        goRepositoryProvider.overrideWithValue(repo),
        sessionProvider.overrideWith(_SignedOutSession.new),
      ],
    );
    addTearDown(container.dispose);

    container.listen(goControllerProvider, (_, _) {});
    await _settle();

    expect(repo.calls, 0);
    expect(container.read(goControllerProvider).board.isEmpty, isTrue);
  });

  testWidgets('出发页在 390 宽下渲染且不溢出', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          goRepositoryProvider.overrideWithValue(_FakeRepo()),
          sessionProvider.overrideWith(_FakeSession.new),
        ],
        child: const MaterialApp(home: GoPage()),
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);

    expect(find.text('出发'), findsOneWidget);
    expect(find.text('3 件等你处理'), findsOneWidget);
    expect(find.text('等你回应'), findsOneWidget);
    expect(find.text('李明 回复了你的话题'), findsOneWidget);
    expect(find.text('去回复'), findsWidgets);
    expect(find.text('去验收'), findsOneWidget);
  });
}

ProviderContainer _container(_FakeRepo repo) {
  final container = ProviderContainer(
    overrides: [
      goRepositoryProvider.overrideWithValue(repo),
      sessionProvider.overrideWith(_FakeSession.new),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

Future<void> _settle() async {
  await Future<void>.delayed(Duration.zero);
  await Future<void>.delayed(Duration.zero);
}

class _FakeRepo implements GoRepository {
  int calls = 0;
  final markedRead = <String>[];

  @override
  Future<TodoBoard> load() async {
    calls++;
    return const TodoBoard(
      summary: TodoSummary(total: 3, unread: 3, actionable: 3),
      groups: [
        TodoGroup(key: 'reply', label: '等你回应', items: [
          TodoItem(
            id: 'n-1',
            kind: 'reply',
            reason: '李明 回复了你的话题',
            title: '为什么我不用 Flutter 写后台',
            actionLabel: '去回复',
            href: '/t/91#post-501',
            topicId: 91,
            actorName: '李明',
            unread: true,
          ),
          TodoItem(
            id: 'n-2',
            kind: 'reply',
            reason: '王芳 在回复里提到了你',
            title: '数据开发转岗的几个问题',
            actionLabel: '去回复',
            href: '/t/92#post-502',
            topicId: 92,
            actorName: '王芳',
            unread: true,
          ),
        ]),
        TodoGroup(key: 'review', label: '等你验收', items: [
          TodoItem(
            id: 's-7',
            kind: 'review',
            reason: '阿强 提交了你的任务',
            title: '整理 2026 年机器人产业链清单',
            actionLabel: '去验收',
            href: '/agent-zone/tasks/7',
            unread: true,
          ),
        ]),
      ],
    );
  }

  @override
  Future<void> markRead(List<String> ids) async {
    markedRead.addAll(ids);
  }
}

class _FakeSession extends SessionController {
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
