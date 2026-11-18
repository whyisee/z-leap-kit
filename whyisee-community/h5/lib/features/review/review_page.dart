import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/api_exception.dart';
import '../../core/api/models.dart';
import '../../core/env.dart';
import '../../core/format.dart';
import '../errors/error_view.dart';
import '../topic/widgets/article_webview.dart';
import 'review_repository.dart';

/// 审核话题页 —— 通知里「新的待审核话题」点进来的地方。
///
/// 以前这条路径落到网页后台：手机上先看到一屏筛选器和表格，再滚到那一行点
/// 「发布」。审核是全靠手感的事，多一次跳转就多一半放弃率，所以这一页只做三件：
///
/// 1. 把 AI 预审结论提到最上面（结论 + 风险分 + 理由）——多数内容看完这个就能拍板；
/// 2. 正文原样渲染，需要认真读的时候不用再跳走；
/// 3. 底部两个按钮常驻，通过之后自动换到下一条，队列能一口气清完。
class ReviewTopicPage extends ConsumerStatefulWidget {
  const ReviewTopicPage({super.key, required this.topicId});

  final int topicId;

  @override
  ConsumerState<ReviewTopicPage> createState() => _ReviewTopicPageState();
}

class _ReviewTopicPageState extends ConsumerState<ReviewTopicPage> {
  ReviewDetail? _detail;
  ApiException? _error;
  bool _loading = true;

