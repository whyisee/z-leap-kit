import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:whyisee_app/core/deep_link.dart';
import 'package:whyisee_app/features/about/about_page.dart';
import 'package:whyisee_app/router/app_router.dart';

/// 深链的全部风险都压在「网页地址 ↔ 原生路由」这张对照表上：写歪一条，
/// 表现是「点了链接进了 App，但停在首页」——线上很难复现，所以在这里逐条钉住。
void main() {
  String r(String location) => resolveDeepLink(location);

  test('话题：带不带 slug 都落到同一个详情页', () {
    expect(r('https://whyisee.xyz/t/97'), '/t/97');
    // 网页的规范地址带 slug，中文 slug 在 URI 里是百分号编码的
    expect(r('https://whyisee.xyz/t/97/APP上第一篇'), '/t/97');
    expect(r('https://whyisee.xyz/t/97/%E7%AC%AC%E4%B8%80%E7%AF%87'), '/t/97');
  });

  test('话题：回复锚点换成 post 参数', () {
    // 通知和搜索结果给的地址是这个形状
    expect(r('https://whyisee.xyz/t/12#post-3'), '/t/12?post=3');
    expect(r('https://whyisee.xyz/t/12?post=5'), '/t/12?post=5');
    // 锚点不是楼层号时忽略，不要拼出一个 ?post=null
    expect(r('https://whyisee.xyz/t/12#content'), '/t/12');
  });

  test('分类 / 标签 / 用户：中文 slug 解码再编码，路径不能被拆开', () {
    expect(r('https://whyisee.xyz/c/%E8%B7%AF%E5%BE%84'), '/c/%E8%B7%AF%E5%BE%84');
    expect(r('https://whyisee.xyz/tag/AI'), '/tag/AI');
    expect(r('https://whyisee.xyz/u/zora_build'), '/u/zora_build');
  });

  test('顶层固定页', () {
    expect(r('https://whyisee.xyz/'), '/');
    // 看见 / 最新 和首页是同一个流
    expect(r('https://whyisee.xyz/see'), '/');
    expect(r('https://whyisee.xyz/latest'), '/');
    expect(r('https://whyisee.xyz/following'), '/following');
    expect(r('https://whyisee.xyz/go'), '/go');
    expect(r('https://whyisee.xyz/projects'), '/projects');
    expect(r('https://whyisee.xyz/about'), '/about');
    expect(r('https://whyisee.xyz/guidelines'), '/guidelines');
    expect(r('https://whyisee.xyz/categories'), '/categories');
    expect(r('https://whyisee.xyz/notifications'), '/me/notifications');
    expect(r('https://whyisee.xyz/new-topic'), '/compose');
    expect(r('https://whyisee.xyz/login'), '/login');
  });

  test('带参数的页把 query 带过去', () {
    expect(r('https://whyisee.xyz/search?q=sqlite'), '/search?q=sqlite');
    expect(r('https://whyisee.xyz/reset-password?token=abc'), '/reset-password?token=abc');
  });

  test('设置三项是原生页，设置首页回「我」', () {
    expect(r('https://whyisee.xyz/settings/profile'), '/settings/profile');
    expect(r('https://whyisee.xyz/settings/account'), '/settings/account');
    expect(r('https://whyisee.xyz/settings/agents'), '/settings/agents');
    expect(r('https://whyisee.xyz/settings'), '/me');
  });

  test('Agent 专区：详情能直达，其余回专区首页', () {
    expect(r('https://whyisee.xyz/agent-zone'), '/agent-zone');
    expect(r('https://whyisee.xyz/agent-zone/agents/3'), '/agent-zone/agents/3');
    expect(r('https://whyisee.xyz/agent-zone/tasks/7'), '/agent-zone/tasks/7');
    expect(r('https://whyisee.xyz/agent-zone/tasks/new'), '/agent-zone/tasks/new');
    // plaza / academy 下的详情还没有原生页，别落到「任务不存在」
    expect(r('https://whyisee.xyz/agent-zone/academy/skills/x'), '/agent-zone');
  });

  test('编辑话题走原生编辑页', () {
    expect(r('https://whyisee.xyz/topics/97/edit'), '/compose/edit/97');
  });

  test('认不得的站内页退到网页容器，别把人丢在 404', () {
    final location = r('https://whyisee.xyz/admin/reports?tab=open');
    expect(location, startsWith('/web?path='));
    expect(Uri.parse(location).queryParameters['path'], '/admin/reports?tab=open');

    // 回复编辑只有网页版
    expect(r('https://whyisee.xyz/posts/12/edit'), startsWith('/web?path='));
  });

  test('站外地址不接管', () {
    expect(r('https://example.com/t/97'), 'https://example.com/t/97');
    expect(r('https://github.com/whyisee'), 'https://github.com/whyisee');
  });

  test('原生路由原样返回，不会来回重定向', () {
    for (final native in [
      '/',
      '/t/97',
      '/t/97?post=3',
      '/me',
      '/me/notifications',
      '/web?path=%2Fadmin',
      '/agent-zone',
      '/agent-zone/tasks/7',
      '/compose',
    ]) {
      expect(resolveDeepLink(native), native, reason: native);
    }
  });

  test('自定义 scheme 兜底（App Links 没校验通过时走这条）', () {
    expect(r('whyisee://open/t/97'), '/t/97');
    expect(r('whyisee://open/agent-zone/tasks/7'), '/agent-zone/tasks/7');
    // 认不得的路径回首页，别起一个空白的路由
    expect(r('whyisee://open/whatever'), '/');
  });

  test('空串与异常输入不至于崩', () {
    expect(r(''), '/');
    expect(r('   '), '/');
  });

  testWidgets('路由器确实接上了这套规则，不是只写了个没人调的函数', (tester) async {
    // 故意挑一个「网页有、原生没有同名路径」的地址：`/app` 是下载引导页，
    // 只有 redirect 真的生效才会落到「关于」。要是 redirect 没接上，
    // 这里会是一个错误页 —— 这正是热启动点链接时会看到的症状。
    final router = buildRouter(initialLocation: 'https://whyisee.xyz/app');

    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();

    expect(find.byType(AboutPage), findsOneWidget);
    expect(router.routerDelegate.currentConfiguration.uri.toString(), '/about');
  });
}
