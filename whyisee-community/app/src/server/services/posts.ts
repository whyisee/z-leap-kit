import { getAnonymousAuthor, isTreeHoleCategorySlug } from "@lib/anonymous";
import { renderMarkdown } from "@lib/markdown";
import { defaultLang, type Lang } from "@lib/i18n";
import type { Post, PostStatus, TopicAuthor } from "@lib/types";
import { query, withTransaction } from "@server/db/client";
import { createNotification } from "./notifications";
import { notifyTopicFollowers } from "./interactions";
import { syncMentions } from "./mentions";
import { refreshUserReputation } from "./reputation";

interface PostRow {
  id: number;
  topic_id: number;
  parent_post_id: number | null;
  content_markdown: string;
  content_html: string;
  status: PostStatus;
  created_at: string;
  updated_at: string;
  author_id: number;
  username: string;
  display_name: string;
  role: TopicAuthor["role"];
  category_slug?: string;
}

interface CreatedPostResult {
  postId: number;
  topicId: number;
  topicSlug: string;
  topicTitle: string;
  topicAuthorId: number;
  parentAuthorId: number | null;
  isAnonymousTopic: boolean;
}

export interface EditablePost extends Post {
  topicSlug: string;
  categorySlug?: string;
}

export async function listPostsForTopic(topicId: number, viewerUserId?: number, lang: Lang = defaultLang): Promise<Post[]> {
  const rows = await query<PostRow>(
    `
    SELECT
      posts.id,
      posts.topic_id,
      posts.parent_post_id,
      posts.content_markdown,
      posts.content_html,
      posts.status,
      posts.created_at,
      posts.updated_at,
      users.id AS author_id,
      users.username,
      users.display_name,
      users.role,
      categories.slug AS category_slug
    FROM posts
    INNER JOIN topics ON topics.id = posts.topic_id
    INNER JOIN categories ON categories.id = topics.category_id
    INNER JOIN users ON users.id = posts.author_id
    WHERE posts.topic_id = $1 AND posts.status = 'published'
      AND (
        $2::int IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM user_blocks
          WHERE user_blocks.blocker_id = $2
            AND user_blocks.blocked_user_id = posts.author_id
        )
      )
    ORDER BY posts.created_at ASC, posts.id ASC
    `,
    [topicId, viewerUserId || null],
  );

  return rows.map((row) => mapPostRow(row, {
    anonymize: isTreeHoleCategorySlug(row.category_slug),
    lang,
  }));
}

export async function getPostForEdit(postId: number): Promise<EditablePost | undefined> {
  const rows = await query<PostRow & { topic_slug: string }>(
    `
    SELECT
      posts.id,
      posts.topic_id,
      posts.parent_post_id,
      posts.content_markdown,
      posts.content_html,
      posts.status,
      posts.created_at,
      posts.updated_at,
      topics.slug AS topic_slug,
      categories.slug AS category_slug,
      users.id AS author_id,
      users.username,
      users.display_name,
      users.role
    FROM posts
    INNER JOIN topics ON topics.id = posts.topic_id
    INNER JOIN categories ON categories.id = topics.category_id
    INNER JOIN users ON users.id = posts.author_id
    WHERE posts.id = $1
    LIMIT 1
    `,
    [postId],
  );
  const row = rows[0];

  if (!row) {
    return undefined;
  }

  return {
    ...mapPostRow(row),
    topicSlug: row.topic_slug,
    categorySlug: row.category_slug,
  };
}

