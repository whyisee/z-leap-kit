import 'package:material_ui/material_ui.dart';

import 'core/app_theme.dart';
import 'core/env.dart';
import 'router/app_router.dart';

class WhyiseeApp extends StatelessWidget {
  const WhyiseeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'whyisee',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      routerConfig: appRouter,
      // WebView 首次加载前先铺站点底色，避免深色页面前闪一帧白
      builder: (context, child) => ColoredBox(
        color: const Color(Env.bg),
        child: child ?? const SizedBox.shrink(),
      ),
    );
  }
}
