import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../core/api/models.dart';
import '../features/about/about_page.dart';
import '../features/about/guidelines_page.dart';
import '../features/agent_zone/agent_detail_page.dart';
import '../features/agent_zone/agent_task_compose_page.dart';
import '../features/agent_zone/agent_task_detail_page.dart';
import '../features/agent_zone/agent_zone_page.dart';
import '../features/auth/forgot_password_page.dart';
import '../features/auth/login_page.dart';
import '../features/auth/signup_page.dart';
import '../features/compose/compose_page.dart';
import '../features/feed/feed_page.dart';
import '../features/following/following_page.dart';
import '../features/go/go_page.dart';
import '../features/me/me_page.dart';
import '../features/me/my_topics_page.dart';
import '../features/notifications/notification_page.dart';
import '../features/projects/projects_page.dart';
import '../features/report/report_page.dart';
import '../features/review/review_page.dart';
import '../features/search/search_page.dart';
import '../features/settings/settings_account_page.dart';
import '../features/settings/settings_agents_page.dart';
import '../features/settings/settings_profile_page.dart';
import '../features/shell/home_shell.dart';
import '../features/taxonomy/taxonomy_detail_page.dart';
import '../features/taxonomy/taxonomy_list_page.dart';
import '../features/topic/topic_detail_page.dart';
import '../features/topic/topic_entry.dart';
import '../features/user/user_page.dart';
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
                // 我的文章：已发布 + 待审核 + 草稿。待审的稿子在别处一律看不到，
                // 审核退回的通知也指到这里（服务端给 kind=mine）。
                GoRoute(
                  path: 'topics',
                  builder: (context, state) => const MyTopicsPage(),
                ),
                // 通知是原生页：站内提醒（回复 / @ / 赞 / 系统）全部能在这里处理完
                GoRoute(
                  path: 'notifications',
                  builder: (context, state) => const NotificationPage(),
                  routes: [
                    // 通知里的帖子进原生阅读器，挂在通知栈下，返回回到通知列表
                    GoRoute(
                      path: 't/:id',
                      pageBuilder: (context, state) => _topicPage(state),
                    ),
                    // 审核队列：管理员点「新的待审核话题」直接进内容 + 通过/退回
                    GoRoute(
                      path: 'review/:id',
                      builder: (context, state) => ReviewTopicPage(
                        topicId: int.tryParse(state.pathParameters['id'] ?? '') ?? 0,
                      ),
                    ),
                  ],
                ),
                // 设置、公开主页这些低频页继续用网页版，push 一个带返回条的容器
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
    // 登录是全局动作：从任何 tab（含发帖页）都能推开，登录完 pop 回来路
    GoRoute(
      path: '/login',
      pageBuilder: (context, state) => CustomTransitionPage<void>(
        key: state.pageKey,
        child: LoginPage(reason: state.uri.queryParameters['reason']),
        fullscreenDialog: true,
        transitionDuration: const Duration(milliseconds: 240),
        reverseTransitionDuration: const Duration(milliseconds: 200),
        transitionsBuilder: (_, animation, _, child) => SlideTransition(
          position: Tween(begin: const Offset(0, 1), end: Offset.zero).animate(
            CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
          ),
          child: child,
        ),
      ),
    ),
    // 注册 / 找回密码：和登录同一套滑入动画，做成一叠表单卡片的观感
    GoRoute(
      path: '/signup',
      pageBuilder: (context, state) => _sheetPage(state, const SignupPage()),
    ),
    GoRoute(
      path: '/forgot-password',
      pageBuilder: (context, state) => _sheetPage(state, const ForgotPasswordPage()),
    ),
    // 邮件里的链接指向网页；这条留给「从网页把 token 带进来」的场景
    GoRoute(
      path: '/reset-password',
      pageBuilder: (context, state) => _sheetPage(
        state,
        ForgotPasswordPage(token: state.uri.queryParameters['token']),
      ),
    ),
    // 搜索：全屏，键盘弹起时底部栏本来也留不住，直接挂 shell 外面
    GoRoute(
      path: '/search',
      pageBuilder: (context, state) => CustomTransitionPage<void>(
        key: state.pageKey,
        child: SearchPage(initialQuery: state.uri.queryParameters['q']),
        transitionDuration: const Duration(milliseconds: 200),
        reverseTransitionDuration: const Duration(milliseconds: 160),
        transitionsBuilder: (_, animation, _, child) => FadeTransition(
          opacity: animation,
          child: child,
        ),
      ),
    ),
    // 分类 / 标签：搜索里点分类标签、看见页的分类条都往这儿走
    GoRoute(
      path: '/categories',
      builder: (context, state) => const TaxonomyListPage(),
    ),
    GoRoute(
      path: '/c/:slug',
      builder: (context, state) => TaxonomyDetailPage(
        kind: 'category',
        slug: state.pathParameters['slug'] ?? '',
      ),
    ),
    GoRoute(
      path: '/tag/:slug',
      builder: (context, state) => TaxonomyDetailPage(
        kind: 'tag',
        slug: state.pathParameters['slug'] ?? '',
      ),
    ),
    // 用户主页：从列表、详情、搜索结果都能推，所以放在全局
    GoRoute(
      path: '/u/:username',
      builder: (context, state) => UserPage(username: state.pathParameters['username'] ?? ''),
    ),
    // 设置三项：原来都是 WebView，现在原生
    GoRoute(
      path: '/settings/profile',
      builder: (context, state) => const SettingsProfilePage(),
    ),
    GoRoute(
      path: '/settings/account',
      builder: (context, state) => const SettingsAccountPage(),
    ),
    GoRoute(
      path: '/settings/agents',
      builder: (context, state) => const SettingsAgentsPage(),
    ),
    // 内容扩展页：项目展示、Agent 专区、关于与指南
    GoRoute(
      path: '/projects',
      builder: (context, state) => const ProjectsPage(),
    ),
    GoRoute(
      path: '/agent-zone',
      builder: (context, state) => const AgentZonePage(),
    ),
    // Agent 专区详情。「tasks/new」必须排在「tasks/:id」前面，
    // 否则 new 会被当成一个任务 id 去查。
    GoRoute(
      path: '/agent-zone/agents/:id',
      builder: (context, state) => AgentDetailPage(
        agentId: int.tryParse(state.pathParameters['id'] ?? '') ?? 0,
        preview: state.extra is AgentCard ? state.extra as AgentCard : null,
      ),
    ),
    GoRoute(
      path: '/agent-zone/tasks/new',
      builder: (context, state) => const AgentTaskComposePage(),
    ),
    GoRoute(
      path: '/agent-zone/tasks/:id',
      builder: (context, state) => AgentTaskDetailPage(
        taskId: int.tryParse(state.pathParameters['id'] ?? '') ?? 0,
        preview: state.extra is AgentTaskCard ? state.extra as AgentTaskCard : null,
      ),
    ),
    GoRoute(
      path: '/about',
      builder: (context, state) => const AboutPage(),
    ),
    GoRoute(
      path: '/guidelines',
      builder: (context, state) => const GuidelinesPage(),
    ),
    // 举报：从详情页的 ⋮ 进来，带上被举报的对象
    GoRoute(
      path: '/report',
      pageBuilder: (context, state) => _sheetPage(
        state,
        ReportPage(
          targetType: state.uri.queryParameters['type'] ?? 'topic',
          targetId: int.tryParse(state.uri.queryParameters['id'] ?? '') ?? 0,
          targetLabel: state.uri.queryParameters['label'] ?? '',
        ),
      ),
    ),
    // 发帖是全局动作，挂在 shell 外面：全屏盖住底部栏，返回回到原 tab
    GoRoute(
      path: '/compose',
      pageBuilder: (context, state) => CustomTransitionPage<void>(
        key: state.pageKey,
        child: ComposePage(initialType: state.uri.queryParameters['type']),
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
    // 编辑已有话题：和发布同一页，只是带 id 进来预填
    GoRoute(
      path: '/compose/edit/:id',
      pageBuilder: (context, state) => CustomTransitionPage<void>(
        key: state.pageKey,
        child: ComposePage(
          editTopicId: int.tryParse(state.pathParameters['id'] ?? ''),
        ),
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
///
/// 从通知进来时额外带 `entry`（来由）和 `?post=`（被回复的楼层）：
/// 前者说明为什么打开，后者让页面直接滚到那一层，而不是让人自己数到第 12 楼。
CustomTransitionPage<void> _topicPage(GoRouterState state) {
  final id = int.tryParse(state.pathParameters['id'] ?? '') ?? 0;
  final extra = state.extra;

  return CustomTransitionPage<void>(
    key: state.pageKey,
    child: TopicDetailPage(
      topicId: id,
      entry: extra is TopicEntry ? extra : null,
      // post 走 query 而不是 extra：进程被回收重建后 extra 会丢，
      // 但「跳到那一层」这件事仍然应该成立
      postId: int.tryParse(state.uri.queryParameters['post'] ?? ''),
    ),
    transitionDuration: const Duration(milliseconds: 220),
    reverseTransitionDuration: const Duration(milliseconds: 180),
    transitionsBuilder: (_, animation, _, child) => FadeTransition(
      opacity: CurvedAnimation(parent: animation, curve: Curves.easeOut),
      child: child,
    ),
  );
}

/// 表单类页面统一从下往上滑，和登录页一致 —— 这类页面是「临时去做一件事」，
/// 不是同一层级的浏览，所以不用淡入。
CustomTransitionPage<void> _sheetPage(GoRouterState state, Widget child) {
  return CustomTransitionPage<void>(
    key: state.pageKey,
    child: child,
    fullscreenDialog: true,
    transitionDuration: const Duration(milliseconds: 240),
    reverseTransitionDuration: const Duration(milliseconds: 200),
    transitionsBuilder: (_, animation, _, child) => SlideTransition(
      position: Tween(begin: const Offset(0, 1), end: Offset.zero).animate(
        CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
      ),
      child: child,
    ),
  );
}
