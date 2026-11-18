import 'package:material_ui/material_ui.dart';

/// Markdown 源文 → 带样式的 TextSpan。
///
/// 一套解析、两种输出：
///
/// - `showSyntax: true`（编辑态）：**绝不增删字符**。每个字符都必须按原顺序
///   出现在某一个 span 里，语法符号只做颜色淡化。光标位置是按字符索引算的，
///   少输出一个 `#` 光标就偏一位，删掉 `**` 选区就会跳。
/// - `showSyntax: false`（预览态）：只读、没有光标，可以自由替换字符 ——
///   `## ` 直接不显示，`- ` 换成 `• `，``` 围栏整行丢掉。
///
/// 深浅色都只吃传入的 `base`，不自己写死主题色，换主题不用改这里。
List<InlineSpan> markdownSpans(
  String source, {
  required TextStyle base,
  required bool showSyntax,
}) {
  if (source.isEmpty) return const [];

  final spans = <InlineSpan>[];
  final lines = source.split('\n');
  var inFence = false;

  for (var i = 0; i < lines.length; i++) {
    final line = lines[i];

    if (line.trimLeft().startsWith('```')) {
      inFence = !inFence;
      if (showSyntax) {
        spans.add(TextSpan(text: line, style: _syntax(base)));
        if (i < lines.length - 1) spans.add(TextSpan(text: '\n', style: base));
      }
      // 预览态：围栏行整行不输出，连换行也不补 —— 上下两行本来是相邻的
      continue;
    }

    if (inFence) {
      spans.add(
        TextSpan(
          text: showSyntax ? line : (line.trim().isEmpty ? ' ' : line),
          style: base.copyWith(
            fontFamily: 'monospace',
            fontFamilyFallback: const ['Menlo', 'Roboto Mono', 'monospace'],
            color: const Color(0xFFBFD9AE),
            backgroundColor: const Color(0x12FFFFFF),
            height: 1.65,
          ),
        ),
      );
    } else {
      spans.addAll(_lineSpans(line, base, showSyntax));
    }

    if (i < lines.length - 1) spans.add(TextSpan(text: '\n', style: base));
  }

  return spans;
}

/// 行级：分割线 / 标题 / 引用 / 列表
List<InlineSpan> _lineSpans(String line, TextStyle base, bool showSyntax) {
  if (line.trim().isEmpty) {
    return [TextSpan(text: showSyntax ? line : '', style: base)];
  }

  if (_dividerPattern.hasMatch(line)) {
    return [
      TextSpan(
        text: showSyntax ? line : '─' * 26,
        style: _syntax(base).copyWith(letterSpacing: showSyntax ? 0 : 1.5),
      ),
    ];
  }

  final heading = _headingPattern.firstMatch(line);
  if (heading != null) {
    final level = heading.group(1)!.length;
    final size = switch (level) {
      1 => 23.0,
      2 => 19.5,
      3 => 17.0,
      _ => 15.5,
    };
    final headStyle = base.copyWith(
      fontSize: size,
      fontWeight: FontWeight.w700,
      height: 1.45,
      letterSpacing: 0.2,
    );

    return [
      if (showSyntax)
        TextSpan(
          text: heading.group(1)! + heading.group(2)!,
          style: _syntax(base).copyWith(fontSize: size, height: 1.45),
        ),
      ..._inlineSpans(heading.group(3)!, headStyle, showSyntax),
    ];
  }

  final quote = _quotePattern.firstMatch(line);
  if (quote != null) {
    final quoteStyle = base.copyWith(color: const Color(0xFF8E97A4), fontStyle: FontStyle.italic);
    return [
      if (showSyntax)
        TextSpan(text: quote.group(1)!, style: _syntax(base))
      else
        // 预览态没有 `>`，用缩进保住「这段是引用的」这个视觉信号
        TextSpan(text: '  ', style: quoteStyle),
      ..._inlineSpans(quote.group(2)!, quoteStyle, showSyntax),
    ];
  }

  final bullet = _bulletPattern.firstMatch(line);
  if (bullet != null) {
    final marker = bullet.group(2)!;
    final ordered = marker.endsWith('.');
    final markerStyle = base.copyWith(
      color: const Color(0xFF7FB3FF),
      fontWeight: FontWeight.w700,
    );

    return [
      if (showSyntax) ...[
        TextSpan(text: bullet.group(1)!, style: base),
        TextSpan(text: marker + bullet.group(3)!, style: markerStyle),
      ] else
        TextSpan(
          text: bullet.group(1)! + (ordered ? '$marker ' : '• '),
          style: markerStyle,
        ),
      ..._inlineSpans(bullet.group(4)!, base, showSyntax),
    ];
  }

  return _inlineSpans(line, base, showSyntax);
}

