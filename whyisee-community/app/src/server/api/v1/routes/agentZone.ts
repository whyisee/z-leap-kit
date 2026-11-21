import { Hono } from "hono";
import { isAdmin } from "@lib/auth";
import {
  createAdminTask,
  getAgentAcademyData,
  getAgentDetailData,
  getAgentPlazaData,
  getAgentTaskDetailData,
  getAgentTaskHallData,
} from "@server/services/tasks";
import { fail, intParam, ok, type ApiEnv } from "../http";
import { optionalAuth, requireAuth, sessionOf } from "../middleware";

/**
 * Agent 专区的三个数据页：广场（谁在跑）、学院（用什么 Skill）、任务（在做什么）。
 *
 * 网页版这四个 section 里还有「竞技 / 作品 / 规则 / 实验」，那几页目前是纯骨架
 * （服务层没有对应数据），app 端不做空壳页面，只在专区首页写明它们还在建设。
 *
 * 字段是一比一从服务层搬过来的，只砍掉了 href —— 那是网页路径，
 * 手机上没有对应的原生页，传过去只会让客户端拼出一个 404。
 */
const agentZone = new Hono<ApiEnv>();

agentZone.use("*", optionalAuth);

agentZone.get("/plaza", async (c) => {
  const data = await getAgentPlazaData();

  return ok(c, {
    stats: data.stats,
    agents: data.agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      status: agent.status,
      owner: agent.owner,
      summary: agent.summary,
      skills: agent.skills,
      metrics: agent.metrics,
      current: agent.current,
      lastActive: agent.lastActive,
    })),
    capabilities: data.capabilities,
  });
});

agentZone.get("/academy", async (c) => {
  // 管理员能看见未发布的 Skill，判断沿用网页那一套 isAdmin(session)
  const session = sessionOf(c);
  const data = await getAgentAcademyData({ includeUnpublished: isAdmin(session) });

  return ok(c, {
    stats: data.stats,
    skills: data.skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      kind: skill.kind,
      summary: skill.summary,
      status: skill.status,
      sourceLabel: skill.sourceLabel,
      taskCount: skill.taskCount,
      agentCount: skill.agentCount,
      runCount: skill.runCount,
      successRate: skill.successRate,
      qualityScore: skill.qualityScore,
      lastUsedAt: skill.lastUsedAt,
      relatedTasks: skill.relatedTasks.map((task) => ({ id: task.id, title: task.title })),
      files: skill.files.map((file) => ({ label: file.label, path: file.path })),
    })),
    practiceTasks: data.practiceTasks.map((task) => ({
      id: task.id,
      title: task.title,
      type: task.type,
      status: task.status,
      priority: task.priority,
      acceptance: task.acceptance,
      due: task.due,
    })),
  });
});

agentZone.get("/tasks", async (c) => {
  const session = sessionOf(c);
  const data = await getAgentTaskHallData({ includeDrafts: isAdmin(session) });

  return ok(c, {
    stats: data.stats,
    tasks: data.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      type: task.type,
      statusLabel: task.statusLabel,
      priority: task.priority,
      reward: task.reward,
      assignee: task.assignee,
      due: task.due,
      skills: task.skills,
      acceptance: task.acceptance,
      submissionCount: task.submissionCount,
    })),
    submissions: data.submissions,
  });
});

/**
 * 单个 Agent 的身份页：摘要 + 指标 + 设备 + 最近运行 + 领过的任务。
 *
 * `devices` 里只给设备名和最后在线，不给 deviceId —— 那是一串内部标识，
 * 手机上没有可以拿它去查的地方。
 */
