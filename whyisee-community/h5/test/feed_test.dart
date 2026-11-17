import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:whyisee_app/core/api/api_client.dart';
import 'package:whyisee_app/core/api/models.dart';
import 'package:whyisee_app/core/api/token_store.dart';
import 'package:whyisee_app/features/feed/feed_controller.dart';
import 'package:whyisee_app/features/feed/feed_page.dart';
import 'package:whyisee_app/features/feed/feed_repository.dart';

/// 分类切换是「再也不能丢」的功能，用假仓库把三件事钉住：
/// 1. 切分类真的把 `category` 带给服务端（不带就是静默返回全部）；
/// 2. 切分类不会顺手把排序重置回推荐；
/// 3. 切分类后旧游标作废、列表是从头开始的。
void main() {
  test('切分类：带上 category、保留排序、游标重置', () async {
    final repo = _FakeRepo();
    final container = ProviderContainer(
      overrides: [feedRepositoryProvider.overrideWithValue(repo)],
    );
    addTearDown(container.dispose);

    container.listen(feedControllerProvider, (_, _) {});
    await _settle();

    // 首屏 + 分类选项
    expect(container.read(feedControllerProvider).items.map((e) => e.id), [1, 2]);
    expect(container.read(feedControllerProvider).categories.length, 2);

    // 先切排序，再切分类，排序必须被保留
    await container.read(feedControllerProvider.notifier).changeSort(FeedSort.latest);
    await _settle();
    await container.read(feedControllerProvider.notifier).changeCategory('ai');
    await _settle();

    final state = container.read(feedControllerProvider);
    expect(repo.lastCategory, 'ai');
    expect(repo.lastSort, FeedSort.latest);
    expect(state.categorySlug, 'ai');
    expect(state.sort, FeedSort.latest);
    expect(state.items.map((e) => e.id), [3]);
    // 新分类的第一页不该带着上一次的游标
    expect(repo.lastCursor, isNull);
  });

  test('分类接口失败时只剩「全部」，列表照常可用', () async {
    final repo = _FakeRepo(categoriesFail: true);
    final container = ProviderContainer(
      overrides: [feedRepositoryProvider.overrideWithValue(repo)],
    );
    addTearDown(container.dispose);

    container.listen(feedControllerProvider, (_, _) {});
    await _settle();

    expect(container.read(feedControllerProvider).categories, isEmpty);
    expect(container.read(feedControllerProvider).items, isNotEmpty);
  });

  testWidgets('分类条渲染在头部、点一下触发切换（390 宽不溢出）', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final repo = _FakeRepo();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [feedRepositoryProvider.overrideWithValue(repo)],
        child: const MaterialApp(home: FeedPage()),
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text('全部'), findsOneWidget);
    expect(find.text('AI'), findsOneWidget);
    expect(find.text('项目'), findsOneWidget);

    await tester.tap(find.text('AI'));
    await tester.pumpAndSettle();

    expect(repo.lastCategory, 'ai');
    expect(tester.takeException(), isNull);
  });
}

/// Notifier 的 build 把请求推到微任务里，两轮足够让请求落地。
Future<void> _settle() async {
  await Future<void>.delayed(Duration.zero);
  await Future<void>.delayed(Duration.zero);
}

class _FakeRepo extends FeedRepository {
  _FakeRepo({this.categoriesFail = false}) : super(ApiClient(TokenStore()));

  final bool categoriesFail;

  String? lastCategory;
  FeedSort? lastSort;
  String? lastCursor;

  @override
  Future<FeedPageResult> load({
    required FeedSort sort,
    String? cursor,
    String? categorySlug,
    int limit = 20,
  }) async {
    lastSort = sort;
    lastCategory = categorySlug;
    lastCursor = cursor;

    final items = categorySlug == null
        ? [
            TopicSummary.fromJson({'id': 1, 'title': '话题 1'}),
            TopicSummary.fromJson({'id': 2, 'title': '话题 2'}),
          ]
        : [TopicSummary.fromJson({'id': 3, 'title': '话题 3'})];

    return FeedPageResult(items: items, hasMore: false, nextCursor: null);
  }

  @override
  Future<List<CategoryRef>> categories() async {
    if (categoriesFail) return const [];
    return const [
      CategoryRef(id: 1, name: 'AI', slug: 'ai', color: '#8AB4F8'),
      CategoryRef(id: 2, name: '项目', slug: 'project', color: '#66D08C'),
    ];
  }
}
