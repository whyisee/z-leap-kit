import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/models.dart';
import '../../core/env.dart';
import '../errors/error_view.dart';
import 'agent_zone_repository.dart';

/// Agent 专区（原生版）。
///
/// 网页是「左侧栏 + 右侧长页」，每个 section 一个 URL。手机上改成三个 tab：
/// 广场看谁在跑、学院看能用什么 Skill、任务看它们在干什么 —— 这三块有真实数据。
/// 竞技 / 作品 / 规则 / 实验在网页上也还只是骨架页，这里不做空壳，只在广场底部
/// 写一句「还有哪些在建」，免得用户以为漏了。
class AgentZonePage extends ConsumerStatefulWidget {
  const AgentZonePage({super.key});

  @override
  ConsumerState<AgentZonePage> createState() => _AgentZonePageState();
}

class _AgentZonePageState extends ConsumerState<AgentZonePage> {
  late Future<(AgentPlaza, AgentAcademy, AgentTaskHall)> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  /// 三个接口互不依赖，并发发出：任何一个慢都不拖住另外两个。
  /// 数据量都是十位数，一次拉全比分页省事，翻页在手机上反而像卡住。
  Future<(AgentPlaza, AgentAcademy, AgentTaskHall)> _load() async {
    final repo = ref.read(agentZoneRepositoryProvider);
    final results = await Future.wait([repo.plaza(), repo.academy(), repo.tasks()]);

    return (results[0] as AgentPlaza, results[1] as AgentAcademy, results[2] as AgentTaskHall);
  }

  /// 下拉刷新要等请求真的回来，否则转圈会立刻收掉。
  Future<void> _reload() async {
    setState(() => _future = _load());
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        backgroundColor: const Color(Env.bg),
        appBar: AppBar(
          backgroundColor: const Color(Env.headerBg),
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          title: const Text(
            'Agent 专区',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(Env.text)),
          ),
          iconTheme: const IconThemeData(color: Color(Env.muted)),
          bottom: const TabBar(
            indicatorColor: Color(Env.blue),
            indicatorSize: TabBarIndicatorSize.label,
            labelColor: Color(Env.text),
            unselectedLabelColor: Color(Env.muted),
            labelStyle: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600),
            unselectedLabelStyle: TextStyle(fontSize: 13.5),
            tabs: [
              Tab(text: '广场'),
              Tab(text: '学院'),
              Tab(text: '任务'),
            ],
          ),
        ),
        body: FutureBuilder(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const _Loading();
            }

            if (snapshot.hasError || !snapshot.hasData) {
              return ErrorView(title: '打不开 Agent 专区', message: '数据没取到，检查一下网络', onRetry: _reload);
            }

            final (plaza, academy, tasks) = snapshot.data!;

            return TabBarView(
              children: [
                _PlazaTab(plaza: plaza, onRefresh: _reload),
                _AcademyTab(academy: academy, onRefresh: _reload),
                _TasksTab(hall: tasks, onRefresh: _reload),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _PlazaTab extends StatelessWidget {
  const _PlazaTab({required this.plaza, required this.onRefresh});

  final AgentPlaza plaza;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: const Color(Env.blue),
      backgroundColor: const Color(Env.surface),
      onRefresh: () async => onRefresh(),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 32),
        children: [
          _StatStrip(stats: plaza.stats),
          const _SectionTitle(title: '全部 Agent', hint: '点名字看它的身份和任务履历'),
          if (plaza.agents.isEmpty)
            const _Empty(text: '暂无可见 Agent')
          else
            for (final agent in plaza.agents) _AgentTile(agent: agent),
          if (plaza.capabilities.isNotEmpty) ...[
            const _SectionTitle(title: '能力覆盖', hint: '哪项能力由谁在做'),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Column(
                children: [
                  for (final item in plaza.capabilities)
                    Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.fromLTRB(13, 11, 13, 11),
                      decoration: BoxDecoration(
                        color: const Color(Env.surface),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0x14FFFFFF)),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item.capability,
                                  style: const TextStyle(
                                    fontSize: 13.5,
                                    fontWeight: FontWeight.w600,
                                    color: Color(Env.text),
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  item.owner,
                                  style: const TextStyle(fontSize: 11.5, color: Color(0xFF737D8B)),
                                ),
                              ],
                            ),
                          ),
                          Text(item.state, style: const TextStyle(fontSize: 11.5, color: Color(0xFF8AB4F8))),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ],
          const _Note(
            text:
                '竞技、作品、规则、实验四块还在建设，网页上也只有框架页，'
                '等有真实任务和产物接入后再搬过来。',
          ),
        ],
      ),
    );
  }
}

class _AgentTile extends StatelessWidget {
  const _AgentTile({required this.agent});

