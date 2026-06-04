import type { Lang } from "@lib/i18n";
import { generateAiText } from "./ai";
import { listCategories, listTags } from "./categories";
import { parseSearchDirectives, type SearchPlan } from "./searchParser";

export interface SearchAiTranslation {
  plan: SearchPlan;
  directiveQuery: string;
  rawText: string;
  provider: string;
  model: string;
  configName: string;
}

export async function translateSearchQueryWithAi(input: {
  query: string;
  lang: Lang;
}): Promise<SearchAiTranslation> {
  const naturalQuery = input.query.trim();

  if (!naturalQuery) {
    throw new Error("Search query is required.");
  }

  const [categories, tags] = await Promise.all([
    listCategories(input.lang),
    listTags(input.lang),
  ]);
  const result = await generateAiText({
    system: buildSystemPrompt(input.lang),
    prompt: buildPrompt({
      query: naturalQuery,
      categories: categories.map((category) => `${category.name}(${category.slug})`).slice(0, 40),
      tags: tags.map((tag) => `${tag.name}(${tag.slug})`).slice(0, 80),
      lang: input.lang,
    }),
    maxTokens: 900,
  });
  const parsed = parseAiJson(result.text);
  const directiveQuery = aiJsonToDirectiveQuery(parsed) || naturalQuery;
  const plan = parseSearchDirectives(directiveQuery, {
    source: "ai",
    originalQuery: naturalQuery,
  });

  const normalized = readString(parsed, "normalizedQuery") || readString(parsed, "normalized_query");
  if (normalized && normalized !== plan.normalizedQuery) {
    plan.notes.push(`AI 理解：${normalized}`);
  }

  return {
    plan,
    directiveQuery: plan.normalizedQuery,
    rawText: result.text,
    provider: result.provider,
    model: result.model,
    configName: result.configName,
  };
}

function buildSystemPrompt(lang: Lang) {
  const locale = lang === "en"
    ? "Use English for explanations, but keep Chinese category/tag names when they match the user's intent."
    : "默认使用简体中文。分类名和标签名优先保留用户原文或已知站内名称。";

  return [
    "You translate a community search request into a controlled search query plan.",
    "Return JSON only. Do not return SQL, Markdown, code fences, comments, or prose.",
    "Never invent database columns or arbitrary operators.",
    "Allowed result types: topic, reply, category, tag, user.",
    "Allowed fields: title, summary, body.",
    "Allowed sort values: relevance, latest, hot, views, replies.",
    "Allowed flags: hasImage, hasLink, hasReply, noReply, isPinned, isFeatured.",
    locale,
  ].join("\n");
}

function buildPrompt(input: {
  query: string;
  categories: string[];
  tags: string[];
  lang: Lang;
}) {
  const schema = {
    keywords: ["seo", "流量增长"],
    types: ["topic"],
    fields: ["title", "body"],
    categories: ["独立开发"],
    tags: ["seo"],
    authors: ["whyisee"],
    mentions: ["ai"],
    after: "2026-06-01",
    before: "2026-06-30",
    within: "30d",
    flags: {
      hasImage: false,
      hasLink: false,
      hasReply: false,
      noReply: false,
      isPinned: false,
      isFeatured: false,
    },
    exclude: {
      categories: [],
      tags: [],
      authors: [],
    },
    sort: "hot",
    limit: 40,
    normalizedQuery: "seo 流量增长 category:独立开发 within:30d sort:hot",
  };

  return [
    "把用户的自然语言搜索请求翻译成 JSON。",
    "字段可以省略；不确定时少填，不要猜。",
    "如果用户只是普通关键词搜索，只填 keywords。",
    "时间范围优先使用 within，例如 7d、30d；明确日期使用 after/before。",
    "站内已知分类：",
    input.categories.length ? input.categories.join(", ") : "无",
    "站内已知标签：",
    input.tags.length ? input.tags.join(", ") : "无",
    "JSON 结构示例：",
    JSON.stringify(schema, null, 2),
    "用户搜索：",
    input.query,
  ].join("\n");
}

function parseAiJson(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");

  if (start < 0 || end <= start) {
    throw new Error("AI did not return JSON.");
  }

  const parsed = JSON.parse(unfenced.slice(start, end + 1));

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("AI JSON must be an object.");
  }

  return parsed as Record<string, unknown>;
}

