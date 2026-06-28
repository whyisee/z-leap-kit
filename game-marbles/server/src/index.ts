import http from "node:http";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { defaultSave, normalizeSave } from "../../src/state/save";
import type { PvpRankMode, SaveData, ShopReward } from "../../src/core/types";
import { applyPvpRankResult } from "../../src/systems/pvp/rank";
import { pool, q, withTransaction } from "./db";
import { env } from "./env";
import {
  handleLeaderboardCatalog,
  handleLeaderboardList,
  handleLeaderboardMe,
  upsertPvpLeaderboardEntry,
} from "./leaderboards";
import { handlePvpAiChat, handlePvpAiPressure, handlePvpAiSnapshot, handlePvpAiStart } from "./pvp-ai";
import {
  handlePvpMatchCancel,
  handlePvpMatchChat,
  handlePvpMatchFinish,
  handlePvpMatchPressure,
  handlePvpMatchSnapshot,
  handlePvpMatchStart,
  handlePvpMatchStatus,
} from "./pvp-matchmaking";

type AuthContext = {
  userId: string;
  tokenHash: string;
};

type ApiError = {
  code: string;
  message: string;
  status?: number;
};

type UserProfile = {
  userId: string;
  username: string;
  nickname: string;
  avatar: string;
  isGuest: boolean;
};

const CONFIG_VERSION = "local-2026-06-27";
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MARBLE_LABELS = {
  basic: "基础弹珠",
  split: "分裂弹珠",
  blast: "爆裂弹珠",
  burn: "燃烧弹珠",
  lightning: "闪电弹珠",
  slow: "减速弹珠",
} as const;
const GEM_LABELS = {
  power: "强袭宝石",
  guard: "壁垒宝石",
  fortune: "回收宝石",
} as const;
const COLLECTIBLE_LABELS = {
  scrap_shell: "废料壳",
  ancient_chip: "古旧芯片",
  void_lens: "虚空透镜",
  boss_core: "首领核心",
} as const;
const CHARACTER_LABELS = {
  engineer: "工程师",
  bomber: "爆破手",
  magnetist: "磁能师",
  sentinel: "哨卫",
  prism: "棱镜师",
  alchemist: "炼金师",
  frostseer: "霜语者",
  voidbinder: "虚空使",
  treasurer: "财宝猎人",
} as const;
const TICKET_LABELS = {
  insurance: "保险券",
  scan: "扫描券",
  refresh: "刷新券",
} as const;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createToken() {
  return randomBytes(32).toString("base64url");
}

function createSeed() {
  return randomBytes(12).toString("base64url");
}

function createApiError(code: string, message: string, status = 400): ApiError {
  return { code, message, status };
}

function defaultNickname(userId: string) {
  return `玩家${userId.slice(0, 4).toUpperCase()}`;
}

function sanitizeNickname(value: unknown, userId: string) {
  const text = String(value || "").trim().replace(/\s+/g, " ").slice(0, 12);
  return text || defaultNickname(userId);
}

function sanitizeAvatar(value: unknown) {
  const avatar = String(value || "avatar_green").trim();
  return /^[a-z0-9_-]{1,32}$/i.test(avatar) ? avatar : "avatar_green";
}

function sanitizeUsername(value: unknown) {
  const username = String(value || "").trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    throw createApiError("INVALID_USERNAME", "用户名需为 3-20 位英文、数字或下划线。", 400);
  }
  return username;
}

function sanitizePassword(value: unknown) {
  const password = String(value || "");
  if (password.length < 6 || password.length > 32) {
    throw createApiError("INVALID_PASSWORD", "密码需为 6-32 位。", 400);
  }
  return password;
}

function sanitizeRedeemCode(value: unknown) {
  const code = String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    throw createApiError("INVALID_REDEEM_CODE", "兑换码格式不正确。", 400);
  }
  return code;
}

function rewardAmount(value: unknown, max = 100_000) {
  const amount = Math.floor(Number(value) || 0);
  return Math.max(1, Math.min(max, amount));
}

