import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/api/api_exception.dart';
import '../../core/api/models.dart';
import '../../core/env.dart';
import '../../core/format.dart';
import '../../core/providers.dart';
import '../errors/error_view.dart';
import 'me_repository.dart';

/// 原生「我」页。
///
/// 网页版这一页是 `/settings`，本质是「桌面侧栏 + 表单」，塞进 4 寸宽的手机后
/// 侧栏塌成竖排、表单要横向滚，所以整页重做：
///
/// - 顶部只留标题 + 通知入口（手机上没有第二个可点的位置）；
/// - 资料卡把「头像/昵称/简介/四个计数」压成一张卡，统计与网页 service 同口径；
/// - 我的话题直接列在页面上，点开进原生详情（走 `/me/t/:id`，返回回到本页）；
/// - 设置三项（资料、密码、Agent 设备）和「发现」那几页（项目 / Agent 专区 /
///   指南 / 关于）都是原生页 —— 这一页已经没有任何入口会掉进 WebView。
class MePage extends ConsumerWidget {
  const MePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final overview = ref.watch(meOverviewProvider);

    final signedIn = session.isSignedIn;
    final unread = overview.asData?.value?.unreadCount ?? session.unreadCount;

    return Scaffold(
      backgroundColor: const Color(Env.bg),
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _TopBar(
              unread: signedIn ? unread : 0,
              onOpenNotifications: signedIn
                  ? () => _openNotifications(context, ref)
                  : null,
            ),
            Expanded(
              child: switch (session.status) {
                SessionStatus.unknown => const Center(
                    child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Color(Env.muted),
                      ),
                    ),
                  ),
                SessionStatus.signedOut => const _SignedOutView(),
                SessionStatus.signedIn => overview.when(
                    loading: () => const _Skeleton(),
                    error: (error, _) => ErrorView(
                      title: error is ApiException && error.statusCode == 404
                          ? '服务端还没更新'
                          : '加载失败',
                      // 404 不用装成网络问题：这是新接口还没部署到服务器
                      message: error is ApiException && error.statusCode == 404
                          ? '这个页面用到的接口还没上线，部署一次服务端再进来。'
                          : (error is ApiException ? error.message : '网络好像不太顺，稍后再试。'),
                      onRetry: () => ref.invalidate(meOverviewProvider),
                    ),
                    data: (data) => data == null
                        ? const _SignedOutView()
                        : _Content(
                            data: data,
                            onRefresh: () async {
                              // refreshMe 会刷新登录态与未读，
                              // session 变化本身会带着 meOverviewProvider 重建
                              await ref.read(sessionProvider.notifier).refreshMe();
                              await ref.read(meOverviewProvider.future);
                            },
                            onEditProfile: () =>
                                _openNative(context, ref, '/settings/profile'),
                            onOpenNative: (path) => _openNative(context, ref, path),
                            onOpenTopic: (id) => context.push('/me/t/$id'),
                            onOpenNotifications: () => _openNotifications(context, ref),
                            onSignOut: () => _signOut(context, ref),
                          ),
                  ),
              },
            ),
          ],
        ),
      ),
    );
  }

  /// 原生设置页：进去改完回来，本地缓存必须失效，否则「我」页还是旧昵称旧头像。
  Future<void> _openNative(
    BuildContext context,
    WidgetRef ref,
    String path,
  ) async {
    await context.push(path);
    if (!context.mounted) return;
    ref.invalidate(meOverviewProvider);
    await ref.read(sessionProvider.notifier).refreshMe();
  }

  /// 通知是原生页。看完回来角标要跟着掉，所以返回后重拉一次概览与登录态。
  Future<void> _openNotifications(BuildContext context, WidgetRef ref) async {
    await context.push('/me/notifications');
    if (!context.mounted) return;
    ref.invalidate(meOverviewProvider);
    await ref.read(sessionProvider.notifier).refreshMe();
  }

  Future<void> _signOut(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(Env.surface),
        surfaceTintColor: Colors.transparent,
        title: const Text('退出登录', style: TextStyle(fontSize: 16, color: Color(Env.text))),
        content: const Text(
          '退出后需要重新登录才能发帖和互动。',
          style: TextStyle(fontSize: 13, color: Color(Env.muted)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('取消', style: TextStyle(color: Color(Env.muted))),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('退出', style: TextStyle(color: Color(0xFFFF6B7A))),
          ),
        ],
      ),
    );

    if (confirmed != true || !context.mounted) return;
    await ref.read(sessionProvider.notifier).signOut();
    if (!context.mounted) return;
    ref.invalidate(meOverviewProvider);
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.unread, this.onOpenNotifications});

  final int unread;
  final VoidCallback? onOpenNotifications;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: 50),
      padding: const EdgeInsets.fromLTRB(16, 4, 6, 4),
      decoration: const BoxDecoration(
        color: Color(Env.headerBg),
        border: Border(bottom: BorderSide(color: Color(Env.line), width: 1)),
      ),
      child: Row(
        children: [
          const Text(
            '我',
            style: TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.w700,
              color: Color(Env.text),
              letterSpacing: 0.5,
            ),
          ),
          const Spacer(),
          if (onOpenNotifications != null)
            IconButton(
              onPressed: onOpenNotifications,
              tooltip: '通知',
              iconSize: 20,
              color: const Color(Env.muted),
              icon: Stack(
                clipBehavior: Clip.none,
                children: [
                  const Icon(Icons.notifications_none),
                  if (unread > 0)
                    Positioned(
                      right: -4,
                      top: -3,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                        constraints: const BoxConstraints(minWidth: 14),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFF6B7A),
                          borderRadius: BorderRadius.circular(7),
                        ),
                        child: Text(
                          unread > 99 ? '99+' : '$unread',
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 9,
                            height: 1.4,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
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

class _Content extends StatelessWidget {
  const _Content({
    required this.data,
    required this.onRefresh,
    required this.onEditProfile,
    required this.onOpenNative,
    required this.onOpenTopic,
    required this.onOpenNotifications,
    required this.onSignOut,
  });

  final MeOverview data;
  final Future<void> Function() onRefresh;
  final VoidCallback onEditProfile;
  /// 原生设置页：push 进去，回来刷新缓存
  final void Function(String path) onOpenNative;
  final void Function(int topicId) onOpenTopic;
  final VoidCallback onOpenNotifications;
  final VoidCallback onSignOut;

  @override
  Widget build(BuildContext context) {
    final profile = data.profile;
    final stats = data.stats;

    return RefreshIndicator(
      color: const Color(Env.blue),
      backgroundColor: const Color(Env.surface),
      onRefresh: onRefresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 28),
        children: [
          _ProfileCard(
            profile: profile,
            stats: stats,
            badges: data.badges,
            onEditProfile: onEditProfile,
          ),
          _MyTopics(
            topics: data.recentTopics,
            onOpenTopic: onOpenTopic,
            onSeeAll: () => context.push('/u/${profile.username}'),
          ),
          _MenuGroup(
            title: '互动',
            items: [
              _MenuAction(
                icon: Icons.person_outline,
                label: '我的主页',
                hint: '公开可见',
                onTap: () => context.push('/u/${profile.username}'),
              ),
              _MenuAction(
                icon: Icons.people_outline,
                label: '关注的人',
                // 底部第 3 个 tab 就是原生关注页，这里 go 过去而不是再推一个网页
                onTap: () => context.go('/following'),
              ),
              _MenuAction(
                icon: Icons.notifications_none,
                label: '通知',
                hint: data.unreadCount > 0 ? '${data.unreadCount} 条未读' : null,
                onTap: onOpenNotifications,
              ),
            ],
          ),
          _MenuGroup(
            title: '发现',
            items: [
              _MenuAction(
                icon: Icons.rocket_launch_outlined,
                label: '项目展示',
                hint: '别人在做什么',
                onTap: () => onOpenNative('/projects'),
              ),
              _MenuAction(
                icon: Icons.smart_toy_outlined,
                label: 'Agent 专区',
                hint: 'Agent 与任务',
                onTap: () => onOpenNative('/agent-zone'),
              ),
              _MenuAction(
                icon: Icons.gavel_outlined,
                label: '社区指南',
                hint: '等级与规则',
                onTap: () => onOpenNative('/guidelines'),
              ),
            ],
          ),
          _MenuGroup(
            title: '设置',
            items: [
              _MenuAction(
                icon: Icons.badge_outlined,
                label: '公开资料',
                hint: '昵称、简介、头像',
                onTap: () => onOpenNative('/settings/profile'),
              ),
              _MenuAction(
                icon: Icons.lock_outline,
                label: '密码与认证',
                onTap: () => onOpenNative('/settings/account'),
              ),
              _MenuAction(
                icon: Icons.smart_toy_outlined,
                label: 'Agent 设备',
                onTap: () => onOpenNative('/settings/agents'),
              ),
              _MenuAction(
                icon: Icons.info_outline,
                label: '关于 whyisee',
                onTap: () => onOpenNative('/about'),
              ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 22, 16, 0),
            child: TextButton(
              onPressed: onSignOut,
              style: TextButton.styleFrom(
                minimumSize: const Size.fromHeight(44),
                backgroundColor: const Color(Env.surface),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: const BorderSide(color: Color(Env.line)),
                ),
              ),
              child: const Text(
                '退出登录',
                style: TextStyle(fontSize: 13.5, color: Color(0xFFFF6B7A)),
              ),
            ),
          ),
          const Padding(
            padding: EdgeInsets.only(top: 20),
            child: Center(
              child: Text(
                'whyisee.xyz · v${Env.appVersion}',
                style: TextStyle(fontSize: 10.5, color: Color(0xFF5C6675)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfileCard extends StatelessWidget {
  const _ProfileCard({
    required this.profile,
    required this.stats,
    required this.badges,
    required this.onEditProfile,
  });

  final MeProfile profile;
  final MeStats stats;
  final List<MeBadge> badges;
  final VoidCallback onEditProfile;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
      decoration: BoxDecoration(
        color: const Color(Env.surface),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(Env.line)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Avatar(profile: profile, size: 56),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            profile.displayName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                              color: Color(Env.text),
                            ),
                          ),
                        ),
                        if (profile.role == 'admin')
                          Container(
                            margin: const EdgeInsets.only(left: 6),
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                            decoration: BoxDecoration(
                              color: const Color(0x1F8AB4F8),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: const Text(
                              '管理员',
                              style: TextStyle(fontSize: 9.5, height: 1.5, color: Color(Env.blue)),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '@${profile.username}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12, color: Color(0xFF6E7887)),
                    ),
                    const SizedBox(height: 7),
                    Text(
                      profile.bio.trim().isEmpty ? '还没写简介' : profile.bio.trim(),
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12.5,
                        height: 1.55,
                        color: profile.bio.trim().isEmpty
                            ? const Color(0xFF5C6675)
                            : const Color(Env.muted),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              _EditButton(onTap: onEditProfile),
            ],
          ),
          const SizedBox(height: 15),
          Container(height: 1, color: const Color(Env.line)),
          const SizedBox(height: 12),
          Row(
            children: [
              _Stat(value: stats.topicCount, label: '主题'),
              _Stat(value: stats.replyCount, label: '回复'),
              _Stat(value: stats.followingCount, label: '关注'),
              _Stat(value: stats.followerCount, label: '粉丝'),
            ],
          ),
          if (stats.contributionScore > 0 || badges.isNotEmpty) ...[
            const SizedBox(height: 12),
            _GrowthLine(stats: stats),
          ],
          if (badges.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [for (final badge in badges) _BadgeChip(badge: badge)],
            ),
          ],
        ],
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.profile, required this.size});

  final MeProfile profile;
  final double size;

  @override
  Widget build(BuildContext context) {
    final url = absoluteImageUrl(profile.avatarUrl);

    return Container(
      width: size,
      height: size,
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
    );
  }

  Widget _initial() => Center(
        child: Text(
          profile.initial,
          style: TextStyle(
            fontSize: size * 0.38,
            fontWeight: FontWeight.w600,
            color: const Color(Env.blue),
          ),
        ),
      );
}

class _EditButton extends StatelessWidget {
  const _EditButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0x338AB4F8)),
          color: const Color(0x148AB4F8),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.edit_outlined, size: 12, color: Color(Env.blue)),
            SizedBox(width: 3),
            Text('编辑', style: TextStyle(fontSize: 11, color: Color(Env.blue))),
          ],
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label});

  final int value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            compactCount(value),
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: Color(Env.text),
            ),
          ),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 11, color: Color(Env.muted))),
        ],
      ),
    );
  }
}

