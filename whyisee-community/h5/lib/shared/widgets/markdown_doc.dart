import 'dart:async';

import 'package:material_ui/material_ui.dart';

import 'markdown_spans.dart';

/// 正文块的类型。
///
/// 列表/标题/引用这些在飞书里是「段落属性」，不是文本内容 —— 这里同理：
/// 用户永远打不出也看不到 `#` `-` `>`，它们只存在于落库的 Markdown 里。
enum MdBlockType { paragraph, h1, h2, h3, h4, bullet, ordered, quote, code, divider }

/// 一个可编辑的块。
///
/// 每个块自带 controller 和 focusNode：中文输入法在多个输入框之间切换比在
/// 一个巨型输入框里做「视觉替换」可靠得多 —— 后者要伪造字符宽度，光标位置
/// 迟早对不上。
class MdBlock {
  MdBlock({required this.type, String text = ''})
      : editing = MarkdownEditingController(
          text: '${MdBlock.sentinel}$text',
          hideMarkers: true,
        ) {
    // 新建块的光标默认落在末尾（拆块时会再被设到开头）
    editing.selection = TextSelection.collapsed(offset: MdBlock.sentinel.length + text.length);
  }

  /// 行首哨兵（零宽空格）。
  ///
  /// 软键盘在「文本已经为空」时按退格**不产生任何事件**：引擎收到
  /// deleteSurroundingText 后看到删除区间是空的就直接 return，onChanged
  /// 不会触发 —— 所以「退格删掉上一块」在纯文本输入框里根本感知不到。
  ///
  /// 每块开头放一个零宽字符，退格会把它吃掉：文本真的变短了，事件就来了。
  /// 它不占宽度、不算字数、不进 Markdown，只在 controller 里存在。
  static const String sentinel = '\u200B';

  MdBlockType type;

  /// 块内的行内语法（`**`、`` ` ``）仍在文本里，只是渲染时隐藏成零宽，
  /// 所以 controller 的字符索引永远是自洽的。
  final MarkdownEditingController editing;

  final FocusNode focus = FocusNode();

  /// 块正文：剥掉行首哨兵
  String get text {
    final raw = editing.text;
    return raw.isEmpty ? '' : raw.replaceAll(sentinel, '');
  }

  /// 可见第 0 个字符在 controller 里的偏移（有哨兵时为 1）
  int get caretBase => editing.text.startsWith(sentinel) ? sentinel.length : 0;

  /// 光标在可见文本里的位置
  int get caret => editing.selection.baseOffset - caretBase;

  bool get isEmpty => text.trim().isEmpty;

  /// 整体重新赋值（自动补哨兵）。[caret] 是可见文本里的偏移。
  void setText(String value, {int? caret}) {
    final offset = caret ?? value.length;
    editing.value = TextEditingValue(
      text: '$sentinel$value',
      selection: TextSelection.collapsed(offset: sentinel.length + offset),
    );
  }

  /// 把光标放到可见文本的第 [offset] 个字符前
  void placeCaret(int offset) {
    final target = (caretBase + offset).clamp(0, editing.text.length);
    editing.selection = TextSelection.collapsed(offset: target);
  }

  /// 哨兵被退格吃掉了，补回来（光标位置不变）
  void ensureSentinel() {
    final raw = editing.text;
    if (raw.startsWith(sentinel)) return;
    final offset = editing.selection.baseOffset;
    editing.value = TextEditingValue(
      text: '$sentinel$raw',
      selection: TextSelection.collapsed(
        offset: (offset < 0 ? raw.length + sentinel.length : offset + sentinel.length),
      ),
    );
  }

  void dispose() {
    editing.dispose();
    focus.dispose();
  }
}

/// 正文文档：块列表是唯一真相，Markdown 是派生结果。
///
/// 只有离开编辑器（提交、存草稿）时才序列化，编辑过程中不做字符串往返 ——
/// 往返一次就可能把用户打的空行吃掉。
class MarkdownDocController extends ChangeNotifier {
  MarkdownDocController({String markdown = ''}) {
    load(markdown);
  }

  final List<MdBlock> blocks = [];

  /// 整篇是否没有任何内容
  bool get isEmpty => blocks.every((block) => block.isEmpty);

  /// 正文字数：`**`、`` ` `` 这类行内标记不算字，否则加粗一下数字就跳
  int get charCount => blocks.fold<int>(0, (sum, block) => sum + _visibleLength(block.text));

  /// 标题以外是否已有内容 —— 判断「是不是刚开的新文档」
  bool get isBlank => blocks.length == 1 && blocks.first.isEmpty;

  // ------------------------------------------------------------------ 读写

  void load(String markdown) {
    for (final block in blocks) {
      block.dispose();
    }
    blocks
      ..clear()
      ..addAll(parseMarkdown(markdown));
    if (blocks.isEmpty) blocks.add(MdBlock(type: MdBlockType.paragraph));
    notifyListeners();
  }

