import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { launchTopics } from "./launch-content.ts";
import { launchUsers } from "./launch-users.ts";

export interface LaunchInteractionSeedResult {
  topicLikes: number;
  postLikes: number;
  bookmarks: number;
  follows: number;
  pageViews: number;
}

interface UserRow {
  id: number;
  username: string;
}

interface TopicRow {
  id: number;
  slug: string;
  category_slug: string;
  author_id: number;
  is_pinned: boolean;
  is_featured: boolean;
}

interface PostRow {
  id: number;
  topic_id: number;
  author_id: number;
}

interface IdSlugRow {
  id: number;
  slug: string;
}

const seedUserAgent = "whyisee-launch-seed";
const referrers = [
  "https://google.com/search?q=cursor+codex+workflow",
  "https://google.com/search?q=indie+dev+mvp",
  "https://www.bing.com/search?q=seo+content+site",
  "https://github.com/whyisee",
  "https://open-vsx.org/",
  "",
];

export async function seedLaunchInteractions(
  client: PoolClient,
  options: { now?: string } = {},
): Promise<LaunchInteractionSeedResult> {
  const now = options.now || new Date().toISOString();
  const topicSlugs = launchTopics.map((topic) => topic.slug);
  const userNames = launchUsers.map((user) => user.username);

  const [users, topics, posts, categories, tags] = await Promise.all([
    client.query<UserRow>("SELECT id, username FROM users WHERE username = ANY($1)", [userNames]),
    client.query<TopicRow>(
      `
      SELECT topics.id, topics.slug, topics.author_id, topics.is_pinned, topics.is_featured, categories.slug AS category_slug
      FROM topics
      INNER JOIN categories ON categories.id = topics.category_id
      WHERE topics.slug = ANY($1) AND topics.status = 'published'
      ORDER BY topics.published_at ASC, topics.id ASC
      `,
      [topicSlugs],
    ),
    client.query<PostRow>(
      `
      SELECT posts.id, posts.topic_id, posts.author_id
      FROM posts
      INNER JOIN topics ON topics.id = posts.topic_id
      WHERE topics.slug = ANY($1) AND posts.status = 'published'
      ORDER BY posts.created_at ASC, posts.id ASC
      `,
      [topicSlugs],
    ),
    client.query<IdSlugRow>("SELECT id, slug FROM categories ORDER BY sort_order ASC, id ASC"),
    client.query<IdSlugRow>("SELECT id, slug FROM tags ORDER BY slug ASC"),
  ]);

  if (users.rows.length < launchUsers.length) {
    throw new Error("Missing launch users. Run npm run launch:seed-users first.");
  }

  if (topics.rows.length < launchTopics.length) {
    throw new Error("Missing launch topics. Run npm run launch:seed-content first.");
  }

  await client.query("DELETE FROM page_views WHERE user_agent = $1", [seedUserAgent]);

  let topicLikes = 0;
  let postLikes = 0;
  let bookmarks = 0;
  let follows = 0;
  let pageViews = 0;
  const topicById = new Map(topics.rows.map((topic) => [topic.id, topic]));

  for (const [index, topic] of topics.rows.entries()) {
    const engagement = topicEngagement(index, topic);
    const likeUsers = pickUsers(users.rows, index, engagement.likes, topic.author_id);
    const bookmarkUsers = pickUsers(users.rows, index + 9, engagement.bookmarks, topic.author_id);
    const followUsers = pickUsers(users.rows, index + 17, engagement.follows, topic.author_id);

    for (const user of likeUsers) {
      topicLikes += await insertReaction(client, "topic", topic.id, user.id, createdAt(now, index, user.id));
    }

    for (const user of bookmarkUsers) {
      bookmarks += await insertBookmark(client, user.id, topic.id, createdAt(now, index + 2, user.id));
    }

    for (const user of followUsers) {
      follows += await insertFollow(client, user.id, "topic", topic.id, createdAt(now, index + 4, user.id));
    }

    const viewCount = engagement.views;
    await client.query("UPDATE topics SET view_count = GREATEST(view_count, $1) WHERE id = $2", [viewCount, topic.id]);
    pageViews += await seedTopicPageViews(client, topic.id, index, viewCount, users.rows, now);
  }

  for (const [index, post] of posts.rows.entries()) {
    const topic = topicById.get(post.topic_id);
    const count = Math.min(users.rows.length - 1, 1 + (index % 3) + (topic?.is_featured ? 1 : 0));
    const likeUsers = pickUsers(users.rows, index + 31, count, post.author_id);

    for (const user of likeUsers) {
      postLikes += await insertReaction(client, "post", post.id, user.id, createdAt(now, index + 7, user.id));
    }
  }

  for (const [index, user] of users.rows.entries()) {
    const categoryA = categories.rows[index % categories.rows.length];
    const categoryB = categories.rows[(index + 2) % categories.rows.length];
    const tagA = tags.rows[(index * 3) % tags.rows.length];
    const tagB = tags.rows[(index * 3 + 8) % tags.rows.length];
    const targetUserA = users.rows[(index + 3) % users.rows.length];
    const targetUserB = users.rows[(index + 7) % users.rows.length];

    for (const target of [categoryA, categoryB]) {
      if (target) {
        follows += await insertFollow(client, user.id, "category", target.id, createdAt(now, index, target.id));
      }
    }

    for (const target of [tagA, tagB]) {
      if (target) {
        follows += await insertFollow(client, user.id, "tag", target.id, createdAt(now, index + 1, target.id));
      }
    }

    for (const target of [targetUserA, targetUserB]) {
      if (target && target.id !== user.id) {
        follows += await insertFollow(client, user.id, "user", target.id, createdAt(now, index + 3, target.id));
      }
    }
  }

  pageViews += await seedIndexPageViews(client, users.rows, categories.rows, now);

  return { topicLikes, postLikes, bookmarks, follows, pageViews };
}

