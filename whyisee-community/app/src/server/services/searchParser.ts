import type { TopicType } from "@lib/types";

export type SearchResultKind = "topic" | "reply" | "category" | "tag" | "user";
export type SearchField = "title" | "summary" | "body";
export type SearchSort = "relevance" | "latest" | "hot" | "views" | "replies";
export type SearchPlanSource = "keyword" | "directive" | "ai";

export interface SearchPlan {
  originalQuery: string;
  normalizedQuery: string;
  keywords: string[];
  types: SearchResultKind[];
  fields: SearchField[];
  topicTypes: TopicType[];
  categoryQueries: string[];
  tagQueries: string[];
  authorQueries: string[];
  mentionQueries: string[];
  dateFrom?: string;
  dateTo?: string;
  flags: {
    hasImage: boolean;
    hasLink: boolean;
    hasReply: boolean;
    noReply: boolean;
    isPinned: boolean;
    isFeatured: boolean;
  };
  exclude: {
    categories: string[];
    tags: string[];
    authors: string[];
  };
  sort: SearchSort;
  limit?: number;
  source: SearchPlanSource;
  warnings: string[];
  notes: string[];
}

interface ParseOptions {
  source?: SearchPlanSource;
  originalQuery?: string;
}

const directiveKeys = new Set([
  "q",
  "keyword",
  "type",
  "kind",
  "in",
  "field",
  "category",
  "cat",
  "c",
  "tag",
  "tags",
  "t",
  "author",
  "by",
  "user",
  "mention",
  "mentions",
  "at",
  "after",
  "from",
  "before",
  "to",
  "within",
  "year",
  "has",
  "no",
  "is",
  "sort",
  "order",
  "limit",
]);

const typeAliases: Record<string, SearchResultKind> = {
  topic: "topic",
  topics: "topic",
  post: "reply",
  posts: "reply",
  reply: "reply",
  replies: "reply",
  comment: "reply",
  comments: "reply",
  category: "category",
  categories: "category",
  tag: "tag",
  tags: "tag",
  user: "user",
  users: "user",
  member: "user",
  话题: "topic",
  帖子: "topic",
  回复: "reply",
  评论: "reply",
  分类: "category",
  标签: "tag",
  用户: "user",
};

const topicTypeAliases: Record<string, TopicType> = {
  discussion: "discussion",
  discuss: "discussion",
  问答: "question",
  问题: "question",
  question: "question",
  article: "article",
  文章: "article",
  project: "project",
  项目: "project",
  resource: "resource",
  资源: "resource",
  announcement: "announcement",
  公告: "announcement",
};

const fieldAliases: Record<string, SearchField> = {
  title: "title",
  标题: "title",
  summary: "summary",
  摘要: "summary",
  body: "body",
  content: "body",
  正文: "body",
  内容: "body",
};

const sortAliases: Record<string, SearchSort> = {
  relevance: "relevance",
  relevant: "relevance",
  match: "relevance",
  latest: "latest",
  newest: "latest",
  new: "latest",
  recent: "latest",
  hot: "hot",
  popular: "hot",
  views: "views",
  view: "views",
  replies: "replies",
  reply: "replies",
  最新: "latest",
  热门: "hot",
  浏览: "views",
  回复: "replies",
};