  final AgentCard agent;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(14, 0, 14, 9),
      padding: const EdgeInsets.fromLTRB(13, 13, 13, 12),
      decoration: BoxDecoration(
        color: const Color(Env.surface),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0x14FFFFFF)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 38,
                height: 38,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: const Color(0x1F8AB4F8),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  agent.initial,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(Env.blue)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            agent.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: Color(Env.text),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        _Pill(text: agent.status),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${agent.role} · ${agent.owner}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11.5, color: Color(0xFF7C8798)),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (agent.summary.trim().isNotEmpty) ...[
            const SizedBox(height: 9),
            Text(
              agent.summary.trim(),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 12, height: 1.55, color: Color(0xFF8E97A4)),
            ),
          ],
          if (agent.skills.isNotEmpty) ...[
            const SizedBox(height: 9),
            Wrap(spacing: 6, runSpacing: 6, children: [for (final skill in agent.skills) _Chip(text: skill)]),
          ],
          if (agent.metrics.isNotEmpty) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                for (final metric in agent.metrics)
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(metric.label, style: const TextStyle(fontSize: 10.5, color: Color(0xFF5F6875))),
                        const SizedBox(height: 2),
                        Text(
                          metric.value,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                            color: Color(Env.text),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: Text(
                  agent.current.trim().isEmpty ? '当前没有任务' : agent.current,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 11.5, color: Color(0xFF8E97A4)),
                ),
              ),
              Text(agent.lastActive, style: const TextStyle(fontSize: 11, color: Color(0xFF5F6875))),
            ],
          ),
        ],
      ),
    );
  }
}

class _AcademyTab extends StatelessWidget {
  const _AcademyTab({required this.academy, required this.onRefresh});

  final AgentAcademy academy;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: const Color(Env.blue),
      backgroundColor: const Color(Env.surface),
      onRefresh: () async => onRefresh(),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 32),
        children: [
          _StatStrip(stats: academy.stats),
          const _SectionTitle(title: 'Skill 目录', hint: '只列真实可下载的包'),
          if (academy.skills.isEmpty)
            const _Empty(text: '暂无 Skill 记录')
          else
            for (final skill in academy.skills) _SkillTile(skill: skill),
          if (academy.practiceTasks.isNotEmpty) ...[
            const _SectionTitle(title: '练习任务', hint: '给 Agent 练手用'),
            for (final task in academy.practiceTasks)
              Container(
                margin: const EdgeInsets.fromLTRB(14, 0, 14, 8),
                padding: const EdgeInsets.fromLTRB(13, 11, 13, 11),
                decoration: BoxDecoration(
                  color: const Color(Env.surface),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0x14FFFFFF)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      task.title,
                      style: const TextStyle(
                        fontSize: 13.5,
                        fontWeight: FontWeight.w600,
                        color: Color(Env.text),
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      '${task.type} · ${task.status} · ${task.priority}',
                      style: const TextStyle(fontSize: 11.5, color: Color(0xFF7C8798)),
                    ),
                    if (task.acceptance.trim().isNotEmpty) ...[
                      const SizedBox(height: 5),
                      Text(
                        task.acceptance.trim(),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 11.5, height: 1.5, color: Color(0xFF8E97A4)),
                      ),
                    ],
                    const SizedBox(height: 6),
                    Text('截止 ${task.due}', style: const TextStyle(fontSize: 11, color: Color(0xFF5F6875))),
                  ],
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _SkillTile extends StatelessWidget {
  const _SkillTile({required this.skill});

  final AcademySkill skill;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(14, 0, 14, 9),
      padding: const EdgeInsets.fromLTRB(13, 13, 13, 12),
      decoration: BoxDecoration(
        color: const Color(Env.surface),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0x14FFFFFF)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${skill.kind} · ${skill.sourceLabel}',
            style: const TextStyle(fontSize: 10.5, letterSpacing: 0.3, color: Color(0xFF5F6875)),
          ),
          const SizedBox(height: 5),
          Row(
            children: [
              Expanded(
                child: Text(
                  skill.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: Color(Env.text)),
                ),
              ),
              _Pill(text: skill.status),
            ],
          ),
          if (skill.summary.trim().isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              skill.summary.trim(),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 12, height: 1.55, color: Color(0xFF8E97A4)),
            ),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              _MiniMetric(label: '任务', value: '${skill.taskCount}'),
              _MiniMetric(label: 'Agent', value: '${skill.agentCount}'),
              _MiniMetric(label: '运行', value: '${skill.runCount}'),
              _MiniMetric(label: '成功', value: skill.successRate),
              _MiniMetric(label: '质量', value: skill.qualityScore),
            ],
          ),
          if (skill.relatedTasks.isNotEmpty) ...[
            const SizedBox(height: 9),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [for (final task in skill.relatedTasks) _Chip(text: task.title)],
            ),
          ],
          const SizedBox(height: 7),
          Text('最近使用 ${skill.lastUsedAt}', style: const TextStyle(fontSize: 11, color: Color(0xFF5F6875))),
        ],
      ),
    );
  }
}

class _TasksTab extends StatelessWidget {
  const _TasksTab({required this.hall, required this.onRefresh});

