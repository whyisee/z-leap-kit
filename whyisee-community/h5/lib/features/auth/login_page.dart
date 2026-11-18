import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/api_exception.dart';
import '../../core/env.dart';
import '../../core/providers.dart';
import 'auth_field.dart';
import 'auth_repository.dart';

/// 原生登录页。
///
/// 为什么不再用网页版登录：WebView 里输完密码、网页 303 跳回去，整个过程
/// 用户看着地址栏和一堆站点头尾，登录态还得靠 JS 桥回传。原生登录只有一个
/// 表单，登录成功后直接 `pop` 回上一页，来路不变。
///
/// 注册和找回密码也是原生页了（`SignupPage` / `ForgotPasswordPage`），
/// 三个入口不再各跳各的 WebView。
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
        _error = authErrorText(e);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = '登录失败，稍后重试';
      });
    }
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
            AuthHeading(
              title: '欢迎回来',
              description: widget.reason ?? '登录后可以发帖、回复和关注作者。',
            ),
            const SizedBox(height: 24),
            AuthField(
              label: '用户名或邮箱',
              controller: _identifier,
              hint: 'whyisee',
              autofillHints: const [AutofillHints.username],
              textInputAction: TextInputAction.next,
              onSubmitted: (_) => _passwordFocus.requestFocus(),
              onChanged: () => setState(() {}),
            ),
            const SizedBox(height: 14),
            AuthField(
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
              AuthErrorLine(message: _error!),
            ],
            const SizedBox(height: 22),
            AuthSubmitButton(
              label: '登录',
              busy: _busy,
              onPressed: _canSubmit ? _submit : null,
            ),
            const SizedBox(height: 18),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _LinkButton(
                  label: '注册账号',
                  // push 而不是 replace：注册页取消后回到这张已经填了一半的登录表单
                  onTap: () async {
                    final navigator = Navigator.of(context);
                    final created = await context.push<bool>('/signup');
                    if (created == true) navigator.pop(true);
                  },
                ),
                Container(width: 1, height: 12, color: const Color(Env.line)),
                _LinkButton(
                  label: '忘记密码',
                  onTap: () => context.push('/forgot-password'),
                ),
              ],
            ),
          ],
        ),
      ),
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
