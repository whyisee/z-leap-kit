import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:whyisee_app/core/api/mention_repository.dart';
import 'package:whyisee_app/shared/widgets/markdown_editor.dart';
import 'package:whyisee_app/shared/widgets/mention_suggestions.dart';

/// 图片块与 `@` 候选的纯逻辑测试。
///
/// 不测「点相册」——那要走平台通道，在单测里只能造桩；真正要守住的是
/// 序列化往返（图不能丢）和触发判定（打邮箱不该弹候选）。
void main() {
  group('图片块', () {
    test('独占一行的图片解析成图片块，序列化原样回写', () {
      // 不写空行：块模型里空行就是空段落，测的是图片本身，别把两件事混在一起
      final doc = MarkdownDocController(markdown: '看图\n![](/uploads/2026/11/a.jpg)\n后面');

      expect(doc.blocks.map((b) => b.type), [
        MdBlockType.paragraph,
        MdBlockType.image,
        MdBlockType.paragraph,
      ]);
      expect(doc.blocks[1].text, '/uploads/2026/11/a.jpg');
      expect(doc.markdown, '看图\n![](/uploads/2026/11/a.jpg)\n后面');
    });

    test('行内图片留在段落里，不把一句话拆成三段', () {
      final doc = MarkdownDocController(markdown: '看我这张 ![x](/uploads/a.jpg) 帅不帅');

      expect(doc.blocks.length, 1);
      expect(doc.blocks.first.type, MdBlockType.paragraph);
    });

    test('图片块的地址不算正文字数，但算「有内容」', () {
      final doc = MarkdownDocController(markdown: '![](/uploads/2026/11/a.jpg)');

      expect(doc.charCount, 0);
      expect(doc.hasImage, isTrue);
      expect(doc.isEmpty, isFalse);
    });

    test('插入图片：落在指定块之后', () {
      final doc = MarkdownDocController(markdown: '第一段\n第二段');
      final image = doc.insertImageAfter(doc.blocks.first, '/uploads/x.png');

      expect(doc.blocks.map((b) => b.type), [
        MdBlockType.paragraph,
        MdBlockType.image,
        MdBlockType.paragraph,
      ]);
      expect(doc.blocks.indexOf(image), 1);
    });
  });

  group('@ 触发判定', () {
    test('行首、空白后、括号后都算', () {
      expect(mentionQueryAt('@', 1)?.query, '');
      expect(mentionQueryAt('你好 @zou', 7)?.query, 'zou');
      expect(mentionQueryAt('(@abc', 5)?.query, 'abc');
    });

    test('邮箱、词中间、已经空格的都不算', () {
      expect(mentionQueryAt('a@b.com', 7), isNull);
      expect(mentionQueryAt('你好@zou', 6), isNull);
      expect(mentionQueryAt('@zou 在吗', 7), isNull);
    });

    test('替换成 @username 并把光标放到空格后', () {
      const text = '谢谢 @zo';
      final trigger = mentionQueryAt(text, text.length)!;
      final result = applyMention(text, trigger, 'zoukehui');

      expect(result.text, '谢谢 @zoukehui ');
      expect(result.caret, result.text.length);
    });
  });

  group('编辑器里的 @ 候选', () {
    testWidgets('打 @ 弹出候选，点一个就写进正文', (tester) async {
      final doc = MarkdownDocController();

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SizedBox(
              height: 400,
              child: MarkdownEditor(
                controller: doc,
                onSearchMentions: (query) async => const [
                  MentionTarget(username: 'zoukehui', displayName: '邹轲辉'),
                  MentionTarget(username: 'zhang', displayName: '张三'),
                ],
              ),
            ),
          ),
        ),
      );

      await tester.enterText(find.byType(TextField).first, '谢谢 @zo');
      await tester.pump(const Duration(milliseconds: 250));
      await tester.pump();

      expect(find.text('邹轲辉'), findsOneWidget);
      expect(find.text('@zhang'), findsOneWidget);

      await tester.tap(find.text('邹轲辉'));
      await tester.pump();

      expect(doc.markdown.contains('@zoukehui'), isTrue);
      expect(find.text('@zhang'), findsNothing);
    });

    testWidgets('没有注入上传能力就不出现图片按钮', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SizedBox(height: 300, child: MarkdownEditor(controller: MarkdownDocController())),
          ),
        ),
      );

      expect(find.byIcon(Icons.image_outlined), findsNothing);
    });
  });
}
