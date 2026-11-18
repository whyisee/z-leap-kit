import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/api_exception.dart';
import '../../core/api/models.dart';
import '../../core/env.dart';
import '../errors/error_view.dart';
import 'search_repository.dart';

/// 原生搜索页。
///
/// 网页 `/search` 是把结果按「话题 / 回复 / 用户 / 标签」平铺成长列表，手机上
/// 一屏只能看到一个块，分组边界完全看不见。这里改成：
/// - 输入就搜（350ms 防抖），不用先按回车看到结果；
/// - 结果按类型分组，组头写「话题 · 12」，扫一眼知道有多少；
/// - 话题和用户直接进原生页，分类 / 标签这类还是走网页（原生页还没做）。
class SearchPage extends ConsumerStatefulWidget {
  const SearchPage({super.key, this.initialQuery});

  final String? initialQuery;

  @override
  ConsumerState<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends ConsumerState<SearchPage> {
  final _input = TextEditingController();
  final _focus = FocusNode();

  Timer? _debounce;
  SearchOutcome? _outcome;
  String? _error;
  String? _failedTerm;
  bool _loading = false;

  /// 请求序号：输入快时会有多个在飞，只认最后一次的结果
  int _seq = 0;

  static const _hints = ['Markdown 编辑器', 'AI Agent', '设计', '独立开发'];

  @override
  void initState() {
    super.initState();
    final initial = widget.initialQuery?.trim();
    if (initial != null && initial.isNotEmpty) {
      _input.text = initial;
      _run(initial);
    } else {
      // 进来先聚焦，别让用户再点一下输入框
      WidgetsBinding.instance.addPostFrameCallback((_) => _focus.requestFocus());
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _input.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();

    final term = value.trim();
    if (term.isEmpty) {
      setState(() {
        _outcome = null;
        _error = null;
        _loading = false;
      });
      return;
    }

    // 每次敲键都发请求会把接口打满，也会让结果在打字过程中乱跳
    _debounce = Timer(const Duration(milliseconds: 350), () => _run(term));
  }

  Future<void> _run(String term) async {
    final seq = ++_seq;
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final outcome = await ref.read(searchRepositoryProvider).search(term);
      if (!mounted || seq != _seq) return;
      setState(() {
        _outcome = outcome;
        _failedTerm = null;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted || seq != _seq) return;
      setState(() {
        _error = error.statusCode == 404
            ? '线上还没有搜索接口，部署后这里就能搜了。'
            : error.message;
        _failedTerm = term;
        _loading = false;
      });
    } catch (error) {
      if (!mounted || seq != _seq) return;
      setState(() {
        _error = '搜索失败了，检查一下网络再试';
        _failedTerm = term;
        _loading = false;
      });
    }
  }

  void _open(SearchHit hit) {
    // 收起键盘再跳，否则返回时键盘还压着
    _focus.unfocus();

    final native = hit.nativePath;
    if (native != null) {
      context.push(native);
      return;
    }

    context.push(
      '/web?path=${Uri.encodeComponent(hit.href)}&title=${Uri.encodeComponent(hit.kindLabel)}',
    );
  }

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.of(context).padding.top;

    return Scaffold(
      backgroundColor: const Color(Env.bg),
      body: Column(
        children: [
          _SearchBar(
            topInset: topInset,
            controller: _input,
            focusNode: _focus,
            onChanged: _onChanged,
            onSubmitted: (value) {
              final term = value.trim();
              if (term.isEmpty) return;
              _debounce?.cancel();
              _run(term);
            },
            onCancel: () => context.pop(),
            onClear: () {
              _input.clear();
              _onChanged('');
              _focus.requestFocus();
            },
          ),
          if (_loading) const _ProgressLine(),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_error != null) {
      return ErrorView(
        title: '搜索没成功',
        message: _error!,
        onRetry: () => _run(_failedTerm ?? (widget.initialQuery ?? '')),
      );
    }

    final outcome = _outcome;
    if (outcome == null) return _Hints(hints: _hints, onPick: _pick);

    if (outcome.hits.isEmpty) {
      return _EmptyState(term: outcome.q);
    }

    return _ResultList(outcome: outcome, onOpen: _open);
  }

  void _pick(String hint) {
    _input.text = hint;
    _input.selection = TextSelection.collapsed(offset: hint.length);
    _debounce?.cancel();
    _run(hint);
  }
}

class _SearchBar extends StatelessWidget {
  const _SearchBar({
    required this.topInset,
    required this.controller,
    required this.focusNode,
    required this.onChanged,
    required this.onSubmitted,
    required this.onCancel,
    required this.onClear,
  });

  final double topInset;
  final TextEditingController controller;
  final FocusNode focusNode;
  final ValueChanged<String> onChanged;
  final ValueChanged<String> onSubmitted;
  final VoidCallback onCancel;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(12, topInset + 8, 6, 10),
      decoration: const BoxDecoration(
        color: Color(Env.bg),
        border: Border(bottom: BorderSide(color: Color(Env.line), width: 1)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Container(
              height: 38,
              decoration: BoxDecoration(
                color: const Color(Env.surface),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0x1AFFFFFF)),
              ),
              child: Row(
                children: [
                  const SizedBox(width: 10),
                  const Icon(Icons.search, size: 17, color: Color(Env.muted)),
                  const SizedBox(width: 6),
                  Expanded(
                    child: TextField(
                      controller: controller,
                      focusNode: focusNode,
                      autofocus: true,
                      textInputAction: TextInputAction.search,
                      onChanged: onChanged,
                      onSubmitted: onSubmitted,
                      style: const TextStyle(fontSize: 14, color: Color(Env.text)),
                      cursorColor: const Color(Env.blue),
                      decoration: const InputDecoration(
                        isDense: true,
                        border: InputBorder.none,
                        hintText: '搜话题、回复、用户',
                        hintStyle: TextStyle(fontSize: 13.5, color: Color(Env.muted)),
                        contentPadding: EdgeInsets.symmetric(vertical: 10),
                      ),
                    ),
                  ),
                  ValueListenableBuilder<TextEditingValue>(
                    valueListenable: controller,
                    builder: (context, value, _) => value.text.isEmpty
                        ? const SizedBox(width: 8)
                        : IconButton(
                            onPressed: onClear,
                            icon: const Icon(Icons.close, size: 16),
                            color: const Color(Env.muted),
                            visualDensity: VisualDensity.compact,
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                          ),
                  ),
                ],
              ),
            ),
          ),
          TextButton(
            onPressed: onCancel,
            style: TextButton.styleFrom(
              foregroundColor: const Color(Env.muted),
              minimumSize: const Size(48, 38),
              padding: EdgeInsets.zero,
            ),
            child: const Text('取消', style: TextStyle(fontSize: 13.5)),
          ),
        ],
      ),
    );
  }
}

