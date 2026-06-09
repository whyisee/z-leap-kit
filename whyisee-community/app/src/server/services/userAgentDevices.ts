import { createHash, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { query, queryOne, withTransaction } from "@server/db/client";
import { AgentApiError } from "./agentErrors";
import {
  defaultUserAgentScopes,
  normalizeScopes,
} from "./agentScopes";
import type { AgentContext } from "./agents";

const bindLinkMaxAgeMinutes = Number(process.env.WHYISEE_AGENT_BIND_LINK_MINUTES || 30);
const userAgentTokenMaxAgeDays = Number(process.env.WHYISEE_AGENT_TOKEN_DAYS || 30);
const userAgentDeviceLimit = Number(process.env.WHYISEE_AGENT_DEVICE_LIMIT || 5);

export interface UserAgentBindLink {
  id: number;
  codePrefix: string;
  bindUrl: string;
  skillDownloadUrl: string;
  curl: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface UserAgentDevice {
  id: number;
  userId: number;
  username: string;
  displayName: string;
  deviceId: string;
  deviceName: string;
  agentName: string;
  status: "active" | "disabled";
  tokenPrefix: string | null;
  tokenExpiresAt: string | null;
  tokenLastUsedAt: string | null;
  tokenRevokedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string | null;
  lastIpAddress: string | null;
  lastUserAgent: string | null;
}

export interface CreatedUserAgentBindLink extends UserAgentBindLink {
  code: string;
}

export interface UserAgentSkillBindContext {
  code: string;
  bindUrl: string;
  bindCommand: string;
  expiresAt: string;
  user: {
    id: number;
    username: string;
    displayName: string;
  };
}

interface BindLinkRow {
  id: number;
  code_prefix: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

interface UserAgentDeviceRow {
  id: number;
  user_id: number;
  username: string;
  display_name: string;
  device_id: string;
  device_name: string;
  agent_name: string;
  status: "active" | "disabled";
  token_prefix: string | null;
  token_expires_at: string | null;
  token_last_used_at: string | null;
  token_revoked_at: string | null;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
  last_ip_address: string | null;
  last_user_agent: string | null;
}

interface DeviceAuthRow {
  device_token_id: number;
  token_name: string;
  token_scopes: string;
  agent_device_record_id: number;
  device_id: string;
  device_name: string;
  agent_name: string;
  agent_profile_id: number;
  rate_limit_per_hour: number;
  user_id: number;
  username: string;
  display_name: string;
  role: AgentContext["role"];
}

export async function createUserAgentBindLink(userId: number, origin: string): Promise<CreatedUserAgentBindLink> {
  const raw = randomBytes(12).toString("base64url");
  const code = `wb_${raw}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + Math.max(5, bindLinkMaxAgeMinutes) * 60 * 1000).toISOString();
  const rows = await query<BindLinkRow>(
    `
    INSERT INTO agent_bind_links (user_id, code_prefix, code_hash, expires_at, created_at)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, code_prefix, expires_at, used_at, revoked_at, created_at
    `,
    [userId, code.slice(0, 24), hashSecret(code), expiresAt, now.toISOString()],
  );

  return {
    ...mapBindLink(rows[0], origin, code),
    code,
  };
}

export async function listUserAgentBindLinks(userId: number, origin: string): Promise<UserAgentBindLink[]> {
  const rows = await query<BindLinkRow>(
    `
    SELECT id, code_prefix, expires_at, used_at, revoked_at, created_at
    FROM agent_bind_links
    WHERE user_id = $1
    ORDER BY created_at DESC, id DESC
    LIMIT 20
    `,
    [userId],
  );

  return rows.map((row) => mapBindLink(row, origin));
}

export async function getUserAgentSkillBindContext(code: string, origin: string): Promise<UserAgentSkillBindContext> {
  const now = new Date().toISOString();
  const row = await queryOne<{
    user_id: number;
    username: string;
    display_name: string;
    expires_at: string;
    used_at: string | null;
    revoked_at: string | null;
  }>(
    `
    SELECT
      agent_bind_links.user_id,
      users.username,
      users.display_name,
      agent_bind_links.expires_at,
      agent_bind_links.used_at,
      agent_bind_links.revoked_at
    FROM agent_bind_links
    INNER JOIN users ON users.id = agent_bind_links.user_id
    WHERE agent_bind_links.code_hash = $1
      AND users.status = 'active'
    LIMIT 1
    `,
    [hashSecret(code)],
  );

  if (!row) {
    throw new AgentApiError(404, "bind_link_invalid", "Agent skill link is invalid.");
  }

  if (row.revoked_at) {
    throw new AgentApiError(410, "bind_link_revoked", "Agent skill link has been revoked.");
  }

  if (row.used_at) {
    throw new AgentApiError(410, "bind_link_used", "Agent skill link has already been used.");
  }

  if (row.expires_at <= now) {
    throw new AgentApiError(410, "bind_link_expired", "Agent skill link has expired.");
  }

  const bindUrl = buildShortBindUrl(origin, code);

  return {
    code,
    bindUrl,
    bindCommand: `curl -X POST ${shellQuote(bindUrl)} -H 'Content-Type: application/json' -d '{"deviceName":"agent-device","agentName":"content-agent"}'`,
    expiresAt: row.expires_at,
    user: {
      id: row.user_id,
      username: row.username,
      displayName: row.display_name,
    },
  };
}

export async function revokeUserAgentBindLink(userId: number, id: number) {
  await query(
    `
    UPDATE agent_bind_links
    SET revoked_at = COALESCE(revoked_at, $1)
    WHERE id = $2 AND user_id = $3 AND used_at IS NULL
    `,
    [new Date().toISOString(), id, userId],
  );
}

export async function bindUserAgentDevice(
  code: string,
  input: {
    deviceName?: string;
    agentName?: string;
    machineFingerprint?: string;
    runtime?: Record<string, unknown>;
  },
  request: Request,
) {
  const now = new Date().toISOString();
  const tokenExpiresAt = new Date(Date.now() + Math.max(1, userAgentTokenMaxAgeDays) * 24 * 60 * 60 * 1000).toISOString();
  const deviceName = normalizeLabel(input.deviceName || "agent-device", 80);
  const agentName = normalizeLabel(input.agentName || "agent", 48);
  const runtime = normalizeRuntime(input.runtime);
  const tokenPrefix = randomBytes(5).toString("base64url");
  const tokenSecret = randomBytes(32).toString("base64url");
  const token = `whyisee_user_agent_${tokenPrefix}_${tokenSecret}`;
  const deviceId = `dev_${randomBytes(16).toString("base64url")}`;

  return withTransaction(async (client) => {
    const link = await client
      .query<{
        id: number;
        user_id: number;
        username: string;
        display_name: string;
        expires_at: string;
        used_at: string | null;
        revoked_at: string | null;
      }>(
        `
        SELECT
          agent_bind_links.id,
          agent_bind_links.user_id,
          users.username,
          users.display_name,
          agent_bind_links.expires_at,
          agent_bind_links.used_at,
          agent_bind_links.revoked_at
        FROM agent_bind_links
        INNER JOIN users ON users.id = agent_bind_links.user_id
        WHERE agent_bind_links.code_hash = $1
          AND users.status = 'active'
        LIMIT 1
        FOR UPDATE OF agent_bind_links
        `,
        [hashSecret(code)],
      )
      .then((result) => result.rows[0]);

    if (!link) {
      throw new AgentApiError(404, "bind_link_invalid", "Agent bind link is invalid.");
    }

    if (link.revoked_at) {
      throw new AgentApiError(410, "bind_link_revoked", "Agent bind link has been revoked.");
    }

    if (link.used_at) {
      throw new AgentApiError(410, "bind_link_used", "Agent bind link has already been used.");
    }

    if (link.expires_at <= now) {
      throw new AgentApiError(410, "bind_link_expired", "Agent bind link has expired.");
    }

    const activeCount = await client
      .query<{ count: string }>(
        `
        SELECT COUNT(*)::text AS count
        FROM agent_devices
        WHERE user_id = $1 AND status = 'active'
        `,
        [link.user_id],
      )
      .then((result) => Number(result.rows[0]?.count || 0));

    if (activeCount >= Math.max(1, userAgentDeviceLimit)) {
      throw new AgentApiError(429, "device_limit_reached", "Agent device limit reached.");
    }

    const agentProfileId = await ensureUserAgentProfile(client, link.user_id);
    const deviceRows = await client.query<{ id: number }>(
      `
      INSERT INTO agent_devices (
        user_id, agent_profile_id, device_id, device_name, agent_name,
        machine_fingerprint_hash, runtime_json, status, created_at, updated_at,
        last_seen_at, last_ip_address, last_user_agent
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $8, $8, $9, $10)
      RETURNING id
      `,
      [
        link.user_id,
        agentProfileId,
        deviceId,
        deviceName,
        agentName,
        input.machineFingerprint ? hashSecret(input.machineFingerprint) : null,
        JSON.stringify(runtime),
        now,
        readIpAddress(request),
        request.headers.get("user-agent") || null,
      ],
    );
    const deviceRecordId = deviceRows.rows[0]?.id;

    if (!deviceRecordId) {
      throw new AgentApiError(500, "agent_device_create_failed", "Failed to create agent device.");
    }

    await client.query(
      `
      INSERT INTO agent_device_tokens (
        agent_device_id, token_prefix, token_hash, name, scopes,
        expires_at, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        deviceRecordId,
        tokenPrefix,
        hashSecret(token),
        `${agentName} token`,
        JSON.stringify(defaultUserAgentScopes),
        tokenExpiresAt,
        now,
      ],
    );

    await client.query(
      "UPDATE agent_bind_links SET used_at = $1, used_device_id = $2 WHERE id = $3",
      [now, deviceRecordId, link.id],
    );

    return {
      ok: true,
      user: {
        id: link.user_id,
        username: link.username,
        displayName: link.display_name,
      },
      device: {
        id: deviceId,
        name: deviceName,
        agentName,
      },
      credential: {
        token,
        deviceId,
        expiresAt: tokenExpiresAt,
        scopes: defaultUserAgentScopes,
      },
      env: {
        WHYISEE_AGENT_TOKEN: token,
        WHYISEE_AGENT_DEVICE_ID: deviceId,
      },
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Whyisee-Agent-Device": deviceId,
      },
    };
  });
}

