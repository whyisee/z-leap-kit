import 'package:go_router/go_router.dart';

import '../features/shell/home_shell.dart';
import '../features/web/web_page.dart';

/// 四个 tab 各自一条独立导航栈，indexedStack 保证切换不重建、WebView 不重载。
///
/// 路径与网页路由的对应关系见设计文档 §4.3。P1 起「看见」和「帖子详情」换原生页，
/// 这里只改 builder，不动外壳。
final GoRouter appRouter = GoRouter(
  initialLocation: '/',
  routes: [
    StatefulShellRoute.indexedStack(
      builder: (context, state, shell) => HomeShell(shell: shell),
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/',
              builder: (context, state) => const WebTabPage(tabIndex: 0, path: '/'),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/go',
              builder: (context, state) => const WebTabPage(tabIndex: 1, path: '/go'),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/following',
              builder: (context, state) =>
                  const WebTabPage(tabIndex: 2, path: '/following'),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/me',
              builder: (context, state) =>
                  const WebTabPage(tabIndex: 3, path: '/settings'),
            ),
          ],
        ),
      ],
    ),
  ],
);
