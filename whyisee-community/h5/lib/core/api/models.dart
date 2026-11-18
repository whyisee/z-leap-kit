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

DateTime? _parseTime(Object? value) {
  if (value is! String || value.isEmpty) return null;
  return DateTime.tryParse(value)?.toLocal();
}
