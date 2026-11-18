import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:whyisee_app/core/api/models.dart';
import 'package:whyisee_app/core/providers.dart';
import 'package:whyisee_app/features/settings/settings_account_page.dart';
import 'package:whyisee_app/features/settings/settings_profile_page.dart';
import 'package:whyisee_app/features/settings/settings_repository.dart';
import 'package:whyisee_app/features/user/user_page.dart';
import 'package:whyisee_app/features/user/user_repository.dart';

/// 这一批锁的是「点下去会发生什么」，不是排版：
/// 1. 别人的主页给「关注」，自己的主页给「编辑资料」；
/// 2. 关注是 toggle，成功后立刻变「已关注」，关注者数跟着 +1；
/// 3. 设置页的客户端校验要挡住明显错的输入，不要浪费一次请求。
void main() {
  testWidgets('别人的主页：显示资料与统计，关注后变「已关注」', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final repo = _FakeUserRepo();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionProvider.overrideWith(_SignedInSession.new),
          userRepositoryProvider.overrideWithValue(repo),
        ],
        child: const MaterialApp(home: UserPage(username: 'mika_ai')),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Mika AI'), findsWidgets);
    expect(find.text('@mika_ai'), findsOneWidget);
    expect(find.text('写 AI 的人'), findsOneWidget);
    expect(find.text('关注'), findsOneWidget);
    expect(find.text('编辑资料'), findsNothing);

    await tester.tap(find.text('关注'));
    await tester.pumpAndSettle();

    expect(repo.toggled, 1);
    expect(find.text('已关注'), findsOneWidget);
    // 关注者从 12 变 13：数字要立刻动，否则用户以为没点上
    expect(find.text('13'), findsOneWidget);
  });

  testWidgets('自己的主页：不给关注按钮，给编辑资料', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionProvider.overrideWith(_SignedInSession.new),
          userRepositoryProvider.overrideWithValue(_FakeUserRepo(isSelf: true)),
        ],
        child: const MaterialApp(home: UserPage(username: 'whyisee')),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('编辑资料'), findsOneWidget);
    expect(find.text('关注'), findsNothing);
    expect(find.text('已关注'), findsNothing);
  });

  testWidgets('公开资料：昵称为空时不发请求，直接提示', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final repo = _FakeSettingsRepo();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionProvider.overrideWith(_SignedInSession.new),
          settingsRepositoryProvider.overrideWithValue(repo),
        ],
        child: const MaterialApp(home: SettingsProfilePage()),
      ),
    );
    await tester.pumpAndSettle();

    // 服务端回的昵称已回填到表单
    expect(find.text('whyisee'), findsOneWidget);

    await tester.enterText(find.byType(TextField).first, '   ');
    await tester.tap(find.text('保存'));
    await tester.pumpAndSettle();

    expect(repo.saves, 0);
    expect(find.text('昵称不能为空'), findsOneWidget);
  });

  testWidgets('密码与认证：两次新密码不一致时不发请求', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final repo = _FakeSettingsRepo();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionProvider.overrideWith(_SignedInSession.new),
          settingsRepositoryProvider.overrideWithValue(repo),
        ],
        child: const MaterialApp(home: SettingsAccountPage()),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).at(0), 'old-password');
    await tester.enterText(find.byType(TextField).at(1), 'new-password-1');
    await tester.enterText(find.byType(TextField).at(2), 'new-password-2');
    await tester.tap(find.text('更新密码'));
    await tester.pumpAndSettle();

    expect(repo.passwordChanges, 0);
    expect(find.text('两次输入的新密码不一样'), findsOneWidget);
  });
}

class _SignedInSession extends SessionController {
  @override
  SessionState build() => const SessionState(
        status: SessionStatus.signedIn,
        user: SessionUser(id: 1, username: 'whyisee', displayName: 'whyisee'),
      );
}

class _FakeUserRepo implements UserRepository {
  _FakeUserRepo({this.isSelf = false});

  final bool isSelf;
  int toggled = 0;

  @override
  Future<ProfilePageData> load(String username) async => ProfilePageData(
        id: 42,
        username: isSelf ? 'whyisee' : 'mika_ai',
        displayName: isSelf ? 'whyisee' : 'Mika AI',
        bio: isSelf ? '' : '写 AI 的人',
        isSelf: isSelf,
        following: false,
        joinedAt: DateTime(2024, 3, 2),
        stats: const ProfileStats(
          topicCount: 8,
          replyCount: 21,
          followerCount: 12,
          followingCount: 5,
          trustName: '老手',
        ),
        topics: const [],
      );

  @override
  Future<bool> toggleFollow(int userId) async {
    toggled++;
    return true;
  }
}

class _FakeSettingsRepo implements SettingsRepository {
  int saves = 0;
  int passwordChanges = 0;

  @override
  Future<MyProfile> loadProfile() async => const MyProfile(
        username: 'whyisee',
        displayName: 'whyisee',
        bio: '坏水王',
        locale: 'zh',
        email: 'admin@whyisee.xyz',
      );

  @override
  Future<void> saveProfile({
    required String displayName,
    required String bio,
    required String avatarUrl,
    required String websiteUrl,
    required String githubUrl,
    required String locale,
  }) async {
    saves++;
  }

  @override
  Future<void> changePassword({
    required String currentPassword,
    required String nextPassword,
  }) async {
    passwordChanges++;
  }

  @override
  Future<List<AgentDevice>> loadAgents() async => const [];

  @override
  Future<void> unbindAgent(int id) async {}
}
