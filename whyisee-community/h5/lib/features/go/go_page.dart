import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/models.dart';
import '../../core/env.dart';
import '../errors/error_view.dart';
import 'go_controller.dart';
import 'widgets/task_row.dart';

/// 「出发」= 任务台，不是第二个信息流。
///
/// 和「看见」的分工：
/// - 看见是**读**：大卡片、封面、摘要、作者和时间，用来决定下一篇文章看什么；
/// - 出发是**做**：一行一件事，只有标题 + 为什么找你 + 动作按钮，按类型分组，
///   扫一眼就知道今天有几件事、接下来点哪个。
///
/// 所以这里没有筛选胶囊（分组已经是筛选），也没有摘要和封面 —— 那些属于看见。
class GoPage extends ConsumerStatefulWidget {
  const GoPage({super.key});

  @override
  ConsumerState<GoPage> createState() => _GoPageState();
}

class _GoPageState extends ConsumerState<GoPage> {
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController
      ..removeListener(_onScroll)
      ..dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final position = _scrollController.position;
    if (position.pixels < position.maxScrollExtent - 400) return;
    ref.read(goControllerProvider.notifier).loadMore();
  }

  /// 帖子进原生详情（挂在 /go 栈下，返回回本页）；其余页面仍用网页容器。
  void _open(ParticipationItem item) {
    final topicId = item.topicId;
    if (topicId != null && topicId > 0) {
      context.push('/go/t/$topicId');
      return;
    }

    final path = item.href.isEmpty ? '/go' : item.href;
    context.push('/go/page?path=${Uri.encodeComponent(path)}&title=${Uri.encodeComponent(item.actionLabel)}');
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(goControllerProvider);

    return Scaffold(
      backgroundColor: const Color(Env.bg),
      body: Column(
        children: [
          _Header(total: state.items.length, groupCount: state.groups.length),
          Expanded(child: _buildContent(state, ref.read(goControllerProvider.notifier))),
        ],
      ),
    );
  }

  Widget _buildContent(GoState state, GoController controller) {
    if (state.isInitialLoading) return const _Skeleton();

    if (state.error != null && state.items.isEmpty) {
      final notDeployed = state.error!.code == 'not_found';
      return ErrorView(
        title: notDeployed ? '服务端还没更新' : '加载失败',
        message: notDeployed
            ? '线上还没有 /api/v1/participation，跑一次 deploy/release.sh 再回来。'
            : state.error!.message,
        onRetry: controller.refresh,
      );
    }

    return RefreshIndicator(
      color: const Color(Env.blue),
      backgroundColor: const Color(Env.surface),
      edgeOffset: 2,
      onRefresh: controller.refresh,
      child: state.isEmpty
          ? _EmptyState(onRefresh: controller.refresh)
          : _buildTaskList(state, controller),
    );
  }

  /// 组头与行拍平成一个列表，「每组几件」和行共用同一套滚动与分割节奏。
  Widget _buildTaskList(GoState state, GoController controller) {
    final groups = state.groups;
    final entries = <Object>[];
    for (final group in groups) {
      entries.add(group);
      entries.addAll(group.items);
    }

    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.only(top: 2, bottom: 90),
      physics: const AlwaysScrollableScrollPhysics(),
      itemCount: entries.length + 1,
      itemBuilder: (context, index) {
        if (index == entries.length) {
          return _Footer(
            loading: state.loadingMore,
            error: state.loadingMore ? null : state.error?.message,
            onRetry: controller.loadMore,
          );
        }

        final entry = entries[index];
        if (entry is GoGroup) {
          return _GroupHeader(
            group: entry,
            isFirst: index == 0,
          );
        }

        final item = entry as ParticipationItem;
        return TaskRow(item: item, onTap: () => _open(item));
      },
    );
  }
}

/// 头部：标题 + 一句话总结（今天有几件事）。不做筛选条 —— 分组本身就是筛选。
class _Header extends StatelessWidget {
  const _Header({required this.total, required this.groupCount});

  final int total;
  final int groupCount;

