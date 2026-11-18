import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/api_exception.dart';
import '../../core/api/models.dart';
import '../../core/env.dart';
import '../../core/format.dart';
import '../../core/providers.dart';
import '../../shared/widgets/markdown_editor.dart';
import 'compose_repository.dart';

/// 原生发布页。
///
/// 刻意不复用网页 `/new-topic`：那套是桌面两栏表单，手机上要横向滚动。
/// 这里只有三行东西 —— 标题、分区、正文。分区（类型 + 分类）收成一行，
/// 点开才展开选项，页面剩下的全部给正文，写作时不被选项打断。
class ComposePage extends ConsumerStatefulWidget {
  const ComposePage({super.key});

  @override
  ConsumerState<ComposePage> createState() => _ComposePageState();
}

class _ComposePageState extends ConsumerState<ComposePage> {
  final _titleController = TextEditingController();
  final _bodyController = MarkdownEditingController();
  final _tagController = TextEditingController();

  /// 一次会话固定一个幂等 id：重试不会发两篇
  final _requestId = newComposeRequestId();

  int? _categoryId;
  String _type = 'discussion';
  bool _submitting = false;
  String? _titleError;

  @override
  void dispose() {
    _titleController.dispose();
    _bodyController.dispose();
    _tagController.dispose();
    super.dispose();
  }

  bool get _hasContent =>
      _titleController.text.trim().isNotEmpty || _bodyController.text.trim().isNotEmpty;

  List<String> get _tags => _tagController.text
      .split(RegExp(r'[,，\s]+'))
      .map((tag) => tag.trim())
      .where((tag) => tag.isNotEmpty)
      .take(5)
      .toList(growable: false);

  /// 用户没进分区弹层时的默认分类：第一个。和提交兜底用的是同一个值，
  /// 所以分区行显示什么，发出去就是什么，不会「看着是 A 发出去是 B」。
  int? _defaultCategoryId(Taxonomy? taxonomy) {
    if (taxonomy == null || taxonomy.categories.isEmpty) return null;
    return taxonomy.categories.first.id;
  }

  int? _effectiveCategoryId(Taxonomy? taxonomy) => _categoryId ?? _defaultCategoryId(taxonomy);

  Future<void> _openZoneSheet() async {
    final taxonomy = ref.read(taxonomyProvider).asData?.value;
    final categoryId = _effectiveCategoryId(taxonomy);

    if (taxonomy == null) {
      _toast('选项还没加载出来，稍等一下');
      return;
    }
    if (categoryId == null) {
      _toast('还没有可选的分区');
      return;
    }

    final picked = await showModalBottomSheet<_ZoneSelection>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ZoneSheet(
        taxonomy: taxonomy,
        type: _type,
        categoryId: categoryId,
        tags: _tagController.text,
      ),
    );

