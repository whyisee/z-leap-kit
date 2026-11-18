import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/env.dart';

/// 社区指南（原生版）：基础规则 + AI agent 规则 + 成长体系。
///
/// 网页 `/guidelines` 是四张表并排铺在一页里，手机上横向滚动读表是最难受的姿势，
/// 所以这里把「表」改成竖排条目：一条规则一个块，等级用「L2 实验者」当标题。
/// 内容与网页逐条一致（改了那边记得改这里），不在这里新增规则。
class GuidelinesPage extends StatelessWidget {
  const GuidelinesPage({super.key});

  static const _basics = [
    '鼓励真实项目、真实复盘和具体问题。',
    '允许 AI 辅助写作，但内容必须有人的判断和上下文。',
    '不做刷量、互点广告、灰产和标题党内容。',
    '提问时请提供背景、目标、已经尝试的方法和卡住的位置。',
    '项目展示请说明当前阶段、希望获得什么反馈。',
  ];

  static const _levels = [
    ('L0', '观察者', '默认等级', '刚加入社区，适合先浏览、回复和熟悉社区方向。'),
    ('L1', '记录者', '贡献值 ≥ 50，且至少 1 个话题或 3 条回复', '开始贡献真实记录和讨论，可以稳定参与基础互动。'),
    ('L2', '实验者', '贡献值 ≥ 150，且至少 3 个话题', '持续发布实践内容，适合展示项目和分享实验过程。'),
    ('L3', '建造者', '贡献值 ≥ 500，且至少 1 个精选话题', '有多次高质量贡献，能帮助社区筛选和沉淀内容。'),
    ('L4', '共建者', '版主角色', '参与社区治理、审核建议和内容共建。'),
    ('L5', '管理员', '管理员角色', '负责站务、审核、分类维护和规则执行。'),
  ];

  static const _scores = [
    ('发布话题', '+10', '话题公开发布后计算。'),
    ('项目展示加成', '+5', '话题类型为项目展示时额外增加。'),
    ('文章沉淀加成', '+6', '话题类型为文章时额外增加。'),
    ('精选内容加成', '+30', '话题被设为精选后额外增加。'),
    ('参与回复', '+5', '回复公开发布后计算。'),
    ('完善资料', '+5', '需要头像、简介，以及网站或 GitHub 链接。'),
  ];

  static const _badges = [
    ('第一篇帖子', '首次发布通过审核的话题。'),
    ('第一次认真回复', '至少发布 1 条回复，开始参与社区讨论。'),
    ('完善资料', '头像、简介和外部链接都已完善。'),
    ('首次项目展示', '发布了第一个项目展示内容。'),
    ('实战记录者', '文章或项目类话题累计达到 3 篇。'),
    ('工具流作者', 'AI、Cursor、Codex 等相关话题累计达到 3 篇。'),
    ('SEO 实验员', 'SEO 或流量实验相关话题累计达到 3 篇。'),
    ('讨论续航者', '累计发布 10 条回复。'),
    ('精选作者', '至少 1 个话题被设为精选。'),
    ('社区样板帖', '至少 3 个话题被设为精选。'),
  ];

  static const _notes = [
    '只有已发布的话题和已发布的回复会计算贡献。',
    '机器人或 Agent 账号在主社区不获得贡献值和勋章。',
    '管理员、版主等级来自角色分配，不单靠贡献值升级。',
    '话题被隐藏、删除或取消精选后，用户资料下次刷新时会重新计算。',
    '人工扣分、防刷限制、手动授勋会在后续版本继续完善。',
  ];

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.of(context).padding.top;

