import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/api_exception.dart';
import '../../core/api/models.dart';
import '../../core/env.dart';
import '../../core/format.dart';
import '../../core/providers.dart';
import '../errors/error_view.dart';
import '../feed/widgets/topic_card.dart';
import 'user_repository.dart';

/// 原生用户主页。
///
/// 网页 `/u/:username` 那页塞了徽章墙、贡献流水、信任等级四段，手机上滚两屏还
/// 没看到一个话题。这里只回答三个问题：这个人是谁、他写了什么、我要不要关注。
/// 徽章 / 贡献留给网页（「查看完整主页」）。
class UserPage extends ConsumerStatefulWidget {
  const UserPage({super.key, required this.username});

  final String username;

  @override
  ConsumerState<UserPage> createState() => _UserPageState();
}

class _UserPageState extends ConsumerState<UserPage> {
  ProfilePageData? _data;
  String? _error;
  bool _loading = true;
  bool _busy = false;

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
      final data = await ref.read(userRepositoryProvider).load(widget.username);
      if (!mounted) return;
      setState(() {
        _data = data;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = switch (error.statusCode) {
          404 => '没有这个用户',
          401 => '登录已失效，重新登录后再看',
          _ => error.message,
        };
        _loading = false;
      });
    }
  }

  Future<void> _toggleFollow() async {
    final data = _data;
    if (data == null || _busy) return;

    if (!ref.read(sessionProvider).isSignedIn) {
      final ok = await context.push<bool>('/login?reason=${Uri.encodeComponent('登录后才能关注')}');
      if (ok != true) return;
    }

    setState(() => _busy = true);
    try {
      final following = await ref.read(userRepositoryProvider).toggleFollow(data.id);
      if (!mounted) return;
      setState(() {
        _data = ProfilePageData(
          id: data.id,
          username: data.username,
          displayName: data.displayName,
          avatarUrl: data.avatarUrl,
          bio: data.bio,
          role: data.role,
          websiteUrl: data.websiteUrl,
          githubUrl: data.githubUrl,
          joinedAt: data.joinedAt,
          isSelf: data.isSelf,
          following: following,
          topics: data.topics,
          stats: ProfileStats(
            topicCount: data.stats.topicCount,
            replyCount: data.stats.replyCount,
            featuredCount: data.stats.featuredCount,
            followerCount: data.stats.followerCount + (following ? 1 : -1),
            followingCount: data.stats.followingCount,
            badgeCount: data.stats.badgeCount,
            trustName: data.stats.trustName,
          ),
        );
        _busy = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _busy = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final topInset = MediaQuery.of(context).padding.top;

    return Scaffold(
      backgroundColor: const Color(Env.bg),
      body: Column(
        children: [
          _TopBar(
            topInset: topInset,
            title: _data?.displayName ?? '',
            onBack: () => context.pop(),
          ),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) return const _Skeleton();

    final data = _data;
    if (data == null) {
      return ErrorView(
        title: '打不开这个主页',
        message: _error ?? '页面加载失败',
        onRetry: _load,
      );
    }

    return RefreshIndicator(
      color: const Color(Env.blue),
      backgroundColor: const Color(Env.surface),
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 40),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          _ProfileHead(
            data: data,
            busy: _busy,
            onFollow: _toggleFollow,
            onEdit: () => context.push('/settings/profile'),
            onWeb: () => context.push(
              '/web?path=${Uri.encodeComponent('/u/${data.username}')}&title=完整主页',
            ),
          ),
          const SizedBox(height: 6),
          _SectionLabel(
            text: data.isSelf ? '我写的话题' : '公开话题',
            count: data.topics.length,
          ),
          if (data.topics.isEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 24, 16, 24),
              child: Text(
                data.isSelf ? '还没发过话题，去写第一篇。' : '这个人还没发过公开话题。',
                style: const TextStyle(fontSize: 13, height: 1.6, color: Color(Env.muted)),
              ),
            )
          else
            for (final topic in data.topics)
              TopicCard(
                topic: topic,
                onTap: () => context.push('/t/${topic.id}'),
              ),
        ],
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.topInset, required this.title, required this.onBack});

  final double topInset;
  final String title;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(4, topInset + 4, 12, 8),
      decoration: const BoxDecoration(
        color: Color(Env.bg),
        border: Border(bottom: BorderSide(color: Color(Env.line), width: 1)),
      ),
      child: Row(
        children: [
          IconButton(
            onPressed: onBack,
            icon: const Icon(Icons.arrow_back_ios_new, size: 17),
            color: const Color(Env.text),
            visualDensity: VisualDensity.compact,
          ),
          Expanded(
            child: Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 15.5,
                fontWeight: FontWeight.w600,
                color: Color(Env.text),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileHead extends StatelessWidget {
  const _ProfileHead({
    required this.data,
    required this.busy,
    required this.onFollow,
    required this.onEdit,
    required this.onWeb,
  });

  final ProfilePageData data;
  final bool busy;
  final VoidCallback onFollow;
  final VoidCallback onEdit;
  final VoidCallback onWeb;

  @override
  Widget build(BuildContext context) {
    final url = absoluteImageUrl(data.avatarUrl);
    final bio = data.bio.trim();
    final joined = data.joinedAt;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(Env.panel),
                  border: Border.all(color: const Color(0x338AB4F8)),
                ),
                clipBehavior: Clip.antiAlias,
                child: url == null
                    ? _initial()
                    : Image.network(
                        url,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => _initial(),
                        loadingBuilder: (_, child, progress) =>
                            progress == null ? child : _initial(),
                      ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 2),
                    Text(
                      data.displayName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 18,
                        height: 1.2,
                        fontWeight: FontWeight.w700,
                        color: Color(Env.text),
                      ),
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        Text(
                          '@${data.username}',
                          style: const TextStyle(fontSize: 12, color: Color(Env.muted)),
                        ),
                        if ((data.stats.trustName ?? '').isNotEmpty) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                            decoration: BoxDecoration(
                              color: const Color(0x1A8AB4F8),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              data.stats.trustName!,
                              style: const TextStyle(fontSize: 10.5, color: Color(Env.blue)),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              _action(),
            ],
          ),
          if (bio.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              bio,
              style: const TextStyle(fontSize: 13, height: 1.6, color: Color(Env.text)),
            ),
          ],
          if (joined != null) ...[
            const SizedBox(height: 8),
            Text(
              '${joined.year} 年加入',
              style: const TextStyle(fontSize: 11.5, color: Color(0xFF4A5260)),
            ),
          ],
          const SizedBox(height: 16),
          _Stats(stats: data.stats),
          const SizedBox(height: 6),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              onPressed: onWeb,
              style: TextButton.styleFrom(
                foregroundColor: const Color(Env.muted),
                padding: EdgeInsets.zero,
                minimumSize: const Size(0, 30),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text('徽章与贡献记录', style: TextStyle(fontSize: 12)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _action() {
    if (data.isSelf) {
      return _OutlineButton(label: '编辑资料', onTap: onEdit);
    }

    return _OutlineButton(
      label: data.following ? '已关注' : '关注',
      onTap: busy ? null : onFollow,
      highlighted: !data.following,
    );
  }

  Widget _initial() => Center(
        child: Text(
          data.displayName.isEmpty ? '?' : data.displayName.characters.first,
          style: const TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w600,
            color: Color(Env.blue),
          ),
        ),
      );
}

class _OutlineButton extends StatelessWidget {
  const _OutlineButton({
    required this.label,
    required this.onTap,
    this.highlighted = false,
  });

  final String label;
  final VoidCallback? onTap;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: highlighted ? const Color(0xFF8AB4F8) : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: highlighted ? const Color(0xFF8AB4F8) : const Color(0x338AB4F8),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            color: highlighted ? const Color(0xFF0D1016) : const Color(Env.text),
          ),
        ),
      ),
    );
  }
}

