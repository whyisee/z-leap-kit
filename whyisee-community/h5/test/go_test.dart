import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:whyisee_app/core/api/api_client.dart';
import 'package:whyisee_app/core/api/models.dart';
import 'package:whyisee_app/core/api/token_store.dart';
import 'package:whyisee_app/features/go/go_controller.dart';
import 'package:whyisee_app/features/go/go_page.dart';
import 'package:whyisee_app/features/go/go_repository.dart';

/// 任务台是「一行一件事」，和看见的卡片流不是同一东西。钉住三件事：
/// 1. 按类型分组，顺序按紧迫度（待回答 → 可领取 → 求反馈），组内保留服务端排序；
/// 2. 空组不出现；
/// 3. 补页按 targetType+targetId 去重。
void main() {
  test('分组：按类型归组、顺序固定、空组不出现', () async {
    final repo = _FakeRepo();
    final container = ProviderContainer(
      overrides: [goRepositoryProvider.overrideWithValue(repo)],
    );
    addTearDown(container.dispose);

    container.listen(goControllerProvider, (_, _) {});
    await _settle();

    final groups = container.read(goControllerProvider).groups;
    // 数据里没有 resource，所以「可补充」整组不出现
    expect(groups.map((g) => g.label), ['待回答', '可领取', '求反馈']);
    expect(groups.first.items.map((e) => e.targetId), [1, 2]);
    expect(container.read(goControllerProvider).items.length, 4);
  });

  test('补页去重：同一件事第二次出现不会被追加', () async {
    final repo = _FakeRepo(secondPageRepeatsFirst: true);
    final container = ProviderContainer(
      overrides: [goRepositoryProvider.overrideWithValue(repo)],
    );
    addTearDown(container.dispose);

    container.listen(goControllerProvider, (_, _) {});
    await _settle();
    expect(container.read(goControllerProvider).items.length, 4);

    await container.read(goControllerProvider.notifier).loadMore();
    await _settle();

    final ids = container.read(goControllerProvider).items.map((e) => e.targetId).toList();
    expect(ids, [1, 2, 3, 4, 9]); // 第 5 条是重复的 question:1，被丢掉
  });

  testWidgets('任务台在手机宽度下渲染组头与行，不溢出（390 宽）', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [goRepositoryProvider.overrideWithValue(_FakeRepo())],
        child: const MaterialApp(home: GoPage()),
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);

    // 头部不是筛选条，而是一句话总结
    expect(find.text('出发'), findsOneWidget);
    expect(find.text('今天有 4 件事可做 · 3 类'), findsOneWidget);

    // 组头与行内容
    expect(find.text('待回答'), findsOneWidget);
    expect(find.text('可领取'), findsOneWidget);
    expect(find.text('怎么把超时重试做对'), findsOneWidget);
    expect(find.text('去回答'), findsNWidgets(2));

    // 摘要不在任务台出现（那是「看见」的形态）
    expect(find.text('摘要'), findsNothing);
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

  String? lastCursor;

  @override
  Future<ParticipationPageResult> load({String? cursor, int limit = 60}) async {
    lastCursor = cursor;

    if (cursor == null) {
      return ParticipationPageResult(
        items: [
          _item(type: 'question', id: 1, title: '怎么把超时重试做对', action: '去回答', reason: '这个问题还没人答'),
          _item(type: 'question', id: 2, title: 'Postgres 索引怎么选', action: '去回答', reason: '刚发布，回复为 0'),
          _item(type: 'community_task', id: 3, title: '整理一份部署清单', action: '领取任务', reason: '开放社区任务'),
          _item(type: 'project', id: 4, title: 'Leap Home 该打磨什么', action: '去点评', reason: '作者在等具体反馈'),
        ],
        hasMore: true,
        nextCursor: 'page2',
      );
    }

    return ParticipationPageResult(
      items: [
        if (secondPageRepeatsFirst)
          _item(type: 'question', id: 1, title: '怎么把超时重试做对', action: '去回答', reason: '这个问题还没人答'),
        _item(type: 'stale_content', id: 9, title: '两年前的部署文档', action: '去更新', reason: '内容已过期'),
      ],
      hasMore: false,
    );
  }

  ParticipationItem _item({
    required String type,
    required int id,
    required String title,
    required String action,
    required String reason,
  }) =>
      ParticipationItem(
        targetType: type,
        targetId: id,
        title: title,
        summary: '摘要',
        href: '/t/$id',
        actionLabel: action,
        reason: reason,
        category: const CategoryRef(id: 45, name: '项目', slug: 'projects', color: '#f3c969'),
        replyCount: 0,
      );
}
