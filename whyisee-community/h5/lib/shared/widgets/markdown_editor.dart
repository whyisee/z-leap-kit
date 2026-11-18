import 'package:material_ui/material_ui.dart';

import '../../core/env.dart';
import 'markdown_spans.dart';

/// 带 Markdown 样式的输入控制器。
///
/// 输入法组词（composing）期间必须回退成默认样式：中文候选词还在 composition
/// 里时改字号字重，候选框会和实际文本对不齐，看起来像光标乱跳。
class MarkdownEditingController extends TextEditingController {
  MarkdownEditingController({super.text});

  /// 超过这个长度就不上色：每帧逐行跑正则，几万字会明显拖慢输入
  static const int maxHighlightLength = 8000;

  @override
  TextSpan buildTextSpan({
    required BuildContext context,
    TextStyle? style,
    required bool withComposing,
  }) {
    final composing = value.composing;
    final isComposing =
        composing.isValid && composing.start >= 0 && composing.end > composing.start;
    final base = style ?? const TextStyle();

    if (isComposing || text.length > maxHighlightLength) {
      return super.buildTextSpan(context: context, style: style, withComposing: withComposing);
    }

    return TextSpan(style: base, children: markdownSpans(text, base: base, showSyntax: true));
  }
}

/// 手机端 Markdown 正文编辑器。
///
/// 不引入 flutter_quill / appflowy_editor 这类富文本引擎：它们存的是自己的
/// 文档模型（delta / 节点树），落库前还得转回 Markdown，转出来和网页端
/// 编辑器渲染的结果对不上。这里直接编辑 Markdown 源文：
///
/// - 编辑态看到的已经是排好版的样子 —— 标题变大加粗、`**` 之类的符号淡成背景，
///   不需要在心里把源码翻译一遍；
/// - 点工具条右侧的眼睛切预览，符号完全隐藏，看到的就是发出去的效果；
/// - 「选中文字点按钮」比在手机上打 `**` 现实得多，这是唯一真需要帮的部分。
class MarkdownEditor extends StatefulWidget {
  const MarkdownEditor({
    super.key,
    required this.controller,
    this.focusNode,
    this.hintText = '写正文…',
    this.enabled = true,
    this.onChanged,
  });

  final MarkdownEditingController controller;
  final FocusNode? focusNode;
  final String hintText;
  final bool enabled;
  final ValueChanged<String>? onChanged;

  @override
  State<MarkdownEditor> createState() => _MarkdownEditorState();
}

class _MarkdownEditorState extends State<MarkdownEditor> {
  final _ownFocus = FocusNode();
  bool _preview = false;

  FocusNode get _focus => widget.focusNode ?? _ownFocus;

  MarkdownEditingController get _controller => widget.controller;

  @override
  void initState() {
    super.initState();
    // 工具条右侧要显示字数，所以自己听一次变化，不依赖外部 rebuild
    _controller.addListener(_onTextChanged);
  }

  @override
  void dispose() {
    _controller.removeListener(_onTextChanged);
    _ownFocus.dispose();
    super.dispose();
  }

  void _onTextChanged() {
    if (mounted) setState(() {});
  }

  TextSelection get _selection {
    final selection = _controller.selection;
    final length = _controller.text.length;
    if (!selection.isValid) return TextSelection.collapsed(offset: length);
    return TextSelection(
      baseOffset: selection.start.clamp(0, length),
      extentOffset: selection.end.clamp(0, length),
    );
  }

  void _togglePreview() {
    if (!_preview) FocusScope.of(context).unfocus();
    setState(() => _preview = !_preview);
  }

  /// 包裹型：`**粗体**`、`` `代码` ``
  void _wrap(String token) {
    final text = _controller.text;
    final selection = _selection;
    final selected = text.substring(selection.start, selection.end);
    final next = text.replaceRange(selection.start, selection.end, '$token$selected$token');

    final caret = selection.start + token.length;
    _controller.value = TextEditingValue(
      text: next,
      selection: TextSelection(baseOffset: caret, extentOffset: caret + selected.length),
    );
    _focus.requestFocus();
  }

