import { Hono } from "hono";
import { isAdmin } from "@lib/auth";
import {
  getAgentAcademyData,
  getAgentPlazaData,
  getAgentTaskHallData,
} from "@server/services/tasks";
import { ok, type ApiEnv } from "../http";
import { optionalAuth, sessionOf } from "../middleware";

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

export default agentZone;
