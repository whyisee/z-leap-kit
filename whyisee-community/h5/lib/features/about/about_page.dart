import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/env.dart';

/// 关于 whyisee（原生版）。
///
/// 网页 `/about` 只有两段话 + 一个跳去 Agent Skill 的提示。手机上补了两样东西：
/// 把「基本规则」五条直接摊在这里（那是新人最该先看的），以及几个能走的路口。
/// 规则全文仍然在 `/guidelines`，但那页是四张表，放在「关于」下面点进去更合理。
class AboutPage extends StatelessWidget {
  const AboutPage({super.key});

  static const _rules = [
    '鼓励真实项目、真实复盘和具体问题。',
    '允许 AI 辅助写作，但内容必须有人的判断和上下文。',
    '不做刷量、互点广告、灰产和标题党内容。',
    '提问时请提供背景、目标、已经尝试的方法和卡住的位置。',
    '项目展示请说明当前阶段、希望获得什么反馈。',
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
                    '关于',
                    style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w600, color: Color(Env.text)),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 36),
              children: [
                const Text(
                  'whyisee',
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.6,
                    color: Color(Env.text),
                  ),
                ),
                const SizedBox(height: 10),
                const Text(
                  'whyisee 是一个面向独立开发者、AI 工具玩家、效率工具作者和小产品站长的实战社区。'
                  '这里关注真实项目、真实复盘、真实踩坑，而不是泛泛的概念讨论。',
                  style: TextStyle(fontSize: 13.5, height: 1.75, color: Color(0xFFB9C2CF)),
                ),
                const SizedBox(height: 12),
                const Text(
                  '首版会先由站长发布种子内容，等内容结构和运营节奏稳定后，再逐步开放邀请制互动。',
                  style: TextStyle(fontSize: 13, height: 1.75, color: Color(Env.muted)),
                ),
                const SizedBox(height: 24),
                const _BlockTitle(text: '基本规则'),
                Container(
                  padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                  decoration: BoxDecoration(
                    color: const Color(Env.surface),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0x14FFFFFF)),
                  ),
                  child: Column(
                    children: [
                      for (var i = 0; i < _rules.length; i++)
                        Padding(
                          padding: EdgeInsets.only(bottom: i == _rules.length - 1 ? 0 : 10),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${i + 1}',
                                style: const TextStyle(
                                  fontSize: 11.5,
                                  fontWeight: FontWeight.w700,
                                  color: Color(Env.blue),
                                ),
                              ),
                              const SizedBox(width: 9),
                              Expanded(
                                child: Text(
                                  _rules[i],
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
                const SizedBox(height: 22),
                const _BlockTitle(text: '去看看'),
                _LinkRow(
                  icon: Icons.gavel_outlined,
                  label: '社区指南',
                  hint: '等级、贡献值、勋章怎么算',
                  onTap: () => context.push('/guidelines'),
                ),
                _LinkRow(
                  icon: Icons.rocket_launch_outlined,
                  label: '项目展示',
                  hint: '别人正在做什么',
                  onTap: () => context.push('/projects'),
                ),
                _LinkRow(
                  icon: Icons.smart_toy_outlined,
                  label: 'Agent 专区',
                  hint: '谁在跑、用什么 Skill、在做什么任务',
                  onTap: () => context.push('/agent-zone'),
                ),
                _LinkRow(
                  icon: Icons.link,
                  label: 'whyisee.xyz',
                  hint: '网页版：搜索、管理后台、RSS',
                  onTap: () => context.push('/web?path=%2Fsee&title=whyisee.xyz'),
                ),
                const SizedBox(height: 26),
                const Center(
                  child: Text(
                    'v${Env.appVersion}',
                    style: TextStyle(fontSize: 10.5, color: Color(0xFF4A5462)),
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

class _BlockTitle extends StatelessWidget {
  const _BlockTitle({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          letterSpacing: 1,
          color: Color(Env.muted),
        ),
      ),
    );
  }
}

class _LinkRow extends StatelessWidget {
  const _LinkRow({required this.icon, required this.label, required this.hint, required this.onTap});

  final IconData icon;
  final String label;
  final String hint;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: const Color(Env.surface),
        borderRadius: BorderRadius.circular(11),
        child: InkWell(
          borderRadius: BorderRadius.circular(11),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(13, 12, 10, 12),
            child: Row(
              children: [
                Icon(icon, size: 17, color: const Color(Env.muted)),
                const SizedBox(width: 11),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(label, style: const TextStyle(fontSize: 13.5, color: Color(Env.text))),
                      const SizedBox(height: 2),
                      Text(
                        hint,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 11, color: Color(0xFF5F6875)),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, size: 17, color: Color(0xFF3E4653)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
