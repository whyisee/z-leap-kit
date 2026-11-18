import 'package:material_ui/material_ui.dart';

import 'markdown_spans.dart';

/// 正文块的类型。
///
/// 列表/标题/引用这些在飞书里是「段落属性」，不是文本内容 —— 这里同理：
/// 用户永远打不出也看不到 `#` `-` `>`，它们只存在于落库的 Markdown 里。
enum MdBlockType { paragraph, h1, h2, h3, bullet, ordered, quote, code, divider }

/// 一个可编辑的块。
///
/// 每个块自带 controller 和 focusNode：中文输入法在多个输入框之间切换比在
/// 一个巨型输入框里做「视觉替换」可靠得多 —— 后者要伪造字符宽度，光标位置
/// 迟早对不上。
class MdBlock {
  MdBlock({required this.type, String text = ''})
      : editing = MarkdownEditingController(text: text, hideMarkers: true) {
    // 新建块的光标默认落在末尾（拆块时会再被设到开头）
    editing.selection = TextSelection.collapsed(offset: text.length);
  }

  MdBlockType type;

  /// 块内的行内语法（`**`、`` ` ``）仍在文本里，只是渲染时隐藏成零宽，
  /// 所以 controller 的字符索引永远是自洽的。
  final MarkdownEditingController editing;

  final FocusNode focus = FocusNode();

  String get text => editing.text;

  bool get isEmpty => text.trim().isEmpty;

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

    block.editing.value = TextEditingValue(
      text: head,
      selection: TextSelection.collapsed(offset: head.length),
    );

    // 空标题/空引用再回车，就是「这一节写完了」，落回正文
    final nextType = switch (block.type) {
      MdBlockType.h1 || MdBlockType.h2 || MdBlockType.h3 => MdBlockType.paragraph,
      MdBlockType.quote when tail.trim().isEmpty => MdBlockType.paragraph,
      _ => block.type,
    };

    final next = insertAfter(block, type: nextType, text: tail);
    next.editing.selection = const TextSelection.collapsed(offset: 0);
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
      block.editing.clear();
      block.type = MdBlockType.paragraph;
      notifyListeners();
      return;
    }
    final index = blocks.indexOf(block);
    if (index < 0) return;
    blocks.removeAt(index);
    block.dispose();
    notifyListeners();
  }

  /// 把 [block] 并进上一块（退格到空块行首时用），返回上一块
  MdBlock? mergeIntoPrevious(MdBlock block) {
    final index = blocks.indexOf(block);
    if (index <= 0) return null;

    final previous = blocks[index - 1];
    // 引用/代码这类块边界有语义，不合并，只删空块
    if (previous.type == MdBlockType.code || previous.type == MdBlockType.divider) {
      removeBlock(block);
      return previous;
    }

    final joined = previous.text + block.text;
    previous.editing.value = TextEditingValue(
      text: joined,
      selection: TextSelection.collapsed(offset: previous.text.length),
    );
    blocks.removeAt(index);
    block.dispose();
    notifyListeners();
    return previous;
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
            _ => MdBlockType.h3,
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
