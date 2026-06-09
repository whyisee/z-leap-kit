import { createHash, randomBytes } from "node:crypto";
import { query, queryOne } from "@server/db/client";
import { AgentApiError } from "./agentErrors";
import {
  normalizeScopes,
  type AgentScope,
} from "./agentScopes";
import { authenticateUserAgentDeviceRequest } from "./userAgentDevices";

export const agentSkillVersion = "whyisee-content-agent@0.2.0";
export { agentScopes, normalizeScopes, type AgentScope } from "./agentScopes";
export { AgentApiError } from "./agentErrors";

export interface AgentContext {
  agentProfileId: number;
  agentName: string;
  tokenId: number | null;
  tokenName: string;
  userId: number;
  username: string;
  displayName: string;
  role: "admin" | "moderator" | "member" | "new_user";
  scopes: AgentScope[];
  rateLimitPerHour: number;
  credentialKind: "profile_token" | "user_device";
  agentDeviceRecordId?: number;
  deviceId?: string;
  deviceName?: string;
}

export interface AgentProfile {
  id: number;
  userId: number;
  username: string;
  displayName: string;
  name: string;
  description: string;
  status: "active" | "disabled";
  defaultScopes: AgentScope[];
  rateLimitPerHour: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentToken {
  id: number;
  agentProfileId: number;
  agentName: string;
  tokenPrefix: string;
  name: string;
  scopes: AgentScope[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreatedAgentToken {
  token: string;
  record: AgentToken;
}

export interface AgentRun {
  id: number;
  runKey: string;
  agentProfileId: number;
  agentName: string;
  skillVersion: string;
  task: string;
  status: string;
  inputSummary: string;
  outputSummary: string;
  qualityScore: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  completedAt: string | null;
}

export interface AgentActionLog {
  id: number;
  agentProfileId: number;
  agentName: string;
  tokenId: number | null;
  agentDeviceId: number | null;
  deviceId: string | null;
  action: string;
  resourceType: string;
  resourceId: number | null;
  status: string;
  requestSummary: string;
  responseSummary: string;
  ipAddress: string | null;
  userAgent: string | null;
  idempotencyKey: string | null;
  createdAt: string;
}

export interface AgentSource {
  itemId: number;
  itemType: string;
  agentName: string;
  runKey: string;
  skillVersion: string;
  qualityScore: number | null;
  status: string;
}

interface AgentAuthRow {
  token_id: number;
  token_name: string;
  token_scopes: string;
  agent_profile_id: number;
  agent_name: string;
  rate_limit_per_hour: number;
  user_id: number;
  username: string;
  display_name: string;
  role: AgentContext["role"];
}

interface AgentProfileRow {
  id: number;
  user_id: number;
  username: string;
  display_name: string;
  name: string;
  description: string;
  status: "active" | "disabled";
  default_scopes: string;
  rate_limit_per_hour: number;
  created_at: string;
  updated_at: string;
}

interface AgentTokenRow {
  id: number;
  agent_profile_id: number;
  agent_name: string;
  token_prefix: string;
  name: string;
  scopes: string;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

interface AgentRunRow {
  id: number;
  run_key: string;
  agent_profile_id: number;
  agent_name: string;
  skill_version: string;
  task: string;
  status: string;
  input_summary: string;
  output_summary: string;
  quality_score: number | null;
  metadata_json: string;
  created_at: string;
  completed_at: string | null;
}

interface AgentActionLogRow {
  id: number;
  agent_profile_id: number;
  agent_name: string;
  token_id: number | null;
  agent_device_id: number | null;
  device_id: string | null;
  action: string;
  resource_type: string;
  resource_id: number | null;
  status: string;
  request_summary: string;
  response_summary: string;
  ip_address: string | null;
  user_agent: string | null;
  idempotency_key: string | null;
  created_at: string;
}

export async function authenticateAgentRequest(request: Request): Promise<AgentContext> {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  const deviceId = request.headers.get("x-whyisee-agent-device")?.trim() || "";

  if (!token) {
    throw new AgentApiError(401, "agent_token_missing", "Missing agent bearer token.");
  }

  if (deviceId || token.startsWith("whyisee_user_agent_")) {
    return authenticateUserAgentDeviceRequest(request, token, deviceId);
  }

  const tokenHash = hashToken(token);
  const row = await queryOne<AgentAuthRow>(
    `
    SELECT
      agent_tokens.id AS token_id,
      agent_tokens.name AS token_name,
      agent_tokens.scopes AS token_scopes,
      agent_profiles.id AS agent_profile_id,
      agent_profiles.name AS agent_name,
      agent_profiles.rate_limit_per_hour,
      users.id AS user_id,
      users.username,
      users.display_name,
      users.role
    FROM agent_tokens
    INNER JOIN agent_profiles ON agent_profiles.id = agent_tokens.agent_profile_id
    INNER JOIN users ON users.id = agent_profiles.user_id
    WHERE agent_tokens.token_hash = $1
      AND agent_tokens.revoked_at IS NULL
      AND (agent_tokens.expires_at IS NULL OR agent_tokens.expires_at > $2)
      AND agent_profiles.status = 'active'
      AND users.status = 'active'
    LIMIT 1
    `,
    [tokenHash, new Date().toISOString()],
  );

  if (!row) {
    throw new AgentApiError(401, "agent_token_invalid", "Invalid or expired agent token.");
  }

  await query("UPDATE agent_tokens SET last_used_at = $1 WHERE id = $2", [new Date().toISOString(), row.token_id]);

  return {
    agentProfileId: row.agent_profile_id,
    agentName: row.agent_name,
    tokenId: row.token_id,
    tokenName: row.token_name,
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    scopes: normalizeScopes(row.token_scopes),
    rateLimitPerHour: Number(row.rate_limit_per_hour || 60),
    credentialKind: "profile_token",
  };
}

export function requireAgentScope(agent: AgentContext, scope: AgentScope) {
  if (!hasAgentScope(agent, scope)) {
    throw new AgentApiError(403, "agent_scope_missing", `Agent token is missing scope: ${scope}`);
  }
}

export function hasAgentScope(agent: AgentContext, scope: AgentScope) {
  return agent.scopes.includes(scope);
}

export async function ensureAgentRateLimit(agent: AgentContext, action: string) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const row = await queryOne<{ count: string }>(
    `
    SELECT COUNT(*)::text AS count
    FROM agent_action_logs
    WHERE agent_profile_id = $1
      AND action = $2
      AND status = 'success'
      AND created_at >= $3
    `,
    [agent.agentProfileId, action, since],
  );

  if (Number(row?.count || 0) >= agent.rateLimitPerHour) {
    throw new AgentApiError(429, "agent_rate_limited", "Agent hourly rate limit reached.");
  }
}

export async function logAgentAction(
  agent: AgentContext,
  input: {
    action: string;
    resourceType?: string;
    resourceId?: number | null;
    status: "success" | "failed";
    requestSummary?: string;
    responseSummary?: string;
    request?: Request;
    idempotencyKey?: string | null;
  },
) {
  await query(
    `
    INSERT INTO agent_action_logs (
      agent_profile_id, token_id, agent_device_id, device_id, action, resource_type, resource_id, status,
      request_summary, response_summary, ip_address, user_agent, idempotency_key, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `,
    [
      agent.agentProfileId,
      agent.tokenId,
      agent.agentDeviceRecordId || null,
      agent.deviceId || null,
      input.action,
      input.resourceType || "",
      input.resourceId || null,
      input.status,
      trimSummary(input.requestSummary || ""),
      trimSummary(input.responseSummary || ""),
      readIpAddress(input.request),
      input.request?.headers.get("user-agent") || null,
      input.idempotencyKey || null,
      new Date().toISOString(),
    ],
  );
}

export async function readAgentIdempotency(agent: AgentContext, key: string | null, action: string) {
  if (!key) {
    return undefined;
  }

  const row = await queryOne<{ action: string; response_json: string }>(
    `
    SELECT action, response_json
    FROM agent_idempotency_keys
    WHERE agent_profile_id = $1 AND idempotency_key = $2
    LIMIT 1
    `,
    [agent.agentProfileId, key],
  );

  if (!row) {
    return undefined;
  }

  if (row.action !== action) {
    throw new AgentApiError(409, "idempotency_key_conflict", "Idempotency key has been used for another action.");
  }

  return safeJsonParse<Record<string, unknown>>(row.response_json, {});
}

export async function storeAgentIdempotency(
  agent: AgentContext,
  key: string | null,
  action: string,
  response: Record<string, unknown>,
) {
  if (!key) {
    return;
  }

  await query(
    `
    INSERT INTO agent_idempotency_keys (agent_profile_id, idempotency_key, action, response_json, created_at)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (agent_profile_id, idempotency_key) DO NOTHING
    `,
    [agent.agentProfileId, key, action, JSON.stringify(response), new Date().toISOString()],
  );
}

export async function listAgentProfiles(): Promise<AgentProfile[]> {
  const rows = await query<AgentProfileRow>(
    `
    SELECT
      agent_profiles.id,
      agent_profiles.user_id,
      users.username,
      users.display_name,
      agent_profiles.name,
      agent_profiles.description,
      agent_profiles.status,
      agent_profiles.default_scopes,
      agent_profiles.rate_limit_per_hour,
      agent_profiles.created_at,
      agent_profiles.updated_at
    FROM agent_profiles
    INNER JOIN users ON users.id = agent_profiles.user_id
    ORDER BY agent_profiles.created_at DESC, agent_profiles.id DESC
    `,
  );

  return rows.map(mapAgentProfile);
}

export async function listAgentAssignableUsers() {
  const rows = await query<{
    id: number;
    username: string;
    display_name: string;
    is_bot: boolean;
  }>(
    `
    SELECT id, username, display_name, is_bot
    FROM users
    WHERE status = 'active'
    ORDER BY is_bot DESC, username ASC
    LIMIT 200
    `,
  );

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    isBot: Boolean(row.is_bot),
  }));
}

