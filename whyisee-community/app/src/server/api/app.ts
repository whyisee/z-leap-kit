import { Hono } from "hono";
import { getLangFromRequest, t } from "@lib/i18n";
import type { TopicType } from "@lib/types";
import { listCategories, listTags } from "@server/services/categories";
import { getTopicById, listTopics } from "@server/services/topics";
import v1 from "./v1/index";

const app = new Hono();

// app 专用协议层。与下面这些老端点并存：老的给网页和外部 agent 用，不改。
app.route("/api/v1", v1);

app.get("/api/health", (context) => {
  return context.json({
    ok: true,
    name: "whyisee-community",
    time: new Date().toISOString(),
  });
});

app.get("/api/categories", async (context) => {
  const lang = getLangFromRequest(context.req.raw);

  return context.json({
    data: await listCategories(lang),
  });
});

app.get("/api/tags", async (context) => {
  const lang = getLangFromRequest(context.req.raw);

  return context.json({
    data: await listTags(lang),
  });
});

app.get("/api/topics", async (context) => {
  const lang = getLangFromRequest(context.req.raw);
  const categorySlug = context.req.query("category") || undefined;
  const tagSlug = context.req.query("tag") || undefined;
  const requestedType = context.req.query("type");
  const type = isTopicType(requestedType) ? requestedType : undefined;
  const limit = Number(context.req.query("limit") || 20);

  return context.json({
    data: await listTopics({
      categorySlug,
      tagSlug,
      type,
      limit: Number.isFinite(limit) ? limit : 20,
      lang,
    }),
  });
});

app.get("/api/topics/:id", async (context) => {
  const lang = getLangFromRequest(context.req.raw);
  const topic = await getTopicById(Number(context.req.param("id")), lang);

  if (!topic) {
    return context.json({ error: t(lang, "topic.notFound") }, 404);
  }

  return context.json({
    data: topic,
  });
});

export default app;

function isTopicType(value: string | undefined): value is TopicType {
  return (
    value === "discussion" ||
    value === "question" ||
    value === "article" ||
    value === "project" ||
    value === "resource" ||
    value === "announcement"
  );
}