  /// 正在提交的动作（`publish` / `draft`），非空时按钮全部禁用
  String? _busy;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final detail = await ref.read(reviewRepositoryProvider).detail(widget.topicId);
      if (!mounted) return;
      setState(() {
        _detail = detail;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = ApiException(code: 'unknown', message: '加载失败，稍后重试。');
        _loading = false;
      });
    }
  }

  void _toast(ScaffoldMessengerState messenger, String text) {
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(text),
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
        ),
      );
  }

  Future<void> _act(String action) async {
    if (_busy != null) return;

    if (action == 'draft' && !await _confirmReject()) return;
    if (!mounted) return;

    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busy = action);

    try {
      final result = await ref.read(reviewRepositoryProvider).act(widget.topicId, action);
      if (!mounted) return;

      final done = action == 'publish' ? '已发布' : '已退回草稿';
      final next = result.nextId;

      if (next != null) {
        // 直接换到下一条：审核是连着的动作，中间夹一次「返回列表再点」很打断
        context.pushReplacement('/me/notifications/review/$next');
        _toast(
          messenger,
          result.remaining > 0 ? '$done，还剩 ${result.remaining} 条' : done,
        );
        return;
      }

      context.pop();
      _toast(messenger, '$done，队列清空了');
    } on ApiException catch (e) {
      if (!mounted) return;
      _toast(messenger, e.message);
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  /// 已发布的话题：审核页只能当入口，真正的阅读回原生阅读器。
  void _openPublished() {
    final id = _detail?.topic.id ?? widget.topicId;
    context.push('/me/notifications/t/$id');
  }

  Future<bool> _confirmReject() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: const Color(Env.surface),
        title: const Text('退回这条话题？', style: TextStyle(fontSize: 16, color: Color(Env.text))),
        content: const Text(
          '它会回到作者的草稿箱，作者改完可以重新提交。退回不会通知作者。',
          style: TextStyle(fontSize: 13, height: 1.6, color: Color(Env.muted)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('再看看', style: TextStyle(color: Color(Env.muted))),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('退回', style: TextStyle(color: Color(0xFFF4737E))),
          ),
        ],
      ),
    );

    return ok ?? false;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(Env.bg),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _Header(
              remaining: _detail?.remaining ?? 0,
              onBack: () => context.pop(),
            ),
            Expanded(child: _buildBody()),
            // 已经在网上发布过的（多半是在网页后台点掉的）不再给审核按钮，
            // 否则会出现「点了通过没反应」——服务端会把它当重复动作忽略
            if (!_loading && _detail != null)
              if (_detail!.topic.status == 'published')
                _PublishedBar(onOpen: _openPublished)
              else
                _ActionBar(
                  busy: _busy,
                  onPublish: () => _act('publish'),
                  onReject: () => _act('draft'),
                ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) return const _Skeleton();

    final error = _error;
    if (error != null || _detail == null) {
      final forbidden = error?.statusCode == 403;
      final notDeployed = error?.statusCode == 404 && error?.code == 'not_found';
      return ErrorView(
        title: forbidden
            ? '只有管理员能审核'
            : notDeployed
                ? '话题不在了'
                : error?.isNetwork == true
                    ? '网络不通'
                    : '打不开这条',
        message: forbidden
            ? '这条通知指向后台审核队列，当前账号没有权限。'
            : notDeployed
                ? '它可能已被删除，或者链接里的 id 不对。'
                : error?.message ?? '稍后重试。',
        onRetry: _load,
      );
    }

    final detail = _detail!;
    final topic = detail.topic;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 28),
      children: [
        _TopicMeta(topic: topic),
        const SizedBox(height: 8),
        Text(
          topic.title,
          style: const TextStyle(
            fontSize: 20,
            height: 1.4,
            fontWeight: FontWeight.w700,
            color: Color(Env.text),
          ),
        ),
        const SizedBox(height: 10),
        _AuthorRow(topic: topic),
        const SizedBox(height: 16),
        _VerdictCard(verdict: detail.verdict),
        const SizedBox(height: 18),
        const _SectionLabel('正文'),
        const SizedBox(height: 4),
        if (topic.contentHtml.trim().isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Text(
              '正文是空的。',
              style: TextStyle(fontSize: 13, color: Color(Env.muted)),
            ),
          )
        else
          ArticleWebView(html: topic.contentHtml),
        if (topic.tags.isNotEmpty) ...[
          const SizedBox(height: 14),
          _Tags(tags: topic.tags),
        ],
        const SizedBox(height: 18),
        Text(
          '通过后立即出现在社区里；退回会回到作者草稿箱。',
          style: TextStyle(
            fontSize: 11.5,
            height: 1.7,
            color: const Color(Env.muted).withValues(alpha: 0.65),
          ),
        ),
      ],
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.remaining, required this.onBack});

  /// 除当前这条之外还剩几条待审
  final int remaining;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 46,
      padding: const EdgeInsets.only(left: 4, right: 14),
      decoration: const BoxDecoration(
        color: Color(Env.bg),
        border: Border(bottom: BorderSide(color: Color(Env.line), width: 1)),
      ),
      child: Row(
        children: [
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onBack,
            child: const SizedBox(
              width: 38,
              height: 46,
              child: Icon(Icons.arrow_back_ios_new, size: 16, color: Color(Env.text)),
            ),
          ),
          const Text(
            '审核话题',
            style: TextStyle(
              fontSize: 16.5,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.4,
              color: Color(Env.text),
            ),
          ),
          const Spacer(),
          if (remaining > 0)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0x1FF5C97B),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                '还剩 $remaining 条',
                style: const TextStyle(fontSize: 11, color: Color(0xFFF5C97B)),
              ),
            ),
        ],
      ),
    );
  }
}

class _TopicMeta extends StatelessWidget {
  const _TopicMeta({required this.topic});

  final ReviewTopic topic;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        if (topic.category.name.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: Text(
              topic.category.name,
              style: const TextStyle(fontSize: 11.5, color: Color(Env.blue)),
            ),
          ),
        if (topic.createdAt != null)
          Text(
            relativeTime(topic.createdAt!),
            style: const TextStyle(fontSize: 11.5, color: Color(0xFF5F6875)),
          ),
        if (topic.status != 'pending') ...[
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
            decoration: BoxDecoration(
              color: const Color(0x14FFFFFF),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              topic.status == 'published' ? '已发布' : '草稿',
              style: const TextStyle(fontSize: 10.5, color: Color(Env.muted)),
            ),
          ),
        ],
      ],
    );
  }
}

class _AuthorRow extends StatelessWidget {
  const _AuthorRow({required this.topic});