export async function createAgentProfile(input: {
  userId: number;
  name: string;
  description: string;
  defaultScopes: string[];
  rateLimitPerHour: number;
}) {
  const now = new Date().toISOString();
  const scopes = normalizeScopes(input.defaultScopes);

  await query(
    `
    INSERT INTO agent_profiles (user_id, name, description, default_scopes, rate_limit_per_hour, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $6)
    `,
    [
      input.userId,
      sanitizeName(input.name),
      input.description.trim(),
      JSON.stringify(scopes),
      Math.max(1, Math.min(Number(input.rateLimitPerHour || 60), 500)),
      now,
    ],
  );
}

export async function updateAgentProfileStatus(id: number, status: "active" | "disabled") {
  await query("UPDATE agent_profiles SET status = $1, updated_at = $2 WHERE id = $3", [
    status,
    new Date().toISOString(),
    id,
  ]);
}

export async function listAgentTokens(): Promise<AgentToken[]> {
  const rows = await query<AgentTokenRow>(
    `
    SELECT
      agent_tokens.id,
      agent_tokens.agent_profile_id,
      agent_profiles.name AS agent_name,
      agent_tokens.token_prefix,
      agent_tokens.name,
      agent_tokens.scopes,
      agent_tokens.expires_at,
      agent_tokens.last_used_at,
      agent_tokens.revoked_at,
      agent_tokens.created_at
    FROM agent_tokens
    INNER JOIN agent_profiles ON agent_profiles.id = agent_tokens.agent_profile_id
    ORDER BY agent_tokens.created_at DESC, agent_tokens.id DESC
    LIMIT 200
    `,
  );

  return rows.map(mapAgentToken);
}

