import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:whyisee_app/shared/widgets/markdown_editor.dart';

/// Markdown 工具条的核心承诺：改的是光标/选区处的内容，光标还在原地。
/// 这类偏移计算最容易写错一位，所以单独锁一遍。
void main() {
  testWidgets('选中文字点加粗：包裹选区，光标仍框住原文字', (tester) async {
    final controller = MarkdownEditingController(text: '这是一段正文内容');
    addTearDown(controller.dispose);

    await _pump(tester, controller);
    controller.selection = const TextSelection(baseOffset: 2, extentOffset: 4);
    await tester.pump();

    await tester.tap(find.byTooltip('加粗'));
    await tester.pump();

    expect(controller.text, '这是**一段**正文内容');
    expect(controller.selection.baseOffset, 4);
    expect(controller.selection.extentOffset, 6);
  });

  testWidgets('没选中就点加粗：插入成对标记，光标落在中间', (tester) async {
    final controller = MarkdownEditingController(text: '开头');
    addTearDown(controller.dispose);

    await _pump(tester, controller);
    controller.selection = const TextSelection.collapsed(offset: 2);
    await tester.pump();

    await tester.tap(find.byTooltip('加粗'));
    await tester.pump();

    expect(controller.text, '开头****');
    expect(controller.selection.baseOffset, 4);
  });

  testWidgets('列表前缀可以反复点：加上、去掉', (tester) async {
    final controller = MarkdownEditingController(text: '第一行\n第二行');
    addTearDown(controller.dispose);

    await _pump(tester, controller);
    // 光标放在第二行中间
    controller.selection = const TextSelection.collapsed(offset: 5);
    await tester.pump();

    await tester.tap(find.byTooltip('列表'));
    await tester.pump();
    expect(controller.text, '第一行\n- 第二行');

    await tester.tap(find.byTooltip('列表'));
    await tester.pump();
    expect(controller.text, '第一行\n第二行');
  });

  testWidgets('空正文不显示字数，写了才显示', (tester) async {
    final controller = MarkdownEditingController();
    addTearDown(controller.dispose);

    await _pump(tester, controller);
    expect(find.text('0 字'), findsNothing);

    await tester.enterText(find.byType(TextField), '一二三四五');
    await tester.pump();
    expect(find.text('5 字'), findsOneWidget);
  });

  testWidgets('切预览：输入框让位给只读渲染，符号消失', (tester) async {
    final controller = MarkdownEditingController(text: '## 标题\n\n正文**重点**');
    addTearDown(controller.dispose);

    await _pump(tester, controller);
    expect(find.byType(TextField), findsOneWidget);
    expect(find.byType(SelectableText), findsNothing);

    await tester.tap(find.byTooltip('预览效果'));
    await tester.pumpAndSettle();

    expect(find.byType(TextField), findsNothing);
    expect(find.byType(SelectableText), findsOneWidget);
    // 预览是只读的，源文不能被改掉
    expect(controller.text, '## 标题\n\n正文**重点**');
    expect(find.textContaining('##'), findsNothing);

    // 回来还能继续写
    await tester.tap(find.byTooltip('回到编辑'));
    await tester.pumpAndSettle();
    expect(find.byType(TextField), findsOneWidget);
  });
}

Future<void> _pump(WidgetTester tester, MarkdownEditingController controller) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: MarkdownEditor(controller: controller),
      ),
    ),
  );
  await tester.pump();
}