function normalizeRedeemRewards(value: unknown): ShopReward[] {
  if (!Array.isArray(value)) return [];
  const rewards: ShopReward[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const reward = item as Record<string, unknown>;

    if (reward.type === "coins") {
      rewards.push({ type: "coins", amount: rewardAmount(reward.amount) });
    }

    if (reward.type === "pvpCoins") {
      rewards.push({ type: "pvpCoins", amount: rewardAmount(reward.amount) });
    }

    if (reward.type === "energyCrystals") {
      rewards.push({ type: "energyCrystals", amount: rewardAmount(reward.amount) });
    }

    if (reward.type === "marbleShard" && typeof reward.marbleId === "string" && reward.marbleId in MARBLE_LABELS) {
      rewards.push({ type: "marbleShard", marbleId: reward.marbleId as keyof typeof MARBLE_LABELS, amount: rewardAmount(reward.amount, 5_000) });
    }

    if (reward.type === "randomMarbleShard") {
      rewards.push({ type: "randomMarbleShard", amount: rewardAmount(reward.amount, 5_000) });
    }

    if (reward.type === "gem" && typeof reward.gemType === "string" && reward.gemType in GEM_LABELS) {
      const level = Math.max(1, Math.min(20, Math.floor(Number(reward.level) || 1)));
      rewards.push({ type: "gem", gemType: reward.gemType as keyof typeof GEM_LABELS, level, amount: rewardAmount(reward.amount, 100) });
    }

    if (reward.type === "collectible" && typeof reward.collectibleId === "string" && reward.collectibleId in COLLECTIBLE_LABELS) {
      rewards.push({ type: "collectible", collectibleId: reward.collectibleId as keyof typeof COLLECTIBLE_LABELS, amount: rewardAmount(reward.amount, 5_000) });
    }

    if (reward.type === "characterUnlock" && typeof reward.characterId === "string" && reward.characterId in CHARACTER_LABELS) {
      rewards.push({ type: "characterUnlock", characterId: reward.characterId });
    }

    if (reward.type === "ticket" && typeof reward.ticketId === "string" && reward.ticketId in TICKET_LABELS) {
      rewards.push({ type: "ticket", ticketId: reward.ticketId as keyof typeof TICKET_LABELS, amount: rewardAmount(reward.amount, 1_000) });
    }
  }

  return rewards;
}

function serverGemKey(type: keyof typeof GEM_LABELS, level: number) {
  return `${type}:${Math.max(1, Math.min(20, Math.floor(level) || 1))}`;
}

function randomMarbleId(save: SaveData) {
  const ids = Object.keys(MARBLE_LABELS) as Array<keyof typeof MARBLE_LABELS>;
  const candidates = ids.filter((id) => (save.marbleLevels?.[id] || 1) < 20);
  const pool = candidates.length > 0 ? candidates : ids;
  return pool[Math.floor(Math.random() * pool.length)];
}

function grantRedeemRewards(save: SaveData, rewards: ShopReward[]) {
  const labels: string[] = [];
  save.inventory.collectibles ||= {};
  save.inventory.marbleShards ||= {};
  save.inventory.gems ||= {};
  save.characters ||= {};
  save.tickets ||= {};

  for (const reward of rewards) {
    if (reward.type === "coins") {
      save.coins += reward.amount;
      labels.push(`金币 ${reward.amount}`);
    }

    if (reward.type === "pvpCoins") {
      save.pvpCoins = Math.max(0, Math.floor(Number(save.pvpCoins) || 0)) + reward.amount;
      labels.push(`竞技币 ${reward.amount}`);
    }

    if (reward.type === "energyCrystals") {
      save.energyCrystals += reward.amount;
      labels.push(`能源晶体 ${reward.amount}`);
    }

    if (reward.type === "marbleShard") {
      save.inventory.marbleShards[reward.marbleId] = (save.inventory.marbleShards[reward.marbleId] || 0) + reward.amount;
      labels.push(`${MARBLE_LABELS[reward.marbleId]}碎片 ${reward.amount}`);
    }

    if (reward.type === "randomMarbleShard") {
      const marbleId = randomMarbleId(save);
      save.inventory.marbleShards[marbleId] = (save.inventory.marbleShards[marbleId] || 0) + reward.amount;
      labels.push(`${MARBLE_LABELS[marbleId]}碎片 ${reward.amount}`);
    }

    if (reward.type === "gem") {
      const key = serverGemKey(reward.gemType, reward.level);
      save.inventory.gems[key] = (save.inventory.gems[key] || 0) + reward.amount;
      labels.push(`${GEM_LABELS[reward.gemType]} Lv.${reward.level} x${reward.amount}`);
    }

    if (reward.type === "collectible") {
      save.inventory.collectibles[reward.collectibleId] = (save.inventory.collectibles[reward.collectibleId] || 0) + reward.amount;
      labels.push(`${COLLECTIBLE_LABELS[reward.collectibleId]} ${reward.amount}`);
    }

    if (reward.type === "characterUnlock") {
      save.characters[reward.characterId] ||= {
        owned: false,
        level: 1,
        skillLevel: 1,
        routes: {},
      };
      save.characters[reward.characterId].owned = true;
      labels.push(`${CHARACTER_LABELS[reward.characterId as keyof typeof CHARACTER_LABELS]} 解锁`);
    }

    if (reward.type === "ticket") {
      save.tickets[reward.ticketId] = (save.tickets[reward.ticketId] || 0) + reward.amount;
      labels.push(`${TICKET_LABELS[reward.ticketId]} ${reward.amount}`);
    }
  }

  return labels;
}

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return {
    salt,
    hash: scryptSync(password, salt, 64).toString("hex"),
  };
}

function verifyPassword(password: string, salt: string, hash: string) {
  const hashed = Buffer.from(hashPassword(password, salt).hash, "hex");
  const stored = Buffer.from(hash, "hex");
  if (hashed.length !== stored.length) return false;
  return timingSafeEqual(hashed, stored);
}

function rowToProfile(row: any): UserProfile {
  return {
    userId: row.id,
    username: row.username || "",
    nickname: row.nickname || defaultNickname(row.id),
    avatar: row.avatar || "avatar_green",
    isGuest: !row.username,
  };
}

