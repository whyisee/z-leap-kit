import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/api_exception.dart';
import '../../core/env.dart';
import 'auth_field.dart';
import 'auth_repository.dart';

/// 找回密码。
///
/// 两段放在一页里：
/// 1. 输用户名或邮箱 → 发邮件。不管账号在不在，回话都一样。
/// 2. 已经拿到 token（邮件里那条链接的 `?token=`）→ 直接设新密码。
///
/// 为什么第二段要做：邮件里的链接指向网页，手机点开会跳浏览器。用户既然已经在
/// App 里，让他把 token 粘过来就地改完，比被踢去浏览器再回来自然。
/// 带 `token` 进来（`/reset-password?token=…`）就直接落在第二段。
class ForgotPasswordPage extends ConsumerStatefulWidget {
  const ForgotPasswordPage({super.key, this.token});

  /// 有值就跳过第一段
  final String? token;

  @override
  ConsumerState<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends ConsumerState<ForgotPasswordPage> {
  final _identifier = TextEditingController();
  final _token = TextEditingController();
  final _password = TextEditingController();

  bool _busy = false;
  bool _obscure = true;
  bool _sent = false;
  bool _enteringToken = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final preset = widget.token?.trim() ?? '';

    if (preset.isNotEmpty) {
      _token.text = preset;
      // 带着 token 进来等于「邮件已经在手上」，直接跳到设新密码那一段，
      // 否则用户还得先看一眼「输入账号发邮件」的表单
      _sent = true;
      _enteringToken = true;
    }
  }

  @override
  void dispose() {
    _identifier.dispose();
    _token.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _request() async {
    final identifier = _identifier.text.trim();
    if (identifier.isEmpty || _busy) return;

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final debugToken = await ref.read(authRepositoryProvider).requestReset(identifier);
      if (!mounted) return;

      setState(() {
        _busy = false;
        _sent = true;
        // 开发环境服务端会把 token 回给我们，省得为了测这一步去翻数据库
        if (debugToken != null && debugToken.isNotEmpty) {
          _token.text = debugToken;
          _enteringToken = true;
        }
      });
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
        _error = '发送失败，稍后再试';
      });
    }
  }

  Future<void> _confirm() async {
    final token = _token.text.trim();
    final password = _password.text;

    if (token.isEmpty || password.length < 8 || _busy) return;

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      await ref.read(authRepositoryProvider).confirmReset(token: token, password: password);
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('密码已更新，用新密码登录')),
      );
      // 回到登录页：重置完的人下一步一定是登录
      context.pop(true);
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
        _error = '改密码失败，稍后再试';
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
          '找回密码',
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
          children: _sent ? _sentChildren() : _askChildren(),
        ),
      ),
    );
  }

  List<Widget> _askChildren() {
    return [
      const AuthHeading(
        title: '找回密码',
        description: '输入用户名或邮箱。账号存在的话，我们会发一封带重置链接的邮件。',
      ),
      const SizedBox(height: 24),
      AuthField(
        label: '用户名或邮箱',
        controller: _identifier,
        hint: 'whyisee 或 you@example.com',
        autofillHints: const [AutofillHints.username],
        textInputAction: TextInputAction.done,
        onSubmitted: (_) => _request(),
        onChanged: () => setState(() {}),
      ),
      if (_error != null) ...[
        const SizedBox(height: 14),
        AuthErrorLine(message: _error!),
      ],
      const SizedBox(height: 22),
      AuthSubmitButton(
        label: '发送重置邮件',
        busy: _busy,
        onPressed: _identifier.text.trim().isEmpty ? null : _request,
      ),
      const SizedBox(height: 14),
      Center(
        child: TextButton(
          onPressed: () => context.pop(),
          style: TextButton.styleFrom(
            foregroundColor: const Color(0xFF8AB4F8),
            minimumSize: Size.zero,
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          child: const Text('返回登录', style: TextStyle(fontSize: 12.5)),
        ),
      ),
    ];
  }

  List<Widget> _sentChildren() {
    return [
      const AuthHeading(
        title: '邮件已发出',
        description: '如果这个账号存在，你会收到一封带重置链接的邮件，链接一小时有效。'
            '没收到就翻一翻垃圾箱，或者换个用户名再试。',
      ),
      const SizedBox(height: 18),
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(Env.surface),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: const Color(Env.line)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.link, size: 15, color: Color(Env.muted)),
                const SizedBox(width: 6),
                const Expanded(
                  child: Text(
                    '邮件里的链接会打开网页。想在这里改，把链接里的 token 粘过来。',
                    style: TextStyle(fontSize: 12, height: 1.5, color: Color(Env.muted)),
                  ),
                ),
                if (!_enteringToken)
                  TextButton(
                    onPressed: () => setState(() => _enteringToken = true),
                    style: TextButton.styleFrom(
                      foregroundColor: const Color(0xFF8AB4F8),
                      minimumSize: Size.zero,
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 4),
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: const Text('我有 token', style: TextStyle(fontSize: 12)),
                  ),
              ],
            ),
            if (_enteringToken) ...[
              const SizedBox(height: 12),
              AuthField(
                label: '重置 token',
                controller: _token,
                hint: '链接里 ?token= 后面那串',
                textInputAction: TextInputAction.next,
                onChanged: () => setState(() {}),
              ),
              const SizedBox(height: 12),
              AuthField(
                label: '新密码',
                controller: _password,
                hint: '••••••••',
                helper: '至少 8 位',
                obscure: _obscure,
                autofillHints: const [AutofillHints.newPassword],
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _confirm(),
                onChanged: () => setState(() {}),
                trailing: IconButton(
                  onPressed: () => setState(() => _obscure = !_obscure),
                  iconSize: 18,
                  color: const Color(Env.muted),
                  icon: Icon(
                    _obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                  ),
                  tooltip: _obscure ? '显示密码' : '隐藏密码',
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                AuthErrorLine(message: _error!),
              ],
              const SizedBox(height: 16),
              AuthSubmitButton(
                label: '设成新密码',
                busy: _busy,
                onPressed: _token.text.trim().isEmpty || _password.text.length < 8
                    ? null
                    : _confirm,
              ),
            ],
          ],
        ),
      ),
      const SizedBox(height: 18),
      Center(
        child: TextButton(
          onPressed: () => context.pop(),
          style: TextButton.styleFrom(
            foregroundColor: const Color(0xFF8AB4F8),
            minimumSize: Size.zero,
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          child: const Text('返回登录', style: TextStyle(fontSize: 12.5)),
        ),
      ),
    ];
  }
}
