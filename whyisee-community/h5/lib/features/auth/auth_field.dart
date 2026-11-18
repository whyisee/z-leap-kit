import 'package:material_ui/material_ui.dart';

import '../../core/env.dart';

/// 登录 / 注册 / 找回密码共用的输入框。
///
/// 三张表单长得一样：小标签 + 一个内嵌描边的圆角框。抽出来是为了让
/// 「密码框有没有那只眼睛」「回车跳到下一个框」这类细节只写一遍。
class AuthField extends StatelessWidget {
  const AuthField({
    super.key,
    required this.label,
    required this.controller,
    required this.hint,
    this.focusNode,
    this.obscure = false,
    this.autofillHints,
    this.textInputAction,
    this.keyboardType,
    this.onSubmitted,
    this.onChanged,
    this.trailing,
    this.helper,
  });

  final String label;
  final TextEditingController controller;
  final String hint;
  final FocusNode? focusNode;
  final bool obscure;
  final List<String>? autofillHints;
  final TextInputAction? textInputAction;
  final TextInputType? keyboardType;
  final ValueChanged<String>? onSubmitted;
  final VoidCallback? onChanged;
  final Widget? trailing;

  /// 框下面那行灰字（格式要求之类）。有错误时由调用方换成红字，这里不管。
  final String? helper;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 11.5, letterSpacing: 0.3, color: Color(0xFF7C8798)),
        ),
        const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            color: const Color(Env.surface),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(Env.line)),
          ),
          padding: EdgeInsets.only(left: 12, right: trailing == null ? 12 : 2),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  focusNode: focusNode,
                  obscureText: obscure,
                  autofillHints: autofillHints,
                  textInputAction: textInputAction,
                  keyboardType: keyboardType,
                  onSubmitted: onSubmitted,
                  onChanged: (_) => onChanged?.call(),
                  style: const TextStyle(fontSize: 15, color: Color(Env.text)),
                  cursorColor: const Color(Env.blue),
                  decoration: InputDecoration(
                    isDense: true,
                    border: InputBorder.none,
                    hintText: hint,
                    hintStyle: const TextStyle(fontSize: 15, color: Color(0xFF4A5462)),
                    contentPadding: const EdgeInsets.symmetric(vertical: 13),
                  ),
                ),
              ),
              ?trailing,
            ],
          ),
        ),
        if (helper != null) ...[
          const SizedBox(height: 5),
          Text(
            helper!,
            style: const TextStyle(fontSize: 11, height: 1.4, color: Color(0xFF5F6875)),
          ),
        ],
      ],
    );
  }
}

/// 表单里的主按钮：提交中转圈、不可点时灰掉。
class AuthSubmitButton extends StatelessWidget {
  const AuthSubmitButton({
    super.key,
    required this.label,
    required this.onPressed,
    required this.busy,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      onPressed: busy ? null : onPressed,
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(46),
        backgroundColor: const Color(0xFF8AB4F8),
        foregroundColor: const Color(0xFF0D1016),
        disabledBackgroundColor: const Color(0x1FFFFFFF),
        disabledForegroundColor: const Color(0xFF5F6875),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(11)),
      ),
      child: busy
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation(Color(0xFF0D1016)),
              ),
            )
          : Text(
              label,
              style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700),
            ),
    );
  }
}

/// 表单里的一行错误提示。
class AuthErrorLine extends StatelessWidget {
  const AuthErrorLine({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(top: 1),
          child: Icon(Icons.error_outline, size: 15, color: Color(0xFFFF6B7A)),
        ),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            message,
            style: const TextStyle(fontSize: 12.5, height: 1.45, color: Color(0xFFFF9AA6)),
          ),
        ),
      ],
    );
  }
}

/// 表单页的标题 + 说明。
class AuthHeading extends StatelessWidget {
  const AuthHeading({super.key, required this.title, required this.description});

  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.6,
            color: Color(Env.text),
          ),
        ),
        const SizedBox(height: 6),
        Text(
          description,
          style: const TextStyle(fontSize: 12.5, height: 1.5, color: Color(Env.muted)),
        ),
      ],
    );
  }
}
