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

  static const _destinations = <_Destination>[
    _Destination(icon: Icons.dynamic_feed_outlined, activeIcon: Icons.dynamic_feed, label: '看见'),
    _Destination(icon: Icons.explore_outlined, activeIcon: Icons.explore, label: '出发'),
    _Destination(icon: Icons.people_outline, activeIcon: Icons.people, label: '关注'),
    _Destination(icon: Icons.person_outline, activeIcon: Icons.person, label: '我'),
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
    HapticFeedback.selectionClick();
    // 点当前 tab = 回到该分支的根页面（和 iOS 标签栏一致）
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
        bottomNavigationBar: _BottomBar(
          currentIndex: widget.shell.currentIndex,
          onTap: _onTap,
        ),
      ),
    );
  }
}

class _Destination {
  const _Destination({required this.icon, required this.activeIcon, required this.label});

  final IconData icon;
  final IconData activeIcon;
  final String label;
}

/// 底部导航：不用 M3 的 NavigationBar（深色底上会带一层浅色 surface 和胶囊指示器，
/// 和站点风格不搭），这里做纯图标 + 小字、顶部一条 hairline 的扁平样式。
class _BottomBar extends StatelessWidget {
  const _BottomBar({required this.currentIndex, required this.onTap});

  final int currentIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF0A0D13),
        border: Border(top: BorderSide(color: Color(0x14FFFFFF), width: 1)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 54,
          child: Row(
            children: [
              for (var index = 0; index < _HomeShellState._destinations.length; index++)
                Expanded(
                  child: _BottomItem(
                    destination: _HomeShellState._destinations[index],
                    selected: index == currentIndex,
                    onTap: () => onTap(index),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BottomItem extends StatelessWidget {
  const _BottomItem({
    required this.destination,
    required this.selected,
    required this.onTap,
  });

  final _Destination destination;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tint = selected ? const Color(0xFF8AB4F8) : const Color(0xFF7C8694);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            selected ? destination.activeIcon : destination.icon,
            size: 21,
            color: tint,
          ),
          const SizedBox(height: 3),
          Text(
            destination.label,
            style: TextStyle(
              fontSize: 10.5,
              height: 1.1,
              fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
              color: tint,
            ),
          ),
        ],
      ),
    );
  }
}
