import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../features/compose/compose_page.dart';
import '../features/feed/feed_page.dart';
import '../features/following/following_page.dart';
import '../features/go/go_page.dart';
import '../features/me/me_page.dart';
import '../features/shell/home_shell.dart';
import '../features/topic/topic_detail_page.dart';
import '../features/web/web_route_page.dart';

/// 四个 tab 各自一条独立导航栈，indexedStack 保证切换不重建、WebView 不重载。
///
/// 四个 tab 全是原生页（看见 / 出发 / 关注 / 我）；WebView 只剩设置、登录这类低频页。
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
                  pageBuilder: (context, state) => _topicPage(state),
                ),
              ],
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/go',
              builder: (context, state) => const GoPage(),
              routes: [
                // 参与项里的帖子进原生阅读器，挂在「出发」这条栈下，返回回到本页
                GoRoute(
                  path: 't/:id',
                  pageBuilder: (context, state) => _topicPage(state),
                ),
                // 社区任务这类没有原生实现的，仍用网页版容器
                GoRoute(
                  path: 'page',
                  builder: (context, state) {
                    final query = state.uri.queryParameters;
                    return WebRoutePage(
                      path: query['path'] ?? '/go',
                      title: query['title'] ?? '出发',
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
              path: '/following',
              builder: (context, state) => const FollowingPage(),
              routes: [
                // 订阅流里的帖子用原生阅读器，挂在「关注」这条栈下，返回回到本页
                GoRoute(
                  path: 't/:id',
                  pageBuilder: (context, state) => _topicPage(state),
                ),
              ],
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/me',
              builder: (context, state) => const MePage(),
              routes: [
                // 我的话题 → 原生详情。挂在「我」这条栈下，返回才回到本页而不是首页。
                GoRoute(
                  path: 't/:id',
                  pageBuilder: (context, state) => _topicPage(state),
                ),
                // 设置、通知、公开主页这些低频页继续用网页版，push 一个带返回条的容器
                GoRoute(
                  path: 'page',
                  builder: (context, state) {
                    final query = state.uri.queryParameters;
                    return WebRoutePage(
                      path: query['path'] ?? '/settings/profile',
                      title: query['title'] ?? '设置',
                    );
                  },
                ),
              ],
            ),
          ],
        ),
      ],
    ),
    // 发帖是全局动作，挂在 shell 外面：全屏盖住底部栏，返回回到原 tab
    GoRoute(
      path: '/compose',
      pageBuilder: (context, state) => CustomTransitionPage<void>(
        key: state.pageKey,
        child: const ComposePage(),
        fullscreenDialog: true,
        transitionDuration: const Duration(milliseconds: 260),
        reverseTransitionDuration: const Duration(milliseconds: 200),
        transitionsBuilder: (_, animation, _, child) => SlideTransition(
          position: Tween(begin: const Offset(0, 1), end: Offset.zero).animate(
            CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
          ),
          child: child,
        ),
      ),
    ),
    // 任意网页页的通用容器：从 shell 外（发帖页）也能打开登录这类页面
    GoRoute(
      path: '/web',
      builder: (context, state) {
        final query = state.uri.queryParameters;
        return WebRoutePage(
          path: query['path'] ?? '/',
          title: query['title'] ?? '',
        );
      },
    ),
  ],
);

/// 详情页统一用淡入过渡：feed 和「我」两条栈共用，避免两处参数慢慢写歪。
CustomTransitionPage<void> _topicPage(GoRouterState state) {
  final id = int.tryParse(state.pathParameters['id'] ?? '') ?? 0;

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
}
