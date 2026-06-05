import { query, queryOne, withTransaction } from "@server/db/client";
import { categoryTranslations, defaultLang, tagTranslations, topicTranslations, type Lang } from "@lib/i18n";
import { renderMarkdown } from "@lib/markdown";
import { slugify } from "@lib/slug";
import type { Category, Tag, Topic, TopicListOptions, TopicStatus, TopicType } from "@lib/types";
import { syncMentions } from "./mentions";

interface TopicRow {
  id: number;
  title: string;
  slug: string;
  summary: string;
  content_markdown: string;
  content_html: string;
  author_id: number;
  author_username: string;
  author_display_name: string;
  author_role: "admin" | "moderator" | "member" | "new_user";
  author_avatar_url: string | null;
  author_bio: string;
  author_created_at: string;
  type: TopicType;
  status: TopicStatus;
  is_pinned: boolean;
  is_featured: boolean;
  view_count: number;
  reply_count: number;
  published_at: string;
  last_activity_at: string;
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

interface TransactionClient {
  query<T = unknown>(sql: string, values?: unknown[]): Promise<{ rows: T[] }>;
}

export interface TopicWriteInput {
  title: string;
  slug?: string;
  summary: string;
  contentMarkdown: string;
  authorId: number;
  categoryId: number;
  type: TopicType;
  status: TopicStatus;
  isPinned: boolean;
  isFeatured: boolean;
  tags: string[];
}

export async function listTopics(options: TopicListOptions = {}): Promise<Topic[]> {
  const params: Array<string | number> = [];
  const where: string[] = [];
  const joins: string[] = [];

  if (!options.includeDrafts) {
    where.push("topics.status = 'published'");
  }

  if (options.categorySlug) {
    where.push(`categories.slug = ${addParam(params, options.categorySlug)}`);
  }

  if (options.type) {
    where.push(`topics.type = ${addParam(params, options.type)}`);
  }

  if (options.authorId) {
    where.push(`topics.author_id = ${addParam(params, options.authorId)}`);
  }

  if (options.tagSlug) {
    joins.push("INNER JOIN topic_tags filter_topic_tags ON filter_topic_tags.topic_id = topics.id");
    joins.push("INNER JOIN tags filter_tags ON filter_tags.id = filter_topic_tags.tag_id");
    where.push(`filter_tags.slug = ${addParam(params, options.tagSlug)}`);
  }

  const search = options.search?.trim();

  if (search) {
    const searchParam = addParam(params, `%${search}%`);
    where.push(`(
      topics.title ILIKE ${searchParam}
      OR topics.slug ILIKE ${searchParam}
      OR topics.summary ILIKE ${searchParam}
      OR topics.content_markdown ILIKE ${searchParam}
    )`);
  }

  const limitParam = addParam(params, options.limit ?? 20);
  const offsetParam = addParam(params, options.offset ?? 0);
  const rows = await query<TopicRow>(
    `
      ${topicSelectSql}
      ${joins.join("\n")}
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY topics.is_pinned DESC, COALESCE(topics.last_activity_at, topics.published_at, topics.created_at) DESC, topics.id DESC
      LIMIT ${limitParam} OFFSET ${offsetParam}
      `,
    params,
  );

  return Promise.all(rows.map((row: TopicRow) => mapTopicRow(row, options.lang || defaultLang)));
}

export async function getTopicById(id: number, lang: Lang = defaultLang): Promise<Topic | undefined> {
  const row = await queryOne<TopicRow>(
    `
      ${topicSelectSql}
      WHERE topics.id = $1 AND topics.status = 'published'
      LIMIT 1
      `,
    [id],
  );

  return row ? mapTopicRow(row, lang) : undefined;
}

export async function getTopicByIdForAdmin(id: number, lang: Lang = defaultLang): Promise<Topic | undefined> {
  const row = await queryOne<TopicRow>(
    `
      ${topicSelectSql}
      WHERE topics.id = $1
      LIMIT 1
      `,
    [id],
  );

  return row ? mapTopicRow(row, lang) : undefined;
}

export async function listFeaturedTopics(limit = 5, lang: Lang = defaultLang): Promise<Topic[]> {
  const topics = await listTopics({ limit, includeDrafts: false, lang });
  return topics.filter((topic) => topic.isFeatured || topic.isPinned);
}

export async function listRelatedTopics(topic: Topic, limit = 4, lang: Lang = defaultLang): Promise<Topic[]> {
  const topics = await listTopics({
    limit: limit + 1,
    categorySlug: topic.category.slug,
    lang,
  });
  return topics.filter((item) => item.id !== topic.id).slice(0, limit);
}

export async function createTopic(input: TopicWriteInput): Promise<number> {
  const now = new Date().toISOString();
  const title = input.title.trim();
  const contentMarkdown = input.contentMarkdown.trim();

  if (!title) {
    throw new Error("Topic title is required.");
  }

  if (!contentMarkdown) {
    throw new Error("Topic body is required.");
  }

  const created = await withTransaction(async (client) => {
    const slug = await getUniqueTopicSlug(input.slug || title, undefined, client);
    const result = await client.query<{ id: number }>(
      `
      INSERT INTO topics (
        title, slug, summary, content_markdown, content_html, author_id, category_id,
        type, status, is_pinned, is_featured, last_activity_at, published_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
      RETURNING id
      `,
      [
        title,
        slug,
        input.summary.trim(),
        contentMarkdown,
        renderMarkdown(contentMarkdown),
        input.authorId,
        input.categoryId,
        input.type,
        input.status,
        input.isPinned,
        input.isFeatured,
        now,
        input.status === "published" ? now : null,
        now,
      ],
    );
    const topicId = result.rows[0]?.id;

    if (!topicId) {
      throw new Error("Failed to create topic.");
    }

    await syncTopicTags(client, topicId, input.tags, now);
    return { topicId, slug };
  });

  if (input.status === "published") {
    await syncMentions({
      sourceType: "topic",
      sourceId: created.topicId,
      actorId: input.authorId,
      markdown: contentMarkdown,
      title,
      body: title,
      href: topicHref(created.topicId, created.slug),
    });
  }

  return created.topicId;
}

export async function updateTopic(id: number, input: TopicWriteInput): Promise<void> {
  const now = new Date().toISOString();
  const title = input.title.trim();
  const contentMarkdown = input.contentMarkdown.trim();

  if (!title) {
    throw new Error("Topic title is required.");
  }

  if (!contentMarkdown) {
    throw new Error("Topic body is required.");
  }

  const updated = await withTransaction(async (client) => {
    const slug = await getUniqueTopicSlug(input.slug || title, id, client);

    await client.query(
      `
      UPDATE topics
      SET
        title = $1,
        slug = $2,
        summary = $3,
        content_markdown = $4,
        content_html = $5,
        category_id = $6,
        type = $7,
        status = $8,
        is_pinned = $9,
        is_featured = $10,
        updated_at = $11,
        last_activity_at = $11,
        published_at = CASE
          WHEN $8 = 'published' THEN COALESCE(published_at, $11)
          ELSE published_at
        END
      WHERE id = $12
      `,
      [
        title,
        slug,
        input.summary.trim(),
        contentMarkdown,
        renderMarkdown(contentMarkdown),
        input.categoryId,
        input.type,
        input.status,
        input.isPinned,
        input.isFeatured,
        now,
        id,
      ],
    );

    await syncTopicTags(client, id, input.tags, now);
    return { slug };
  });

  if (input.status === "published") {
    await syncMentions({
      sourceType: "topic",
      sourceId: id,
      actorId: input.authorId,
      markdown: contentMarkdown,
      title,
      body: title,
      href: topicHref(id, updated.slug),
    });
  }
}

export async function updateTopicAdminState(
  id: number,
  patch: Partial<Pick<TopicWriteInput, "status" | "isPinned" | "isFeatured">>,
): Promise<void> {
  const now = new Date().toISOString();
  const sets: string[] = ["updated_at = $1"];
  const values: unknown[] = [now];

  if (patch.status) {
    sets.push(`status = $${values.length + 1}`);
    values.push(patch.status);

    if (patch.status === "published") {
      sets.push(`published_at = COALESCE(published_at, $1)`);
    }
  }

  if (typeof patch.isPinned === "boolean") {
    sets.push(`is_pinned = $${values.length + 1}`);
    values.push(patch.isPinned);
  }

  if (typeof patch.isFeatured === "boolean") {
    sets.push(`is_featured = $${values.length + 1}`);
    values.push(patch.isFeatured);
  }

  values.push(id);

  await query(`UPDATE topics SET ${sets.join(", ")} WHERE id = $${values.length}`, values);

  if (patch.status === "published") {
    const topic = await queryOne<{
      id: number;
      slug: string;
      title: string;
      content_markdown: string;
      author_id: number;
    }>("SELECT id, slug, title, content_markdown, author_id FROM topics WHERE id = $1 LIMIT 1", [id]);

    if (topic) {
      await syncMentions({
        sourceType: "topic",
        sourceId: topic.id,
        actorId: topic.author_id,
        markdown: topic.content_markdown,
        title: topic.title,
        body: topic.title,
        href: topicHref(topic.id, topic.slug),
      });
    }
  }
}

const topicSelectSql = `
SELECT
  topics.id,
  topics.title,
  topics.slug,
  topics.summary,
  topics.content_markdown,
  topics.content_html,
  topics.author_id,
  users.username AS author_username,
  users.display_name AS author_display_name,
  users.role AS author_role,
  users.avatar_url AS author_avatar_url,
  users.bio AS author_bio,
  users.created_at AS author_created_at,
  topics.type,
  topics.status,
  topics.is_pinned,
  topics.is_featured,
  topics.view_count,
  topics.reply_count,
  COALESCE(topics.published_at, topics.created_at) AS published_at,
  COALESCE(topics.last_activity_at, topics.published_at, topics.created_at) AS last_activity_at,
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
INNER JOIN users ON users.id = topics.author_id
`;

async function mapTopicRow(row: TopicRow, lang: Lang): Promise<Topic> {
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
    authorId: row.author_id,
    author: {
      id: row.author_id,
      username: row.author_username,
      displayName: row.author_display_name,
      role: row.author_role,
      avatarUrl: row.author_avatar_url,
      bio: row.author_bio,
      createdAt: row.author_created_at,
    },
    type: row.type,
    status: row.status,
    isPinned: Boolean(row.is_pinned),
    isFeatured: Boolean(row.is_featured),
    viewCount: row.view_count,
    replyCount: row.reply_count,
    publishedAt: row.published_at,
    lastActivityAt: row.last_activity_at,
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
    tags: await listTagsForTopic(row.id, lang),
  };
}

