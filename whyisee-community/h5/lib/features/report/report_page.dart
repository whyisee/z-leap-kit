import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/api_exception.dart';
import '../../core/env.dart';
import '../../core/providers.dart';
import '../settings/widgets/settings_top_bar.dart';
import 'report_repository.dart';

/// 举报表单（原生版）。
///
/// 网页 `/report` 是「一个原因输入框 + 一个补充说明」，在手机上打字成本很高，
/// 所以这里给四个常用原因做成一排按钮：点一下就填好，想补充再编辑。
/// 原因仍然可编辑、也允许完全自己写 —— 按钮只是省事，不是限定选项。
class ReportPage extends ConsumerStatefulWidget {
  const ReportPage({super.key, required this.targetType, required this.targetId, this.targetLabel = ''});

  final String targetType;
  final int targetId;

  /// 被举报内容的简短描述（标题 / 楼层），只是让用户确认「举报的是这条」。
  final String targetLabel;

  @override
  ConsumerState<ReportPage> createState() => _ReportPageState();
}

class _ReportPageState extends ConsumerState<ReportPage> {
  final _reason = TextEditingController();
  final _details = TextEditingController();

  String? _error;
  bool _submitting = false;

  static const _presets = ['垃圾广告', '人身攻击 / 骚扰', '违法违规内容', '侵权或抄袭'];

  @override
  void initState() {
    super.initState();
    // 原因一变就重建：既撤掉旧的红字，也让「提交」按钮跟着亮起来。
    // 只在点预设时 setState 是不够的 —— 手打的原因会让按钮一直是灰的。
    _reason.addListener(() {
      if (!mounted) return;
      setState(() => _error = null);
    });
  }

  @override
  void dispose() {
    _reason.dispose();
    _details.dispose();
    super.dispose();
  }

  bool get _canSubmit => _reason.text.trim().length >= 2 && !_submitting;

  Future<void> _submit() async {
    if (!_canSubmit) return;

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await ref
          .read(reportRepositoryProvider)
          .submit(
            targetType: widget.targetType,
            targetId: widget.targetId,
            reason: _reason.text.trim(),
            details: _details.text.trim(),
          );

      if (!mounted) return;
      // 举报是「做完就走」的动作，不留在页面上等回执
      context.pop(true);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = error.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.of(context).padding.top;
    final signedIn = ref.watch(sessionProvider).isSignedIn;

    return Scaffold(
      backgroundColor: const Color(Env.bg),
      body: Column(
        children: [
          SettingsTopBar(topInset: topInset, title: '举报', onBack: () => context.pop()),
          Expanded(child: signedIn ? _buildForm() : _buildSignInRequired()),
        ],
      ),
    );
  }

  Widget _buildForm() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 40),
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(13, 11, 13, 11),
          decoration: BoxDecoration(
            color: const Color(Env.surface),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0x1AFFFFFF)),
          ),
          child: Row(
            children: [
              Icon(
                widget.targetType == 'user' ? Icons.person_outline : Icons.article_outlined,
                size: 15,
                color: const Color(Env.muted),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  widget.targetLabel.isEmpty
                      ? switch (widget.targetType) {
                          'user' => '用户',
                          'post' => '这条回复',
                          _ => '这条话题',
                        }
                      : widget.targetLabel,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 12.5, height: 1.45, color: Color(Env.text)),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        const Text(
          '举报原因',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.5,
            color: Color(Env.muted),
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final preset in _presets)
              GestureDetector(
                onTap: () {
                  _reason.text = preset;
                  _reason.selection = TextSelection.collapsed(offset: preset.length);
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                  decoration: BoxDecoration(
                    color: _reason.text.trim() == preset ? const Color(0x1F8AB4F8) : const Color(Env.surface),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: _reason.text.trim() == preset
                          ? const Color(0x668AB4F8)
                          : const Color(0x1AFFFFFF),
                    ),
                  ),
                  child: Text(
                    preset,
                    style: TextStyle(
                      fontSize: 12,
                      color: _reason.text.trim() == preset ? const Color(Env.blue) : const Color(Env.text),
                    ),
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 12),
        _ReportField(controller: _reason, hint: '也可以自己写，比如「重复灌水」「广告外链」', maxLength: 200),
        const SizedBox(height: 12),
        _ReportField(controller: _details, hint: '补充说明（可选）：哪一段有问题、影响了谁', maxLines: 5, maxLength: 2000),
        if (_error != null) ...[
          const SizedBox(height: 4),
          Text(_error!, style: const TextStyle(fontSize: 12, height: 1.5, color: Color(0xFFFF6B7A))),
        ],
        const SizedBox(height: 18),
        SizedBox(
          height: 44,
          child: FilledButton(
            onPressed: _canSubmit ? _submit : null,
            style: FilledButton.styleFrom(
              backgroundColor: const Color(Env.blue),
              disabledBackgroundColor: const Color(0x1F8AB4F8),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: _submitting
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Text('提交举报', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
          ),
        ),
        const SizedBox(height: 12),
        const Text(
          '举报会直接进入管理员后台。恶意举报会被记录，别拿它当吵架工具。',
          style: TextStyle(fontSize: 11, height: 1.6, color: Color(0xFF4A5260)),
        ),
      ],
    );
  }

  Widget _buildSignInRequired() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              '登录后才能举报',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Color(Env.text)),
            ),
            const SizedBox(height: 8),
            const Text(
              '举报要记录是谁提交的，这样才挡得住刷举报。',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12.5, height: 1.6, color: Color(Env.muted)),
            ),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: () => context.push('/login'),
              style: FilledButton.styleFrom(backgroundColor: const Color(Env.blue)),
              child: const Text('去登录'),
            ),
          ],
        ),
      ),
    );
  }
}

/// 举报页自己的输入框。
///
/// 没有复用登录那份 [AuthField]：那边只有单行输入、也没有字数计数，
/// 而举报的补充说明必须能写多行。
class _ReportField extends StatelessWidget {
  const _ReportField({required this.controller, required this.hint, this.maxLines = 1, this.maxLength});

  final TextEditingController controller;
  final String hint;
  final int maxLines;
  final int? maxLength;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      maxLines: maxLines,
      maxLength: maxLength,
      style: const TextStyle(fontSize: 14, height: 1.5, color: Color(Env.text)),
      cursorColor: const Color(Env.blue),
      decoration: InputDecoration(
        isDense: true,
        counterStyle: const TextStyle(fontSize: 10, color: Color(0xFF4A5260)),
        hintText: hint,
        hintStyle: const TextStyle(fontSize: 13, height: 1.5, color: Color(0xFF4A5260)),
        filled: true,
        fillColor: const Color(Env.surface),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
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
    );
  }
}