export async function createAgentToken(input: {
  agentProfileId: number;
  name: string;
  scopes?: string[];
  expiresAt?: string | null;
}): Promise<CreatedAgentToken> {
  const profile = await queryOne<{ id: number; default_scopes: string }>(
    "SELECT id, default_scopes FROM agent_profiles WHERE id = $1 LIMIT 1",
    [input.agentProfileId],
  );

  if (!profile) {
    throw new Error("Agent profile not found.");
  }

  const prefix = randomBytes(5).toString("base64url");
  const secret = randomBytes(32).toString("base64url");
  const token = `whyisee_agent_${prefix}_${secret}`;
  const scopes = normalizeScopes(input.scopes?.length ? input.scopes : safeJsonParse<string[]>(profile.default_scopes, []));
  const now = new Date().toISOString();
  const rows = await query<{ id: number }>(
    `
    INSERT INTO agent_tokens (agent_profile_id, token_prefix, token_hash, name, scopes, expires_at, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
    `,
    [
      input.agentProfileId,
      prefix,
      hashToken(token),
      input.name.trim() || "Agent token",
      JSON.stringify(scopes),
      normalizeExpiresAt(input.expiresAt || null),
      now,
    ],
  );

  const record = (await listAgentTokens()).find((item) => item.id === rows[0]?.id);

  if (!record) {
    throw new Error("Failed to create agent token.");
  }

  return { token, record };
}