    if (picked == null || !mounted) return;
    setState(() {
      _type = picked.type;
      _categoryId = picked.categoryId;
      _tagController.text = picked.tags;
    });
  }

  Future<void> _submit({required bool draft}) async {
    if (_submitting) return;

    final title = _titleController.text.trim();
    final body = _bodyController.text.trim();
    final taxonomy = ref.read(taxonomyProvider).asData?.value;

    // 前端先挡一次，省得为了一个错字跑一趟网络
    if (title.length < 4) {
      setState(() => _titleError = '标题至少 4 个字');
      return;
    }
    if (!draft && body.length < 10) {
      _toast('正文至少 10 个字');
      return;
    }
    if (body.isEmpty && draft) {
      _toast('空草稿不用存');
      return;
    }

    final categoryId = _effectiveCategoryId(taxonomy);
    if (categoryId == null) {
      _toast('分类还没加载出来，稍等一下');
      return;
    }

    setState(() {
      _submitting = true;
      _titleError = null;
    });

    try {
      final result = await ref.read(composeRepositoryProvider).submit(
            title: title,
            contentMarkdown: body,
            categoryId: categoryId,
            type: _type,
            tags: _tags,
            draft: draft,
            requestId: _requestId,
          );

      if (!mounted) return;
      _toast(result.isDraft ? '已存为草稿' : '已提交，审核通过后公开');
      // 路由声明的是 Page<void>，不要带返回值 pop，否则 debug 下会类型断言失败
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _titleError = e.fields?['title'];
      });
      _toast(e.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _submitting = false);
      _toast('发布失败，检查网络后再试');
    }
  }

  void _toast(String message) {
    ScaffoldMessenger.maybeOf(context)
      ?..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          duration: const Duration(seconds: 2),
          behavior: SnackBarBehavior.floating,
        ),
      );
  }

  /// 有内容又没发出去时，返回要确认一次 —— 手机上误触返回键太常见了。
  Future<bool> _confirmDiscard() async {
    if (_submitting) return false;
    if (!_hasContent) return true;

    final discard = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(Env.surface),
        title: const Text('放弃这次编辑？', style: TextStyle(fontSize: 15, color: Color(Env.text))),
        content: const Text(
          '内容还没有提交，返回会丢掉。',
          style: TextStyle(fontSize: 13, color: Color(Env.muted)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('继续写', style: TextStyle(color: Color(Env.muted))),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('放弃', style: TextStyle(color: Color(0xFFF0A868))),
          ),
        ],
      ),
    );

    return discard ?? false;
  }

  /// 分区行上显示的文字，例如「讨论 · 技术」
  String _zoneLabel(Taxonomy? taxonomy) {
    final typeLabel = taxonomy?.types
            .firstWhere(
              (type) => type.id == _type,
              orElse: () => const TaxonomyType(id: 'discussion', label: '讨论'),
            )
            .label ??
        '讨论';

    final categoryId = _effectiveCategoryId(taxonomy);
    if (categoryId == null) return typeLabel;

    final category = taxonomy!.categories.firstWhere(
      (item) => item.id == categoryId,
      orElse: () => taxonomy.categories.first,
    );
    return '$typeLabel · ${category.name}';
  }

  @override
  Widget build(BuildContext context) {
    // 没登录就不让进编辑器：写完再被 401 挡回来，比一开始就说清楚更伤人
    if (!ref.watch(sessionProvider).isSignedIn) return const _LoginWall();

    final taxonomy = ref.watch(taxonomyProvider);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        if (await _confirmDiscard() && context.mounted) {
          context.pop();
        }
      },
      child: Scaffold(
        backgroundColor: const Color(Env.bg),
        body: SafeArea(
          child: Column(
            children: [
              _Bar(
                submitting: _submitting,
                canSubmit: !_submitting,
                onClose: () async {
                  if (await _confirmDiscard() && context.mounted) context.pop();
                },
                onDraft: () => _submit(draft: true),
                onSubmit: () => _submit(draft: false),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                      child: TextField(
                        controller: _titleController,
                        enabled: !_submitting,
                        maxLines: null,
                        textInputAction: TextInputAction.next,
                        style: const TextStyle(
                          fontSize: 19,
                          height: 1.4,
                          fontWeight: FontWeight.w700,
                          color: Color(Env.text),
                        ),
                        onChanged: (_) {
                          if (_titleError != null) setState(() => _titleError = null);
                        },
                        decoration: InputDecoration(
                          hintText: '标题，写清楚在说什么',
                          hintStyle: const TextStyle(
                            fontSize: 19,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF4A5462),
                          ),
                          border: InputBorder.none,
                          contentPadding: EdgeInsets.zero,
                          errorText: _titleError,
                          errorStyle: const TextStyle(fontSize: 11.5, color: Color(0xFFF0A868)),
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Container(height: 1, color: const Color(Env.line)),
                    ),
                    _ZoneRow(
                      label: _zoneLabel(taxonomy.asData?.value),
                      loading: taxonomy.isLoading,
                      tagCount: _tags.length,
                      enabled: !_submitting,
                      onTap: _openZoneSheet,
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Container(height: 1, color: const Color(Env.line)),
                    ),
                    Expanded(
                      child: MarkdownEditor(
                        controller: _bodyController,
                        enabled: !_submitting,
                        hintText: '开始写正文，标题、加粗都能点下面按钮',
                        onChanged: (_) {
                          // 正文变化要刷新返回确认逻辑（_hasContent）
                          setState(() {});
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 分区一行：左边标签，右边当前值，点整行开弹层。
class _ZoneRow extends StatelessWidget {
  const _ZoneRow({
    required this.label,
    required this.loading,
    required this.tagCount,
    required this.enabled,
    required this.onTap,
  });

  final String label;
  final bool loading;
  final int tagCount;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: enabled ? onTap : null,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 11, 10, 11),
        child: Row(
          children: [
            const Text(
              '分区',
              style: TextStyle(fontSize: 12.5, color: Color(0xFF737D8B)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: loading
                  ? const Align(
                      alignment: Alignment.centerLeft,
                      child: SizedBox(
                        width: 12,
                        height: 12,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Color(Env.muted),
                        ),
                      ),
                    )
                  : Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Color(Env.blue),
                      ),
                    ),
            ),
            if (tagCount > 0)
              Text(
                '$tagCount 个标签',
                style: const TextStyle(fontSize: 11.5, color: Color(0xFF5F6875)),
              ),
            const Icon(Icons.chevron_right, size: 18, color: Color(0xFF5F6875)),
          ],
        ),
      ),
    );
  }
}

class _ZoneSelection {
  const _ZoneSelection({required this.type, required this.categoryId, required this.tags});

  final String type;
  final int categoryId;
  final String tags;
}

/// 分区弹层：类型 + 分类 + 标签都收在这里。
///
/// 点「完成」才回传 —— 中途划掉就当作没动过，不会把用户的选择半途改掉。
class _ZoneSheet extends StatefulWidget {
  const _ZoneSheet({
    required this.taxonomy,
    required this.type,
    required this.categoryId,
    required this.tags,
  });

  final Taxonomy taxonomy;
  final String type;
  final int categoryId;
  final String tags;

  @override
  State<_ZoneSheet> createState() => _ZoneSheetState();
}

class _ZoneSheetState extends State<_ZoneSheet> {
  late String _type = widget.type;
  late int _categoryId = widget.categoryId;
  late final _tagController = TextEditingController(text: widget.tags);

  @override
  void dispose() {
    _tagController.dispose();
    super.dispose();
  }

  void _done() {
    Navigator.of(context).pop(
      _ZoneSelection(type: _type, categoryId: _categoryId, tags: _tagController.text),
    );
  }

  @override
  Widget build(BuildContext context) {
    final types = widget.taxonomy.types.isEmpty
        ? const [TaxonomyType(id: 'discussion', label: '讨论')]
        : widget.taxonomy.types;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: Color(Env.surface),
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        ),
        constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.72),
        child: SafeArea(
          top: false,
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                Center(
                  child: Container(
                    width: 34,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(Env.line),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    const Text(
                      '分区',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: Color(Env.text),
                      ),
                    ),
                    const Spacer(),
                    TextButton(
                      onPressed: _done,
                      style: TextButton.styleFrom(
                        foregroundColor: const Color(Env.blue),
                        minimumSize: const Size(0, 32),
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                      ),
                      child: const Text(
                        '完成',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                const _SheetLabel('类型'),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final type in types)
                      _Chip(
                        label: type.label,
                        active: type.id == _type,
                        onTap: () => setState(() => _type = type.id),
                      ),
                  ],
                ),
                const SizedBox(height: 18),
                const _SheetLabel('分类'),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final category in widget.taxonomy.categories)
                      _Chip(
                        label: category.name,
                        color: category.color,
                        active: category.id == _categoryId,
                        onTap: () => setState(() => _categoryId = category.id),
                      ),
                  ],
                ),
                const SizedBox(height: 18),
                const _SheetLabel('标签（可选，逗号分隔，最多 5 个）'),
                const SizedBox(height: 4),
                TextField(
                  controller: _tagController,
                  maxLines: 1,
                  style: const TextStyle(fontSize: 13.5, color: Color(Env.text)),
                  decoration: const InputDecoration(
                    hintText: '例如：Flutter, 独立开发',
                    hintStyle: TextStyle(fontSize: 13, color: Color(0xFF4A5462)),
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.zero,
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

class _SheetLabel extends StatelessWidget {
  const _SheetLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 11,
        height: 1.3,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.3,
        color: Color(0xFF737D8B),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
    required this.label,
    required this.active,
    required this.onTap,
    this.color,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;
  final String? color;

  @override
  Widget build(BuildContext context) {
    final dot = colorFromHex(color);

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        height: 32,
        padding: const EdgeInsets.symmetric(horizontal: 13),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: active ? const Color(Env.blue).withValues(alpha: 0.16) : const Color(Env.panel),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: active ? const Color(Env.blue).withValues(alpha: 0.55) : const Color(Env.line),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (color != null) ...[
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(color: dot, shape: BoxShape.circle),
              ),
              const SizedBox(width: 6),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 12.5,
                height: 1.1,
                fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                color: active ? const Color(Env.blue) : const Color(0xFFA8B2BF),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 未登录时的拦截页：编辑器不出现，只留一条明确的路。
class _LoginWall extends StatelessWidget {
  const _LoginWall();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(Env.bg),
      body: SafeArea(
        child: Column(
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: IconButton(
                onPressed: () => context.pop(),
                iconSize: 21,
                color: const Color(Env.text),
                icon: const Icon(Icons.close),
                tooltip: '关闭',
              ),
            ),
            Expanded(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 32),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 56,
                        height: 56,
                        alignment: Alignment.center,
                        decoration: const BoxDecoration(
                          color: Color(Env.panel),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.edit_outlined, size: 24, color: Color(Env.muted)),
                      ),
                      const SizedBox(height: 14),
                      const Text(
                        '登录后才能写',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: Color(Env.text),
                        ),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        '发帖需要署名，登录后草稿也会跟着账号走。',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 12.5, height: 1.6, color: Color(Env.muted)),
                      ),
                      const SizedBox(height: 18),
                      FilledButton(
                        onPressed: () => context.push(
                          '/web?path=${Uri.encodeComponent('/login')}&title=${Uri.encodeComponent('登录')}',
                        ),
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(Env.blue),
                          foregroundColor: const Color(0xFF0D1016),
                          minimumSize: const Size(160, 42),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: const Text(
                          '去登录',
                          style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Bar extends StatelessWidget {
  const _Bar({
    required this.submitting,
    required this.canSubmit,
    required this.onClose,
    required this.onDraft,
    required this.onSubmit,
  });

  final bool submitting;
  final bool canSubmit;
  final VoidCallback onClose;
  final VoidCallback onDraft;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 50,
      padding: const EdgeInsets.symmetric(horizontal: 6),
      decoration: const BoxDecoration(
        color: Color(Env.bg),
        border: Border(bottom: BorderSide(color: Color(Env.line), width: 1)),
      ),
      child: Row(
        children: [
          IconButton(
            onPressed: submitting ? null : onClose,
            iconSize: 21,
            color: const Color(Env.text),
            icon: const Icon(Icons.close),
            tooltip: '关闭',
          ),
          const Text(
            '写文章',
            style: TextStyle(
              fontSize: 14.5,
              fontWeight: FontWeight.w700,
              color: Color(Env.text),
            ),
          ),
          const Spacer(),
          TextButton(
            onPressed: submitting ? null : onDraft,
            style: TextButton.styleFrom(
              foregroundColor: const Color(Env.muted),
              minimumSize: const Size(0, 34),
              padding: const EdgeInsets.symmetric(horizontal: 10),
            ),
            child: const Text('存草稿', style: TextStyle(fontSize: 12.5)),
          ),
          const SizedBox(width: 2),
          FilledButton(
            onPressed: canSubmit ? onSubmit : null,
            style: FilledButton.styleFrom(
              backgroundColor: const Color(Env.blue),
              foregroundColor: const Color(0xFF0D1016),
              minimumSize: const Size(0, 32),
              padding: const EdgeInsets.symmetric(horizontal: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(9)),
            ),
            child: submitting
                ? const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0D1016)),
                  )
                : const Text(
                    '发布',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                  ),
          ),
          const SizedBox(width: 6),
        ],
      ),
    );
  }
}