export async function authenticateUserAgentDeviceRequest(
  request: Request,
  token: string,
  deviceId: string,
): Promise<AgentContext> {
  if (!deviceId) {
    throw new AgentApiError(401, "agent_device_missing", "Missing X-Whyisee-Agent-Device header.");
  }

  const row = await queryOne<DeviceAuthRow>(
    `
    SELECT
      agent_device_tokens.id AS device_token_id,
      agent_device_tokens.name AS token_name,
      agent_device_tokens.scopes AS token_scopes,
      agent_devices.id AS agent_device_record_id,
      agent_devices.device_id,
      agent_devices.device_name,
      agent_devices.agent_name,
      agent_profiles.id AS agent_profile_id,
      agent_profiles.rate_limit_per_hour,
      users.id AS user_id,
      users.username,
      users.display_name,
      users.role
    FROM agent_device_tokens
    INNER JOIN agent_devices ON agent_devices.id = agent_device_tokens.agent_device_id
    INNER JOIN agent_profiles ON agent_profiles.id = agent_devices.agent_profile_id
    INNER JOIN users ON users.id = agent_devices.user_id
    WHERE agent_device_tokens.token_hash = $1
      AND agent_devices.device_id = $2
      AND agent_device_tokens.revoked_at IS NULL
      AND (agent_device_tokens.expires_at IS NULL OR agent_device_tokens.expires_at > $3)
      AND agent_devices.status = 'active'
      AND agent_profiles.status = 'active'
      AND users.status = 'active'
    LIMIT 1
    `,
    [hashSecret(token), deviceId, new Date().toISOString()],
  );

  if (!row) {
    throw new AgentApiError(401, "agent_token_invalid", "Invalid agent token or device.");
  }

  const now = new Date().toISOString();

  await query(
    `
    UPDATE agent_device_tokens
    SET last_used_at = $1
    WHERE id = $2
    `,
    [now, row.device_token_id],
  );
  await query(
    `
    UPDATE agent_devices
    SET last_seen_at = $1, last_ip_address = $2, last_user_agent = $3, updated_at = $1
    WHERE id = $4
    `,
    [now, readIpAddress(request), request.headers.get("user-agent") || null, row.agent_device_record_id],
  );

  return {
    agentProfileId: row.agent_profile_id,
    agentName: row.agent_name,
    tokenId: null,
    tokenName: row.token_name,
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    scopes: normalizeScopes(row.token_scopes),
    rateLimitPerHour: Number(row.rate_limit_per_hour || 60),
    credentialKind: "user_device",
    agentDeviceRecordId: row.agent_device_record_id,
    deviceId: row.device_id,
    deviceName: row.device_name,
  };
}