/// 行内：加粗 / 斜体 / 行内代码 / 链接。
///
/// [hideMarkers] 为 true 时把 `**`、`` ` `` 这类标记渲染成**零宽透明字符**：
/// 视觉上完全不存在，但字符仍在（所以光标索引和选区都没问题）。块编辑器用它。
/// 为 false 时符号淡化显示，给「整段源码高亮」用。
List<InlineSpan> markdownInlineSpans(
  String text, {
  required TextStyle base,
  bool hideMarkers = false,
}) =>
    _inlineCore(text, base, marker: hideMarkers ? _hidden : _syntax(base));

/// 整段解析用：`showSyntax` 决定符号是淡化还是彻底不输出。
List<InlineSpan> _inlineSpans(String text, TextStyle base, bool showSyntax) =>
    _inlineCore(text, base, marker: showSyntax ? _syntax(base) : null);

/// [marker] 为 null 表示标记不输出（只读预览，没有光标，可以自由删字符）。
List<InlineSpan> _inlineCore(String text, TextStyle base, {required TextStyle? marker}) {
  if (text.isEmpty) return const [];

  final spans = <InlineSpan>[];
  var cursor = 0;

  void pushMarker(String token) {
    if (marker != null) spans.add(TextSpan(text: token, style: marker));
  }

  for (final match in _inlinePattern.allMatches(text)) {
    if (match.start > cursor) {
      spans.add(TextSpan(text: text.substring(cursor, match.start), style: base));
    }
    cursor = match.end;

    final bold = match.group(2);
    if (bold != null) {
      pushMarker(match.group(1)!);
      spans.add(TextSpan(text: bold, style: base.copyWith(fontWeight: FontWeight.w700)));
      pushMarker(match.group(1)!);
      continue;
    }

    final code = match.group(3);
    if (code != null) {
      pushMarker('`');
      spans.add(
        TextSpan(
          text: code,
          style: base.copyWith(
            fontFamily: 'monospace',
            fontFamilyFallback: const ['Menlo', 'Roboto Mono', 'monospace'],
            color: const Color(0xFFBFD9AE),
            backgroundColor: const Color(0x12FFFFFF),
          ),
        ),
      );
      pushMarker('`');
      continue;
    }

    final italic = match.group(4);
    if (italic != null) {
      pushMarker('*');
      spans.add(TextSpan(text: italic, style: base.copyWith(fontStyle: FontStyle.italic)));
      pushMarker('*');
      continue;
    }

    final label = match.group(5);
    final url = match.group(6);
    if (label != null && url != null) {
      pushMarker('[');
      spans.add(
        TextSpan(
          text: label,
          style: base.copyWith(
            color: const Color(0xFF8AB4F8),
            decoration: TextDecoration.underline,
            decorationColor: const Color(0x558AB4F8),
          ),
        ),
      );
      if (marker == null) {
        // 只读预览：网址留成小字尾巴，知道指向哪就行
        spans.add(TextSpan(text: ' $url', style: _syntax(base).copyWith(fontSize: (base.fontSize ?? 15) - 2)));
      } else {
        pushMarker(']($url)');
      }
    }
  }

  if (cursor < text.length) {
    spans.add(TextSpan(text: text.substring(cursor), style: base));
  }
  return spans;
}

/// 零宽隐藏：0.1px 的透明字符，占宽几乎为 0，视觉上等于不存在。
/// 不能直接删字符 —— 删了光标位置就和文本对不上了。
const _hidden = TextStyle(fontSize: 0.1, color: Color(0x00000000), letterSpacing: 0);

TextStyle _syntax(TextStyle base) => base.copyWith(
      color: const Color(0xFF4E5764),
      fontWeight: FontWeight.w400,
      fontStyle: FontStyle.normal,
    );

final _dividerPattern = RegExp(r'^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$');
final _headingPattern = RegExp(r'^(#{1,6})(\s+)(.*)$');
final _quotePattern = RegExp(r'^((?:>\s?)+)(.*)$');

/// 列表项单独匹配：行首 `- ` / `* ` / `1. `，缩进也算进来（嵌套列表靠它保视觉层级）
final _bulletPattern = RegExp(r'^(\s*)([-*+]|\d+\.)(\s+)(.*)$');

final _inlinePattern = RegExp(
  r'(\*\*|__)(.+?)\1' // 1,2 加粗
  r'|`([^`\n]+)`' // 3 行内代码
  r'|\*([^*\n]+)\*' // 4 斜体
  r'|\[([^\]\n]+)\]\(([^)\n]+)\)', // 5,6 链接
);
