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
    this.next,
  });

  final TopicSummary topic;
  final List<TopicPost> posts;
  final TopicInteractions interactions;
  final ViewerState me;
  final List<TopicSummary> related;

  /// 读完这篇之后的下一篇（服务端按网页同一套推荐算法给出）。null = 没有下一篇。
  final TopicRef? next;

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
        next: json['next'] is Map
            ? TopicRef.fromJson((json['next'] as Map).cast<String, dynamic>())
            : null,
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
        next: next,
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
class FeedPage {
  const FeedPage({
    required this.items,
    required this.hasMore,
    this.nextCursor,
  });

  final List<TopicSummary> items;
  final bool hasMore;
  final String? nextCursor;

  factory FeedPage.fromJson(Map<String, dynamic> data, Map<String, dynamic>? meta) =>
      FeedPage(
        items: ((data['items'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => TopicSummary.fromJson(e.cast<String, dynamic>()))
            .toList(growable: false),
        hasMore: meta?['hasMore'] as bool? ?? false,
        nextCursor: meta?['nextCursor'] as String?,
      );
}

DateTime? _parseTime(Object? value) {
  if (value is! String || value.isEmpty) return null;
  return DateTime.tryParse(value)?.toLocal();
}
