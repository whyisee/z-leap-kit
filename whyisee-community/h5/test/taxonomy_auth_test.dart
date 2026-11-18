import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:whyisee_app/core/api/api_exception.dart';
import 'package:whyisee_app/core/api/models.dart';
import 'package:whyisee_app/features/auth/auth_repository.dart';
import 'package:whyisee_app/features/auth/forgot_password_page.dart';
import 'package:whyisee_app/features/auth/signup_page.dart';
import 'package:whyisee_app/features/taxonomy/taxonomy_detail_page.dart';
import 'package:whyisee_app/features/taxonomy/taxonomy_repository.dart';

/// 这一批锁三件事：
/// 1. 注册页在字段没填齐时不许发请求（含密码不足 8 位）；
/// 2. 找回密码提交后必须落到「已发出」，而不是停在表单上让人反复点；
/// 3. 分类页要显示说明和话题，分类不存在时说人话。
void main() {
  testWidgets('注册页：字段没填齐时按钮不可点，填完才亮', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(const ProviderScope(child: MaterialApp(home: SignupPage())));
    await tester.pumpAndSettle();

    FilledButton button() => tester.widget<FilledButton>(find.byType(FilledButton));

    expect(button().onPressed, isNull);

    await tester.enterText(find.byType(TextField).at(0), 'zz_test');
    await tester.enterText(find.byType(TextField).at(1), 'zz@example.com');
    await tester.enterText(find.byType(TextField).at(2), 'short');
    await tester.enterText(find.byType(TextField).at(3), 'whyisee-invite');
    await tester.pumpAndSettle();

    // 密码 5 位：本地就该挡住，不必让服务端回一次 422
    expect(button().onPressed, isNull);

    await tester.enterText(find.byType(TextField).at(2), 'longenough123');
    await tester.pumpAndSettle();

    expect(button().onPressed, isNotNull);
  });

  testWidgets('找回密码：提交后进入「邮件已发出」，不再停在表单', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final repo = _FakeAuthRepo();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [authRepositoryProvider.overrideWithValue(repo)],
        child: const MaterialApp(home: ForgotPasswordPage()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('找回密码'), findsWidgets);

    await tester.enterText(find.byType(TextField).first, 'whyisee');
    await tester.pumpAndSettle();

    await tester.tap(find.text('发送重置邮件'));
    await tester.pumpAndSettle();

    expect(repo.requested, ['whyisee']);
    expect(find.text('邮件已发出'), findsOneWidget);
    // 邮件里是网页链接，所以这里必须说清楚「想在这改就把 token 粘过来」
    expect(find.text('我有 token'), findsOneWidget);
  });

  testWidgets('找回密码：带 token 进来直接落在设新密码那一段', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      const ProviderScope(child: MaterialApp(home: ForgotPasswordPage(token: 'abc123'))),
    );
    await tester.pumpAndSettle();

    expect(find.text('重置 token'), findsOneWidget);
    expect(find.text('新密码'), findsOneWidget);
    expect(find.text('发送重置邮件'), findsNothing);
  });

  testWidgets('分类页：显示说明与话题，条数是服务端给的', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          taxonomyRepositoryProvider.overrideWithValue(_FakeTaxonomyRepo()),
        ],
        child: const MaterialApp(
          home: TaxonomyDetailPage(kind: 'category', slug: 'ai'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('AI 工具、模型、Agent'), findsOneWidget);
    expect(find.text('17 篇分类'), findsOneWidget);
    expect(find.text('一篇正经的 AI 文章'), findsOneWidget);
    // 只有一页时不该出现「到底了」以外的加载痕迹
    expect(find.text('到底了'), findsOneWidget);
  });

  testWidgets('分类不存在：说人话，不是把 404 抛出来', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          taxonomyRepositoryProvider.overrideWithValue(_FakeTaxonomyRepo(missing: true)),
        ],
        child: const MaterialApp(
          home: TaxonomyDetailPage(kind: 'category', slug: 'nope'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('不存在'), findsOneWidget);
  });

  test('分类/标签模型：缺字段时给安全默认值，页面不用到处判空', () {
    final item = TaxonomyItem.fromJson(const {});

    expect(item.id, 0);
    expect(item.name, '');
    expect(item.topicCount, 0);
  });

  _draftTests();

  test('copyWith 能把 hasMore 改回 false —— 分页结束必须收住', () {
    const detail = TaxonomyDetail(
      kind: 'tag',
      item: TaxonomyItem(id: 1, name: 'seo', slug: 'seo'),
      topics: [],
      hasMore: true,
      nextOffset: 20,
    );

    final ended = detail.copyWith(hasMore: false, nextOffset: null);

    expect(ended.hasMore, isFalse);
    expect(ended.kindLabel, '标签');
  });
}

class _FakeAuthRepo implements AuthRepository {
  final List<String> requested = [];

  @override
  Future<String?> requestReset(String identifier) async {
    requested.add(identifier);
    return null;
  }

  @override
  Future<void> confirmReset({required String token, required String password}) async {}
}

class _FakeTaxonomyRepo implements TaxonomyRepository {
  _FakeTaxonomyRepo({this.missing = false});

  final bool missing;

  @override
  Future<TaxonomyDetail> category(String slug, {int offset = 0, int limit = 20}) async {
    if (missing) throw _notFound();
    return _detail('category');
  }

  @override
  Future<TaxonomyDetail> tag(String slug, {int offset = 0, int limit = 20}) async {
    if (missing) throw _notFound();
    return _detail('tag');
  }

  @override
  Future<List<TaxonomyItem>> categories() async => const [];

  @override
  Future<List<TaxonomyItem>> tags({int limit = 60}) async => const [];

  TaxonomyDetail _detail(String kind) => TaxonomyDetail(
        kind: kind,
        item: const TaxonomyItem(
          id: 1,
          name: 'AI',
          slug: 'ai',
          description: 'AI 工具、模型、Agent',
          color: '#8AB4F8',
          topicCount: 17,
        ),
        topics: const [
          TopicSummary(
            id: 91,
            title: '一篇正经的 AI 文章',
            slug: 'ai-post',
            summary: '',
            type: 'discussion',
            author: Author(id: 1, username: 'mika_ai', displayName: 'Mika AI'),
            replyCount: 0,
            likeCount: 0,
            viewCount: 0,
          ),
        ],
        hasMore: false,
      );
}

/// 和客户端对 not_found 的判断对齐：只有这个码才翻成「不存在」
ApiException _notFound() => ApiException(
      code: 'not_found',
      message: '这个分类不存在',
      statusCode: 404,
    );

/// 编辑页的预填：服务端只给作者，字段缺了也要能安全打开
void _draftTests() {
  test('编辑原文：字段缺失给安全默认值，标签只收字符串', () {
    final draft = TopicDraft.fromJson({
      'id': 95,
      'title': '改过的标题',
      'contentMarkdown': '正文',
      'type': 'article',
      'categoryId': 55,
      'status': 'pending',
      'tags': ['验证', 3, null],
    });

    expect(draft.id, 95);
    expect(draft.type, 'article');
    expect(draft.categoryId, 55);
    expect(draft.status, 'pending');
    expect(draft.tags, ['验证']);

    final empty = TopicDraft.fromJson(const {});
    expect(empty.id, 0);
    expect(empty.categoryId, isNull);
    expect(empty.tags, isEmpty);
  });
}