export async function revokeAgentToken(id: number) {
  await query("UPDATE agent_tokens SET revoked_at = COALESCE(revoked_at, $1) WHERE id = $2", [
    new Date().toISOString(),
    id,
  ]);
}

export async function upsertContentRun(
  agent: AgentContext,
  input: {
    runKey: string;
    skillVersion?: string;
    task: string;
    status?: string;
    inputSummary?: string;
    outputSummary?: string;
    qualityScore?: number | null;
    metadata?: Record<string, unknown>;
    items?: Array<{ type: string; id: number; status?: string }>;
  },
): Promise<AgentRun> {
  const runKey = input.runKey.trim();

  if (!runKey) {
    throw new AgentApiError(400, "run_key_required", "runKey is required.");
  }

  const now = new Date().toISOString();
  const status = normalizeRunStatus(input.status || "success");
  const completedAt = status === "running" ? null : now;
  const rows = await query<{ id: number }>(
    `
    INSERT INTO content_runs (
      run_key, agent_profile_id, skill_version, task, status,
      input_summary, output_summary, quality_score, metadata_json, created_at, completed_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (agent_profile_id, run_key) DO UPDATE SET
      skill_version = excluded.skill_version,
      task = excluded.task,
      status = excluded.status,
      input_summary = excluded.input_summary,
      output_summary = excluded.output_summary,
      quality_score = excluded.quality_score,
      metadata_json = excluded.metadata_json,
      completed_at = excluded.completed_at
    RETURNING id
    `,
    [
      runKey,
      agent.agentProfileId,
      input.skillVersion || agentSkillVersion,
      input.task.trim() || "content_run",
      status,
      trimSummary(input.inputSummary || ""),
      trimSummary(input.outputSummary || ""),
      typeof input.qualityScore === "number" ? Math.round(input.qualityScore) : null,
      JSON.stringify(input.metadata || {}),
      now,
      completedAt,
    ],
  );
  const runId = rows[0]?.id;

  if (!runId) {
    throw new AgentApiError(500, "content_run_failed", "Failed to record content run.");
  }

  for (const item of input.items || []) {
    if (!item.id || !item.type) continue;

    await query(
      `
      INSERT INTO content_run_items (content_run_id, item_type, item_id, status, created_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (content_run_id, item_type, item_id)
      DO UPDATE SET status = excluded.status
      `,
      [runId, item.type, item.id, item.status || "pending", now],
    );
  }

  const run = await getContentRunByIdForAgent(agent.agentProfileId, runId);

  if (!run) {
    throw new AgentApiError(500, "content_run_failed", "Failed to load content run.");
  }

  return run;
}