async function listTagsForTopic(topicId: number, lang: Lang): Promise<Tag[]> {
  const rows = await query<TagRow>(
    `
      SELECT tags.id, tags.name, tags.slug, tags.description
      FROM tags
      INNER JOIN topic_tags ON topic_tags.tag_id = tags.id
      WHERE topic_tags.topic_id = $1
      ORDER BY tags.name ASC
      `,
    [topicId],
  );

  return rows.map((row: TagRow) => {
    const translated = tagTranslations[row.slug]?.[lang];

    return {
      id: row.id,
      name: translated?.name || row.name,
      slug: row.slug,
      description: translated?.description || row.description,
    };
  });
}

function addParam(params: Array<string | number>, value: string | number) {
  params.push(value);
  return `$${params.length}`;
}

async function getUniqueTopicSlug(value: string, topicId: number | undefined, client: TransactionClient) {
  const base = slugify(value);
  let candidate = base;
  let suffix = 2;

  while (true) {
    const existing = await client.query<{ id: number }>(
      "SELECT id FROM topics WHERE slug = $1 AND ($2::int IS NULL OR id <> $2) LIMIT 1",
      [candidate, topicId ?? null],
    );

    if (existing.rows.length === 0) {
      return candidate;
    }

    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

async function syncTopicTags(client: TransactionClient, topicId: number, values: string[], now: string) {
  const tags = normalizeTagNames(values);

  await client.query("DELETE FROM topic_tags WHERE topic_id = $1", [topicId]);

  for (const tagName of tags) {
    const tagSlug = slugify(tagName);
    const result = await client.query<{ id: number }>(
      `
      INSERT INTO tags (name, slug, description, created_at)
      VALUES ($1, $2, '', $3)
      ON CONFLICT(slug) DO UPDATE SET name = excluded.name
      RETURNING id
      `,
      [tagName, tagSlug, now],
    );
    const tagId = result.rows[0]?.id;

    if (tagId) {
      await client.query(
        `
        INSERT INTO topic_tags (topic_id, tag_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        `,
        [topicId, tagId],
      );
    }
  }
}

function normalizeTagNames(values: string[]) {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const value of values) {
    for (const item of value.split(/[,，\n]/)) {
      const tag = item.trim();

      if (!tag) {
        continue;
      }

      const key = tag.toLowerCase();

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      tags.push(tag);
    }
  }

  return tags.slice(0, 12);
}

function topicHref(topicId: number, _topicSlug: string) {
  return `/t/${topicId}`;
}
