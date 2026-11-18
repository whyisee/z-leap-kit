import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:whyisee_app/core/api/models.dart';
import 'package:whyisee_app/features/me/my_topics_page.dart';

/// 「我的文章」锁三件事：
/// 1. 待审核和草稿真的在这个列表里（它们在首页、我的话题里都不出现）；
/// 2. 状态徽标和筛选数字对得上；
/// 3. 点待审的稿子进编辑页，而不是进阅读器（点进阅读器是 404）。
void main() {
  testWidgets('三种状态都列出来，徽标各自正确', (tester) async {
    await _pump(tester, _result());

    expect(find.text('我的文章'), findsOneWidget);
    expect(find.text('已发布 1'), findsOneWidget);
    expect(find.text('待审核 1'), findsOneWidget);
    expect(find.text('草稿 1'), findsOneWidget);
    expect(find.text('早就发出去的那篇'), findsOneWidget);
    expect(find.text('还在等审核的那篇'), findsOneWidget);
    expect(find.text('只写了开头的草稿'), findsOneWidget);
  });

  testWidgets('筛选只留对应状态', (tester) async {
    await _pump(tester, _result());

    await tester.tap(find.text('草稿 1'));
    await tester.pumpAndSettle();

    expect(find.text('只写了开头的草稿'), findsOneWidget);
    expect(find.text('还在等审核的那篇'), findsNothing);
    expect(find.text('早就发出去的那篇'), findsNothing);
  });

  testWidgets('点待审的稿子进编辑页', (tester) async {
    await _pump(tester, _result());

    await tester.tap(find.text('还在等审核的那篇'));
    await tester.pumpAndSettle();

    expect(find.text('编辑 2'), findsOneWidget);
  });

  testWidgets('点已发布的进阅读器', (tester) async {
    await _pump(tester, _result());

    await tester.tap(find.text('早就发出去的那篇'));
    await tester.pumpAndSettle();

    expect(find.text('读 1'), findsOneWidget);
  });

  testWidgets('全空时给空态', (tester) async {
    await _pump(tester, const MyTopicsResult());

    expect(find.text('这里还没有文章'), findsOneWidget);
  });
}

MyTopicsResult _result() => MyTopicsResult(
  published: 1,
  pending: 1,
  draft: 1,
  items: [
    _topic(1, '早就发出去的那篇', 'published'),
    _topic(2, '还在等审核的那篇', 'pending'),
    _topic(3, '只写了开头的草稿', 'draft'),
  ],
);

TopicSummary _topic(int id, String title, String status) => TopicSummary(
  id: id,
  title: title,
  slug: '',
  summary: '',
  type: 'article',
  author: const Author(id: 1, username: 'whyisee', displayName: 'whyisee'),
  replyCount: 2,
  likeCount: 0,
  viewCount: 0,
  category: const CategoryRef(id: 1, name: '技术', slug: 'tech'),
  status: status,
  updatedAt: DateTime(2026, 11, 18),
);

Future<void> _pump(WidgetTester tester, MyTopicsResult result) async {
  final router = GoRouter(
    initialLocation: '/me/topics',
    routes: [
      GoRoute(path: '/me/topics', builder: (_, _) => const MyTopicsPage()),
      GoRoute(
        path: '/me/t/:id',
        builder: (_, state) => Scaffold(body: Text('读 ${state.pathParameters['id']}')),
      ),
      GoRoute(
        path: '/compose/edit/:id',
        builder: (_, state) => Scaffold(body: Text('编辑 ${state.pathParameters['id']}')),
      ),
    ],
  );

  await tester.pumpWidget(
    ProviderScope(
      overrides: [myTopicsProvider.overrideWith((ref) async => result)],
      child: MaterialApp.router(routerConfig: router),
    ),
  );
  await tester.pumpAndSettle();
}
