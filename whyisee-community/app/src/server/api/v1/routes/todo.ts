import { Hono } from "hono";
import { execute, query } from "@server/db/client";
import { fail, ok, type ApiEnv } from "../http";
import { sessionOf } from "../middleware";

const todo = new Hono<ApiEnv>();

/** 只看最近 30 天：再早的提醒已经没有处理价值，全量翻出来只会让列表变噪音。 */
const windowDays = 30;

/** 这几类通知的共同点：有人在跟你说话，需要你接话。 */
const replyTypes = ["topic_reply", "post_reply", "bot_reply", "bot_post_reply", "mention"];

interface NotificationRow {
  id: number;
  type: string;
  title: string;
  body: string;
  href: string;
  read_at: string | null;
  created_at: string;
  actor_username: string | null;
  actor_name: string | null;
  actor_avatar_url: string | null;
}

interface SubmissionRow {
  id: number;
  task_id: number;
  task_title: string;
  submitted_at: string;
  submitter_name: string | null;
  submitter_avatar_url: string | null;
}

interface TodoItem {
  id: string;
  kind: string;
  /** 一句话说明发生了什么，例如「李明 回复了你的话题」 */
  reason: string;
  /** 指向的对象标题（帖子标题 / 任务名） */
  title: string;
  /** 让用户知道点下去会做什么 */
  actionLabel: string;
  href: string;
  topicId: number | null;
  actorName: string | null;
  actorAvatarUrl: string | null;
  unread: boolean;
  at: string;
}

/**
 * 「出发」= 我该做的事。
 *
 * 和「看见」的根本差别：看见推的是**别人的内容**，这里列的是**你自己的待办** ——
 * 数据来自通知表和任务提交表，不是话题推荐，所以不可能长成第二个信息流。
 */
todo.get("/", async (c) => {
  const session = sessionOf(c);
  if (!session) return fail(c, "unauthorized", "请先登录");

  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  const [notifications, submissions] = await Promise.all([
    query<NotificationRow>(
      `
      SELECT n.id, n.type, n.title, n.body, n.href, n.read_at, n.created_at,
             u.username AS actor_username,
             u.display_name AS actor_name,
             u.avatar_url AS actor_avatar_url
      FROM notifications n
      LEFT JOIN users u ON u.id = n.actor_id
      WHERE n.user_id = $1
        AND n.created_at >= $2
        AND n.type = ANY($3::text[])
      ORDER BY n.created_at DESC
      LIMIT 120
      `,
      [session.userId, since, [...replyTypes, "topic_followed_activity"]],
    ),
    // 我发起的任务有人交了东西，等我验收 —— 这条通知表里没有，只能查提交表
    query<SubmissionRow>(
      `
      SELECT s.id, s.task_id, s.submitted_at,
             t.title AS task_title,
             COALESCE(NULLIF(u.display_name, ''), u.username) AS submitter_name,
             u.avatar_url AS submitter_avatar_url
      FROM task_submissions s
      INNER JOIN tasks t ON t.id = s.task_id
      LEFT JOIN users u ON u.id = s.submitter_id AND s.submitter_type = 'user'
      WHERE t.created_by_type = 'user'
        AND t.created_by_id = $1
        AND s.status IN ('submitted', 'pending', 'in_review')
      ORDER BY s.submitted_at DESC
      LIMIT 50
      `,
      [session.userId],
    ),
  ]);

  const replies: TodoItem[] = [];
  const followed: TodoItem[] = [];

  for (const row of notifications) {
    const actor = row.actor_name || row.actor_username || "有人";
    const isMention = row.type === "mention";
    const isFollowed = row.type === "topic_followed_activity";

    const item: TodoItem = {
      id: `n-${row.id}`,
      kind: isFollowed ? "followed" : "reply",
      reason: isFollowed
        ? `${actor} 回了你关注的话题`
        : isMention
          ? `${actor} 在回复里提到了你`
          : `${actor} ${replyReason(row.type)}`,
      title: row.body || row.title,
      actionLabel: isFollowed ? "去看看" : "去回复",
      href: row.href || "/",
      topicId: readTopicId(row.href),
      actorName: actor,
      actorAvatarUrl: row.actor_avatar_url,
      unread: row.read_at === null,
      at: row.created_at,
    };

    if (isFollowed) {
      followed.push(item);
    } else {
      replies.push(item);
    }
  }

  const reviews: TodoItem[] = submissions.map((row) => ({
    id: `s-${row.id}`,
    kind: "review",
    reason: `${row.submitter_name || "有人"} 提交了你的任务`,
    title: row.task_title,
    actionLabel: "去验收",
    href: `/agent-zone/tasks/${row.task_id}`,
    topicId: null,
    actorName: row.submitter_name,
    actorAvatarUrl: row.submitter_avatar_url,
    unread: true,
    at: row.submitted_at,
  }));

  const groups = [
    buildGroup("reply", "等你回应", replies),
    buildGroup("review", "等你验收", reviews),
    buildGroup("followed", "你关注的在动", followed),
  ].filter((group) => group.count > 0);

  return ok(c, {
    summary: {
      total: replies.length + reviews.length + followed.length,
      unread: [...replies, ...reviews, ...followed].filter((item) => item.unread).length,
      // 需要动手的两组，头部文案用它
      actionable: replies.length + reviews.length,
    },
    groups,
  });
});

/**
 * 点开一条待办后把它标为已读。
 *
 * 不做这一步的话，用户从帖子回到列表下拉刷新，那一条又会冒出来 ——
 * 「处理完了」就变成假的。任务提交类没有已读状态，直接忽略。
 */
todo.post("/read", async (c) => {
  const session = sessionOf(c);
  if (!session) return fail(c, "unauthorized", "请先登录");

  let body: { ids?: unknown } | undefined;
  try {
    body = (await c.req.json()) as { ids?: unknown };
  } catch {
    body = undefined;
  }

  const ids = Array.isArray(body?.ids)
    ? body!.ids!
        .map((id) => Number(String(id).replace(/^n-/, "")))
        .filter((id) => Number.isInteger(id) && id > 0)
        .slice(0, 50)
    : [];

  if (ids.length === 0) return ok(c, { accepted: 0 });

  await execute(
    `
    UPDATE notifications
    SET read_at = $1
    WHERE user_id = $2 AND id = ANY($3::int[]) AND read_at IS NULL
    `,
    [new Date().toISOString(), session.userId, ids],
  );

  return ok(c, { accepted: ids.length });
});

function buildGroup(key: string, label: string, items: TodoItem[]) {
  return { key, label, count: items.length, items };
}

function replyReason(type: string): string {
  switch (type) {
    case "post_reply":
    case "bot_post_reply":
      return "回复了你的评论";
    case "bot_reply":
      return "用 AI 回了你的帖子";
    default:
      return "回复了你的话题";
  }
}

/** `/t/79#post-123` → 79；拿不到就交给客户端按 href 走网页容器。 */
function readTopicId(href: string): number | null {
  const matched = /^\/t\/(\d+)/.exec(href || "");
  if (!matched) return null;
  const id = Number(matched[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export default todo;
