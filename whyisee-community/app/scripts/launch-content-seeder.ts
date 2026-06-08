import type { PoolClient } from "pg";
import { renderMarkdown } from "../src/lib/markdown.ts";
import { launchTopics } from "./launch-content.ts";
import { launchReplyAuthorPool, launchTopicAuthorPools, launchUsers } from "./launch-users.ts";

export interface LaunchContentSeedResult {
  topics: number;
  replies: number;
  pinned: number;
  featured: number;
}

interface IdSlugRow {
  id: number;
  slug: string;
}

interface IdUsernameRow {
  id: number;
  username: string;
}

export async function seedLaunchContent(
  client: PoolClient,
  options: { authorUsername?: string; now?: string } = {},
): Promise<LaunchContentSeedResult> {
  const now = options.now || new Date().toISOString();
  const authorUsername = options.authorUsername || process.env.WHYISEE_ADMIN_USERNAME || "whyisee";
  const baseTime = Date.parse(now);
  const categorySlugs = unique(launchTopics.map((topic) => topic.category));
  const tagSlugs = unique(launchTopics.flatMap((topic) => topic.tags));
  const userNames = unique([authorUsername, ...launchUsers.map((user) => user.username), ...launchReplyAuthorPool]);

  validateLaunchContent();

  const categories = await client.query<IdSlugRow>("SELECT id, slug FROM categories WHERE slug = ANY($1)", [
    categorySlugs,
  ]);
  const tags = await client.query<IdSlugRow>("SELECT id, slug FROM tags WHERE slug = ANY($1)", [tagSlugs]);
  const users = await client.query<IdUsernameRow>("SELECT id, username FROM users WHERE username = ANY($1)", [userNames]);

  const categoryIdBySlug = new Map(categories.rows.map((row) => [row.slug, row.id]));
  const tagIdBySlug = new Map(tags.rows.map((row) => [row.slug, row.id]));
  const userIdByName = new Map(users.rows.map((row) => [row.username, row.id]));
  const authorId = userIdByName.get(authorUsername);

  if (!authorId) {
    throw new Error(`Missing launch content author "${authorUsername}". Run npm run seed first or set WHYISEE_ADMIN_USERNAME.`);
  }

  assertAllPresent("category", categorySlugs, categoryIdBySlug);
  assertAllPresent("tag", tagSlugs, tagIdBySlug);

  let replyCount = 0;

  for (const [index, topic] of launchTopics.entries()) {
    const categoryId = categoryIdBySlug.get(topic.category);

    if (!categoryId) {
      throw new Error(`Missing category "${topic.category}" for launch topic "${topic.slug}".`);
    }

    const topicAt = new Date(baseTime - (launchTopics.length - index) * 72 * 60 * 1000).toISOString();
    const contentMarkdown = topic.body.trim();
    const topicAuthorName = resolveTopicAuthor(topic.category, index, authorUsername);
    const topicAuthorId = userIdByName.get(topicAuthorName) || authorId;
    const topicResult = await client.query<{ id: number }>(
      `
      INSERT INTO topics (
        title, slug, summary, content_markdown, content_html, author_id, category_id, type,
        status, is_pinned, is_featured, view_count, reply_count, last_activity_at,
        published_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'published', $9, $10, 0, 0, $11, $11, $11, $11)
      ON CONFLICT(slug) DO UPDATE SET
        title = EXCLUDED.title,
        summary = EXCLUDED.summary,
        content_markdown = EXCLUDED.content_markdown,
        content_html = EXCLUDED.content_html,
        author_id = EXCLUDED.author_id,
        category_id = EXCLUDED.category_id,
        type = EXCLUDED.type,
        status = 'published',
        is_pinned = EXCLUDED.is_pinned,
        is_featured = EXCLUDED.is_featured,
        view_count = 0,
        reply_count = 0,
        last_activity_at = EXCLUDED.last_activity_at,
        published_at = EXCLUDED.published_at,
        updated_at = EXCLUDED.updated_at
      RETURNING id
      `,
      [
        topic.title,
        topic.slug,
        topic.summary,
        contentMarkdown,
        renderMarkdown(contentMarkdown),
        topicAuthorId,
        categoryId,
        topic.type,
        Boolean(topic.pinned),
        Boolean(topic.featured),
        topicAt,
      ],
    );
    const topicId = topicResult.rows[0]?.id;

    if (!topicId) {
      throw new Error(`Failed to seed launch topic "${topic.slug}".`);
    }

    await client.query("DELETE FROM topic_tags WHERE topic_id = $1", [topicId]);
    await client.query("DELETE FROM posts WHERE topic_id = $1", [topicId]);

    for (const tagSlug of topic.tags) {
      const tagId = tagIdBySlug.get(tagSlug);

      if (!tagId) {
        throw new Error(`Missing tag "${tagSlug}" for launch topic "${topic.slug}".`);
      }

      await client.query(
        `
        INSERT INTO topic_tags (topic_id, tag_id)
        VALUES ($1, $2)
        ON CONFLICT(topic_id, tag_id) DO NOTHING
        `,
        [topicId, tagId],
      );
    }

    const replies = topic.replies || [];
    let lastActivityAt = topicAt;

    for (const [replyIndex, reply] of replies.entries()) {
      const replyAt = new Date(Date.parse(topicAt) + (replyIndex + 1) * 13 * 60 * 1000).toISOString();
      const replyAuthorName = launchReplyAuthorPool[(index + replyIndex) % launchReplyAuthorPool.length] || authorUsername;
      const replyAuthorId = userIdByName.get(replyAuthorName) || authorId;
      const replyMarkdown = reply.trim();

      if (!replyMarkdown) {
        continue;
      }

      await client.query(
        `
        INSERT INTO posts (topic_id, parent_post_id, author_id, content_markdown, content_html, status, created_at, updated_at)
        VALUES ($1, NULL, $2, $3, $4, 'published', $5, $5)
        `,
        [topicId, replyAuthorId, replyMarkdown, renderMarkdown(replyMarkdown), replyAt],
      );
      replyCount += 1;
      lastActivityAt = replyAt;
    }

    await client.query(
      "UPDATE topics SET reply_count = $1, last_activity_at = $2, updated_at = $2 WHERE id = $3",
      [replies.length, lastActivityAt, topicId],
    );
  }

  return {
    topics: launchTopics.length,
    replies: replyCount,
    pinned: launchTopics.filter((topic) => topic.pinned).length,
    featured: launchTopics.filter((topic) => topic.featured).length,
  };
}

function validateLaunchContent() {
  const slugs = new Set<string>();

  for (const topic of launchTopics) {
    if (slugs.has(topic.slug)) {
      throw new Error(`Duplicate launch topic slug: ${topic.slug}`);
    }

    slugs.add(topic.slug);

    if (!topic.title.trim() || !topic.summary.trim() || !topic.body.trim()) {
      throw new Error(`Incomplete launch topic: ${topic.slug}`);
    }

    if (topic.tags.length === 0 || topic.tags.length > 4) {
      throw new Error(`Launch topic "${topic.slug}" must use 1 to 4 tags.`);
    }
  }
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function resolveTopicAuthor(categorySlug: string, index: number, fallback: string) {
  const pool = launchTopicAuthorPools[categorySlug];

  if (!pool?.length) {
    return fallback;
  }

  return pool[index % pool.length] || fallback;
}

function assertAllPresent(label: string, expected: string[], map: Map<string, number>) {
  const missing = expected.filter((item) => !map.has(item));

  if (missing.length > 0) {
    throw new Error(`Missing launch ${label}s: ${missing.join(", ")}`);
  }
}
