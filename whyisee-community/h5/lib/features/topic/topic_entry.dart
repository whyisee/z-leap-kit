import 'package:flutter/foundation.dart';

/// 从 `/t/79/slug#post-123` 里取出被指向的那一层。
///
/// 服务端生成通知时用的是网页锚点（`topicHref(..., 'post-123')`），
/// App 沿用它就能和网页跳同一个位置，不需要另一个字段。
int? postAnchorOf(String href) {
  final matched = RegExp(r'#post-(\d+)').firstMatch(href);
  if (matched == null) return null;
  final id = int.tryParse(matched.group(1)!);
  return (id != null && id > 0) ? id : null;
}

/// 「为什么打开这篇」—— 从通知点进来时带上。
///
/// 只放展示需要的东西，不放 [NotificationItem]：主题页不该知道通知列表的模型，
/// 否则以后通知字段一改，详情页跟着编译出错。
@immutable
class TopicEntry {
  const TopicEntry({
    required this.kind,
    this.title,
    this.actorName,
    this.actorAvatarUrl,
    this.timeLabel = '',
  });

  /// `reply` / `mention` / `like` / `system`，和后端 `kind` 一致
  final String kind;

  /// 通知原文标题。系统通知（审核结果、关注动态）没有「谁回复了你」这种句式，
  /// 直接用它当来由，比兜一句「站内通知」有用得多。
  final String? title;

  final String? actorName;
  final String? actorAvatarUrl;
  final String timeLabel;

  String get who {
    final name = (actorName ?? '').trim();
    return name.isEmpty ? '系统' : name;
  }

  /// 一句话说明来由。文案和后端 title 无关 —— 后端那条是「你的话题有新回复」，
  /// 没有主语；这里补上是谁做的，读起来才像人话。
  String get headline => switch (kind) {
        'reply' => '$who 回复了你的话题',
        'mention' => '$who 在回复里提到了你',
        'like' => '$who 赞了你的话题',
        _ => (title ?? '').trim().isNotEmpty
            ? title!.trim()
            : (who == '系统' ? '站内通知' : '$who · 站内通知'),
      };
}