function corsOrigin(req: IncomingMessage) {
  const origin = req.headers.origin;
  if (!origin) return env.siteUrl;
  if (env.corsOrigins.includes(origin)) return origin;
  if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return origin;
  return env.siteUrl;
}

function sendJson(req: IncomingMessage, res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": corsOrigin(req),
    "access-control-allow-headers": "authorization, content-type, x-client-version, x-device-id, x-request-id",
    "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
    "access-control-max-age": "86400",
  });
  res.end(JSON.stringify(data));
}

async function readJson(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > MAX_BODY_BYTES) {
      throw createApiError("PAYLOAD_TOO_LARGE", "Request body is too large.", 413);
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw createApiError("BAD_JSON", "Request body must be valid JSON.", 400);
  }
}

async function requireAuth(req: IncomingMessage): Promise<AuthContext> {
  const header = req.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(Array.isArray(header) ? header[0] : header);
  if (!match) throw createApiError("UNAUTHORIZED", "Missing bearer token.", 401);

  const hash = tokenHash(match[1]);
  const result = await pool.query(
    `
      update ${q("gm_auth_sessions")}
      set last_seen_at = now()
      where token_hash = $1 and expires_at > now()
      returning user_id
    `,
    [hash],
  );

  if (!result.rowCount) throw createApiError("UNAUTHORIZED", "Invalid or expired token.", 401);
  return { userId: result.rows[0].user_id, tokenHash: hash };
}

function normalizeIncomingSave(value: unknown): SaveData {
  return normalizeSave({
    ...defaultSave(),
    ...(typeof value === "object" && value ? value : {}),
  } as SaveData);
}

async function ensurePlayerState(userId: string, initialState?: SaveData) {
  const fallback = normalizeIncomingSave(initialState || defaultSave());
  const result = await pool.query(
    `
      insert into ${q("gm_player_states")} (user_id, schema_version, revision, snapshot)
      values ($1, 1, 1, $2::jsonb)
      on conflict (user_id) do nothing
      returning revision, snapshot
    `,
    [userId, JSON.stringify(fallback)],
  );

  if (result.rowCount) {
    return {
      revision: Number(result.rows[0].revision),
      snapshot: normalizeIncomingSave(result.rows[0].snapshot),
    };
  }

  const existing = await pool.query(`select revision, snapshot from ${q("gm_player_states")} where user_id = $1`, [userId]);
  return {
    revision: Number(existing.rows[0].revision),
    snapshot: normalizeIncomingSave(existing.rows[0].snapshot),
  };
}

async function getUserProfile(userId: string): Promise<UserProfile> {
  const result = await pool.query(`select id, guest_id, username, nickname, avatar from ${q("gm_users")} where id = $1`, [userId]);
  if (!result.rowCount) throw createApiError("USER_NOT_FOUND", "User does not exist.", 404);
  return rowToProfile(result.rows[0]);
}

async function createAuthSession(userId: string, deviceId: string) {
  const token = createToken();
  await pool.query(
    `
      insert into ${q("gm_auth_sessions")} (token_hash, user_id, device_id, expires_at)
      values ($1, $2, $3, now() + interval '180 days')
      on conflict (token_hash) do update set last_seen_at = now()
    `,
    [tokenHash(token), userId, deviceId],
  );
  return token;
}

async function savePlayerState(userId: string, state: SaveData) {
  const normalized = normalizeIncomingSave(state);
  const result = await pool.query(
    `
      insert into ${q("gm_player_states")} (user_id, schema_version, revision, snapshot, updated_at)
      values ($1, 1, 1, $2::jsonb, now())
      on conflict (user_id) do update
      set revision = gm_player_states.revision + 1,
          snapshot = excluded.snapshot,
          updated_at = now()
      returning revision, snapshot
    `,
    [userId, JSON.stringify(normalized)],
  );

  return {
    revision: Number(result.rows[0].revision),
    snapshot: normalizeIncomingSave(result.rows[0].snapshot),
  };
}

async function withIdempotency(userId: string, opId: string | undefined, endpoint: string, handler: () => Promise<unknown>) {
  if (!opId) return handler();

  return withTransaction(async (client) => {
    const existing = await client.query(`select endpoint, response from ${q("gm_idempotency_keys")} where user_id = $1 and op_id = $2`, [userId, opId]);
    if (existing.rowCount) {
      if (existing.rows[0].endpoint !== endpoint) {
        throw createApiError("IDEMPOTENCY_CONFLICT", "opId was already used by another endpoint.", 409);
      }
      return existing.rows[0].response;
    }

    const response = await handler();
    await client.query(
      `
        insert into ${q("gm_idempotency_keys")} (user_id, op_id, endpoint, response)
        values ($1, $2, $3, $4::jsonb)
      `,
      [userId, opId, endpoint, JSON.stringify(response)],
    );
    return response;
  });
}