export function parseSearchDirectives(input: string, options: ParseOptions = {}): SearchPlan {
  const originalQuery = options.originalQuery ?? input;
  const query = input.trim().replace(/^ai:\s*/i, "");
  const plan = createEmptySearchPlan(originalQuery, options.source || "keyword");
  const tokens = tokenize(query);
  let sawDirective = false;

  for (const rawToken of tokens) {
    const token = rawToken.trim();

    if (!token) {
      continue;
    }

    const exclude = token.startsWith("-") && token.length > 1;
    const readableToken = exclude ? token.slice(1) : token;

    if (readableToken.startsWith("#") && readableToken.length > 1) {
      addValues(exclude ? plan.exclude.tags : plan.tagQueries, [readableToken.slice(1)]);
      sawDirective = true;
      continue;
    }

    if (readableToken.startsWith("@") && readableToken.length > 1) {
      addValues(plan.mentionQueries, [readableToken.slice(1)]);
      sawDirective = true;
      continue;
    }

    const splitIndex = readableToken.indexOf(":");

    if (splitIndex <= 0) {
      plan.keywords.push(readableToken);
      continue;
    }

    const key = readableToken.slice(0, splitIndex).trim().toLowerCase();
    const value = readableToken.slice(splitIndex + 1).trim();

    if (!directiveKeys.has(key)) {
      plan.keywords.push(token);
      plan.warnings.push(`未知搜索指令 ${key}: 已按关键词处理`);
      continue;
    }

    sawDirective = true;
    applyDirective(plan, key, value, exclude);
  }

  plan.keywords = dedupeText(plan.keywords);
  plan.types = dedupeText(plan.types) as SearchResultKind[];
  plan.fields = dedupeText(plan.fields) as SearchField[];
  plan.topicTypes = dedupeText(plan.topicTypes) as TopicType[];
  plan.categoryQueries = dedupeText(plan.categoryQueries);
  plan.tagQueries = dedupeText(plan.tagQueries);
  plan.authorQueries = dedupeText(plan.authorQueries);
  plan.mentionQueries = dedupeText(plan.mentionQueries);
  plan.exclude.categories = dedupeText(plan.exclude.categories);
  plan.exclude.tags = dedupeText(plan.exclude.tags);
  plan.exclude.authors = dedupeText(plan.exclude.authors);

  if (options.source) {
    plan.source = options.source;
  } else {
    plan.source = sawDirective ? "directive" : "keyword";
  }

  plan.normalizedQuery = buildNormalizedQuery(plan) || query;
  return plan;
}

export function hasSearchDirectives(input: string) {
  return tokenize(input.trim().replace(/^ai:\s*/i, "")).some((token) => {
    const readable = token.startsWith("-") ? token.slice(1) : token;
    if (readable.startsWith("#") || readable.startsWith("@")) {
      return readable.length > 1;
    }

    const splitIndex = readable.indexOf(":");
    return splitIndex > 0 && directiveKeys.has(readable.slice(0, splitIndex).trim().toLowerCase());
  });
}

export function buildNormalizedQuery(plan: SearchPlan) {
  const parts: string[] = [];

  parts.push(...plan.keywords.map(quoteToken));
  parts.push(...plan.types.map((value) => `type:${value}`));
  parts.push(...plan.fields.map((value) => `in:${value}`));
  parts.push(...plan.topicTypes.map((value) => `kind:${value}`));
  parts.push(...plan.categoryQueries.map((value) => `category:${quoteToken(value)}`));
  parts.push(...plan.tagQueries.map((value) => `tag:${quoteToken(value)}`));
  parts.push(...plan.authorQueries.map((value) => `author:${quoteToken(value)}`));
  parts.push(...plan.mentionQueries.map((value) => `mention:${quoteToken(stripAt(value))}`));
  parts.push(...plan.exclude.categories.map((value) => `-category:${quoteToken(value)}`));
  parts.push(...plan.exclude.tags.map((value) => `-tag:${quoteToken(value)}`));
  parts.push(...plan.exclude.authors.map((value) => `-author:${quoteToken(value)}`));

  if (plan.dateFrom) {
    parts.push(`after:${plan.dateFrom.slice(0, 10)}`);
  }

  if (plan.dateTo) {
    parts.push(`before:${plan.dateTo.slice(0, 10)}`);
  }

  if (plan.flags.hasImage) parts.push("has:image");
  if (plan.flags.hasLink) parts.push("has:link");
  if (plan.flags.hasReply) parts.push("has:reply");
  if (plan.flags.noReply) parts.push("no:reply");
  if (plan.flags.isPinned) parts.push("is:pinned");
  if (plan.flags.isFeatured) parts.push("is:featured");

  if (plan.sort !== "relevance") {
    parts.push(`sort:${plan.sort}`);
  }

  if (plan.limit) {
    parts.push(`limit:${plan.limit}`);
  }

  return parts.join(" ").trim();
}

