export type TopicType = "discussion" | "question" | "article" | "project" | "resource" | "announcement";
export type TopicStatus = "draft" | "pending" | "published" | "hidden" | "deleted";
export type PostStatus = "published" | "hidden" | "deleted";

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  color: string;
  sortOrder: number;
  topicCount?: number;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
  description: string;
  topicCount?: number;
}

export interface Topic {
  id: number;
  title: string;
  slug: string;
  summary: string;
  contentMarkdown: string;
  contentHtml: string;
  authorId: number;
  type: TopicType;
  status: TopicStatus;
  isPinned: boolean;
  isFeatured: boolean;
  viewCount: number;
  replyCount: number;
  publishedAt: string;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
  category: Category;
  tags: Tag[];
}

export interface TopicAuthor {
  id: number;
  username: string;
  displayName: string;
  role: "admin" | "moderator" | "member" | "new_user";
}

export interface Post {
  id: number;
  topicId: number;
  parentPostId: number | null;
  contentMarkdown: string;
  contentHtml: string;
  status: PostStatus;
  createdAt: string;
  updatedAt: string;
  author: TopicAuthor;
}

export interface TopicListOptions {
  limit?: number;
  offset?: number;
  categorySlug?: string;
  tagSlug?: string;
  type?: TopicType;
  authorId?: number;
  search?: string;
  includeDrafts?: boolean;
  lang?: import("./i18n").Lang;
}
