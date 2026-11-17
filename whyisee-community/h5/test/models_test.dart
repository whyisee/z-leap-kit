import 'package:flutter_test/flutter_test.dart';
import 'package:whyisee_app/core/api/models.dart';

/// 用线上 `/api/v1/topics/31` 的真实响应片段做 fixture。
/// 目的不是测 JSON 库，而是锁住**字段名**：服务端改字段名时这里先红。
void main() {
  test('详情响应能完整解析出 topic/posts/interactions/me/related', () {
    final json = <String, dynamic>{
      'topic': {
        'id': 31,
        'title': 'whyisee.xyz 上线初期想认真聊什么',
        'slug': 'whyisee-launch-community-focus',
        'summary': '社区首版会聚焦独立开发、AI 工具、SEO 流量。',
        'type': 'article',
        'coverImage': null,
        'author': {
          'id': 1,
          'username': 'whyisee',
          'displayName': 'whyisee',
          'avatarUrl': null,
          'role': 'admin',
          'isAnonymous': false,
        },
        'category': {'id': 61, 'name': '文档', 'slug': 'docs', 'color': '#8ab4f8'},
        'tags': [
          {'id': 114, 'name': 'indie-dev', 'slug': 'indie-dev'},
        ],
        'replyCount': 2,
        'likeCount': 9,
        'viewCount': 143,
        'isPinned': false,
        'isFeatured': true,
        'publishedAt': '2026-11-10T08:00:00.000Z',
        'lastActivityAt': '2026-11-16T09:31:00.000Z',
        'contentHtml': '<p>正文</p>',
        'status': 'published',
      },
      'posts': [
        {
          'id': 19,
          'parentPostId': null,
          'contentHtml': '<p>第一条回复</p>',
          'author': {'id': 2, 'username': 'bob', 'displayName': 'Bob', 'avatarUrl': null},
          'likeCount': 3,
          'liked': true,
          'createdAt': '2026-11-16T09:30:00.000Z',
        },
      ],
      'interactions': {
        'likeCount': 9,
        'bookmarkCount': 4,
        'liked': false,
        'bookmarked': true,
        'followed': false,
      },
      'me': {'authenticated': false, 'canReply': false, 'canEdit': false},
      'related': [
        {'id': 30, 'title': '相关的一篇', 'slug': 'related', 'summary': '', 'author': {}, 'replyCount': 1, 'likeCount': 0, 'viewCount': 2},
      ],
    };

    final detail = TopicDetail.fromJson(json);

    expect(detail.topic.id, 31);
    expect(detail.topic.isFeatured, isTrue);
    expect(detail.topic.category?.name, '文档');
    expect(detail.topic.tags.single.slug, 'indie-dev');
    expect(detail.topic.contentHtml, '<p>正文</p>');
    // 列表不返回 contentHtml，详情才有；feed 里的对象应保持空串
    expect(detail.related.single.contentHtml, '');

    expect(detail.posts.single.id, 19);
    expect(detail.posts.single.liked, isTrue);
    expect(detail.posts.single.author.displayName, 'Bob');

    expect(detail.interactions.liked, isFalse);
    expect(detail.interactions.bookmarked, isTrue);
    expect(detail.me.authenticated, isFalse);
    expect(detail.related.single.title, '相关的一篇');
  });

  test('缺字段时不抛异常，给安全默认值', () {
    final detail = TopicDetail.fromJson(<String, dynamic>{});

    expect(detail.topic.id, 0);
    expect(detail.topic.title, '(无标题)');
    expect(detail.posts, isEmpty);
    expect(detail.interactions.likeCount, 0);
    expect(detail.me.authenticated, isFalse);
  });

  test('匿名作者回退显示名', () {
    final author = Author.fromJson({'id': 3, 'username': 'ghost', 'displayName': '  '});
    expect(author.displayName, 'ghost');
    expect(author.initial, 'G');
  });

  test('feed 分页元信息解析', () {
    final page = FeedPageResult.fromJson(
      {
        'items': [
          {
            'id': 5,
            'title': '标题',
            'slug': 's',
            'summary': '摘要',
            'type': 'article',
            'author': {'id': 1, 'username': 'a', 'displayName': 'A'},
            'replyCount': 2,
            'likeCount': 3,
            'viewCount': 4,
          },
        ],
      },
      {'hasMore': true, 'nextCursor': 'eyJ2IjoxLCJvIjoxfQ'},
    );

    expect(page.items.single.id, 5);
    expect(page.hasMore, isTrue);
    expect(page.nextCursor, isNotNull);
  });
}
