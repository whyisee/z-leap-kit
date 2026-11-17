import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import 'app.dart';

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

  // 少了这层，所有 provider 一被读就抛 "No ProviderScope found"，
  // 表现为首帧红屏、网络请求一个都不发。
  runApp(const ProviderScope(child: WhyiseeApp()));
}
