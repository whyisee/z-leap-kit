import { createNotification } from "./notifications";
import { execute, query, queryOne, withTransaction } from "@server/db/client";

type TargetType = "topic" | "post" | "category" | "tag" | "user";

export interface TopicInteractionState {
  likeCount: number;
  liked: boolean;
  bookmarked: boolean;
  followed: boolean;
}

export async function getTopicInteractionState(topicId: number, userId?: number): Promise<TopicInteractionState> {
  const counts = await queryOne<{ like_count: string }>(
    `
    SELECT COUNT(*)::text AS like_count
    FROM reactions
    WHERE target_type = 'topic' AND target_id = $1 AND reaction_type = 'like'
    `,
    [topicId],
  );

  if (!userId) {
    return {
      likeCount: Number(counts?.like_count || 0),
      liked: false,
      bookmarked: false,
      followed: false,
    };
  }

  const state = await queryOne<{
    liked: boolean;
    bookmarked: boolean;
    followed: boolean;
  }>(
    `
    SELECT
      EXISTS(SELECT 1 FROM reactions WHERE target_type = 'topic' AND target_id = $1 AND reaction_type = 'like' AND user_id = $2) AS liked,
      EXISTS(SELECT 1 FROM bookmarks WHERE topic_id = $1 AND user_id = $2) AS bookmarked,
      EXISTS(SELECT 1 FROM follows WHERE target_type = 'topic' AND target_id = $1 AND user_id = $2) AS followed
    `,
    [topicId, userId],
  );

  return {
    likeCount: Number(counts?.like_count || 0),
    liked: Boolean(state?.liked),
    bookmarked: Boolean(state?.bookmarked),
    followed: Boolean(state?.followed),
  };
}

export async function countTargetLikes(targetType: "topic" | "post", targetId: number) {
  const row = await queryOne<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM reactions WHERE target_type = $1 AND target_id = $2 AND reaction_type = 'like'",
    [targetType, targetId],
  );

  return Number(row?.count || 0);
}

export async function userLikedTarget(targetType: "topic" | "post", targetId: number, userId?: number) {
  if (!userId) {
    return false;
  }

  const row = await queryOne<{ liked: boolean }>(
    "SELECT EXISTS(SELECT 1 FROM reactions WHERE target_type = $1 AND target_id = $2 AND user_id = $3 AND reaction_type = 'like') AS liked",
    [targetType, targetId, userId],
  );

  return Boolean(row?.liked);
}

export async function toggleReaction(input: {
  userId: number;
  targetType: "topic" | "post";
  targetId: number;
  reactionType?: string;
}) {
  const reactionType = input.reactionType || "like";
  let enabled = false;

  await withTransaction(async (client) => {
    const existing = await client.query<{ id: number }>(
      "SELECT id FROM reactions WHERE target_type = $1 AND target_id = $2 AND user_id = $3 AND reaction_type = $4 LIMIT 1",
      [input.targetType, input.targetId, input.userId, reactionType],
    );

    if (existing.rows[0]) {
      await client.query("DELETE FROM reactions WHERE id = $1", [existing.rows[0].id]);
      enabled = false;
      return;
    }

    await client.query(
      `
      INSERT INTO reactions (target_type, target_id, user_id, reaction_type, created_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT DO NOTHING
      `,
      [input.targetType, input.targetId, input.userId, reactionType, new Date().toISOString()],
    );
    enabled = true;
  });

  if (enabled) {
    await notifyTargetOwner(input.targetType, input.targetId, input.userId, "like");
  }

  return enabled;
}

export async function toggleBookmark(userId: number, topicId: number) {
  const existing = await queryOne<{ id: number }>("SELECT id FROM bookmarks WHERE user_id = $1 AND topic_id = $2 LIMIT 1", [
    userId,
    topicId,
  ]);

  if (existing) {
    await execute("DELETE FROM bookmarks WHERE id = $1", [existing.id]);
    return false;
  }

  await execute(
    `
    INSERT INTO bookmarks (user_id, topic_id, created_at)
    VALUES ($1, $2, $3)
    ON CONFLICT DO NOTHING
    `,
    [userId, topicId, new Date().toISOString()],
  );
  return true;
}

export async function toggleFollow(userId: number, targetType: TargetType, targetId: number) {
  const existing = await queryOne<{ id: number }>(
    "SELECT id FROM follows WHERE user_id = $1 AND target_type = $2 AND target_id = $3 LIMIT 1",
    [userId, targetType, targetId],
  );

  if (existing) {
    await execute("DELETE FROM follows WHERE id = $1", [existing.id]);
    return false;
  }

  await execute(
    `
    INSERT INTO follows (user_id, target_type, target_id, created_at)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT DO NOTHING
    `,
    [userId, targetType, targetId, new Date().toISOString()],
  );
  return true;
}

export async function notifyTopicFollowers(topicId: number, actorId: number, title: string, body: string, href: string) {
  const followers = await query<{ user_id: number }>(
    "SELECT user_id FROM follows WHERE target_type = 'topic' AND target_id = $1 AND user_id <> $2",
    [topicId, actorId],
  );

  for (const follower of followers) {
    await createNotification({
      userId: follower.user_id,
      actorId,
      type: "topic_followed_activity",
      targetType: "topic",
      targetId: topicId,
      title,
      body,
      href,
    });
  }
}

async function notifyTargetOwner(targetType: "topic" | "post", targetId: number, actorId: number, type: string) {
  const row = await queryOne<{ owner_id: number; href: string; title: string }>(
    targetType === "topic"
      ? "SELECT author_id AS owner_id, '/t/' || id || '/' || slug AS href, title FROM topics WHERE id = $1 LIMIT 1"
      : "SELECT posts.author_id AS owner_id, '/t/' || topics.id || '/' || topics.slug || '#post-' || posts.id AS href, topics.title FROM posts INNER JOIN topics ON topics.id = posts.topic_id WHERE posts.id = $1 LIMIT 1",
    [targetId],
  );

  if (!row || row.owner_id === actorId) {
    return;
  }

  await createNotification({
    userId: row.owner_id,
    actorId,
    type,
    targetType,
    targetId,
    title: "有人点赞了你的内容",
    body: row.title,
    href: row.href,
  });
}