function aiJsonToDirectiveQuery(data: Record<string, unknown>) {
  const parts: string[] = [];

  parts.push(...readStringArray(data, "keywords").map(quoteValue));
  pushDirectiveArray(parts, "type", readStringArray(data, "types"));
  pushDirectiveArray(parts, "in", readStringArray(data, "fields"));
  pushDirectiveArray(parts, "category", [
    ...readStringArray(data, "categories"),
    ...readStringArray(data, "categorySlugs"),
    ...readStringArray(data, "category_slugs"),
  ]);
  pushDirectiveArray(parts, "tag", [
    ...readStringArray(data, "tags"),
    ...readStringArray(data, "tagSlugs"),
    ...readStringArray(data, "tag_slugs"),
  ]);
  pushDirectiveArray(parts, "author", [
    ...readStringArray(data, "authors"),
    ...readStringArray(data, "authorUsernames"),
    ...readStringArray(data, "author_usernames"),
  ]);
  pushDirectiveArray(parts, "mention", [
    ...readStringArray(data, "mentions"),
    ...readStringArray(data, "mentionUsernames"),
    ...readStringArray(data, "mention_usernames"),
  ]);

  const dateRange = readObject(data, "dateRange") || readObject(data, "date_range");
  const after = readString(data, "after") || readString(data, "dateFrom") || readString(data, "date_from") || readString(dateRange, "after");
  const before = readString(data, "before") || readString(data, "dateTo") || readString(data, "date_to") || readString(dateRange, "before");
  const within = readString(data, "within") || readString(dateRange, "within");

  if (within) parts.push(`within:${quoteValue(within)}`);
  if (after) parts.push(`after:${quoteValue(after)}`);
  if (before) parts.push(`before:${quoteValue(before)}`);

  const flags = readObject(data, "flags");
  if (readBoolean(flags, "hasImage")) parts.push("has:image");
  if (readBoolean(flags, "hasLink")) parts.push("has:link");
  if (readBoolean(flags, "hasReply")) parts.push("has:reply");
  if (readBoolean(flags, "noReply")) parts.push("no:reply");
  if (readBoolean(flags, "isPinned")) parts.push("is:pinned");
  if (readBoolean(flags, "isFeatured")) parts.push("is:featured");

  const has = readStringArray(data, "has");
  for (const value of has) {
    parts.push(`has:${quoteValue(value)}`);
  }

  const exclude = readObject(data, "exclude");
  pushDirectiveArray(parts, "-category", readStringArray(exclude, "categories"));
  pushDirectiveArray(parts, "-tag", readStringArray(exclude, "tags"));
  pushDirectiveArray(parts, "-author", readStringArray(exclude, "authors"));

  const sort = readString(data, "sort");
  if (sort) parts.push(`sort:${quoteValue(sort)}`);

  const limit = readNumber(data, "limit");
  if (limit) parts.push(`limit:${limit}`);

  return parts.join(" ").trim();
}

function pushDirectiveArray(parts: string[], key: string, values: string[]) {
  for (const value of values) {
    if (value) {
      parts.push(`${key}:${quoteValue(value.replace(/^@/, "").replace(/^#/, ""))}`);
    }
  }
}

function quoteValue(value: string) {
  const text = value.trim();
  return /[\s:"']/.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
}

function readObject(data: unknown, key: string) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return undefined;
  }

  const value = (data as Record<string, unknown>)[key];
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function readString(data: unknown, key: string) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return "";
  }

  const value = (data as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(data: unknown, key: string) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return [];
  }

  const value = (data as Record<string, unknown>)[key];

  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 12);
  }

  if (typeof value === "string" && value.trim()) {
    return value.split(/[,，]/).map((item) => item.trim()).filter(Boolean).slice(0, 12);
  }

  return [];
}

function readBoolean(data: unknown, key: string) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return false;
  }

  return (data as Record<string, unknown>)[key] === true;
}

function readNumber(data: unknown, key: string) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return undefined;
  }

  const value = Number((data as Record<string, unknown>)[key]);
  return Number.isFinite(value) ? Math.max(1, Math.min(Math.floor(value), 60)) : undefined;
}
