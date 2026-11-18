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

  /// 块内文本变了：先处理「行首退格」，再处理换行拆块与行首语法转块型。
  ///
  /// [deletedFromStart] 由输入框判断（见 `_BlockFieldState._onChanged`）：
  /// 软键盘在空文本上按退格不会触发任何事件，只能靠行首哨兵被吃掉来间接得知。
  void _onBlockTextChanged(MdBlock block, {bool deletedFromStart = false}) {
    if (_mutating || !mounted) return;

    MdBlock? target;
    var atStart = false;
    var merged = false;

    _mutating = true;
    try {
      final hasSentinel = block.editing.text.startsWith(MdBlock.sentinel);

      if (!hasSentinel && deletedFromStart) {
        // 光标在块首按了退格：整块并进上一块，空块就是直接消失
        merged = true;
        target = _doc.mergeIntoPrevious(block);
        // 第一块没有上一块可并，把哨兵补回来、光标留在原地
        if (target == null) block.ensureSentinel();
      } else {
        // 粘贴、程序替换整段文本时哨兵会没了，补回来再走常规流程
        if (!hasSentinel) block.ensureSentinel();
        final last = _normalize(block);
        if (last != block) {
          target = last;
          atStart = true;
        }
      }
    } finally {
      _mutating = false;
    }

    if (target != null) {
      if (atStart) {
        _focusBlock(target, atStart: true);
      } else {
        // 合并后光标停在拼接处，别把它拽到行尾
        _focusExisting(target);
      }
    } else if (merged) {
      block.placeCaret(0);
    }
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
    block.setText(rest, caret: rest.length);
    return true;
  }

  (MdBlockType, String)? _matchPrefix(String text) {
    final heading = RegExp(r'^(#{1,6})\s(.*)$').firstMatch(text);
    if (heading != null) {
      return (
        switch (heading.group(1)!.length) {
          1 => MdBlockType.h1,
          2 => MdBlockType.h2,
          3 => MdBlockType.h3,
          _ => MdBlockType.h4,
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
      block.placeCaret(atStart ? 0 : block.text.length);
      setState(() => _focused = block);
    });
  }

  /// 只把焦点移过去，不动光标 —— 合并块时用户的光标应该停在拼接点
  void _focusExisting(MdBlock block) {
    _attachFocus(block);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_doc.blocks.contains(block)) return;
      block.focus.requestFocus();
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
    final text = block.text;
    final selection = block.editing.selection;

    // 选区一律按「可见文本」算：controller 前面还有行首哨兵，直接拿索引会差一位
    final start = selection.isValid ? selection.start - block.caretBase : text.length;
    final end = selection.isValid ? selection.end - block.caretBase : text.length;
    final from = start.clamp(0, text.length);
    final to = end.clamp(from, text.length);

    final selected = text.substring(from, to);
    final next = text.replaceRange(from, to, '$token$selected$token');
    final caret = from + token.length;
    block.setText(next, caret: caret);
    // 加粗后仍框住原文，接着按别的按钮能叠加
    block.editing.selection = TextSelection(
      baseOffset: block.caretBase + caret,
      extentOffset: block.caretBase + caret + selected.length,
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

  // ---------------------------------------------------------------- 块菜单

  /// 「⋮」图标在每种块里的顶部偏移：让图标和正文首行视觉对齐
  double _handleTop(MdBlockType type) => switch (type) {
        MdBlockType.h1 => 16,
        MdBlockType.h2 => 13,
        MdBlockType.h3 => 11,
        MdBlockType.h4 => 9,
        MdBlockType.quote || MdBlockType.code => 8,
        _ => 6,
      };

  /// 点块首「⋮」：先收键盘（否则弹层只有半屏），再弹块菜单
  Future<void> _openBlockMenu(MdBlock block) async {
    FocusScope.of(context).unfocus();
    final result = await showModalBottomSheet<(_BlockOp, MdBlockType?)>(
      context: context,
      // 默认最高只有 9/16 屏，三组 chip 放不下；内容本身不高，放开限制即可
      isScrollControlled: true,
      backgroundColor: const Color(0xFF171C24),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => _BlockMenu(block: block),
    );
    if (!mounted || result == null || !_doc.blocks.contains(block)) return;
    _applyBlockOp(block, result.$1, result.$2);
  }

  void _applyBlockOp(MdBlock block, _BlockOp op, MdBlockType? type) {
    final index = _doc.indexOf(block);

    switch (op) {
      case _BlockOp.convert:
        if (type != null) setState(() => block.type = type);
        break;
      case _BlockOp.moveUp:
        _doc.moveBlock(block, -1);
        break;
      case _BlockOp.moveDown:
        _doc.moveBlock(block, 1);
        break;
      case _BlockOp.duplicate:
        final copy = _doc.duplicateBlock(block);
        setState(() {});
        _focusExisting(copy);
        return;
      case _BlockOp.delete:
        _doc.removeBlock(block);
        setState(() {});
        // 删掉之后光标落到上一块（第一块就落到剩下的第一块）
        final next = index > 0 && index - 1 < _doc.blocks.length
            ? _doc.blocks[index - 1]
            : _doc.blocks.first;
        _focusExisting(next);
        return;
    }

    setState(() {});
    _focusExisting(block);
  }

  // ---------------------------------------------------------------- 渲染

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: ListView.builder(
            controller: _scroll,
            padding: const EdgeInsets.fromLTRB(2, 6, 16, 96),
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            itemCount: _doc.blocks.length,
            itemBuilder: (context, index) {
              final block = _doc.blocks[index];
              return _BlockRow(
                key: ValueKey(block),
                handleTop: _handleTop(block.type),
                onMenu: () => _openBlockMenu(block),
                child: _BlockField(
                  block: block,
                  doc: _doc,
                  enabled: widget.enabled,
                  hintText: _doc.isBlank ? widget.hintText : null,
                  onChanged: (deletedFromStart) =>
                      _onBlockTextChanged(block, deletedFromStart: deletedFromStart),
                ),
              );
            },
          ),
        ),
        _Toolbar(
          enabled: widget.enabled,
          length: _doc.charCount,
          currentType: _activeBlock.type,
          onHeading: _toggleType,
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

/// 块菜单里的操作。块模型能做的事都从这一个入口走，后面加功能只加枚举。
enum _BlockOp { convert, moveUp, moveDown, duplicate, delete }

/// 块的左边界：一个「⋮」入口 + 正文。
///
/// 入口用 Stack 叠在正文左侧，不占正文宽度、不影响行高 —— 直接塞进 Row 的话，
/// 图标高度会把单行块撑高，段落之间的空隙就变大了。
class _BlockRow extends StatelessWidget {
  const _BlockRow({
    super.key,
    required this.handleTop,
    required this.onMenu,
    required this.child,
  });

  /// 图标距块顶的偏移，按块型给，让图标和首行文字视觉对齐
  final double handleTop;
  final VoidCallback onMenu;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Padding(padding: const EdgeInsets.only(left: 26), child: child),
        Positioned(
          left: 0,
          top: 0,
          bottom: 0,
          width: 26,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onMenu,
            child: Align(
              alignment: Alignment.topCenter,
              child: Padding(
                padding: EdgeInsets.only(top: handleTop),
                child: const Icon(
                  Icons.more_vert,
                  size: 16,
                  color: Color(0xFF4A5462),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// 块菜单：换块型 / 上移下移 / 复制 / 删除。
///
/// 用底部弹层而不是贴着「⋮」的浮层：键盘弹起时贴边浮层只剩半屏，
/// 底部弹层会自己让开键盘，而且以后加功能（转成图片、加注释…）往下堆就行。
class _BlockMenu extends StatelessWidget {
  const _BlockMenu({required this.block});

  final MdBlock block;

  /// (块类型, 标签, 预览字号)
  static const _headings = <(MdBlockType, String, double)>[
    (MdBlockType.paragraph, '正文', 15),
    (MdBlockType.h1, 'T1', 19),
    (MdBlockType.h2, 'T2', 17),
    (MdBlockType.h3, 'T3', 15.5),
    (MdBlockType.h4, 'T4', 14),
  ];

  void _pick(BuildContext context, _BlockOp op, [MdBlockType? type]) =>
      Navigator.pop(context, (op, type));

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 14),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFF2C343F),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const _MenuLabel('标题'),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final (type, label, size) in _headings)
                  _MenuChip(
                    label: label,
                    fontSize: size,
                    selected: block.type == type,
                    onTap: () => _pick(context, _BlockOp.convert, type),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            const _MenuLabel('块类型'),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final (type, label) in _blockKinds)
                  _MenuChip(
                    label: label,
                    fontSize: 13,
                    selected: block.type == type,
                    onTap: () => _pick(context, _BlockOp.convert, type),
                  ),
              ],
            ),
            const SizedBox(height: 18),
            Row(
              children: [
                _ActionTile(
                  icon: Icons.arrow_upward,
                  label: '上移',
                  onTap: () => _pick(context, _BlockOp.moveUp),
                ),
                _ActionTile(
                  icon: Icons.arrow_downward,
                  label: '下移',
                  onTap: () => _pick(context, _BlockOp.moveDown),
                ),
                _ActionTile(
                  icon: Icons.copy_all_outlined,
                  label: '复制',
                  onTap: () => _pick(context, _BlockOp.duplicate),
                ),
                _ActionTile(
                  icon: Icons.delete_outline,
                  label: '删除',
                  danger: true,
                  onTap: () => _pick(context, _BlockOp.delete),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  static const _blockKinds = <(MdBlockType, String)>[
    (MdBlockType.bullet, '无序列表'),
    (MdBlockType.ordered, '有序列表'),
    (MdBlockType.quote, '引用'),
    (MdBlockType.code, '代码块'),
  ];
}

class _MenuLabel extends StatelessWidget {
  const _MenuLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(fontSize: 11, letterSpacing: 0.4, color: Color(0xFF6B7686)),
    );
  }
}

class _MenuChip extends StatelessWidget {
  const _MenuChip({
    required this.label,
    required this.fontSize,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final double fontSize;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 38,
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: selected ? const Color(0x338AB4F8) : const Color(0x12FFFFFF),
          borderRadius: BorderRadius.circular(9),
          border: Border.all(
            color: selected ? const Color(0x998AB4F8) : const Color(0x1AFFFFFF),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: fontSize,
            height: 1.2,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            color: selected ? const Color(0xFFBFD6FF) : const Color(0xFFDCE3ED),
          ),
        ),
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.danger = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final color = danger ? const Color(0xFFE06C6C) : const Color(0xFF9AA5B4);
    return Expanded(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 3),
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(
            color: const Color(0x12FFFFFF),
            borderRadius: BorderRadius.circular(9),
          ),
          child: Column(
            children: [
              Icon(icon, size: 18, color: color),
              const SizedBox(height: 4),
              Text(label, style: TextStyle(fontSize: 11, color: color)),
            ],
          ),
        ),
      ),
    );
  }
}

