import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/api_exception.dart';
import '../../core/api/models.dart';
import '../../core/env.dart';
import '../../core/providers.dart';
import '../errors/error_view.dart';
import '../feed/widgets/topic_card.dart';
import 'projects_repository.dart';

/// 项目展示（原生版）。
///
/// 网页 `/projects` 是「列表头 + 一条条话题」，没有排序、没有筛选。
/// 手机上照搬这个结构，唯一加的是顶部一句说明 —— 否则用户不知道
/// 这个列表和「看见」有什么区别（区别只有一条：这里的 type 全是 project）。
class ProjectsPage extends ConsumerStatefulWidget {
  const ProjectsPage({super.key});

  @override
  ConsumerState<ProjectsPage> createState() => _ProjectsPageState();
}

class _ProjectsPageState extends ConsumerState<ProjectsPage> {
  final _scroll = ScrollController();

  final _topics = <TopicSummary>[];
  int? _nextOffset;
  bool _hasMore = true;
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    _load();
  }

  @override
  void dispose() {
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_hasMore || _loadingMore || _loading) return;
    if (_scroll.position.pixels < _scroll.position.maxScrollExtent - 320) return;
    _loadMore();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final page = await ref.read(projectsRepositoryProvider).load();
      if (!mounted) return;
      setState(() {
        _topics
          ..clear()
          ..addAll(page.items);
        _hasMore = page.hasMore;
        _nextOffset = page.nextOffset;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  Future<void> _loadMore() async {
    final offset = _nextOffset;
    if (offset == null) {
      setState(() => _hasMore = false);
      return;
    }

    setState(() => _loadingMore = true);

    try {
      final page = await ref.read(projectsRepositoryProvider).load(offset: offset);
      if (!mounted) return;
      setState(() {
        // 服务端排序是「发布时间的倒序」，翻页期间有人发新项目会让同一条
        // 出现在相邻两页，按 id 去重比信任 offset 稳。
        final seen = _topics.map((topic) => topic.id).toSet();
        _topics.addAll(page.items.where((topic) => !seen.contains(topic.id)));
        _hasMore = page.hasMore;
        _nextOffset = page.nextOffset;
        _loadingMore = false;
      });
    } on ApiException {
      if (!mounted) return;
      setState(() => _loadingMore = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final signedIn = ref.watch(sessionProvider).isSignedIn;

    return Scaffold(
      backgroundColor: const Color(Env.bg),
      appBar: AppBar(
        backgroundColor: const Color(Env.headerBg),
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          '项目展示',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(Env.text)),
        ),
        iconTheme: const IconThemeData(color: Color(Env.muted)),
        actions: [
          if (signedIn)
            TextButton(
              onPressed: () => context.push('/compose?type=project'),
              style: TextButton.styleFrom(foregroundColor: const Color(Env.blue)),
              child: const Text('写一篇', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            ),
        ],
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(height: 1, thickness: 1, color: Color(Env.line)),
        ),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) return const _Skeleton();

    if (_error != null) {
      return ErrorView(title: '打不开项目', message: _error!, onRetry: _load);
    }

    return RefreshIndicator(
      color: const Color(Env.blue),
      backgroundColor: const Color(Env.surface),
      onRefresh: _load,
      child: ListView.builder(
        controller: _scroll,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 28),
        itemCount: _topics.length + 2,
        itemBuilder: (context, index) {
          if (index == 0) return const _Header();

          if (index == _topics.length + 1) {
            return _Footer(loading: _loadingMore, hasMore: _hasMore, empty: _topics.isEmpty);
          }

          final topic = _topics[index - 1];

          return TopicCard(topic: topic, onTap: () => context.push('/t/${topic.id}'));
        },
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header();

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(14, 12, 14, 6),
      padding: const EdgeInsets.fromLTRB(14, 13, 14, 13),
      decoration: BoxDecoration(
        color: const Color(Env.surface),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0x14FFFFFF)),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '别人在做什么',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(Env.text)),
          ),
          SizedBox(height: 6),
          Text(
            '这里只收「项目」类话题：做到哪一步、用什么做的、踩了什么坑。'
            '想法和提问在「看见」里更合适。',
            style: TextStyle(fontSize: 12, height: 1.6, color: Color(Env.muted)),
          ),
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
        padding: EdgeInsets.fromLTRB(20, 48, 20, 20),
        child: Center(
          child: Text('还没有项目展示', style: TextStyle(fontSize: 12.5, color: Color(0xFF5F6875))),
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
        child: Text('到底了', style: TextStyle(fontSize: 11.5, color: Color(0xFF4A5462))),
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
          height: 88,
          decoration: BoxDecoration(color: const Color(Env.surface), borderRadius: BorderRadius.circular(14)),
        ),
        const SizedBox(height: 12),
        for (var i = 0; i < 4; i++)
          Container(
            height: 96,
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
