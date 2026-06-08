import { query, queryOne, withTransaction } from "@server/db/client";
import { AgentApiError } from "./agentErrors";
import type { AgentContext } from "./agents";

type AgentUiState = "online" | "busy" | "idle";
type TaskUiState = "open" | "running" | "reviewing" | "completed" | "closed";

interface AgentDirectoryRow {
  id: number;
  username: string;
  display_name: string;
  name: string;
  description: string;
  status: string;
  default_scopes: string;
  created_at: string;
  last_device_seen_at: string | null;
  last_action_at: string | null;
  last_run_at: string | null;
  device_count: string;
  run_count: string;
  success_count: string;
  avg_quality: number | null;
  active_assignment_count: string;
  current_task: string | null;
}

interface TaskRow {
  id: number;
  task_key: string | null;
  title: string;
  description: string;
  task_type: string;
  acceptance_criteria: string;
  submission_format: string;
  reward_policy_json: string;
  visibility: string;
  executor_type: string;
  result_destination: string;
  human_interaction_mode: string;
  status: string;
  priority: string;
  max_assignees: number;
  config_json: string;
  deadline_at: string | null;
  created_at: string;
  updated_at: string;
  assignment_count: string;
  submission_count: string;
  assignee_names: string | null;
}

interface SubmissionRow {
  id: number;
  task_id: number;
  title: string;
  status: string;
  submitted_at: string;
  submitter_name: string | null;
  score: number | null;
}

export interface AgentZoneStat {
  label: string;
  value: string;
}

export interface AgentZoneAgentCard {
  id: number;
  name: string;
  role: string;
  status: AgentUiState;
  owner: string;
  summary: string;
  skills: string[];
  metrics: Array<{ label: string; value: string }>;
  current: string;
  lastActive: string;
}

export interface AgentZoneCapability {
  capability: string;
  owner: string;
  state: string;
}

export interface AgentPlazaData {
  stats: AgentZoneStat[];
  agents: AgentZoneAgentCard[];
  capabilities: AgentZoneCapability[];
}

export interface AgentZoneTaskCard {
  id: number;
  title: string;
  type: string;
  status: string;
  state: TaskUiState;
  priority: string;
  reward: string;
  assignee: string;
  due: string;
  skills: string[];
  acceptance: string;
  submissionCount: number;
}

export interface AgentZoneTaskColumn {
  title: string;
  status: TaskUiState;
  items: AgentZoneTaskCard[];
}

export interface AgentZoneSubmissionSummary {
  agent: string;
  task: string;
  status: string;
  score: string;
}

export interface AgentTaskHallData {
  stats: AgentZoneStat[];
  columns: AgentZoneTaskColumn[];
  submissions: AgentZoneSubmissionSummary[];
}

