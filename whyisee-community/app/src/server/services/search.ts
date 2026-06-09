import { formatRelative } from "@lib/format";
import { TREE_HOLE_CATEGORY_SLUG } from "@lib/anonymous";
import type { Lang } from "@lib/i18n";
import { query } from "@server/db/client";
import { AiServiceError } from "./ai";
import { translateSearchQueryWithAi, type SearchAiTranslation } from "./searchAi";
import {
  parseSearchDirectives,
  type SearchPlan,
  type SearchResultKind,
  type SearchSort,
} from "./searchParser";

export type SearchMode = "auto" | "directive" | "ai";

export interface SearchResult {
  kind: SearchResultKind;
  title: string;
  summary: string;
  href: string;
  meta: string;
  rank: number;
  replyCount: number;
  viewCount: number;
}

export interface SearchRunResult {
  q: string;
  mode: SearchMode;
  plan: SearchPlan;
  results: SearchResult[];
  warnings: string[];
  notes: string[];
  ai?: {
    directiveQuery: string;
    provider: string;
    model: string;
    configName: string;
  };
  fallback?: boolean;
  error?: string;
}

interface SearchCommunityOptions {
  limit?: number;
  mode?: SearchMode;
}

interface SearchRow {
  kind: SearchResult["kind"];
  title: string;
  summary: string;
  href: string;
  meta_date: string | null;
  rank: number;
  reply_count: number;
  view_count: number;
}

interface QueryParts {
  sql: string;
  params: unknown[];
}

const allKinds: SearchResultKind[] = ["topic", "reply", "category", "tag", "user"];

export async function searchCommunity(term: string, lang: Lang, limit = 30): Promise<SearchResult[]> {
  const result = await runCommunitySearch(term, lang, { limit, mode: "directive" });
  return result.results;
}

export async function runCommunitySearch(
  term: string,
  lang: Lang,
  options: SearchCommunityOptions = {},
): Promise<SearchRunResult> {
  const q = term.trim();
  const requestedMode = normalizeMode(options.mode);
  const cleanQuery = q.replace(/^ai:\s*/i, "").trim();

  if (!q) {
    const plan = parseSearchDirectives("", { source: "keyword" });
    return {
      q,
      mode: requestedMode,
      plan,
      results: [],
      warnings: [],
      notes: [],
    };
  }

  let mode = requestedMode;
  let ai: SearchAiTranslation | undefined;
  let plan: SearchPlan;
  let fallback = false;
  let error: string | undefined;

  if (mode === "ai" || (mode === "auto" && /^ai:\s*/i.test(q))) {
    mode = "ai";

    try {
      ai = await translateSearchQueryWithAi({ query: cleanQuery || q, lang });
      plan = ai.plan;
    } catch (caught) {
      fallback = true;
      error = caught instanceof AiServiceError ? caught.code : "ai_failed";
      console.error("AI search translation failed", caught);
      plan = parseSearchDirectives(cleanQuery || q, { source: "keyword", originalQuery: cleanQuery || q });
      plan.warnings.push("AI 搜索暂时不可用，已退回普通搜索");
    }
  } else {
    plan = parseSearchDirectives(q, { source: mode === "directive" ? "directive" : undefined });
  }

  const limit = resolveLimit(options.limit, plan.limit);
  const results = await executeSearchPlan(plan, lang, limit);

  return {
    q,
    mode,
    plan,
    results,
    warnings: plan.warnings,
    notes: plan.notes,
    ai: ai
      ? {
          directiveQuery: ai.directiveQuery,
          provider: ai.provider,
          model: ai.model,
          configName: ai.configName,
        }
      : undefined,
    fallback,
    error,
  };
}

async function executeSearchPlan(plan: SearchPlan, lang: Lang, limit: number) {
  if (!hasExecutablePlan(plan)) {
    return [];
  }

  const params: unknown[] = [];
  const subqueries: string[] = [];
  const kinds = chooseKinds(plan);

  if (kinds.includes("topic")) {
    const sql = buildTopicQuery(plan, params).sql;
    if (sql) subqueries.push(sql);
  }

  if (kinds.includes("reply")) {
    const sql = buildReplyQuery(plan, params).sql;
    if (sql) subqueries.push(sql);
  }

  if (kinds.includes("category")) {
    const sql = buildCategoryQuery(plan, params).sql;
    if (sql) subqueries.push(sql);
  }

  if (kinds.includes("tag")) {
    const sql = buildTagQuery(plan, params).sql;
    if (sql) subqueries.push(sql);
  }

  if (kinds.includes("user")) {
    const sql = buildUserQuery(plan, params).sql;
    if (sql) subqueries.push(sql);
  }

  if (subqueries.length === 0) {
    return [];
  }

  const limitParam = addParam(params, limit);
  const rows = await query<SearchRow>(
    `
    SELECT *
    FROM (
      ${subqueries.join("\n\nUNION ALL\n\n")}
    ) results
    ${orderBySql(plan.sort)}
    LIMIT ${limitParam}
    `,
    params,
  );

  return rows.map((row) => ({
    kind: row.kind,
    title: row.title,
    summary: row.summary,
    href: encodeSearchHref(row.href),
    meta: row.meta_date ? formatRelative(row.meta_date, lang) : "",
    rank: Number(row.rank || 0),
    replyCount: Number(row.reply_count || 0),
    viewCount: Number(row.view_count || 0),
  }));
}

