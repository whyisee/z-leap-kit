import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:whyisee_app/features/topic/topic_entry.dart';
import 'package:whyisee_app/features/topic/widgets/entry_banner.dart';

/// 从通知点进详情，这两件事必须成立：
/// 1. href 里的 `#post-123` 能解析出来 —— 解析不出就找不到该滚到哪一层；
/// 2. 来由条说清「谁、什么时候、能不能定位」，目标楼层不在了要老实说。
void main() {
  group('postAnchorOf', () {
    test('取出 #post- 后面的楼层号', () {
      expect(postAnchorOf('/t/79/some-slug#post-1234'), 1234);
      expect(postAnchorOf('/t/79#post-7'), 7);
    });

    test('没有锚点就是 null（点赞这类通知指向整篇）', () {
      expect(postAnchorOf('/t/79'), isNull);
      expect(postAnchorOf('/t/79/some-slug'), isNull);
      expect(postAnchorOf(''), isNull);
    });

    test('锚点不是数字不硬解', () {
      expect(postAnchorOf('/t/79#post-abc'), isNull);
      expect(postAnchorOf('/t/79#post-0'), isNull);
    });
  });

  group('EntryBanner', () {
    Future<void> pumpBanner(WidgetTester tester, Widget child) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(backgroundColor: const Color(0xFF0D1016), body: child),
        ),
      );
      await tester.pump();
    }

    testWidgets('回复通知：说明来由 + 已定位', (tester) async {
      var locatedTaps = 0;
      await pumpBanner(
        tester,
        EntryBanner(
          entry: const TopicEntry(kind: 'reply', actorName: '李雷', timeLabel: '3 分钟前'),
          located: true,
          hasTarget: true,
          onLocate: () => locatedTaps++,
          onDismiss: () {},
        ),
      );

      expect(find.text('李雷 回复了你的话题'), findsOneWidget);
      expect(find.textContaining('已定位到这条回复'), findsOneWidget);
      expect(find.textContaining('3 分钟前'), findsOneWidget);

      await tester.tap(find.text('李雷 回复了你的话题'));
      await tester.pump();
      expect(locatedTaps, 1);
    });

    testWidgets('目标楼层不在了：如实提示，不给定位入口', (tester) async {
      var locatedTaps = 0;
      await pumpBanner(
        tester,
        EntryBanner(
          entry: const TopicEntry(kind: 'reply', actorName: '李雷', timeLabel: '昨天'),
          located: false,
          hasTarget: true,
          onLocate: () => locatedTaps++,
          onDismiss: () {},
        ),
      );

      expect(find.textContaining('可能已被删除'), findsOneWidget);
      expect(find.text('定位'), findsNothing);

      await tester.tap(find.text('李雷 回复了你的话题'));
      await tester.pump();
      expect(locatedTaps, 0);
    });

    testWidgets('点赞通知没有楼层：不提示定位，也不可点', (tester) async {
      await pumpBanner(
        tester,
        EntryBanner(
          entry: const TopicEntry(kind: 'like', actorName: '韩梅梅', timeLabel: '昨天'),
          located: false,
          hasTarget: false,
          onLocate: () {},
          onDismiss: () {},
        ),
      );

      expect(find.text('韩梅梅 赞了你的话题'), findsOneWidget);
      expect(find.textContaining('已定位'), findsNothing);
      expect(find.textContaining('可能已被删除'), findsNothing);
    });

    testWidgets('系统通知没有作者，写「系统」', (tester) async {
      await pumpBanner(
        tester,
        EntryBanner(
          entry: const TopicEntry(kind: 'system', timeLabel: '今天'),
          located: false,
          hasTarget: false,
          onLocate: () {},
          onDismiss: () {},
        ),
      );

      expect(find.text('站内通知'), findsOneWidget);
    });

    testWidgets('收起按钮回调', (tester) async {
      var dismissed = 0;
      await pumpBanner(
        tester,
        EntryBanner(
          entry: const TopicEntry(kind: 'mention', actorName: '李雷', timeLabel: '刚刚'),
          located: true,
          hasTarget: true,
          onLocate: () {},
          onDismiss: () => dismissed++,
        ),
      );

      await tester.tap(find.byIcon(Icons.close));
      await tester.pump();
      expect(dismissed, 1);
    });

    testWidgets('390 宽下不溢出', (tester) async {
      tester.view.physicalSize = const Size(390 * 3, 844 * 3);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);

      await pumpBanner(
        tester,
        EntryBanner(
          entry: const TopicEntry(
            kind: 'reply',
            actorName: '一个名字特别特别长的用户用来撑破布局',
            timeLabel: '2026 年 11 月 18 日 20:44',
          ),
          located: true,
          hasTarget: true,
          onLocate: () {},
          onDismiss: () {},
        ),
      );

      expect(tester.takeException(), isNull);
    });
  });
}
