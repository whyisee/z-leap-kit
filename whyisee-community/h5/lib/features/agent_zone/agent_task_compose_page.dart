import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/api_exception.dart';
import '../../core/env.dart';
import 'agent_zone_repository.dart';
import 'agent_zone_widgets.dart';

/// 发任务（只有管理员）。
///
/// 网页那张表单有十几个字段（奖励策略、结果去向、人机模式、config JSON…），
/// 手机上照抄一遍只会让人放弃 —— 那些高级项服务端都有默认值，这里只留
/// 「不填就发不出去」的四项（标题、说明、验收标准、类型）和两个常用旋钮
/// （优先级、领取上限）。要精细配置的，发完去网页编辑。
class AgentTaskComposePage extends ConsumerStatefulWidget {
  const AgentTaskComposePage({super.key});

  @override
  ConsumerState<AgentTaskComposePage> createState() => _AgentTaskComposePageState();
}

/// 与服务端 `AGENT_TASK_TYPES` 同源。这里是产品定义的常量，
/// 网页上也是写死的，不走接口，免得为了四个选项多一次网络往返。
const _taskTypes = [
  ('site_content_expansion', '本站内容'),
  ('external_promotion', '外站推广'),
  ('data_collection', '数据采集'),
  ('content_creation', '内容创作'),
];

const _priorities = ['P0', 'P1', 'P2', 'P3'];

/// 截止时间用「周期」而不是日期选择器：手机上点日历选一天，
/// 比点一下「14 天」慢得多，而发任务九成就是给个周期。
const _deadlineOptions = [(0, '不设'), (3, '3 天'), (7, '7 天'), (14, '14 天'), (30, '30 天')];

class _AgentTaskComposePageState extends ConsumerState<AgentTaskComposePage> {
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _acceptance = TextEditingController();
  final _skills = TextEditingController();
  final _assignees = TextEditingController(text: '1');

  String _type = _taskTypes.first.$1;
  String _priority = 'P2';
  int _deadlineDays = 14;
  bool _publicSubmissions = true;
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _acceptance.dispose();
    _skills.dispose();
    _assignees.dispose();
    super.dispose();
  }

  Future<void> _submit({required bool draft}) async {
    if (_submitting) return;

    final title = _title.text.trim();
    final description = _description.text.trim();
    final acceptance = _acceptance.text.trim();

    // 校验规则与服务端一致：这里先拦一道，避免打个来回才发现少写了什么
    if (title.length < 4) return _toast('标题至少 4 个字');
    if (description.length < 10) return _toast('任务说明至少 10 个字');
    if (acceptance.length < 4) return _toast('请写清验收标准');

    final assignees = int.tryParse(_assignees.text.trim()) ?? 1;
    final deadline = _deadlineDays <= 0
        ? null
        : DateTime.now().add(Duration(days: _deadlineDays)).toIso8601String();

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await ref
          .read(agentZoneRepositoryProvider)
          .createTask(
            title: title,
            description: description,
            acceptanceCriteria: acceptance,
            taskType: _type,
            priority: _priority,
            maxAssignees: assignees.clamp(1, 50),
            skills: _skills.text
                .split(RegExp(r'[\n,，]+'))
                .map((item) => item.trim())
                .where((item) => item.isNotEmpty)
                .toList(growable: false),
            draft: draft,
            deadlineAt: deadline,
            publicSubmissions: _publicSubmissions,
          );

      if (!mounted) return;
      _toast(draft ? '已存为草稿' : '任务已发布');
      // 路由是 Page<void>，不要带返回值 pop
      context.pop();
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = '发布失败，稍后再试';
      });
    }
  }

  void _toast(String message) {
    ScaffoldMessenger.maybeOf(context)
      ?..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(Env.bg),
      appBar: AppBar(
        backgroundColor: const Color(Env.headerBg),
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: const Text(
          '发任务',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(Env.text)),
        ),
        iconTheme: const IconThemeData(color: Color(Env.muted)),
        actions: [
          TextButton(
            onPressed: _submitting ? null : () => _submit(draft: false),
            child: Text(
              '发布',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: _submitting ? const Color(0xFF5F6875) : const Color(Env.blue),
              ),
            ),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 32),
        children: [
          const ZoneSectionTitle(title: '基本信息'),
          ZoneCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _Field(controller: _title, hint: '标题，一句话说清要做什么'),
                const SizedBox(height: 10),
                _Field(controller: _description, hint: '任务说明：背景、范围、参考资料', minLines: 4, maxLines: 8),
                const SizedBox(height: 10),
                _Field(controller: _acceptance, hint: '验收标准：交付物要满足什么条件', minLines: 3, maxLines: 6),
              ],
            ),
          ),
          const ZoneSectionTitle(title: '类型', hint: '决定默认交付格式'),
          _ChipRow(
            options: [for (final item in _taskTypes) (item.$1, item.$2)],
            selected: _type,
            onPick: (value) => setState(() => _type = value),
          ),
          const ZoneSectionTitle(title: '优先级'),
          _ChipRow(
            options: [for (final item in _priorities) (item, item)],
            selected: _priority,
            onPick: (value) => setState(() => _priority = value),
          ),
          const ZoneSectionTitle(title: '截止'),
          _ChipRow(
            options: [for (final item in _deadlineOptions) ('${item.$1}', item.$2)],
            selected: '$_deadlineDays',
            onPick: (value) => setState(() => _deadlineDays = int.tryParse(value) ?? 0),
          ),
          const ZoneSectionTitle(title: '领取与 Skill'),
          ZoneCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const SizedBox(
                      width: 84,
                      child: Text('最多领取', style: TextStyle(fontSize: 12, color: Color(0xFF7C8798))),
                    ),
                    SizedBox(
                      width: 64,
                      child: TextField(
                        controller: _assignees,
                        keyboardType: TextInputType.number,
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 13, color: Color(Env.text)),
                        decoration: _decoration('1'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    const Text('个 Agent', style: TextStyle(fontSize: 11.5, color: Color(0xFF5F6875))),
                  ],
                ),
                const SizedBox(height: 12),
                _Field(controller: _skills, hint: '所需 Skill，逗号分隔，可不填'),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('提交结果公开', style: TextStyle(fontSize: 12.5, color: Color(Env.text))),
                          const SizedBox(height: 2),
                          Text(
                            _publicSubmissions ? '所有人能看到提交与得分' : '只有管理员能看到',
                            style: const TextStyle(fontSize: 11, color: Color(0xFF5F6875)),
                          ),
                        ],
                      ),
                    ),
                    Switch(
                      value: _publicSubmissions,
                      activeThumbColor: const Color(Env.blue),
                      onChanged: _submitting ? null : (value) => setState(() => _publicSubmissions = value),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
              child: Text(_error!, style: const TextStyle(fontSize: 12, color: Color(0xFFE0846B))),
            ),
          const ZoneNote(
            text:
                '发布后任务立刻进任务池，Agent 通过 MCP 领取。'
                '奖励策略、结果去向、人机模式这些高级项用服务端默认值，'
                '需要改就到网页版编辑。',
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 6, 14, 0),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _submitting ? null : () => _submit(draft: true),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF9AA3B0),
                      side: const BorderSide(color: Color(0x1FFFFFFF)),
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: const Text('存草稿', style: TextStyle(fontSize: 13.5)),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  flex: 2,
                  child: FilledButton(
                    onPressed: _submitting ? null : () => _submit(draft: false),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(Env.blue),
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: Text(
                      _submitting ? '提交中…' : '发布任务',
                      style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700),
                    ),
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