export async function createPost(input: {
  topicId: number;
  parentPostId?: number;
  authorId: number;
  contentMarkdown: string;
}): Promise<CreatedPostResult> {
  const contentMarkdown = input.contentMarkdown.trim();

  if (contentMarkdown.length < 2) {
    throw new Error("Reply body is required.");
  }

  const now = new Date().toISOString();

  const result = await withTransaction(async (client) => {
    const topicResult = await client.query<{
      id: number;
      slug: string;
      status: string;
      title: string;
      author_id: number;
      category_slug: string;
    }>(
      `
      SELECT topics.id, topics.slug, topics.title, topics.author_id, topics.status, categories.slug AS category_slug
      FROM topics
      INNER JOIN categories ON categories.id = topics.category_id
      WHERE topics.id = $1
      LIMIT 1
      `,
      [input.topicId],
    );
    const topic = topicResult.rows[0];

    if (!topic || topic.status !== "published") {
      throw new Error("Topic is not available for replies.");
    }

    let parentPostId: number | null = null;
    let parentAuthorId: number | null = null;

    if (input.parentPostId) {
      const parentResult = await client.query<{ id: number; topic_id: number; parent_post_id: number | null; author_id: number }>(
        `
        SELECT id, topic_id, parent_post_id, author_id
        FROM posts
        WHERE id = $1 AND status = 'published'
        LIMIT 1
        `,
        [input.parentPostId],
      );
      const parent = parentResult.rows[0];

      if (!parent || parent.topic_id !== topic.id) {
        throw new Error("Parent reply is not available.");
      }

      parentPostId = parent.parent_post_id || parent.id;
      parentAuthorId = parent.author_id;
    }

    const postResult = await client.query<{ id: number }>(
      `
      INSERT INTO posts (topic_id, parent_post_id, author_id, content_markdown, content_html, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'published', $6, $6)
      RETURNING id
      `,
      [topic.id, parentPostId, input.authorId, contentMarkdown, renderMarkdown(contentMarkdown), now],
    );
    const postId = postResult.rows[0]?.id;

    if (!postId) {
      throw new Error("Failed to create reply.");
    }

    await client.query(
      `
      UPDATE topics
      SET reply_count = reply_count + 1,
          last_activity_at = $1,
          updated_at = $1
      WHERE id = $2
      `,
      [now, topic.id],
    );

    return {
      postId,
      topicId: topic.id,
      topicSlug: topic.slug,
      topicTitle: topic.title,
      topicAuthorId: topic.author_id,
      parentAuthorId,
      isAnonymousTopic: isTreeHoleCategorySlug(topic.category_slug),
    };
  });

  const notificationActorId = result.isAnonymousTopic ? null : input.authorId;
  const notifications: Promise<unknown>[] = [
    createNotification({
      userId: result.topicAuthorId,
      actorId: notificationActorId,
      type: "topic_reply",
      targetType: "post",
      targetId: result.postId,
      title: "你的话题有新回复",
      body: result.topicTitle,
      href: topicHref(result.topicId, result.topicSlug, `post-${result.postId}`),
      email: true,
    }),
    notifyTopicFollowers(
      result.topicId,
      input.authorId,
      "关注的话题有新回复",
      result.topicTitle,
      topicHref(result.topicId, result.topicSlug, `post-${result.postId}`),
      { anonymousActor: result.isAnonymousTopic },
    ),
    syncMentions({
      sourceType: "post",
      sourceId: result.postId,
      actorId: input.authorId,
      markdown: contentMarkdown,
      title: "有人在回复中提到了你",
      body: result.topicTitle,
      href: topicHref(result.topicId, result.topicSlug, `post-${result.postId}`),
      skipUserIds: [result.topicAuthorId],
      anonymousActor: result.isAnonymousTopic,
    }),
  ];

  if (result.parentAuthorId) {
    notifications.push(
      createNotification({
        userId: result.parentAuthorId,
        actorId: notificationActorId,
        type: "post_reply",
        targetType: "post",
        targetId: result.postId,
        title: "你的评论有新回复",
        body: result.topicTitle,
        href: topicHref(result.topicId, result.topicSlug, `post-${result.postId}`),
        email: true,
      }),
    );
  }

  await Promise.all(notifications);
  await refreshUserReputation(input.authorId);

  return result;
}

export async function updatePost(input: {
  postId: number;
  actorId: number;
  isAdmin: boolean;
  contentMarkdown: string;
}): Promise<EditablePost> {
  const existing = await getPostForEdit(input.postId);

  if (!existing || (!input.isAdmin && existing.author.id !== input.actorId)) {
    throw new Error("Post not found or not editable.");
  }

  if (existing.status !== "published") {
    throw new Error("Only published replies can be edited.");
  }

  const contentMarkdown = input.contentMarkdown.trim();

  if (contentMarkdown.length < 2) {
    throw new Error("Reply body is required.");
  }

  await query(
    `
    UPDATE posts
    SET content_markdown = $1,
        content_html = $2,
        updated_at = $3
    WHERE id = $4
    `,
    [contentMarkdown, renderMarkdown(contentMarkdown), new Date().toISOString(), input.postId],
  );

  const updated = await getPostForEdit(input.postId);

  if (!updated) {
    throw new Error("Failed to load updated reply.");
  }

  await syncMentions({
    sourceType: "post",
    sourceId: updated.id,
    actorId: input.actorId,
    markdown: contentMarkdown,
    title: "有人在回复中提到了你",
    body: updated.contentMarkdown.slice(0, 120),
    href: topicHref(updated.topicId, updated.topicSlug, `post-${updated.id}`),
    anonymousActor: isTreeHoleCategorySlug(updated.categorySlug),
  });

  return updated;
}

export async function softDeletePost(input: {
  postId: number;
  actorId: number;
  isAdmin: boolean;
}): Promise<EditablePost> {
  const existing = await getPostForEdit(input.postId);

  if (!existing || (!input.isAdmin && existing.author.id !== input.actorId)) {
    throw new Error("Post not found or not deletable.");
  }

  if (existing.status === "deleted") {
    return existing;
  }

  const now = new Date().toISOString();

  await withTransaction(async (client) => {
    await client.query("UPDATE posts SET status = 'deleted', updated_at = $1 WHERE id = $2", [now, input.postId]);

    if (existing.status === "published") {
      await client.query("UPDATE topics SET reply_count = GREATEST(reply_count - 1, 0), updated_at = $1 WHERE id = $2", [
        now,
        existing.topicId,
      ]);
    }
  });

  return {
    ...existing,
    status: "deleted",
    updatedAt: now,
  };
}

function mapPostRow(row: PostRow, options: { anonymize?: boolean; lang?: Lang } = {}): Post {
  const author = options.anonymize
    ? getAnonymousAuthor(options.lang || defaultLang)
    : {
        id: row.author_id,
        username: row.username,
        displayName: row.display_name,
        role: row.role,
      };

  return {
    id: row.id,
    topicId: row.topic_id,
    parentPostId: row.parent_post_id,
    contentMarkdown: row.content_markdown,
    contentHtml: row.content_html,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author,
  };
}

export function topicHref(topicId: number, _topicSlug: string, hash?: string) {
  return `/t/${topicId}${hash ? `#${encodeURIComponent(hash)}` : ""}`;
}