  @override
  Widget build(BuildContext context) {
    final summary = total == 0
        ? '暂时没有要做的事'
        : '今天有 $total 件事可做 · $groupCount 类';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 10),
      decoration: const BoxDecoration(
        color: Color(Env.bg),
        border: Border(bottom: BorderSide(color: Color(Env.line), width: 1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '出发',
            style: TextStyle(
              fontSize: 22,
              height: 1.2,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.2,
              color: Color(Env.text),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            summary,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 11.5, height: 1.4, color: Color(0xFF737D8B)),
          ),
        ],
      ),
    );
  }
}

/// 组头：类型色点 + 组名 + 件数 + 一条拉到末尾的细线。
class _GroupHeader extends StatelessWidget {
  const _GroupHeader({required this.group, required this.isFirst});

  final GoGroup group;
  final bool isFirst;

  @override
  Widget build(BuildContext context) {
    final accent = participationAccent(group.type);

    return Padding(
      padding: EdgeInsets.fromLTRB(16, isFirst ? 12 : 20, 16, 4),
      child: Row(
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: accent, shape: BoxShape.circle),
          ),
          const SizedBox(width: 7),
          Text(
            group.label,
            style: const TextStyle(
              fontSize: 12,
              height: 1.2,
              fontWeight: FontWeight.w700,
              color: Color(0xFFC3CAD4),
            ),
          ),
          const SizedBox(width: 6),
          Text(
            '${group.items.length}',
            style: const TextStyle(
              fontSize: 11,
              height: 1.2,
              fontWeight: FontWeight.w600,
              color: Color(0xFF626B79),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(child: Container(height: 1, color: const Color(0x0FFFFFFF))),
        ],
      ),
    );
  }
}

class _Footer extends StatelessWidget {
  const _Footer({required this.loading, required this.onRetry, this.error});

  final bool loading;
  final String? error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    if (error != null) {
      return Padding(
        padding: const EdgeInsets.only(top: 16),
        child: Center(
          child: TextButton(onPressed: onRetry, child: Text('$error 点击重试')),
        ),
      );
    }

    if (loading) {
      return const Padding(
        padding: EdgeInsets.only(top: 20),
        child: Center(
          child: SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(strokeWidth: 2, color: Color(Env.muted)),
          ),
        ),
      );
    }

    return const SizedBox(height: 24);
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.onRefresh});

  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        const SizedBox(height: 110),
        Icon(
          Icons.task_alt,
          size: 30,
          color: const Color(Env.muted).withValues(alpha: 0.5),
        ),
        const SizedBox(height: 12),
        const Center(
          child: Text(
            '暂时没有要做的事',
            style: TextStyle(fontSize: 13.5, color: Color(Env.muted)),
          ),
        ),
        const SizedBox(height: 6),
        Center(
          child: Text(
            '有新问题、新项目时会出现在这里',
            style: TextStyle(
              fontSize: 11.5,
              color: const Color(Env.muted).withValues(alpha: 0.55),
            ),
          ),
        ),
      ],
    );
  }
}

/// 骨架：组头 + 三行的形状，加载完不跳版。
class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.only(top: 14),
      children: [
        for (var group = 0; group < 3; group++) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
            child: Row(
              children: [
                _bar(width: 6, height: 6, radius: 3),
                const SizedBox(width: 7),
                _bar(width: 46, height: 10),
                const SizedBox(width: 10),
                const Expanded(child: SizedBox()),
              ],
            ),
          ),
          for (var row = 0; row < 3; row++)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 9, 14, 9),
              child: Row(
                children: [
                  _bar(width: 2.5, height: 32, radius: 2),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _bar(width: 210, height: 13),
                        const SizedBox(height: 7),
                        _bar(width: 130, height: 9),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  _bar(width: 56, height: 26, radius: 13),
                ],
              ),
            ),
        ],
      ],
    );
  }

  Widget _bar({required double width, required double height, double radius = 4}) =>
      Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: const Color(0xFF1D222C),
          borderRadius: BorderRadius.circular(radius),
        ),
      );
}
