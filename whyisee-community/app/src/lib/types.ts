export type TopicType = "discussion" | "article" | "project" | "resource" | "announcement";
export type TopicStatus = "draft" | "published" | "hidden" | "deleted";

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
  type: TopicType;
  status: TopicStatus;
  isPinned: boolean;
  isFeatured: boolean;
  viewCount: number;
  replyCount: number;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  category: Category;
  tags: Tag[];
}

export interface TopicListOptions {
  limit?: number;
  offset?: number;
  categorySlug?: string;
  tagSlug?: string;
  type?: TopicType;
  includeDrafts?: boolean;
  lang?: import("./i18n").Lang;
}
