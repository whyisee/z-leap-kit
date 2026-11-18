import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/models.dart';
import '../../core/env.dart';
import '../../core/format.dart';
import '../errors/error_view.dart';
import 'taxonomy_repository.dart';

/// 分类总览 + 热门标签。
///
/// 网页 `/categories` 是一张「分类卡片墙 + 右侧标签云」，手机上双栏没有意义，
/// 所以拆成上下两段：上面分类（带说明和篇数，决定点不点），下面标签（只有
/// 名字和篇数，是补充入口）。
class TaxonomyListPage extends ConsumerStatefulWidget {
  const TaxonomyListPage({super.key});

  @override
  ConsumerState<TaxonomyListPage> createState() => _TaxonomyListPageState();
}

class _TaxonomyListPageState extends ConsumerState<TaxonomyListPage> {
  late Future<(List<TaxonomyItem>, List<TaxonomyItem>)> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<(List<TaxonomyItem>, List<TaxonomyItem>)> _load() async {
    final repo = ref.read(taxonomyRepositoryProvider);
    // 两个请求互不依赖，并发发出：任何一个慢都不会拖住另一个
    final results = await Future.wait([repo.categories(), repo.tags()]);

    return (results[0], results[1]);
  }

  void _reload() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(Env.bg),
      appBar: AppBar(
        backgroundColor: const Color(Env.headerBg),
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          '分类',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(Env.text)),
        ),
        iconTheme: const IconThemeData(color: Color(Env.muted)),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, thickness: 1, color: Color(Env.line)),
        ),
      ),
      body: FutureBuilder(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const _Skeleton();
          }

          if (snapshot.hasError) {
            return ErrorView(
              title: '加载失败',
              message: '分类没取到，检查一下网络',
              onRetry: _reload,
            );
          }

          final (categories, tags) = snapshot.data!;

          if (categories.isEmpty) {
            return ErrorView(
              title: '这里还是空的',
              message: '站点还没有公开分类',
              onRetry: _reload,
            );
          }

          return RefreshIndicator(
            color: const Color(Env.blue),
            backgroundColor: const Color(Env.surface),
            onRefresh: () async {
              _reload();
              await _future;
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(0, 8, 0, 32),
              children: [
                const _SectionTitle(title: '全部分类', trailing: '点进去看这一类下的所有话题'),
                for (final category in categories)
                  _CategoryRow(
                    item: category,
                    onTap: () => context.push('/c/${category.slug}'),
                  ),
                if (tags.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  const _SectionTitle(title: '热门标签', trailing: '按篇数排'),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
                    child: Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final tag in tags)
                          _TagChip(
                            item: tag,
                            onTap: () => context.push('/tag/${tag.slug}'),
                          ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, this.trailing});

  final String title;
  final String? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.4,
              color: Color(Env.text),
            ),
          ),
          if (trailing != null) ...[
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                trailing!,
                style: const TextStyle(fontSize: 11, color: Color(0xFF5F6875)),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// 一行分类：色条 + 名称 + 说明 + 篇数。
///
/// 左边那条竖色条用分类自己的颜色，和列表卡片、筛选 chip 上是同一个色值 ——
/// 用户在三个地方看到的「AI」应该是同一种颜色。
class _CategoryRow extends StatelessWidget {
  const _CategoryRow({required this.item, required this.onTap});

  final TaxonomyItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = colorFromHex(item.color);

    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 4, 14, 4),
      child: Material(
        color: const Color(Env.surface),
        borderRadius: BorderRadius.circular(13),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 3,
                  height: 34,
                  margin: const EdgeInsets.only(top: 2, right: 11),
                  decoration: BoxDecoration(
                    color: color,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              item.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 14.5,
                                fontWeight: FontWeight.w700,
                                color: Color(Env.text),
                              ),
                            ),
                          ),
                          Text(
                            '${item.topicCount} 篇',
                            style: const TextStyle(fontSize: 11.5, color: Color(0xFF5F6875)),
                          ),
                          const SizedBox(width: 2),
                          const Icon(Icons.chevron_right, size: 16, color: Color(0xFF4A5462)),
                        ],
                      ),
                      if (item.description.trim().isNotEmpty) ...[
                        const SizedBox(height: 3),
                        Text(
                          item.description.trim(),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12,
                            height: 1.45,
                            color: Color(Env.muted),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TagChip extends StatelessWidget {
  const _TagChip({required this.item, required this.onTap});

  final TaxonomyItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(Env.surface),
      borderRadius: BorderRadius.circular(9),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(9),
            border: Border.all(color: const Color(0x14FFFFFF)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '#${item.name}',
                style: const TextStyle(fontSize: 12.5, color: Color(Env.text)),
              ),
              const SizedBox(width: 5),
              Text(
                '${item.topicCount}',
                style: const TextStyle(fontSize: 10.5, color: Color(0xFF5F6875)),
              ),
            ],
          ),
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
      padding: const EdgeInsets.fromLTRB(14, 18, 14, 20),
      children: [
        for (var i = 0; i < 7; i++)
          Container(
            height: 66,
            margin: const EdgeInsets.only(bottom: 8),
            decoration: BoxDecoration(
              color: const Color(Env.surface),
              borderRadius: BorderRadius.circular(13),
            ),
          ),
      ],
    );
  }
}