export async function getAgentPlazaData(limit = 200): Promise<AgentPlazaData> {
  const rows = await query<AgentDirectoryRow>(
    `
    SELECT
      agent_profiles.id,
      users.username,
      users.display_name,
      agent_profiles.name,
      agent_profiles.description,
      agent_profiles.status,
      agent_profiles.default_scopes,
      agent_profiles.created_at,
      MAX(agent_devices.last_seen_at) AS last_device_seen_at,
      MAX(agent_action_logs.created_at) AS last_action_at,
      MAX(content_runs.created_at) AS last_run_at,
      COUNT(DISTINCT agent_devices.id)::text AS device_count,
      COUNT(DISTINCT content_runs.id)::text AS run_count,
      COUNT(DISTINCT CASE WHEN content_runs.status = 'success' THEN content_runs.id END)::text AS success_count,
      ROUND(AVG(content_runs.quality_score))::int AS avg_quality,
      COUNT(DISTINCT task_assignments.id)::text AS active_assignment_count,
      MAX(tasks.title) AS current_task
    FROM agent_profiles
    INNER JOIN users ON users.id = agent_profiles.user_id
    LEFT JOIN agent_devices ON agent_devices.agent_profile_id = agent_profiles.id AND agent_devices.status = 'active'
    LEFT JOIN agent_action_logs ON agent_action_logs.agent_profile_id = agent_profiles.id
    LEFT JOIN content_runs ON content_runs.agent_profile_id = agent_profiles.id
    LEFT JOIN task_assignments
      ON task_assignments.assignee_type = 'agent'
      AND task_assignments.assignee_id = agent_profiles.id
      AND task_assignments.status IN ('claimed', 'in_progress', 'submitted')
    LEFT JOIN tasks ON tasks.id = task_assignments.task_id
    WHERE agent_profiles.status = 'active'
    GROUP BY agent_profiles.id, users.username, users.display_name
    ORDER BY COALESCE(MAX(agent_action_logs.created_at), MAX(agent_devices.last_seen_at), MAX(content_runs.created_at), agent_profiles.created_at) DESC,
      agent_profiles.id DESC
    LIMIT $1
    `,
    [Math.max(1, Math.min(Number(limit || 200), 500))],
  );

  const agents = rows.map(mapAgentCard);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();
  const todayCompleted = await queryOne<{ count: string }>(
    `
    SELECT (
      (SELECT COUNT(*) FROM content_runs WHERE status = 'success' AND completed_at >= $1)
      +
      (SELECT COUNT(*) FROM task_submissions WHERE status = 'accepted' AND submitted_at >= $1)
    )::text AS count
    `,
    [todayIso],
  );
  const avgQuality = average(
    agents
      .map((agent) => Number(agent.metrics.find((item) => item.label === "质量")?.value || 0))
      .filter((value) => value > 0),
  );

  return {
    stats: [
      { label: "可见 Agent", value: String(agents.length) },
      { label: "在线", value: String(agents.filter((agent) => agent.status !== "idle").length) },
      { label: "今日完成", value: String(Number(todayCompleted?.count || 0)) },
      { label: "平均质量分", value: avgQuality ? String(avgQuality) : "0" },
    ],
    agents,
    capabilities: buildCapabilities(agents),
  };
}

export async function getAgentTaskHallData(): Promise<AgentTaskHallData> {
  const tasks = await listAgentZoneTasks();
  const submissions = await listAgentZoneSubmissionSummaries();

  const openCount = tasks.filter((task) => task.state === "open").length;
  const runningCount = tasks.filter((task) => task.state === "running").length;
  const reviewingCount = tasks.filter((task) => task.state === "reviewing").length;
  const archived = await queryOne<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM tasks WHERE visibility = 'agent_zone' AND status IN ('completed', 'closed')",
  );

  return {
    stats: [
      { label: "可领取", value: String(openCount) },
      { label: "执行中", value: String(runningCount) },
      { label: "待评审", value: String(reviewingCount) },
      { label: "已归档", value: String(Number(archived?.count || 0)) },
    ],
    columns: [
      { title: "可领取", status: "open", items: tasks.filter((task) => task.state === "open") },
      { title: "执行中", status: "running", items: tasks.filter((task) => task.state === "running") },
      { title: "待评审", status: "reviewing", items: tasks.filter((task) => task.state === "reviewing") },
    ],
    submissions,
  };
}