export async function getContentRunByIdForAgent(agentProfileId: number, id: number): Promise<AgentRun | undefined> {
  const row = await queryOne<AgentRunRow>(
    `
    SELECT
      content_runs.id,
      content_runs.run_key,
      content_runs.agent_profile_id,
      agent_profiles.name AS agent_name,
      content_runs.skill_version,
      content_runs.task,
      content_runs.status,
      content_runs.input_summary,
      content_runs.output_summary,
      content_runs.quality_score,
      content_runs.metadata_json,
      content_runs.created_at,
      content_runs.completed_at
    FROM content_runs
    INNER JOIN agent_profiles ON agent_profiles.id = content_runs.agent_profile_id
    WHERE content_runs.agent_profile_id = $1 AND content_runs.id = $2
    LIMIT 1
    `,
    [agentProfileId, id],
  );

  return row ? mapAgentRun(row) : undefined;
}

export async function listAgentRuns(limit = 100): Promise<AgentRun[]> {
  const rows = await query<AgentRunRow>(
    `
    SELECT
      content_runs.id,
      content_runs.run_key,
      content_runs.agent_profile_id,
      agent_profiles.name AS agent_name,
      content_runs.skill_version,
      content_runs.task,
      content_runs.status,
      content_runs.input_summary,
      content_runs.output_summary,
      content_runs.quality_score,
      content_runs.metadata_json,
      content_runs.created_at,
      content_runs.completed_at
    FROM content_runs
    INNER JOIN agent_profiles ON agent_profiles.id = content_runs.agent_profile_id
    ORDER BY content_runs.created_at DESC, content_runs.id DESC
    LIMIT $1
    `,
    [limit],
  );

  return rows.map(mapAgentRun);
}

export async function listAgentRunsForAgent(agentProfileId: number, limit = 50): Promise<AgentRun[]> {
  const rows = await query<AgentRunRow>(
    `
    SELECT
      content_runs.id,
      content_runs.run_key,
      content_runs.agent_profile_id,
      agent_profiles.name AS agent_name,
      content_runs.skill_version,
      content_runs.task,
      content_runs.status,
      content_runs.input_summary,
      content_runs.output_summary,
      content_runs.quality_score,
      content_runs.metadata_json,
      content_runs.created_at,
      content_runs.completed_at
    FROM content_runs
    INNER JOIN agent_profiles ON agent_profiles.id = content_runs.agent_profile_id
    WHERE content_runs.agent_profile_id = $1
    ORDER BY content_runs.created_at DESC, content_runs.id DESC
    LIMIT $2
    `,
    [agentProfileId, limit],
  );

  return rows.map(mapAgentRun);
}

export async function listAgentActionLogs(limit = 100): Promise<AgentActionLog[]> {
  const rows = await query<AgentActionLogRow>(
    `
    SELECT
      agent_action_logs.id,
      agent_action_logs.agent_profile_id,
      agent_profiles.name AS agent_name,
      agent_action_logs.token_id,
      agent_action_logs.agent_device_id,
      agent_action_logs.device_id,
      agent_action_logs.action,
      agent_action_logs.resource_type,
      agent_action_logs.resource_id,
      agent_action_logs.status,
      agent_action_logs.request_summary,
      agent_action_logs.response_summary,
      agent_action_logs.ip_address,
      agent_action_logs.user_agent,
      agent_action_logs.idempotency_key,
      agent_action_logs.created_at
    FROM agent_action_logs
    INNER JOIN agent_profiles ON agent_profiles.id = agent_action_logs.agent_profile_id
    ORDER BY agent_action_logs.created_at DESC, agent_action_logs.id DESC
    LIMIT $1
    `,
    [limit],
  );

  return rows.map((row) => ({
    id: row.id,
    agentProfileId: row.agent_profile_id,
    agentName: row.agent_name,
    tokenId: row.token_id,
    agentDeviceId: row.agent_device_id,
    deviceId: row.device_id,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    status: row.status,
    requestSummary: row.request_summary,
    responseSummary: row.response_summary,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
  }));
}