/// 单个块。样式由块类型决定 —— 这就是「看不到 #」的底气：
/// 标题靠字号表达，列表靠圆点表达，不靠文本里的符号。
class _BlockField extends StatefulWidget {
  const _BlockField({
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

  /// [deletedFromStart]：这次变化是不是「从块首往回删」
  final ValueChanged<bool> onChanged;

  @override
  State<_BlockField> createState() => _BlockFieldState();
}

class _BlockFieldState extends State<_BlockField> {
  /// 上一次的原始文本（含行首哨兵），用来识别「行首退格」
  String _lastRaw = '';

  @override
  void initState() {
    super.initState();
    _lastRaw = widget.block.editing.text;
    widget.block.editing.addListener(_onChanged);
  }

  @override
  void dispose() {
    widget.block.editing.removeListener(_onChanged);
    super.dispose();
  }

  void _onChanged() {
    final raw = widget.block.editing.text;
    if (raw == _lastRaw) return;

    // 行首退格的判据：哨兵没了，且剩下的文本正好是删之前文本的后缀。
    // 只判「哨兵没了」不够 —— 粘贴、整段替换也会没；只判前后缀也不够 ——
    // 末尾删掉一个重复字符（`**` → `*`）会误判成行首删除。
    final deletedFromStart = !raw.startsWith(MdBlock.sentinel) &&
        _lastRaw.startsWith(MdBlock.sentinel) &&
        raw.length < _lastRaw.length &&
        _lastRaw.endsWith(raw);

    _lastRaw = raw;
    widget.onChanged(deletedFromStart);
  }

  @override
  Widget build(BuildContext context) {
    final block = widget.block;
    Widget field = TextField(
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
        MdBlockType.h4 => 22,
        _ => 21,
      },
      style: _styleFor(block.type),
      decoration: const InputDecoration(
        isDense: true,
        border: InputBorder.none,
        contentPadding: EdgeInsets.zero,
      ),
      // 点正文空白不该收键盘
      onTapOutside: (_) {},
    );

    // 块里始终有一个零宽哨兵，TextField 自己的 hint 永远不会显示（文本不算空），
    // 所以提示语自己叠一层
    if (widget.hintText != null && block.text.isEmpty) {
      field = Stack(
        fit: StackFit.passthrough,
        children: [
          field,
          Positioned(
            left: 0,
            top: 1,
            right: 0,
            child: IgnorePointer(
              child: Text(
                widget.hintText!,
                style: const TextStyle(fontSize: 14, height: 1.75, color: Color(0xFF4A5462)),
              ),
            ),
          ),
        ],
      );
    }

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
      MdBlockType.h4 => Padding(
          padding: const EdgeInsets.only(top: 5, bottom: 1),
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
        MdBlockType.h4 => const TextStyle(
            fontSize: 15.5,
            height: 1.55,
            fontWeight: FontWeight.w600,
            color: Color(0xFFDCE3ED),
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
    required this.currentType,
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

  /// 光标所在块的类型：标题菜单要标出当前是几级
  final MdBlockType currentType;
  final ValueChanged<MdBlockType> onHeading;
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
          _HeadingButton(current: currentType, enabled: enabled, onPick: onHeading),
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

/// 标题级别按钮：点开悬浮菜单选「正文 / T1–T4」。
///
/// 直接在工具条上摆四个 T 会把工具条撑爆，所以收进一个菜单里；
/// 菜单项按各自字号显示预览字，选之前就能看出层级差别。
class _HeadingButton extends StatelessWidget {
  const _HeadingButton({required this.current, required this.enabled, required this.onPick});

  final MdBlockType current;
  final bool enabled;
  final ValueChanged<MdBlockType> onPick;

  /// (块类型, 标签, 预览字号, 字重)
  static const _levels = <(MdBlockType, String, double, FontWeight)>[
    (MdBlockType.paragraph, '正文', 15, FontWeight.w400),
    (MdBlockType.h1, 'T1', 21, FontWeight.w700),
    (MdBlockType.h2, 'T2', 18, FontWeight.w700),
    (MdBlockType.h3, 'T3', 16, FontWeight.w600),
    (MdBlockType.h4, 'T4', 14.5, FontWeight.w600),
  ];

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<MdBlockType>(
      enabled: enabled,
      tooltip: '标题级别',
      // 工具条贴在屏幕底部：菜单要往上弹，否则一屏放不下
      position: PopupMenuPosition.over,
      offset: const Offset(0, -6),
      padding: EdgeInsets.zero,
      color: const Color(0xFF1B222C),
      elevation: 14,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      constraints: const BoxConstraints(minWidth: 172),
      onSelected: onPick,
      itemBuilder: (context) => [
        for (final (type, label, size, weight) in _levels)
          PopupMenuItem<MdBlockType>(
            value: type,
            height: 40,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  width: 26,
                  child: Text(
                    label,
                    style: const TextStyle(fontSize: 11, color: Color(0xFF7C8798)),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  '标题文字',
                  style: TextStyle(
                    fontSize: size,
                    fontWeight: weight,
                    height: 1.2,
                    color: const Color(Env.text),
                  ),
                ),
                const SizedBox(width: 12),
                if (current == type)
                  const Icon(Icons.check, size: 15, color: Color(0xFF8AB4F8))
                else
                  const SizedBox(width: 15),
              ],
            ),
          ),
      ],
      child: SizedBox(
        width: 38,
        height: 44,
        child: Icon(
          Icons.title,
          size: 19,
          color: enabled ? const Color(0xFF9AA5B4) : const Color(0xFF3D4551),
        ),
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
