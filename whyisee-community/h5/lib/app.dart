import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import 'core/app_theme.dart';
import 'core/env.dart';
import 'router/app_router.dart';

class WhyiseeApp extends StatelessWidget {
  const WhyiseeApp({super.key, this.router});

  /// 冷启动带了深链时，`main()` 会造一个初始路由不同的路由器传进来。
  /// 为空就用默认实例（从首页开始）。
  final GoRouter? router;

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'whyisee',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      routerConfig: router ?? appRouter,
      // WebView 首次加载前先铺站点底色，避免深色页面前闪一帧白
      builder: (context, child) => ColoredBox(
        color: const Color(Env.bg),
        child: child ?? const SizedBox.shrink(),
      ),
    );
  }
}