  /// 行首型：`## `、`- `、`> `。已经带了就取消，来回点不会越点越长。
  void _toggleLinePrefix(String prefix) {
    final text = _controller.text;
    final selection = _selection;
    final lineStart = selection.start == 0 ? 0 : text.lastIndexOf('\n', selection.start - 1) + 1;

    if (text.startsWith(prefix, lineStart)) {
      final next = text.replaceRange(lineStart, lineStart + prefix.length, '');
      final caret = (selection.start - prefix.length).clamp(lineStart, lineStart + 1);
      _controller.value = TextEditingValue(
        text: next,
        selection: TextSelection.collapsed(offset: caret),
      );
    } else {
      final next = text.replaceRange(lineStart, lineStart, prefix);
      _controller.value = TextEditingValue(
        text: next,
        selection: TextSelection.collapsed(offset: selection.start + prefix.length),
      );
    }
    _focus.requestFocus();
  }

  /// 代码块：单独一行，光标落在空行里，省得用户自己数反引号
  void _insertCodeBlock() {
    final text = _controller.text;
    final selection = _selection;
    const block = '```\n\n```';
    final needsBreak = selection.start > 0 && text[selection.start - 1] != '\n';
    final payload = '${needsBreak ? '\n' : ''}$block';
    final next = text.replaceRange(selection.start, selection.end, payload);
    final caret = selection.start + payload.length - 4;

    _controller.value = TextEditingValue(
      text: next,
      selection: TextSelection.collapsed(offset: caret),
    );
    _focus.requestFocus();
  }

  void _insertDivider() {
    final text = _controller.text;
    final selection = _selection;
    const divider = '\n\n---\n\n';
    final next = text.replaceRange(selection.start, selection.end, divider);

    _controller.value = TextEditingValue(
      text: next,
      selection: TextSelection.collapsed(offset: selection.start + divider.length),
    );
    _focus.requestFocus();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: _preview
              ? _MarkdownPreview(text: _controller.text)
              : TextField(
                  controller: _controller,
                  focusNode: _focus,
                  enabled: widget.enabled,
                  maxLines: null,
                  expands: true,
                  textAlignVertical: TextAlignVertical.top,
                  keyboardType: TextInputType.multiline,
                  textCapitalization: TextCapitalization.sentences,
                  style: const TextStyle(fontSize: 15, height: 1.75, color: Color(Env.text)),
                  onChanged: widget.onChanged,
                  // 点工具条不该收起键盘：M3 默认点外部就 unfocus，这里关掉
                  onTapOutside: (_) {},
                  decoration: InputDecoration(
                    hintText: widget.hintText,
                    hintStyle: const TextStyle(fontSize: 14, height: 1.75, color: Color(0xFF4A5462)),
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                  ),
                ),
        ),
        _Toolbar(
          preview: _preview,
          enabled: widget.enabled,
          length: _controller.text.trim().length,
          onTogglePreview: _togglePreview,
          onBold: () => _wrap('**'),
          onCode: () => _wrap('`'),
          onHeading: () => _toggleLinePrefix('## '),
          onList: () => _toggleLinePrefix('- '),
          onQuote: () => _toggleLinePrefix('> '),
          onCodeBlock: _insertCodeBlock,
          onDivider: _insertDivider,
        ),
      ],
    );
  }
}

/// 预览态：符号全部隐藏，只读。
class _MarkdownPreview extends StatelessWidget {
  const _MarkdownPreview({required this.text});

  final String text;

  static const _base = TextStyle(fontSize: 15, height: 1.78, color: Color(Env.text));