function buildTopicQuery(plan: SearchPlan, params: unknown[]): QueryParts {
  const where = [
    "topics.status = 'published'",
    ...buildTopicSharedFilters(plan, params, "topics", "topic_author", {
      includeDate: true,
      includeContentFlags: true,
      includeMentions: true,
    }),
  ];
  const keyword = buildKeywordSearch(plan, params, [
    { field: "title", sql: "topics.title" },
    { field: "summary", sql: "topics.summary" },
    { field: "body", sql: "topics.content_markdown" },
  ]);

  if (keyword.condition) {
    where.push(keyword.condition);
  }

  if (plan.flags.hasReply) {
    where.push("topics.reply_count > 0");
  }

  if (plan.flags.noReply) {
    where.push("topics.reply_count = 0");
  }

  if (plan.flags.isPinned) {
    where.push("topics.is_pinned = TRUE");
  }

  if (plan.flags.isFeatured) {
    where.push("topics.is_featured = TRUE");
  }

  return {
    sql: `
      SELECT
        'topic'::text AS kind,
        topics.title,
        COALESCE(NULLIF(topics.summary, ''), left(topics.content_markdown, 180)) AS summary,
        '/t/' || topics.id AS href,
        COALESCE(topics.last_activity_at, topics.published_at, topics.created_at) AS meta_date,
        ${keyword.rank} AS rank,
        topics.reply_count,
        topics.view_count
      FROM topics
      INNER JOIN categories ON categories.id = topics.category_id
      INNER JOIN users topic_author ON topic_author.id = topics.author_id
      WHERE ${where.join("\n        AND ")}
    `,
    params,
  };
}

function buildReplyQuery(plan: SearchPlan, params: unknown[]): QueryParts {
  if (plan.flags.noReply || plan.flags.hasReply) {
    return { sql: "", params };
  }

  const where = [
    "posts.status = 'published'",
    "topics.status = 'published'",
    ...buildTopicSharedFilters(plan, params, "topics", "post_author", {
      includeDate: false,
      includeContentFlags: false,
      includeMentions: false,
    }),
  ];
  const keyword = buildKeywordSearch(plan, params, [
    { field: "body", sql: "posts.content_markdown" },
  ]);

  if (keyword.condition) {
    where.push(keyword.condition);
  }

  if (plan.flags.isPinned) {
    where.push("topics.is_pinned = TRUE");
  }

  if (plan.flags.isFeatured) {
    where.push("topics.is_featured = TRUE");
  }

  if (plan.flags.hasImage) {
    where.push(markdownImageCondition("posts.content_markdown"));
  }

  if (plan.flags.hasLink) {
    where.push(markdownLinkCondition("posts.content_markdown"));
  }

  if (plan.mentionQueries.length) {
    where.push(`
      EXISTS (
        SELECT 1
        FROM mentions search_mentions
        INNER JOIN users mentioned_users ON mentioned_users.id = search_mentions.mentioned_user_id
        WHERE search_mentions.source_type = 'post'
          AND search_mentions.source_id = posts.id
          AND ${buildNameFilter("mentioned_users", ["username", "display_name"], plan.mentionQueries, params)}
      )
    `);
  }

  if (plan.dateFrom) {
    where.push(`posts.created_at >= ${addParam(params, plan.dateFrom)}`);
  }

  if (plan.dateTo) {
    where.push(`posts.created_at <= ${addParam(params, plan.dateTo)}`);
  }

  return {
    sql: `
      SELECT
        'reply'::text AS kind,
        topics.title,
        left(posts.content_markdown, 180) AS summary,
        '/t/' || topics.id || '#post-' || posts.id AS href,
        posts.created_at AS meta_date,
        ${keyword.rank} AS rank,
        topics.reply_count,
        topics.view_count
      FROM posts
      INNER JOIN topics ON topics.id = posts.topic_id
      INNER JOIN categories ON categories.id = topics.category_id
      INNER JOIN users post_author ON post_author.id = posts.author_id
      WHERE ${where.join("\n        AND ")}
    `,
    params,
  };
}