/// 请求在飞时的 2px 进度条：不遮内容，也不让页面闪成骨架。
class _ProgressLine extends StatelessWidget {
  const _ProgressLine();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      height: 2,
      child: LinearProgressIndicator(
        minHeight: 2,
        backgroundColor: Colors.transparent,
        color: Color(Env.blue),
      ),
    );
  }
}

class _Hints extends StatelessWidget {
  const _Hints({required this.hints, required this.onPick});

  final List<String> hints;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 40),
      children: [
        const Text(
          '可以搜什么',
          style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(Env.muted)),
        ),
        const SizedBox(height: 10),
        const Text(
          '话题标题和正文、回复内容、分类、标签、用户昵称都会一起找。',
          style: TextStyle(fontSize: 13, height: 1.6, color: Color(Env.muted)),
        ),
        const SizedBox(height: 22),
        const Text(
          '试一个',
          style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Color(Env.muted)),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final hint in hints)
              GestureDetector(
                onTap: () => onPick(hint),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                  decoration: BoxDecoration(
                    color: const Color(Env.surface),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: const Color(0x1AFFFFFF)),
                  ),
                  child: Text(
                    hint,
                    style: const TextStyle(fontSize: 12.5, color: Color(Env.text)),
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.term});

  final String term;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.search_off, size: 34, color: Color(0xFF3A424F)),
            const SizedBox(height: 12),
            Text(
              '没有找到「$term」',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, color: Color(Env.text)),
            ),
            const SizedBox(height: 6),
            const Text(
              '换个短一点的词试试，或者去掉限定条件',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12.5, height: 1.5, color: Color(Env.muted)),
            ),
          ],
        ),
      ),
    );
  }
}

class _ResultList extends StatelessWidget {
  const _ResultList({required this.outcome, required this.onOpen});

  final SearchOutcome outcome;
  final ValueChanged<SearchHit> onOpen;

  @override
  Widget build(BuildContext context) {
    final groups = outcome.grouped;
    final rows = <Widget>[];

    // 搜索词被改写时（比如带了 category: 指令）得说一声，否则用户以为搜错了
    for (final note in [...outcome.notes, ...outcome.warnings]) {
      rows.add(
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: Text(
            note,
            style: const TextStyle(fontSize: 12, height: 1.5, color: Color(Env.muted)),
          ),
        ),
      );
    }

    rows.add(
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 2),
        child: Text(
          '${outcome.hits.length} 条结果',
          style: const TextStyle(fontSize: 11.5, color: Color(Env.muted)),
        ),
      ),
    );

    for (final group in groups) {
      rows.add(_GroupHeader(label: group.value.first.kindLabel, count: group.value.length));
      for (final hit in group.value) {
        rows.add(_HitRow(hit: hit, onTap: () => onOpen(hit)));
      }
    }

    return ListView(
      padding: const EdgeInsets.only(bottom: 40),
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      children: rows,
    );
  }
}

class _GroupHeader extends StatelessWidget {
  const _GroupHeader({required this.label, required this.count});

  final String label;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 6),
      child: Row(
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.6,
              color: Color(Env.muted),
            ),
          ),
          const SizedBox(width: 6),
          Text(
            '$count',
            style: const TextStyle(fontSize: 11, color: Color(0xFF4A5260)),
          ),
        ],
      ),
    );
  }
}

class _HitRow extends StatelessWidget {
  const _HitRow({required this.hit, required this.onTap});

  final SearchHit hit;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final summary = hit.summary.trim();

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 11, 16, 11),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              hit.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 14.5,
                height: 1.4,
                fontWeight: FontWeight.w600,
                color: Color(Env.text),
              ),
            ),
            if (summary.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                summary,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12.5, height: 1.5, color: Color(Env.muted)),
              ),
            ],
            if (hit.meta.isNotEmpty || hit.replyCount > 0 || hit.viewCount > 0) ...[
              const SizedBox(height: 6),
              Row(
                children: [
                  if (hit.meta.isNotEmpty)
                    Text(
                      hit.meta,
                      style: const TextStyle(fontSize: 11, color: Color(0xFF4A5260)),
                    ),
                  if (hit.replyCount > 0) ...[
                    const SizedBox(width: 10),
                    Text(
                      '${hit.replyCount} 回复',
                      style: const TextStyle(fontSize: 11, color: Color(0xFF4A5260)),
                    ),
                  ],
                  if (hit.viewCount > 0) ...[
                    const SizedBox(width: 10),
                    Text(
                      '${hit.viewCount} 阅读',
                      style: const TextStyle(fontSize: 11, color: Color(0xFF4A5260)),
                    ),
                  ],
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
