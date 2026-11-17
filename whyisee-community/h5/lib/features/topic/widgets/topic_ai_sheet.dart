import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/models.dart';
import '../../../core/env.dart';
import '../topic_repository.dart';

/// 网页 `.topic-ai-panel` 的六个动作，文案与服务端 `topicAi.ts` 一一对应。
class TopicAiAction {
  const TopicAiAction(this.id, this.label, this.hint);

  final String id;
  final String label;
  final String hint;
}

const kTopicAiActions = <TopicAiAction>[
  TopicAiAction('summarize', '总结话题', '要点、背景和结论'),
  TopicAiAction('draft-reply', '生成回复', '给出有信息量的回复草稿'),
  TopicAiAction('translate', '双语翻译', '中文和英文阅读版本'),
  TopicAiAction('extract-actions', '提炼行动项', '任务、风险和下一步'),
  TopicAiAction('find-related', '查找相关', '相似话题和标签建议'),
  TopicAiAction('quality-check', '质量检查', '标题、分类和内容建议'),
];

Future<void> showTopicAiSheet(BuildContext context, {required int topicId}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: const Color(Env.surface),
    barrierColor: const Color(0xB3000000),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => TopicAiSheet(topicId: topicId),
  );
}

enum _Phase { idle, loading, done, error }

/// 帖子 AI 助手：选动作 → 等结果 → 复制。
/// 一个面板内切换状态，避免「菜单弹一层、结果又弹一层」的双层返回。
class TopicAiSheet extends ConsumerStatefulWidget {
  const TopicAiSheet({super.key, required this.topicId});

  final int topicId;

  @override
  ConsumerState<TopicAiSheet> createState() => _TopicAiSheetState();
}

class _TopicAiSheetState extends ConsumerState<TopicAiSheet> {
  _Phase _phase = _Phase.idle;
  TopicAiAction? _action;
  TopicAiResult? _result;
  String? _error;
  bool _copied = false;
  Timer? _copiedReset;

  @override
  void dispose() {
    _copiedReset?.cancel();
    super.dispose();
  }

  Future<void> _run(TopicAiAction action) async {
    setState(() {
      _phase = _Phase.loading;
      _action = action;
      _result = null;
      _error = null;
      _copied = false;
    });

    try {
      final result = await ref
          .read(topicRepositoryProvider)
          .aiTopic(topicId: widget.topicId, action: action.id);
      if (!mounted) return;
      setState(() {
        _result = result;
        _phase = _Phase.done;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _phase = _Phase.error;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = '出错了，再试一次。';
        _phase = _Phase.error;
      });
    }
  }

  Future<void> _copy() async {
    final text = _result?.outputMarkdown ?? '';
    if (text.isEmpty) return;
    await Clipboard.setData(ClipboardData(text: text));
    if (!mounted) return;
    setState(() => _copied = true);
    _copiedReset?.cancel();
    _copiedReset = Timer(const Duration(milliseconds: 1400), () {
      if (mounted) setState(() => _copied = false);
    });
  }