export function createEmptySearchPlan(originalQuery: string, source: SearchPlanSource): SearchPlan {
  return {
    originalQuery,
    normalizedQuery: "",
    keywords: [],
    types: [],
    fields: [],
    topicTypes: [],
    categoryQueries: [],
    tagQueries: [],
    authorQueries: [],
    mentionQueries: [],
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
    sort: "relevance",
    source,
    warnings: [],
    notes: [],
  };
}

function applyDirective(plan: SearchPlan, key: string, rawValue: string, exclude: boolean) {
  if (!rawValue && key !== "has" && key !== "no" && key !== "is") {
    plan.warnings.push(`${key}: 缺少值，已忽略`);
    return;
  }

  const values = splitValues(rawValue);

  switch (key) {
    case "q":
    case "keyword":
      plan.keywords.push(...values);
      break;
    case "type":
      for (const value of values) {
        const type = typeAliases[normalizeText(value)];
        if (type) {
          addValues(plan.types, [type]);
        } else {
          plan.warnings.push(`不支持的结果类型 ${value}`);
        }
      }
      break;
    case "kind":
      for (const value of values) {
        const topicType = topicTypeAliases[normalizeText(value)];
        if (topicType) {
          addValues(plan.topicTypes, [topicType]);
        } else {
          const type = typeAliases[normalizeText(value)];
          if (type) {
            addValues(plan.types, [type]);
          } else {
            plan.warnings.push(`不支持的内容类型 ${value}`);
          }
        }
      }
      break;
    case "in":
    case "field":
      for (const value of values) {
        const field = fieldAliases[normalizeText(value)];
        if (field) {
          addValues(plan.fields, [field]);
        } else if (normalizeText(value) !== "all" && normalizeText(value) !== "全部") {
          plan.warnings.push(`不支持的搜索范围 ${value}`);
        }
      }
      break;
    case "category":
    case "cat":
    case "c":
      addValues(exclude ? plan.exclude.categories : plan.categoryQueries, values);
      break;
    case "tag":
    case "tags":
    case "t":
      addValues(exclude ? plan.exclude.tags : plan.tagQueries, values.map((value) => value.replace(/^#/, "")));
      break;
    case "author":
    case "by":
    case "user":
      addValues(exclude ? plan.exclude.authors : plan.authorQueries, values.map(stripAt));
      break;
    case "mention":
    case "mentions":
    case "at":
      addValues(plan.mentionQueries, values.map(stripAt));
      break;
    case "after":
    case "from":
      plan.dateFrom = parseDateBoundary(values[0], "start") || plan.dateFrom;
      if (!plan.dateFrom) plan.warnings.push(`无法识别日期 ${values[0]}`);
      break;
    case "before":
    case "to":
      plan.dateTo = parseDateBoundary(values[0], "end") || plan.dateTo;
      if (!plan.dateTo) plan.warnings.push(`无法识别日期 ${values[0]}`);
      break;
    case "within": {
      const date = parseWithin(values[0]);
      if (date) {
        plan.dateFrom = date;
      } else {
        plan.warnings.push(`无法识别时间范围 ${values[0]}`);
      }
      break;
    }
    case "year": {
      const year = Number(values[0]);
      if (Number.isInteger(year) && year >= 2000 && year <= 2100) {
        plan.dateFrom = `${year}-01-01T00:00:00.000Z`;
        plan.dateTo = `${year}-12-31T23:59:59.999Z`;
      } else {
        plan.warnings.push(`无法识别年份 ${values[0]}`);
      }
      break;
    }
    case "has":
      applyHasFlag(plan, values);
      break;
    case "no":
      applyNoFlag(plan, values);
      break;
    case "is":
      applyStateFlag(plan, values);
      break;
    case "sort":
    case "order": {
      const sort = sortAliases[normalizeText(values[0])];
      if (sort) {
        plan.sort = sort;
      } else {
        plan.warnings.push(`不支持的排序 ${values[0]}`);
      }
      break;
    }
    case "limit": {
      const limit = Number(values[0]);
      if (Number.isFinite(limit)) {
        plan.limit = Math.max(1, Math.min(Math.floor(limit), 60));
      } else {
        plan.warnings.push(`不支持的数量 ${values[0]}`);
      }
      break;
    }
  }
}

function applyHasFlag(plan: SearchPlan, values: string[]) {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized === "image" || normalized === "img" || normalized === "图片") {
      plan.flags.hasImage = true;
    } else if (normalized === "link" || normalized === "url" || normalized === "链接") {
      plan.flags.hasLink = true;
    } else if (normalized === "reply" || normalized === "replies" || normalized === "评论" || normalized === "回复") {
      plan.flags.hasReply = true;
      plan.flags.noReply = false;
    } else {
      plan.warnings.push(`不支持 has:${value}`);
    }
  }
}

function applyNoFlag(plan: SearchPlan, values: string[]) {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized === "reply" || normalized === "replies" || normalized === "评论" || normalized === "回复") {
      plan.flags.noReply = true;
      plan.flags.hasReply = false;
    } else {
      plan.warnings.push(`不支持 no:${value}`);
    }
  }
}