async function handleAuthRegister(body: any) {
  const username = sanitizeUsername(body.username);
  const password = sanitizePassword(body.password);
  const deviceId = String(body.deviceId || randomUUID()).slice(0, 160);
  const userId = randomUUID();
  const { salt, hash } = hashPassword(password);
  const localSave = body.localSave ? normalizeIncomingSave(body.localSave) : undefined;
  const existing = await pool.query(`select id from ${q("gm_users")} where lower(username) = $1`, [username]);
  if (existing.rowCount) throw createApiError("USERNAME_EXISTS", "用户名已存在。", 409);

  const result = await pool.query(
    `
      insert into ${q("gm_users")} (id, username, password_hash, password_salt, nickname, avatar, last_login_at)
      values ($1, $2, $3, $4, $5, $6, now())
      returning id, guest_id, username, nickname, avatar
    `,
    [userId, username, hash, salt, sanitizeNickname(body.nickname || username, userId), sanitizeAvatar(body.avatar)],
  );

  const token = await createAuthSession(userId, deviceId);
  const player = await ensurePlayerState(userId, localSave);
  return {
    userId,
    user: rowToProfile(result.rows[0]),
    accessToken: token,
    playerRevision: player.revision,
    playerState: player.snapshot,
  };
}

async function handleAuthLogin(body: any) {
  const username = sanitizeUsername(body.username);
  const password = sanitizePassword(body.password);
  const deviceId = String(body.deviceId || randomUUID()).slice(0, 160);
  const result = await pool.query(
    `
      select id, guest_id, username, nickname, avatar, password_hash, password_salt
      from ${q("gm_users")}
      where lower(username) = $1 and status = 'active'
    `,
    [username],
  );

  if (!result.rowCount) throw createApiError("INVALID_CREDENTIALS", "用户名或密码错误。", 401);
  const row = result.rows[0];
  if (!row.password_hash || !row.password_salt || !verifyPassword(password, row.password_salt, row.password_hash)) {
    throw createApiError("INVALID_CREDENTIALS", "用户名或密码错误。", 401);
  }

  await pool.query(`update ${q("gm_users")} set last_login_at = now() where id = $1`, [row.id]);
  const token = await createAuthSession(row.id, deviceId);
  const player = await ensurePlayerState(row.id);
  return {
    userId: row.id,
    user: rowToProfile(row),
    accessToken: token,
    playerRevision: player.revision,
    playerState: player.snapshot,
  };
}

async function handleAuthGuest(body: any) {
  const deviceId = String(body.deviceId || body.guestId || randomUUID()).slice(0, 160);
  const guestId = `guest:${deviceId}`;
  const userId = randomUUID();
  const localSave = body.localSave ? normalizeIncomingSave(body.localSave) : undefined;

  const result = await pool.query(
    `
      insert into ${q("gm_users")} (id, guest_id, nickname, avatar, last_login_at)
      values ($1, $2, $3, $4, now())
      on conflict (guest_id) do update set last_login_at = now()
      returning id, guest_id, nickname, avatar, (xmax = 0) as inserted
    `,
    [userId, guestId, defaultNickname(userId), sanitizeAvatar(body.avatar)],
  );

  const finalUserId = result.rows[0].id;
  const token = await createAuthSession(finalUserId, deviceId);
  const player = await ensurePlayerState(finalUserId, localSave);
  return {
    userId: finalUserId,
    user: rowToProfile(result.rows[0]),
    accessToken: token,
    isNewUser: Boolean(result.rows[0].inserted),
    playerRevision: player.revision,
    playerState: player.snapshot,
  };
}

async function handleBootstrap(auth: AuthContext) {
  const player = await ensurePlayerState(auth.userId);
  const profile = await getUserProfile(auth.userId);
  const activities = await pool.query(
    `
      select id, type, title, starts_at, ends_at, rules, rewards
      from ${q("gm_activity_definitions")}
      where status = 'published'
        and (starts_at is null or starts_at <= now())
        and (ends_at is null or ends_at > now())
      order by starts_at nulls first, id
    `,
  );

  return {
    serverTime: Date.now(),
    user: profile,
    playerRevision: player.revision,
    playerState: player.snapshot,
    configVersion: CONFIG_VERSION,
    activities: activities.rows,
    featureFlags: {},
    notices: [],
  };
}

async function handleProfileUpdate(auth: AuthContext, body: any) {
  const nickname = sanitizeNickname(body.nickname, auth.userId);
  const avatar = sanitizeAvatar(body.avatar);
  const result = await pool.query(
    `
      update ${q("gm_users")}
      set nickname = $2,
          avatar = $3
      where id = $1
      returning id, guest_id, nickname, avatar
    `,
    [auth.userId, nickname, avatar],
  );
  if (!result.rowCount) throw createApiError("USER_NOT_FOUND", "User does not exist.", 404);
  return {
    ok: true,
    user: rowToProfile(result.rows[0]),
  };
}

async function handleSaveState(auth: AuthContext, body: any) {
  const state = normalizeIncomingSave(body.state);
  const saved = await savePlayerState(auth.userId, state);
  return {
    ok: true,
    playerRevision: saved.revision,
    playerState: saved.snapshot,
  };
}

