import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:whyisee_app/core/api/models.dart';
import 'package:whyisee_app/core/providers.dart';
import 'package:whyisee_app/features/following/following_controller.dart';
import 'package:whyisee_app/features/following/following_page.dart';
import 'package:whyisee_app/features/following/following_repository.dart';

/// 「关注」= 订阅流。钉住四件事：
/// 1. 首屏按默认维度（全部）只拉一次，不带游标；
/// 2. 切维度 = 换 filter 重拉，游标作废（否则会接着上一维度的 offset 续页）；
/// 3. 未登录不发请求（关注关系是账号私有的，打过去只会 401）；
/// 4. 每行必须显式写出「这条是谁带来的」—— 这是它和「看见」的根本区别。
void main() {
  test('首屏只拉一次，默认维度是全部', () async {
    final repo = _FakeRepo();
    final container = _container(repo);

    container.listen(followingControllerProvider, (_, _) {});
    await _settle();

    expect(repo.calls, [('all', null)]);
    final state = container.read(followingControllerProvider);
    expect(state.items.length, 2);
    expect(state.hasMore, isFalse);
  });

  test('切维度重拉，游标作废', () async {
    final repo = _FakeRepo();
    final container = _container(repo);

    container.listen(followingControllerProvider, (_, _) {});
    await _settle();

    await container.read(followingControllerProvider.notifier).changeFilter(
          FollowingFilter.users,
        );
    await _settle();

    expect(repo.calls.last, ('users', null));
    expect(container.read(followingControllerProvider).filter, FollowingFilter.users);
  });

  test('未登录不发请求', () async {
    final repo = _FakeRepo();
    final container = ProviderContainer(
      overrides: [
        followingRepositoryProvider.overrideWithValue(repo),
        sessionProvider.overrideWith(_SignedOutSession.new),
      ],
    );
    addTearDown(container.dispose);

    container.listen(followingControllerProvider, (_, _) {});
    await _settle();

    expect(repo.calls, isEmpty);
    expect(container.read(followingControllerProvider).items, isEmpty);
  });

  testWidgets('关注页在 390 宽下渲染且不溢出，每行都带来源', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          followingRepositoryProvider.overrideWithValue(_FakeRepo()),
          sessionProvider.overrideWith(_FakeSession.new),
        ],
        child: const MaterialApp(home: FollowingPage()),
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);

    expect(find.text('关注'), findsOneWidget);
    // 五个维度一次全可见
    for (final filter in FollowingFilter.values) {
      expect(find.text(filter.label), findsOneWidget);
    }

    // 来源行：作者 / 标签各一条
    expect(find.text('来自 李明'), findsOneWidget);
    expect(find.text('来自 flutter'), findsOneWidget);
    expect(find.textContaining('为什么我不用 Flutter 写后台'), findsOneWidget);
  });
}

ProviderContainer _container(_FakeRepo repo) {
  final container = ProviderContainer(
    overrides: [
      followingRepositoryProvider.overrideWithValue(repo),
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

class _FakeRepo implements FollowingRepository {
  final calls = <(String, String?)>[];

  @override
  Future<FollowingPageResult> load({
    FollowingFilter filter = FollowingFilter.all,
    String? cursor,
  }) async {
    calls.add((filter.wire, cursor));
    return const FollowingPageResult(
      items: [
        FollowingItem(
          sourceType: 'user',
          sourceLabel: '李明',
          topicId: 91,
          title: '为什么我不用 Flutter 写后台',
          summary: '后台是长生命周期的东西，热重载救不了你。',
          timeLabel: '3 小时前',
          category: CategoryRef(id: 1, name: '讨论', slug: 'discuss', color: '#8AB4F8'),
          tags: [TagRef(id: 2, name: 'flutter', slug: 'flutter')],
        ),
        FollowingItem(
          sourceType: 'tag',
          sourceLabel: 'flutter',
          topicId: 92,
          title: '数据开发转岗的几个问题',
          summary: '',
          timeLabel: '昨天',
        ),
      ],
      hasMore: false,
    );
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