export async function listUserAgentDevices(userId: number): Promise<UserAgentDevice[]> {
  return listDevices("WHERE agent_devices.user_id = $1", [userId]);
}

export async function listAllUserAgentDevices(limit = 200): Promise<UserAgentDevice[]> {
  return listDevices("WHERE TRUE", [], limit);
}

export async function updateUserAgentDeviceStatus(userId: number, id: number, status: "active" | "disabled") {
  await query(
    `
    UPDATE agent_devices
    SET status = $1, updated_at = $2
    WHERE id = $3 AND user_id = $4
    `,
    [status, new Date().toISOString(), id, userId],
  );
}

export async function updateAnyUserAgentDeviceStatus(id: number, status: "active" | "disabled") {
  await query(
    `
    UPDATE agent_devices
    SET status = $1, updated_at = $2
    WHERE id = $3
    `,
    [status, new Date().toISOString(), id],
  );
}

export async function revokeUserAgentDeviceTokens(userId: number, id: number) {
  await query(
    `
    UPDATE agent_device_tokens
    SET revoked_at = COALESCE(revoked_at, $1)
    WHERE agent_device_id IN (
      SELECT id FROM agent_devices WHERE id = $2 AND user_id = $3
    )
    `,
    [new Date().toISOString(), id, userId],
  );
}

