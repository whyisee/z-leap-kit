/// `/api/v1` 的响应模型。
///
/// 只映射客户端真正用到的字段。服务端新增字段不需要改客户端（Dart 侧忽略未知键），
/// 但**删改已有字段名必须同步这里**——这是两端唯一的耦合点。
library;

class Author {
  const Author({
    required this.id,
    required this.username,
    required this.displayName,
    this.avatarUrl,
    this.role,
    this.isAnonymous = false,
  });

  final int id;
  final String username;
  final String displayName;
  final String? avatarUrl;
  final String? role;
  final bool isAnonymous;

  factory Author.fromJson(Map<String, dynamic> json) => Author(
        id: (json['id'] as num?)?.toInt() ?? 0,
        username: json['username'] as String? ?? '',
        displayName: (json['displayName'] as String?)?.trim().isNotEmpty == true
            ? json['displayName'] as String
            : (json['username'] as String? ?? '匿名'),
        avatarUrl: json['avatarUrl'] as String?,
        role: json['role'] as String?,
        isAnonymous: json['isAnonymous'] as bool? ?? false,
      );

  /// 头像占位用的首字（中英文都取第一个字素）。
  String get initial {
    final src = displayName.trim();
    if (src.isEmpty) return '?';
    return src.characters.first.toUpperCase();
  }
}

extension on String {
  Iterable<String> get characters => runes.map(String.fromCharCode);
}

class CategoryRef {
  const CategoryRef({required this.id, required this.name, required this.slug, this.color});

  final int id;
  final String name;
  final String slug;
  final String? color;

  factory CategoryRef.fromJson(Map<String, dynamic> json) => CategoryRef(
        id: (json['id'] as num?)?.toInt() ?? 0,
        name: json['name'] as String? ?? '',
        slug: json['slug'] as String? ?? '',
        color: json['color'] as String?,
      );
}

class TagRef {
  const TagRef({required this.id, required this.name, required this.slug});

  final int id;
  final String name;
  final String slug;

  factory TagRef.fromJson(Map<String, dynamic> json) => TagRef(
        id: (json['id'] as num?)?.toInt() ?? 0,
        name: json['name'] as String? ?? '',
        slug: json['slug'] as String? ?? '',
      );
}

/// feed 列表项 = 详情页 topic 的字段减去 contentHtml。
class TopicSummary {
  const TopicSummary({
    required this.id,
    required this.title,
    required this.slug,
    required this.summary,
    required this.type,
    required this.author,
    required this.replyCount,
    required this.likeCount,
    required this.viewCount,
    this.coverImage,
    this.category,
    this.tags = const [],
    this.isPinned = false,
    this.isFeatured = false,
    this.publishedAt,
    this.lastActivityAt,
    this.contentHtml = '',
  });

  final int id;
  final String title;
  final String slug;
  final String summary;
  final String type;
  final Author author;
  final int replyCount;
  final int likeCount;
  final int viewCount;
  final String? coverImage;
  final CategoryRef? category;
  final List<TagRef> tags;
  final bool isPinned;
  final bool isFeatured;
  final DateTime? publishedAt;
  final DateTime? lastActivityAt;

  /// 正文 HTML。只有详情接口返回，feed 列表里恒为空串。
  final String contentHtml;