InputDecoration _decoration(String hint) => InputDecoration(
  hintText: hint,
  hintStyle: const TextStyle(fontSize: 12.5, color: Color(0xFF4C5563)),
  isDense: true,
  contentPadding: const EdgeInsets.symmetric(horizontal: 11, vertical: 11),
  filled: true,
  fillColor: const Color(0x0AFFFFFF),
  border: OutlineInputBorder(
    borderRadius: BorderRadius.circular(9),
    borderSide: const BorderSide(color: Color(0x14FFFFFF)),
  ),
  enabledBorder: OutlineInputBorder(
    borderRadius: BorderRadius.circular(9),
    borderSide: const BorderSide(color: Color(0x14FFFFFF)),
  ),
  focusedBorder: OutlineInputBorder(
    borderRadius: BorderRadius.circular(9),
    borderSide: const BorderSide(color: Color(0x668AB4F8)),
  ),
);

class _Field extends StatelessWidget {
  const _Field({required this.controller, required this.hint, this.minLines = 1, this.maxLines = 1});

  final TextEditingController controller;
  final String hint;
  final int minLines;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      minLines: minLines,
      maxLines: maxLines,
      style: const TextStyle(fontSize: 13, height: 1.55, color: Color(Env.text)),
      decoration: _decoration(hint),
    );
  }
}

class _ChipRow extends StatelessWidget {
  const _ChipRow({required this.options, required this.selected, required this.onPick});

  final List<(String, String)> options;
  final String selected;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: Wrap(
        spacing: 7,
        runSpacing: 7,
        children: [
          for (final option in options)
            GestureDetector(
              onTap: () => onPick(option.$1),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 6),
                decoration: BoxDecoration(
                  color: option.$1 == selected ? const Color(0x1F8AB4F8) : const Color(0x0AFFFFFF),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: option.$1 == selected ? const Color(0x668AB4F8) : const Color(0x14FFFFFF),
                  ),
                ),
                child: Text(
                  option.$2,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: option.$1 == selected ? FontWeight.w600 : FontWeight.w400,
                    color: option.$1 == selected ? const Color(Env.blue) : const Color(0xFF9AA3B0),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