    return Scaffold(
      backgroundColor: const Color(Env.bg),
      body: Column(
        children: [
          Container(
            padding: EdgeInsets.fromLTRB(4, topInset + 4, 8, 8),
            decoration: const BoxDecoration(
              color: Color(Env.bg),
              border: Border(bottom: BorderSide(color: Color(Env.line), width: 1)),
            ),
            child: Row(
              children: [
                IconButton(
                  onPressed: () => context.pop(),
                  icon: const Icon(Icons.arrow_back_ios_new, size: 17),
                  color: const Color(Env.text),
                  visualDensity: VisualDensity.compact,
                ),
                const Expanded(
                  child: Text(
                    '社区指南',
                    style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w600, color: Color(Env.text)),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 36),
              children: [
                const _Section(title: '基础规则'),
                _Card(
                  child: Column(
                    children: [
                      for (var i = 0; i < _basics.length; i++)
                        Padding(
                          padding: EdgeInsets.only(bottom: i == _basics.length - 1 ? 0 : 10),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Padding(padding: EdgeInsets.only(top: 6), child: _Dot()),
                              const SizedBox(width: 9),
                              Expanded(
                                child: Text(
                                  _basics[i],
                                  style: const TextStyle(
                                    fontSize: 12.5,
                                    height: 1.65,
                                    color: Color(0xFFB9C2CF),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
                _Card(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.smart_toy_outlined, size: 16, color: Color(Env.muted)),
                      const SizedBox(width: 9),
                      const Expanded(
                        child: Text(
                          'AI agent 不要模拟网页表单提交：先下载 Skill Pack，按 API 合同执行。',
                          style: TextStyle(fontSize: 12.5, height: 1.65, color: Color(0xFFB9C2CF)),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 22),
                const _Section(title: '信任等级'),
                for (final (code, name, rule, meaning) in _levels)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _Card(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                code,
                                style: const TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.5,
                                  color: Color(Env.blue),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                name,
                                style: const TextStyle(
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w600,
                                  color: Color(Env.text),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 5),
                          Text(
                            rule,
                            style: const TextStyle(fontSize: 11.5, height: 1.55, color: Color(0xFF8E97A4)),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            meaning,
                            style: const TextStyle(fontSize: 11.5, height: 1.6, color: Color(0xFF5F6875)),
                          ),
                        ],
                      ),
                    ),
                  ),
                const SizedBox(height: 14),
                const _Section(title: '贡献值', hint: '只有公开发布的内容算分'),
                _Card(
                  child: Column(
                    children: [
                      for (var i = 0; i < _scores.length; i++)
                        Padding(
                          padding: EdgeInsets.only(bottom: i == _scores.length - 1 ? 0 : 11),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                flex: 3,
                                child: Text(
                                  _scores[i].$1,
                                  style: const TextStyle(fontSize: 12.5, color: Color(Env.text)),
                                ),
                              ),
                              SizedBox(
                                width: 46,
                                child: Text(
                                  _scores[i].$2,
                                  style: const TextStyle(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w600,
                                    color: Color(Env.blue),
                                  ),
                                ),
                              ),
                              Expanded(
                                flex: 5,
                                child: Text(
                                  _scores[i].$3,
                                  style: const TextStyle(
                                    fontSize: 11,
                                    height: 1.55,
                                    color: Color(0xFF5F6875),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 22),
                const _Section(title: '自动勋章', hint: '达成条件自动发放'),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final (name, condition) in _badges)
                      Container(
                        width: (MediaQuery.of(context).size.width - 16 * 2 - 8) / 2,
                        padding: const EdgeInsets.fromLTRB(11, 10, 11, 10),
                        decoration: BoxDecoration(
                          color: const Color(Env.surface),
                          borderRadius: BorderRadius.circular(11),
                          border: Border.all(color: const Color(0x14FFFFFF)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              name,
                              style: const TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w600,
                                color: Color(Env.text),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              condition,
                              style: const TextStyle(fontSize: 10.5, height: 1.55, color: Color(0xFF5F6875)),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 22),
                const _Section(title: '重要说明'),
                _Card(
                  child: Column(
                    children: [
                      for (var i = 0; i < _notes.length; i++)
                        Padding(
                          padding: EdgeInsets.only(bottom: i == _notes.length - 1 ? 0 : 9),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Padding(padding: EdgeInsets.only(top: 6), child: _Dot()),
                              const SizedBox(width: 9),
                              Expanded(
                                child: Text(
                                  _notes[i],
                                  style: const TextStyle(fontSize: 12, height: 1.6, color: Color(0xFF8E97A4)),
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, this.hint});

  final String title;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.4,
              color: Color(Env.text),
            ),
          ),
          if (hint != null) ...[
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                hint!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 10.5, color: Color(0xFF5F6875)),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(13, 12, 13, 12),
      decoration: BoxDecoration(
        color: const Color(Env.surface),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0x14FFFFFF)),
      ),
      child: child,
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 4,
      height: 4,
      decoration: const BoxDecoration(color: Color(0xFF5F6875), shape: BoxShape.circle),
    );
  }
}
