import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/models.dart';
import '../../core/env.dart';
import '../../core/providers.dart';
import '../errors/error_view.dart';
import 'go_controller.dart';
import 'widgets/todo_row.dart';

/// 「出发」= 我该做的事。
///
/// 和「看见」的分工不是版式，而是数据来源：
/// - 看见推的是别人的内容，一条条帖子，用来决定下一篇读什么；
/// - 出发列的是和你有关的事，来自通知和任务提交，用来决定现在动手做什么。
///
/// 所以这里没有封面、没有摘要、没有排序筛选 —— 一屏看到的是「谁在等你」。
class GoPage extends ConsumerStatefulWidget {
  const GoPage({super.key});

  @override
  ConsumerState<GoPage> createState() => _GoPageState();
}

class _GoPageState extends ConsumerState<GoPage> {
  /// 帖子进原生详情（挂在 /go 栈下，返回回本页）；任务这类没有原生实现的走网页容器。
  void _open(TodoItem item) {
    ref.read(goControllerProvider.notifier).dismiss(item.id);

    final topicId = item.topicId;
    if (topicId != null && topicId > 0) {
      context.push('/go/t/$topicId');
      return;
    }

    final path = item.href.isEmpty ? '/go' : item.href;
    context.push(
      '/go/page?path=${Uri.encodeComponent(path)}&title=${Uri.encodeComponent(item.actionLabel)}',
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final state = ref.watch(goControllerProvider);
    final controller = ref.read(goControllerProvider.notifier);

    return Scaffold(
      backgroundColor: const Color(Env.bg),
      body: Column(
        children: [
          _Header(summary: state.summary, signedIn: session.isSignedIn),
          Expanded(
            child: switch (session.status) {
              SessionStatus.unknown => const _Skeleton(),
              SessionStatus.signedOut => const _SignedOutView(),
              SessionStatus.signedIn => _buildContent(state, controller),
            },
          ),
        ],
      ),
    );
  }

  Widget _buildContent(GoState state, GoController controller) {
    if (state.isInitialLoading) return const _Skeleton();

    if (state.error != null && state.board.isEmpty) {
      final notDeployed = state.error!.statusCode == 404;
      return ErrorView(
        title: notDeployed ? '服务端还没更新' : '加载失败',
        message: notDeployed
            ? '线上还没有 /api/v1/me/todo，跑一次 deploy/release.sh 再回来。'
            : state.error!.message,
        onRetry: controller.refresh,
      );
    }

    return RefreshIndicator(
      color: const Color(Env.blue),
      backgroundColor: const Color(Env.surface),
      edgeOffset: 2,
      onRefresh: controller.refresh,
      child: state.board.isEmpty
          ? const _ClearView()
          : _buildList(state, controller),
    );
  }

  /// 组头与行拍平成一个列表，共用同一套滚动节奏。
  Widget _buildList(GoState state, GoController controller) {
    final entries = <Object>[];
    for (final group in state.groups) {
      entries.add(group);
      entries.addAll(group.items);
    }

    return ListView.builder(
      padding: const EdgeInsets.only(top: 2, bottom: 30),
      physics: const AlwaysScrollableScrollPhysics(),
      itemCount: entries.length,
      itemBuilder: (context, index) {
        final entry = entries[index];

        if (entry is TodoGroup) {
          return _GroupHeader(group: entry, isFirst: index == 0);
        }

        final item = entry as TodoItem;
        return TodoRow(item: item, onTap: () => _open(item));
      },
    );
  }
}

/// 头部：标题 + 一句「还剩几件」，不放假按钮 —— 发帖在底部中间。
class _Header extends StatelessWidget {
  const _Header({required this.summary, required this.signedIn});

  final TodoSummary summary;
  final bool signedIn;

  @override
  Widget build(BuildContext context) {
    final String subtitle;
    if (!signedIn) {
      subtitle = '登录后才能看到等你处理的事';
    } else if (summary.total == 0) {
      subtitle = '没有待处理的事';
    } else if (summary.actionable == 0) {
      subtitle = '${summary.total} 条动态 · 没有需要你动手的';
    } else {
      subtitle = '${summary.actionable} 件等你处理'
          '${summary.total > summary.actionable ? ' · ${summary.total - summary.actionable} 条动态' : ''}';
    }

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
            subtitle,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 11.5, height: 1.4, color: Color(0xFF737D8B)),
          ),
        ],
      ),
    );
  }
}

/// 组头：标签 + 件数 + 拉到末尾的细线。
class _GroupHeader extends StatelessWidget {
  const _GroupHeader({required this.group, required this.isFirst});

  final TodoGroup group;
  final bool isFirst;

  @override
  Widget build(BuildContext context) {
    final accent = switch (group.key) {
      'review' => const Color(0xFFF3C969),
      'followed' => const Color(0xFF94A3B8),
      _ => const Color(0xFF8AB4F8),
    };

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
            '${group.count}',
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

/// 全清空：待办页最好看的状态，值得单独写一句。
class _ClearView extends StatelessWidget {
  const _ClearView();

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        const SizedBox(height: 96),
        Icon(
          Icons.check_circle_outline,
          size: 30,
          color: const Color(Env.muted).withValues(alpha: 0.5),
        ),
        const SizedBox(height: 12),
        const Center(
          child: Text(
            '都处理完了',
            style: TextStyle(fontSize: 13.5, color: Color(Env.muted)),
          ),
        ),
        const SizedBox(height: 6),
        Center(
          child: Text(
            '有人回你、有任务提交时会出现在这里',
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

class _SignedOutView extends StatelessWidget {
  const _SignedOutView();

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 30, 16, 0),
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 22),
          decoration: BoxDecoration(
            color: const Color(Env.surface),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(Env.line)),
          ),
          child: Column(
            children: [
              Container(
                width: 54,
                height: 54,
                decoration: const BoxDecoration(color: Color(Env.panel), shape: BoxShape.circle),
                child: const Icon(Icons.task_alt, size: 24, color: Color(Env.muted)),
              ),
              const SizedBox(height: 14),
              const Text(
                '登录后这里才有内容',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: Color(Env.text),
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                '有人回复你、提到你、提交了你的任务，\n都会排在这里等你处理。',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12.5, height: 1.6, color: Color(Env.muted)),
              ),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => context.push(
                    '/go/page?path=${Uri.encodeComponent('/login')}&title=${Uri.encodeComponent('登录')}',
                  ),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(Env.blue),
                    foregroundColor: const Color(0xFF0D1016),
                    minimumSize: const Size.fromHeight(42),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  child: const Text(
                    '登录',
                    style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// 骨架：按真实行的形状画，加载完不跳版。
class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.only(top: 14),
      children: [
        for (var group = 0; group < 2; group++) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
            child: Row(
              children: [
                _bar(width: 6, height: 6, radius: 3),
                const SizedBox(width: 7),
                _bar(width: 52, height: 10),
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
                  _bar(width: 32, height: 32, radius: 16),
                  const SizedBox(width: 11),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _bar(width: 168, height: 12),
                        const SizedBox(height: 6),
                        _bar(width: 110, height: 9),
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
