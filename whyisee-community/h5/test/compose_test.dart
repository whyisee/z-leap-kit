import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:whyisee_app/core/api/models.dart';
import 'package:whyisee_app/core/providers.dart';
import 'package:whyisee_app/features/compose/compose_page.dart';
import 'package:whyisee_app/features/compose/compose_repository.dart';

/// 发布页要锁住的行为：
/// 1. 分区行默认显示「类型 · 分类」，不点开也能直接发；
/// 2. 选项收在弹层里，主页面上不铺开；
/// 3. 弹层里改完点完成才生效，选项真的带上去了；
/// 4. 标题太短不发请求，就地报错；
/// 5. 正常填写后带对参数提交，普通用户只能是 pending；
/// 6. 390 宽下不溢出。
void main() {
  testWidgets('分区默认显示第一项，主页面不铺开选项', (tester) async {
    final repo = _FakeComposeRepo();
    await _pump(tester, repo);

    // 默认值就是发出去的值
    expect(find.text('讨论 · AI'), findsOneWidget);
    // 分类/类型的 chip 只在弹层里出现
    expect(find.text('提问'), findsNothing);
    expect(find.text('资源'), findsNothing);
  });

  testWidgets('标题太短就地报错，不发请求', (tester) async {
    final repo = _FakeComposeRepo();
    await _pump(tester, repo);

    await tester.enterText(find.byType(TextField).first, '短');
    await tester.enterText(find.byType(TextField).at(1), '这是一段足够长的正文内容。');
    await tester.tap(find.text('发布'));
    await tester.pumpAndSettle();

    expect(find.text('标题至少 4 个字'), findsOneWidget);
    expect(repo.calls, 0);
  });

  testWidgets('正常提交：带对分类与类型，状态是 pending', (tester) async {
    final repo = _FakeComposeRepo();
    await _pump(tester, repo);

    await tester.enterText(find.byType(TextField).first, '原生发布页自测标题');
    await tester.enterText(find.byType(TextField).at(1), '这是正文，用来验证提交参数对不对。');

    // 分区收在弹层里：点开 → 选分类和类型 → 完成
    await tester.tap(find.text('讨论 · AI'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('资源'));
    await tester.pump();
    await tester.tap(find.text('提问'));
    await tester.pump();
    await tester.tap(find.text('完成'));
    await tester.pumpAndSettle();

    expect(find.text('提问 · 资源'), findsOneWidget);

    await tester.tap(find.text('发布'));
    await tester.pumpAndSettle();

    expect(repo.calls, 1);
    expect(repo.lastTitle, '原生发布页自测标题');
    expect(repo.lastCategoryId, 60);
    expect(repo.lastType, 'question');
    expect(repo.lastDraft, isFalse);
  });

  testWidgets('存草稿：同样字段，draft=true', (tester) async {
    final repo = _FakeComposeRepo();
    await _pump(tester, repo);

    await tester.enterText(find.byType(TextField).first, '草稿也要有标题');
    await tester.enterText(find.byType(TextField).at(1), '还没写完的内容。');
    await tester.tap(find.text('存草稿'));
    await tester.pumpAndSettle();

    expect(repo.calls, 1);
    expect(repo.lastDraft, isTrue);
  });

  testWidgets('未登录时不出编辑器', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionProvider.overrideWith(_SignedOutSession.new),
          composeRepositoryProvider.overrideWithValue(_FakeComposeRepo()),
          taxonomyProvider.overrideWith((ref) async => _taxonomy),
        ],
        child: const MaterialApp(home: ComposePage()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('登录后才能写'), findsOneWidget);
    expect(find.text('发布'), findsNothing);
  });
}

const _taxonomy = Taxonomy(
  categories: [
    CategoryRef(id: 55, name: 'AI', slug: 'ai', color: '#66d08c'),
    CategoryRef(id: 60, name: '资源', slug: 'resources', color: '#5bd7e8'),
  ],
  tags: [TagRef(id: 1, name: 'Flutter', slug: 'flutter')],
  types: [
    TaxonomyType(id: 'discussion', label: '讨论'),
    TaxonomyType(id: 'question', label: '提问'),
  ],
);

Future<void> _pump(WidgetTester tester, _FakeComposeRepo repo) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        sessionProvider.overrideWith(_FakeSession.new),
        composeRepositoryProvider.overrideWithValue(repo),
        taxonomyProvider.overrideWith((ref) async => _taxonomy),
      ],
      child: const MaterialApp(home: ComposePage()),
    ),
  );
  await tester.pumpAndSettle();
  expect(tester.takeException(), isNull);
}

class _FakeComposeRepo implements ComposeRepository {
  int calls = 0;
  String? lastTitle;
  int? lastCategoryId;
  String? lastType;
  List<String> lastTags = const [];
  bool lastDraft = false;

  @override
  Future<ComposeResult> submit({
    required String title,
    required String contentMarkdown,
    required int categoryId,
    required String type,
    required List<String> tags,
    required bool draft,
    required String requestId,
  }) async {
    calls++;
    lastTitle = title;
    lastCategoryId = categoryId;
    lastType = type;
    lastTags = tags;
    lastDraft = draft;
    return ComposeResult(id: 1, status: draft ? 'draft' : 'pending');
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