async function handleRedeemCode(auth: AuthContext, body: any) {
  const code = sanitizeRedeemCode(body.code);

  return withTransaction(async (client) => {
    const codeResult = await client.query(
      `
        select code, title, status, starts_at, ends_at, max_uses, rewards
        from ${q("gm_redeem_codes")}
        where code = $1
        for update
      `,
      [code],
    );

    if (!codeResult.rowCount) throw createApiError("REDEEM_CODE_NOT_FOUND", "兑换码不存在。", 404);
    const codeRow = codeResult.rows[0];
    if (codeRow.status !== "active") throw createApiError("REDEEM_CODE_INACTIVE", "兑换码暂不可用。", 400);
    if (codeRow.starts_at && new Date(codeRow.starts_at).getTime() > Date.now()) {
      throw createApiError("REDEEM_CODE_NOT_STARTED", "兑换码还未开始。", 400);
    }
    if (codeRow.ends_at && new Date(codeRow.ends_at).getTime() <= Date.now()) {
      throw createApiError("REDEEM_CODE_EXPIRED", "兑换码已过期。", 400);
    }

    const existing = await client.query(`select 1 from ${q("gm_redeem_redemptions")} where user_id = $1 and code = $2`, [auth.userId, code]);
    if (existing.rowCount) throw createApiError("REDEEM_CODE_USED", "该兑换码已经领取过。", 409);

    if (codeRow.max_uses !== null && codeRow.max_uses !== undefined) {
      const used = await client.query(`select count(*)::int as count from ${q("gm_redeem_redemptions")} where code = $1`, [code]);
      if (Number(used.rows[0]?.count || 0) >= Number(codeRow.max_uses)) {
        throw createApiError("REDEEM_CODE_LIMITED", "兑换码领取次数已用完。", 400);
      }
    }

    let player = await client.query(`select revision, snapshot from ${q("gm_player_states")} where user_id = $1 for update`, [auth.userId]);
    if (!player.rowCount) {
      const fallback = normalizeIncomingSave(defaultSave());
      player = await client.query(
        `
          insert into ${q("gm_player_states")} (user_id, schema_version, revision, snapshot)
          values ($1, 1, 1, $2::jsonb)
          returning revision, snapshot
        `,
        [auth.userId, JSON.stringify(fallback)],
      );
    }

    const rewards = normalizeRedeemRewards(codeRow.rewards);
    if (rewards.length === 0) throw createApiError("REDEEM_CODE_EMPTY", "兑换码没有可领取奖励。", 500);

    const save = normalizeIncomingSave(player.rows[0].snapshot);
    const rewardLabels = grantRedeemRewards(save, rewards);
    const saved = await client.query(
      `
        update ${q("gm_player_states")}
        set revision = revision + 1,
            snapshot = $2::jsonb,
            updated_at = now()
        where user_id = $1
        returning revision, snapshot
      `,
      [auth.userId, JSON.stringify(normalizeIncomingSave(save))],
    );

    await client.query(
      `
        insert into ${q("gm_redeem_redemptions")} (user_id, code, rewards, reward_labels)
        values ($1, $2, $3::jsonb, $4::jsonb)
      `,
      [auth.userId, code, JSON.stringify(rewards), JSON.stringify(rewardLabels)],
    );

    return {
      ok: true,
      code,
      title: codeRow.title,
      rewards,
      rewardLabels,
      rewardText: rewardLabels.join("、"),
      playerRevision: Number(saved.rows[0].revision),
      playerState: normalizeIncomingSave(saved.rows[0].snapshot),
    };
  });
}

async function handleBattleStart(auth: AuthContext, body: any, req: IncomingMessage) {
  const battleId = randomUUID();
  const seed = createSeed();
  const mode = String(body.mode || "normal").slice(0, 40);
  const stage = Math.max(1, Math.floor(Number(body.stage) || 1));
  const snapshot = {
    lineup: Array.isArray(body.lineup) ? body.lineup.slice(0, 3) : [],
    baseGems: Array.isArray(body.baseGems) ? body.baseGems.slice(0, 3) : [],
  };
  const clientVersion = String(req.headers["x-client-version"] || "dev").slice(0, 80);

  await pool.query(
    `
      insert into ${q("gm_battle_sessions")}
        (id, user_id, mode, stage, config_version, seed, lineup_snapshot, client_version)
      values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
    `,
    [battleId, auth.userId, mode, stage, CONFIG_VERSION, seed, JSON.stringify(snapshot), clientVersion],
  );

  return {
    battleId,
    seed,
    configVersion: CONFIG_VERSION,
    serverStartedAt: Date.now(),
    lineupSnapshot: snapshot,
    rules: {
      waves: 20,
      maxDurationMs: 420_000,
    },
  };
}

function validateBattleResult(body: any) {
  const flags: string[] = [];
  const wave = Math.max(0, Math.floor(Number(body.wave) || 0));
  const durationMs = Math.max(0, Math.floor(Number(body.durationMs) || 0));
  const kills = Math.max(0, Math.floor(Number(body.kills) || 0));

  if (wave > 20) flags.push("wave_over_limit");
  if (durationMs < 20_000 && wave >= 10) flags.push("duration_too_short");
  if (durationMs > 600_000) flags.push("duration_too_long");
  if (kills > 900) flags.push("kills_over_limit");

  return { flags, wave, durationMs, kills };
}

