import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:whyisee_app/shared/widgets/markdown_editor.dart';
import 'package:whyisee_app/shared/widgets/markdown_spans.dart';

/// 块编辑器要锁住的行为：
/// 1. 打 `# ` 变标题块 —— 符号不进文本；
/// 2. 回车拆块，正文变两个段落；
/// 3. 工具栏按钮改块型，不往文本里塞符号；
/// 4. 行内 `**` 渲染成零宽，但字符还在（拼回来仍等于原文）；
/// 5. 390 宽下不溢出。
void main() {
  testWidgets('打「# 」直接变标题，文本里没有井号', (tester) async {
    final doc = await _pump(tester);

    await tester.enterText(find.byType(TextField).first, '# ');
    await tester.pumpAndSettle();

    expect(doc.blocks.first.type, MdBlockType.h1);
    expect(doc.blocks.first.text, '');
    // 用户继续打字，落库时才会被加上 #
    await tester.enterText(find.byType(TextField).first, '章节名');
    await tester.pumpAndSettle();
    expect(doc.markdown, '# 章节名');
  });

  testWidgets('打「- 」变列表，打「> 」变引用', (tester) async {
    final doc = await _pump(tester);

    await tester.enterText(find.byType(TextField).first, '- ');
    await tester.pumpAndSettle();
    expect(doc.blocks.first.type, MdBlockType.bullet);

    await tester.enterText(find.byType(TextField).first, '> ');
    await tester.pumpAndSettle();
    expect(doc.blocks.first.type, MdBlockType.quote);
  });

  testWidgets('回车拆块：一段变两段', (tester) async {
    final doc = await _pump(tester);

    await tester.enterText(find.byType(TextField).first, '第一段\n第二段');
    await tester.pumpAndSettle();

    expect(doc.blocks.length, 2);
    expect(doc.blocks[0].text, '第一段');
    expect(doc.blocks[1].text, '第二段');
    expect(doc.blocks[1].type, MdBlockType.paragraph);
  });

  testWidgets('标题块回车，下一块落回正文', (tester) async {
    final doc = await _pump(tester);

    await tester.enterText(find.byType(TextField).first, '# 标题\n');
    await tester.pumpAndSettle();

    expect(doc.blocks.length, 2);
    expect(doc.blocks[0].type, MdBlockType.h1);
    expect(doc.blocks[1].type, MdBlockType.paragraph);
  });

  testWidgets('工具栏点列表：改块型，不写符号', (tester) async {
    final doc = await _pump(tester);

    await tester.enterText(find.byType(TextField).first, '一条');
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('列表'));
    await tester.pumpAndSettle();

    expect(doc.blocks.first.type, MdBlockType.bullet);
    expect(doc.blocks.first.text, '一条');
    expect(doc.markdown, '- 一条');
  });

  testWidgets('加粗写的是零宽标记：字符还在，视觉上没有', (tester) async {
    final doc = await _pump(tester);

    await tester.enterText(find.byType(TextField).first, '重点');
    await tester.pumpAndSettle();

    final field = tester.widget<TextField>(find.byType(TextField).first);
    final controller = field.controller!;
    // controller 前面有一个零宽哨兵，可见第 0 个字在偏移 1
    final base = doc.blocks.first.caretBase;
    controller.selection = TextSelection(baseOffset: base, extentOffset: base + 2);
    await tester.tap(find.byTooltip('加粗'));
    await tester.pumpAndSettle();

    expect(doc.blocks.first.text, '**重点**');
    // 渲染时 `**` 是 0.1px 透明字符，所以拼回来仍等于原文、光标索引也不会偏
    final spans = markdownInlineSpans(
      doc.blocks.first.text,
      base: const TextStyle(fontSize: 15),
      hideMarkers: true,
    );
    final markers = spans.whereType<TextSpan>().where((span) => span.text == '**');
    expect(markers, isNotEmpty);
    expect(markers.first.style?.fontSize, 0.1);
  });

  testWidgets('字数不含符号', (tester) async {
    final doc = await _pump(tester);

    await tester.enterText(find.byType(TextField).first, '一二三**四**');
    await tester.pumpAndSettle();

    // 7 个字符里 4 个星号是标记，字数只算「一二三四」
    expect(doc.charCount, 4);
    expect(find.text('4 字'), findsOneWidget);
  });

  testWidgets('空块上按退格：空块消失，光标回到上一块末尾', (tester) async {
    final doc = await _pump(tester);

    await tester.enterText(find.byType(TextField).first, '第一段\n');
    await tester.pumpAndSettle();
    expect(doc.blocks.length, 2);

    // 软键盘退格只会让 controller 的文本变短，这里就模拟「哨兵被吃掉」
    doc.blocks[1].editing.value = const TextEditingValue(
      text: '',
      selection: TextSelection.collapsed(offset: 0),
    );
    await tester.pumpAndSettle();

    expect(doc.blocks.length, 1);
    expect(doc.blocks.first.text, '第一段');
    expect(doc.blocks.first.caret, 3);
  });

  testWidgets('行首退格：整块并进上一块，不是只删一个字', (tester) async {
    final doc = await _pump(tester);

    await tester.enterText(find.byType(TextField).first, '上段\n下段');
    await tester.pumpAndSettle();
    expect(doc.blocks.length, 2);

    doc.blocks[1].editing.value = const TextEditingValue(
      text: '下段',
      selection: TextSelection.collapsed(offset: 0),
    );
    await tester.pumpAndSettle();

    expect(doc.blocks.length, 1);
    expect(doc.markdown, '上段下段');
  });

  testWidgets('第一块退格不会把内容吃掉', (tester) async {
    final doc = await _pump(tester);

    await tester.enterText(find.byType(TextField).first, '只有一段');
    await tester.pumpAndSettle();

    // 把哨兵删掉（等价于在第一块行首按退格）
    doc.blocks.first.editing.value = const TextEditingValue(
      text: '只有一段',
      selection: TextSelection.collapsed(offset: 0),
    );
    await tester.pumpAndSettle();

    expect(doc.blocks.length, 1);
    expect(doc.blocks.first.text, '只有一段');
    // 哨兵补回来了，下一次退格还能被感知
    expect(doc.blocks.first.editing.text.startsWith(MdBlock.sentinel), isTrue);
  });

  testWidgets('空列表项回车落回正文，不会困在列表里', (tester) async {
    final doc = await _pump(tester);

    await tester.enterText(find.byType(TextField).first, '- 一条\n');
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).at(1), '\n');
    await tester.pumpAndSettle();

    expect(doc.blocks.length, 3);
    expect(doc.blocks[2].type, MdBlockType.paragraph);
  });

  testWidgets('390 宽下渲染不溢出', (tester) async {
    await _pump(tester);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}

Future<MarkdownDocController> _pump(WidgetTester tester) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  final doc = MarkdownDocController();
  addTearDown(doc.dispose);

  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: MarkdownEditor(controller: doc),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return doc;
}
