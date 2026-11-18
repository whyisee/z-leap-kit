import 'package:material_ui/material_ui.dart';

import '../../core/env.dart';
import 'markdown_doc.dart';

export 'markdown_doc.dart';

/// 手机端 Markdown 正文编辑器。
///
/// 交互照飞书文档来：**看到的永远是排版结果，看不到 `#` `-` `>`**。
///
/// 做法不是「把符号变透明」，而是把正文拆成块 —— 标题、列表、引用、代码块
/// 都是块属性，符号根本不存在于文本里。行内的 `**` 还在（拆不掉，拆了就断词），
/// 但渲染成零宽透明字符，视觉上同样不存在。
///
/// 为什么不做成一个大 TextField 里隐藏符号：那需要在渲染时删字符，而光标位置
/// 是按字符索引算的，删一个 `#` 光标就偏一位、选区就错位；块模型不存在这个矛盾。
/// 每个块是一个独立输入框，中文输入法也只在单块内组词，不会跨块错乱。
class MarkdownEditor extends StatefulWidget {
  const MarkdownEditor({
    super.key,
    required this.controller,
    this.enabled = true,
    this.hintText = '写正文…',
  });

  final MarkdownDocController controller;
  final bool enabled;
  final String hintText;

  @override
  State<MarkdownEditor> createState() => _MarkdownEditorState();
}

class _MarkdownEditorState extends State<MarkdownEditor> {
  final _scroll = ScrollController();

  /// 焦点监听只挂一次：拆分/合并会反复走 _attachFocus，重复挂会重复 setState
  final _focusHooked = <MdBlock>{};
  MdBlock? _focused;

  /// 程序自己改文本（拆块、转块型）时不要再走一遍「用户输入」的处理链
  bool _mutating = false;

  MarkdownDocController get _doc => widget.controller;

  @override
  void initState() {
    super.initState();
    _doc.addListener(_onDocMutated);
    _attachFocus(_doc.blocks.first);
  }

  @override
  void dispose() {
    _doc.removeListener(_onDocMutated);
    _scroll.dispose();
    super.dispose();
  }

  void _onDocMutated() {
    if (mounted) setState(() {});
  }

  void _attachFocus(MdBlock block) {
    if (!_focusHooked.add(block)) return;
    block.focus.addListener(() {
      if (block.focus.hasFocus && mounted) {
        setState(() => _focused = block);
      }
    });
  }

  // ---------------------------------------------------------------- 文本事件

  /// 块内文本变了：先处理换行拆块，再处理行首语法转块型
  void _onBlockTextChanged(MdBlock block) {
    if (_mutating || !mounted) return;

    _mutating = true;
    MdBlock last;
    try {
      last = _normalize(block);
    } finally {
      _mutating = false;
    }

    // 焦点跟到新块：只在真的拆出东西时才跳，否则会把光标从当前行拽走
    if (last != block) _focusBlock(last, atStart: true);
    setState(() {});
  }

  /// 把一块里的换行全部拆成新块，再校正各块的行首语法。
  ///
  /// 粘贴多行 Markdown 也走这里 —— `# 标题\n- 一条\n正文` 一次就能拆成三块。
  MdBlock _normalize(MdBlock block) {
    var current = block;
    var guard = 0;

    while (guard++ < 200) {
      // 代码块里的回车就是换行，不拆
      if (current.type == MdBlockType.code) break;
      final breakIndex = current.text.indexOf('\n');
      if (breakIndex < 0) break;

      final next = _doc.splitAt(current, breakIndex);
      _attachFocus(next);
      _applyPrefix(current);
      current = next;
    }

    _applyPrefix(current);
    return current;
  }

  /// 行首打 `# ` 就变标题，`- ` 变列表 —— 和飞书一致，符号不进文本
  bool _applyPrefix(MdBlock block) {
    // 代码块里 `# ` 是注释，不能当标题转
    if (block.type == MdBlockType.code) return false;

    final text = block.text;
    final (MdBlockType, String)? converted = _matchPrefix(text);
    if (converted == null) return false;

    final (type, rest) = converted;
    block.type = type;
    block.editing.value = TextEditingValue(
      text: rest,
      selection: TextSelection.collapsed(offset: rest.length),
    );
    return true;
  }