  final ReviewTopic topic;

  @override
  Widget build(BuildContext context) {
    final author = topic.author;

    return Row(
      children: [
        Container(
          width: 20,
          height: 20,
          clipBehavior: Clip.antiAlias,
          decoration: const BoxDecoration(color: Color(Env.panel), shape: BoxShape.circle),
          child: author.avatarUrl != null && author.avatarUrl!.isNotEmpty
              ? Image.network(
                  author.avatarUrl!,
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => _initial(author.initial),
                )
              : _initial(author.initial),
        ),
        const SizedBox(width: 7),
        Text(
          author.displayName,
          style: const TextStyle(fontSize: 12.5, color: Color(Env.text)),
        ),
        if (author.username.isNotEmpty && author.username != author.displayName) ...[
          const SizedBox(width: 8),
          Text(
            '@${author.username}',
            style: const TextStyle(fontSize: 11, color: Color(0xFF5F6875)),
          ),
        ],
      ],
    );
  }

  Widget _initial(String text) => Center(
        child: Text(
          text,
          style: const TextStyle(fontSize: 9.5, color: Color(Env.muted)),
        ),
      );
}

/// 预审结论卡：结论、风险分、理由。
///
/// 用颜色一眼区分「能直接过」和「要读一读」，但整卡仍然低调 —— 它是参考意见，
/// 不该比正文更抢眼。
class _VerdictCard extends StatelessWidget {
  const _VerdictCard({required this.verdict});

  final ReviewVerdict? verdict;

  @override
  Widget build(BuildContext context) {
    final data = verdict;
    if (data == null) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        decoration: BoxDecoration(
          color: const Color(Env.surface),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(Env.line)),
        ),
        child: const Row(
          children: [
            Icon(Icons.info_outline, size: 14, color: Color(0xFF5F6875)),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                '这条没有自动预审记录，直接读正文判断。',
                style: TextStyle(fontSize: 12, height: 1.5, color: Color(Env.muted)),
              ),
            ),
          ],
        ),
      );
    }

    final tone = _toneOf(data.decision);

    return Container(
      padding: const EdgeInsets.fromLTRB(13, 12, 13, 12),
      decoration: BoxDecoration(
        color: tone.background,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tone.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(_iconOf(data.decision), size: 15, color: tone.foreground),
              const SizedBox(width: 7),
              Text(
                data.headline,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: tone.foreground,
                ),
              ),
              const Spacer(),
              Text(
                '风险 ${data.riskScore}',
                style: TextStyle(
                  fontSize: 11.5,
                  color: tone.foreground.withValues(alpha: 0.8),
                ),
              ),
            ],
          ),
          if (data.reasons.isNotEmpty) ...[
            const SizedBox(height: 9),
            for (final reason in data.reasons)
              Padding(
                padding: const EdgeInsets.only(bottom: 5),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Container(
                        width: 3,
                        height: 3,
                        decoration: BoxDecoration(
                          color: tone.foreground.withValues(alpha: 0.55),
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        reason,
                        style: const TextStyle(
                          fontSize: 12,
                          height: 1.6,
                          color: Color(0xFFA9B1BC),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
          if (data.model.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                '由 ${data.model} 预审 · 只作参考，最终由你判断',
                style: const TextStyle(fontSize: 10.5, color: Color(0xFF5F6875)),
              ),
            ),
        ],
      ),
    );
  }

  static _Tone _toneOf(String decision) => switch (decision) {
        'approve' => const _Tone(
            foreground: Color(0xFF6EE7B7),
            background: Color(0x146EE7B7),
            border: Color(0x266EE7B7),
          ),
        'reject' => const _Tone(
            foreground: Color(0xFFF4737E),
            background: Color(0x14F4737E),
            border: Color(0x26F4737E),
          ),
        _ => const _Tone(
            foreground: Color(0xFFF5C97B),
            background: Color(0x14F5C97B),
            border: Color(0x26F5C97B),
          ),
      };

  static IconData _iconOf(String decision) => switch (decision) {
        'approve' => Icons.check_circle_outline,
        'reject' => Icons.block_outlined,
        _ => Icons.help_outline,
      };
}

