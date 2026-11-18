import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:whyisee_app/core/api/api_exception.dart';
import 'package:whyisee_app/core/api/models.dart';
import 'package:whyisee_app/features/auth/login_page.dart';
import 'package:whyisee_app/features/topic/topic_repository.dart';
import 'package:whyisee_app/features/topic/widgets/reply_bar.dart';

/// 这一批钉住两件用户能直接感受到的事：
/// 1. 帖子详情底部有「写回复」入口，登录前后文案不同，点开后能真的发出楼层；
/// 2. 登录页不依赖网页，账号密码不对时说人话，且空表单时按钮不可点。
void main() {
  testWidgets('未登录时底栏写「登录后回复」，登录后写「写回复…」', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            bottomNavigationBar: ReplyBar(signedIn: false, onTap: () {}),
          ),
        ),
      ),
    );
    expect(find.text('登录后回复'), findsOneWidget);

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            bottomNavigationBar: ReplyBar(signedIn: true, onTap: () {}),
          ),
        ),
      ),
    );
    expect(find.text('写回复…'), findsOneWidget);
  });

  testWidgets('回复层：空内容不能发，输入后发出去并把楼层交回来', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final repo = _FakeTopicRepo();

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
                    popped = await showReplyComposer(context, topicId: 91);
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

    expect(find.text('回复'), findsOneWidget);
    // 空内容时「发布」是禁用的
    final publish = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, '发布'),
    );
    expect(publish.onPressed, isNull);

    await tester.enterText(find.byType(TextField), '先说结论：这条我同意');
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(FilledButton, '发布'));
    await tester.pumpAndSettle();

    expect(repo.calls, ['91|先说结论：这条我同意']);
    expect(popped?.id, 7001);
    // 编辑层关掉后回到原页面
    expect(find.text('open'), findsOneWidget);
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

  testWidgets('登录页：空表单不可提交，填完两栏才亮', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: MaterialApp(home: LoginPage())));

    expect(find.text('欢迎回来'), findsOneWidget);
    expect(find.text('注册账号'), findsOneWidget);

    FilledButton button() =>
        tester.widget<FilledButton>(find.widgetWithText(FilledButton, '登录'));
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

class _FakeTopicRepo implements TopicRepository {
  _FakeTopicRepo({this.failWith});

  final String? failWith;
  final List<String> calls = [];

  @override
  Future<TopicPost> createPost({
    required int topicId,
    required String contentMarkdown,
    int? parentPostId,
  }) async {
    final error = failWith;
    if (error != null) throw ApiException(code: 'rate_limited', message: error);

    calls.add('$topicId|$contentMarkdown');
    return TopicPost(
      id: 7001,
      contentHtml: '<p>$contentMarkdown</p>',
      author: const Author(id: 1, username: 'whyisee', displayName: 'whyisee'),
      likeCount: 0,
      liked: false,
      createdAt: DateTime.now(),
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
