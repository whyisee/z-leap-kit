import 'package:flutter_test/flutter_test.dart';
import 'package:whyisee_app/core/api/models.dart';

/// 搜索页的逻辑只有两处值得钉住：
/// 1. 一条结果点开时能原生打开还是只能进网页 —— 判错就是把用户扔进 WebView；
/// 2. 分组顺序稳定 —— 顺序乱跳会让人以为结果变了。
void main() {
  test('话题 / 回复 / 用户 / 分类 / 标签都能原生打开，未知类型留给网页', () {
    SearchHit hit(String kind, String href) =>
        SearchHit(kind: kind, title: 't', href: href);

    expect(hit('topic', '/t/91').nativePath, '/t/91');
    expect(hit('topic', '/t/91#post-3').nativePath, '/t/91');
    expect(hit('user', '/u/mika_ai').nativePath, '/u/mika_ai');
    expect(hit('category', '/c/design').nativePath, '/c/design');
    expect(hit('tag', '/tag/cursor-plugin').nativePath, '/tag/cursor-plugin');

    // 标签 slug 可能是中文，href 里是百分号编码；拼路由前必须解码再编码，
    // 否则会把 %E8%B7%AF… 当成路径的一部分，打开是个 404
    expect(
      hit('tag', '/tag/%E8%B7%AF%E5%BE%84%E8%AE%BE%E8%AE%A1').nativePath,
      '/tag/${Uri.encodeComponent('路径设计')}',
    );

    // 回复结果要落在那一层：`#post-3` 换成详情页的 ?post=3，否则只能从正文顶部往下数
    expect(hit('reply', '/t/91#post-3').nativePath, '/t/91?post=3');
    // 形状不对（只有话题没有楼层）时退回话题本身，不要整条丢弃
    expect(hit('reply', '/t/91').nativePath, '/t/91');

    // href 形状不对时宁可不跳原生，也不要拼出一个打不开的地址
    expect(hit('topic', '/latest').nativePath, isNull);
    expect(hit('user', '/u/').nativePath, isNull);
    expect(hit('category', '/categories').nativePath, isNull);
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