function applyStateFlag(plan: SearchPlan, values: string[]) {
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized === "pinned" || normalized === "pin" || normalized === "置顶") {
      plan.flags.isPinned = true;
    } else if (normalized === "featured" || normalized === "feature" || normalized === "精选") {
      plan.flags.isFeatured = true;
    } else {
      plan.warnings.push(`不支持 is:${value}`);
    }
  }
}

function tokenize(input: string) {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | "" = "";

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (quote) {
      if (char === quote) {
        quote = "";
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function splitValues(value: string) {
  return value
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function addValues(target: string[], values: string[]) {
  for (const value of values) {
    const text = value.trim();
    if (text) {
      target.push(text);
    }
  }
}

function dedupeText<T extends string>(values: T[]) {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);
  }

  return result;
}

function parseDateBoundary(value: string, boundary: "start" | "end") {
  const normalized = value.trim().replace(/[./年月]/g, "-").replace(/日$/, "");
  const match = normalized.match(/^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/);

  if (!match) {
    return undefined;
  }

  const year = Number(match[1]);
  const month = Number(match[2] || (boundary === "start" ? 1 : 12));
  const day = Number(match[3] || (boundary === "start" ? 1 : daysInMonth(year, month)));

  if (!isValidDateParts(year, month, day)) {
    return undefined;
  }

  const suffix = boundary === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z";
  return `${year}-${pad(month)}-${pad(day)}${suffix}`;
}

function parseWithin(value: string) {
  const match = value.trim().toLowerCase().match(/^(\d{1,4})\s*(d|day|days|天|w|week|weeks|周|m|month|months|月|y|year|years|年)?$/);

  if (!match) {
    return undefined;
  }

  const amount = Number(match[1]);
  const unit = match[2] || "d";
  const multiplier = unit === "w" || unit.startsWith("week") || unit === "周"
    ? 7
    : unit === "m" || unit.startsWith("month") || unit === "月"
      ? 30
      : unit === "y" || unit.startsWith("year") || unit === "年"
        ? 365
        : 1;
  const date = new Date(Date.now() - amount * multiplier * 24 * 60 * 60 * 1000);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isValidDateParts(year: number, month: number, day: number) {
  return year >= 2000 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function stripAt(value: string) {
  return value.replace(/^@/, "");
}

function quoteToken(value: string) {
  return /[\s:"']/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
}
