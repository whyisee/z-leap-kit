import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:whyisee_app/shared/widgets/markdown_doc.dart';

/// 块 ↔ Markdown 的往返必须无损：服务端存的是 Markdown，编辑器里是块，
/// 两者一错位，用户存一次草稿正文就变形了。
void main() {
  test('解析：五种行级语法各自成块', () {
    final blocks = parseMarkdown('# 标题\n## 二级\n### 三级\n正文\n- 项\n1. 甲\n> 引用');

    expect(blocks.map((block) => block.type).toList(), [
      MdBlockType.h1,
      MdBlockType.h2,
      MdBlockType.h3,
      MdBlockType.paragraph,
      MdBlockType.bullet,
      MdBlockType.ordered,
      MdBlockType.quote,
    ]);
    // 符号必须是解析时被吃掉，不是留在文本里
    expect(blocks.first.text, '标题');
    expect(blocks[4].text, '项');
  });

  test('解析：代码块整段吞进去，内部的 # 不当标题', () {
    final blocks = parseMarkdown('```dart\n# 这是注释\nfinal a = 1;\n```');

    expect(blocks.length, 1);
    expect(blocks.first.type, MdBlockType.code);
    expect(blocks.first.text, '# 这是注释\nfinal a = 1;');
  });

  test('往返：常见正文一字不差', () {
    const source = '# 标题\n\n正文一段\n\n- 一条\n- 两条\n\n> 引用\n\n---';
    final doc = MarkdownDocController(markdown: source);

    expect(doc.markdown, source);
  });

  test('有序列表的号由结构生成，插行不会错号', () {
    final doc = MarkdownDocController(markdown: '1. 甲\n2. 乙');
    expect(doc.blocks.length, 2);

    doc.insertAfter(doc.blocks.first, text: '新插的');

    expect(doc.markdown, '1. 甲\n2. 新插的\n3. 乙');
  });

  test('拆块：后半截落到新块，光标停在开头', () {
    final doc = MarkdownDocController(markdown: '一二三四');
    final next = doc.splitAt(doc.blocks.first, 2);

    expect(doc.blocks.first.text, '一二');
    expect(next.text, '三四');
    expect(next.caret, 0);
  });

  test('行首退格：整块并进上一块，光标停在拼接处', () {
    final doc = MarkdownDocController(markdown: '第一段\n第二段');
    final second = doc.blocks[1];

    // 模拟软键盘吃掉行首哨兵（这就是「光标在块首按退格」在文本层的样子）
    second.editing.value = const TextEditingValue(
      text: '第二段',
      selection: TextSelection.collapsed(offset: 0),
    );
    expect(second.editing.text.startsWith(MdBlock.sentinel), isFalse);

    final target = doc.mergeIntoPrevious(second);

    expect(doc.blocks.length, 1);
    expect(target, same(doc.blocks.first));
    expect(doc.blocks.first.text, '第一段第二段');
    expect(doc.blocks.first.caret, 3);
  });

  test('空块退格：直接消失；第一块没有上一块可并', () {
    final doc = MarkdownDocController(markdown: '第一段\n');
    expect(doc.blocks.length, 2);

    expect(doc.mergeIntoPrevious(doc.blocks[1]), same(doc.blocks.first));
    expect(doc.blocks.length, 1);
    expect(doc.markdown, '第一段');

    // 第一块没有上一块：返回 null，由调用方把哨兵补回来
    expect(doc.mergeIntoPrevious(doc.blocks.first), isNull);
  });

  test('块正文不含行首哨兵，也不会写进 Markdown', () {
    final doc = MarkdownDocController(markdown: '正文');
    expect(doc.blocks.first.editing.text.startsWith(MdBlock.sentinel), isTrue);
    expect(doc.blocks.first.text, '正文');
    expect(doc.markdown, '正文');
    expect(doc.charCount, 2);
  });

  test('空正文也是合法的：至少留一个可编辑块', () {
    final doc = MarkdownDocController(markdown: '');
    expect(doc.blocks.length, 1);
    expect(doc.isBlank, isTrue);
    expect(doc.markdown, '');
  });

  test('行内标记不算字数', () {
    final doc = MarkdownDocController(markdown: '一二**三**`四`五');
    expect(doc.charCount, 5);
  });
}
