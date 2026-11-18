import 'package:material_ui/material_ui.dart';

import '../../../core/env.dart';

/// 设置类页面的顶栏：返回 + 标题 + 可选的右侧动作。
///
/// 三个设置页长得一样，抽出来免得改一次要改三处（也免得三个页面的返回键
/// 落在不同像素上）。
class SettingsTopBar extends StatelessWidget {
  const SettingsTopBar({
    super.key,
    required this.topInset,
    required this.title,
    required this.onBack,
    this.action,
  });

  final double topInset;
  final String title;
  final VoidCallback onBack;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(4, topInset + 4, 8, 8),
      decoration: const BoxDecoration(
        color: Color(Env.bg),
        border: Border(bottom: BorderSide(color: Color(Env.line), width: 1)),
      ),
      child: Row(
        children: [
          IconButton(
            onPressed: onBack,
            icon: const Icon(Icons.arrow_back_ios_new, size: 17),
            color: const Color(Env.text),
            visualDensity: VisualDensity.compact,
          ),
          Expanded(
            child: Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 15.5,
                fontWeight: FontWeight.w600,
                color: Color(Env.text),
              ),
            ),
          ),
          ?action,
        ],
      ),
    );
  }
}