export async function listAgentZoneTasks(limit = 100): Promise<AgentZoneTaskCard[]> {
  const rows = await query<TaskRow>(
    `
    SELECT
      tasks.id,
      tasks.task_key,
      tasks.title,
      tasks.description,
      tasks.task_type,
      tasks.acceptance_criteria,
      tasks.submission_format,
      tasks.reward_policy_json,
      tasks.visibility,
      tasks.executor_type,
      tasks.result_destination,
      tasks.human_interaction_mode,
      tasks.status,
      tasks.priority,
      tasks.max_assignees,
      tasks.config_json,
      tasks.deadline_at,
      tasks.created_at,
      tasks.updated_at,
      COUNT(DISTINCT task_assignments.id)::text AS assignment_count,
      COUNT(DISTINCT task_submissions.id)::text AS submission_count,
      STRING_AGG(DISTINCT agent_profiles.name, ' / ') FILTER (
        WHERE task_assignments.status IN ('claimed', 'in_progress', 'submitted')
      ) AS assignee_names
    FROM tasks
    LEFT JOIN task_assignments ON task_assignments.task_id = tasks.id
    LEFT JOIN agent_profiles
      ON task_assignments.assignee_type = 'agent'
      AND task_assignments.assignee_id = agent_profiles.id
    LEFT JOIN task_submissions ON task_submissions.task_id = tasks.id
    WHERE tasks.visibility = 'agent_zone'
    GROUP BY tasks.id
    ORDER BY
      CASE tasks.status
        WHEN 'open' THEN 1
        WHEN 'in_progress' THEN 2
        WHEN 'reviewing' THEN 3
        WHEN 'completed' THEN 4
        ELSE 9
      END,
      CASE tasks.priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END,
      tasks.created_at DESC
    LIMIT $1
    `,
    [limit],
  );

  return rows.map(mapTaskCard);
}

export async function claimAgentZoneTask(agent: AgentContext, taskId: number) {
  return withTransaction(async (client) => {
    const taskResult = await client.query<TaskRow>(
      `
      SELECT
        tasks.*,
        '0' AS assignment_count,
        '0' AS submission_count,
        NULL AS assignee_names
      FROM tasks
      WHERE id = $1
      FOR UPDATE
      `,
      [taskId],
    );
    const task = taskResult.rows[0];

    if (!task) {
      throw new AgentApiError(404, "task_not_found", "Task not found.");
    }

    assertAgentCanUseTask(task);

    const existing = await client.query<{ id: number; status: string }>(
      `
      SELECT id, status
      FROM task_assignments
      WHERE task_id = $1
        AND assignee_type = 'agent'
        AND assignee_id = $2
        AND status IN ('claimed', 'in_progress', 'submitted')
      LIMIT 1
      `,
      [taskId, agent.agentProfileId],
    );

    if (existing.rows[0]) {
      return {
        assignmentId: existing.rows[0].id,
        status: existing.rows[0].status,
      };
    }

    const countResult = await client.query<{ count: string }>(
      `
      SELECT COUNT(*)::text AS count
      FROM task_assignments
      WHERE task_id = $1 AND status IN ('claimed', 'in_progress', 'submitted')
      `,
      [taskId],
    );

    if (Number(countResult.rows[0]?.count || 0) >= Number(task.max_assignees || 1)) {
      throw new AgentApiError(409, "task_full", "Task assignee limit reached.");
    }

    const now = new Date().toISOString();
    const assignment = await client.query<{ id: number }>(
      `
      INSERT INTO task_assignments (
        task_id, assignee_type, assignee_id, status, claimed_at, started_at, due_at
      )
      VALUES ($1, 'agent', $2, 'in_progress', $3, $3, $4)
      RETURNING id
      `,
      [taskId, agent.agentProfileId, now, task.deadline_at],
    );
    const assignmentId = assignment.rows[0]?.id;

    await client.query(
      `
      UPDATE tasks
      SET status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END,
        updated_at = $1
      WHERE id = $2
      `,
      [now, taskId],
    );
    await client.query(
      `
      INSERT INTO task_events (task_id, actor_type, actor_id, event_type, details_json, created_at)
      VALUES ($1, 'agent', $2, 'claimed', $3, $4)
      `,
      [taskId, agent.agentProfileId, JSON.stringify({ agentName: agent.agentName, assignmentId }), now],
    );

    return {
      assignmentId,
      status: "in_progress",
    };
  });
}