  (MdBlockType, String)? _matchPrefix(String text) {
    final heading = RegExp(r'^(#{1,6})\s(.*)$').firstMatch(text);
    if (heading != null) {
      return (
        switch (heading.group(1)!.length) {
          1 => MdBlockType.h1,
          2 => MdBlockType.h2,
          _ => MdBlockType.h3,
        },
        heading.group(2)!,
      );
    }

    if (text.startsWith('```')) {
      final rest = text.substring(3).trimLeft();
      return (MdBlockType.code, rest);
    }

    final bullet = RegExp(r'^[-*+]\s(.*)$').firstMatch(text);
    if (bullet != null) return (MdBlockType.bullet, bullet.group(1)!);

    final ordered = RegExp(r'^\d+\.\s(.*)$').firstMatch(text);
    if (ordered != null) return (MdBlockType.ordered, ordered.group(1)!);

    final quote = RegExp(r'^>\s?(.*)$').firstMatch(text);
    if (quote != null && text.startsWith('>')) return (MdBlockType.quote, quote.group(1)!);

    return null;
  }

  // ---------------------------------------------------------------- 焦点

  void _focusBlock(MdBlock block, {bool atStart = false}) {
    _attachFocus(block);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      block.focus.requestFocus();
      final text = block.text;
      block.editing.selection = TextSelection.collapsed(offset: atStart ? 0 : text.length);
      setState(() => _focused = block);
    });
  }

  // ---------------------------------------------------------------- 工具栏

  MdBlock get _activeBlock {
    final focused = _focused;
    if (focused != null && _doc.blocks.contains(focused)) return focused;
    return _doc.blocks.last;
  }

  void _toggleType(MdBlockType type) {
    final block = _activeBlock;
    setState(() {
      block.type = block.type == type ? MdBlockType.paragraph : type;
    });
    block.focus.requestFocus();
  }

  void _wrapSelection(String token) {
    final block = _activeBlock;
    final controller = block.editing;
    final text = controller.text;
    var selection = controller.selection;
    if (!selection.isValid) selection = TextSelection.collapsed(offset: text.length);

    final selected = text.substring(selection.start, selection.end);
    final next = text.replaceRange(selection.start, selection.end, '$token$selected$token');
    final caret = selection.start + token.length;

    controller.value = TextEditingValue(
      text: next,
      selection: TextSelection(baseOffset: caret, extentOffset: caret + selected.length),
    );
    block.focus.requestFocus();
  }

  void _insertDivider() {
    final block = _activeBlock;
    final divider = _doc.insertAfter(block, type: MdBlockType.divider);
    final next = _doc.insertAfter(divider, type: MdBlockType.paragraph);
    _attachFocus(next);
    _focusBlock(next, atStart: true);
  }

  // ---------------------------------------------------------------- 渲染

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: ListView.builder(
            controller: _scroll,
            padding: const EdgeInsets.fromLTRB(16, 6, 16, 96),
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            itemCount: _doc.blocks.length,
            itemBuilder: (context, index) {
              final block = _doc.blocks[index];
              return _BlockField(
                key: ValueKey(block),
                block: block,
                doc: _doc,
                enabled: widget.enabled,
                hintText: _doc.isBlank ? widget.hintText : null,
                onChanged: () => _onBlockTextChanged(block),
              );
            },
          ),
        ),
        _Toolbar(
          enabled: widget.enabled,
          length: _doc.charCount,
          onHeading: () => _toggleType(MdBlockType.h2),
          onBold: () => _wrapSelection('**'),
          onBullet: () => _toggleType(MdBlockType.bullet),
          onQuote: () => _toggleType(MdBlockType.quote),
          onCode: () => _wrapSelection('`'),
          onCodeBlock: () => _toggleType(MdBlockType.code),
          onDivider: _insertDivider,
        ),
      ],
    );
  }

}

