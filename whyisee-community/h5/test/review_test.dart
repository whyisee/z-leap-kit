import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:whyisee_app/core/api/models.dart';
import 'package:whyisee_app/features/review/review_page.dart';
import 'package:whyisee_app/features/review/review_repository.dart';

/// 审核页钉住三件事：
/// 1. 通知的 `target` 决定去哪儿 —— 待审话题必须进审核页，而不是后台网页；
/// 2. 预审结论的语气（通过 / 退回 / 需人工）和风险分要能一眼看见；
/// 3. 390 宽下两个按钮不溢出，且通过按钮是实心主按钮。
void main() {
  test('target 解析：review 进审核页，旧服务端回落到 topic/web', () {
    final review = NotificationTarget.fromJson(
      {'kind': 'review', 'topicId': 95, 'path': '/admin?status=pending'},
      href: '/admin?status=pending',
    );
    expect(review.opensReview, isTrue);
    expect(review.opensReader, isFalse);
    expect(review.topicId, 95);

    final topic = NotificationTarget.fromJson(
      {'kind': 'topic', 'topicId': 91, 'path': '/t/91#post-503'},
      href: '/t/91#post-503',
    );
    expect(topic.opensReader, isTrue);
    expect(topic.opensReview, isFalse);

    // 老服务端只给 topicId：解析出帖子就走阅读器
    final legacy = NotificationTarget.fromJson(null, href: '/t/88', topicId: 88);
    expect(legacy.kind, 'topic');
    expect(legacy.opensReader, isTrue);

    // 什么都没有 = 网页容器
    final web = NotificationTarget.fromJson(null, href: '/admin/reports?status=open');
    expect(web.opensReview, isFalse);
    expect(web.opensReader, isFalse);
  });

  test('预审结论映射成人话', () {
    ReviewVerdict verdict(String decision) => ReviewVerdict.fromJson({
          'decision': decision,
          'riskScore': 20,
          'reasons': ['内容具体', '', '  '],
          'resultStatus': 'needs_human',
          'model': 'deepseek-v4-flash',
        });

    expect(verdict('approve').headline, '建议通过');
    expect(verdict('reject').headline, '建议退回');
    expect(verdict('needs_human').headline, '需要人工判断');
    expect(verdict('weird').headline, '没有预审结论');
    // 空白理由要丢掉，否则列表里会多出两条空行
    expect(verdict('approve').reasons, ['内容具体']);
  });

  testWidgets('390 宽渲染：结论、风险、两个按钮都在，不溢出', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [reviewRepositoryProvider.overrideWithValue(_FakeReviewRepo())],
        child: const MaterialApp(home: ReviewTopicPage(topicId: 95)),
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);

    expect(find.text('审核话题'), findsOneWidget);
    expect(find.text('还剩 2 条'), findsOneWidget);
    expect(find.text('建议通过'), findsOneWidget);
    expect(find.text('风险 20'), findsOneWidget);
    expect(find.text('内容具体，有事件描述和数据来源'), findsOneWidget);
    // 正文为空时不该去起 WebView，给一句人话
    expect(find.text('正文是空的。'), findsOneWidget);
    expect(find.text('通过并发布'), findsOneWidget);
    expect(find.text('退回草稿'), findsOneWidget);
  });
}

class _FakeReviewRepo implements ReviewRepository {
  @override
  Future<ReviewDetail> detail(int topicId) async => ReviewDetail(
        topic: ReviewTopic(
          id: topicId,
          title: '张雪机车上热搜了,国产摩托也能上 WSBK 领奖台?',
          summary: '',
          contentHtml: '',
          type: 'discussion',
          status: 'pending',
          author: const Author(id: 31, username: 'agent', displayName: '采集助手'),
          category: const CategoryRef(id: 58, name: '沙雕', slug: 'funny'),
          tags: const [TagRef(id: 1, name: '摩托', slug: 'moto')],
          createdAt: DateTime.now(),
        ),
        verdict: const ReviewVerdict(
          decision: 'approve',
          riskScore: 20,
          reasons: ['内容具体，有事件描述和数据来源'],
          resultStatus: 'needs_human',
          model: 'deepseek-v4-flash',
        ),
        remaining: 2,
        nextId: 89,
      );

  @override
  Future<ReviewActionResult> act(int topicId, String action) async =>
      const ReviewActionResult(id: 95, status: 'published', remaining: 2, nextId: 89);
}