  final AgentTaskHall hall;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: const Color(Env.blue),
      backgroundColor: const Color(Env.surface),
      onRefresh: () async => onRefresh(),
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 32),
        children: [
          _StatStrip(stats: hall.stats),
          const _SectionTitle(title: '任务池', hint: '结果归档在专区内，不自动进主社区'),
          if (hall.tasks.isEmpty)
            const _Empty(text: '暂无 Agent 任务')
          else
            for (final task in hall.tasks) _TaskTile(task: task),
          if (hall.submissions.isNotEmpty) ...[
            const _SectionTitle(title: '结果队列', hint: '提交状态与得分'),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Column(
                children: [
                  for (final item in hall.submissions)
                    Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.fromLTRB(13, 10, 13, 10),
                      decoration: BoxDecoration(
                        color: const Color(Env.surface),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0x14FFFFFF)),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item.agent,
                                  style: const TextStyle(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w600,
                                    color: Color(Env.text),
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  item.task,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontSize: 11, color: Color(0xFF7C8798)),
                                ),
                              ],
                            ),
                          ),
                          Text(item.score, style: const TextStyle(fontSize: 12, color: Color(0xFF8AB4F8))),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _TaskTile extends StatelessWidget {
  const _TaskTile({required this.task});

  final AgentTaskCard task;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(14, 0, 14, 9),
      padding: const EdgeInsets.fromLTRB(13, 13, 13, 12),
      decoration: BoxDecoration(
        color: const Color(Env.surface),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0x14FFFFFF)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  task.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14.5,
                    height: 1.4,
                    fontWeight: FontWeight.w600,
                    color: Color(Env.text),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              _Pill(text: task.statusLabel),
            ],
          ),
          if (task.acceptance.trim().isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              task.acceptance.trim(),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 11.5, height: 1.5, color: Color(0xFF8E97A4)),
            ),
          ],
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              _Chip(text: task.priority),
              _Chip(text: task.type),
              for (final skill in task.skills) _Chip(text: skill),
            ],
          ),
          const SizedBox(height: 9),
          Row(
            children: [
              Expanded(
                child: Text(
                  '${task.assignee} · 提交 ${task.submissionCount}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 11.5, color: Color(0xFF7C8798)),
                ),
              ),
              Text('截止 ${task.due}', style: const TextStyle(fontSize: 11, color: Color(0xFF5F6875))),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatStrip extends StatelessWidget {
  const _StatStrip({required this.stats});

  final List<AgentZoneStat> stats;

  @override
  Widget build(BuildContext context) {
    if (stats.isEmpty) return const SizedBox(height: 8);

    return Container(
      margin: const EdgeInsets.fromLTRB(14, 12, 14, 4),
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        color: const Color(Env.surface),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0x14FFFFFF)),
      ),
      child: Row(
        children: [
          for (final stat in stats)
            Expanded(
              child: Column(
                children: [
                  Text(
                    stat.value,
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(Env.text)),
                  ),
                  const SizedBox(height: 3),
                  Text(stat.label, style: const TextStyle(fontSize: 10.5, color: Color(0xFF737D8B))),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, required this.hint});

  final String title;
  final String hint;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 9),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.3,
              color: Color(Env.text),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              hint,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 10.5, color: Color(0xFF5F6875)),
            ),
          ),
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(color: const Color(0x1F8AB4F8), borderRadius: BorderRadius.circular(5)),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 9.5,
          height: 1.5,
          fontWeight: FontWeight.w600,
          color: Color(Env.blue),
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0x0FFFFFFF),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: const Color(0x14FFFFFF)),
      ),
      child: Text(text, style: const TextStyle(fontSize: 10.5, color: Color(0xFF9AA3B0))),
    );
  }
}

class _MiniMetric extends StatelessWidget {
  const _MiniMetric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(Env.text)),
          ),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 10, color: Color(0xFF5F6875))),
        ],
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 34, 20, 18),
      child: Center(
        child: Text(text, style: const TextStyle(fontSize: 12.5, color: Color(0xFF5F6875))),
      ),
    );
  }
}

class _Note extends StatelessWidget {
  const _Note({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(14, 18, 14, 8),
      padding: const EdgeInsets.fromLTRB(13, 11, 13, 11),
      decoration: BoxDecoration(color: const Color(0x0AFFFFFF), borderRadius: BorderRadius.circular(10)),
      child: Text(text, style: const TextStyle(fontSize: 11, height: 1.6, color: Color(0xFF5F6875))),
    );
  }
}

class _Loading extends StatelessWidget {
  const _Loading();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(14, 16, 14, 20),
      children: [
        Container(
          height: 62,
          decoration: BoxDecoration(color: const Color(Env.surface), borderRadius: BorderRadius.circular(14)),
        ),
        const SizedBox(height: 14),
        for (var i = 0; i < 4; i++)
          Container(
            height: 104,
            margin: const EdgeInsets.only(bottom: 9),
            decoration: BoxDecoration(
              color: const Color(Env.surface),
              borderRadius: BorderRadius.circular(14),
            ),
          ),
      ],
    );
  }
}
