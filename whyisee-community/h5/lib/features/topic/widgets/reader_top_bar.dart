import 'dart:ui' as ui;

import 'package:material_ui/material_ui.dart';

import '../../../core/env.dart';

/// 阅读态顶栏，行为对齐网页 `[data-reading-mode]` 的 `.site-header`：
///
/// 1. 未滚动：普通深色条，显示「帖子」+ 返回 + 打开浏览器；
/// 2. 滚动后：毛玻璃（`backdrop-filter: blur(24px) saturate(0.9)`），底部出现
///    `rgba(138,180,248,0.12)` 的高亮边，「帖子」和浏览器入口淡到 0（返回常驻）；
/// 3. 文章大标题滚出视口后，灰色标题浮出（网页 `.reading-header-title`，
///    15px / w900 / rgba(240,243,247,.38) / 0.86 透明度）。
class ReaderTopBar extends StatelessWidget {
  const ReaderTopBar({
    super.key,
    required this.offset,
    required this.title,
    required this.topInset,
    required this.onBack,
    required this.onOpenBrowser,
  });

  /// 列表当前的滚动偏移，直接来自滚动监听。
  final double offset;
  final String title;
  final double topInset;
  final VoidCallback onBack;
  final VoidCallback onOpenBrowser;

  /// 毛玻璃在滚过 16px 后开始建立，和网页 `getScrollTop() > 16` 一致。
  static const _blurStart = 16.0;

  /// 大标题滚出顶栏后才显示占位标题。网页判的是 hero 底边越过 header 底边，
  /// 这里用偏移量近似（分类行 + 两行标题 + 作者行）。
  static const _titleRevealAt = 118.0;

  @override
  Widget build(BuildContext context) {
    final barHeight = topInset + kToolbarHeight;
    final blurT = ((offset - _blurStart) / 64).clamp(0.0, 1.0);
    // 常规控件比毛玻璃更快退场：blurT 到 1（scroll 80px）时已经全透明，
    // 而标题要到 118px 才开始出现，两者不会同时可见。
    final chromeT = (1 - blurT).clamp(0.0, 1.0);
    final titleT = ((offset - _titleRevealAt) / 40).clamp(0.0, 1.0);

    final content = Container(
      height: barHeight,
      padding: EdgeInsets.only(top: topInset),
      decoration: BoxDecoration(
        // 网页用两条渐变叠加，这里取其中值再随模糊进度插值
        color: Color.lerp(
          const Color(0xF20F1118),
          const Color(0xEB0C0F16),
          blurT,
        ),
        border: Border(
          bottom: BorderSide(
            color: Color.lerp(
              const Color(0x00000000),
              const Color(0x1F8AB4F8),
              blurT,
            )!,
          ),
        ),
        boxShadow: blurT <= 0
            ? null
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.24 * blurT),
                  blurRadius: 44 * blurT,
                  offset: Offset(0, 18 * blurT),
                ),
              ],
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          // 常规控件：滚动后「帖子」和浏览器按钮淡到完全透明，只留返回。
          // 网页版是整体淡到 0.18，但手机宽度窄，半透明的「帖子」会和居中的
          // 文章标题叠在一起，所以这里把左侧文字直接置 0。
          Row(
            children: [
              IconButton(
                onPressed: onBack,
                iconSize: 21,
                color: const Color(Env.text),
                icon: const Icon(Icons.arrow_back),
                tooltip: '返回',
              ),
              Opacity(
                opacity: chromeT,
                child: const Text(
                  '帖子',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Color(Env.text),
                  ),
                ),
              ),
              const Spacer(),
              Opacity(
                opacity: chromeT,
                child: IconButton(
                  onPressed: onOpenBrowser,
                  iconSize: 19,
                  color: const Color(Env.muted),
                  icon: const Icon(Icons.open_in_new),
                  tooltip: '在浏览器打开',
                ),
              ),
            ],
          ),
          // 文章标题占位：等常规控件彻底消失后才出现，单行省略。
          // 左右各留 56px 给返回按钮，避免和图标抢位置。
          IgnorePointer(
            child: Opacity(
              opacity: 0.86 * titleT,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 56),
                child: Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                    color: const Color(Env.text).withValues(alpha: 0.38),
                    letterSpacing: 0.2,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );

    return ClipRect(
      child: blurT <= 0
          ? content
          : BackdropFilter(
              // CSS blur(24px) 的高斯半径换算成 sigma 约 18
              filter: ui.ImageFilter.blur(sigmaX: 18 * blurT, sigmaY: 18 * blurT),
              child: content,
            ),
    );
  }
}
