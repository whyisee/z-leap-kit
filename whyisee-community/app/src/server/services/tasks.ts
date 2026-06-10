import {
  DEFAULT_AGENT_TASK_TYPE,
  getAgentTaskTypeLabel,
  normalizeAgentTaskType,
} from "@lib/agentTaskTypes";
import { query, queryOne, withTransaction } from "@server/db/client";
import { AgentApiError } from "./agentErrors";
import type { AgentContext } from "./agents";

type AgentUiState = "online" | "busy" | "idle";
type TaskUiState = "draft" | "open" | "running" | "reviewing" | "completed" | "closed";
export type AdminTaskStatus = "draft" | "open" | "closed" | "cancelled" | "completed";

interface AgentTaskVisibilityOptions {
  includeDrafts?: boolean;
}

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

interface AdminTaskRow extends TaskRow {
  created_by_type: string;
  created_by_id: number | null;
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

interface TaskAssignmentDetailRow {
  id: number;
  assignee_type: string;
  assignee_id: number;
  status: string;
  claimed_at: string;
  started_at: string | null;
  due_at: string | null;
  completed_at: string | null;
  agent_name: string | null;
}

interface TaskSubmissionDetailRow {
  id: number;
  task_id: number;
  submitter_type: string;
  submitter_id: number;
  body: string;
  result_json: string;
  attachments_json: string;
  source_json: string;
  status: string;
  self_review: string;
  submitted_at: string;
  updated_at: string;
  agent_name: string | null;
  score: number | null;
  decision: string | null;
  review_comment: string | null;
}

interface AdminTaskSubmissionReviewRow {
  id: number;
  task_id: number;
  assignment_id: number | null;
  submitter_type: string;
  submitter_id: number;
  status: string;
  reward_policy_json: string;
  task_title: string;
}

interface TaskEventDetailRow {
  id: number;
  actor_type: string;
  actor_id: number | null;
  event_type: string;
  details_json: string;
  created_at: string;
  agent_name: string | null;
}

interface AgentDeviceSummaryRow {
  id: number;
  device_id: string;
  device_name: string;
  status: string;
  last_seen_at: string | null;
  created_at: string;
}

interface AgentRunSummaryRow {
  id: number;
  run_key: string;
  skill_version: string;
  task: string;
  status: string;
  output_summary: string;
  quality_score: number | null;
  created_at: string;
  completed_at: string | null;
}

interface AgentAssignmentSummaryRow {
  id: number;
  task_id: number;
  title: string;
  task_type: string;
  task_status: string;
  assignment_status: string;
  claimed_at: string;
  completed_at: string | null;
  submission_id: number | null;
  submission_status: string | null;
  submitted_at: string | null;
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
  statusLabel: string;
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
  tasks: AgentZoneTaskCard[];
  columns: AgentZoneTaskColumn[];
  submissions: AgentZoneSubmissionSummary[];
}

export interface AgentTaskDetailData {
  task: AgentZoneTaskCard & {
    taskKey: string;
    description: string;
    acceptanceCriteria: string;
    submissionFormat: string;
    executorType: string;
    resultDestination: string;
    humanInteractionMode: string;
    submissionVisibility: "public" | "private";
    canViewSubmissions: boolean;
    maxAssignees: number;
    createdAt: string;
    updatedAt: string;
  };
  stats: AgentZoneStat[];
  assignments: Array<{
    id: number;
    assigneeType: string;
    assigneeId: number;
    agentName: string;
    status: string;
    claimedAt: string;
    startedAt: string;
    dueAt: string;
    completedAt: string;
  }>;
  submissions: Array<{
    id: number;
    submitterType: string;
    submitterId: number;
    agentName: string;
    status: string;
    score: string;
    decision: string;
    canView: boolean;
    href: string | null;
    bodySummary: string;
    selfReview: string;
    submittedAt: string;
  }>;
  events: Array<{
    id: number;
    actorType: string;
    actorId: number | null;
    actorName: string;
    eventType: string;
    detail: string;
    createdAt: string;
  }>;
}

export interface AgentTaskSubmissionDetailData {
  task: AgentTaskDetailData["task"];
  submission: {
    id: number;
    taskId: number;
    submitterType: string;
    submitterId: number;
    agentName: string;
    rawStatus: string;
    status: string;
    score: string;
    decision: string;
    reviewComment: string;
    body: string;
    resultJson: string;
    attachmentsJson: string;
    sourceJson: string;
    selfReview: string;
    submittedAt: string;
    updatedAt: string;
  };
}

export type AdminTaskSubmissionReviewDecision = "accept" | "reject" | "needs_human";

export interface AdminTaskSubmissionReviewInput {
  reviewerId: number;
  decision: AdminTaskSubmissionReviewDecision;
  score?: number;
  comment?: string;
}

export interface AgentDetailData {
  agent: AgentZoneAgentCard;
  stats: AgentZoneStat[];
  devices: Array<{
    id: number;
    deviceId: string;
    deviceName: string;
    status: string;
    lastSeen: string;
    createdAt: string;
  }>;
  runs: Array<{
    id: number;
    runKey: string;
    skillVersion: string;
    task: string;
    status: string;
    outputSummary: string;
    qualityScore: string;
    createdAt: string;
  }>;
  assignments: Array<{
    id: number;
    taskId: number;
    title: string;
    type: string;
    taskStatus: string;
    assignmentStatus: string;
    claimedAt: string;
    completedAt: string;
    submissionId: number | null;
    submissionStatus: string;
    submittedAt: string;
  }>;
}

export interface AdminTaskListItem {
  id: number;
  taskKey: string;
  title: string;
  description: string;
  type: string;
  taskType: string;
  status: string;
  statusLabel: string;
  priority: string;
  maxAssignees: number;
  assignmentCount: number;
  submissionCount: number;
  reward: string;
  resultDestination: string;
  submissionVisibility: "public" | "private";
  skills: string[];
  deadlineAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTaskCreateInput {
  title: string;
  description: string;
  taskType: string;
  acceptanceCriteria: string;
  submissionFormat: string;
  status: AdminTaskStatus;
  priority: string;
  maxAssignees: number;
  resultDestination: string;
  humanInteractionMode: string;
  rewardType: string;
  rewardAmount: number;
  rewardLabel: string;
  skills: string[];
  submissionVisibility: "public" | "private";
  config?: Record<string, unknown>;
  deadlineAt?: string | null;
  createdById: number;
}

export interface AdminTaskEditData {
  id: number;
  title: string;
  description: string;
  taskType: string;
  acceptanceCriteria: string;
  submissionFormat: string;
  status: AdminTaskStatus;
  priority: string;
  maxAssignees: number;
  resultDestination: string;
  humanInteractionMode: string;
  rewardType: string;
  rewardAmount: number;
  rewardLabel: string;
  skills: string;
  submissionVisibility: "public" | "private";
  sourceContext: string;
  referenceUrl: string;
  configJson: string;
  deadlineAt: string;
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

export async function getAgentDetailData(id: number): Promise<AgentDetailData | null> {
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
      AND agent_profiles.id = $1
    GROUP BY agent_profiles.id, users.username, users.display_name
    LIMIT 1
    `,
    [id],
  );
  const row = rows[0];

  if (!row) {
    return null;
  }

  const agent = mapAgentCard(row);
  const [devices, runs, assignments] = await Promise.all([
    listAgentDevicesForDetail(id),
    listAgentRunsForDetail(id),
    listAgentAssignmentsForDetail(id),
  ]);

  return {
    agent,
    stats: [
      ...agent.metrics,
      { label: "设备", value: String(devices.length) },
    ],
    devices,
    runs,
    assignments,
  };
}

export async function getAgentTaskHallData(options: AgentTaskVisibilityOptions = {}): Promise<AgentTaskHallData> {
  const includeDrafts = Boolean(options.includeDrafts);
  const tasks = await listAgentZoneTasks(300, { includeDrafts });
  const submissions = await listAgentZoneSubmissionSummaries();

  const draftCount = tasks.filter((task) => task.state === "draft").length;
  const openCount = tasks.filter((task) => task.state === "open").length;
  const runningCount = tasks.filter((task) => task.state === "running").length;
  const reviewingCount = tasks.filter((task) => task.state === "reviewing").length;
  const archived = await queryOne<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM tasks WHERE visibility = 'agent_zone' AND status IN ('completed', 'closed')",
  );

  return {
    stats: [
      ...(includeDrafts ? [{ label: "草稿", value: String(draftCount) }] : []),
      { label: "可领取", value: String(openCount) },
      { label: "执行中", value: String(runningCount) },
      { label: "待评审", value: String(reviewingCount) },
      { label: "已归档", value: String(Number(archived?.count || 0)) },
    ],
    tasks,
    columns: [
      ...(includeDrafts ? [{ title: "草稿", status: "draft" as const, items: tasks.filter((task) => task.state === "draft") }] : []),
      { title: "可领取", status: "open", items: tasks.filter((task) => task.state === "open") },
      { title: "执行中", status: "running", items: tasks.filter((task) => task.state === "running") },
      { title: "待评审", status: "reviewing", items: tasks.filter((task) => task.state === "reviewing") },
    ],
    submissions,
  };
}

export async function listAgentZoneTasks(
  limit = 300,
  options: AgentTaskVisibilityOptions = {},
): Promise<AgentZoneTaskCard[]> {
  const normalizedLimit = Math.max(1, Math.min(Number(limit || 300), 500));
  const draftFilter = options.includeDrafts ? "" : "AND tasks.status <> 'draft'";
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
      ${draftFilter}
    GROUP BY tasks.id
    ORDER BY
      CASE tasks.status
        WHEN 'draft' THEN 0
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
    [normalizedLimit],
  );

  return rows.map(mapTaskCard);
}

export async function listAdminTasks(limit = 200): Promise<AdminTaskListItem[]> {
  const normalizedLimit = Math.max(1, Math.min(Number(limit || 200), 500));
  const rows = await query<AdminTaskRow>(
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
      tasks.created_by_type,
      tasks.created_by_id,
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
        WHEN 'draft' THEN 0
        WHEN 'open' THEN 1
        WHEN 'in_progress' THEN 2
        WHEN 'reviewing' THEN 3
        WHEN 'completed' THEN 4
        WHEN 'closed' THEN 5
        ELSE 9
      END,
      CASE tasks.priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END,
      tasks.created_at DESC
    LIMIT $1
    `,
    [normalizedLimit],
  );

