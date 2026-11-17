import 'package:flutter_test/flutter_test.dart';
import 'package:whyisee_app/core/format.dart';

void main() {
  group('relativeTime', () {
    final now = DateTime(2026, 11, 17, 21, 0);

    test('一分钟内算刚刚', () {
      expect(relativeTime(now.subtract(const Duration(seconds: 40)), now: now), '刚刚');
    });

    test('按分钟/小时递进', () {
      expect(relativeTime(now.subtract(const Duration(minutes: 5)), now: now), '5 分钟前');
      expect(relativeTime(now.subtract(const Duration(hours: 3)), now: now), '3 小时前');
    });

    test('跨天用昨天、N 天前，超过 7 天退成日期', () {
      expect(relativeTime(DateTime(2026, 11, 16, 9), now: now), '昨天');
      expect(relativeTime(DateTime(2026, 11, 14, 9), now: now), '3 天前');
      expect(relativeTime(DateTime(2026, 11, 3, 9), now: now), '11-03');
      expect(relativeTime(DateTime(2025, 8, 1, 9), now: now), '2025-08-01');
    });

    test('空值与未来时间不炸', () {
      expect(relativeTime(null), '');
      expect(relativeTime(now.add(const Duration(minutes: 5)), now: now), '刚刚');
    });
  });

  group('compactCount', () {
    test('千位进 k，万位进 w，整数不带小数点', () {
      expect(compactCount(0), '0');
      expect(compactCount(999), '999');
      expect(compactCount(1000), '1k');
      expect(compactCount(1200), '1.2k');
      expect(compactCount(9999), '10k'); // 9.999k 四舍五入到整数位
      expect(compactCount(12000), '1.2w');
      expect(compactCount(120000), '12w');
    });
  });

  group('htmlToPlainText', () {
    test('段落转成换行并去掉标签', () {
      expect(htmlToPlainText('<p>第一段</p><p>第二段</p>'), '第一段\n第二段');
    });

    test('br 与实体解码', () {
      expect(htmlToPlainText('a<br/>b &amp; c &lt;d&gt;'), 'a\nb & c <d>');
    });

    test('图片降级成占位文字（alt 有值就带上）', () {
      expect(htmlToPlainText('<img src="x.png" alt="截图">'), '[图:截图]');
      expect(htmlToPlainText('<img src="x.png">'), '[图]');
    });

    test('连续空行压缩、首尾空白剥离', () {
      expect(htmlToPlainText('<p> </p><p>a</p><p> </p>'), 'a');
    });

    test('空串安全', () {
      expect(htmlToPlainText(''), '');
    });
  });
}