export async function submitAgentZoneTask(
  agent: AgentContext,
  taskId: number,
  input: {
    body: string;
    result?: Record<string, unknown>;
    attachments?: unknown[];
    source?: Record<string, unknown>;
    selfReview?: string;
  },
) {
  return withTransaction(async (client) => {
    const taskResult = await client.query<TaskRow>(
      `
      SELECT
        tasks.*,
        '0' AS assignment_count,
        '0' AS submission_count,
        NULL AS assignee_names
      FROM tasks
      WHERE id = $1
      FOR UPDATE
      `,
      [taskId],
    );
    const task = taskResult.rows[0];

    if (!task) {
      throw new AgentApiError(404, "task_not_found", "Task not found.");
    }

    assertAgentCanUseTask(task);

    const assignment = await client.query<{ id: number }>(
      `
      SELECT id
      FROM task_assignments
      WHERE task_id = $1
        AND assignee_type = 'agent'
        AND assignee_id = $2
        AND status IN ('claimed', 'in_progress', 'submitted')
      ORDER BY claimed_at DESC
      LIMIT 1
      `,
      [taskId, agent.agentProfileId],
    );
    const assignmentId = assignment.rows[0]?.id;

    if (!assignmentId) {
      throw new AgentApiError(409, "task_not_claimed", "Claim the task before submitting.");
    }

    const body = input.body.trim();

    if (!body) {
      throw new AgentApiError(400, "submission_body_required", "Submission body is required.");
    }

    const now = new Date().toISOString();
    const source = {
      agentName: agent.agentName,
      agentProfileId: agent.agentProfileId,
      credentialKind: agent.credentialKind,
      deviceId: agent.deviceId || null,
      ...(input.source || {}),
    };
    const submission = await client.query<{ id: number }>(
      `
      INSERT INTO task_submissions (
        task_id, assignment_id, submitter_type, submitter_id, body, result_json,
        attachments_json, source_json, status, self_review, submitted_at, updated_at
      )
      VALUES ($1, $2, 'agent', $3, $4, $5, $6, $7, 'submitted', $8, $9, $9)
      RETURNING id
      `,
      [
        taskId,
        assignmentId,
        agent.agentProfileId,
        body,
        JSON.stringify(input.result || {}),
        JSON.stringify(input.attachments || []),
        JSON.stringify(source),
        input.selfReview || "",
        now,
      ],
    );
    const submissionId = submission.rows[0]?.id;

    await client.query(
      "UPDATE task_assignments SET status = 'submitted', completed_at = $1 WHERE id = $2",
      [now, assignmentId],
    );
    await client.query("UPDATE tasks SET status = 'reviewing', updated_at = $1 WHERE id = $2", [now, taskId]);
    await client.query(
      `
      INSERT INTO task_events (task_id, actor_type, actor_id, event_type, details_json, created_at)
      VALUES ($1, 'agent', $2, 'submitted', $3, $4)
      `,
      [taskId, agent.agentProfileId, JSON.stringify({ agentName: agent.agentName, submissionId }), now],
    );

    return {
      submissionId,
      assignmentId,
      status: "submitted",
    };
  });
}

async function listAgentZoneSubmissionSummaries(): Promise<AgentZoneSubmissionSummary[]> {
  const rows = await query<SubmissionRow>(
    `
    SELECT
      task_submissions.id,
      task_submissions.task_id,
      tasks.title,
      task_submissions.status,
      task_submissions.submitted_at,
      agent_profiles.name AS submitter_name,
      task_reviews.score
    FROM task_submissions
    INNER JOIN tasks ON tasks.id = task_submissions.task_id
    LEFT JOIN agent_profiles
      ON task_submissions.submitter_type = 'agent'
      AND task_submissions.submitter_id = agent_profiles.id
    LEFT JOIN LATERAL (
      SELECT score
      FROM task_reviews
      WHERE task_reviews.submission_id = task_submissions.id
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    ) task_reviews ON TRUE
    WHERE tasks.visibility = 'agent_zone'
    ORDER BY task_submissions.submitted_at DESC, task_submissions.id DESC
    LIMIT 8
    `,
  );

  return rows.map((row) => ({
    agent: row.submitter_name || "unknown-agent",
    task: row.title,
    status: mapSubmissionState(row.status),
    score: typeof row.score === "number" ? String(row.score) : mapSubmissionScore(row.status),
  }));
}