class _GrowthLine extends StatelessWidget {
  const _GrowthLine({required this.stats});

  final MeStats stats;

  @override
  Widget build(BuildContext context) {
    final next = stats.nextLevelScore;
    final progress = (next != null && next > 0)
        ? (stats.contributionScore / next).clamp(0.0, 1.0)
        : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              '贡献 ${stats.contributionScore}',
              style: const TextStyle(fontSize: 11.5, color: Color(Env.blue)),
            ),
            const SizedBox(width: 8),
            Text(
              'Lv.${stats.trustLevel}${stats.trustName.isEmpty ? '' : ' ${stats.trustName}'}',
              style: const TextStyle(fontSize: 11.5, color: Color(Env.muted)),
            ),
            const Spacer(),
            if (next != null && stats.nextLevelName != null)
              Text(
                '距 ${stats.nextLevelName} 还差 ${(next - stats.contributionScore).clamp(0, next)}',
                style: const TextStyle(fontSize: 10.5, color: Color(0xFF5C6675)),
              ),
          ],
        ),
        if (progress != null) ...[
          const SizedBox(height: 7),
          ClipRRect(
            borderRadius: BorderRadius.circular(2),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 3,
              backgroundColor: const Color(Env.panel),
              color: const Color(Env.blue),
            ),
          ),
        ],
      ],
    );
  }
}

