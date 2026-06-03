import { createHash } from "node:crypto";
import { execute, query, queryOne } from "@server/db/client";

export async function recordPageView(input: {
  path: string;
  method: string;
  userId?: number;
  ip?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
}) {
  await execute(
    `
    INSERT INTO page_views (path, method, user_id, ip_hash, user_agent, referrer, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [
      input.path,
      input.method,
      input.userId || null,
      input.ip ? hashIp(input.ip) : null,
      input.userAgent || null,
      input.referrer || null,
      new Date().toISOString(),
    ],
  );
}

export async function getAdminStats() {
  const [totals, today, topPages, recentReports] = await Promise.all([
    queryOne<{
      users: string;
      topics: string;
      posts: string;
      reports: string;
      pending_topics: string;
    }>(
      `
      SELECT
        (SELECT COUNT(*) FROM users)::text AS users,
        (SELECT COUNT(*) FROM topics WHERE status <> 'deleted')::text AS topics,
        (SELECT COUNT(*) FROM posts WHERE status <> 'deleted')::text AS posts,
        (SELECT COUNT(*) FROM reports WHERE status = 'open')::text AS reports,
        (SELECT COUNT(*) FROM topics WHERE status = 'pending')::text AS pending_topics
      `,
    ),
    queryOne<{
      page_views: string;
      unique_visitors: string;
      new_users: string;
      new_topics: string;
      new_posts: string;
    }>(
      `
      SELECT
        (SELECT COUNT(*) FROM page_views WHERE created_at >= $1)::text AS page_views,
        (SELECT COUNT(DISTINCT ip_hash) FROM page_views WHERE created_at >= $1)::text AS unique_visitors,
        (SELECT COUNT(*) FROM users WHERE created_at >= $1)::text AS new_users,
        (SELECT COUNT(*) FROM topics WHERE created_at >= $1)::text AS new_topics,
        (SELECT COUNT(*) FROM posts WHERE created_at >= $1)::text AS new_posts
      `,
      [startOfToday()],
    ),
    query<{ path: string; views: string }>(
      `
      SELECT path, COUNT(*)::text AS views
      FROM page_views
      WHERE created_at >= $1
      GROUP BY path
      ORDER BY COUNT(*) DESC
      LIMIT 10
      `,
      [daysAgo(7)],
    ),
    query<{ status: string; count: string }>("SELECT status, COUNT(*)::text AS count FROM reports GROUP BY status"),
  ]);

  return {
    totals: {
      users: Number(totals?.users || 0),
      topics: Number(totals?.topics || 0),
      posts: Number(totals?.posts || 0),
      reports: Number(totals?.reports || 0),
      pendingTopics: Number(totals?.pending_topics || 0),
    },
    today: {
      pageViews: Number(today?.page_views || 0),
      uniqueVisitors: Number(today?.unique_visitors || 0),
      newUsers: Number(today?.new_users || 0),
      newTopics: Number(today?.new_topics || 0),
      newPosts: Number(today?.new_posts || 0),
    },
    topPages: topPages.map((row) => ({ path: row.path, views: Number(row.views) })),
    reports: recentReports.map((row) => ({ status: row.status, count: Number(row.count) })),
  };
}

function hashIp(value: string) {
  return createHash("sha256").update(`${process.env.ANALYTICS_SALT || "whyisee"}:${value}`).digest("hex");
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}
