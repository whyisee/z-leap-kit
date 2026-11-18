import { Hono } from "hono";
import { listCategories, listTags } from "@server/services/categories";
import { langOf, ok, type ApiEnv } from "../http";

const meta = new Hono<ApiEnv>();

/**
 * 客户端启动时拉一次：强制升级阈值、功能开关、接口地址。
 * 值走环境变量，改配置不用发版。
 */
meta.get("/", (c) => {
  return ok(c, {
    minVersion: process.env.APP_MIN_VERSION || "0.1.0",
    latestVersion: process.env.APP_LATEST_VERSION || "0.1.0",
    apiHost: process.env.SITE_URL || "https://whyisee.xyz",
    featureFlags: {
      nativeFeed: process.env.APP_FLAG_NATIVE_FEED !== "0",
      nativeTopic: process.env.APP_FLAG_NATIVE_TOPIC !== "0",
      inAppNotifications: false,
      push: false,
    },
  });
});

/**
 * 列表页的分类筛选项。和网页左侧栏同源（categories 表），只返回空分类之外的部分，
 * 手机上一行长条也不至于塞进十几个点不出内容的分类。
 */
meta.get("/filters", async (c) => {
  const categories = await listCategories(langOf(c));

  // 分类很少变，让客户端和 CDN 缓存 5 分钟，不必每次进列表都拉
  c.header("cache-control", "public, max-age=300");

  return ok(c, {
    categories: categories
      .filter((category) => (category.topicCount ?? 0) > 0)
      .map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        color: category.color,
        topicCount: category.topicCount ?? 0,
      })),
  });
});

/**
 * 发布页用的选项：分类（含空分类，发帖时可选）+ 标签 + 话题类型。
 * 和 `/filters` 的差别只在于这里不按篇数过滤 —— 发帖时任何分类都得能选。
 */
meta.get("/taxonomy", async (c) => {
  const lang = langOf(c);
  const [categories, tags] = await Promise.all([listCategories(lang), listTags(lang)]);

  c.header("cache-control", "public, max-age=600");

  return ok(c, {
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      color: category.color,
    })),
    // 标签只给最常见的，避免手机上一屏几百个
    tags: tags.slice(0, 60).map((tag) => ({ id: tag.id, name: tag.name, slug: tag.slug })),
    types:
      lang === "en"
        ? [
            { id: "discussion", label: "Discussion" },
            { id: "question", label: "Question" },
            { id: "article", label: "Article" },
            { id: "project", label: "Project" },
            { id: "resource", label: "Resource" },
          ]
        : [
            { id: "discussion", label: "讨论" },
            { id: "question", label: "提问" },
            { id: "article", label: "文章" },
            { id: "project", label: "项目" },
            { id: "resource", label: "资源" },
          ],
  });
});

export default meta;
