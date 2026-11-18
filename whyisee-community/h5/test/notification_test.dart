import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:whyisee_app/core/api/models.dart';
import 'package:whyisee_app/core/providers.dart';
import 'package:whyisee_app/features/notifications/notification_controller.dart';
import 'package:whyisee_app/features/notifications/notification_page.dart';
import 'package:whyisee_app/features/notifications/notification_repository.dart';

/// 通知页钉住五件事：
/// 1. 首屏按「全部」只拉一次，未读计数整页一次带回来；
/// 2. 切档 = 换 filter 重拉，游标作废（否则会接着上一档的 offset 续页）；
/// 3. 点开一条 = 本地立刻置已读（返回列表不能还亮着）+ 只提交这一条 id；
/// 4. 全部已读走 `all`，计数归零；
/// 5. 未登录不发请求。
void main() {
  test('首屏只拉一次，未读计数一次带回', () async {
    final repo = _FakeRepo();
    final container = _container(repo);

    container.listen(notificationControllerProvider, (_, _) {});
    await _settle();

    expect(repo.calls, [('all', null)]);
    final state = container.read(notificationControllerProvider);
    expect(state.items.length, 3);
    expect(state.counts.total, 3);
    expect(state.counts.replies, 2);
    expect(state.counts.system, 1);
  });

  test('切档重拉，游标作废', () async {
    final repo = _FakeRepo();
    final container = _container(repo);

    container.listen(notificationControllerProvider, (_, _) {});
    await _settle();

    // 先造一个游标出来：有 hasMore 才有 cursor
    expect(container.read(notificationControllerProvider).cursor, isNotNull);

    await container
        .read(notificationControllerProvider.notifier)
        .changeFilter(NotificationFilter.likes);
    await _settle();

    expect(repo.calls.last, ('likes', null));
    expect(
      container.read(notificationControllerProvider).filter,
      NotificationFilter.likes,
    );
    // 计数是全量的，切档不能被清空
    expect(container.read(notificationControllerProvider).counts.total, 3);
  });

  test('点开一条：本地立刻已读，只提交这一条', () async {
    final repo = _FakeRepo();
    final container = _container(repo);

    container.listen(notificationControllerProvider, (_, _) {});
    await _settle();

    final first = container.read(notificationControllerProvider).items.first;
    await container.read(notificationControllerProvider.notifier).markRead(first);
    await _settle();

    final state = container.read(notificationControllerProvider);
    expect(state.items.first.read, isTrue);
    expect(repo.readIds, [
      [first.id]
    ]);
    // 3 条未读里点掉 1 条
    expect(state.counts.total, 2);
  });

  test('全部已读走 all，计数归零', () async {
    final repo = _FakeRepo();
    final container = _container(repo);

    container.listen(notificationControllerProvider, (_, _) {});
    await _settle();

    await container.read(notificationControllerProvider.notifier).markAllRead();
    await _settle();

    expect(repo.readAll, 1);
    final state = container.read(notificationControllerProvider);
    expect(state.counts.total, 0);
    expect(state.items.every((e) => e.read), isTrue);
  });

  test('未登录不发请求', () async {
    final repo = _FakeRepo();
    final container = ProviderContainer(
      overrides: [
        notificationRepositoryProvider.overrideWithValue(repo),
        sessionProvider.overrideWith(_SignedOutSession.new),
      ],
    );
    addTearDown(container.dispose);

    container.listen(notificationControllerProvider, (_, _) {});
    await _settle();

    expect(repo.calls, isEmpty);
    expect(container.read(notificationControllerProvider).items, isEmpty);
  });

  testWidgets('390 宽下渲染：五档全可见、按日期分组、未读计数上角标', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          notificationRepositoryProvider.overrideWithValue(_FakeRepo()),
          sessionProvider.overrideWith(_FakeSession.new),
        ],
        child: const MaterialApp(home: NotificationPage()),
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);

    expect(find.text('通知'), findsOneWidget);
    for (final filter in NotificationFilter.values) {
      expect(find.text(filter.label), findsOneWidget);
    }

    // 今天 / 昨天两个分组标题
    expect(find.text('今天'), findsOneWidget);
    expect(find.text('昨天'), findsOneWidget);

    // 未读那条的标题要显眼，且带「谁做的」
    expect(find.text('李雷 回复了你的话题'), findsOneWidget);
    expect(find.textContaining('李明 的这条回复'), findsOneWidget);
    // 系统类（审核结果）走「谁 · 系统通知」，和回复/赞区分开
    expect(find.textContaining('· 系统通知'), findsOneWidget);
  });
}

ProviderContainer _container(_FakeRepo repo) {
  final container = ProviderContainer(
    overrides: [
      notificationRepositoryProvider.overrideWithValue(repo),
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

class _FakeRepo implements NotificationRepository {
  final calls = <(String, String?)>[];
  final readIds = <List<int>>[];
  int readAll = 0;

  @override
  Future<NotificationPageResult> load({
    NotificationFilter filter = NotificationFilter.all,
    String? cursor,
  }) async {
    calls.add((filter.wire, cursor));

    final now = DateTime.now();
    return NotificationPageResult(
      items: [
        NotificationItem(
          id: 21,
          type: 'topic_reply',
          kind: 'reply',
          title: '李雷 回复了你的话题',
          body: '这个观点我有不同看法，先看数据怎么来的。',
          href: '/t/91#post-503',
          read: false,
          timeLabel: '3 分钟前',
          topicId: 91,
          actorName: '李明',
          at: now,
        ),
        NotificationItem(
          id: 20,
          type: 'topic_auto_approved',
          kind: 'system',
          title: '话题已通过自动审核',
          body: '搋定律到底是什么',
          href: '/t/91',
          read: false,
          timeLabel: '1 小时前',
          topicId: 91,
          actorName: '审核助手',
          at: now,
        ),
        NotificationItem(
          id: 19,
          type: 'like',
          kind: 'like',
          title: '收到一个赞',
          body: '',
          href: '/t/90',
          read: false,
          timeLabel: '昨天 09:12',
          topicId: 90,
          actorName: '张三',
          at: now.subtract(const Duration(days: 1)),
        ),
      ],
      counts: const NotificationCounts(total: 3, replies: 2, system: 1, likes: 1),
      // 有下一页才会给游标，切档测试要靠它验证「游标作废」
      hasMore: true,
      nextCursor: 'cursor-20',
    );
  }

  @override
  Future<NotificationCounts> markRead({List<int> ids = const [], bool all = false}) async {
    if (all) {
      readAll += 1;
      return const NotificationCounts();
    }

    readIds.add(ids);
    final remaining = ids.contains(21) ? 2 : 3;
    return NotificationCounts(total: remaining, replies: 1, system: 1);
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