  return rows.map(mapAdminTaskListItem);
}

export async function createAdminTask(input: AdminTaskCreateInput): Promise<number> {
  const title = input.title.trim();
  const description = input.description.trim();
  const acceptanceCriteria = input.acceptanceCriteria.trim();

  if (!title) {
    throw new Error("Task title is required.");
  }

  if (!description) {
    throw new Error("Task description is required.");
  }

  if (!acceptanceCriteria) {
    throw new Error("Task acceptance criteria is required.");
  }

  const now = new Date().toISOString();
  const config = {
    ...(input.config || {}),
    skills: input.skills,
    submissionVisibility: input.submissionVisibility,
  };
  const rewardPolicy = {
    rewardType: normalizeRewardType(input.rewardType),
    amount: Math.max(0, Math.round(input.rewardAmount || 0)),
    label: input.rewardLabel.trim() || undefined,
  };

  return withTransaction(async (client) => {
    const result = await client.query<{ id: number }>(
      `
      INSERT INTO tasks (
        task_key, title, description, task_type, acceptance_criteria, submission_format,
        reward_policy_json, visibility, executor_type, result_destination, human_interaction_mode,
        status, priority, max_assignees, created_by_type, created_by_id, config_json,
        deadline_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'agent_zone', 'agent', $8, $9, $10, $11, $12, 'admin', $13, $14, $15, $16, $16)
      RETURNING id
      `,
      [
        buildTaskKey(title),
        title,
        description,
        normalizeTaskType(input.taskType),
        acceptanceCriteria,
        normalizeSubmissionFormat(input.submissionFormat),
        JSON.stringify(rewardPolicy),
        normalizeResultDestination(input.resultDestination),
        normalizeHumanInteractionMode(input.humanInteractionMode),
        normalizeAdminTaskStatus(input.status),
        normalizePriority(input.priority),
        Math.max(1, Math.min(Math.round(input.maxAssignees || 1), 50)),
        input.createdById,
        JSON.stringify(config),
        input.deadlineAt || null,
        now,
      ],
    );
    const taskId = result.rows[0]?.id;

    if (!taskId) {
      throw new Error("Failed to create task.");
    }

    await client.query(
      `
      INSERT INTO task_events (task_id, actor_type, actor_id, event_type, details_json, created_at)
      VALUES ($1, 'admin', $2, $3, $4, $5)
      `,
      [
        taskId,
        input.createdById,
        normalizeAdminTaskStatus(input.status) === "open" ? "published" : "created",
        JSON.stringify({ status: normalizeAdminTaskStatus(input.status), source: "admin_tasks_ui" }),
        now,
      ],
    );

    return taskId;
  });
}

export async function getAdminTaskEditData(taskId: number): Promise<AdminTaskEditData | null> {
  const rows = await query<AdminTaskRow>(
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
      tasks.created_by_type,
      tasks.created_by_id,
      tasks.config_json,
      tasks.deadline_at,
      tasks.created_at,
      tasks.updated_at,
      '0' AS assignment_count,
      '0' AS submission_count,
      NULL AS assignee_names
    FROM tasks
    WHERE tasks.visibility = 'agent_zone'
      AND tasks.id = $1
    LIMIT 1
    `,
    [taskId],
  );
  const row = rows[0];

  return row ? mapAdminTaskEditData(row) : null;
}

export async function updateAdminTask(
  taskId: number,
  input: AdminTaskCreateInput,
): Promise<void> {
  const title = input.title.trim();
  const description = input.description.trim();
  const acceptanceCriteria = input.acceptanceCriteria.trim();

  if (!title) {
    throw new Error("Task title is required.");
  }

  if (!description) {
    throw new Error("Task description is required.");
  }

  if (!acceptanceCriteria) {
    throw new Error("Task acceptance criteria is required.");
  }

  const now = new Date().toISOString();
  const config = {
    ...(input.config || {}),
    skills: input.skills,
    submissionVisibility: input.submissionVisibility,
  };
  const rewardPolicy = {
    rewardType: normalizeRewardType(input.rewardType),
    amount: Math.max(0, Math.round(input.rewardAmount || 0)),
    label: input.rewardLabel.trim() || undefined,
  };

  await withTransaction(async (client) => {
    await client.query(
      `
      UPDATE tasks
      SET title = $1,
        description = $2,
        task_type = $3,
        acceptance_criteria = $4,
        submission_format = $5,
        reward_policy_json = $6,
        result_destination = $7,
        human_interaction_mode = $8,
        status = $9,
        priority = $10,
        max_assignees = $11,
        config_json = $12,
        deadline_at = $13,
        updated_at = $14
      WHERE id = $15 AND visibility = 'agent_zone'
      `,
      [
        title,
        description,
        normalizeTaskType(input.taskType),
        acceptanceCriteria,
        normalizeSubmissionFormat(input.submissionFormat),
        JSON.stringify(rewardPolicy),
        normalizeResultDestination(input.resultDestination),
        normalizeHumanInteractionMode(input.humanInteractionMode),
        normalizeAdminTaskStatus(input.status),
        normalizePriority(input.priority),
        Math.max(1, Math.min(Math.round(input.maxAssignees || 1), 50)),
        JSON.stringify(config),
        input.deadlineAt || null,
        now,
        taskId,
      ],
    );
    await client.query(
      `
      INSERT INTO task_events (task_id, actor_type, actor_id, event_type, details_json, created_at)
      VALUES ($1, 'admin', $2, 'updated', $3, $4)
      `,
      [
        taskId,
        input.createdById,
        JSON.stringify({
          status: normalizeAdminTaskStatus(input.status),
          priority: normalizePriority(input.priority),
          source: "agent_task_edit_ui",
        }),
        now,
      ],
    );
  });
}

export async function updateAdminTaskStatus(
  taskId: number,
  status: AdminTaskStatus,
  actorId: number,
): Promise<void> {
  const nextStatus = normalizeAdminTaskStatus(status);
  const now = new Date().toISOString();

  await withTransaction(async (client) => {
    await client.query(
      `
      UPDATE tasks
      SET status = $1, updated_at = $2
      WHERE id = $3 AND visibility = 'agent_zone'
      `,
      [nextStatus, now, taskId],
    );
    await client.query(
      `
      INSERT INTO task_events (task_id, actor_type, actor_id, event_type, details_json, created_at)
      VALUES ($1, 'admin', $2, 'status_changed', $3, $4)
      `,
      [taskId, actorId, JSON.stringify({ status: nextStatus, source: "admin_tasks_ui" }), now],
    );
  });
}

export async function getAgentTaskDetailData(
  id: number,
  options: AgentTaskVisibilityOptions = {},
): Promise<AgentTaskDetailData | null> {
  const draftFilter = options.includeDrafts ? "" : "AND tasks.status <> 'draft'";
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
      ${draftFilter}
      AND tasks.id = $1
    GROUP BY tasks.id
    LIMIT 1
    `,
    [id],
  );
  const row = rows[0];

  if (!row) {
    return null;
  }

  const task = mapTaskCard(row);
  const config = safeJsonParse<Record<string, unknown>>(row.config_json, {});
  const canViewSubmissions = canViewTaskSubmissions(row, config);
  const [assignments, submissions, events] = await Promise.all([
    listTaskAssignmentsForDetail(id),
    listTaskSubmissionsForDetail(id, canViewSubmissions),
    listTaskEventsForDetail(id),
  ]);

  return {
    task: {
      ...task,
      taskKey: row.task_key || `task-${row.id}`,
      description: row.description || "暂无任务说明。",
      acceptanceCriteria: row.acceptance_criteria || "暂无验收标准。",
      submissionFormat: row.submission_format || "markdown",
      executorType: row.executor_type,
      resultDestination: row.result_destination,
      humanInteractionMode: row.human_interaction_mode,
      submissionVisibility: canViewSubmissions ? "public" : "private",
      canViewSubmissions,
      maxAssignees: row.max_assignees,
      createdAt: formatDateTime(row.created_at),
      updatedAt: formatDateTime(row.updated_at),
    },
    stats: [
      { label: "状态", value: task.statusLabel },
      { label: "领取", value: `${assignments.length}/${row.max_assignees}` },
      { label: "提交", value: String(submissions.length) },
      { label: "截止", value: task.due },
    ],
    assignments,
    submissions,
    events,
  };
}

export async function getAgentTaskSubmissionDetailData(
  taskId: number,
  submissionId: number,
  options: { includePrivate?: boolean } = {},
): Promise<AgentTaskSubmissionDetailData | null> {
  const detail = await getAgentTaskDetailData(taskId);

  if (!detail || (!detail.task.canViewSubmissions && !options.includePrivate)) {
    return null;
  }

  const rows = await query<TaskSubmissionDetailRow>(
    `
    SELECT
      task_submissions.id,
      task_submissions.task_id,
      task_submissions.submitter_type,
      task_submissions.submitter_id,
      task_submissions.body,
      task_submissions.result_json,
      task_submissions.attachments_json,
      task_submissions.source_json,
      task_submissions.status,
      task_submissions.self_review,
      task_submissions.submitted_at,
      task_submissions.updated_at,
      agent_profiles.name AS agent_name,
      task_reviews.score,
      task_reviews.decision,
      task_reviews.comment AS review_comment
    FROM task_submissions
    LEFT JOIN agent_profiles
      ON task_submissions.submitter_type = 'agent'
      AND task_submissions.submitter_id = agent_profiles.id
    LEFT JOIN LATERAL (
      SELECT score, decision, comment
      FROM task_reviews
      WHERE task_reviews.submission_id = task_submissions.id
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    ) task_reviews ON TRUE
    WHERE task_submissions.task_id = $1
      AND task_submissions.id = $2
    LIMIT 1
    `,
    [taskId, submissionId],
  );
  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    task: detail.task,
    submission: mapTaskSubmissionDetail(row),
  };
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

export async function reviewTaskSubmissionAsAdmin(
  taskId: number,
  submissionId: number,
  input: AdminTaskSubmissionReviewInput,
) {
  const decision = normalizeAdminReviewDecision(input.decision);
  const score = normalizeAdminReviewScore(input.score, decision);
  const comment = String(input.comment || "").trim();

  return withTransaction(async (client) => {
    const result = await client.query<AdminTaskSubmissionReviewRow>(
      `
      SELECT
        task_submissions.id,
        task_submissions.task_id,
        task_submissions.assignment_id,
        task_submissions.submitter_type,
        task_submissions.submitter_id,
        task_submissions.status,
        tasks.reward_policy_json,
        tasks.title AS task_title
      FROM task_submissions
      INNER JOIN tasks ON tasks.id = task_submissions.task_id
      WHERE task_submissions.task_id = $1
        AND task_submissions.id = $2
      FOR UPDATE OF task_submissions
      LIMIT 1
      `,
      [taskId, submissionId],
    );
    const submission = result.rows[0];

    if (!submission) {
      throw new Error("Task submission not found.");
    }

    const now = new Date().toISOString();
    const resultStatus = decision === "accept"
      ? "accepted"
      : decision === "reject"
        ? "rejected"
        : "reviewing";
    const reviewComment = comment || defaultAdminReviewComment(decision);

    await client.query(
      `
      INSERT INTO task_reviews (
        task_id, submission_id, reviewer_type, reviewer_id, score, decision, comment, rubric_json, created_at
      )
      VALUES ($1, $2, 'user', $3, $4, $5, $6, $7, $8)
      `,
      [
        taskId,
        submissionId,
        input.reviewerId,
        score,
        decision,
        reviewComment,
        JSON.stringify({
          source: "manual_admin_review",
          resultStatus,
          adminUserId: input.reviewerId,
        }),
        now,
      ],
    );

    await client.query(
      "UPDATE task_submissions SET status = $1, updated_at = $2 WHERE id = $3",
      [resultStatus, now, submissionId],
    );

    if (decision === "accept" || decision === "reject") {
      await completeReviewedAssignment(client, submission.assignment_id, now);
    }

    if (decision === "accept") {
      await client.query(
        "UPDATE tasks SET status = 'completed', updated_at = $1 WHERE id = $2",
        [now, taskId],
      );
      await syncAcceptedReward(client, submission, now, reviewComment);
    } else {
      await revokeSubmissionRewards(client, submissionId, now);

      if (decision === "reject") {
        await client.query(
          `
          UPDATE tasks
          SET status = CASE
                WHEN EXISTS (
                  SELECT 1 FROM task_submissions
                  WHERE task_id = $2 AND status IN ('submitted', 'reviewing')
                ) THEN 'reviewing'
                ELSE 'open'
              END,
              updated_at = $1
          WHERE id = $2
          `,
          [now, taskId],
        );
      } else {
        await client.query("UPDATE tasks SET status = 'reviewing', updated_at = $1 WHERE id = $2", [now, taskId]);
      }
    }

    await client.query(
      `
      INSERT INTO task_events (task_id, actor_type, actor_id, event_type, details_json, created_at)
      VALUES ($1, 'user', $2, 'reviewed', $3, $4)
      `,
      [
        taskId,
        input.reviewerId,
        JSON.stringify({
          submissionId,
          decision,
          score,
          resultStatus,
          comment: reviewComment,
        }),
        now,
      ],
    );

    return {
      submissionId,
      status: resultStatus,
      decision,
      score,
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

async function listTaskAssignmentsForDetail(taskId: number): Promise<AgentTaskDetailData["assignments"]> {
  const rows = await query<TaskAssignmentDetailRow>(
    `
    SELECT
      task_assignments.id,
      task_assignments.assignee_type,
      task_assignments.assignee_id,
      task_assignments.status,
      task_assignments.claimed_at,
      task_assignments.started_at,
      task_assignments.due_at,
      task_assignments.completed_at,
      agent_profiles.name AS agent_name
    FROM task_assignments
    LEFT JOIN agent_profiles
      ON task_assignments.assignee_type = 'agent'
      AND task_assignments.assignee_id = agent_profiles.id
    WHERE task_assignments.task_id = $1
    ORDER BY task_assignments.claimed_at DESC, task_assignments.id DESC
    LIMIT 40
    `,
    [taskId],
  );

  return rows.map((row) => ({
    id: row.id,
    assigneeType: row.assignee_type,
    assigneeId: row.assignee_id,
    agentName: row.agent_name || `${row.assignee_type}#${row.assignee_id}`,
    status: assignmentStatusLabel(row.status),
    claimedAt: formatDateTime(row.claimed_at),
    startedAt: row.started_at ? formatDateTime(row.started_at) : "-",
    dueAt: row.due_at ? formatDateTime(row.due_at) : "-",
    completedAt: row.completed_at ? formatDateTime(row.completed_at) : "-",
  }));
}

async function listTaskSubmissionsForDetail(
  taskId: number,
  canView: boolean,
): Promise<AgentTaskDetailData["submissions"]> {
  const rows = await query<TaskSubmissionDetailRow>(
    `
    SELECT
      task_submissions.id,
      task_submissions.task_id,
      task_submissions.submitter_type,
      task_submissions.submitter_id,
      task_submissions.body,
      task_submissions.result_json,
      task_submissions.attachments_json,
      task_submissions.source_json,
      task_submissions.status,
      task_submissions.self_review,
      task_submissions.submitted_at,
      task_submissions.updated_at,
      agent_profiles.name AS agent_name,
      task_reviews.score,
      task_reviews.decision,
      task_reviews.comment AS review_comment
    FROM task_submissions
    LEFT JOIN agent_profiles
      ON task_submissions.submitter_type = 'agent'
      AND task_submissions.submitter_id = agent_profiles.id
    LEFT JOIN LATERAL (
      SELECT score, decision, comment
      FROM task_reviews
      WHERE task_reviews.submission_id = task_submissions.id
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    ) task_reviews ON TRUE
    WHERE task_submissions.task_id = $1
    ORDER BY task_submissions.submitted_at DESC, task_submissions.id DESC
    LIMIT 30
    `,
    [taskId],
  );

  return rows.map((row) => ({
    id: row.id,
    submitterType: row.submitter_type,
    submitterId: row.submitter_id,
    agentName: row.agent_name || `${row.submitter_type}#${row.submitter_id}`,
    rawStatus: row.status,
    status: submissionStatusLabel(row.status),
    score: typeof row.score === "number" ? String(row.score) : mapSubmissionScore(row.status),
    decision: row.decision || "-",
    canView,
    href: canView ? `/agent-zone/tasks/${row.task_id}/submissions/${row.id}` : null,
    bodySummary: compactText(row.body, 180),
    selfReview: compactText(row.self_review || "-", 120),
    submittedAt: formatDateTime(row.submitted_at),
  }));
}

async function listTaskEventsForDetail(taskId: number): Promise<AgentTaskDetailData["events"]> {
  const rows = await query<TaskEventDetailRow>(
    `
    SELECT
      task_events.id,
      task_events.actor_type,
      task_events.actor_id,
      task_events.event_type,
      task_events.details_json,
      task_events.created_at,
      agent_profiles.name AS agent_name
    FROM task_events
    LEFT JOIN agent_profiles
      ON task_events.actor_type = 'agent'
      AND task_events.actor_id = agent_profiles.id
    WHERE task_events.task_id = $1
    ORDER BY task_events.created_at DESC, task_events.id DESC
    LIMIT 30
    `,
    [taskId],
  );

  return rows.map((row) => {
    const detail = safeJsonParse<Record<string, unknown>>(row.details_json, {});
    const fallbackActor = row.actor_id ? `${row.actor_type}#${row.actor_id}` : row.actor_type;
    const actorName = row.agent_name || String(detail.agentName || fallbackActor);

    return {
      id: row.id,
      actorType: row.actor_type,
      actorId: row.actor_id,
      actorName,
      eventType: eventTypeLabel(row.event_type),
      detail: formatEventDetail(detail),
      createdAt: formatDateTime(row.created_at),
    };
  });
}

function mapTaskSubmissionDetail(row: TaskSubmissionDetailRow): AgentTaskSubmissionDetailData["submission"] {
  return {
    id: row.id,
    taskId: row.task_id,
    submitterType: row.submitter_type,
    submitterId: row.submitter_id,
    agentName: row.agent_name || `${row.submitter_type}#${row.submitter_id}`,
    rawStatus: row.status,
    status: submissionStatusLabel(row.status),
    score: typeof row.score === "number" ? String(row.score) : mapSubmissionScore(row.status),
    decision: row.decision || "-",
    reviewComment: row.review_comment || "-",
    body: row.body,
    resultJson: prettyJson(row.result_json),
    attachmentsJson: prettyJson(row.attachments_json),
    sourceJson: prettyJson(row.source_json),
    selfReview: row.self_review || "-",
    submittedAt: formatDateTime(row.submitted_at),
    updatedAt: formatDateTime(row.updated_at),
  };
}

async function listAgentDevicesForDetail(agentProfileId: number): Promise<AgentDetailData["devices"]> {
  const rows = await query<AgentDeviceSummaryRow>(
    `
    SELECT id, device_id, device_name, status, last_seen_at, created_at
    FROM agent_devices
    WHERE agent_profile_id = $1
    ORDER BY COALESCE(last_seen_at, created_at) DESC, id DESC
    LIMIT 20
    `,
    [agentProfileId],
  );

  return rows.map((row) => ({
    id: row.id,
    deviceId: row.device_id,
    deviceName: row.device_name,
    status: row.status,
    lastSeen: row.last_seen_at ? formatLastActive(row.last_seen_at) : "从未在线",
    createdAt: formatDateTime(row.created_at),
  }));
}

async function listAgentRunsForDetail(agentProfileId: number): Promise<AgentDetailData["runs"]> {
  const rows = await query<AgentRunSummaryRow>(
    `
    SELECT id, run_key, skill_version, task, status, output_summary, quality_score, created_at, completed_at
    FROM content_runs
    WHERE agent_profile_id = $1
    ORDER BY created_at DESC, id DESC
    LIMIT 12
    `,
    [agentProfileId],
  );

  return rows.map((row) => ({
    id: row.id,
    runKey: row.run_key,
    skillVersion: row.skill_version || "unknown",
    task: row.task,
    status: row.status,
    outputSummary: row.output_summary || "无输出摘要",
    qualityScore: typeof row.quality_score === "number" ? String(row.quality_score) : "-",
    createdAt: formatDateTime(row.completed_at || row.created_at),
  }));
}

async function listAgentAssignmentsForDetail(agentProfileId: number): Promise<AgentDetailData["assignments"]> {
  const rows = await query<AgentAssignmentSummaryRow>(
    `
    SELECT
      task_assignments.id,
      task_assignments.task_id,
      tasks.title,
      tasks.task_type,
      tasks.status AS task_status,
      task_assignments.status AS assignment_status,
      task_assignments.claimed_at,
      task_assignments.completed_at,
      task_submissions.id AS submission_id,
      task_submissions.status AS submission_status,
      task_submissions.submitted_at
    FROM task_assignments
    INNER JOIN tasks ON tasks.id = task_assignments.task_id
    LEFT JOIN LATERAL (
      SELECT id, status, submitted_at
      FROM task_submissions
      WHERE task_submissions.assignment_id = task_assignments.id
      ORDER BY submitted_at DESC, id DESC
      LIMIT 1
    ) task_submissions ON TRUE
    WHERE task_assignments.assignee_type = 'agent'
      AND task_assignments.assignee_id = $1
    ORDER BY task_assignments.claimed_at DESC, task_assignments.id DESC
    LIMIT 20
    `,
    [agentProfileId],
  );

  return rows.map((row) => ({
    id: row.id,
    taskId: row.task_id,
    title: row.title,
    type: taskTypeLabel(row.task_type),
    taskStatus: row.task_status,
    assignmentStatus: row.assignment_status,
    claimedAt: formatDateTime(row.claimed_at),
    completedAt: row.completed_at ? formatDateTime(row.completed_at) : "-",
    submissionId: row.submission_id,
    submissionStatus: row.submission_status || "-",
    submittedAt: row.submitted_at ? formatDateTime(row.submitted_at) : "-",
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
    statusLabel: taskStatusLabel(row.status),
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

function mapAdminTaskListItem(row: AdminTaskRow): AdminTaskListItem {
  const reward = safeJsonParse<Record<string, unknown>>(row.reward_policy_json, {});
  const config = safeJsonParse<Record<string, unknown>>(row.config_json, {});
  const skills = Array.isArray(config.skills)
    ? config.skills.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const canViewSubmissions = canViewTaskSubmissions(row, config);

  return {
    id: row.id,
    taskKey: row.task_key || `task-${row.id}`,
    title: row.title,
    description: compactText(row.description, 160),
    type: taskTypeLabel(row.task_type),
    taskType: row.task_type,
    status: row.status,
    statusLabel: taskStatusLabel(row.status),
    priority: row.priority || "P2",
    maxAssignees: row.max_assignees,
    assignmentCount: Number(row.assignment_count || 0),
    submissionCount: Number(row.submission_count || 0),
    reward: String(reward.label || formatReward(reward)),
    resultDestination: row.result_destination,
    submissionVisibility: canViewSubmissions ? "public" : "private",
    skills,
    deadlineAt: formatDeadline(row.deadline_at),
    createdAt: formatDateTime(row.created_at),
    updatedAt: formatDateTime(row.updated_at),
  };
}

function mapAdminTaskEditData(row: AdminTaskRow): AdminTaskEditData {
  const reward = safeJsonParse<Record<string, unknown>>(row.reward_policy_json, {});
  const config = safeJsonParse<Record<string, unknown>>(row.config_json, {});
  const skills = Array.isArray(config.skills)
    ? config.skills.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const sourceContext = String(config.sourceContext || "");
  const referenceUrl = String(config.referenceUrl || "");
  const advancedConfig = { ...config };

  delete advancedConfig.skills;
  delete advancedConfig.submissionVisibility;
  delete advancedConfig.submissionsVisibility;
  delete advancedConfig.publicSubmissions;
  delete advancedConfig.submissionsPublic;
  delete advancedConfig.allowPublicSubmissionView;
  delete advancedConfig.sourceContext;
  delete advancedConfig.referenceUrl;

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    taskType: normalizeTaskType(row.task_type),
    acceptanceCriteria: row.acceptance_criteria,
    submissionFormat: normalizeSubmissionFormat(row.submission_format),
    status: normalizeAdminTaskStatus(row.status),
    priority: normalizePriority(row.priority),
    maxAssignees: row.max_assignees,
    resultDestination: normalizeResultDestination(row.result_destination),
    humanInteractionMode: normalizeHumanInteractionMode(row.human_interaction_mode),
    rewardType: normalizeRewardType(String(reward.rewardType || "")),
    rewardAmount: Number(reward.amount || 0),
    rewardLabel: String(reward.label || ""),
    skills: skills.join(", "),
    submissionVisibility: canViewTaskSubmissions(row, config) ? "public" : "private",
    sourceContext,
    referenceUrl,
    configJson: Object.keys(advancedConfig).length > 0 ? JSON.stringify(advancedConfig, null, 2) : "",
    deadlineAt: formatDateTimeLocal(row.deadline_at),
  };
}

function canViewTaskSubmissions(row: TaskRow, config: Record<string, unknown>) {
  if (typeof config.publicSubmissions === "boolean") return config.publicSubmissions;
  if (typeof config.submissionsPublic === "boolean") return config.submissionsPublic;
  if (typeof config.allowPublicSubmissionView === "boolean") return config.allowPublicSubmissionView;

  const visibility = String(config.submissionVisibility || config.submissionsVisibility || "").trim();
  if (visibility === "public" || visibility === "agent_zone_public") return true;
  if (visibility === "private" || visibility === "hidden" || visibility === "admin_only") return false;

  return ["agent_artifacts", "topic_reply"].includes(row.result_destination);
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
  return getAgentTaskTypeLabel(type);
}

function normalizeTaskType(value: string) {
  return normalizeAgentTaskType(value || DEFAULT_AGENT_TASK_TYPE);
}

function normalizeAdminTaskStatus(value: string): AdminTaskStatus {
  if (value === "open" || value === "closed" || value === "cancelled" || value === "completed") return value;
  return "draft";
}

function normalizePriority(value: string) {
  if (value === "P0" || value === "P1" || value === "P3") return value;
  return "P2";
}

function normalizeSubmissionFormat(value: string) {
  const format = String(value || "").trim();
  const allowed = new Set([
    "markdown",
    "markdown_with_topic_link",
    "topic_link",
    "json",
    "url",
  ]);

  return allowed.has(format) ? format : "markdown";
}

function normalizeResultDestination(value: string) {
  const destination = String(value || "").trim();
  const allowed = new Set([
    "task_only",
    "agent_artifacts",
    "community_topic",
    "topic_reply",
    "moderation_queue",
  ]);

  return allowed.has(destination) ? destination : "agent_artifacts";
}

function normalizeHumanInteractionMode(value: string) {
  const mode = String(value || "").trim();
  if (mode === "normal" || mode === "ask_human") return mode;
  return "read_only";
}

function normalizeRewardType(value: string) {
  if (value === "agent_skill_credit" || value === "agent_arena_score") return value;
  return "agent_quality_score";
}

function normalizeAdminReviewDecision(value: string): AdminTaskSubmissionReviewDecision {
  if (value === "accept" || value === "reject") {
    return value;
  }

  return "needs_human";
}

function normalizeAdminReviewScore(value: unknown, decision: AdminTaskSubmissionReviewDecision) {
  const fallback = decision === "accept" ? 85 : decision === "reject" ? 30 : 50;
  const score = Number(value);

  if (!Number.isFinite(score)) {
    return fallback;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

function defaultAdminReviewComment(decision: AdminTaskSubmissionReviewDecision) {
  if (decision === "accept") return "人工审核通过。";
  if (decision === "reject") return "人工审核未通过。";
  return "保留人工复核。";
}

async function completeReviewedAssignment(
  client: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  assignmentId: number | null,
  now: string,
) {
  if (!assignmentId) {
    return;
  }

  await client.query(
    "UPDATE task_assignments SET status = 'completed', completed_at = COALESCE(completed_at, $1) WHERE id = $2",
    [now, assignmentId],
  );
}

async function syncAcceptedReward(
  client: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  submission: AdminTaskSubmissionReviewRow,
  now: string,
  reason: string,
) {
  const reward = safeJsonParse<Record<string, unknown>>(submission.reward_policy_json, {});
  const rewardType = normalizeRewardType(String(reward.rewardType || ""));
  const amount = Math.max(0, Math.round(Number(reward.amount || 0)));

  if (!amount) {
    return;
  }

  await client.query(
    `
    UPDATE reward_ledger
    SET status = 'revoked',
        reason = CASE WHEN reason = '' THEN '人工审核覆盖后撤销' ELSE reason END
    WHERE submission_id = $1
      AND status = 'granted'
      AND reward_type <> $2
    `,
    [submission.id, rewardType],
  );
  await client.query(
    `
    INSERT INTO reward_ledger (
      actor_type, actor_id, task_id, submission_id, reward_type, amount, reason, status, created_at
    )
    SELECT $1, $2, $3, $4, $5, $6, $7, 'granted', $8
    WHERE NOT EXISTS (
      SELECT 1
      FROM reward_ledger
      WHERE submission_id = $4
        AND reward_type = $5
        AND status = 'granted'
    )
    `,
    [
      submission.submitter_type,
      submission.submitter_id,
      submission.task_id,
      submission.id,
      rewardType,
      amount,
      reason || String(reward.label || `任务审核通过：${submission.task_title}`),
      now,
    ],
  );
}

async function revokeSubmissionRewards(
  client: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  submissionId: number,
  now: string,
) {
  await client.query(
    `
    UPDATE reward_ledger
    SET status = 'revoked',
        reason = CASE WHEN reason = '' THEN $2 ELSE reason END
    WHERE submission_id = $1
      AND status = 'granted'
    `,
    [submissionId, `人工审核撤销于 ${now}`],
  );
}

function buildTaskKey(title: string) {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "agent_task";
  const suffix = Date.now().toString(36);

  return `admin_${base}_${suffix}`;
}

function mapTaskState(status: string): TaskUiState {
  if (status === "draft") return "draft";
  if (status === "in_progress" || status === "claimed") return "running";
  if (status === "reviewing") return "reviewing";
  if (status === "completed") return "completed";
  if (status === "closed" || status === "cancelled" || status === "expired") return "closed";
  return "open";
}

function taskStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "草稿",
    open: "可领取",
    claimed: "已领取",
    in_progress: "执行中",
    reviewing: "待评审",
    completed: "已完成",
    closed: "已关闭",
    cancelled: "已取消",
    expired: "已过期",
  };

  return labels[status] || status;
}

function assignmentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    claimed: "已领取",
    in_progress: "执行中",
    submitted: "已提交",
    completed: "已完成",
    cancelled: "已取消",
  };

  return labels[status] || status;
}

function submissionStatusLabel(status: string) {
  const labels: Record<string, string> = {
    submitted: "已提交",
    reviewing: "待评审",
    accepted: "已通过",
    rejected: "未通过",
    archived: "已归档",
  };

  return labels[status] || status;
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

function eventTypeLabel(type: string) {
  const labels: Record<string, string> = {
    created: "创建任务",
    updated: "更新任务",
    claimed: "领取任务",
    submitted: "提交结果",
    reviewed: "评审结果",
    accepted: "验收通过",
    rejected: "验收未通过",
    closed: "关闭任务",
  };

  return labels[type] || type;
}

function formatEventDetail(detail: Record<string, unknown>) {
  if (typeof detail.submissionId === "number") return `submission #${detail.submissionId}`;
  if (typeof detail.assignmentId === "number") return `assignment #${detail.assignmentId}`;
  if (typeof detail.reason === "string" && detail.reason.trim()) return detail.reason.trim();
  return "事件已记录";
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

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(date);
}

function formatDateTimeLocal(value: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
    timeZone: "Asia/Shanghai",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "00";

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function compactText(value: string, limit: number) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "-";
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3))}...`;
}

function prettyJson(value: string) {
  const parsed = safeJsonParse<unknown>(value, null);

  if (parsed === null || parsed === undefined) {
    return value || "{}";
  }

  return JSON.stringify(parsed, null, 2);
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
