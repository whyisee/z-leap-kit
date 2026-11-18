import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:whyisee_app/core/api/api_client.dart';
import 'package:whyisee_app/core/api/models.dart';
import 'package:whyisee_app/core/api/token_store.dart';
import 'package:whyisee_app/features/go/go_controller.dart';
import 'package:whyisee_app/features/go/go_page.dart';
import 'package:whyisee_app/features/go/go_repository.dart';

/// 「出发」页三件事必须钉住：
/// 1. 切筛选真的把 `filter` 带给服务端（不带就永远是「全部」）；
/// 2. 切筛选后旧游标作废、从头开始；
/// 3. 补页时按 targetType+targetId 去重，同一项不会在列表里出现两次。
void main() {
  test('切筛选：带上 filter、游标重置', () async {
    final repo = _FakeRepo();
    final container = ProviderContainer(
      overrides: [goRepositoryProvider.overrideWithValue(repo)],
    );
    addTearDown(container.dispose);

    container.listen(goControllerProvider, (_, _) {});
    await _settle();

    expect(container.read(goControllerProvider).filter, GoFilter.all);
    expect(container.read(goControllerProvider).items.length, 2);

    await container.read(goControllerProvider.notifier).changeFilter(GoFilter.feedback);
    await _settle();

    final state = container.read(goControllerProvider);
    expect(repo.lastFilter, GoFilter.feedback);
    expect(repo.lastCursor, isNull);
    expect(state.filter, GoFilter.feedback);
    expect(state.items.map((e) => e.targetId), [3]);
  });

  test('补页去重：同一项第二次出现不会被追加', () async {
    final repo = _FakeRepo(secondPageRepeatsFirst: true);
    final container = ProviderContainer(
      overrides: [goRepositoryProvider.overrideWithValue(repo)],
    );
    addTearDown(container.dispose);

    container.listen(goControllerProvider, (_, _) {});
    await _settle();

    final controller = container.read(goControllerProvider.notifier);
    await controller.loadMore();
    await _settle();

    final ids = container.read(goControllerProvider).items.map((e) => e.targetId).toList();
    expect(ids, [1, 2, 4]); // 第 3 条是重复的 topic:1，被丢掉
  });

  testWidgets('筛选条与卡片在手机宽度下渲染且能点切换（390 宽不溢出）', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final repo = _FakeRepo();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [goRepositoryProvider.overrideWithValue(repo)],
        child: const MaterialApp(home: GoPage()),
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);

    // 头部与筛选
    expect(find.text('出发'), findsOneWidget);
    expect(find.text('待回答'), findsOneWidget);

    // 卡片内容真的渲染出来了
    expect(find.text('等一个后端复盘'), findsOneWidget);
    expect(find.text('求反馈'), findsWidgets);
    // 一行一张卡，每张卡右下都有行动按钮
    expect(find.text('去点评'), findsNWidgets(2));

    await tester.tap(find.text('可补充'));
    await tester.pumpAndSettle();

    expect(repo.lastFilter, GoFilter.supplement);
    expect(tester.takeException(), isNull);
  });
}

/// Notifier 的 build 把请求推到微任务里，两轮足够让请求落地。
Future<void> _settle() async {
  await Future<void>.delayed(Duration.zero);
  await Future<void>.delayed(Duration.zero);
}

class _FakeRepo extends GoRepository {
  _FakeRepo({this.secondPageRepeatsFirst = false}) : super(ApiClient(TokenStore()));

  final bool secondPageRepeatsFirst;

  GoFilter? lastFilter;
  String? lastCursor;

  @override
  Future<ParticipationPageResult> load({
    required GoFilter filter,
    String? cursor,
    int limit = 24,
  }) async {
    lastFilter = filter;
    lastCursor = cursor;

    if (filter != GoFilter.all) {
      return ParticipationPageResult(
        items: [_item(targetId: 3, title: '补一篇文档')],
        hasMore: false,
      );
    }

    if (cursor == null) {
      return ParticipationPageResult(
        items: [
          _item(targetId: 1, title: '等一个后端复盘'),
          _item(targetId: 2, title: 'VPS 能不能撑住'),
        ],
        hasMore: true,
        nextCursor: 'page2',
      );
    }

    return ParticipationPageResult(
      items: [
        if (secondPageRepeatsFirst) _item(targetId: 1, title: '等一个后端复盘'),
        _item(targetId: 4, title: '该更新了'),
      ],
      hasMore: false,
    );
  }

  ParticipationItem _item({required int targetId, required String title}) =>
      ParticipationItem(
        targetType: 'topic',
        targetId: targetId,
        title: title,
        summary: '摘要',
        href: '/t/$targetId',
        actionLabel: '去点评',
        reason: '作者正在等具体反馈。',
        category: const CategoryRef(id: 45, name: '项目', slug: 'projects', color: '#f3c969'),
      );
}
