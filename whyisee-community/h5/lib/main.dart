import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import 'app.dart';
import 'core/deep_link.dart';
import 'router/app_router.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // 站点固定深色，状态栏必须用亮色图标，否则在 #0d1016 底上看不见
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      statusBarBrightness: Brightness.dark, // iOS 用这个字段
      systemNavigationBarColor: Color(0xFF0F1118),
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );

  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);

  // 冷启动深链：Android 会把 intent 里的地址（https://whyisee.xyz/t/97）
  // 当成初始路由交给引擎。这里是唯一一次「外面点进来」的机会，换算成原生路由再起。
  // 不是深链时 defaultRouteName 就是 '/'，等价于从首页开始。
  final coldStartRoute = WidgetsBinding.instance.platformDispatcher.defaultRouteName;
  final initialLocation = resolveDeepLink(coldStartRoute);
  // 深链出问题（点链接只到首页）时，先看这一行：入口地址到底有没有进来
  if (initialLocation != '/') {
    debugPrint('[deep] $coldStartRoute -> $initialLocation');
  }

  // 少了这层，所有 provider 一被读就抛 "No ProviderScope found"，
  // 表现为首帧红屏、网络请求一个都不发。
  runApp(
    ProviderScope(
      child: WhyiseeApp(router: buildRouter(initialLocation: initialLocation)),
    ),
  );
}
