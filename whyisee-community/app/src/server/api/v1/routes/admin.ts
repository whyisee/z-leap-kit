import { Hono } from "hono";
import { isAdmin } from "@lib/auth";
import { getTopicByIdForAdmin, updateTopicAdminState } from "@server/services/topics";
import { countPendingTopics, latestTopicVerdict, nextPendingTopicId } from "@server/services/reviewQueue";
import { fail, intParam, langOf, ok, type ApiEnv } from "../http";
import { requireAuth, sessionOf } from "../middleware";
import { toAuthor, toCategory, toTag } from "../serializers";

/**
 * App 端的少量管理动作。只做「手机上必须处理掉」的那几件 —— 审核队列。
 *
 * 其余后台（分类、标签、用户、邀请码、跑批任务）留在网页版：那些是坐着改的
 * 配置活，做成手机页只会两边都难用。
 */
const admin = new Hono<ApiEnv>();

admin.use("*", requireAuth);

admin.use("*", async (c, next) => {
  if (!isAdmin(sessionOf(c))) {
    return fail(c, "forbidden", "只有管理员能审核");
  }
  await next();
});

/**
 * 待审话题详情。
 *
 * 回的不只是内容：还带自动审核的结论和队列进度。审核的瓶颈从来不是「看不到
 * 正文」，而是「判断这一篇要花多久」——把 AI 预审理由摆在同一屏，通过/退回
 * 就是一次滑动的事。
 */
admin.get("/review/topics/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  if (id <= 0) return fail(c, "validation_failed", "话题 id 不合法");

  const topic = await getTopicByIdForAdmin(id, langOf(c));
  if (!topic) return fail(c, "not_found", "话题不存在");

  const [verdict, remaining, nextId] = await Promise.all([
    latestTopicVerdict(id),
    countPendingTopics(id),
    nextPendingTopicId(id),
  ]);

  return ok(
    c,
    {
      topic: {
        id: topic.id,
        title: topic.title,
        summary: topic.summary,
        contentHtml: topic.contentHtml,
        type: topic.type,
        status: topic.status,
        author: toAuthor(topic.author),
        category: toCategory(topic.category),
        tags: (topic.tags || []).map(toTag),
        createdAt: topic.createdAt,
        updatedAt: topic.updatedAt,
      },
      verdict,
      queue: { remaining, nextId },
    },
    { cache: "no-store" },
  );
});

/**
 * 审核动作。
 *
 * `publish` = 通过并发布；`draft` = 退回草稿（作者能改完再提交）。
 * 不做 `deleted`：删号式的判定不该由一次误触完成，网页后台才有这个入口。
 *
 * 返回队列信息，页面据此决定「继续下一条」还是「回列表」。
 */
admin.post("/review/topics/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  if (id <= 0) return fail(c, "validation_failed", "话题 id 不合法");

  let body: { action?: unknown } | undefined;
  try {
    body = (await c.req.json()) as { action?: unknown };
  } catch {
    body = undefined;
  }

  const action = String(body?.action || "");
  if (action !== "publish" && action !== "draft") {
    return fail(c, "validation_failed", "action 只能是 publish 或 draft");
  }

  const topic = await getTopicByIdForAdmin(id);
  if (!topic) return fail(c, "not_found", "话题不存在");

  // 已经发布过的不再走一遍：重复点会重写 published_at、重跑发布副作用
  if (action === "publish" && topic.status === "published") {
    return ok(c, { id, status: "published", queue: await queueAfter(id) });
  }

  await updateTopicAdminState(id, { status: action === "publish" ? "published" : "draft" });

  return ok(c, {
    id,
    status: action === "publish" ? "published" : "draft",
    queue: await queueAfter(id),
  });
});

async function queueAfter(id: number) {
  const [remaining, nextId] = await Promise.all([countPendingTopics(id), nextPendingTopicId(id)]);
  return { remaining, nextId };
}

export default admin;