export async function unbindUserAgentDevice(userId: number, id: number) {
  const now = new Date().toISOString();

  await withTransaction(async (client) => {
    await client.query(
      `
      UPDATE agent_devices
      SET status = 'disabled', updated_at = $1
      WHERE id = $2 AND user_id = $3
      `,
      [now, id, userId],
    );

    await client.query(
      `
      UPDATE agent_device_tokens
      SET revoked_at = COALESCE(revoked_at, $1)
      WHERE agent_device_id IN (
        SELECT id FROM agent_devices WHERE id = $2 AND user_id = $3
      )
      `,
      [now, id, userId],
    );
  });
}

export async function revokeAnyUserAgentDeviceTokens(id: number) {
  await query(
    `
    UPDATE agent_device_tokens
    SET revoked_at = COALESCE(revoked_at, $1)
    WHERE agent_device_id = $2
    `,
    [new Date().toISOString(), id],
  );
}

function listDevices(whereSql: string, values: unknown[], limit = 100): Promise<UserAgentDevice[]> {
  return query<UserAgentDeviceRow>(
    `
    SELECT
      agent_devices.id,
      agent_devices.user_id,
      users.username,
      users.display_name,
      agent_devices.device_id,
      agent_devices.device_name,
      agent_devices.agent_name,
      agent_devices.status,
      latest_token.token_prefix,
      latest_token.expires_at AS token_expires_at,
      latest_token.last_used_at AS token_last_used_at,
      latest_token.revoked_at AS token_revoked_at,
      agent_devices.created_at,
      agent_devices.updated_at,
      agent_devices.last_seen_at,
      agent_devices.last_ip_address,
      agent_devices.last_user_agent
    FROM agent_devices
    INNER JOIN users ON users.id = agent_devices.user_id
    LEFT JOIN LATERAL (
      SELECT token_prefix, expires_at, last_used_at, revoked_at
      FROM agent_device_tokens
      WHERE agent_device_tokens.agent_device_id = agent_devices.id
      ORDER BY agent_device_tokens.created_at DESC, agent_device_tokens.id DESC
      LIMIT 1
    ) latest_token ON TRUE
    ${whereSql}
    ORDER BY agent_devices.created_at DESC, agent_devices.id DESC
    LIMIT $${values.length + 1}
    `,
    [...values, limit],
  ).then((rows) => rows.map(mapDevice));
}

