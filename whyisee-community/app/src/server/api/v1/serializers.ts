import type { Category, Post, Tag, Topic, TopicAuthor, TopicType } from "@lib/types";

export interface FeedItemDto {
  id: number;
  title: string;
  slug: string;
  summary: string;
  type: TopicType;
  coverImage: string | null;
  author: AuthorDto;
  category: CategoryDto;
  tags: TagDto[];
  replyCount: number;
  likeCount: number;
  viewCount: number;
  isPinned: boolean;
  isFeatured: boolean;
  publishedAt: string | null;
  lastActivityAt: string | null;
}

export interface AuthorDto {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: TopicAuthor["role"];
  isAnonymous: boolean;
}

export interface CategoryDto {
  id: number;
  name: string;
  slug: string;
  color: string;
}

export interface TagDto {
  id: number;
  name: string;
  slug: string;
}

export interface PostDto {
  id: number;
  parentPostId: number | null;
  contentHtml: string;
  author: AuthorDto;
  likeCount: number;
  liked: boolean;
  createdAt: string;
}

export function toAuthor(author: TopicAuthor | undefined): AuthorDto {
  return {
    id: author?.id ?? 0,
    username: author?.username ?? "unknown",
    displayName: author?.displayName ?? "",
    avatarUrl: author?.avatarUrl ?? null,
    role: author?.role ?? "member",
    isAnonymous: Boolean(author?.isAnonymous),
  };
}

export function toCategory(category: Category | undefined): CategoryDto {
  return {
    id: category?.id ?? 0,
    name: category?.name ?? "",
    slug: category?.slug ?? "",
    color: category?.color ?? "",
  };
}

export function toTag(tag: Tag): TagDto {
  return { id: tag.id, name: tag.name, slug: tag.slug };
}

export function toFeedItem(topic: Topic): FeedItemDto {
  return {
    id: topic.id,
    title: topic.title,
    slug: topic.slug,
    summary: topic.summary,
    type: topic.type,
    coverImage: extractCoverImage(topic),
    author: toAuthor(topic.author),
    category: toCategory(topic.category),
    tags: (topic.tags || []).map(toTag),
    replyCount: topic.replyCount,
    likeCount: topic.likeCount,
    viewCount: topic.viewCount,
    isPinned: topic.isPinned,
    isFeatured: topic.isFeatured,
    publishedAt: topic.publishedAt || null,
    lastActivityAt: topic.lastActivityAt || null,
  };
}

export function toPostDto(post: Post, stats?: { likeCount: number; liked: boolean }): PostDto {
  return {
    id: post.id,
    parentPostId: post.parentPostId ?? null,
    contentHtml: post.contentHtml,
    author: toAuthor(post.author),
    likeCount: stats?.likeCount ?? 0,
    liked: stats?.liked ?? false,
    createdAt: post.createdAt,
  };
}

/** 服务端抽封面：列表页只给一张图，客户端不必解析正文 */
function extractCoverImage(topic: Topic): string | null {
  const markdownMatch = topic.contentMarkdown?.match(/!\[[^\]]*]\(\s*([^)\s]+)/);
  if (markdownMatch?.[1]) return markdownMatch[1];

  const htmlMatch = topic.contentHtml?.match(/<img[^>]+src="([^"]+)"/i);
  if (htmlMatch?.[1]) return htmlMatch[1];

  return null;
}