function topicEngagement(index: number, topic: TopicRow) {
  const base = 2 + (index % 5);
  const featuredBoost = topic.is_featured ? 3 : 0;
  const pinnedBoost = topic.is_pinned ? 4 : 0;
  const categoryBoost = topic.category_slug === "ai" || topic.category_slug === "projects" ? 1 : 0;
  const likes = Math.min(launchUsers.length - 1, base + featuredBoost + pinnedBoost + categoryBoost);
  const bookmarks = Math.min(launchUsers.length - 1, 1 + ((index + 2) % 4) + Math.floor(featuredBoost / 2));
  const follows = Math.min(launchUsers.length - 1, index % 3 === 0 ? 2 : index % 5 === 0 ? 1 : 0);
  const views = 42 + ((index * 19) % 92) + featuredBoost * 24 + pinnedBoost * 22 + categoryBoost * 8;

  return { likes, bookmarks, follows, views };
}

async function insertReaction(
  client: PoolClient,
  targetType: "topic" | "post",
  targetId: number,
  userId: number,
  createdAtValue: string,
) {
  const result = await client.query(
    `
    INSERT INTO reactions (target_type, target_id, user_id, reaction_type, created_at)
    VALUES ($1, $2, $3, 'like', $4)
    ON CONFLICT(target_type, target_id, user_id, reaction_type) DO NOTHING
    `,
    [targetType, targetId, userId, createdAtValue],
  );

  return result.rowCount ?? 0;
}

async function insertBookmark(client: PoolClient, userId: number, topicId: number, createdAtValue: string) {
  const result = await client.query(
    `
    INSERT INTO bookmarks (user_id, topic_id, created_at)
    VALUES ($1, $2, $3)
    ON CONFLICT(user_id, topic_id) DO NOTHING
    `,
    [userId, topicId, createdAtValue],
  );

  return result.rowCount ?? 0;
}

async function insertFollow(
  client: PoolClient,
  userId: number,
  targetType: "topic" | "category" | "tag" | "user",
  targetId: number,
  createdAtValue: string,
) {
  const result = await client.query(
    `
    INSERT INTO follows (user_id, target_type, target_id, created_at)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT(user_id, target_type, target_id) DO NOTHING
    `,
    [userId, targetType, targetId, createdAtValue],
  );

  return result.rowCount ?? 0;
}

async function seedTopicPageViews(
  client: PoolClient,
  topicId: number,
  topicIndex: number,
  viewCount: number,
  users: UserRow[],
  now: string,
) {
  const rows = Math.max(8, Math.min(26, Math.round(viewCount / 7)));

  for (let index = 0; index < rows; index += 1) {
    const user = index % 3 === 0 ? users[(topicIndex + index) % users.length] : undefined;
    await insertPageView(client, {
      path: `/t/${topicId}`,
      userId: user?.id,
      ipSeed: `topic:${topicId}:${index}`,
      referrer: referrers[(topicIndex + index) % referrers.length],
      createdAtValue: createdAt(now, topicIndex + index, topicId),
    });
  }

  return rows;
}

async function seedIndexPageViews(client: PoolClient, users: UserRow[], categories: IdSlugRow[], now: string) {
  let count = 0;
  const paths = [
    "/",
    "/categories",
    "/guidelines",
    ...categories.map((category) => `/c/${category.slug}`),
  ];

  for (const [pathIndex, path] of paths.entries()) {
    const rows = path === "/" ? 42 : path === "/categories" ? 24 : 10 + (pathIndex % 9);

    for (let index = 0; index < rows; index += 1) {
      const user = index % 4 === 0 ? users[(pathIndex + index) % users.length] : undefined;
      await insertPageView(client, {
        path,
        userId: user?.id,
        ipSeed: `page:${path}:${index}`,
        referrer: referrers[(pathIndex + index) % referrers.length],
        createdAtValue: createdAt(now, pathIndex + index, index),
      });
      count += 1;
    }
  }

  return count;
}

async function insertPageView(
  client: PoolClient,
  input: { path: string; userId?: number; ipSeed: string; referrer?: string; createdAtValue: string },
) {
  await client.query(
    `
    INSERT INTO page_views (path, method, user_id, ip_hash, user_agent, referrer, created_at)
    VALUES ($1, 'GET', $2, $3, $4, $5, $6)
    `,
    [
      input.path,
      input.userId || null,
      hashSeed(input.ipSeed),
      seedUserAgent,
      input.referrer || null,
      input.createdAtValue,
    ],
  );
}

function pickUsers(users: UserRow[], seed: number, count: number, excludeUserId?: number) {
  const selected: UserRow[] = [];

  for (let offset = 0; selected.length < count && offset < users.length * 2; offset += 1) {
    const user = users[(seed * 5 + offset * 3) % users.length];

    if (!user || user.id === excludeUserId || selected.some((item) => item.id === user.id)) {
      continue;
    }

    selected.push(user);
  }

  return selected;
}

function createdAt(now: string, seed: number, salt: number) {
  const date = new Date(Date.parse(now));
  date.setDate(date.getDate() - ((seed + salt) % 10));
  date.setMinutes(date.getMinutes() - ((seed * 13 + salt * 7) % 240));
  return date.toISOString();
}

function hashSeed(value: string) {
  return createHash("sha256").update(`launch:${value}`).digest("hex");
}