  String get markdown {
    final lines = <String>[];
    var orderedIndex = 0;

    for (final block in blocks) {
      switch (block.type) {
        case MdBlockType.h1:
          lines.add('# ${block.text}');
        case MdBlockType.h2:
          lines.add('## ${block.text}');
        case MdBlockType.h3:
          lines.add('### ${block.text}');
        case MdBlockType.h4:
          lines.add('#### ${block.text}');
        case MdBlockType.bullet:
          lines.add('- ${block.text}');
        case MdBlockType.ordered:
          // 序号不进文本，序列化时按连续的有序块重排，插删行不会错号
          orderedIndex += 1;
          lines.add('$orderedIndex. ${block.text}');
        case MdBlockType.quote:
          lines.add('> ${block.text}');
        case MdBlockType.code:
          lines.add('```\n${block.text}\n```');
        case MdBlockType.divider:
          lines.add('---');
        case MdBlockType.paragraph:
          lines.add(block.text);
      }
      if (block.type != MdBlockType.ordered) orderedIndex = 0;
    }

    return lines.join('\n');
  }

  // ------------------------------------------------------------------ 结构

  int indexOf(MdBlock block) => blocks.indexOf(block);

  /// 在 [block] 之后插入新块，返回它（列表和引用要延续同类型）
  MdBlock insertAfter(MdBlock block, {MdBlockType? type, String text = ''}) {
    final next = MdBlock(type: type ?? block.type, text: text);
    final index = blocks.indexOf(block);
    blocks.insert(index < 0 ? blocks.length : index + 1, next);
    notifyListeners();
    return next;
  }

  /// 在 [offset] 处把一块拆成两块，返回后半截。
  ///
  /// [offset] 上的换行符属于分隔符，两边都不留 —— 否则每敲一次回车，
  /// 下一块开头就多一个看不见的空行。
  MdBlock splitAt(MdBlock block, int offset) {
    final text = block.text;
    final head = text.substring(0, offset);
    final tail = text.length > offset && text[offset] == '\n'
        ? text.substring(offset + 1)
        : text.substring(offset);

    block.setText(head, caret: head.length);

    // 空标题/空引用/空列表项再回车，就是「这一段写完了」，落回正文
    final tailEmpty = tail.trim().isEmpty;
    final nextType = switch (block.type) {
      MdBlockType.h1 ||
      MdBlockType.h2 ||
      MdBlockType.h3 ||
      MdBlockType.h4 =>
        MdBlockType.paragraph,
      MdBlockType.quote || MdBlockType.bullet || MdBlockType.ordered =>
        tailEmpty ? MdBlockType.paragraph : block.type,
      _ => block.type,
    };

    final next = insertAfter(block, type: nextType, text: tail);
    next.placeCaret(0);
    return next;
  }

  MdBlock appendBlock({MdBlockType type = MdBlockType.paragraph}) {
    final next = MdBlock(type: type);
    blocks.add(next);
    notifyListeners();
    return next;
  }

  void removeBlock(MdBlock block) {
    if (blocks.length <= 1) {
      // 最后一块删不掉，清空即可 —— 否则编辑器会变成一个白框
      block.setText('');
      block.type = MdBlockType.paragraph;
      notifyListeners();
      return;
    }
    final index = blocks.indexOf(block);
    if (index < 0) return;
    blocks.removeAt(index);
    _disposeLater(block);
    notifyListeners();
  }

  /// 把 [block] 并进上一块（行首按退格时用），返回应该接管光标的块。
  ///
  /// 这就是「删除上一块」：光标在块首按退格，整块并到上一块末尾；
  /// 空块按退格则是直接消失。
  MdBlock? mergeIntoPrevious(MdBlock block) {
    final index = blocks.indexOf(block);
    if (index <= 0) return null;

    final previous = blocks[index - 1];

    // 分割线没有正文，代码块边界有语义：都不合并，只删掉这一块
    if (previous.type == MdBlockType.divider || previous.type == MdBlockType.code) {
      blocks.removeAt(index);
      _disposeLater(block);
      notifyListeners();
      return previous.type == MdBlockType.code ? previous : (index - 2 >= 0 ? blocks[index - 2] : null);
    }

    final joinAt = previous.text.length;
    previous.setText(previous.text + block.text, caret: joinAt);
    blocks.removeAt(index);
    _disposeLater(block);
    notifyListeners();
    return previous;
  }

  /// 合并/删除往往发生在「某个块的 controller 正在 notifyListeners」的调用栈里，
  /// 当场 dispose 会改动正在遍历的监听器列表（Flutter 会断言失败），推迟一个微任务。
  void _disposeLater(MdBlock block) {
    scheduleMicrotask(block.dispose);
  }

  /// 有序列表的显示序号：从当前块往前数连续的有序块
  int orderedNumberAt(MdBlock block) {
    var count = 1;
    for (var i = blocks.indexOf(block) - 1; i >= 0; i--) {
      if (blocks[i].type != MdBlockType.ordered) break;
      count += 1;
    }
    return count;
  }