agentZone.get("/agents/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  if (id <= 0) return fail(c, "validation_failed", "Agent id 不合法");

  const data = await getAgentDetailData(id);
  if (!data) return fail(c, "not_found", "找不到这个 Agent");

  return ok(c, {
    agent: {
      id: data.agent.id,
      name: data.agent.name,
      role: data.agent.role,
      status: data.agent.status,
      owner: data.agent.owner,
      summary: data.agent.summary,
      skills: data.agent.skills,
      metrics: data.agent.metrics,
      current: data.agent.current,
      lastActive: data.agent.lastActive,
    },
    stats: data.stats,
    devices: data.devices.map((device) => ({
      id: device.id,
      deviceName: device.deviceName,
      status: device.status,
      lastSeen: device.lastSeen,
      createdAt: device.createdAt,
    })),
    runs: data.runs.map((run) => ({
      id: run.id,
      runKey: run.runKey,
      skillVersion: run.skillVersion,
      task: run.task,
      status: run.status,
      outputSummary: run.outputSummary,
      qualityScore: run.qualityScore,
      createdAt: run.createdAt,
    })),
    assignments: data.assignments.map((item) => ({
      id: item.id,
      taskId: item.taskId,
      title: item.title,
      type: item.type,
      taskStatus: item.taskStatus,
      assignmentStatus: item.assignmentStatus,
      claimedAt: item.claimedAt,
      completedAt: item.completedAt,
      submissionId: item.submissionId,
      submissionStatus: item.submissionStatus,
      submittedAt: item.submittedAt,
    })),
  });
});

/**
 * 任务详情：说明、验收标准、领取记录、提交结果、事件流。
 *
 * 提交项的 `href` 指向网页的提交详情页，app 里没有这一页，传过去只会 404 ——
 * 客户端只看摘要和得分，要看全文回网页。
 */
agentZone.get("/tasks/:id", async (c) => {
  const id = intParam(c.req.param("id"));
  if (id <= 0) return fail(c, "validation_failed", "任务 id 不合法");

  const session = sessionOf(c);
  const data = await getAgentTaskDetailData(id, { includeDrafts: isAdmin(session) });
  if (!data) return fail(c, "not_found", "找不到这个任务");

  return ok(c, {
    task: data.task,
    stats: data.stats,
    assignments: data.assignments,
    submissions: data.submissions.map((item) => ({
      id: item.id,
      submitterType: item.submitterType,
      agentName: item.agentName,
      status: item.status,
      score: item.score,
      decision: item.decision,
      bodySummary: item.bodySummary,
      selfReview: item.selfReview,
      submittedAt: item.submittedAt,
    })),
    events: data.events,
  });
});

/**
 * 发任务：只有管理员。
 *
 * 网页那张表单是 form 编码 + 303 跳回，app 走 JSON，但必填项必须一样严 ——
 * 少校验一项，就会出现「app 发出去的任务网页打不开」。
 */
agentZone.post("/tasks", requireAuth, async (c) => {
  const session = c.get("session");

  if (!isAdmin(session)) {
    return fail(c, "forbidden", "只有管理员能发任务");
  }

  const body = await readJson(c.req.raw);
  const title = String(body?.title || "").trim();
  const description = String(body?.description || "").trim();
  const acceptanceCriteria = String(body?.acceptanceCriteria || "").trim();

  if (title.length < 4) return fail(c, "validation_failed", "任务标题至少 4 个字");
  if (description.length < 10) return fail(c, "validation_failed", "任务说明至少 10 个字");
  if (acceptanceCriteria.length < 4) return fail(c, "validation_failed", "请写清验收标准");

  const status = body?.status === "draft" ? "draft" : "open";
  const skills = ((Array.isArray(body?.skills) ? body.skills : []) as unknown[])
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 12);

  try {
    const id = await createAdminTask({
      title,
      description,
      acceptanceCriteria,
      taskType: String(body?.taskType || "site_content_expansion"),
      submissionFormat: String(body?.submissionFormat || ""),
      status,
      priority: String(body?.priority || "P2"),
      maxAssignees: Number(body?.maxAssignees || 1),
      resultDestination: String(body?.resultDestination || ""),
      humanInteractionMode: String(body?.humanInteractionMode || "read_only"),
      rewardType: String(body?.rewardType || "agent_quality_score"),
      rewardAmount: Number(body?.rewardAmount || 0),
      rewardLabel: String(body?.rewardLabel || ""),
      skills,
      submissionVisibility: body?.submissionVisibility === "private" ? "private" : "public",
      deadlineAt: readDeadline(body?.deadlineAt),
      createdById: session.userId,
    });

    return ok(c, { id, status });
  } catch (error) {
    console.error("Failed to create task from app", error);
    return fail(c, "server_error", "任务没建成，稍后再试");
  }
});

async function readJson(request: Request): Promise<Record<string, unknown> | undefined> {
  try {
    const parsed = await request.json();
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

/** 截止时间允许空；传了就必须能解析，否则「2026-13-45」会静默变成 null */
function readDeadline(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default agentZone;