function mapBindLink(row: BindLinkRow, origin: string, code?: string): UserAgentBindLink {
  const bindUrl = code ? buildShortBindUrl(origin, code) : "";
  const skillDownloadUrl = code ? buildShortSkillDownloadUrl(origin, code) : "";
  const curl = code
    ? `curl -X POST ${shellQuote(bindUrl)} -H 'Content-Type: application/json' -d '{"deviceName":"my-mac","agentName":"codex"}'`
    : "";

  return {
    id: row.id,
    codePrefix: row.code_prefix,
    bindUrl,
    skillDownloadUrl,
    curl,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

function buildShortSkillDownloadUrl(origin: string, code: string) {
  return `${origin}/a/${encodeURIComponent(code)}`;
}

function buildShortBindUrl(origin: string, code: string) {
  return `${origin}/a/b/${encodeURIComponent(code)}`;
}

function mapDevice(row: UserAgentDeviceRow): UserAgentDevice {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    deviceId: row.device_id,
    deviceName: row.device_name,
    agentName: row.agent_name,
    status: row.status,
    tokenPrefix: row.token_prefix,
    tokenExpiresAt: row.token_expires_at,
    tokenLastUsedAt: row.token_last_used_at,
    tokenRevokedAt: row.token_revoked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeenAt: row.last_seen_at,
    lastIpAddress: row.last_ip_address,
    lastUserAgent: row.last_user_agent,
  };
}

async function ensureUserAgentProfile(client: PoolClient, userId: number) {
  const name = `user-${userId}-agent`;
  const existing = await client
    .query<{ id: number }>("SELECT id FROM agent_profiles WHERE name = $1 LIMIT 1", [name])
    .then((result) => result.rows[0]?.id);

  if (existing) {
    await client.query("UPDATE agent_profiles SET status = 'active', updated_at = $1 WHERE id = $2", [
      new Date().toISOString(),
      existing,
    ]);
    return existing;
  }

  const now = new Date().toISOString();
  const created = await client.query<{ id: number }>(
    `
    INSERT INTO agent_profiles (
      user_id, name, description, status, default_scopes,
      rate_limit_per_hour, created_at, updated_at
    )
    VALUES ($1, $2, $3, 'active', $4, 60, $5, $5)
    RETURNING id
    `,
    [
      userId,
      name,
      "用户自助绑定的外部 Agent 设备。",
      JSON.stringify(defaultUserAgentScopes),
      now,
    ],
  );

  return created.rows[0]?.id || 0;
}

function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeLabel(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength) || "agent";
}

function normalizeRuntime(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key, item]) => key.length <= 40 && ["string", "number", "boolean"].includes(typeof item))
      .slice(0, 20),
  );
}

function readIpAddress(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