class _Stats extends StatelessWidget {
  const _Stats({required this.stats});

  final ProfileStats stats;

  @override
  Widget build(BuildContext context) {
    final items = <(String, int)>[
      ('话题', stats.topicCount),
      ('回复', stats.replyCount),
      ('关注者', stats.followerCount),
      ('关注中', stats.followingCount),
    ];

    return Row(
      children: [
        for (final (label, value) in items)
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  compactCount(value),
                  style: const TextStyle(
                    fontSize: 16,
                    height: 1.2,
                    fontWeight: FontWeight.w700,
                    color: Color(Env.text),
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  label,
                  style: const TextStyle(fontSize: 11, color: Color(Env.muted)),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.text, required this.count});

  final String text;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Row(
        children: [
          Text(
            text,
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

class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    Widget bar(double width, double height) => Container(
          width: width,
          height: height,
          decoration: BoxDecoration(
            color: const Color(Env.surface),
            borderRadius: BorderRadius.circular(6),
          ),
        );

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 60,
                height: 60,
                decoration: const BoxDecoration(
                  color: Color(Env.surface),
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 14),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  bar(120, 15),
                  const SizedBox(height: 8),
                  bar(80, 11),
                ],
              ),
            ],
          ),
          const SizedBox(height: 20),
          bar(double.infinity, 11),
          const SizedBox(height: 8),
          bar(220, 11),
          const SizedBox(height: 26),
          for (var i = 0; i < 3; i++) ...[
            bar(double.infinity, 76),
            const SizedBox(height: 10),
          ],
        ],
      ),
    );
  }
}