/// 单个块。样式由块类型决定 —— 这就是「看不到 #」的底气：
/// 标题靠字号表达，列表靠圆点表达，不靠文本里的符号。
class _BlockField extends StatefulWidget {
  const _BlockField({
    super.key,
    required this.block,
    required this.doc,
    required this.enabled,
    required this.hintText,
    required this.onChanged,
  });

  final MdBlock block;
  final MarkdownDocController doc;
  final bool enabled;
  final String? hintText;
  final VoidCallback onChanged;

  @override
  State<_BlockField> createState() => _BlockFieldState();
}

class _BlockFieldState extends State<_BlockField> {
  /// 已经处理过的文本，用来识别「文本没变、只是按了退格」这类情况
  String _lastText = '';

  @override
  void initState() {
    super.initState();
    _lastText = widget.block.text;
    widget.block.editing.addListener(_onChanged);
  }

  @override
  void dispose() {
    widget.block.editing.removeListener(_onChanged);
    super.dispose();
  }

  void _onChanged() {
    final text = widget.block.text;
    // 退格删到空不会改变「已经是空」的状态，这类操作在块模型里交给工具栏处理
    if (text == _lastText) return;
    _lastText = text;
    widget.onChanged();
  }

  @override
  Widget build(BuildContext context) {
    final block = widget.block;
    final field = TextField(
      controller: block.editing,
      focusNode: block.focus,
      enabled: widget.enabled,
      maxLines: null,
      minLines: 1,
      // 一律 multiline：多行输入框用 TextInputAction.newline + TextInputType.text
      // 会被 TextField 断言拦下；回车由我们自己拆块
      keyboardType: TextInputType.multiline,
      textInputAction: TextInputAction.newline,
      // 光标高度跟着块类型走：行内符号被渲染成 0.1px，不指定的话
      // 光标落在隐藏的 `**` 上会缩成一条线
      cursorHeight: switch (block.type) {
        MdBlockType.h1 => 30,
        MdBlockType.h2 => 26,
        MdBlockType.h3 => 23,
        _ => 21,
      },
      style: _styleFor(block.type),
      decoration: InputDecoration(
        isDense: true,
        hintText: widget.hintText,
        hintStyle: const TextStyle(fontSize: 14, height: 1.75, color: Color(0xFF4A5462)),
        border: InputBorder.none,
        contentPadding: EdgeInsets.zero,
      ),
      // 点正文空白不该收键盘
      onTapOutside: (_) {},
    );

    return switch (block.type) {
      MdBlockType.h1 => Padding(
          padding: const EdgeInsets.only(top: 10, bottom: 4),
          child: field,
        ),
      MdBlockType.h2 => Padding(
          padding: const EdgeInsets.only(top: 8, bottom: 3),
          child: field,
        ),
      MdBlockType.h3 => Padding(
          padding: const EdgeInsets.only(top: 6, bottom: 2),
          child: field,
        ),
      MdBlockType.paragraph => Padding(
          padding: const EdgeInsets.symmetric(vertical: 1),
          child: field,
        ),
      MdBlockType.bullet => _MarkerRow(
          marker: '•',
          markerTop: 3,
          child: Padding(padding: const EdgeInsets.symmetric(vertical: 1), child: field),
        ),
      MdBlockType.ordered => _MarkerRow(
          marker: '${widget.doc.orderedNumberAt(block)}.',
          markerTop: 3,
          child: Padding(padding: const EdgeInsets.symmetric(vertical: 1), child: field),
        ),
      MdBlockType.quote => Container(
          margin: const EdgeInsets.symmetric(vertical: 3),
          padding: const EdgeInsets.only(left: 10),
          decoration: const BoxDecoration(
            border: Border(left: BorderSide(color: Color(0x558AB4F8), width: 3)),
          ),
          child: field,
        ),
      MdBlockType.code => Container(
          margin: const EdgeInsets.symmetric(vertical: 4),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: const Color(0x14FFFFFF),
            borderRadius: BorderRadius.circular(8),
          ),
          child: field,
        ),
      MdBlockType.divider => _DividerBlock(
          onRemove: () => widget.doc.removeBlock(block),
        ),
    };
  }

  TextStyle _styleFor(MdBlockType type) => switch (type) {
        MdBlockType.h1 => const TextStyle(
            fontSize: 23,
            height: 1.45,
            fontWeight: FontWeight.w700,
            color: Color(Env.text),
          ),
        MdBlockType.h2 => const TextStyle(
            fontSize: 19.5,
            height: 1.5,
            fontWeight: FontWeight.w700,
            color: Color(Env.text),
          ),
        MdBlockType.h3 => const TextStyle(
            fontSize: 17,
            height: 1.5,
            fontWeight: FontWeight.w600,
            color: Color(Env.text),
          ),
        MdBlockType.quote => const TextStyle(
            fontSize: 15,
            height: 1.75,
            color: Color(0xFF9AA5B4),
            fontStyle: FontStyle.italic,
          ),
        MdBlockType.code => const TextStyle(
            fontSize: 13.5,
            height: 1.7,
            color: Color(0xFFBFD9AE),
            fontFamily: 'monospace',
            fontFamilyFallback: ['Menlo', 'Roboto Mono', 'monospace'],
          ),
        _ => const TextStyle(fontSize: 15, height: 1.75, color: Color(Env.text)),
      };
}

