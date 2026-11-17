import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/models.dart';

/// 会话级阅读队列，等价于网页的 `whyisee_topic_reading_stack`（sessionStorage）。
///
/// 网页切下一篇的做法是：每篇渲染 12 条候选 → 记下已读路径 → 取第一条没读过的。
/// app 之前只问服务端要「第一名」且自己不留已读记录，同一篇算出来的第一名
/// 永远一样，于是 A→B、B→A 原地打转。
///
/// 这里把每篇返回的候选都倒进同一条队列，天然不会重复：
/// 打开 A 时入队 [B,C,D]，去 B 之后 B 的候选再入队，取队首 C，依此类推。
class ReadingQueue {
  final List<TopicRef> _buffer = [];
  final Set<int> _seen = {};

  /// 排队过多没意义，留一屏够用的量。
  static const _bufferCap = 40;

  /// 已读记录上限，超过就丢最早的（[Set] 默认是按下标有序的 LinkedHashSet）。
  static const _seenCap = 120;

  /// 给服务端 `exclude` 用：把读过的排除掉，避免重新算回同一批。
  List<int> get seenIds => _seen.toList(growable: false);

  bool get isEmpty => _buffer.isEmpty;

  /// 下一站是谁（不消费），用于列表底部的「继续下滑 · 标题」。
  TopicRef? get peek => _buffer.isEmpty ? null : _buffer.first;

  /// 进过详情页就算读过，后面的候选里要剔除。
  void markSeen(int topicId) {
    if (topicId <= 0) return;
    _seen.add(topicId);
    _buffer.removeWhere((item) => item.id == topicId);

    while (_seen.length > _seenCap) {
      _seen.remove(_seen.first);
    }
  }

  /// 候选入队：丢掉已读的和重复的，保持服务端给的推荐顺序。
  void push(Iterable<TopicRef> candidates) {
    for (final item in candidates) {
      if (item.id <= 0 || _seen.contains(item.id)) continue;
      if (_buffer.any((e) => e.id == item.id)) continue;
      _buffer.add(item);
    }

    if (_buffer.length > _bufferCap) {
      _buffer.removeRange(_bufferCap, _buffer.length);
    }
  }

  /// 取下一站并记成已读。队列空了返回 null，调用方去补货。
  TopicRef? take() {
    if (_buffer.isEmpty) return null;
    final next = _buffer.removeAt(0);
    markSeen(next.id);
    return next;
  }

  void clear() {
    _buffer.clear();
    _seen.clear();
  }
}

/// 不 autoDispose：整条阅读链路（A→B→C…）共用一份已读记录。
final readingQueueProvider = Provider<ReadingQueue>((ref) => ReadingQueue());