  factory TopicSummary.fromJson(Map<String, dynamic> json) => TopicSummary(
        id: (json['id'] as num?)?.toInt() ?? 0,
        title: json['title'] as String? ?? '(无标题)',
        slug: json['slug'] as String? ?? '',
        summary: json['summary'] as String? ?? '',
        type: json['type'] as String? ?? 'article',
        author: Author.fromJson(
          (json['author'] as Map?)?.cast<String, dynamic>() ?? const {},
        ),
        replyCount: (json['replyCount'] as num?)?.toInt() ?? 0,
        likeCount: (json['likeCount'] as num?)?.toInt() ?? 0,
        viewCount: (json['viewCount'] as num?)?.toInt() ?? 0,
        coverImage: json['coverImage'] as String?,
        category: json['category'] == null
            ? null
            : CategoryRef.fromJson((json['category'] as Map).cast<String, dynamic>()),
        tags: ((json['tags'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => TagRef.fromJson(e.cast<String, dynamic>()))
            .toList(growable: false),
        isPinned: json['isPinned'] as bool? ?? false,
        isFeatured: json['isFeatured'] as bool? ?? false,
        publishedAt: _parseTime(json['publishedAt']),
        lastActivityAt: _parseTime(json['lastActivityAt']),
        contentHtml: json['contentHtml'] as String? ?? '',
      );

  /// 列表里优先展示“最后活跃”，没发过回复就退回发布时间。
  DateTime? get displayTime => lastActivityAt ?? publishedAt;

  TopicSummary copyWith({int? likeCount, int? replyCount}) => TopicSummary(
        id: id,
        title: title,
        slug: slug,
        summary: summary,
        type: type,
        author: author,
        replyCount: replyCount ?? this.replyCount,
        likeCount: likeCount ?? this.likeCount,
        viewCount: viewCount,
        coverImage: coverImage,
        category: category,
        tags: tags,
        isPinned: isPinned,
        isFeatured: isFeatured,
        publishedAt: publishedAt,
        lastActivityAt: lastActivityAt,
        contentHtml: contentHtml,
      );
}

class TopicPost {
  const TopicPost({
    required this.id,
    required this.contentHtml,
    required this.author,
    required this.likeCount,
    required this.liked,
    this.parentPostId,
    this.createdAt,
  });

  final int id;
  final String contentHtml;
  final Author author;
  final int likeCount;
  final bool liked;
  final int? parentPostId;
  final DateTime? createdAt;

  factory TopicPost.fromJson(Map<String, dynamic> json) => TopicPost(
        id: (json['id'] as num?)?.toInt() ?? 0,
        contentHtml: json['contentHtml'] as String? ?? '',
        author: Author.fromJson(
          (json['author'] as Map?)?.cast<String, dynamic>() ?? const {},
        ),
        likeCount: (json['likeCount'] as num?)?.toInt() ?? 0,
        liked: json['liked'] as bool? ?? false,
        parentPostId: (json['parentPostId'] as num?)?.toInt(),
        createdAt: _parseTime(json['createdAt']),
      );

  TopicPost copyWith({int? likeCount, bool? liked}) => TopicPost(
        id: id,
        contentHtml: contentHtml,
        author: author,
        likeCount: likeCount ?? this.likeCount,
        liked: liked ?? this.liked,
        parentPostId: parentPostId,
        createdAt: createdAt,
      );
}

class TopicInteractions {
  const TopicInteractions({
    required this.likeCount,
    required this.bookmarkCount,
    required this.liked,
    required this.bookmarked,
    required this.followed,
  });

  final int likeCount;
  final int bookmarkCount;
  final bool liked;
  final bool bookmarked;
  final bool followed;

  factory TopicInteractions.fromJson(Map<String, dynamic> json) => TopicInteractions(
        likeCount: (json['likeCount'] as num?)?.toInt() ?? 0,
        bookmarkCount: (json['bookmarkCount'] as num?)?.toInt() ?? 0,
        liked: json['liked'] as bool? ?? false,
        bookmarked: json['bookmarked'] as bool? ?? false,
        followed: json['followed'] as bool? ?? false,
      );

  TopicInteractions copyWith({
    int? likeCount,
    int? bookmarkCount,
    bool? liked,
    bool? bookmarked,
    bool? followed,
  }) =>
      TopicInteractions(
        likeCount: likeCount ?? this.likeCount,
        bookmarkCount: bookmarkCount ?? this.bookmarkCount,
        liked: liked ?? this.liked,
        bookmarked: bookmarked ?? this.bookmarked,
        followed: followed ?? this.followed,
      );
}

class ViewerState {
  const ViewerState({
    required this.authenticated,
    required this.canReply,
    required this.canEdit,
  });

  final bool authenticated;
  final bool canReply;
  final bool canEdit;

  factory ViewerState.fromJson(Map<String, dynamic> json) => ViewerState(
        authenticated: json['authenticated'] as bool? ?? false,
        canReply: json['canReply'] as bool? ?? false,
        canEdit: json['canEdit'] as bool? ?? false,
      );
}

/// 只有 id 和标题的最小引用，用于「下一篇」这类导航提示。
class TopicRef {
  const TopicRef({required this.id, required this.title});

  final int id;
  final String title;

  factory TopicRef.fromJson(Map<String, dynamic> json) => TopicRef(
        id: (json['id'] as num?)?.toInt() ?? 0,
        title: json['title'] as String? ?? '',
      );
}

class TopicDetail {
  const TopicDetail({
    required this.topic,
    required this.posts,
    required this.interactions,
    required this.me,
    this.related = const [],
    this.nextCandidates = const [],
  });

  final TopicSummary topic;
  final List<TopicPost> posts;
  final TopicInteractions interactions;
  final ViewerState me;
  final List<TopicSummary> related;

  /// 读完这篇之后的下滑候选（服务端按网页同一套推荐算法排序）。
  /// 客户端用「已读队列」挑第一条没读过的，空 = 这批啃完了。
  final List<TopicRef> nextCandidates;

  factory TopicDetail.fromJson(Map<String, dynamic> json) => TopicDetail(
        topic: TopicSummary.fromJson(
          (json['topic'] as Map?)?.cast<String, dynamic>() ?? const {},
        ),
        posts: ((json['posts'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => TopicPost.fromJson(e.cast<String, dynamic>()))
            .toList(growable: false),
        interactions: TopicInteractions.fromJson(
          (json['interactions'] as Map?)?.cast<String, dynamic>() ?? const {},
        ),
        me: ViewerState.fromJson(
          (json['me'] as Map?)?.cast<String, dynamic>() ?? const {},
        ),
        related: ((json['related'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => TopicSummary.fromJson(e.cast<String, dynamic>()))
            .toList(growable: false),
        nextCandidates: ((json['nextCandidates'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => TopicRef.fromJson(e.cast<String, dynamic>()))
            .where((e) => e.id > 0)
            .toList(growable: false),
      );

  TopicDetail copyWith({
    TopicInteractions? interactions,
    List<TopicPost>? posts,
  }) =>
      TopicDetail(
        topic: topic,
        posts: posts ?? this.posts,
        interactions: interactions ?? this.interactions,
        me: me,
        related: related,
        nextCandidates: nextCandidates,
      );
}

/// 帖子 AI 结果。服务端返回 markdown，网页版用 `<pre>` 原样展示，
/// 客户端也按纯文本呈现（不做 markdown 渲染，避免和网页观感分叉）。
class TopicAiResult {
  const TopicAiResult({
    required this.action,
    required this.label,
    required this.outputMarkdown,
    this.provider,
    this.model,
    this.configName,
  });

  final String action;
  final String label;
  final String outputMarkdown;
  final String? provider;
  final String? model;
  final String? configName;

  /// 「配置名 · 模型」，用于结果页脚注。
  String get modelLabel =>
      [configName, model].where((e) => e != null && e.isNotEmpty).join(' · ');

  factory TopicAiResult.fromJson(Map<String, dynamic> json) => TopicAiResult(
        action: json['action'] as String? ?? '',
        label: json['label'] as String? ?? 'AI',
        outputMarkdown: json['outputMarkdown'] as String? ?? '',
        provider: json['provider'] as String?,
        model: json['model'] as String?,
        configName: json['configName'] as String?,
      );
}

/// feed 一页结果。游标语义由服务端决定，客户端只负责原样回传。
class FeedPageResult {
  const FeedPageResult({
    required this.items,
    required this.hasMore,
    this.nextCursor,
  });

  final List<TopicSummary> items;
  final bool hasMore;
  final String? nextCursor;

  factory FeedPageResult.fromJson(Map<String, dynamic> data, Map<String, dynamic>? meta) =>
      FeedPageResult(
        items: ((data['items'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => TopicSummary.fromJson(e.cast<String, dynamic>()))
            .toList(growable: false),
        hasMore: meta?['hasMore'] as bool? ?? false,
        nextCursor: meta?['nextCursor'] as String?,
      );
}

/// 「出发」页的一项：待回答 / 求反馈 / 可领取 / 可补充 / 可更新。
///
/// 打分与排序全在服务端（和网页 `/go` 共用 `listParticipationRecommendations`），
/// 客户端只负责展示，不重排。
class ParticipationItem {
  const ParticipationItem({
    required this.targetType,
    required this.targetId,
    required this.title,
    required this.summary,
    required this.href,
    required this.actionLabel,
    required this.reason,
    this.category,
    this.tags = const [],
    this.score = 0,
    this.replyCount,
    this.viewCount,
    this.submissionCount,
    this.rewardLabel,
  });

  final String targetType;
  final int targetId;
  final String title;
  final String summary;

  /// 站内路径：`/t/<id>` 或 `/agent-zone/tasks/<id>`。
  final String href;
  final String actionLabel;
  final String reason;
  final CategoryRef? category;
  final List<TagRef> tags;
  final double score;

  final int? replyCount;
  final int? viewCount;
  final int? submissionCount;
  final String? rewardLabel;

  /// 帖子类可以直接进原生详情；其余（如社区任务）仍走网页版。
  bool get isTopic => href.startsWith('/t/');

  /// `/t/123` → 123，其它返回 null。
  int? get topicId {
    if (!isTopic) return null;
    return int.tryParse(href.substring(3).split('/').first);
  }

  /// 类型徽章文案，与网页 `ParticipationCard` 的中文标签保持一致。
  String get typeLabel => switch (targetType) {
        'question' => '待回答',
        'topic' => '待参与',
        'project' => '求反馈',
        'resource' => '可补充',
        'community_task' => '可领取',
        'review_needed' => '待判断',
        'stale_content' => '可更新',
        _ => '可参与',
      };

  factory ParticipationItem.fromJson(Map<String, dynamic> json) {
    final stats = (json['stats'] as Map?)?.cast<String, dynamic>() ?? const {};

    return ParticipationItem(
      targetType: json['targetType'] as String? ?? '',
      targetId: (json['targetId'] as num?)?.toInt() ?? 0,
      title: json['title'] as String? ?? '',
      summary: json['summary'] as String? ?? '',
      href: json['href'] as String? ?? '',
      actionLabel: json['actionLabel'] as String? ?? '去看看',
      reason: json['reason'] as String? ?? '',
      category: json['category'] is Map
          ? CategoryRef.fromJson((json['category'] as Map).cast<String, dynamic>())
          : null,
      tags: ((json['tags'] as List?) ?? const [])
          .whereType<Map>()
          .map((e) => TagRef.fromJson(e.cast<String, dynamic>()))
          .toList(growable: false),
      score: (json['score'] as num?)?.toDouble() ?? 0,
      replyCount: (stats['replyCount'] as num?)?.toInt(),
      viewCount: (stats['viewCount'] as num?)?.toInt(),
      submissionCount: (stats['submissionCount'] as num?)?.toInt(),
      rewardLabel: stats['rewardLabel'] as String?,
    );
  }
}

/// 「出发」一页结果。游标语义与服务端一致，客户端原样回传。
class ParticipationPageResult {
  const ParticipationPageResult({
    required this.items,
    required this.hasMore,
    this.nextCursor,
  });

  final List<ParticipationItem> items;
  final bool hasMore;
  final String? nextCursor;

  factory ParticipationPageResult.fromJson(
    Map<String, dynamic> data,
    Map<String, dynamic>? meta,
  ) =>
      ParticipationPageResult(
        items: ((data['items'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => ParticipationItem.fromJson(e.cast<String, dynamic>()))
            .toList(growable: false),
        hasMore: meta?['hasMore'] as bool? ?? false,
        nextCursor: meta?['nextCursor'] as String?,
      );
}

/// 「我」页一次拿全的数据（`GET /api/v1/me/overview`）。
class MeOverview {
  const MeOverview({
    required this.profile,
    required this.stats,
    this.badges = const [],
    this.recentTopics = const [],
    this.unreadCount = 0,
  });

  final MeProfile profile;
  final MeStats stats;
  final List<MeBadge> badges;
  final List<TopicSummary> recentTopics;
  final int unreadCount;

  factory MeOverview.fromJson(Map<String, dynamic> json) => MeOverview(
        profile: MeProfile.fromJson(
          (json['user'] as Map?)?.cast<String, dynamic>() ?? const {},
        ),
        stats: MeStats.fromJson(
          (json['stats'] as Map?)?.cast<String, dynamic>() ?? const {},
        ),
        badges: ((json['badges'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => MeBadge.fromJson(e.cast<String, dynamic>()))
            .toList(growable: false),
        recentTopics: ((json['recentTopics'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => TopicSummary.fromJson(e.cast<String, dynamic>()))
            .toList(growable: false),
        unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
      );

  MeOverview copyWith({int? unreadCount}) => MeOverview(
        profile: profile,
        stats: stats,
        badges: badges,
        recentTopics: recentTopics,
        unreadCount: unreadCount ?? this.unreadCount,
      );
}

class MeProfile {
  const MeProfile({
    required this.id,
    required this.username,
    required this.displayName,
    this.avatarUrl,
    this.bio = '',
    this.websiteUrl,
    this.githubUrl,
    this.locale = 'zh',
    this.role,
    this.joinedAt,
  });

  final int id;
  final String username;
  final String displayName;
  final String? avatarUrl;
  final String bio;
  final String? websiteUrl;
  final String? githubUrl;
  final String locale;
  final String? role;
  final DateTime? joinedAt;

  String get initial =>
      (displayName.isNotEmpty ? displayName : username).trim().isEmpty
          ? 'W'
          : (displayName.isNotEmpty ? displayName : username)
              .trim()
              .characters
              .first
              .toUpperCase();

  factory MeProfile.fromJson(Map<String, dynamic> json) => MeProfile(
        id: (json['id'] as num?)?.toInt() ?? 0,
        username: json['username'] as String? ?? '',
        displayName: (json['displayName'] as String?)?.trim().isNotEmpty == true
            ? json['displayName'] as String
            : (json['username'] as String? ?? ''),
        avatarUrl: json['avatarUrl'] as String?,
        bio: json['bio'] as String? ?? '',
        websiteUrl: json['websiteUrl'] as String?,
        githubUrl: json['githubUrl'] as String?,
        locale: json['locale'] as String? ?? 'zh',
        role: json['role'] as String?,
        joinedAt: _parseTime(json['joinedAt']),
      );
}

class MeStats {
  const MeStats({
    this.topicCount = 0,
    this.replyCount = 0,
    this.featuredCount = 0,
    this.badgeCount = 0,
    this.followerCount = 0,
    this.followingCount = 0,
    this.contributionScore = 0,
    this.trustLevel = 1,
    this.trustName = '',
    this.nextLevelScore,
    this.nextLevelName,
  });

  final int topicCount;
  final int replyCount;
  final int featuredCount;
  final int badgeCount;
  final int followerCount;
  final int followingCount;
  final int contributionScore;
  final int trustLevel;
  final String trustName;
  final int? nextLevelScore;
  final String? nextLevelName;

  factory MeStats.fromJson(Map<String, dynamic> json) => MeStats(
        topicCount: (json['topicCount'] as num?)?.toInt() ?? 0,
        replyCount: (json['replyCount'] as num?)?.toInt() ?? 0,
        featuredCount: (json['featuredCount'] as num?)?.toInt() ?? 0,
        badgeCount: (json['badgeCount'] as num?)?.toInt() ?? 0,
        followerCount: (json['followerCount'] as num?)?.toInt() ?? 0,
        followingCount: (json['followingCount'] as num?)?.toInt() ?? 0,
        contributionScore: (json['contributionScore'] as num?)?.toInt() ?? 0,
        trustLevel: (json['trustLevel'] as num?)?.toInt() ?? 1,
        trustName: json['trustName'] as String? ?? '',
        nextLevelScore: (json['nextLevelScore'] as num?)?.toInt(),
        nextLevelName: json['nextLevelName'] as String?,
      );
}

class MeBadge {
  const MeBadge({
    required this.id,
    required this.name,
    this.icon = '',
    this.tone = 'blue',
  });

  final String id;
  final String name;
  final String icon;

  /// blue / green / gold / violet / rose，客户端按它选配色。
  final String tone;

  factory MeBadge.fromJson(Map<String, dynamic> json) => MeBadge(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        icon: json['icon'] as String? ?? '',
        tone: json['tone'] as String? ?? 'blue',
      );
}

/// 「出发」页的一条待办（`GET /api/v1/me/todo`）。
///
/// 和 [TopicSummary] 的根本区别：这不是一篇内容，而是**一件和你有关的事** ——
/// 谁做了什么、你该点什么。
class TodoItem {
  const TodoItem({
    required this.id,
    required this.kind,
    required this.reason,
    required this.title,
    required this.actionLabel,
    required this.href,
    this.topicId,
    this.actorName,
    this.actorAvatarUrl,
    this.unread = false,
    this.at,
  });

  final String id;

  /// reply / review / followed
  final String kind;

  /// 一句话说明发生了什么，例如「李明 回复了你的话题」。
  final String reason;

  /// 指向的对象标题（帖子标题 / 任务名）。
  final String title;
  final String actionLabel;
  final String href;
  final int? topicId;
  final String? actorName;
  final String? actorAvatarUrl;
  final bool unread;
  final DateTime? at;

  factory TodoItem.fromJson(Map<String, dynamic> json) => TodoItem(
        id: json['id'] as String? ?? '',
        kind: json['kind'] as String? ?? 'reply',
        reason: json['reason'] as String? ?? '',
        title: json['title'] as String? ?? '',
        actionLabel: json['actionLabel'] as String? ?? '去看看',
        href: json['href'] as String? ?? '/',
        topicId: (json['topicId'] as num?)?.toInt(),
        actorName: json['actorName'] as String?,
        actorAvatarUrl: json['actorAvatarUrl'] as String?,
        unread: json['unread'] as bool? ?? false,
        at: _parseTime(json['at']),
      );
}

class TodoGroup {
  const TodoGroup({
    required this.key,
    required this.label,
    required this.items,
  });

  final String key;
  final String label;
  final List<TodoItem> items;

  int get count => items.length;

  factory TodoGroup.fromJson(Map<String, dynamic> json) => TodoGroup(
        key: json['key'] as String? ?? '',
        label: json['label'] as String? ?? '',
        items: ((json['items'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => TodoItem.fromJson(e.cast<String, dynamic>()))
            .toList(growable: false),
      );
}

class TodoSummary {
  const TodoSummary({this.total = 0, this.unread = 0, this.actionable = 0});

  final int total;
  final int unread;

  /// 需要动手的件数（等你回应 + 等你验收），不含「你关注的在动」。
  final int actionable;

  factory TodoSummary.fromJson(Map<String, dynamic> json) => TodoSummary(
        total: (json['total'] as num?)?.toInt() ?? 0,
        unread: (json['unread'] as num?)?.toInt() ?? 0,
        actionable: (json['actionable'] as num?)?.toInt() ?? 0,
      );
}

/// 「出发」页一屏的数据。
class TodoBoard {
  const TodoBoard({this.summary = const TodoSummary(), this.groups = const []});

  final TodoSummary summary;
  final List<TodoGroup> groups;

  bool get isEmpty => groups.isEmpty;

  factory TodoBoard.fromJson(Map<String, dynamic> json) => TodoBoard(
        summary: TodoSummary.fromJson(
          (json['summary'] as Map?)?.cast<String, dynamic>() ?? const {},
        ),
        groups: ((json['groups'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => TodoGroup.fromJson(e.cast<String, dynamic>()))
            .toList(growable: false),
      );
}

/// 发布页用的选项（`GET /api/v1/meta/taxonomy`）。
class Taxonomy {
  const Taxonomy({
    this.categories = const [],
    this.tags = const [],
    this.types = const [],
  });

  final List<CategoryRef> categories;
  final List<TagRef> tags;
  final List<TaxonomyType> types;

  factory Taxonomy.fromJson(Map<String, dynamic> json) => Taxonomy(
        categories: ((json['categories'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => CategoryRef.fromJson(e.cast<String, dynamic>()))
            .toList(growable: false),
        tags: ((json['tags'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => TagRef.fromJson(e.cast<String, dynamic>()))
            .toList(growable: false),
        types: ((json['types'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => TaxonomyType.fromJson(e.cast<String, dynamic>()))
            .toList(growable: false),
      );
}

class TaxonomyType {
  const TaxonomyType({required this.id, required this.label});

  final String id;
  final String label;

  factory TaxonomyType.fromJson(Map<String, dynamic> json) => TaxonomyType(
        id: json['id'] as String? ?? 'discussion',
        label: json['label'] as String? ?? '讨论',
      );
}

/// 「关注」流的过滤维度。wire 值与服务端 `filter` 参数一一对应。
enum FollowingFilter {
  all('全部', 'all'),
  topics('话题', 'topics'),
  users('作者', 'users'),
  categories('分类', 'categories'),
  tags('标签', 'tags');

  const FollowingFilter(this.label, this.wire);

  final String label;
  final String wire;
}

/// 「关注」流的一条：哪条订阅源把它带来的 + 帖子摘要。
///
/// 和「看见」的区别就在 `sourceType` / `sourceLabel`：看见给的是「为什么推荐给你」，
/// 关注给的是「你订阅了谁」，所以来源必须显式写出来。
class FollowingItem {
  const FollowingItem({
    required this.sourceType,
    required this.sourceLabel,
    required this.topicId,
    required this.title,
    required this.summary,
    required this.timeLabel,
    this.category,
    this.tags = const [],
  });

  /// `topic` / `user` / `category` / `tag`
  final String sourceType;

  /// 来源名：话题标题、作者昵称、分类名、标签名
  final String sourceLabel;

  final int topicId;
  final String title;
  final String summary;

  /// 相对时间（「3 小时前」），服务端按 locale 算好
  final String timeLabel;

  final CategoryRef? category;
  final List<TagRef> tags;

  /// 来源徽章前缀，和网页 `/following` 的 "来自" 保持一致
  String get sourcePrefix => '来自';

  String get sourceTypeLabel => switch (sourceType) {
        'user' => '作者',
        'category' => '分类',
        'tag' => '标签',
        _ => '话题',
      };

  factory FollowingItem.fromJson(Map<String, dynamic> json) => FollowingItem(
        sourceType: json['sourceType'] as String? ?? 'topic',
        sourceLabel: json['sourceLabel'] as String? ?? '',
        topicId: (json['targetId'] as num?)?.toInt() ?? 0,
        title: json['title'] as String? ?? '(无标题)',
        summary: json['summary'] as String? ?? '',
        timeLabel: json['timeLabel'] as String? ?? '',
        category: json['category'] is Map
            ? CategoryRef.fromJson((json['category'] as Map).cast<String, dynamic>())
            : null,
        tags: ((json['tags'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => TagRef.fromJson(e.cast<String, dynamic>()))
            .toList(growable: false),
      );
}

/// 「关注」一页结果。游标原样回传，语义由服务端决定。
class FollowingPageResult {
  const FollowingPageResult({
    required this.items,
    required this.hasMore,
    this.nextCursor,
  });

  final List<FollowingItem> items;
  final bool hasMore;
  final String? nextCursor;

  factory FollowingPageResult.fromJson(
    Map<String, dynamic> data,
    Map<String, dynamic>? meta,
  ) =>
      FollowingPageResult(
        items: ((data['items'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => FollowingItem.fromJson(e.cast<String, dynamic>()))
            .toList(growable: false),
        hasMore: meta?['hasMore'] as bool? ?? false,
        nextCursor: meta?['nextCursor'] as String?,
      );
}

enum NotificationFilter {
  all('全部', 'all'),
  replies('回复', 'replies'),
  mentions('@我', 'mentions'),
  likes('赞', 'likes'),
  system('系统', 'system');

  const NotificationFilter(this.label, this.wire);

  final String label;
  final String wire;
}

/// 各档未读数。切档时不用重新算角标，一次拉回来。
class NotificationCounts {
  const NotificationCounts({
    this.total = 0,
    this.replies = 0,
    this.mentions = 0,
    this.likes = 0,
    this.system = 0,
  });

  final int total;
  final int replies;
  final int mentions;
  final int likes;
  final int system;

  int of(NotificationFilter filter) => switch (filter) {
        NotificationFilter.all => total,
        NotificationFilter.replies => replies,
        NotificationFilter.mentions => mentions,
        NotificationFilter.likes => likes,
        NotificationFilter.system => system,
      };

  factory NotificationCounts.fromJson(Map<String, dynamic>? json) => NotificationCounts(
        total: (json?['total'] as num?)?.toInt() ?? 0,
        replies: (json?['replies'] as num?)?.toInt() ?? 0,
        mentions: (json?['mentions'] as num?)?.toInt() ?? 0,
        likes: (json?['likes'] as num?)?.toInt() ?? 0,
        system: (json?['system'] as num?)?.toInt() ?? 0,
      );

  /// 点开某条后本地减一，省一次整页刷新
  NotificationCounts markRead(NotificationFilter kind) {
    int dec(int value) => value > 0 ? value - 1 : 0;
    return NotificationCounts(
      total: dec(total),
      replies: kind == NotificationFilter.replies ? dec(replies) : replies,
      mentions: kind == NotificationFilter.mentions ? dec(mentions) : mentions,
      likes: kind == NotificationFilter.likes ? dec(likes) : likes,
      system: kind == NotificationFilter.system ? dec(system) : system,
    );
  }
}

/// 一条通知。
///
/// `kind` 由服务端给（reply / mention / like / system），客户端不解析 `type` ——
/// 以后加新 type 不用发版。
class NotificationItem {
  const NotificationItem({
    required this.id,
    required this.type,
    required this.kind,
    required this.title,
    required this.body,
    required this.href,
    required this.read,
    required this.timeLabel,
    this.topicId,
    this.target = const NotificationTarget(kind: 'web', path: '/'),
    this.actorName,
    this.actorUsername,
    this.actorAvatarUrl,
    this.at,
  });

  final int id;
  final String type;

  /// `reply` / `mention` / `like` / `system`
  final String kind;

  final String title;
  final String body;
  final String href;
  final bool read;

  /// 相对时间（「3 分钟前」或日期），服务端按 locale 算好
  final String timeLabel;

  /// 能从 href 解析出帖子 id 就走原生阅读器，否则交给网页容器
  /// （老字段，保留是为了兼容还没升级的服务端）
  final int? topicId;

  /// 点开去哪儿：阅读器 / 审核页 / 网页。判断在服务端做。
  final NotificationTarget target;

  final String? actorName;
  final String? actorUsername;
  final String? actorAvatarUrl;
  final DateTime? at;

  NotificationFilter get filterOf => switch (kind) {
        'reply' => NotificationFilter.replies,
        'mention' => NotificationFilter.mentions,
        'like' => NotificationFilter.likes,
        _ => NotificationFilter.system,
      };

  /// 头像里显示的那个字：系统通知没有作者，用符号占位
  String get initial {
    final name = (actorName ?? '').trim();
    return name.isEmpty ? '' : name.substring(0, 1).toUpperCase();
  }

  NotificationItem asRead() => NotificationItem(
        id: id,
        type: type,
        kind: kind,
        title: title,
        body: body,
        href: href,
        read: true,
        timeLabel: timeLabel,
        topicId: topicId,
        target: target,
        actorName: actorName,
        actorUsername: actorUsername,
        actorAvatarUrl: actorAvatarUrl,
        at: at,
      );

  factory NotificationItem.fromJson(Map<String, dynamic> json) => NotificationItem(
        id: (json['id'] as num?)?.toInt() ?? 0,
        type: json['type'] as String? ?? '',
        kind: json['kind'] as String? ?? 'system',
        title: json['title'] as String? ?? '',
        body: json['body'] as String? ?? '',
        href: json['href'] as String? ?? '/',
        read: json['read'] as bool? ?? false,
        timeLabel: json['timeLabel'] as String? ?? '',
        topicId: (json['topicId'] as num?)?.toInt(),
        target: NotificationTarget.fromJson(
          (json['target'] as Map?)?.cast<String, dynamic>(),
          href: json['href'] as String? ?? '/',
          topicId: (json['topicId'] as num?)?.toInt(),
        ),
        actorName: json['actorName'] as String?,
        actorUsername: json['actorUsername'] as String?,
        actorAvatarUrl: json['actorAvatarUrl'] as String?,
        at: _parseTime(json['at']),
      );
}

/// 点开一条通知该去哪儿。
///
/// 由服务端判定（它知道当前账号是不是管理员），客户端只照 `kind` 走。
/// 客户端自己按 type 字符串猜的话，「待审话题」这种 href 是后台地址的通知
/// 迟早会把普通用户扔进 /admin。
class NotificationTarget {
  const NotificationTarget({
    required this.kind,
    required this.path,
    this.topicId,
  });

  /// `topic` 原生阅读器 / `review` 审核页 / `web` 网页容器
  final String kind;

  /// 目标话题；`web` 时为 null
  final int? topicId;

  /// 兜底地址（网页容器用）
  final String path;

  bool get opensReader => kind == 'topic' && (topicId ?? 0) > 0;
  bool get opensReview => kind == 'review' && (topicId ?? 0) > 0;

  factory NotificationTarget.fromJson(
    Map<String, dynamic>? json, {
    required String href,
    int? topicId,
  }) {
    final id = (json?['topicId'] as num?)?.toInt() ?? topicId;
    final kind = json?['kind'] as String?;
    if (kind == null) {
      // 老服务端只给 topicId：能解析出帖子就走阅读器，否则网页
      return NotificationTarget(
        kind: (id ?? 0) > 0 ? 'topic' : 'web',
        topicId: id,
        path: href,
      );
    }
    return NotificationTarget(
      kind: kind,
      topicId: id,
      path: json?['path'] as String? ?? href,
    );
  }
}

class NotificationPageResult {
  const NotificationPageResult({
    required this.items,
    required this.counts,
    required this.hasMore,
    this.nextCursor,
  });

  final List<NotificationItem> items;
  final NotificationCounts counts;
  final bool hasMore;
  final String? nextCursor;

  factory NotificationPageResult.fromJson(
    Map<String, dynamic> data,
    Map<String, dynamic>? meta,
  ) =>
      NotificationPageResult(
        items: ((data['items'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => NotificationItem.fromJson(e.cast<String, dynamic>()))
            .toList(growable: false),
        counts: NotificationCounts.fromJson(
          (data['counts'] as Map?)?.cast<String, dynamic>(),
        ),
        hasMore: meta?['hasMore'] as bool? ?? false,
        nextCursor: meta?['nextCursor'] as String?,
      );
}

DateTime? _parseTime(Object? value) {
  if (value is! String || value.isEmpty) return null;
  return DateTime.tryParse(value)?.toLocal();
}

// ---------------------------------------------------------------- 审核

/// 自动审核给的预判。
///
/// 它是「审核页」存在的理由：没有它，管理员得从头读完再自己下判断；
/// 有了它，多数内容扫一眼理由就能拍板，只有分歧时才认真读正文。
class ReviewVerdict {
  const ReviewVerdict({
    required this.decision,
    required this.riskScore,
    required this.reasons,
    required this.resultStatus,
    required this.model,
    this.at,
  });

  /// `approve` / `reject` / `needs_human` / `unknown`
  final String decision;

  /// 0-100，越大越该拦
  final int riskScore;
  final List<String> reasons;

  /// `applied` / `needs_human` / `failed`
  final String resultStatus;
  final String model;
  final DateTime? at;

  /// 一句话结论，直接用 AI 的原话级别判断
  String get headline => switch (decision) {
        'approve' => '建议通过',
        'reject' => '建议退回',
        'needs_human' => '需要人工判断',
        _ => '没有预审结论',
      };

  factory ReviewVerdict.fromJson(Map<String, dynamic> json) => ReviewVerdict(
        decision: json['decision'] as String? ?? 'unknown',
        riskScore: (json['riskScore'] as num?)?.toInt() ?? 0,
        reasons: ((json['reasons'] as List?) ?? const [])
            .whereType<String>()
            .where((e) => e.trim().isNotEmpty)
            .toList(growable: false),
        resultStatus: json['resultStatus'] as String? ?? '',
        model: json['model'] as String? ?? '',
        at: _parseTime(json['createdAt']),
      );
}

/// 待审话题（管理员视角：draft/pending 也能读到正文）。
class ReviewTopic {
  const ReviewTopic({
    required this.id,
    required this.title,
    required this.summary,
    required this.contentHtml,
    required this.type,
    required this.status,
    required this.author,
    required this.category,
    required this.tags,
    this.createdAt,
  });

  final int id;
  final String title;
  final String summary;
  final String contentHtml;
  final String type;
  final String status;
  final Author author;
  final CategoryRef category;
  final List<TagRef> tags;
  final DateTime? createdAt;

  factory ReviewTopic.fromJson(Map<String, dynamic> json) => ReviewTopic(
        id: (json['id'] as num?)?.toInt() ?? 0,
        title: json['title'] as String? ?? '',
        summary: json['summary'] as String? ?? '',
        contentHtml: json['contentHtml'] as String? ?? '',
        type: json['type'] as String? ?? '',
        status: json['status'] as String? ?? '',
        author: Author.fromJson((json['author'] as Map?)?.cast<String, dynamic>() ?? const {}),
        category: CategoryRef.fromJson((json['category'] as Map?)?.cast<String, dynamic>() ?? const {}),
        tags: ((json['tags'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => TagRef.fromJson(e.cast<String, dynamic>()))
            .toList(growable: false),
        createdAt: _parseTime(json['createdAt']),
      );
}

class ReviewDetail {
  const ReviewDetail({
    required this.topic,
    required this.remaining,
    this.verdict,
    this.nextId,
  });

  final ReviewTopic topic;
  final ReviewVerdict? verdict;

  /// 除这一条之外还有几条待审
  final int remaining;

  /// 队列里的下一条
  final int? nextId;

  factory ReviewDetail.fromJson(Map<String, dynamic> json) {
    final queue = (json['queue'] as Map?)?.cast<String, dynamic>() ?? const {};
    return ReviewDetail(
      topic: ReviewTopic.fromJson(
        (json['topic'] as Map?)?.cast<String, dynamic>() ?? const {},
      ),
      verdict: json['verdict'] is Map
          ? ReviewVerdict.fromJson((json['verdict'] as Map).cast<String, dynamic>())
          : null,
      remaining: (queue['remaining'] as num?)?.toInt() ?? 0,
      nextId: (queue['nextId'] as num?)?.toInt(),
    );
  }
}

/// 审核动作的结果：给了下一步去哪儿，页面不必自己算队列。
class ReviewActionResult {
  const ReviewActionResult({
    required this.id,
    required this.status,
    required this.remaining,
    this.nextId,
  });

  final int id;
  final String status;
  final int remaining;
  final int? nextId;

  factory ReviewActionResult.fromJson(Map<String, dynamic> json) {
    final queue = (json['queue'] as Map?)?.cast<String, dynamic>() ?? const {};
    return ReviewActionResult(
      id: (json['id'] as num?)?.toInt() ?? 0,
      status: json['status'] as String? ?? '',
      remaining: (queue['remaining'] as num?)?.toInt() ?? 0,
      nextId: (queue['nextId'] as num?)?.toInt(),
    );
  }
}

/// 一条搜索结果。
///
/// `kind` 是服务端判的（topic / reply / category / tag / user），客户端只按它
/// 决定点开去哪儿，不解析标题猜类型。`href` 是网页路径，兜底一律能进网页。
class SearchHit {
  const SearchHit({
    required this.kind,
    required this.title,
    required this.href,
    this.summary = '',
    this.meta = '',
    this.replyCount = 0,
    this.viewCount = 0,
  });

  final String kind;
  final String title;
  final String href;
  final String summary;

  /// 服务端算好的副标（时间 / 计数），客户端不重算
  final String meta;
  final int replyCount;
  final int viewCount;

  String get kindLabel => switch (kind) {
        'topic' => '话题',
        'reply' => '回复',
        'category' => '分类',
        'tag' => '标签',
        'user' => '用户',
        _ => '结果',
      };

  /// 话题详情页能原生打开；分类 / 标签 / 用户页也有原生版本，靠 href 取 slug。
  String? get nativePath {
    switch (kind) {
      case 'topic':
        final match = RegExp(r'^/t/(\d+)').firstMatch(href);
        final id = int.tryParse(match?.group(1) ?? '');
        return id == null ? null : '/t/$id';
      case 'user':
        final match = RegExp(r'^/u/([^/?#]+)').firstMatch(href);
        return match == null ? null : '/u/${match.group(1)}';
      // 分类和标签的 slug 可能是中文（标签尤其常见），href 里是百分号编码的，
      // 直接拼进路由会把「%E8%B7%AF…」当路径的一部分，得先解码再编码一次
      case 'category':
        final match = RegExp(r'^/c/([^/?#]+)').firstMatch(href);
        return match == null
            ? null
            : '/c/${Uri.encodeComponent(Uri.decodeComponent(match.group(1)!))}';
      case 'tag':
        final match = RegExp(r'^/tag/([^/?#]+)').firstMatch(href);
        return match == null
            ? null
            : '/tag/${Uri.encodeComponent(Uri.decodeComponent(match.group(1)!))}';
      default:
        return null;
    }
  }

  factory SearchHit.fromJson(Map<String, dynamic> json) => SearchHit(
        kind: json['kind'] as String? ?? 'topic',
        title: json['title'] as String? ?? '',
        href: json['href'] as String? ?? '/',
        summary: json['summary'] as String? ?? '',
        meta: json['meta'] as String? ?? '',
        replyCount: (json['replyCount'] as num?)?.toInt() ?? 0,
        viewCount: (json['viewCount'] as num?)?.toInt() ?? 0,
      );
}

class SearchOutcome {
  const SearchOutcome({
    required this.q,
    required this.hits,
    this.notes = const [],
    this.warnings = const [],
  });

  final String q;
  final List<SearchHit> hits;

  /// 搜索词被指令 / AI 改写时的说明，直接展示给用户
  final List<String> notes;
  final List<String> warnings;

  /// 结果按 kind 分组，顺序固定：先话题，其余按出现顺序
  List<MapEntry<String, List<SearchHit>>> get grouped {
    const order = ['topic', 'reply', 'user', 'category', 'tag'];
    final buckets = <String, List<SearchHit>>{};
    for (final hit in hits) {
      buckets.putIfAbsent(hit.kind, () => []).add(hit);
    }
    final keys = [...order.where(buckets.containsKey), ...buckets.keys.where((k) => !order.contains(k))];
    return [for (final key in keys) MapEntry(key, buckets[key]!)];
  }

  factory SearchOutcome.fromJson(Map<String, dynamic> json) => SearchOutcome(
        q: json['q'] as String? ?? '',
        hits: ((json['results'] as List?) ?? const [])
            .whereType<Map>()
            .map((item) => SearchHit.fromJson(item.cast<String, dynamic>()))
            .toList(),
        notes: _stringList(json['notes']),
        warnings: _stringList(json['warnings']),
      );
}

List<String> _stringList(Object? value) =>
    ((value as List?) ?? const []).whereType<String>().toList();

/// 别人的主页 / 自己的主页都用它。
class ProfilePageData {
  const ProfilePageData({
    required this.id,
    required this.username,
    required this.displayName,
    required this.isSelf,
    required this.following,
    required this.topics,
    required this.stats,
    this.avatarUrl,
    this.bio = '',
    this.role = 'member',
    this.websiteUrl,
    this.githubUrl,
    this.joinedAt,
  });

  final int id;
  final String username;
  final String displayName;
  final String? avatarUrl;
  final String bio;
  final String role;
  final String? websiteUrl;
  final String? githubUrl;
  final DateTime? joinedAt;

  final bool isSelf;
  final bool following;
  final List<TopicSummary> topics;
  final ProfileStats stats;

  factory ProfilePageData.fromJson(Map<String, dynamic> json) {
    final user = (json['user'] as Map?)?.cast<String, dynamic>() ?? const {};
    return ProfilePageData(
      id: (user['id'] as num?)?.toInt() ?? 0,
      username: user['username'] as String? ?? '',
      displayName: user['displayName'] as String? ?? '',
      avatarUrl: user['avatarUrl'] as String?,
      bio: user['bio'] as String? ?? '',
      role: user['role'] as String? ?? 'member',
      websiteUrl: user['websiteUrl'] as String?,
      githubUrl: user['githubUrl'] as String?,
      joinedAt: _parseTime(user['joinedAt']),
      isSelf: json['isSelf'] as bool? ?? false,
      following: json['following'] as bool? ?? false,
      stats: ProfileStats.fromJson(
        (json['stats'] as Map?)?.cast<String, dynamic>() ?? const {},
      ),
      topics: ((json['topics'] as List?) ?? const [])
          .whereType<Map>()
          .map((item) => TopicSummary.fromJson(item.cast<String, dynamic>()))
          .toList(),
    );
  }
}

class ProfileStats {
  const ProfileStats({
    this.topicCount = 0,
    this.replyCount = 0,
    this.featuredCount = 0,
    this.followerCount = 0,
    this.followingCount = 0,
    this.badgeCount = 0,
    this.trustName,
  });

  final int topicCount;
  final int replyCount;
  final int featuredCount;
  final int followerCount;
  final int followingCount;
  final int badgeCount;
  final String? trustName;

  factory ProfileStats.fromJson(Map<String, dynamic> json) => ProfileStats(
        topicCount: (json['topicCount'] as num?)?.toInt() ?? 0,
        replyCount: (json['replyCount'] as num?)?.toInt() ?? 0,
        featuredCount: (json['featuredCount'] as num?)?.toInt() ?? 0,
        followerCount: (json['followerCount'] as num?)?.toInt() ?? 0,
        followingCount: (json['followingCount'] as num?)?.toInt() ?? 0,
        badgeCount: (json['badgeCount'] as num?)?.toInt() ?? 0,
        trustName: json['trustName'] as String?,
      );
}

/// 「设置 → 公开资料」回填用，比 [ProfilePageData] 多邮箱（只有本人能看到）。
class MyProfile {
  const MyProfile({
    required this.username,
    required this.displayName,
    required this.bio,
    required this.locale,
    this.avatarUrl,
    this.email,
    this.websiteUrl,
    this.githubUrl,
  });

  final String username;
  final String displayName;
  final String bio;
  final String locale;
  final String? avatarUrl;
  final String? email;
  final String? websiteUrl;
  final String? githubUrl;

  factory MyProfile.fromJson(Map<String, dynamic> json) => MyProfile(
        username: json['username'] as String? ?? '',
        displayName: json['displayName'] as String? ?? '',
        bio: json['bio'] as String? ?? '',
        locale: json['locale'] as String? ?? 'zh',
        avatarUrl: json['avatarUrl'] as String?,
        email: json['email'] as String?,
        websiteUrl: json['websiteUrl'] as String?,
        githubUrl: json['githubUrl'] as String?,
      );
}

/// 一个绑定的 Agent 设备。
class AgentDevice {
  const AgentDevice({
    required this.id,
    required this.deviceName,
    required this.agentName,
    required this.status,
    this.tokenPrefix,
    this.lastSeenAt,
    this.lastIpAddress,
  });

  final int id;
  final String deviceName;
  final String agentName;
  final String status;
  final String? tokenPrefix;
  final DateTime? lastSeenAt;
  final String? lastIpAddress;

  bool get active => status == 'active';

  factory AgentDevice.fromJson(Map<String, dynamic> json) => AgentDevice(
        id: (json['id'] as num?)?.toInt() ?? 0,
        deviceName: json['deviceName'] as String? ?? '未命名设备',
        agentName: json['agentName'] as String? ?? '',
        status: json['status'] as String? ?? 'active',
        tokenPrefix: json['tokenPrefix'] as String?,
        lastSeenAt: _parseTime(json['lastSeenAt']),
        lastIpAddress: json['lastIpAddress'] as String?,
      );
}

/// 分类 / 标签列表里的一项。
///
/// 两个接口回的形状几乎一样（name/slug/description/topicCount，分类多个 color），
/// 用一个模型装，页面上就能拿同一套 widget 渲染。
class TaxonomyItem {
  const TaxonomyItem({
    required this.id,
    required this.name,
    required this.slug,
    this.description = '',
    this.color = '',
    this.topicCount = 0,
  });

  final int id;
  final String name;
  final String slug;
  final String description;
  final String color;
  final int topicCount;

  factory TaxonomyItem.fromJson(Map<String, dynamic> json) => TaxonomyItem(
        id: (json['id'] as num?)?.toInt() ?? 0,
        name: json['name'] as String? ?? '',
        slug: json['slug'] as String? ?? '',
        description: json['description'] as String? ?? '',
        color: json['color'] as String? ?? '',
        topicCount: (json['topicCount'] as num?)?.toInt() ?? 0,
      );
}

/// 分类页 / 标签页的内容：头部的说明 + 一页话题。
class TaxonomyDetail {
  const TaxonomyDetail({
    required this.kind,
    required this.item,
    required this.topics,
    required this.hasMore,
    this.nextOffset,
  });

  /// `category` / `tag`。页面只拿它决定文案（「分类」还是「标签」）。
  final String kind;
  final TaxonomyItem item;
  final List<TopicSummary> topics;
  final bool hasMore;
  final int? nextOffset;

  TaxonomyDetail copyWith({
    List<TopicSummary>? topics,
    bool? hasMore,
    int? nextOffset,
  }) =>
      TaxonomyDetail(
        kind: kind,
        item: item,
        topics: topics ?? this.topics,
        hasMore: hasMore ?? this.hasMore,
        nextOffset: nextOffset ?? this.nextOffset,
      );

  String get kindLabel => kind == 'tag' ? '标签' : '分类';
}

/// 编辑页的预填数据：服务端只给作者本人 / 管理员。
class TopicDraft {
  const TopicDraft({
    required this.id,
    required this.title,
    required this.contentMarkdown,
    required this.type,
    required this.categoryId,
    required this.status,
    this.tags = const [],
  });

  final int id;
  final String title;
  final String contentMarkdown;
  final String type;
  final int? categoryId;
  final String status;
  final List<String> tags;

  factory TopicDraft.fromJson(Map<String, dynamic> json) => TopicDraft(
        id: (json['id'] as num?)?.toInt() ?? 0,
        title: json['title'] as String? ?? '',
        contentMarkdown: json['contentMarkdown'] as String? ?? '',
        type: json['type'] as String? ?? 'discussion',
        categoryId: (json['categoryId'] as num?)?.toInt(),
        status: json['status'] as String? ?? 'published',
        tags: ((json['tags'] as List?) ?? const []).whereType<String>().toList(),
      );
}
