import 'package:flutter_test/flutter_test.dart';
import 'package:whyisee_app/core/api/models.dart';

/// 搜索页的逻辑只有两处值得钉住：
/// 1. 一条结果点开时能原生打开还是只能进网页 —— 判错就是把用户扔进 WebView；
/// 2. 分组顺序稳定 —— 顺序乱跳会让人以为结果变了。
void main() {
  test('话题和用户能原生打开，分类/标签只能走网页', () {
    SearchHit hit(String kind, String href) =>
        SearchHit(kind: kind, title: 't', href: href);

    expect(hit('topic', '/t/91').nativePath, '/t/91');
    expect(hit('topic', '/t/91#post-3').nativePath, '/t/91');
    expect(hit('user', '/u/mika_ai').nativePath, '/u/mika_ai');

    // 分类 / 标签页还没原生化，必须留给网页容器
    expect(hit('tag', '/tag/cursor-plugin').nativePath, isNull);
    expect(hit('category', '/c/design').nativePath, isNull);
    expect(hit('reply', '/t/91#post-3').nativePath, isNull);

    // href 形状不对时宁可不跳原生，也不要拼出一个打不开的地址
    expect(hit('topic', '/latest').nativePath, isNull);
    expect(hit('user', '/u/').nativePath, isNull);
  });

  test('分组顺序固定：话题在前，其余按固定顺序，未知类型兜到最后', () {
    final outcome = SearchOutcome(
      q: 'x',
      hits: const [
        SearchHit(kind: 'tag', title: 'a', href: '/tag/a'),
        SearchHit(kind: 'user', title: 'b', href: '/u/b'),
        SearchHit(kind: 'topic', title: 'c', href: '/t/1'),
        SearchHit(kind: 'topic', title: 'd', href: '/t/2'),
        SearchHit(kind: 'weird', title: 'e', href: '/e'),
      ],
    );

    expect(
      outcome.grouped.map((entry) => entry.key).toList(),
      ['topic', 'user', 'tag', 'weird'],
    );
    expect(outcome.grouped.first.value.length, 2);
  });

  test('服务端给的 notes / warnings 原样带出来，供页面提示「你的词被改写了」', () {
    final outcome = SearchOutcome.fromJson({
      'q': '设计',
      'notes': ['已按分类「设计」筛选'],
      'warnings': ['AI 暂时不可用，已退回关键词搜索'],
      'results': [
        {'kind': 'topic', 'title': '标题', 'href': '/t/9', 'meta': '2 天前'},
      ],
    });

    expect(outcome.notes, ['已按分类「设计」筛选']);
    expect(outcome.warnings, ['AI 暂时不可用，已退回关键词搜索']);
    expect(outcome.hits.single.title, '标题');
  });
}
