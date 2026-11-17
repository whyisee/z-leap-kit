import 'package:flutter_test/flutter_test.dart';
import 'package:whyisee_app/core/api/models.dart';
import 'package:whyisee_app/features/topic/reading_queue.dart';

TopicRef ref(int id) => TopicRef(id: id, title: 't$id');

/// 这条链路最容易出的事故是「来回推同一两篇」，所以重点测去重和顺序。
void main() {
  test('候选按服务端顺序消费，读完的不再出现', () {
    final queue = ReadingQueue()
      ..markSeen(1)
      ..push([ref(1), ref(2), ref(3)]);

    expect(queue.peek?.id, 2);
    expect(queue.take()?.id, 2);
    expect(queue.take()?.id, 3);
    expect(queue.take(), isNull);
  });

  test('串两篇的候选时不会重复，也不会退化成 A→B→A', () {
    final queue = ReadingQueue()
      ..markSeen(1)
      ..push([ref(2), ref(3)]); // 打开 A 拿到的候选

    expect(queue.take()?.id, 2); // A → B

    // 打开 B 拿到的候选里又出现 A（推荐算法常见），必须被丢掉
    queue.push([ref(1), ref(2), ref(4)]);

    expect(queue.peek?.id, 3, reason: '还没读过的老候选优先，保持连续下滑');
    expect(queue.take()?.id, 3);
    expect(queue.take()?.id, 4);

    final ids = queue.seenIds;
    expect(ids.toSet().length, ids.length, reason: '已读列表不能有重复');
    expect(ids, containsAll([1, 2, 3, 4]));
  });

  test('队列空了才需要补货，补货传的 exclude 是已读全集', () {
    final queue = ReadingQueue()
      ..markSeen(7)
      ..push([ref(7)]);

    expect(queue.isEmpty, isTrue);
    expect(queue.seenIds, [7]);

    queue.push([ref(8), ref(9)]);
    expect(queue.take()?.id, 8);
    expect(queue.seenIds, [7, 8]);
  });

  test('已读超过上限时丢最早的，避免无限膨胀', () {
    final queue = ReadingQueue();
    for (var id = 1; id <= 150; id++) {
      queue.markSeen(id);
    }

    final ids = queue.seenIds;
    expect(ids.length, 120);
    expect(ids.first, 31);
    expect(ids.last, 150);
  });
}