  @override
  Widget build(BuildContext context) {
    if (text.trim().isEmpty) {
      return const Padding(
        padding: EdgeInsets.fromLTRB(16, 16, 16, 0),
        child: Text(
          '还没有内容。回到编辑写一点，这里显示发出去的样子。',
          style: TextStyle(fontSize: 13, height: 1.7, color: Color(0xFF5F6875)),
        ),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      child: SelectableText.rich(
        TextSpan(style: _base, children: markdownSpans(text, base: _base, showSyntax: false)),
      ),
    );
  }
}

class _Toolbar extends StatelessWidget {
  const _Toolbar({
    required this.preview,
    required this.enabled,
    required this.length,
    required this.onTogglePreview,
    required this.onBold,
    required this.onCode,
    required this.onHeading,
    required this.onList,
    required this.onQuote,
    required this.onCodeBlock,
    required this.onDivider,
  });

  final bool preview;
  final bool enabled;
  final int length;
  final VoidCallback onTogglePreview;
  final VoidCallback onBold;
  final VoidCallback onCode;
  final VoidCallback onHeading;
  final VoidCallback onList;
  final VoidCallback onQuote;
  final VoidCallback onCodeBlock;
  final VoidCallback onDivider;

  @override
  Widget build(BuildContext context) {
    final canEdit = enabled && !preview;

    return Container(
      height: 44,
      padding: const EdgeInsets.only(left: 4, right: 12),
      decoration: const BoxDecoration(
        color: Color(Env.bg),
        border: Border(top: BorderSide(color: Color(Env.line), width: 1)),
      ),
      child: Row(
        children: [
          if (preview)
            Expanded(
              child: Row(
                children: [
                  _ToolButton(
                    icon: Icons.edit_outlined,
                    tooltip: '回到编辑',
                    onTap: enabled ? onTogglePreview : null,
                  ),
                  const Text(
                    '预览（只读）',
                    style: TextStyle(fontSize: 11.5, color: Color(0xFF5F6875)),
                  ),
                ],
              ),
            )
          else ...[
            _ToolButton(
              icon: Icons.title,
              tooltip: '小标题',
              onTap: canEdit ? onHeading : null,
            ),
            _ToolButton(icon: Icons.format_bold, tooltip: '加粗', onTap: canEdit ? onBold : null),
            _ToolButton(
              icon: Icons.format_list_bulleted,
              tooltip: '列表',
              onTap: canEdit ? onList : null,
            ),
            _ToolButton(
              icon: Icons.format_quote,
              tooltip: '引用',
              onTap: canEdit ? onQuote : null,
            ),
            _ToolButton(icon: Icons.code, tooltip: '行内代码', onTap: canEdit ? onCode : null),
            _ToolButton(
              icon: Icons.data_object,
              tooltip: '代码块',
              onTap: canEdit ? onCodeBlock : null,
            ),
            _ToolButton(
              icon: Icons.horizontal_rule,
              tooltip: '分割线',
              onTap: canEdit ? onDivider : null,
            ),
            // 字数占掉剩余空间：窄屏挤压时先压它，不挤按钮
            Expanded(
              child: Align(
                alignment: Alignment.centerRight,
                child: Text(
                  length > 0 ? '$length 字' : '',
                  maxLines: 1,
                  softWrap: false,
                  overflow: TextOverflow.fade,
                  style: const TextStyle(fontSize: 11, color: Color(0xFF5F6875)),
                ),
              ),
            ),
            _ToolButton(
              icon: Icons.visibility_outlined,
              tooltip: '预览效果',
              onTap: enabled ? onTogglePreview : null,
            ),
          ],
        ],
      ),
    );
  }
}

class _ToolButton extends StatelessWidget {
  const _ToolButton({required this.icon, required this.tooltip, required this.onTap});

  final IconData icon;
  final String tooltip;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: InkResponse(
        onTap: onTap,
        radius: 20,
        child: SizedBox(
          width: 38,
          height: 44,
          child: Icon(
            icon,
            size: 19,
            color: onTap == null ? const Color(0xFF3D4551) : const Color(0xFF9AA5B4),
          ),
        ),
      ),
    );
  }
}
