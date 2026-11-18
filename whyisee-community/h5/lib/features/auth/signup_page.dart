import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/api_exception.dart';
import '../../core/env.dart';
import '../../core/providers.dart';
import 'auth_field.dart';
import 'auth_repository.dart';

/// 原生注册页。
///
/// 网页版注册要一次填四个字段（含邀请码），手机竖屏上那个表单光滚就够呛；
/// 这里一个字段一行、回车往下走，最后一步直接进站 —— 注册成功本来就该是
/// 登录状态，不该再让用户回登录页输一遍。
class SignupPage extends ConsumerStatefulWidget {
  const SignupPage({super.key});

  @override
  ConsumerState<SignupPage> createState() => _SignupPageState();
}

class _SignupPageState extends ConsumerState<SignupPage> {
  final _username = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _invite = TextEditingController();

  final _emailFocus = FocusNode();
  final _passwordFocus = FocusNode();
  final _inviteFocus = FocusNode();

  bool _busy = false;
  bool _obscure = true;
  String? _error;

  @override
  void dispose() {
    _username.dispose();
    _email.dispose();
    _password.dispose();
    _invite.dispose();
    _emailFocus.dispose();
    _passwordFocus.dispose();
    _inviteFocus.dispose();
    super.dispose();
  }

  /// 只挡「明显没填完」的情况；格式与唯一性都交给服务端，那边才是唯一真相。
  bool get _canSubmit =>
      _username.text.trim().isNotEmpty &&
      _email.text.trim().isNotEmpty &&
      _password.text.length >= 8 &&
      _invite.text.trim().isNotEmpty &&
      !_busy;

  Future<void> _submit() async {
    if (!_canSubmit) return;

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      await ref.read(sessionProvider.notifier).signUp(
            username: _username.text.trim(),
            email: _email.text.trim(),
            password: _password.text,
            inviteCode: _invite.text.trim(),
          );
      if (!mounted) return;
      // 注册即登录：带着 true 回去，调用方（例如回复框）可以接着做原来的事
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        // 服务端会带 field（username / email / inviteCode / password），
        // 但文案它已经给好了，这里不再自己拼「用户名」前缀
        _error = authErrorText(e);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = '注册没成功，稍后再试';
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
          '注册',
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
            const AuthHeading(
              title: '创建账号',
              description: 'whyisee 是邀请制。填完就能直接进站，不用再登一次。',
            ),
            const SizedBox(height: 24),
            AuthField(
              label: '用户名',
              controller: _username,
              hint: 'whyisee',
              helper: '3–32 位，字母、数字、下划线或连字符',
              autofillHints: const [AutofillHints.newUsername],
              textInputAction: TextInputAction.next,
              onSubmitted: (_) => _emailFocus.requestFocus(),
              onChanged: () => setState(() {}),
            ),
            const SizedBox(height: 14),
            AuthField(
              label: '邮箱',
              controller: _email,
              focusNode: _emailFocus,
              hint: 'you@example.com',
              helper: '用来找回密码，请填能收到信的',
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
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
              helper: '至少 8 位',
              obscure: _obscure,
              autofillHints: const [AutofillHints.newPassword],
              textInputAction: TextInputAction.next,
              onSubmitted: (_) => _inviteFocus.requestFocus(),
              onChanged: () => setState(() {}),
              trailing: IconButton(
                onPressed: () => setState(() => _obscure = !_obscure),
                iconSize: 18,
                color: const Color(Env.muted),
                icon: Icon(_obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                tooltip: _obscure ? '显示密码' : '隐藏密码',
              ),
            ),
            const SizedBox(height: 14),
            AuthField(
              label: '邀请码',
              controller: _invite,
              focusNode: _inviteFocus,
              hint: '邀请码',
              helper: '没有邀请码的话，可以联系站内作者',
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _submit(),
              onChanged: () => setState(() {}),
            ),
            if (_error != null) ...[
              const SizedBox(height: 14),
              AuthErrorLine(message: _error!),
            ],
            const SizedBox(height: 22),
            AuthSubmitButton(
              label: '注册并进入',
              busy: _busy,
              onPressed: _canSubmit ? _submit : null,
            ),
            const SizedBox(height: 14),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  '已经有账号？',
                  style: const TextStyle(fontSize: 12.5, color: Color(Env.muted)),
                ),
                TextButton(
                  onPressed: () => context.pop(),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                    foregroundColor: const Color(0xFF8AB4F8),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: const Text('去登录', style: TextStyle(fontSize: 12.5)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