function mapAgentCard(row: AgentDirectoryRow): AgentZoneAgentCard {
  const lastActivity = latestDate(row.last_action_at, row.last_device_seen_at, row.last_run_at, row.created_at);
  const activeAssignments = Number(row.active_assignment_count || 0);
  const state: AgentUiState = activeAssignments > 0 ? "busy" : isRecent(lastActivity, 30) ? "online" : "idle";
  const taskCount = Number(row.run_count || 0);
  const successCount = Number(row.success_count || 0);
  const quality = Number(row.avg_quality || 0);
  const passRate = taskCount > 0 ? Math.round((successCount / taskCount) * 100) : 0;

  return {
    id: row.id,
    name: row.name,
    role: inferAgentRole(row.name, row.description),
    status: state,
    owner: row.username || row.display_name || "system",
    summary: row.description || `${row.name} 还没有填写说明。`,
    skills: inferAgentSkills(row.name, row.default_scopes),
    metrics: [
      { label: "任务", value: String(taskCount) },
      { label: "质量", value: quality > 0 ? String(quality) : "0" },
      { label: "通过率", value: passRate > 0 ? `${passRate}%` : "0%" },
    ],
    current: row.current_task || (state === "idle" ? "等待任务" : "最近有 Agent API 活动"),
    lastActive: formatLastActive(lastActivity),
  };
}

function mapTaskCard(row: TaskRow): AgentZoneTaskCard {
  const reward = safeJsonParse<Record<string, unknown>>(row.reward_policy_json, {});
  const config = safeJsonParse<Record<string, unknown>>(row.config_json, {});
  const skills = Array.isArray(config.skills)
    ? config.skills.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  return {
    id: row.id,
    title: row.title,
    type: taskTypeLabel(row.task_type),
    status: row.status,
    state: mapTaskState(row.status),
    priority: row.priority || "P2",
    reward: String(reward.label || formatReward(reward)),
    assignee: row.assignee_names || "未领取",
    due: formatDeadline(row.deadline_at),
    skills,
    acceptance: row.acceptance_criteria || row.description,
    submissionCount: Number(row.submission_count || 0),
  };
}

function assertAgentCanUseTask(task: TaskRow) {
  if (task.visibility !== "agent_zone") {
    throw new AgentApiError(403, "task_visibility_forbidden", "This task is not in Agent Zone.");
  }

  if (task.executor_type !== "agent" && task.executor_type !== "user_or_agent" && task.executor_type !== "specific_agent") {
    throw new AgentApiError(403, "task_executor_forbidden", "This task does not allow agent execution.");
  }

  if (!["open", "in_progress", "reviewing"].includes(task.status)) {
    throw new AgentApiError(409, "task_not_accepting_work", "Task is not accepting work.");
  }
}

function buildCapabilities(agents: AgentZoneAgentCard[]): AgentZoneCapability[] {
  const byRole = new Map<string, AgentZoneCapability>();

  for (const agent of agents) {
    const state = agent.status === "idle" ? "观察中" : "稳定";
    if (!byRole.has(agent.role)) {
      byRole.set(agent.role, {
        capability: agent.role,
        owner: agent.name,
        state,
      });
    }
  }

  return [...byRole.values()].slice(0, 8);
}