function buildCategoryQuery(plan: SearchPlan, params: unknown[]): QueryParts {
  const where = ["categories.is_public = TRUE"];
  const keyword = buildKeywordSearch(plan, params, [
    { field: "title", sql: "categories.name" },
    { field: "summary", sql: "categories.description" },
  ]);

  if (keyword.condition) {
    where.push(keyword.condition);
  }

  if (plan.dateFrom) {
    where.push(`categories.created_at >= ${addParam(params, plan.dateFrom)}`);
  }

  if (plan.dateTo) {
    where.push(`categories.created_at <= ${addParam(params, plan.dateTo)}`);
  }

  return {
    sql: `
      SELECT
        'category'::text AS kind,
        categories.name AS title,
        categories.description AS summary,
        '/c/' || categories.slug AS href,
        categories.created_at AS meta_date,
        ${keyword.rank} AS rank,
        COUNT(topics.id)::int AS reply_count,
        0::int AS view_count
      FROM categories
      LEFT JOIN topics ON topics.category_id = categories.id AND topics.status = 'published'
      WHERE ${where.join("\n        AND ")}
      GROUP BY categories.id, categories.name, categories.description, categories.slug, categories.created_at
    `,
    params,
  };
}

function buildTagQuery(plan: SearchPlan, params: unknown[]): QueryParts {
  const where: string[] = [];
  const keyword = buildKeywordSearch(plan, params, [
    { field: "title", sql: "tags.name" },
    { field: "summary", sql: "tags.description" },
  ]);

  if (keyword.condition) {
    where.push(keyword.condition);
  }

  if (plan.dateFrom) {
    where.push(`tags.created_at >= ${addParam(params, plan.dateFrom)}`);
  }

  if (plan.dateTo) {
    where.push(`tags.created_at <= ${addParam(params, plan.dateTo)}`);
  }

  return {
    sql: `
      SELECT
        'tag'::text AS kind,
        tags.name AS title,
        tags.description AS summary,
        '/tag/' || tags.slug AS href,
        tags.created_at AS meta_date,
        ${keyword.rank} AS rank,
        COUNT(topics.id)::int AS reply_count,
        0::int AS view_count
      FROM tags
      LEFT JOIN topic_tags ON topic_tags.tag_id = tags.id
      LEFT JOIN topics ON topics.id = topic_tags.topic_id AND topics.status = 'published'
      ${where.length ? `WHERE ${where.join("\n        AND ")}` : ""}
      GROUP BY tags.id, tags.name, tags.description, tags.slug, tags.created_at
    `,
    params,
  };
}

function buildUserQuery(plan: SearchPlan, params: unknown[]): QueryParts {
  const where = ["users.status = 'active'"];
  const keyword = buildKeywordSearch(plan, params, [
    { field: "title", sql: "users.username" },
    { field: "title", sql: "users.display_name" },
    { field: "body", sql: "users.bio" },
  ]);

  if (keyword.condition) {
    where.push(keyword.condition);
  }

  if (plan.dateFrom) {
    where.push(`users.created_at >= ${addParam(params, plan.dateFrom)}`);
  }

  if (plan.dateTo) {
    where.push(`users.created_at <= ${addParam(params, plan.dateTo)}`);
  }

  return {
    sql: `
      SELECT
        'user'::text AS kind,
        users.display_name AS title,
        users.bio AS summary,
        '/u/' || users.username AS href,
        users.created_at AS meta_date,
        ${keyword.rank} AS rank,
        COUNT(topics.id)::int AS reply_count,
        0::int AS view_count
      FROM users
      LEFT JOIN topics ON topics.author_id = users.id AND topics.status = 'published'
      WHERE ${where.join("\n        AND ")}
      GROUP BY users.id, users.display_name, users.bio, users.username, users.created_at
    `,
    params,
  };
}

