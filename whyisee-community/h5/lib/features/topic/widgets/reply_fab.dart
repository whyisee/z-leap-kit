import 'package:material_ui/material_ui.dart';

import '../../../core/env.dart';
import '../../../core/format.dart';

/// 右下角的评论按钮。
///
/// 原来详情页底部钉着一条「写回复…」，占了整整一行：读到一半想往下滑，
/// 手指总落在它上面。改成浮起来的小圆钮（视觉 40、触达 48），点开才弹输入层，
/// 阅读区域整块还给了内容。
///
/// 尺寸刻意做小：它是「跳到说话」的入口，不是主按钮。第一版做成 52 的实心圆，
/// 压在正文上比正文还重。
class ReplyFab extends StatelessWidget {
  const ReplyFab({super.key, required this.count, required this.onTap, this.signedIn = true});

  final int count;
  final VoidCallback onTap;

  /// 未登录时图标换成锁：点下去是去登录，不是直接写
  final bool signedIn;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: signedIn ? '写回复' : '登录后回复',
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: SizedBox(
          // 视觉 40，外面留 4px 撑到 48 的落点，边上不至于点空
          width: 48,
          height: 48,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned(
                left: 4,
                top: 4,
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: const Color(0xE61A2130),
                    border: Border.all(color: const Color(0x3D8AB4F8)),
                    boxShadow: const [
                      BoxShadow(color: Color(0x59000000), blurRadius: 10, offset: Offset(0, 3)),
                    ],
                  ),
                  child: Icon(
                    signedIn ? Icons.chat_bubble_outline : Icons.lock_outline,
                    size: 18,
                    color: const Color(Env.blue),
                  ),
                ),
              ),
              if (count > 0)
                Positioned(
                  right: -1,
                  top: 0,
                  child: Container(
                    constraints: const BoxConstraints(minWidth: 16),
                    height: 16,
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: const Color(0xFF8AB4F8),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(Env.bg), width: 1.2),
                    ),
                    child: Text(
                      compactCount(count),
                      style: const TextStyle(
                        fontSize: 9,
                        height: 1,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF0D1016),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