  /// 上下移动一块（[delta] = -1 上移 / +1 下移），返回是否真的动了
  bool moveBlock(MdBlock block, int delta) {
    final index = blocks.indexOf(block);
    if (index < 0) return false;
    final target = index + delta;
    if (target < 0 || target >= blocks.length) return false;
    blocks.removeAt(index);
    blocks.insert(target, block);
    notifyListeners();
    return true;
  }

  /// 复制一块插在它后面，返回副本
  MdBlock duplicateBlock(MdBlock block) {
    final copy = MdBlock(type: block.type, text: block.text);
    final index = blocks.indexOf(block);
    blocks.insert(index < 0 ? blocks.length : index + 1, copy);
    notifyListeners();
    return copy;
  }

  @override
  void dispose() {
    for (final block in blocks) {
      block.dispose();
    }
    blocks.clear();
    super.dispose();
  }
}

/// 去掉行内标记后的可见字数
int _visibleLength(String text) =>
    text.replaceAll(RegExp(r'\*\*|__|`|\*'), '').trim().length;

/// 带行内 Markdown 渲染的输入控制器。
///
/// `hideMarkers: true` 时 `**` 之类渲染成零宽透明字符 —— 视觉上不存在，
/// 但字符还在，所以光标索引、选区、复制出去的内容都是对的。
class MarkdownEditingController extends TextEditingController {
  MarkdownEditingController({super.text, this.hideMarkers = false});

  final bool hideMarkers;

  /// 超过这个长度就不上色：每帧逐行跑正则，几万字会明显拖慢输入
  static const int maxHighlightLength = 8000;

  @override
  TextSpan buildTextSpan({
    required BuildContext context,
    TextStyle? style,
    required bool withComposing,
  }) {
    final composing = value.composing;
    // 组词期间不动样式：中文候选框按原始文本排版，改字号字重会错位
    final isComposing =
        composing.isValid && composing.start >= 0 && composing.end > composing.start;
    final base = style ?? const TextStyle();

    if (isComposing || text.length > maxHighlightLength) {
      return super.buildTextSpan(context: context, style: style, withComposing: withComposing);
    }

    return TextSpan(
      style: base,
      children: markdownInlineSpans(text, base: base, hideMarkers: hideMarkers),
    );
  }
}

// ------------------------------------------------------------------ 解析

final _headingLine = RegExp(r'^(#{1,6})\s+(.*)$');
final _bulletLine = RegExp(r'^\s*[-*+]\s+(.*)$');
final _orderedLine = RegExp(r'^\s*\d+\.\s+(.*)$');
final _quoteLine = RegExp(r'^\s*>\s?(.*)$');
final _dividerLine = RegExp(r'^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$');

/// Markdown → 块。服务端存的正文、草稿、别人的帖子里粘来的内容都走这里。
List<MdBlock> parseMarkdown(String markdown) {
  final blocks = <MdBlock>[];
  if (markdown.trim().isEmpty) return blocks;

  final lines = markdown.split('\n');
  final codeBuffer = <String>[];
  var inCode = false;

  for (final line in lines) {
    if (line.trimLeft().startsWith('```')) {
      if (inCode) {
        blocks.add(MdBlock(type: MdBlockType.code, text: codeBuffer.join('\n')));
        codeBuffer.clear();
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeBuffer.add(line);
      continue;
    }

    if (_dividerLine.hasMatch(line)) {
      blocks.add(MdBlock(type: MdBlockType.divider));
      continue;
    }

    final heading = _headingLine.firstMatch(line);
    if (heading != null) {
      final level = heading.group(1)!.length;
      blocks.add(
        MdBlock(
          type: switch (level) {
            1 => MdBlockType.h1,
            2 => MdBlockType.h2,
            3 => MdBlockType.h3,
            // h5/h6 收成 h4：社区正文用不到 5 级以上，多留两级只会让工具条变长
            _ => MdBlockType.h4,
          },
          text: heading.group(2)!,
        ),
      );
      continue;
    }

    final quote = _quoteLine.firstMatch(line);
    if (quote != null) {
      blocks.add(MdBlock(type: MdBlockType.quote, text: quote.group(1)!));
      continue;
    }

    final bullet = _bulletLine.firstMatch(line);
    if (bullet != null) {
      blocks.add(MdBlock(type: MdBlockType.bullet, text: bullet.group(1)!));
      continue;
    }

    final ordered = _orderedLine.firstMatch(line);
    if (ordered != null) {
      blocks.add(MdBlock(type: MdBlockType.ordered, text: ordered.group(1)!));
      continue;
    }

    blocks.add(MdBlock(type: MdBlockType.paragraph, text: line));
  }

  if (inCode) {
    blocks.add(MdBlock(type: MdBlockType.code, text: codeBuffer.join('\n')));
  }
  return blocks;
}