function inferAgentRole(name: string, description: string) {
  const value = `${name} ${description}`.toLowerCase();

  if (value.includes("review") || value.includes("moderation") || value.includes("审核")) return "质量审核";
  if (value.includes("seo")) return "增长观察";
  if (value.includes("arena") || value.includes("judge") || value.includes("竞技")) return "竞技裁判";
  if (value.includes("skill")) return "Skill 管理";
  if (value.includes("feedback") || value.includes("project")) return "项目反馈";
  if (value.includes("reply")) return "回复协作";
  return "内容整理";
}

function inferAgentSkills(name: string, scopesJson: string) {
  const value = name.toLowerCase();
  const scopes = safeJsonParse<string[]>(scopesJson, []);
  const skills = new Set<string>();

  if (value.includes("seo")) {
    skills.add("seo-research");
    skills.add("content-brief");
  }
  if (value.includes("review") || value.includes("moderation")) {
    skills.add("quality-check");
    skills.add("moderation");
  }
  if (value.includes("skill")) {
    skills.add("skill-index");
    skills.add("practice-task");
  }
  if (value.includes("reply")) {
    skills.add("reply-context");
  }
  if (scopes.includes("topic:create")) skills.add("topic-create");
  if (scopes.includes("upload:image")) skills.add("image-upload");
  if (scopes.includes("review:suggest")) skills.add("review-suggest");
  if (scopes.includes("task:submit")) skills.add("task-submit");
  if (skills.size === 0) skills.add("agent-api");

  return [...skills].slice(0, 4);
}

function taskTypeLabel(type: string) {
  const labels: Record<string, string> = {
    content_summary: "内容整理",
    project_feedback: "项目反馈",
    research: "研究分析",
    duplicate_check: "搜索查重",
    moderation_suggestion: "审核建议",
    tag_cleanup: "标签整理",
    agent_skill_practice: "练习任务",
    arena_challenge: "竞技任务",
  };

  return labels[type] || type;
}

function mapTaskState(status: string): TaskUiState {
  if (status === "in_progress" || status === "claimed") return "running";
  if (status === "reviewing") return "reviewing";
  if (status === "completed") return "completed";
  if (status === "closed" || status === "cancelled" || status === "expired") return "closed";
  return "open";
}

function mapSubmissionState(status: string) {
  if (status === "accepted") return "accepted";
  if (status === "rejected") return "rejected";
  if (status === "archived") return "archived";
  return "reviewing";
}

function mapSubmissionScore(status: string) {
  if (status === "accepted") return "已通过";
  if (status === "rejected") return "未通过";
  if (status === "archived") return "已归档";
  return "待评审";
}

function formatReward(reward: Record<string, unknown>) {
  const amount = Number(reward.amount || 0);
  if (!amount) return "待配置";
  if (reward.rewardType === "agent_skill_credit") return `Skill credit +${amount}`;
  if (reward.rewardType === "agent_arena_score") return `竞技分 +${amount}`;
  return `质量分 +${amount}`;
}

function formatDeadline(value: string | null) {
  if (!value) return "未设置";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "未设置";
  }

  const now = new Date();
  const today = now.toDateString();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();
  const time = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(date);

  if (date.toDateString() === today) return `今日 ${time}`;
  if (date.toDateString() === tomorrow) return `明日 ${time}`;

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(date);
}

function formatLastActive(value: string) {
  const time = Date.parse(value);

  if (!Number.isFinite(time)) {
    return "未知";
  }

  const diffMs = Date.now() - time;
  const minutes = Math.max(0, Math.round(diffMs / 60000));

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;

  return `${Math.round(hours / 24)} d ago`;
}

function latestDate(...values: Array<string | null | undefined>) {
  const latest = values
    .map((value) => (value ? Date.parse(value) : Number.NaN))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a)[0];

  return latest ? new Date(latest).toISOString() : new Date(0).toISOString();
}

function isRecent(value: string, minutes: number) {
  const time = Date.parse(value);
  return Number.isFinite(time) && Date.now() - time <= minutes * 60 * 1000;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
