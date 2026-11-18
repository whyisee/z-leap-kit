import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/api_exception.dart';
import '../../core/env.dart';
import '../../core/providers.dart';

/// 原生登录页。
///
/// 为什么不再用网页版登录：WebView 里输完密码、网页 303 跳回去，整个过程
/// 用户看着地址栏和一堆站点头尾，登录态还得靠 JS 桥回传。原生登录只有一个
/// 表单，登录成功后直接 `pop` 回上一页，来路不变。
///
/// 注册和找回密码仍然走网页 —— 那两个流程有验证码、邮件、重发倒计时，
/// 原生化收益低；这里只在底部留入口。
class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key, this.reason});

  /// 为什么会看到这一页（例如「回复需要先登录」），没有就不显示
  final String? reason;

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _identifier = TextEditingController();
  final _password = TextEditingController();
  final _passwordFocus = FocusNode();

  bool _busy = false;
  bool _obscure = true;
  String? _error;

  @override
  void dispose() {
    _identifier.dispose();
    _password.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  bool get _canSubmit =>
      _identifier.text.trim().isNotEmpty && _password.text.isNotEmpty && !_busy;

  Future<void> _submit() async {
    if (!_canSubmit) return;

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      await ref.read(sessionProvider.notifier).signIn(
            _identifier.text.trim(),
            _password.text,
          );
      if (!mounted) return;
      // 不清缓存也不用 invalidate：「我」页的 overview 直接 watch 了 session，
      // 登录态一变它就自己重建了
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = switch (e.code) {
          // 服务端对「账号不存在」和「密码错」返回同一个码，不区分——
          // 这里也别替它泄露哪个字段错了
          'invalid_credentials' || 'unauthorized' => '账号或密码不对，再试一次',
          'rate_limited' => '试得太频繁了，过一会儿再来',
          _ => e.isNetwork ? '网络不通，检查一下再试' : e.message,
        };
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = '登录失败，稍后重试';
      });
    }
  }

  void _openWeb(String path, String title) {
    context.push(
      '/web?path=${Uri.encodeComponent(path)}&title=${Uri.encodeComponent(title)}',
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(Env.bg),
      appBar: AppBar(
        backgroundColor: const Color(Env.headerBg),
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          '登录',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(Env.text)),
        ),
        iconTheme: const IconThemeData(color: Color(Env.muted)),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, thickness: 1, color: Color(Env.line)),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 26, 20, 28),
          children: [
            const Text(
              '欢迎回来',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.6,
                color: Color(Env.text),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              widget.reason ?? '登录后可以发帖、回复和关注作者。',
              style: const TextStyle(fontSize: 12.5, height: 1.5, color: Color(Env.muted)),
            ),
            const SizedBox(height: 24),
            _Field(
              label: '用户名或邮箱',
              controller: _identifier,
              hint: 'whyisee',
              autofillHints: const [AutofillHints.username],
              textInputAction: TextInputAction.next,
              onSubmitted: (_) => _passwordFocus.requestFocus(),
              onChanged: () => setState(() {}),
            ),
            const SizedBox(height: 14),
            _Field(
              label: '密码',
              controller: _password,
              focusNode: _passwordFocus,
              hint: '••••••••',
              obscure: _obscure,
              autofillHints: const [AutofillHints.password],
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _submit(),
              onChanged: () => setState(() {}),
              trailing: IconButton(
                onPressed: () => setState(() => _obscure = !_obscure),
                iconSize: 18,
                color: const Color(Env.muted),
                icon: Icon(_obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                tooltip: _obscure ? '显示密码' : '隐藏密码',
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 14),
              Row(
                children: [
                  const Icon(Icons.error_outline, size: 15, color: Color(0xFFFF6B7A)),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      _error!,
                      style: const TextStyle(fontSize: 12.5, height: 1.4, color: Color(0xFFFF9AA6)),
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 22),
            FilledButton(
              onPressed: _canSubmit ? _submit : null,
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(46),
                backgroundColor: const Color(0xFF8AB4F8),
                foregroundColor: const Color(0xFF0D1016),
                disabledBackgroundColor: const Color(0x1FFFFFFF),
                disabledForegroundColor: const Color(0xFF5F6875),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(11)),
              ),
              child: _busy
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation(Color(0xFF0D1016)),
                      ),
                    )
                  : const Text(
                      '登录',
                      style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700),
                    ),
            ),
            const SizedBox(height: 18),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _LinkButton(label: '注册账号', onTap: () => _openWeb('/signup', '注册')),
                Container(width: 1, height: 12, color: const Color(Env.line)),
                _LinkButton(
                  label: '忘记密码',
                  onTap: () => _openWeb('/forgot-password', '找回密码'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.label,
    required this.controller,
    required this.hint,
    this.focusNode,
    this.obscure = false,
    this.autofillHints,
    this.textInputAction,
    this.onSubmitted,
    this.onChanged,
    this.trailing,
  });

  final String label;
  final TextEditingController controller;
  final String hint;
  final FocusNode? focusNode;
  final bool obscure;
  final List<String>? autofillHints;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onSubmitted;
  final VoidCallback? onChanged;
  final Widget? trailing;

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
      ],
    );
  }
}

class _LinkButton extends StatelessWidget {
  const _LinkButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onTap,
      style: TextButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        foregroundColor: const Color(0xFF8AB4F8),
        minimumSize: Size.zero,
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
      child: Text(label, style: const TextStyle(fontSize: 12.5)),
    );
  }
}