class _Tone {
  const _Tone({required this.foreground, required this.background, required this.border});

  final Color foreground;
  final Color background;
  final Color border;
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          text,
          style: const TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w700,
            letterSpacing: 1,
            color: Color(0xFF6B7686),
          ),
        ),
        const SizedBox(width: 8),
        const Expanded(child: Divider(height: 1, color: Color(0x0FFFFFFF))),
      ],
    );
  }
}

class _Tags extends StatelessWidget {
  const _Tags({required this.tags});

  final List<TagRef> tags;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final tag in tags)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
            decoration: BoxDecoration(
              color: const Color(Env.panel),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              '#${tag.name}',
              style: const TextStyle(fontSize: 11.5, color: Color(Env.muted)),
            ),
          ),
      ],
    );
  }
}

/// 底部常驻两个动作。
///
/// 「通过」在右且实心（拇指落点），「退回」在左且描边 —— 退回是破坏性动作，
/// 不该和通过长得一样。
class _ActionBar extends StatelessWidget {
  const _ActionBar({required this.busy, required this.onPublish, required this.onReject});

  final String? busy;
  final VoidCallback onPublish;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    final disabled = busy != null;

    return Container(
      padding: EdgeInsets.fromLTRB(16, 10, 16, 10 + MediaQuery.of(context).padding.bottom),
      decoration: const BoxDecoration(
        color: Color(Env.headerBg),
        border: Border(top: BorderSide(color: Color(Env.line), width: 1)),
      ),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton(
              onPressed: disabled ? null : onReject,
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(44),
                side: const BorderSide(color: Color(0x33FFFFFF)),
                foregroundColor: const Color(Env.muted),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: Text(
                busy == 'draft' ? '退回中…' : '退回草稿',
                style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            flex: 2,
            child: FilledButton(
              onPressed: disabled ? null : onPublish,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(Env.blue),
                foregroundColor: const Color(0xFF0D1016),
                disabledBackgroundColor: const Color(0x4D8AB4F8),
                minimumSize: const Size.fromHeight(44),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: Text(
                busy == 'publish' ? '发布中…' : '通过并发布',
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 已发布时的底栏：只有一个「打开话题」，避免误点重复审核。
class _PublishedBar extends StatelessWidget {
  const _PublishedBar({required this.onOpen});

  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(16, 10, 16, 10 + MediaQuery.of(context).padding.bottom),
      decoration: const BoxDecoration(
        color: Color(Env.headerBg),
        border: Border(top: BorderSide(color: Color(Env.line), width: 1)),
      ),
      child: Row(
        children: [
          const Expanded(
            child: Text(
              '这条已经在社区里了',
              style: TextStyle(fontSize: 12.5, color: Color(Env.muted)),
            ),
          ),
          FilledButton(
            onPressed: onOpen,
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF8AB4F8),
              foregroundColor: const Color(0xFF0D1016),
              minimumSize: const Size(112, 40),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: const Text(
              '打开话题',
              style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

/// 骨架按真实版式摆：分类行、标题两行、结论卡、正文几条线。
class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
      children: [
        _bar(90, 10),
        const SizedBox(height: 12),
        _bar(double.infinity, 20),
        const SizedBox(height: 8),
        _bar(220, 20),
        const SizedBox(height: 14),
        _bar(130, 11),
        const SizedBox(height: 18),
        Container(
          height: 74,
          decoration: BoxDecoration(
            color: const Color(0xFF171B23),
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        const SizedBox(height: 20),
        _bar(double.infinity, 13),
        const SizedBox(height: 10),
        _bar(double.infinity, 13),
        const SizedBox(height: 10),
        _bar(240, 13),
      ],
    );
  }

  Widget _bar(double width, double height) => Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: const Color(0xFF1A1F28),
          borderRadius: BorderRadius.circular(4),
        ),
      );
}
