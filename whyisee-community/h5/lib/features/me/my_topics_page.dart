import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/api_exception.dart';
import '../../core/api/models.dart';
import '../../core/env.dart';
import '../../core/format.dart';
import '../errors/error_view.dart';
import 'me_repository.dart';

/// 「我的文章」：已发布 + 待审核 + 草稿，一次全给。
///
/// 首页和「我」页只认 `published`，所以刚写完待审的稿子在 App 里没有任何一处
/// 能看到 —— 作者只会以为「发出去了但没成功」。这一页就是那个缺口。
final myTopicsProvider = FutureProvider.autoDispose<MyTopicsResult>(
  (ref) => ref.watch(meRepositoryProvider).myTopics(),
);

class MyTopicsPage extends ConsumerStatefulWidget {
  const MyTopicsPage({super.key});

  @override
  ConsumerState<MyTopicsPage> createState() => _MyTopicsPageState();
}

class _MyTopicsPageState extends ConsumerState<MyTopicsPage> {
  String _filter = 'all';

  @override
  Widget build(BuildContext context) {
    final topics = ref.watch(myTopicsProvider);

    return Scaffold(
      backgroundColor: const Color(Env.bg),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _Bar(onBack: () => context.pop()),
            Expanded(
              child: topics.when(
                loading: () => const Center(
                  child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Color(Env.blue)),
                  ),
                ),
                error: (error, _) => ErrorView(
                  title: error is ApiException && error.statusCode == 404 ? '服务端还没更新' : '加载失败',
                  message: error is ApiException && error.statusCode == 404
                      ? '这个页面用到的接口还没上线，部署一次服务端再进来。'
                      : (error is ApiException ? error.message : '网络好像不太顺，稍后再试。'),
                  onRetry: () => ref.invalidate(myTopicsProvider),
                ),
                data: (data) {
                  final items = _filtered(data);
                  return RefreshIndicator(
                    color: const Color(Env.blue),
                    backgroundColor: const Color(Env.surface),
                    onRefresh: () async => ref.invalidate(myTopicsProvider),
                    child: ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.only(bottom: 28),
                      children: [
                        _Filters(
                          value: _filter,
                          total: data.items.length,
                          published: data.published,
                          pending: data.pending,
                          draft: data.draft,
                          onPick: (value) => setState(() => _filter = value),
                        ),
                        if (items.isEmpty)
                          const _Empty()
                        else
                          for (final item in items) _TopicRow(item: item, onTap: () => _open(item)),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<TopicSummary> _filtered(MyTopicsResult data) {
    if (_filter == 'all') return data.items;
    return data.items.where((item) => item.status == _filter).toList(growable: false);
  }

  /// 已发布的进阅读器；没公开的进编辑页 —— 那时作者唯一想做的事就是改完再交一次。
  Future<void> _open(TopicSummary item) async {
    if (item.status == null || item.status == 'published') {
      await context.push('/me/t/${item.id}');
    } else {
      await context.push('/compose/edit/${item.id}');
    }
    if (mounted) ref.invalidate(myTopicsProvider);
  }
}

/// 顶栏只放返回 + 标题：这一页的定位是「找回自己的稿子」，不需要发布按钮
/// （发帖在底部导航中间那颗）。
class _Bar extends StatelessWidget {
  const _Bar({required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: 50),
      padding: const EdgeInsets.fromLTRB(4, 4, 16, 4),
      decoration: const BoxDecoration(
        color: Color(Env.headerBg),
        border: Border(bottom: BorderSide(color: Color(Env.line), width: 1)),
      ),
      child: Row(
        children: [
          IconButton(
            onPressed: onBack,
            iconSize: 21,
            color: const Color(Env.text),
            icon: const Icon(Icons.arrow_back),
            tooltip: '返回',
          ),
          const Text(
            '我的文章',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: Color(Env.text),
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}

/// 四个筛子。数字直接标在标签上，省得为了看「有几篇待审」来回切。
class _Filters extends StatelessWidget {
  const _Filters({
    required this.value,
    required this.total,
    required this.published,
    required this.pending,
    required this.draft,
    required this.onPick,
  });

  final String value;
  final int total;
  final int published;
  final int pending;
  final int draft;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    final options = <(String, String, int)>[
      ('all', '全部', total),
      ('published', '已发布', published),
      ('pending', '待审核', pending),
      ('draft', '草稿', draft),
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
      child: Row(
        children: [
          for (final option in options) ...[
            _Chip(
              label: option.$3 > 0 ? '${option.$2} ${option.$3}' : option.$2,
              active: value == option.$1,
              tone: option.$1 == 'pending' ? const Color(0xFFF0A868) : null,
              onTap: () => onPick(option.$1),
            ),
            if (option != options.last) const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.active, required this.onTap, this.tone});

  final String label;
  final bool active;
  final VoidCallback onTap;
  final Color? tone;

  @override
  Widget build(BuildContext context) {
    final base = tone ?? const Color(Env.blue);

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        height: 30,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: active ? base.withValues(alpha: 0.16) : const Color(Env.panel),
          borderRadius: BorderRadius.circular(15),
          border: Border.all(color: active ? base.withValues(alpha: 0.5) : const Color(Env.line)),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            height: 1.1,
            fontWeight: active ? FontWeight.w700 : FontWeight.w500,
            color: active ? base : const Color(0xFFA8B2BF),
          ),
        ),
      ),
    );
  }
}

class _TopicRow extends StatelessWidget {
  const _TopicRow({required this.item, required this.onTap});

  final TopicSummary item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final status = _statusOf(item.status);
    final time = item.updatedAt ?? item.displayTime;

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 13, 16, 13),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              item.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 15,
                height: 1.45,
                fontWeight: FontWeight.w600,
                color: Color(Env.text),
              ),
            ),
            const SizedBox(height: 7),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: status.color.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    status.label,
                    style: TextStyle(fontSize: 10.5, height: 1.4, color: status.color),
                  ),
                ),
                if (item.category != null) ...[
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      item.category!.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11.5, color: Color(0xFF737D8B)),
                    ),
                  ),
                ],
                const SizedBox(width: 8),
                Text(relativeTime(time), style: const TextStyle(fontSize: 11.5, color: Color(0xFF5F6875))),
                const Spacer(),
                if (item.status == 'published')
                  Text(
                    '${compactCount(item.replyCount)} 回复',
                    style: const TextStyle(fontSize: 11.5, color: Color(0xFF5F6875)),
                  )
                else
                  const Icon(Icons.chevron_right, size: 16, color: Color(0xFF5F6875)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  ({String label, Color color}) _statusOf(String? status) {
    return switch (status) {
      'pending' => (label: '待审核', color: const Color(0xFFF0A868)),
      'draft' => (label: '草稿', color: const Color(0xFF9AA4B2)),
      _ => (label: '已发布', color: const Color(Env.blue)),
    };
  }
}

class _Empty extends StatelessWidget {
  const _Empty();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.only(top: 90),
      child: Column(
        children: [
          Icon(Icons.article_outlined, size: 26, color: Color(0xFF5F6875)),
          SizedBox(height: 10),
          Text('这里还没有文章', style: TextStyle(fontSize: 13, color: Color(Env.muted))),
          SizedBox(height: 4),
          Text('点底部中间的铅笔写第一篇', style: TextStyle(fontSize: 11.5, color: Color(0xFF5F6875))),
        ],
      ),
    );
  }
}