/// 列表行：圆点/序号在左边，输入框占其余宽度
class _MarkerRow extends StatelessWidget {
  const _MarkerRow({required this.marker, required this.markerTop, required this.child});

  final String marker;
  final double markerTop;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 20,
          child: Padding(
            padding: EdgeInsets.only(top: markerTop),
            child: Text(
              marker,
              style: const TextStyle(
                fontSize: 15,
                height: 1.75,
                fontWeight: FontWeight.w700,
                color: Color(0xFF7FB3FF),
              ),
            ),
          ),
        ),
        Expanded(child: child),
      ],
    );
  }
}

class _DividerBlock extends StatelessWidget {
  const _DividerBlock({required this.onRemove});

  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onRemove,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Container(height: 1, color: const Color(Env.line)),
      ),
    );
  }
}

class _Toolbar extends StatelessWidget {
  const _Toolbar({
    required this.enabled,
    required this.length,
    required this.onHeading,
    required this.onBold,
    required this.onBullet,
    required this.onQuote,
    required this.onCode,
    required this.onCodeBlock,
    required this.onDivider,
  });

  final bool enabled;
  final int length;
  final VoidCallback onHeading;
  final VoidCallback onBold;
  final VoidCallback onBullet;
  final VoidCallback onQuote;
  final VoidCallback onCode;
  final VoidCallback onCodeBlock;
  final VoidCallback onDivider;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 44,
      padding: const EdgeInsets.only(left: 4, right: 12),
      decoration: const BoxDecoration(
        color: Color(Env.bg),
        border: Border(top: BorderSide(color: Color(Env.line), width: 1)),
      ),
      child: Row(
        children: [
          _ToolButton(icon: Icons.title, tooltip: '标题', onTap: enabled ? onHeading : null),
          _ToolButton(icon: Icons.format_bold, tooltip: '加粗', onTap: enabled ? onBold : null),
          _ToolButton(
            icon: Icons.format_list_bulleted,
            tooltip: '列表',
            onTap: enabled ? onBullet : null,
          ),
          _ToolButton(icon: Icons.format_quote, tooltip: '引用', onTap: enabled ? onQuote : null),
          _ToolButton(icon: Icons.code, tooltip: '行内代码', onTap: enabled ? onCode : null),
          _ToolButton(
            icon: Icons.data_object,
            tooltip: '代码块',
            onTap: enabled ? onCodeBlock : null,
          ),
          _ToolButton(
            icon: Icons.horizontal_rule,
            tooltip: '分割线',
            onTap: enabled ? onDivider : null,
          ),
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