async function handleBattleFinish(auth: AuthContext, body: any) {
  const battleId = String(body.battleId || "");
  if (!battleId) throw createApiError("INVALID_BATTLE_SESSION", "battleId is required.", 400);

  const session = await pool.query(`select id, state from ${q("gm_battle_sessions")} where id = $1 and user_id = $2`, [battleId, auth.userId]);
  if (!session.rowCount) throw createApiError("INVALID_BATTLE_SESSION", "Battle session does not exist.", 404);

  const { flags, wave, durationMs, kills } = validateBattleResult(body);
  const result = body.result === "win" ? "win" : "lose";
  const selectedUpgrades = Array.isArray(body.selectedUpgrades) ? body.selectedUpgrades : [];
  const clientSummary = typeof body.clientSummary === "object" && body.clientSummary ? body.clientSummary : {};
  const acceptedRewards = typeof body.acceptedRewards === "object" && body.acceptedRewards ? body.acceptedRewards : {};

  await pool.query(
    `
      update ${q("gm_battle_sessions")}
      set state = 'finished',
          finished_at = now(),
          risk_score = $3
      where id = $1 and user_id = $2
    `,
    [battleId, auth.userId, flags.length],
  );

  await pool.query(
    `
      insert into ${q("gm_battle_results")}
        (battle_id, result, wave, duration_ms, kills, selected_upgrades, client_summary, accepted_rewards, validation_flags)
      values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb)
      on conflict (battle_id) do update
      set result = excluded.result,
          wave = excluded.wave,
          duration_ms = excluded.duration_ms,
          kills = excluded.kills,
          selected_upgrades = excluded.selected_upgrades,
          client_summary = excluded.client_summary,
          accepted_rewards = excluded.accepted_rewards,
          validation_flags = excluded.validation_flags
    `,
    [
      battleId,
      result,
      wave,
      durationMs,
      kills,
      JSON.stringify(selectedUpgrades),
      JSON.stringify(clientSummary),
      JSON.stringify(acceptedRewards),
      JSON.stringify(flags),
    ],
  );

  return {
    accepted: flags.length === 0,
    validationFlags: flags,
    acceptedRewards,
  };
}

function sanitizePvpRankMode(value: unknown): PvpRankMode {
  if (value === "power_duel" || value === "battle_royale") return value;
  return "duel";
}

function clampServerNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function optionalServerNumber(value: unknown, min: number, max: number) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return undefined;
  return Math.max(min, Math.min(max, number));
}

function sanitizePvpRankSummary(value: unknown) {
  const summary = typeof value === "object" && value ? (value as Record<string, unknown>) : {};
  return {
    wave: clampServerNumber(summary.wave, 1, 20, 1),
    kills: clampServerNumber(summary.kills, 0, 1200, 0),
    baseHp: clampServerNumber(summary.baseHp, 0, 999, 0),
    maxBaseHp: clampServerNumber(summary.maxBaseHp, 1, 999, 10),
    pressureSent: clampServerNumber(summary.pressureSent, 0, 5000, 0),
    pressureTaken: clampServerNumber(summary.pressureTaken, 0, 5000, 0),
    opponentRating: optionalServerNumber(summary.opponentRating, 1, 999999),
    disconnected: Boolean(summary.disconnected),
    abnormal: Boolean(summary.abnormal),
    repeatedOpponent: Boolean(summary.repeatedOpponent),
    placementRank: optionalServerNumber(summary.placementRank, 1, 100),
    playerCount: optionalServerNumber(summary.playerCount, 2, 100),
    extracted: Boolean(summary.extracted),
    lootValue: clampServerNumber(summary.lootValue, 0, 999999, 0),
    matchId: String(summary.matchId || "").slice(0, 80),
    ticketId: String(summary.ticketId || "").slice(0, 80),
    opponentType: String(summary.opponentType || "").slice(0, 20),
  };
}

function pvpCoinRewardForRankSummary(summary: ReturnType<typeof sanitizePvpRankSummary>, result: "win" | "lose") {
  const base = result === "win" ? 120 : 45;
  const waveBonus = Math.min(72, Math.max(0, summary.wave - 1) * 7);
  const killBonus = Math.min(80, Math.floor(summary.kills / 6));
  const pressureBonus = Math.min(36, Math.floor(summary.pressureSent / 18));
  return base + waveBonus + killBonus + pressureBonus;
}

