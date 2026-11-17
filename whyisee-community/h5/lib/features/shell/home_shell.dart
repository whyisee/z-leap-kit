import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../web/web_registry.dart';

/// 底部四 tab 外壳。
///
/// tab 文案与网页 left-nav 对齐（src/lib/i18n.ts 的 nav.see / nav.go / nav.following）。
class HomeShell extends StatefulWidget {
  const HomeShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  DateTime? _lastBackPress;

  static const _destinations = <NavigationDestination>[
    NavigationDestination(
      icon: Icon(Icons.dynamic_feed_outlined),
      selectedIcon: Icon(Icons.dynamic_feed),
      label: '看见',
    ),
    NavigationDestination(
      icon: Icon(Icons.explore_outlined),
      selectedIcon: Icon(Icons.explore),
      label: '出发',
    ),
    NavigationDestination(
      icon: Icon(Icons.people_outline),
      selectedIcon: Icon(Icons.people),
      label: '关注',
    ),
    NavigationDestination(
      icon: Icon(Icons.person_outline),
      selectedIcon: Icon(Icons.person),
      label: '我',
    ),
  ];

  Future<void> _handleBack() async {
    // 一级：原生页栈能退就退（P1 有了原生详情页后这条才会生效）
    if (GoRouter.of(context).canPop()) {
      GoRouter.of(context).pop();
      return;
    }

    // 二级：当前 tab 的网页能后退就后退
    final controller = WebTabRegistry.of(widget.shell.currentIndex);
    if (controller != null && await controller.canGoBack()) {
      await controller.goBack();
      return;
    }

    // 三级：退回首页 tab
    if (widget.shell.currentIndex != 0) {
      widget.shell.goBranch(0);
      return;
    }

    // 四级：2 秒内连按两次才退出
    final now = DateTime.now();
    if (_lastBackPress != null &&
        now.difference(_lastBackPress!) < const Duration(seconds: 2)) {
      await SystemNavigator.pop();
      return;
    }
    _lastBackPress = now;
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        const SnackBar(
          content: Text('再按一次退出'),
          duration: Duration(seconds: 2),
          behavior: SnackBarBehavior.floating,
        ),
      );
  }

  void _onTap(int index) {
    widget.shell.goBranch(
      index,
      initialLocation: index == widget.shell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _handleBack();
      },
      child: Scaffold(
        backgroundColor: const Color(0xFF0D1016),
        body: SafeArea(
          bottom: false,
          child: widget.shell,
        ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: widget.shell.currentIndex,
          onDestinationSelected: _onTap,
          destinations: _destinations,
        ),
      ),
    );
  }
}
