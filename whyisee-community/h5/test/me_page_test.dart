import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:whyisee_app/core/api/models.dart';
import 'package:whyisee_app/core/providers.dart';
import 'package:whyisee_app/features/me/me_page.dart';
import 'package:whyisee_app/features/me/me_repository.dart';

/// 「我」页是纯展示，用假数据锁住两件事：
/// 1. 窄屏下不溢出 —— 溢出在测试里会抛异常，直接失败（360 是主流小屏下限）；
/// 2. 关键信息真的渲染出来了（不是空白）。
void main() {
  for (final width in [360.0, 393.0]) {
    testWidgets('「我」页在 $width 宽下正常渲染且不溢出', (tester) async {
      tester.view.physicalSize = Size(width, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            sessionProvider.overrideWith(_FakeSession.new),
            meOverviewProvider.overrideWith(_FakeOverview.new),
          ],
          child: const MaterialApp(home: MePage()),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);

      expect(find.text('我'), findsOneWidget);
      expect(find.text('邹轲辉'), findsOneWidget);
      expect(find.text('@zoukehui'), findsOneWidget);
      expect(find.text('主题'), findsOneWidget);
      expect(find.text('粉丝'), findsOneWidget);
      expect(find.text('我的话题'), findsOneWidget);
      expect(find.text('还没发过帖子'), findsOneWidget);
      expect(find.text('Lv.3 老手'), findsOneWidget);

      // 设置项和退出按钮在首屏之外，滚下去才构建
      await tester.scrollUntilVisible(find.text('退出登录'), 240);
      expect(find.text('公开资料'), findsOneWidget);
      expect(find.text('退出登录'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('未登录时给出登录引导', (tester) async {
    tester.view.physicalSize = const Size(393, 852);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionProvider.overrideWith(_SignedOutSession.new),
          meOverviewProvider.overrideWith(_EmptyOverview.new),
        ],
        child: const MaterialApp(home: MePage()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('还没登录'), findsOneWidget);
    expect(find.text('登录'), findsOneWidget);
  });
}

class _FakeSession extends SessionController {
  @override
  SessionState build() => const SessionState(
        status: SessionStatus.signedIn,
        user: SessionUser(
          id: 7,
          username: 'zoukehui',
          displayName: '邹轲辉',
        ),
        unreadCount: 3,
      );
}

class _SignedOutSession extends SessionController {
  @override
  SessionState build() => const SessionState(status: SessionStatus.signedOut);
}

MeOverview _fakeOverview() => MeOverview(
      profile: const MeProfile(
        id: 7,
        username: 'zoukehui',
        displayName: '邹轲辉',
        bio: '数据开发，写点把数据讲清楚的东西。',
        role: 'member',
      ),
      stats: const MeStats(
        topicCount: 12,
        replyCount: 34,
        followerCount: 8,
        followingCount: 21,
        contributionScore: 96,
        trustLevel: 3,
        trustName: '老手',
        nextLevelScore: 200,
        nextLevelName: '常驻',
      ),
      badges: const [
        MeBadge(id: 'first-topic', name: '第一篇帖子', icon: 'T', tone: 'blue'),
        MeBadge(id: 'featured-author', name: '精选作者', icon: '★', tone: 'gold'),
      ],
      unreadCount: 3,
    );

class _FakeOverview extends MeOverviewController {
  @override
  Future<MeOverview?> build() async => _fakeOverview();
}

class _EmptyOverview extends MeOverviewController {
  @override
  Future<MeOverview?> build() async => null;
}
