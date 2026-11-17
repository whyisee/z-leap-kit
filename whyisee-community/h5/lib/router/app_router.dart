import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../features/feed/feed_page.dart';
import '../features/shell/home_shell.dart';
import '../features/topic/topic_detail_page.dart';
import '../features/web/web_page.dart';

/// 四个 tab 各自一条独立导航栈，indexedStack 保证切换不重建、WebView 不重载。
///
/// P1 起「看见」和「帖子详情」是原生页；「出发」「关注」「我」仍是 WebView。
/// 详情挂在第一个 branch 下，这样从 feed 进详情再返回，tab 状态不丢。
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
              builder: (context, state) => const FeedPage(),
              routes: [
                GoRoute(
                  path: 't/:id',
                  // 滑到底切下一篇时用淡入过渡，对应网页的 reading-arriving 动画
                  pageBuilder: (context, state) {
                    final raw = state.pathParameters['id'] ?? '';
                    final id = int.tryParse(raw) ?? 0;
                    return CustomTransitionPage<void>(
                      key: state.pageKey,
                      child: TopicDetailPage(topicId: id),
                      transitionDuration: const Duration(milliseconds: 220),
                      reverseTransitionDuration: const Duration(milliseconds: 180),
                      transitionsBuilder: (_, animation, _, child) => FadeTransition(
                        opacity: CurvedAnimation(parent: animation, curve: Curves.easeOut),
                        child: child,
                      ),
                    );
                  },
                ),
              ],
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