async function handlePvpRankFinish(auth: AuthContext, body: any) {
  const mode = sanitizePvpRankMode(body.mode);
  const result = body.result === "lose" ? "lose" : "win";
  const summary = sanitizePvpRankSummary(body.summary);

  return withTransaction(async (client) => {
    let player = await client.query(`select revision, snapshot from ${q("gm_player_states")} where user_id = $1 for update`, [auth.userId]);
    if (!player.rowCount) {
      const fallback = normalizeIncomingSave(defaultSave());
      player = await client.query(
        `
          insert into ${q("gm_player_states")} (user_id, schema_version, revision, snapshot)
          values ($1, 1, 1, $2::jsonb)
          returning revision, snapshot
        `,
        [auth.userId, JSON.stringify(fallback)],
      );
    }

    const save = normalizeIncomingSave(player.rows[0].snapshot);
    const rankResult = applyPvpRankResult(save.pvpRanks[mode], result, {
      mode,
      opponentRating: summary.opponentRating,
      disconnected: summary.disconnected,
      abnormal: summary.abnormal,
      repeatedOpponent: summary.repeatedOpponent,
      wave: summary.wave,
      kills: summary.kills,
      pressureSent: summary.pressureSent,
      pressureTaken: summary.pressureTaken,
      baseHp: summary.baseHp,
      maxBaseHp: summary.maxBaseHp,
      placementRank: summary.placementRank,
      playerCount: summary.playerCount,
      extracted: summary.extracted,
      lootValue: summary.lootValue,
    });
    const pvpCoins = rankResult.abnormal ? 0 : pvpCoinRewardForRankSummary(summary, result);

    save.pvpRanks[mode] = rankResult.profile;
    save.pvpCoins = Math.max(0, Math.floor(Number(save.pvpCoins) || 0)) + pvpCoins;

    const saved = await client.query(
      `
        update ${q("gm_player_states")}
        set revision = revision + 1,
            snapshot = $2::jsonb,
            updated_at = now()
        where user_id = $1
        returning revision, snapshot
      `,
      [auth.userId, JSON.stringify(normalizeIncomingSave(save))],
    );

    if (!rankResult.abnormal) {
      await upsertPvpLeaderboardEntry(client, auth.userId, mode, rankResult.profile);
    }

    return {
      ok: true,
      mode,
      result,
      pvpCoins,
      summary,
      rankResult,
      playerRevision: Number(saved.rows[0].revision),
      playerState: normalizeIncomingSave(saved.rows[0].snapshot),
    };
  });
}

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  if (req.method === "OPTIONS") {
    sendJson(req, res, 204, null);
    return;
  }

  const url = new URL(req.url || "/", env.siteUrl);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (req.method === "GET" && (path === "/health" || path === "/api/health")) {
    sendJson(req, res, 200, { ok: true, serverTime: Date.now(), configVersion: CONFIG_VERSION });
    return;
  }

  if (req.method === "POST" && path === "/api/auth/guest") {
    const body = await readJson(req);
    sendJson(req, res, 200, await handleAuthGuest(body));
    return;
  }

  if (req.method === "POST" && path === "/api/auth/register") {
    const body = await readJson(req);
    sendJson(req, res, 200, await handleAuthRegister(body));
    return;
  }

  if (req.method === "POST" && path === "/api/auth/login") {
    const body = await readJson(req);
    sendJson(req, res, 200, await handleAuthLogin(body));
    return;
  }

  if (req.method === "POST" && path === "/api/pvp/ai/start") {
    const body = await readJson(req);
    sendJson(req, res, 200, await handlePvpAiStart(req, body));
    return;
  }

  if (req.method === "POST" && path === "/api/pvp/match/start") {
    const body = await readJson(req);
    sendJson(req, res, 200, await handlePvpMatchStart(req, body));
    return;
  }

  const pvpMatchStatusMatch = /^\/api\/pvp\/match\/([^/]+)$/.exec(path);
  if (req.method === "GET" && pvpMatchStatusMatch) {
    sendJson(req, res, 200, await handlePvpMatchStatus(decodeURIComponent(pvpMatchStatusMatch[1])));
    return;
  }

  const pvpMatchCancelMatch = /^\/api\/pvp\/match\/([^/]+)\/cancel$/.exec(path);
  if (req.method === "POST" && pvpMatchCancelMatch) {
    sendJson(req, res, 200, await handlePvpMatchCancel(decodeURIComponent(pvpMatchCancelMatch[1])));
    return;
  }

  const pvpMatchSnapshotMatch = /^\/api\/pvp\/matches\/([^/]+)\/snapshot$/.exec(path);
  if (req.method === "POST" && pvpMatchSnapshotMatch) {
    const body = await readJson(req);
    sendJson(req, res, 200, await handlePvpMatchSnapshot(decodeURIComponent(pvpMatchSnapshotMatch[1]), body));
    return;
  }

  const pvpMatchPressureMatch = /^\/api\/pvp\/matches\/([^/]+)\/pressure$/.exec(path);
  if (req.method === "POST" && pvpMatchPressureMatch) {
    const body = await readJson(req);
    sendJson(req, res, 200, await handlePvpMatchPressure(decodeURIComponent(pvpMatchPressureMatch[1]), body));
    return;
  }

  const pvpMatchFinishMatch = /^\/api\/pvp\/matches\/([^/]+)\/finish$/.exec(path);
  if (req.method === "POST" && pvpMatchFinishMatch) {
    const body = await readJson(req);
    sendJson(req, res, 200, await handlePvpMatchFinish(decodeURIComponent(pvpMatchFinishMatch[1]), body));
    return;
  }

  const pvpMatchChatMatch = /^\/api\/pvp\/matches\/([^/]+)\/chat$/.exec(path);
  if (req.method === "POST" && pvpMatchChatMatch) {
    const body = await readJson(req);
    sendJson(req, res, 200, await handlePvpMatchChat(decodeURIComponent(pvpMatchChatMatch[1]), body));
    return;
  }

  const pvpAiSnapshotMatch = /^\/api\/pvp\/ai\/([^/]+)\/snapshot$/.exec(path);
  if (req.method === "GET" && pvpAiSnapshotMatch) {
    sendJson(req, res, 200, await handlePvpAiSnapshot(decodeURIComponent(pvpAiSnapshotMatch[1])));
    return;
  }

  const pvpAiPressureMatch = /^\/api\/pvp\/ai\/([^/]+)\/pressure$/.exec(path);
  if (req.method === "POST" && pvpAiPressureMatch) {
    const body = await readJson(req);
    sendJson(req, res, 200, await handlePvpAiPressure(decodeURIComponent(pvpAiPressureMatch[1]), body));
    return;
  }

  const pvpAiChatMatch = /^\/api\/pvp\/ai\/([^/]+)\/chat$/.exec(path);
  if (req.method === "POST" && pvpAiChatMatch) {
    const body = await readJson(req);
    sendJson(req, res, 200, await handlePvpAiChat(decodeURIComponent(pvpAiChatMatch[1]), body));
    return;
  }

  const auth = await requireAuth(req);

  if (req.method === "GET" && path === "/api/bootstrap") {
    sendJson(req, res, 200, await handleBootstrap(auth));
    return;
  }

  if (req.method === "GET" && path === "/api/activities") {
    const bootstrap = await handleBootstrap(auth);
    sendJson(req, res, 200, { activities: bootstrap.activities, serverTime: bootstrap.serverTime });
    return;
  }

  if (req.method === "GET" && path === "/api/leaderboards") {
    sendJson(req, res, 200, await handleLeaderboardCatalog(auth));
    return;
  }

  const leaderboardMeMatch = /^\/api\/leaderboards\/([^/]+)\/me$/.exec(path);
  if (req.method === "GET" && leaderboardMeMatch) {
    sendJson(req, res, 200, await handleLeaderboardMe(auth, decodeURIComponent(leaderboardMeMatch[1]), url.searchParams));
    return;
  }

  const leaderboardMatch = /^\/api\/leaderboards\/([^/]+)$/.exec(path);
  if (req.method === "GET" && leaderboardMatch) {
    sendJson(req, res, 200, await handleLeaderboardList(auth, decodeURIComponent(leaderboardMatch[1]), url.searchParams));
    return;
  }

  if (req.method === "PUT" && path === "/api/profile") {
    const body: any = await readJson(req);
    const response = await withIdempotency(auth.userId, body.opId, "PUT /api/profile", () => handleProfileUpdate(auth, body));
    sendJson(req, res, 200, response);
    return;
  }

  if (req.method === "PUT" && path === "/api/player/state") {
    const body: any = await readJson(req);
    const response = await withIdempotency(auth.userId, body.opId, "PUT /api/player/state", () => handleSaveState(auth, body));
    sendJson(req, res, 200, response);
    return;
  }

  if (req.method === "POST" && path === "/api/redeem-code") {
    const body: any = await readJson(req);
    sendJson(req, res, 200, await handleRedeemCode(auth, body));
    return;
  }

  if (req.method === "POST" && path === "/api/pvp/rank/finish") {
    const body: any = await readJson(req);
    const response = await withIdempotency(auth.userId, body.opId, "POST /api/pvp/rank/finish", () => handlePvpRankFinish(auth, body));
    sendJson(req, res, 200, response);
    return;
  }

  if (req.method === "POST" && path === "/api/battle/start") {
    const body: any = await readJson(req);
    const response = await withIdempotency(auth.userId, body.opId, "POST /api/battle/start", () => handleBattleStart(auth, body, req));
    sendJson(req, res, 200, response);
    return;
  }

  if (req.method === "POST" && path === "/api/battle/finish") {
    const body: any = await readJson(req);
    const response = await withIdempotency(auth.userId, body.opId, "POST /api/battle/finish", () => handleBattleFinish(auth, body));
    sendJson(req, res, 200, response);
    return;
  }

  sendJson(req, res, 404, { code: "NOT_FOUND", message: `No route for ${req.method} ${path}` });
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error: ApiError | Error) => {
    const status = "status" in error && error.status ? error.status : 500;
    const code = "code" in error ? error.code : "SERVER_ERROR";
    const message = status >= 500 ? "Internal server error." : error.message;
    if (status >= 500) console.error(error);
    sendJson(req, res, status, { code, message });
  });
});

server.listen(env.port, "0.0.0.0", () => {
  console.log(`Game Marbles API listening on ${env.siteUrl} (schema=${env.dbSchema})`);
});

process.on("SIGINT", async () => {
  server.close();
  await pool.end();
  process.exit(0);
});
