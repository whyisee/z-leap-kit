import { Hono } from "hono";
import {
  getCategoryBySlug,
  getTagBySlug,
  listCategories,
  listTags,
} from "@server/services/categories";
import { listTopics } from "@server/services/topics";
import { fail, intParam, langOf, ok, type ApiEnv } from "../http";
import { toFeedItem } from "../serializers";

/**
 * 分类与标签的聚合页。
 *
 * 网页侧这两页除了列表还有一堆「相关分类」「热门标签」的推荐位，手机上第一屏
 * 就该看到内容 —— 所以这里只回三样：这个分类/标签是什么、里面有多少话题、
 * 话题本身（分页）。
 */
const taxonomy = new Hono<ApiEnv>();

taxonomy.get("/categories", async (c) => {
  const lang = langOf(c);
  const categories = await listCategories(lang);

  return ok(c, {
    categories: categories.map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      description: item.description ?? "",
      color: item.color ?? "",
      topicCount: item.topicCount ?? 0,
    })),
  });
});

taxonomy.get("/tags", async (c) => {
  const lang = langOf(c);
  const limit = Math.min(Math.max(intParam(c.req.query("limit"), 60), 1), 200);
  const tags = await listTags(lang);

  return ok(c, {
    tags: tags
      .filter((tag) => (tag.topicCount ?? 0) > 0)
      .sort((a, b) => (b.topicCount ?? 0) - (a.topicCount ?? 0))
      .slice(0, limit)
      .map((tag) => ({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        description: tag.description ?? "",
        topicCount: tag.topicCount ?? 0,
      })),
  });
});

taxonomy.get("/categories/:slug", async (c) => {
  const lang = langOf(c);
  const slug = c.req.param("slug");
  const limit = Math.min(Math.max(intParam(c.req.query("limit"), 20), 1), 50);
  const offset = Math.max(intParam(c.req.query("offset"), 0), 0);

  const category = await getCategoryBySlug(slug, lang);

  if (!category) {
    return fail(c, "not_found", "这个分类不存在");
  }

  // 多取一条判断还有没有下一页，比再发一次 COUNT 便宜
  const rows = await listTopics({ categorySlug: slug, limit: limit + 1, offset });
  const hasMore = rows.length > limit;

  return ok(
    c,
    {
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description ?? "",
        color: category.color ?? "",
        topicCount: category.topicCount ?? 0,
      },
      topics: rows.slice(0, limit).map(toFeedItem),
    },
    { hasMore, nextOffset: hasMore ? offset + limit : null },
  );
});

taxonomy.get("/tags/:slug", async (c) => {
  const lang = langOf(c);
  const slug = c.req.param("slug");
  const limit = Math.min(Math.max(intParam(c.req.query("limit"), 20), 1), 50);
  const offset = Math.max(intParam(c.req.query("offset"), 0), 0);

  const tag = await getTagBySlug(slug, lang);

  if (!tag) {
    return fail(c, "not_found", "这个标签不存在");
  }

  const rows = await listTopics({ tagSlug: slug, limit: limit + 1, offset });
  const hasMore = rows.length > limit;

  return ok(
    c,
    {
      tag: {
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        description: tag.description ?? "",
        topicCount: tag.topicCount ?? 0,
      },
      topics: rows.slice(0, limit).map(toFeedItem),
    },
    { hasMore, nextOffset: hasMore ? offset + limit : null },
  );
});

export default taxonomy;