class _BadgeChip extends StatelessWidget {
  const _BadgeChip({required this.badge});

  final MeBadge badge;

  static const _tones = <String, Color>{
    'blue': Color(0xFF8AB4F8),
    'green': Color(0xFF66D08C),
    'gold': Color(0xFFFFD166),
    'violet': Color(0xFFB69CFF),
    'rose': Color(0xFFFF7AA8),
  };

  @override
  Widget build(BuildContext context) {
    final color = _tones[badge.tone] ?? const Color(Env.blue);

    return Container(
      padding: const EdgeInsets.fromLTRB(6, 3, 8, 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.22)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            badge.icon,
            style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: color),
          ),
          const SizedBox(width: 4),
          Text(badge.name, style: const TextStyle(fontSize: 10.5, color: Color(Env.muted))),
        ],
      ),
    );
  }
}

class _MyTopics extends StatelessWidget {
  const _MyTopics({
    required this.topics,
    required this.onOpenTopic,
    required this.onSeeAll,
  });

  final List<TopicSummary> topics;
  final void Function(int topicId) onOpenTopic;
  final VoidCallback onSeeAll;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text(
                '我的话题',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(Env.text),
                ),
              ),
              const Spacer(),
              if (topics.isNotEmpty)
                GestureDetector(
                  onTap: onSeeAll,
                  behavior: HitTestBehavior.opaque,
                  child: const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 2, vertical: 2),
                    child: Text(
                      '全部 ›',
                      style: TextStyle(fontSize: 11.5, color: Color(Env.blue)),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            decoration: BoxDecoration(
              color: const Color(Env.surface),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(Env.line)),
            ),
            clipBehavior: Clip.antiAlias,
            child: topics.isEmpty
                ? const Padding(
                    padding: EdgeInsets.symmetric(vertical: 22),
                    child: Center(
                      child: Text(
                        '还没发过帖子',
                        style: TextStyle(fontSize: 12.5, color: Color(0xFF5C6675)),
                      ),
                    ),
                  )
                : Column(
                    children: [
                      for (var i = 0; i < topics.length; i++)
                        _TopicRow(
                          topic: topics[i],
                          showDivider: i != topics.length - 1,
                          onTap: () => onOpenTopic(topics[i].id),
                        ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

class _TopicRow extends StatelessWidget {
  const _TopicRow({
    required this.topic,
    required this.showDivider,
    required this.onTap,
  });

  final TopicSummary topic;
  final bool showDivider;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.fromLTRB(13, 11, 13, 11),
        decoration: BoxDecoration(
          border: showDivider
              ? const Border(bottom: BorderSide(color: Color(Env.line), width: 1))
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              topic.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 13.5,
                height: 1.45,
                color: Color(0xFFDDE3EA),
              ),
            ),
            const SizedBox(height: 5),
            Row(
              children: [
                if (topic.category != null) ...[
                  Text(
                    topic.category!.name,
                    style: const TextStyle(fontSize: 10.5, color: Color(0xFF6E7887)),
                  ),
                  const Text(
                    ' · ',
                    style: TextStyle(fontSize: 10.5, color: Color(0xFF3F4652)),
                  ),
                ],
                Text(
                  relativeTime(topic.displayTime),
                  style: const TextStyle(fontSize: 10.5, color: Color(0xFF6E7887)),
                ),
                const Spacer(),
                Icon(Icons.mode_comment_outlined, size: 11.5, color: const Color(0xFF6E7887)),
                const SizedBox(width: 3),
                Text(
                  compactCount(topic.replyCount),
                  style: const TextStyle(fontSize: 10.5, color: Color(0xFF6E7887)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _MenuGroup extends StatelessWidget {
  const _MenuGroup({required this.title, required this.items});

  final String title;
  final List<_MenuAction> items;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: Color(Env.text),
            ),
          ),
          const SizedBox(height: 8),
          Container(
            decoration: BoxDecoration(
              color: const Color(Env.surface),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(Env.line)),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                for (var i = 0; i < items.length; i++)
                  _MenuTile(item: items[i], showDivider: i != items.length - 1),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MenuAction {
  const _MenuAction({
    required this.icon,
    required this.label,
    required this.onTap,
    this.hint,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final String? hint;
}

class _MenuTile extends StatelessWidget {
  const _MenuTile({required this.item, required this.showDivider});

  final _MenuAction item;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: item.onTap,
      child: Container(
        padding: const EdgeInsets.fromLTRB(13, 13, 13, 13),
        decoration: BoxDecoration(
          border: showDivider
              ? const Border(bottom: BorderSide(color: Color(Env.line), width: 1))
              : null,
        ),
        child: Row(
          children: [
            Icon(item.icon, size: 17, color: const Color(Env.muted)),
            const SizedBox(width: 11),
            Text(
              item.label,
              style: const TextStyle(fontSize: 13, color: Color(Env.text)),
            ),
            const Spacer(),
            if (item.hint != null)
              // 窄屏（360）下 hint 是第一个被挤爆的东西：给它 Flexible，
              // 宁可省略号也不要溢出条纹
              Flexible(
                child: Text(
                  item.hint!,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.right,
                  style: const TextStyle(fontSize: 11, color: Color(0xFF5C6675)),
                ),
              ),
            const SizedBox(width: 4),
            const Icon(Icons.chevron_right, size: 17, color: Color(0xFF4A5261)),
          ],
        ),
      ),
    );
  }
}

class _SignedOutView extends StatelessWidget {
  const _SignedOutView();

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 34, 16, 0),
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(20, 26, 20, 22),
          decoration: BoxDecoration(
            color: const Color(Env.surface),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(Env.line)),
          ),
          child: Column(
            children: [
              Container(
                width: 58,
                height: 58,
                decoration: const BoxDecoration(
                  color: Color(Env.panel),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.person_outline, size: 26, color: Color(Env.muted)),
              ),
              const SizedBox(height: 14),
              const Text(
                '还没登录',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: Color(Env.text),
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                '登录后可以发帖、评论、关注作者，\n阅读记录也会跟着账号走。',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12.5, height: 1.6, color: Color(Env.muted)),
              ),
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () => context.push('/login'),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(Env.blue),
                    foregroundColor: const Color(0xFF0D1016),
                    minimumSize: const Size.fromHeight(42),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  child: const Text(
                    '登录',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
              const SizedBox(height: 6),
              TextButton(
                onPressed: () => context.push('/signup'),
                child: const Text(
                  '还没有账号？去注册',
                  style: TextStyle(fontSize: 12, color: Color(Env.muted)),
                ),
              ),
            ],
          ),
        ),
        const Padding(
          padding: EdgeInsets.only(top: 24),
          child: Center(
            child: Text(
              'whyisee.xyz · v${Env.appVersion}',
              style: TextStyle(fontSize: 10.5, color: Color(0xFF5C6675)),
            ),
          ),
        ),
      ],
    );
  }
}

class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      children: [
        Container(
          height: 168,
          decoration: BoxDecoration(
            color: const Color(Env.surface),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(Env.line)),
          ),
        ),
        const SizedBox(height: 20),
        for (var i = 0; i < 3; i++)
          Container(
            margin: const EdgeInsets.only(bottom: 10),
            height: 46,
            decoration: BoxDecoration(
              color: const Color(Env.surface),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(Env.line)),
            ),
          ),
      ],
    );
  }
}