  void _backToMenu() {
    setState(() {
      _phase = _Phase.idle;
      _result = null;
      _error = null;
      _copied = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final height = MediaQuery.sizeOf(context).height * 0.78;

    return SizedBox(
      height: height,
      child: Column(
        children: [
          const SizedBox(height: 8),
          // 顶部拖拽条
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: const Color(0x33FFFFFF),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 12, 8, 8),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: _headline()),
                IconButton(
                  onPressed: () => Navigator.of(context).maybePop(),
                  iconSize: 20,
                  color: const Color(Env.muted),
                  icon: const Icon(Icons.close),
                  tooltip: '关闭',
                ),
              ],
            ),
          ),
          const Divider(height: 1, thickness: 1, color: Color(0x14FFFFFF)),
          Expanded(child: _body()),
        ],
      ),
    );
  }

  Widget _headline() {
    final action = _action;
    final title = switch (_phase) {
      _Phase.idle => 'AI 助手',
      _Phase.loading => action?.label ?? 'AI 助手',
      _Phase.done => _result?.label ?? action?.label ?? 'AI 助手',
      _Phase.error => action?.label ?? 'AI 助手',
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'AI',
          style: TextStyle(
            fontSize: 10.5,
            fontWeight: FontWeight.w900,
            letterSpacing: 1.4,
            color: Color(Env.blue),
          ),
        ),
        const SizedBox(height: 3),
        Text(
          title,
          style: const TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w700,
            color: Color(Env.text),
          ),
        ),
        const SizedBox(height: 3),
        Text(
          _subtitle(),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 11.5, color: Color(Env.muted)),
        ),
      ],
    );
  }

  String _subtitle() {
    if (_phase == _Phase.loading) return '正在读这篇正文和回复…';
    if (_phase == _Phase.done) {
      final label = _result?.modelLabel ?? '';
      return label.isEmpty ? '结果可直接复制，也可以换个动作再试' : '生成模型 $label';
    }
    return '基于这篇正文和回复生成';
  }

  Widget _body() {
    return switch (_phase) {
      _Phase.idle => _menu(),
      _Phase.loading => _loading(),
      _Phase.done => _resultView(),
      _Phase.error => _errorView(),
    };
  }

  Widget _menu() {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
      itemCount: kTopicAiActions.length,
      separatorBuilder: (_, _) => const SizedBox(height: 2),
      itemBuilder: (context, index) {
        final action = kTopicAiActions[index];
        return InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => _run(action),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        action.label,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: Color(Env.text),
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        action.hint,
                        style: const TextStyle(fontSize: 11.5, color: Color(Env.muted)),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, size: 18, color: Color(0xFF5C6675)),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _loading() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(strokeWidth: 2, color: Color(Env.blue)),
          ),
          const SizedBox(height: 14),
          const Text(
            'AI 正在思考…',
            style: TextStyle(fontSize: 13, color: Color(Env.muted)),
          ),
          const SizedBox(height: 6),
          Text(
            '长文可能要十几秒',
            style: TextStyle(fontSize: 11.5, color: const Color(Env.muted).withValues(alpha: 0.7)),
          ),
        ],
      ),
    );
  }

  Widget _resultView() {
    final result = _result;
    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(18, 14, 18, 10),
            child: SelectableText(
              result?.outputMarkdown ?? '',
              style: const TextStyle(
                fontSize: 13,
                height: 1.62,
                color: Color(0xFFDDE3EA),
              ),
            ),
          ),
        ),
        if ((result?.modelLabel ?? '').isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 0, 18, 6),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                '以上内容由 AI 生成，仅供参考',
                style: const TextStyle(fontSize: 10.5, color: Color(0xFF5C6675)),
              ),
            ),
          ),
        _footer(
          primary: _SheetButton(
            label: _copied ? '已复制' : '复制',
            icon: _copied ? Icons.check : Icons.copy_all_outlined,
            filled: true,
            onTap: _copy,
          ),
          secondary: _SheetButton(
            label: '换个动作',
            icon: Icons.refresh,
            onTap: _backToMenu,
          ),
        ),
      ],
    );
  }

  Widget _errorView() {
    return Column(
      children: [
        Expanded(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.cloud_off_outlined, size: 26, color: Color(0xFF5C6675)),
                  const SizedBox(height: 12),
                  Text(
                    _error ?? '出错了，再试一次。',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 13, height: 1.5, color: Color(Env.muted)),
                  ),
                ],
              ),
            ),
          ),
        ),
        _footer(
          primary: _SheetButton(
            label: '重试',
            icon: Icons.refresh,
            filled: true,
            onTap: _action == null ? null : () => _run(_action!),
          ),
          secondary: _SheetButton(label: '返回', onTap: _backToMenu),
        ),
      ],
    );
  }

  Widget _footer({required Widget primary, required Widget secondary}) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 18),
      child: Row(
        children: [
          Expanded(child: secondary),
          const SizedBox(width: 10),
          Expanded(child: primary),
        ],
      ),
    );
  }
}

class _SheetButton extends StatelessWidget {
  const _SheetButton({
    required this.label,
    required this.onTap,
    this.icon,
    this.filled = false,
  });

  final String label;
  final VoidCallback? onTap;
  final IconData? icon;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: onTap,
      child: Container(
        height: 42,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: filled ? const Color(0x1F8AB4F8) : const Color(Env.panel),
          borderRadius: BorderRadius.circular(10),
          border: filled ? Border.all(color: const Color(0x4D8AB4F8)) : null,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (icon != null) ...[
              Icon(
                icon,
                size: 16,
                color: filled ? const Color(Env.blue) : const Color(Env.muted),
              ),
              const SizedBox(width: 6),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: enabled
                    ? (filled ? const Color(Env.blue) : const Color(Env.text))
                    : const Color(0xFF5C6675),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
