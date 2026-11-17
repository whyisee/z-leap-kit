import 'package:material_ui/material_ui.dart';

import 'env.dart';

/// 站点只有深色一套（foundation.css 里 color-scheme: dark，无 prefers-color-scheme），
/// app 不做深浅切换，避免与 WebView 页出现色差。
ThemeData buildAppTheme() {
  const scheme = ColorScheme.dark(
    primary: Color(Env.blue),
    onPrimary: Color(Env.bg),
    surface: Color(Env.surface),
    onSurface: Color(Env.text),
    error: Color(0xFFFF7A98),
  );

  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: scheme,
    scaffoldBackgroundColor: const Color(Env.bg),
  );

  return base.copyWith(
    navigationBarTheme: NavigationBarThemeData(
      height: 58,
      backgroundColor: const Color(Env.headerBg),
      indicatorColor: const Color(0x1F8AB4F8),
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: selected ? const Color(Env.blue) : const Color(Env.muted),
        );
      }),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return IconThemeData(
          size: 22,
          color: selected ? const Color(Env.blue) : const Color(Env.muted),
        );
      }),
    ),
    textTheme: base.textTheme.apply(
      bodyColor: const Color(Env.text),
      displayColor: const Color(Env.text),
    ),
  );
}
