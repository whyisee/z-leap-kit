import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:whyisee_app/core/api/api_exception.dart';
import 'package:whyisee_app/core/api/models.dart';
import 'package:whyisee_app/features/auth/login_page.dart';
import 'package:whyisee_app/features/topic/topic_repository.dart';
import 'package:whyisee_app/features/topic/widgets/post_tile.dart';
import 'package:whyisee_app/features/topic/widgets/reply_composer.dart';
import 'package:whyisee_app/features/topic/widgets/reply_fab.dart';

/// 这一批钉住三件用户能直接感受到的事：
/// 1. 写回复不再钉在底部，改成右下角圆钮，点开是弹层（不滚屏）；
/// 2. 弹层能指定「回哪一条」，请求里带 parentPostId，标题和摘要跟着变；
/// 3. 楼层里能看见「回复 @谁」，也能点「回复」单独回那一条。
void main() {
  testWidgets('评论圆钮：未登录上锁，已登录给数字角标', (tester) async {
    var taps = 0;

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: Center(child: ReplyFab(count: 0, signedIn: false, onTap: () => taps++)),
          ),
        ),
      ),
    );
    // 未登录：锁，不是评论图标
    expect(find.byIcon(Icons.lock_outline), findsOneWidget);
    expect(find.byIcon(Icons.mode_comment_outlined), findsNothing);

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: Center(child: ReplyFab(count: 12, signedIn: true, onTap: () => taps++)),
          ),
        ),
      ),
    );
    expect(find.byIcon(Icons.mode_comment_outlined), findsOneWidget);
    expect(find.text('12'), findsOneWidget);

    await tester.tap(find.byType(ReplyFab));
    expect(taps, 1);
  });

  testWidgets('回复层：不指定楼层时标题就是「回复」，parentPostId 为空', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final repo = _FakeTopicRepo();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [topicRepositoryProvider.overrideWithValue(repo)],
        child: MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: Center(
                child: ElevatedButton(
                  onPressed: () => showReplyComposer(context, topicId: 91),
                  child: const Text('open'),
                ),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    expect(find.text('回复'), findsOneWidget);
    final publish = tester.widget<FilledButton>(find.widgetWithText(FilledButton, '发布'));
    expect(publish.onPressed, isNull);

    await tester.enterText(find.byType(TextField), '先说结论：这条我同意');
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, '发布'));
    await tester.pumpAndSettle();

    expect(repo.calls.single, '91|null|先说结论：这条我同意');
  });

  testWidgets('回复某一条：标题带 @，贴出原话，请求带上那一条的 id', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final repo = _FakeTopicRepo();
    final target = _post(id: 5001, author: '小张', text: '这个方案我持保留意见，成本压不住');

    TopicPost? popped;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [topicRepositoryProvider.overrideWithValue(repo)],
        child: MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: Center(
                child: ElevatedButton(
                  onPressed: () async {
                    popped = await showReplyComposer(context, topicId: 91, replyTo: target);
                  },
                  child: const Text('open'),
                ),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    // 标题写清对象，摘要贴出原话 —— 回错了楼层是最常见的尴尬
    expect(find.text('回复 @小张'), findsOneWidget);
    expect(find.text('这个方案我持保留意见，成本压不住'), findsOneWidget);

    await tester.enterText(find.byType(TextField), '成本这块我有数据');
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, '发布'));
    await tester.pumpAndSettle();

    expect(repo.calls.single, '91|5001|成本这块我有数据');
    expect(popped?.parentPostId, 5001);
  });

  testWidgets('回复失败留在编辑层，内容不丢', (tester) async {
    final repo = _FakeTopicRepo(failWith: '发得太频繁了，歇一会儿再发');

    await tester.pumpWidget(
      ProviderScope(
        overrides: [topicRepositoryProvider.overrideWithValue(repo)],
        child: MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: Center(
                child: ElevatedButton(
                  onPressed: () => showReplyComposer(context, topicId: 91),
                  child: const Text('open'),
                ),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '内容还在吗');
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, '发布'));
    await tester.pumpAndSettle();

    expect(find.text('发得太频繁了，歇一会儿再发'), findsOneWidget);
    expect(find.text('回复'), findsOneWidget);
  });

  testWidgets('楼层：回了某一条就写「回复 @谁」，点「回复」回的是这一条', (tester) async {
    var hit = 0;
    var jumped = 0;
    final parent = _post(id: 5001, author: '小张', text: '原话');

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PostTile(
            post: _post(id: 5002, author: '老王', text: '我同意', parentId: 5001),
            floor: 2,
            parent: parent,
            onLike: () {},
            onReply: () => hit++,
            onJumpToParent: () => jumped++,
          ),
        ),
      ),
    );

    expect(find.text('回复 @小张'), findsOneWidget);

    await tester.tap(find.text('回复'));
    expect(hit, 1);

    await tester.tap(find.text('回复 @小张'));
    expect(jumped, 1);
  });

  testWidgets('楼层：主楼没有「回复 @谁」，被回复的楼层被删了也不编名字', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PostTile(
            post: _post(id: 5003, author: '老王', text: '主楼'),
            floor: 1,
            onLike: () {},
            onReply: () {},
          ),
        ),
      ),
    );
    expect(find.textContaining('回复 @'), findsNothing);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PostTile(
            post: _post(id: 5004, author: '老王', text: '回一条没了的', parentId: 4999),
            floor: 2,
            onLike: () {},
            onReply: () {},
          ),
        ),
      ),
    );
    expect(find.text('回复了一条已删除的评论'), findsOneWidget);
  });

  testWidgets('360 窄屏：长名字的「回复 @」和「回复」按钮都不溢出', (tester) async {
    tester.view.physicalSize = const Size(360, 780);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final parent = _post(id: 5001, author: '一个名字特别长的老哥', text: '主楼');

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PostTile(
            post: _post(
              id: 5002,
              author: '老王',
              text: '这条回复本身也很长，长到需要换好几行才能放下，用来看看窄屏下会不会把右边那颗按钮挤出去。',
              parentId: 5001,
            ),
            floor: 2,
            parent: parent,
            onLike: () {},
            onReply: () {},
            onJumpToParent: () {},
          ),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
    expect(find.text('回复'), findsOneWidget);
  });

  testWidgets('登录页：空表单不可提交，填完两栏才亮', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: MaterialApp(home: LoginPage())));

    expect(find.text('欢迎回来'), findsOneWidget);
    expect(find.text('注册账号'), findsOneWidget);

    FilledButton button() => tester.widget<FilledButton>(find.widgetWithText(FilledButton, '登录'));
    expect(button().onPressed, isNull);

    final fields = find.byType(TextField);
    await tester.enterText(fields.at(0), 'whyisee');
    await tester.pumpAndSettle();
    // 只填账号还不能提交
    expect(button().onPressed, isNull);

    await tester.enterText(fields.at(1), 'whyisee');
    await tester.pumpAndSettle();
    expect(button().onPressed, isNotNull);
  });
}

TopicPost _post({required int id, required String author, required String text, int? parentId}) => TopicPost(
  id: id,
  contentHtml: '<p>$text</p>',
  author: Author(id: id, username: 'u$id', displayName: author),
  likeCount: 0,
  liked: false,
  parentPostId: parentId,
  createdAt: DateTime.now(),
);

class _FakeTopicRepo implements TopicRepository {
  _FakeTopicRepo({this.failWith});

  final String? failWith;

  /// 记成 `topicId|parentPostId|正文`，一次断言就能看出回的是哪条
  final List<String> calls = [];

  @override
  Future<TopicPost> createPost({
    required int topicId,
    required String contentMarkdown,
    int? parentPostId,
  }) async {
    final error = failWith;
    if (error != null) throw ApiException(code: 'rate_limited', message: error);

    calls.add('$topicId|${parentPostId ?? 'null'}|$contentMarkdown');
    return _post(id: 7001, author: 'whyisee', text: contentMarkdown, parentId: parentPostId);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
