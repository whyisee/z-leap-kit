import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/api_exception.dart';
import '../../core/api/models.dart';
import '../../core/env.dart';
import '../../core/format.dart';
import '../errors/error_view.dart';
import '../feed/widgets/topic_card.dart';
import 'taxonomy_repository.dart';

/// 一个分类 / 一个标签下的全部话题。
///
/// 分类和标签的页面结构完全一样（头部说明 + 话题列表 + 分页），差别只有
/// 接口路径和文案，所以合成一个页面，用 [kind] 区分。
class TaxonomyDetailPage extends ConsumerStatefulWidget {
  const TaxonomyDetailPage({super.key, required this.kind, required this.slug});

  /// `category` 或 `tag`
  final String kind;
  final String slug;

  @override
  ConsumerState<TaxonomyDetailPage> createState() => _TaxonomyDetailPageState();
}

class _TaxonomyDetailPageState extends ConsumerState<TaxonomyDetailPage> {
  final _scroll = ScrollController();

  TaxonomyDetail? _detail;
  String? _error;
  bool _loading = true;
  bool _loadingMore = false;

  bool get _isTag => widget.kind == 'tag';

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    _load();
  }

  @override
  void dispose() {
    _scroll
      ..removeListener(_onScroll)
      ..dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scroll.hasClients) return;
    final position = _scroll.position;
    // 提前 320px 预取：等滚到底再发请求，用户会看到一段空白
    if (position.pixels >= position.maxScrollExtent - 320) {
      _loadMore();
    }
  }

  Future<TaxonomyDetail> _fetch({int offset = 0}) {
    final repo = ref.read(taxonomyRepositoryProvider);
    return _isTag
        ? repo.tag(widget.slug, offset: offset)
        : repo.category(widget.slug, offset: offset);
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final detail = await _fetch();
      if (!mounted) return;
      setState(() {
        _detail = detail;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.code == 'not_found'
            ? '这个${_isTag ? '标签' : '分类'}不存在，可能已经改名了'
            : (e.isNetwork ? '网络不通，检查一下再试' : e.message);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = '没加载出来，稍后再试';
      });
    }
  }

  Future<void> _loadMore() async {
    final current = _detail;
    if (current == null || !current.hasMore || _loadingMore) return;

    setState(() => _loadingMore = true);

    try {
      final next = await _fetch(offset: current.nextOffset ?? current.topics.length);
      if (!mounted) return;
      setState(() {
        _detail = current.copyWith(
          topics: [...current.topics, ...next.topics],
          hasMore: next.hasMore,
          nextOffset: next.nextOffset,
        );
        _loadingMore = false;
      });
    } catch (_) {
      // 加载更多失败不打断当前列表，滚一下会再试
      if (!mounted) return;
      setState(() => _loadingMore = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final detail = _detail;

    return Scaffold(
      backgroundColor: const Color(Env.bg),
      appBar: AppBar(
        backgroundColor: const Color(Env.headerBg),
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: Text(
          detail?.item.name ?? (_isTag ? '标签' : '分类'),
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(Env.text)),
        ),
        iconTheme: const IconThemeData(color: Color(Env.muted)),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, thickness: 1, color: Color(Env.line)),
        ),
      ),
      body: _buildBody(detail),
    );
  }

  Widget _buildBody(TaxonomyDetail? detail) {
    if (_loading) return const _Skeleton();

    if (_error != null) {
      return ErrorView(title: '打不开', message: _error!, onRetry: _load);
    }

    if (detail == null) return const SizedBox.shrink();

    final item = detail.item;

    return RefreshIndicator(
      color: const Color(Env.blue),
      backgroundColor: const Color(Env.surface),
      onRefresh: _load,
      child: ListView.builder(
        controller: _scroll,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 28),
        itemCount: detail.topics.length + 2,
        itemBuilder: (context, index) {
          if (index == 0) {
            return _Header(item: item, kindLabel: detail.kindLabel);
          }

          if (index == detail.topics.length + 1) {
            return _Footer(
              loading: _loadingMore,
              hasMore: detail.hasMore,
              empty: detail.topics.isEmpty,
            );
          }

          final topic = detail.topics[index - 1];

          return TopicCard(
            topic: topic,
            onTap: () => context.push('/t/${topic.id}'),
          );
        },
      ),
    );
  }
}

/// 头部：名称 + 篇数 + 说明。
///
/// 名称在 AppBar 里已经有了，这里重复一次是有意的 —— AppBar 的字太小，
/// 而这一屏的重点就是「我现在看的这一类是什么」。
class _Header extends StatelessWidget {
  const _Header({required this.item, required this.kindLabel});

  final TaxonomyItem item;
  final String kindLabel;

  @override
  Widget build(BuildContext context) {
    final color = colorFromHex(item.color);

    return Container(
      margin: const EdgeInsets.fromLTRB(14, 12, 14, 8),
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      decoration: BoxDecoration(
        color: const Color(Env.surface),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0x14FFFFFF)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 8,
                height: 8,
                margin: const EdgeInsets.only(right: 8),
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              ),
              Expanded(
                child: Text(
                  item.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 19,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.4,
                    color: Color(Env.text),
                  ),
                ),
              ),
              Text(
                '${item.topicCount} 篇$kindLabel',
                style: const TextStyle(fontSize: 11.5, color: Color(0xFF5F6875)),
              ),
            ],
          ),
          if (item.description.trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              item.description.trim(),
              style: const TextStyle(fontSize: 12.5, height: 1.6, color: Color(Env.muted)),
            ),
          ],
        ],
      ),
    );
  }
}

class _Footer extends StatelessWidget {
  const _Footer({required this.loading, required this.hasMore, required this.empty});

  final bool loading;
  final bool hasMore;
  final bool empty;

  @override
  Widget build(BuildContext context) {
    if (empty) {
      return const Padding(
        padding: EdgeInsets.fromLTRB(20, 40, 20, 20),
        child: Center(
          child: Text(
            '这一类下还没有话题',
            style: TextStyle(fontSize: 12.5, color: Color(0xFF5F6875)),
          ),
        ),
      );
    }

    if (loading) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 20),
        child: Center(
          child: SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2, color: Color(Env.blue)),
          ),
        ),
      );
    }

    if (hasMore) return const SizedBox(height: 40);

    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 22),
      child: Center(
        child: Text(
          '到底了',
          style: TextStyle(fontSize: 11.5, color: Color(0xFF4A5462)),
        ),
      ),
    );
  }
}

class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 16, 14, 20),
      children: [
        Container(
          height: 84,
          decoration: BoxDecoration(
            color: const Color(Env.surface),
            borderRadius: BorderRadius.circular(14),
          ),
        ),
        const SizedBox(height: 12),
        for (var i = 0; i < 5; i++)
          Container(
            height: 92,
            margin: const EdgeInsets.only(bottom: 8),
            decoration: BoxDecoration(
              color: const Color(Env.surface),
              borderRadius: BorderRadius.circular(14),
            ),
          ),
      ],
    );
  }
}
