import 'package:material_ui/material_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:whyisee_app/features/errors/error_view.dart';

void main() {
  testWidgets('错误页展示标题并在点击重试时回调', (tester) async {
    var retried = 0;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ErrorView(
            title: '打不开页面',
            message: '网络好像不通',
            onRetry: () => retried++,
          ),
        ),
      ),
    );

    expect(find.text('打不开页面'), findsOneWidget);
    expect(find.text('网络好像不通'), findsOneWidget);

    await tester.tap(find.text('重试'));
    await tester.pump();

    expect(retried, 1);
  });
}
