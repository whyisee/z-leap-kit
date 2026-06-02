import { getDb } from "@server/db/client";
import { categoryTranslations, defaultLang, tagTranslations, topicTranslations, type Lang } from "@lib/i18n";
import { renderMarkdown } from "@lib/markdown";
import type { Category, Tag, Topic, TopicListOptions, TopicStatus, TopicType } from "@lib/types";

interface TopicRow {
  id: number;
  title: string;
  slug: string;
  summary: string;
  content_markdown: string;
  content_html: string;
  type: TopicType;
  status: TopicStatus;
  is_pinned: number;
  is_featured: number;
  view_count: number;
  reply_count: number;
  published_at: string;
  created_at: string;
  updated_at: string;
  category_id: number;
  category_name: string;
  category_slug: string;
  category_description: string;
  category_color: string;
  category_sort_order: number;
}

interface TagRow {
  id: number;
  name: string;
  slug: string;
  description: string;
}

export function listTopics(options: TopicListOptions = {}): Topic[] {
  const params: Record<string, string | number> = {
    limit: options.limit ?? 20,
    offset: options.offset ?? 0,
  };
  const where: string[] = [];
  const joins: string[] = [];

  if (!options.includeDrafts) {
    where.push("topics.status = 'published'");
  }

  if (options.categorySlug) {
    where.push("categories.slug = @categorySlug");
    params.categorySlug = options.categorySlug;
  }

  if (options.type) {
    where.push("topics.type = @type");
    params.type = options.type;
  }

  if (options.tagSlug) {
    joins.push("INNER JOIN topic_tags filter_topic_tags ON filter_topic_tags.topic_id = topics.id");
    joins.push("INNER JOIN tags filter_tags ON filter_tags.id = filter_topic_tags.tag_id");
    where.push("filter_tags.slug = @tagSlug");
    params.tagSlug = options.tagSlug;
  }

  const rows = getDb()
    .prepare(
      `
      ${topicSelectSql}
      ${joins.join("\n")}
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY topics.is_pinned DESC, topics.published_at DESC, topics.id DESC
      LIMIT @limit OFFSET @offset
      `,
    )
    .all(params) as TopicRow[];

  return rows.map((row) => mapTopicRow(row, options.lang || defaultLang));
}

export function getTopicById(id: number, lang: Lang = defaultLang): Topic | undefined {
  const row = getDb()
    .prepare(
      `
      ${topicSelectSql}
      WHERE topics.id = ? AND topics.status = 'published'
      LIMIT 1
      `,
    )
    .get(id) as TopicRow | undefined;

  return row ? mapTopicRow(row, lang) : undefined;
}

export function listFeaturedTopics(limit = 5, lang: Lang = defaultLang): Topic[] {
  return listTopics({ limit, includeDrafts: false, lang }).filter((topic) => topic.isFeatured || topic.isPinned);
}

export function listRelatedTopics(topic: Topic, limit = 4, lang: Lang = defaultLang): Topic[] {
  return listTopics({
    limit: limit + 1,
    categorySlug: topic.category.slug,
    lang,
  }).filter((item) => item.id !== topic.id).slice(0, limit);
}

const topicSelectSql = `
SELECT
  topics.id,
  topics.title,
  topics.slug,
  topics.summary,
  topics.content_markdown,
  topics.content_html,
  topics.type,
  topics.status,
  topics.is_pinned,
  topics.is_featured,
  topics.view_count,
  topics.reply_count,
  COALESCE(topics.published_at, topics.created_at) AS published_at,
  topics.created_at,
  topics.updated_at,
  categories.id AS category_id,
  categories.name AS category_name,
  categories.slug AS category_slug,
  categories.description AS category_description,
  categories.color AS category_color,
  categories.sort_order AS category_sort_order
FROM topics
INNER JOIN categories ON categories.id = topics.category_id
`;

function mapTopicRow(row: TopicRow, lang: Lang): Topic {
  const translated = topicTranslations[row.slug]?.[lang];
  const translatedCategory = categoryTranslations[row.category_slug]?.[lang];
  const contentMarkdown = translated?.contentMarkdown || row.content_markdown;

  return {
    id: row.id,
    title: translated?.title || row.title,
    slug: row.slug,
    summary: translated?.summary || row.summary,
    contentMarkdown,
    contentHtml: translated ? renderMarkdown(contentMarkdown) : row.content_html,
    type: row.type,
    status: row.status,
    isPinned: Boolean(row.is_pinned),
    isFeatured: Boolean(row.is_featured),
    viewCount: row.view_count,
    replyCount: row.reply_count,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    category: {
      id: row.category_id,
      name: translatedCategory?.name || row.category_name,
      slug: row.category_slug,
      description: translatedCategory?.description || row.category_description,
      color: row.category_color,
      sortOrder: row.category_sort_order,
    } satisfies Category,
    tags: listTagsForTopic(row.id, lang),
  };
}

function listTagsForTopic(topicId: number, lang: Lang): Tag[] {
  const rows = getDb()
    .prepare(
      `
      SELECT tags.id, tags.name, tags.slug, tags.description
      FROM tags
      INNER JOIN topic_tags ON topic_tags.tag_id = tags.id
      WHERE topic_tags.topic_id = ?
      ORDER BY tags.name ASC
      `,
    )
    .all(topicId) as TagRow[];

  return rows.map((row) => {
    const translated = tagTranslations[row.slug]?.[lang];

    return {
      id: row.id,
      name: translated?.name || row.name,
      slug: row.slug,
      description: translated?.description || row.description,
    };
  });
}