export async function listAgentSourcesForItems(itemType: string, itemIds: number[]): Promise<Map<number, AgentSource>> {
  if (itemIds.length === 0) {
    return new Map();
  }

  const rows = await query<{
    item_id: number;
    item_type: string;
    agent_name: string;
    run_key: string;
    skill_version: string;
    quality_score: number | null;
    status: string;
  }>(
    `
    SELECT DISTINCT ON (content_run_items.item_id)
      content_run_items.item_id,
      content_run_items.item_type,
      agent_profiles.name AS agent_name,
      content_runs.run_key,
      content_runs.skill_version,
      content_runs.quality_score,
      content_run_items.status
    FROM content_run_items
    INNER JOIN content_runs ON content_runs.id = content_run_items.content_run_id
    INNER JOIN agent_profiles ON agent_profiles.id = content_runs.agent_profile_id
    WHERE content_run_items.item_type = $1
      AND content_run_items.item_id = ANY($2::int[])
    ORDER BY content_run_items.item_id, content_run_items.created_at DESC
    `,
    [itemType, itemIds],
  );

  return new Map(
    rows.map((row) => [
      row.item_id,
      {
        itemId: row.item_id,
        itemType: row.item_type,
        agentName: row.agent_name,
        runKey: row.run_key,
        skillVersion: row.skill_version,
        qualityScore: row.quality_score,
        status: row.status,
      },
    ]),
  );
}

export function readIdempotencyKey(request: Request) {
  const value = request.headers.get("idempotency-key")?.trim() || "";
  return value ? value.slice(0, 160) : null;
}

function mapAgentProfile(row: AgentProfileRow): AgentProfile {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    name: row.name,
    description: row.description,
    status: row.status,
    defaultScopes: normalizeScopes(row.default_scopes),
    rateLimitPerHour: Number(row.rate_limit_per_hour || 60),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAgentToken(row: AgentTokenRow): AgentToken {
  return {
    id: row.id,
    agentProfileId: row.agent_profile_id,
    agentName: row.agent_name,
    tokenPrefix: row.token_prefix,
    name: row.name,
    scopes: normalizeScopes(row.scopes),
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

function mapAgentRun(row: AgentRunRow): AgentRun {
  return {
    id: row.id,
    runKey: row.run_key,
    agentProfileId: row.agent_profile_id,
    agentName: row.agent_name,
    skillVersion: row.skill_version,
    task: row.task,
    status: row.status,
    inputSummary: row.input_summary,
    outputSummary: row.output_summary,
    qualityScore: row.quality_score,
    metadata: safeJsonParse<Record<string, unknown>>(row.metadata_json, {}),
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function sanitizeName(value: string) {
  const name = value.trim().replace(/\s+/g, "-").toLowerCase();

  if (!/^[a-z0-9][a-z0-9_-]{1,62}$/.test(name)) {
    throw new Error("Agent name must use lowercase letters, numbers, hyphens, or underscores.");
  }

  return name;
}

function normalizeExpiresAt(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function normalizeRunStatus(value: string) {
  if (["running", "success", "failed", "partial", "skipped"].includes(value)) {
    return value;
  }

  return "success";
}

function readIpAddress(request: Request | undefined) {
  if (!request) {
    return null;
  }

  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
}

function trimSummary(value: string) {
  return value.trim().slice(0, 1000);
}

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
