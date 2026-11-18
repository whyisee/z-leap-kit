import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/api_exception.dart';
import '../../core/api/models.dart';
import '../../core/env.dart';
import '../../core/format.dart';
import '../../core/providers.dart';
import '../errors/error_view.dart';
import '../me/me_repository.dart';
import 'settings_repository.dart';
import 'widgets/settings_top_bar.dart';

/// 「设置 → 公开资料」。
///
/// 网页版是四个分组一长条表单，手机上照搬会滚三层。这里只留「别人看得见的东西」
/// （昵称、简介、头像、主页链接），邮箱 / 密码在「密码与认证」那页。
class SettingsProfilePage extends ConsumerStatefulWidget {
  const SettingsProfilePage({super.key});

  @override
  ConsumerState<SettingsProfilePage> createState() => _SettingsProfilePageState();
}

class _SettingsProfilePageState extends ConsumerState<SettingsProfilePage> {
  final _displayName = TextEditingController();
  final _bio = TextEditingController();
  final _avatarUrl = TextEditingController();
  final _websiteUrl = TextEditingController();
  final _githubUrl = TextEditingController();

  MyProfile? _profile;
  String _locale = 'zh';
  String? _error;
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
    // 头像预览跟着输入实时变，不用等保存
    _avatarUrl.addListener(_onAvatarChanged);
  }

  @override
  void dispose() {
    _avatarUrl.removeListener(_onAvatarChanged);
    _displayName.dispose();
    _bio.dispose();
    _avatarUrl.dispose();
    _websiteUrl.dispose();
    _githubUrl.dispose();
    super.dispose();
  }

  void _onAvatarChanged() => setState(() {});

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final profile = await ref.read(settingsRepositoryProvider).loadProfile();
      if (!mounted) return;
      setState(() {
        _profile = profile;
        _displayName.text = profile.displayName;
        _bio.text = profile.bio;
        _avatarUrl.text = profile.avatarUrl ?? '';
        _websiteUrl.text = profile.websiteUrl ?? '';
        _githubUrl.text = profile.githubUrl ?? '';
        _locale = profile.locale;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _save() async {
    if (_saving) return;

    final displayName = _displayName.text.trim();
    if (displayName.isEmpty) {
      _toast('昵称不能为空');
      return;
    }

    setState(() => _saving = true);

    try {
      await ref.read(settingsRepositoryProvider).saveProfile(
            displayName: displayName,
            bio: _bio.text,
            avatarUrl: _avatarUrl.text,
            websiteUrl: _websiteUrl.text,
            githubUrl: _githubUrl.text,
            locale: _locale,
          );

      // 昵称/头像改完，「我」页和会话里的那份也得换，否则要等重启才更新
      await ref.read(sessionProvider.notifier).refreshMe();
      ref.invalidate(meOverviewProvider);

      if (!mounted) return;
      _toast('已保存');
      context.pop(true);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _saving = false);
      _toast(error.message);
    }
  }

  void _toast(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.of(context).padding.top;

    return Scaffold(
      backgroundColor: const Color(Env.bg),
      body: Column(
        children: [
          SettingsTopBar(
            topInset: topInset,
            title: '公开资料',
            onBack: () => context.pop(),
            action: _loading || _error != null
                ? null
                : TextButton(
                    onPressed: _saving ? null : _save,
                    style: TextButton.styleFrom(
                      foregroundColor: const Color(Env.blue),
                      minimumSize: const Size(48, 36),
                    ),
                    child: _saving
                        ? const SizedBox(
                            width: 15,
                            height: 15,
                            child: CircularProgressIndicator(strokeWidth: 1.8),
                          )
                        : const Text(
                            '保存',
                            style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600),
                          ),
                  ),
          ),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) return const Center(child: CircularProgressIndicator(strokeWidth: 2));

    if (_error != null) {
      return ErrorView(title: '打不开资料', message: _error!, onRetry: _load);
    }

    final email = _profile?.email;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 40),
      children: [
        Center(child: _AvatarPreview(url: _avatarUrl.text)),
        const SizedBox(height: 10),
        Center(
          child: Text(
            _profile == null ? '' : '@${_profile!.username}',
            style: const TextStyle(fontSize: 12, color: Color(Env.muted)),
          ),
        ),
        const SizedBox(height: 22),
        _Field(
          label: '昵称',
          hint: '别人在列表里看到的名字',
          controller: _displayName,
          maxLength: 32,
        ),
        _Field(
          label: '简介',
          hint: '一行话说清你是谁、在写什么',
          controller: _bio,
          maxLines: 3,
          maxLength: 300,
        ),
        _Field(
          label: '头像地址',
          hint: 'https://…（留空就用昵称首字）',
          controller: _avatarUrl,
          keyboardType: TextInputType.url,
        ),
        const SizedBox(height: 6),
        _Field(
          label: '个人网站',
          hint: 'https://…',
          controller: _websiteUrl,
          keyboardType: TextInputType.url,
        ),
        _Field(
          label: 'GitHub',
          hint: 'https://github.com/…',
          controller: _githubUrl,
          keyboardType: TextInputType.url,
        ),
        const SizedBox(height: 4),
        _LocalePicker(
          value: _locale,
          onChanged: (value) => setState(() => _locale = value),
        ),
        if (email != null && email.isNotEmpty) ...[
          const SizedBox(height: 22),
          _ReadOnlyRow(label: '邮箱', value: email),
          const SizedBox(height: 6),
          const Text(
            '邮箱不能在这里改，需要走「密码与认证」。',
            style: TextStyle(fontSize: 11.5, height: 1.5, color: Color(0xFF4A5260)),
          ),
        ],
      ],
    );
  }
}

