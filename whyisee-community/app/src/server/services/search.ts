import { formatRelative } from "@lib/format";
import type { Lang } from "@lib/i18n";
import { query } from "@server/db/client";

export interface SearchResult {
  kind: "topic" | "reply" | "category" | "tag" | "user";
  title: string;
  summary: string;
  href: string;
  meta: string;
  rank: number;
}

interface SearchRow {
  kind: SearchResult["kind"];
  title: string;
  summary: string;
  href: string;
  meta_date: string | null;
  rank: number;
}

export async function searchCommunity(term: string, lang: Lang, limit = 30): Promise<SearchResult[]> {
  const q = term.trim();

  if (!q) {
    return [];
  }

  const rows = await query<SearchRow>(
    `
    WITH search_query AS (
      SELECT plainto_tsquery('simple', $1) AS tsq, '%' || $1 || '%' AS likeq
    )
    SELECT *
    FROM (
      SELECT
        'topic'::text AS kind,
        topics.title,
        COALESCE(NULLIF(topics.summary, ''), left(topics.content_markdown, 180)) AS summary,
        '/t/' || topics.id || '/' || topics.slug AS href,
        COALESCE(topics.last_activity_at, topics.published_at, topics.created_at) AS meta_date,
        ts_rank(
          to_tsvector('simple', coalesce(topics.title, '') || ' ' || coalesce(topics.summary, '') || ' ' || coalesce(topics.content_markdown, '')),
          search_query.tsq
        ) + CASE WHEN topics.title ILIKE search_query.likeq THEN 1 ELSE 0 END AS rank
      FROM topics, search_query
      WHERE topics.status = 'published'
        AND (
          to_tsvector('simple', coalesce(topics.title, '') || ' ' || coalesce(topics.summary, '') || ' ' || coalesce(topics.content_markdown, '')) @@ search_query.tsq
          OR topics.title ILIKE search_query.likeq
          OR topics.summary ILIKE search_query.likeq
          OR topics.content_markdown ILIKE search_query.likeq
        )

      UNION ALL

      SELECT
        'reply'::text AS kind,
        topics.title,
        left(posts.content_markdown, 180) AS summary,
        '/t/' || topics.id || '/' || topics.slug || '#post-' || posts.id AS href,
        posts.created_at AS meta_date,
        ts_rank(to_tsvector('simple', coalesce(posts.content_markdown, '')), search_query.tsq) AS rank
      FROM posts
      INNER JOIN topics ON topics.id = posts.topic_id,
      search_query
      WHERE posts.status = 'published'
        AND topics.status = 'published'
        AND (
          to_tsvector('simple', coalesce(posts.content_markdown, '')) @@ search_query.tsq
          OR posts.content_markdown ILIKE search_query.likeq
        )

      UNION ALL

      SELECT
        'category'::text AS kind,
        categories.name AS title,
        categories.description AS summary,
        '/c/' || categories.slug AS href,
        categories.created_at AS meta_date,
        CASE WHEN categories.name ILIKE search_query.likeq THEN 1 ELSE 0.3 END AS rank
      FROM categories, search_query
      WHERE categories.is_public = TRUE
        AND (categories.name ILIKE search_query.likeq OR categories.description ILIKE search_query.likeq)

      UNION ALL

      SELECT
        'tag'::text AS kind,
        tags.name AS title,
        tags.description AS summary,
        '/tag/' || tags.slug AS href,
        tags.created_at AS meta_date,
        CASE WHEN tags.name ILIKE search_query.likeq THEN 1 ELSE 0.3 END AS rank
      FROM tags, search_query
      WHERE tags.name ILIKE search_query.likeq OR tags.description ILIKE search_query.likeq

      UNION ALL

      SELECT
        'user'::text AS kind,
        users.display_name AS title,
        users.bio AS summary,
        '/u/' || users.username AS href,
        users.created_at AS meta_date,
        CASE WHEN users.username ILIKE search_query.likeq OR users.display_name ILIKE search_query.likeq THEN 1 ELSE 0.2 END AS rank
      FROM users, search_query
      WHERE users.status = 'active'
        AND (users.username ILIKE search_query.likeq OR users.display_name ILIKE search_query.likeq OR users.bio ILIKE search_query.likeq)
    ) results
    ORDER BY rank DESC, meta_date DESC NULLS LAST
    LIMIT $2
    `,
    [q, limit],
  );

  return rows.map((row) => ({
    kind: row.kind,
    title: row.title,
    summary: row.summary,
    href: row.href,
    meta: row.meta_date ? formatRelative(row.meta_date, lang) : "",
    rank: Number(row.rank || 0),
  }));
}
