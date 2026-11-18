import 'package:material_ui/material_ui.dart';

import '../../../core/env.dart';
import '../../../core/format.dart';

/// 右下角的评论按钮。
///
/// 原来详情页底部钉着一条「写回复…」，占了整整一行：读到一半想往下滑，
/// 手指总落在它上面；想看最后一条回复，又永远被它挡住。改成浮起来一个圆钮，
/// 点开才弹出编辑层，阅读区域整块还给了内容。
///
/// 数字角标和右边那条竖排操作条上的口径一致（都是楼层总数），
/// 所以这里不再单独去数「未读」之类的东西。
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
          // 视觉 52，外面再留 2px：拇指落点要 ≥48，圆钮边上也不至于点空
          width: 56,
          height: 56,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned(
                left: 2,
                top: 2,
                child: Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: const Color(0xF21A2130),
                    border: Border.all(color: const Color(0x4D8AB4F8)),
                    boxShadow: const [
                      BoxShadow(color: Color(0x66000000), blurRadius: 14, offset: Offset(0, 4)),
                    ],
                  ),
                  child: Icon(
                    signedIn ? Icons.mode_comment_outlined : Icons.lock_outline,
                    size: 23,
                    color: const Color(Env.blue),
                  ),
                ),
              ),
              if (count > 0)
                Positioned(
                  right: -2,
                  top: -3,
                  child: Container(
                    constraints: const BoxConstraints(minWidth: 20),
                    height: 19,
                    padding: const EdgeInsets.symmetric(horizontal: 5),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: const Color(0xFF8AB4F8),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(Env.bg), width: 1.5),
                    ),
                    child: Text(
                      compactCount(count),
                      style: const TextStyle(
                        fontSize: 10,
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
