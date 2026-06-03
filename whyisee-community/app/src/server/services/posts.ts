import { renderMarkdown } from "@lib/markdown";
import type { Post, PostStatus, TopicAuthor } from "@lib/types";
import { query, withTransaction } from "@server/db/client";
import { createNotification } from "./notifications";
import { notifyTopicFollowers } from "./interactions";

interface PostRow {
  id: number;
  topic_id: number;
  content_markdown: string;
  content_html: string;
  status: PostStatus;
  created_at: string;
  updated_at: string;
  author_id: number;
  username: string;
  display_name: string;
  role: TopicAuthor["role"];
}

interface CreatedPostResult {
  postId: number;
  topicId: number;
  topicSlug: string;
  topicTitle: string;
  topicAuthorId: number;
}

export interface EditablePost extends Post {
  topicSlug: string;
}

export async function listPostsForTopic(topicId: number): Promise<Post[]> {
  const rows = await query<PostRow>(
    `
    SELECT
      posts.id,
      posts.topic_id,
      posts.content_markdown,
      posts.content_html,
      posts.status,
      posts.created_at,
      posts.updated_at,
      users.id AS author_id,
      users.username,
      users.display_name,
      users.role
    FROM posts
    INNER JOIN users ON users.id = posts.author_id
    WHERE posts.topic_id = $1 AND posts.status = 'published'
    ORDER BY posts.created_at ASC, posts.id ASC
    `,
    [topicId],
  );

  return rows.map(mapPostRow);
}

export async function getPostForEdit(postId: number): Promise<EditablePost | undefined> {
  const rows = await query<PostRow & { topic_slug: string }>(
    `
    SELECT
      posts.id,
      posts.topic_id,
      posts.content_markdown,
      posts.content_html,
      posts.status,
      posts.created_at,
      posts.updated_at,
      topics.slug AS topic_slug,
      users.id AS author_id,
      users.username,
      users.display_name,
      users.role
    FROM posts
    INNER JOIN topics ON topics.id = posts.topic_id
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
  };
}

export async function createPost(input: {
  topicId: number;
  authorId: number;
  contentMarkdown: string;
}): Promise<CreatedPostResult> {
  const contentMarkdown = input.contentMarkdown.trim();

  if (contentMarkdown.length < 2) {
    throw new Error("Reply body is required.");
  }

  const now = new Date().toISOString();

  const result = await withTransaction(async (client) => {
    const topicResult = await client.query<{ id: number; slug: string; status: string; title: string; author_id: number }>(
      "SELECT id, slug, title, author_id, status FROM topics WHERE id = $1 LIMIT 1",
      [input.topicId],
    );
    const topic = topicResult.rows[0];

    if (!topic || topic.status !== "published") {
      throw new Error("Topic is not available for replies.");
    }

    const postResult = await client.query<{ id: number }>(
      `
      INSERT INTO posts (topic_id, author_id, content_markdown, content_html, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'published', $5, $5)
      RETURNING id
      `,
      [topic.id, input.authorId, contentMarkdown, renderMarkdown(contentMarkdown), now],
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
    };
  });

  await Promise.all([
    createNotification({
      userId: result.topicAuthorId,
      actorId: input.authorId,
      type: "topic_reply",
      targetType: "post",
      targetId: result.postId,
      title: "你的话题有新回复",
      body: result.topicTitle,
      href: `/t/${result.topicId}/${result.topicSlug}#post-${result.postId}`,
      email: true,
    }),
    notifyTopicFollowers(
      result.topicId,
      input.authorId,
      "关注的话题有新回复",
      result.topicTitle,
      `/t/${result.topicId}/${result.topicSlug}#post-${result.postId}`,
    ),
  ]);

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

function mapPostRow(row: PostRow): Post {
  return {
    id: row.id,
    topicId: row.topic_id,
    contentMarkdown: row.content_markdown,
    contentHtml: row.content_html,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: {
      id: row.author_id,
      username: row.username,
      displayName: row.display_name,
      role: row.role,
    },
  };
}