function buildTopicSharedFilters(
  plan: SearchPlan,
  params: unknown[],
  topicAlias: string,
  authorAlias: string,
  options: { includeDate: boolean; includeContentFlags: boolean; includeMentions: boolean },
) {
  const where: string[] = [];

  if (plan.topicTypes.length) {
    where.push(`${topicAlias}.type = ANY(${addParam(params, plan.topicTypes)}::text[])`);
  }

  if (options.includeDate && plan.dateFrom) {
    where.push(`COALESCE(${topicAlias}.published_at, ${topicAlias}.created_at) >= ${addParam(params, plan.dateFrom)}`);
  }

  if (options.includeDate && plan.dateTo) {
    where.push(`COALESCE(${topicAlias}.published_at, ${topicAlias}.created_at) <= ${addParam(params, plan.dateTo)}`);
  }

  if (plan.categoryQueries.length) {
    where.push(buildNameFilter("categories", ["slug", "name"], plan.categoryQueries, params));
  }

  if (plan.exclude.categories.length) {
    where.push(`NOT ${buildNameFilter("categories", ["slug", "name"], plan.exclude.categories, params)}`);
  }

  if (plan.tagQueries.length) {
    where.push(`
      EXISTS (
        SELECT 1
        FROM topic_tags search_topic_tags
        INNER JOIN tags search_tags ON search_tags.id = search_topic_tags.tag_id
        WHERE search_topic_tags.topic_id = ${topicAlias}.id
          AND ${buildNameFilter("search_tags", ["slug", "name"], plan.tagQueries, params)}
      )
    `);
  }

  if (plan.exclude.tags.length) {
    where.push(`
      NOT EXISTS (
        SELECT 1
        FROM topic_tags exclude_topic_tags
        INNER JOIN tags exclude_tags ON exclude_tags.id = exclude_topic_tags.tag_id
        WHERE exclude_topic_tags.topic_id = ${topicAlias}.id
          AND ${buildNameFilter("exclude_tags", ["slug", "name"], plan.exclude.tags, params)}
      )
    `);
  }

  if (plan.authorQueries.length) {
    where.push(`categories.slug <> ${addParam(params, TREE_HOLE_CATEGORY_SLUG)}`);
    where.push(buildNameFilter(authorAlias, ["username", "display_name"], plan.authorQueries, params));
  }

  if (plan.exclude.authors.length) {
    const authorFilter = buildNameFilter(authorAlias, ["username", "display_name"], plan.exclude.authors, params);
    where.push(`(categories.slug = ${addParam(params, TREE_HOLE_CATEGORY_SLUG)} OR NOT ${authorFilter})`);
  }

  if (options.includeMentions && plan.mentionQueries.length) {
    where.push(`
      EXISTS (
        SELECT 1
        FROM mentions search_mentions
        INNER JOIN users mentioned_users ON mentioned_users.id = search_mentions.mentioned_user_id
        LEFT JOIN posts mentioned_posts ON mentioned_posts.id = search_mentions.source_id AND search_mentions.source_type = 'post'
        WHERE ${buildNameFilter("mentioned_users", ["username", "display_name"], plan.mentionQueries, params)}
          AND (
            (search_mentions.source_type = 'topic' AND search_mentions.source_id = ${topicAlias}.id)
            OR (search_mentions.source_type = 'post' AND mentioned_posts.topic_id = ${topicAlias}.id)
          )
      )
    `);
  }

  if (options.includeContentFlags && plan.flags.hasImage) {
    where.push(markdownImageCondition(`${topicAlias}.content_markdown`));
  }

  if (options.includeContentFlags && plan.flags.hasLink) {
    where.push(markdownLinkCondition(`${topicAlias}.content_markdown`));
  }

  return where;
}

function buildKeywordSearch(
  plan: SearchPlan,
  params: unknown[],
  fields: Array<{ field: "title" | "summary" | "body"; sql: string }>,
) {
  const activeFields = plan.fields.length
    ? fields.filter((item) => plan.fields.includes(item.field))
    : fields;

  if (!plan.keywords.length || activeFields.length === 0) {
    return {
      condition: "",
      rank: "0::float",
    };
  }

  const keywordText = plan.keywords.join(" ");
  const keywordParam = addParam(params, keywordText);
  const likeParam = addParam(params, plan.keywords.map((item) => `%${item}%`));
  const textExpr = activeFields.map((item) => `coalesce(${item.sql}, '')`).join(" || ' ' || ");
  const vector = `to_tsvector('simple', ${textExpr})`;
  const likeCondition = activeFields.map((item) => `${item.sql} ILIKE ANY(${likeParam}::text[])`).join(" OR ");

  return {
    condition: `(${vector} @@ plainto_tsquery('simple', ${keywordParam}) OR ${likeCondition})`,
    rank: `(
      ts_rank(${vector}, plainto_tsquery('simple', ${keywordParam}))
      + CASE WHEN ${likeCondition} THEN 1 ELSE 0 END
    )`,
  };
}

