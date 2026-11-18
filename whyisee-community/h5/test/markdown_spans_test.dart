import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:whyisee_app/shared/widgets/markdown_spans.dart';

/// 这套解析有一个硬不变量：**编辑态拼回来的字符必须和原文一模一样**。
/// 少一个字符光标就会偏，所以这里逐字符比对，不是「大致看着对」。
void main() {
  const base = TextStyle(fontSize: 15);

  String flatten(List<InlineSpan> spans) {
    final buffer = StringBuffer();
    for (final span in spans) {
      if (span is TextSpan) {
        if (span.text != null) buffer.write(span.text);
        if (span.children != null) buffer.write(flatten(span.children!));
      }
    }
    return buffer.toString();
  }

  const source = '''
## 小标题

这是一段**加粗**和`行内代码`还有[链接](https://whyisee.xyz)。

- 第一项
- 第二项
1. 有序项

> 引用一段话

```dart
final a = 1;
```

---
''';

  test('编辑态：字符一个不少，顺序不变', () {
    final spans = markdownSpans(source, base: base, showSyntax: true);
    expect(flatten(spans), source);
  });

  test('预览态：语法符号全部隐藏', () {
    final visible = flatten(markdownSpans(source, base: base, showSyntax: false));

    expect(visible.contains('##'), isFalse);
    expect(visible.contains('**'), isFalse);
    expect(visible.contains('`'), isFalse);
    expect(visible.contains('```'), isFalse);
    expect(visible.contains('](http'), isFalse);
    // 内容本身留着
    expect(visible.contains('小标题'), isTrue);
    expect(visible.contains('加粗'), isTrue);
    expect(visible.contains('第一项'), isTrue);
    expect(visible.contains('final a = 1;'), isTrue);
    // 无序列表换成圆点
    expect(visible.contains('• 第一项'), isTrue);
  });

  test('标题按级别放大，加粗真的加粗', () {
    final spans = markdownSpans('## 二级\n\n普通**重**点', base: base, showSyntax: false);

    TextStyle? styleOf(String text) {
      for (final span in spans) {
        if (span is TextSpan && span.text == text) return span.style;
      }
      return null;
    }

    final heading = styleOf('二级');
    expect(heading?.fontSize, greaterThan(15));
    expect(heading?.fontWeight, FontWeight.w700);

    expect(styleOf('重')?.fontWeight, FontWeight.w700);
    expect(styleOf('普通')?.fontWeight, isNot(FontWeight.w700));
  });

  test('空正文不产出 span，也不会崩', () {
    expect(markdownSpans('', base: base, showSyntax: true), isEmpty);
  });
}