class _AvatarPreview extends StatelessWidget {
  const _AvatarPreview({required this.url});

  final String url;

  @override
  Widget build(BuildContext context) {
    final resolved = absoluteImageUrl(url);
    final initial = url.isEmpty ? '?' : '你';

    return Container(
      width: 74,
      height: 74,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: const Color(Env.panel),
        border: Border.all(color: const Color(0x338AB4F8)),
      ),
      clipBehavior: Clip.antiAlias,
      child: resolved == null
          ? Center(
              child: Text(
                initial,
                style: const TextStyle(fontSize: 26, color: Color(Env.blue)),
              ),
            )
          : Image.network(
              resolved,
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => const Center(
                child: Icon(Icons.broken_image_outlined, size: 22, color: Color(Env.muted)),
              ),
            ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.label,
    required this.hint,
    required this.controller,
    this.maxLines = 1,
    this.maxLength,
    this.keyboardType,
  });

  final String label;
  final String hint;
  final TextEditingController controller;
  final int maxLines;
  final int? maxLength;
  final TextInputType? keyboardType;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
              color: Color(Env.muted),
            ),
          ),
          const SizedBox(height: 7),
          TextField(
            controller: controller,
            maxLines: maxLines,
            maxLength: maxLength,
            keyboardType: keyboardType,
            style: const TextStyle(fontSize: 14, height: 1.5, color: Color(Env.text)),
            cursorColor: const Color(Env.blue),
            decoration: InputDecoration(
              isDense: true,
              counterStyle: const TextStyle(fontSize: 10, color: Color(0xFF4A5260)),
              hintText: hint,
              hintStyle: const TextStyle(fontSize: 13, color: Color(0xFF4A5260)),
              filled: true,
              fillColor: const Color(Env.surface),
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
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

class _LocalePicker extends StatelessWidget {
  const _LocalePicker({required this.value, required this.onChanged});

  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    const options = [('zh', '中文'), ('en', 'English')];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          '界面语言',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.5,
            color: Color(Env.muted),
          ),
        ),
        const SizedBox(height: 7),
        Row(
          children: [
            for (final (code, label) in options)
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: GestureDetector(
                  onTap: () => onChanged(code),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: value == code ? const Color(0x1F8AB4F8) : const Color(Env.surface),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: value == code
                            ? const Color(0x668AB4F8)
                            : const Color(0x1AFFFFFF),
                      ),
                    ),
                    child: Text(
                      label,
                      style: TextStyle(
                        fontSize: 12.5,
                        color: value == code ? const Color(Env.blue) : const Color(Env.text),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 6),
        const Text(
          '影响网页端和邮件里的默认语言；App 界面跟随手机系统。',
          style: TextStyle(fontSize: 11, height: 1.5, color: Color(0xFF4A5260)),
        ),
      ],
    );
  }
}

class _ReadOnlyRow extends StatelessWidget {
  const _ReadOnlyRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(label, style: const TextStyle(fontSize: 12, color: Color(Env.muted))),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: const TextStyle(fontSize: 12.5, color: Color(Env.text)),
          ),
        ),
      ],
    );
  }
}