function buildNameFilter(alias: string, fields: string[], values: string[], params: unknown[]) {
  const normalizedValues = values.map((value) => value.toLowerCase());
  const exactParam = addParam(params, normalizedValues);
  const likeParam = addParam(params, values.map((value) => `%${value}%`));
  const exact = fields.map((field) => `lower(${alias}.${field}) = ANY(${exactParam}::text[])`).join(" OR ");
  const fuzzy = fields.map((field) => `${alias}.${field} ILIKE ANY(${likeParam}::text[])`).join(" OR ");
  return `((${exact}) OR (${fuzzy}))`;
}

function markdownImageCondition(column: string) {
  return `(${column} ~* '!\\[[^\\]]*\\]\\([^)]*\\)' OR ${column} ~* '<img\\s')`;
}

function markdownLinkCondition(column: string) {
  return `(${column} ~* 'https?://' OR ${column} ~* '\\[[^\\]]+\\]\\(https?://')`;
}

function chooseKinds(plan: SearchPlan) {
  if (plan.types.length) {
    return plan.types;
  }

  if (plan.flags.hasReply || plan.flags.noReply || plan.flags.isPinned || plan.flags.isFeatured) {
    return ["topic"] satisfies SearchResultKind[];
  }

  if (
    plan.categoryQueries.length ||
    plan.tagQueries.length ||
    plan.authorQueries.length ||
    plan.mentionQueries.length ||
    plan.exclude.categories.length ||
    plan.exclude.tags.length ||
    plan.exclude.authors.length ||
    plan.topicTypes.length ||
    plan.flags.hasImage ||
    plan.flags.hasLink
  ) {
    return ["topic", "reply"] satisfies SearchResultKind[];
  }

  return allKinds;
}

function hasExecutablePlan(plan: SearchPlan) {
  return Boolean(
    plan.originalQuery.trim() ||
      plan.keywords.length ||
      plan.types.length ||
      plan.topicTypes.length ||
      plan.categoryQueries.length ||
      plan.tagQueries.length ||
      plan.authorQueries.length ||
      plan.mentionQueries.length ||
      plan.dateFrom ||
      plan.dateTo ||
      plan.flags.hasImage ||
      plan.flags.hasLink ||
      plan.flags.hasReply ||
      plan.flags.noReply ||
      plan.flags.isPinned ||
      plan.flags.isFeatured,
  );
}

function orderBySql(sort: SearchSort) {
  if (sort === "latest") {
    return "ORDER BY meta_date DESC NULLS LAST, rank DESC";
  }

  if (sort === "hot") {
    return "ORDER BY (rank + LEAST(reply_count, 200) * 0.08 + LEAST(view_count, 1000) * 0.01) DESC, meta_date DESC NULLS LAST";
  }

  if (sort === "views") {
    return "ORDER BY view_count DESC NULLS LAST, rank DESC, meta_date DESC NULLS LAST";
  }

  if (sort === "replies") {
    return "ORDER BY reply_count DESC NULLS LAST, rank DESC, meta_date DESC NULLS LAST";
  }

  return "ORDER BY rank DESC, meta_date DESC NULLS LAST";
}

function addParam(params: unknown[], value: unknown) {
  params.push(value);
  return `$${params.length}`;
}

function resolveLimit(optionLimit: number | undefined, planLimit: number | undefined) {
  const fallback = optionLimit ?? 30;
  const requested = planLimit ? Math.min(planLimit, fallback) : fallback;
  return Math.max(1, Math.min(Math.floor(requested), 60));
}

function normalizeMode(mode: SearchMode | undefined): SearchMode {
  if (mode === "ai" || mode === "directive") {
    return mode;
  }

  return "auto";
}

function encodeSearchHref(href: string) {
  const topicMatch = href.match(/^\/t\/(\d+)\/([^#?]+)(.*)$/);

  if (topicMatch) {
    return `/t/${topicMatch[1]}${topicMatch[3] || ""}`;
  }

  const idOnlyTopicMatch = href.match(/^\/t\/(\d+)(.*)$/);

  if (idOnlyTopicMatch) {
    return `/t/${idOnlyTopicMatch[1]}${idOnlyTopicMatch[2] || ""}`;
  }

  const categoryMatch = href.match(/^\/c\/([^#?]+)(.*)$/);

  if (categoryMatch) {
    return `/c/${encodeURIComponent(decodeURIComponent(categoryMatch[1]))}${categoryMatch[2] || ""}`;
  }

  const tagMatch = href.match(/^\/tag\/([^#?]+)(.*)$/);

  if (tagMatch) {
    return `/tag/${encodeURIComponent(decodeURIComponent(tagMatch[1]))}${tagMatch[2] || ""}`;
  }

  return href;
}
