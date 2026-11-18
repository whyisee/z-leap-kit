import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/api_exception.dart';
import '../../core/env.dart';
import '../../core/providers.dart';
import 'settings_repository.dart';
import 'widgets/settings_top_bar.dart';

/// 「设置 → 密码与认证」。
///
/// 只做一件事：改密码。改完不把当前设备踢下线（网页那边是直接踢的，因为在
/// 浏览器里重登一次成本很低），但会把其它会话全部吊销 —— 这个信息必须明确告诉
/// 用户，否则他会以为「我改了密码，怎么别处还登着」。
class SettingsAccountPage extends ConsumerStatefulWidget {
  const SettingsAccountPage({super.key});

  @override
  ConsumerState<SettingsAccountPage> createState() => _SettingsAccountPageState();
}

class _SettingsAccountPageState extends ConsumerState<SettingsAccountPage> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();

  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy) return;

    final current = _current.text;
    final next = _next.text;

    if (current.isEmpty) {
      setState(() => _error = '请输入当前密码');
      return;
    }
    if (next.length < 8) {
      setState(() => _error = '新密码至少 8 位');
      return;
    }
    if (next != _confirm.text) {
      setState(() => _error = '两次输入的新密码不一样');
      return;
    }
    if (next == current) {
      setState(() => _error = '新密码不能和当前密码一样');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      await ref.read(settingsRepositoryProvider).changePassword(
            currentPassword: current,
            nextPassword: next,
          );

      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          backgroundColor: const Color(Env.surface),
          title: const Text('密码已更新', style: TextStyle(fontSize: 16)),
          content: const Text(
            '其它设备上的登录已经退出，这台手机保持登录状态。',
            style: TextStyle(fontSize: 13, height: 1.6),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('知道了'),
            ),
          ],
        ),
      );

      if (!mounted) return;
      context.pop(true);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = error.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.of(context).padding.top;
    final email = ref.watch(sessionProvider).user?.email;

    return Scaffold(
      backgroundColor: const Color(Env.bg),
      body: Column(
        children: [
          SettingsTopBar(topInset: topInset, title: '密码与认证', onBack: () => context.pop()),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 40),
              children: [
                if (email != null && email.isNotEmpty) ...[
                  Container(
                    padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                    decoration: BoxDecoration(
                      color: const Color(Env.surface),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0x0FFFFFFF)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.mail_outline, size: 16, color: Color(Env.muted)),
                        const SizedBox(width: 10),
                        const Text(
                          '登录邮箱',
                          style: TextStyle(fontSize: 12.5, color: Color(Env.muted)),
                        ),
                        const Spacer(),
                        Text(
                          email,
                          style: const TextStyle(fontSize: 12.5, color: Color(Env.text)),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 22),
                ],
                const Text(
                  '修改密码',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                    color: Color(Env.muted),
                  ),
                ),
                const SizedBox(height: 12),
                _PasswordField(label: '当前密码', controller: _current),
                _PasswordField(label: '新密码（至少 8 位）', controller: _next),
                _PasswordField(
                  label: '再输一次新密码',
                  controller: _confirm,
                  onSubmitted: (_) => _submit(),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    _error!,
                    style: const TextStyle(fontSize: 12.5, color: Color(0xFFFF8A80)),
                  ),
                ],
                const SizedBox(height: 20),
                SizedBox(
                  height: 44,
                  child: FilledButton(
                    onPressed: _busy ? null : _submit,
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF8AB4F8),
                      foregroundColor: const Color(0xFF0D1016),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: _busy
                        ? const SizedBox(
                            width: 17,
                            height: 17,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text(
                            '更新密码',
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                          ),
                  ),
                ),
                const SizedBox(height: 14),
                const Text(
                  '改完密码后，其它设备需要重新登录。这台手机不用。',
                  style: TextStyle(fontSize: 11.5, height: 1.6, color: Color(0xFF4A5260)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PasswordField extends StatefulWidget {
  const _PasswordField({
    required this.label,
    required this.controller,
    this.onSubmitted,
  });

  final String label;
  final TextEditingController controller;
  final ValueChanged<String>? onSubmitted;

  @override
  State<_PasswordField> createState() => _PasswordFieldState();
}

class _PasswordFieldState extends State<_PasswordField> {
  bool _obscure = true;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            widget.label,
            style: const TextStyle(fontSize: 12, color: Color(Env.muted)),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: widget.controller,
            obscureText: _obscure,
            autocorrect: false,
            enableSuggestions: false,
            textInputAction:
                widget.onSubmitted == null ? TextInputAction.next : TextInputAction.done,
            onSubmitted: widget.onSubmitted,
            style: const TextStyle(fontSize: 14, color: Color(Env.text)),
            cursorColor: const Color(Env.blue),
            decoration: InputDecoration(
              isDense: true,
              filled: true,
              fillColor: const Color(Env.surface),
              contentPadding: const EdgeInsets.fromLTRB(12, 12, 4, 12),
              suffixIcon: IconButton(
                onPressed: () => setState(() => _obscure = !_obscure),
                icon: Icon(
                  _obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                  size: 17,
                ),
                color: const Color(Env.muted),
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: Color(0x1AFFFFFF)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: Color(0x1AFFFFFF)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: Color(0x668AB4F8)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
