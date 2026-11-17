/// 展示层的纯函数格式化。不依赖 BuildContext，方便单测。
library;

/// 列表里的相对时间。超过 7 天退成日期，避免「123天前」这种没信息量的表述。
String relativeTime(DateTime? time, {DateTime? now}) {
  if (time == null) return '';
  final ref = now ?? DateTime.now();
  final diff = ref.difference(time);

  if (diff.isNegative) return '刚刚';
  if (diff.inMinutes < 1) return '刚刚';
  if (diff.inMinutes < 60) return '${diff.inMinutes} 分钟前';
  if (diff.inHours < 24) return '${diff.inHours} 小时前';

  final today = DateTime(ref.year, ref.month, ref.day);
  final day = DateTime(time.year, time.month, time.day);
  final days = today.difference(day).inDays;

  if (days == 1) return '昨天';
  if (days < 7) return '$days 天前';
  if (time.year == ref.year) {
    return '${time.month}-${time.day.toString().padLeft(2, '0')}';
  }
  return '${time.year}-${time.month.toString().padLeft(2, '0')}-${time.day.toString().padLeft(2, '0')}';
}

/// 计数压缩：999 以内原样，1 万以内 1.2k，再往上 1.2w。
String compactCount(int value) {
  if (value < 1000) return '$value';
  if (value < 10000) {
    final v = value / 1000;
    return '${v.toStringAsFixed(v >= 10 ? 0 : 1).replaceAll(RegExp(r'\.0$'), '')}k';
  }
  final v = value / 10000;
  return '${v.toStringAsFixed(v >= 10 ? 0 : 1).replaceAll(RegExp(r'\.0$'), '')}w';
}

final _tagPattern = RegExp(r'<[^>]*>');
final _blockTagPattern =
    RegExp(r'</(p|div|li|h[1-6]|blockquote|tr)>|<br\s*/?>', caseSensitive: false);
final _entityMap = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&hellip;': '…',
  '&mdash;': '—',
  '&middot;': '·',
};

/// 把回帖 HTML 降级成纯文本。
///
/// 为什么不做完整 HTML 渲染：正文用 WebView 保真，回帖内容短、结构简单，
/// 引入一个 HTML 渲染库的维护成本高于收益（见设计文档 §4.6）。
/// 这里只保留段落换行、去掉标签、还原常见实体。
String htmlToPlainText(String html) {
  if (html.isEmpty) return '';
  // 先把 img 换成占位，否则下面统一去标签时会连 alt 一起吞掉
  var out = html.replaceAllMapped(
    RegExp(r'<img\b[^>]*>', caseSensitive: false),
    (m) {
      final alt = RegExp(r'alt="([^"]*)"', caseSensitive: false)
          .firstMatch(m[0] ?? '')
          ?.group(1)
          ?.trim();
      return (alt == null || alt.isEmpty) ? '[图]' : '[图:$alt]';
    },
  );
  out = out
      .replaceAll(_blockTagPattern, '\n')
      .replaceAll(_tagPattern, '');
  _entityMap.forEach((k, v) => out = out.replaceAll(k, v));
  // 连续空行压成一行，首尾空白去掉
  out = out.replaceAll(RegExp(r'\n{3,}'), '\n\n').replaceAll(RegExp(r'[ \t]{2,}'), ' ');
  return out.trim();
}
