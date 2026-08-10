import http from "node:http";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { applyRuntimeContentConfig, cosmeticConfigs, cosmeticPools } from "../../src/config/cosmetics";
import { defaultSave, normalizeSave } from "../../src/state/save";
import type { PvpRankMode, SaveData, ShopReward } from "../../src/core/types";
import { applyPvpRankResult, pvpRankDisplayLabel, pvpRankRecordText } from "../../src/systems/pvp/rank";
import { pool, q, withTransaction } from "./db";
import { env } from "./env";
import {
  handleLeaderboardCatalog,
  handleLeaderboardList,
  handleLeaderboardMe,
  upsertPvpLeaderboardEntry,
  upsertSnapshotLeaderboardEntries,
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

type AdminAuthContext = {
  adminId: string;
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

type AdminProfile = {
  adminId: string;
  username: string;
  nickname: string;
  role: string;
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
const CONFIG_RELEASE_ENVS = new Set(["test", "gray", "production"]);
const CONFIG_RELEASE_STATUSES = new Set(["published", "scheduled", "archived"]);
const CONFIG_MODULE_LABELS: Record<string, string> = {
  marble: "弹珠幻化",
  character: "角色服装",
  hero: "角色设计",
  skill: "技能设计",
  tactic: "战术设计",
  enemy: "怪物设计",
  stage: "关卡设计",
  gacha: "抽卡池",
  shop: "商店投放",
};
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
  if (password.length < 6 || password.length > 64) {
    throw createApiError("INVALID_PASSWORD", "密码需为 6-64 位。", 400);
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

function sanitizeConfigEnvironment(value: unknown) {
  const environment = String(value || "test").trim().toLowerCase();
  return CONFIG_RELEASE_ENVS.has(environment) ? environment : "test";
}

function sanitizeConfigReleaseStatus(value: unknown) {
  const status = String(value || "published").trim().toLowerCase();
  return CONFIG_RELEASE_STATUSES.has(status) ? status : "published";
}

function cleanConfigText(value: unknown, fallback: string, maxLength: number) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  return (text || fallback).slice(0, maxLength);
}

function isoDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const time = new Date(String(value)).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
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

    if (reward.type === "allMarbleCosmetics") {
      rewards.push({ type: "allMarbleCosmetics" });
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

    if (reward.type === "allMarbleCosmetics") {
      save.cosmetics.owned ||= {};
      const itemIds = cosmeticPools.marble.itemIds.filter((id) => cosmeticConfigs[id]?.type === "marble");
      let newlyUnlocked = 0;
      for (const id of itemIds) {
        if ((save.cosmetics.owned[id] || 0) <= 0) newlyUnlocked += 1;
        save.cosmetics.owned[id] = Math.max(1, save.cosmetics.owned[id] || 0);
      }
      labels.push(`弹珠幻化全套 ${itemIds.length} 件${newlyUnlocked > 0 ? `（新增 ${newlyUnlocked}）` : ""}`);
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

function rowToAdminProfile(row: any): AdminProfile {
  return {
    adminId: row.id,
    username: row.username || "",
    nickname: row.nickname || "管理员",
    role: row.role || "operator",
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

async function requireAdminAuth(req: IncomingMessage): Promise<AdminAuthContext> {
  const header = req.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(Array.isArray(header) ? header[0] : header);
  if (!match) throw createApiError("ADMIN_UNAUTHORIZED", "Missing admin bearer token.", 401);

  const hash = tokenHash(match[1]);
  const result = await pool.query(
    `
      update ${q("gm_admin_sessions")}
      set last_seen_at = now()
      where token_hash = $1 and expires_at > now()
      returning admin_id
    `,
    [hash],
  );

  if (!result.rowCount) throw createApiError("ADMIN_UNAUTHORIZED", "Invalid or expired admin token.", 401);
  return { adminId: result.rows[0].admin_id, tokenHash: hash };
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

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function sanitizeAdminUserStatus(value: unknown) {
  const status = String(value || "active").trim().toLowerCase();
  if (status === "active" || status === "banned" || status === "disabled") return status;
  throw createApiError("INVALID_USER_STATUS", "用户状态不正确。", 400);
}

function sanitizeRedeemCodeStatus(value: unknown) {
  const status = String(value || "active").trim().toLowerCase();
  if (status === "active" || status === "draft" || status === "paused" || status === "disabled") return status;
  throw createApiError("INVALID_REDEEM_CODE_STATUS", "兑换码状态不正确。", 400);
}

function sanitizeOptionalDate(value: unknown, field: string) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw createApiError("INVALID_DATE", `${field} 时间格式不正确。`, 400);
  return date.toISOString();
}

function assertUuid(value: string, code = "INVALID_USER_ID") {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw createApiError(code, "用户 ID 格式不正确。", 400);
  }
  return value;
}

function adminUserRuntimeStatus(row: any) {
  const bannedUntil = row.banned_until ? new Date(row.banned_until).getTime() : 0;
  if (row.status === "disabled") return "disabled";
  if (row.status === "banned" || bannedUntil > Date.now()) return "banned";
  return "active";
}

function adminSaveSummary(snapshot: unknown) {
  const save = normalizeIncomingSave(snapshot || defaultSave());
  const ownedCharacters = Object.values(save.characters || {}).filter((item: any) => Boolean(item?.owned)).length;
  const ownedCosmetics = Object.values(save.cosmetics?.owned || {}).filter((count) => Number(count) > 0).length;
  const clearedStages = Object.values(save.progress?.clearedStages || {}).filter((stage: any) => Boolean(stage?.cleared)).length;
  const duelRank = save.pvpRanks?.duel;
  const battleRoyaleRank = save.pvpRanks?.battle_royale;

  return {
    coins: Math.max(0, Math.floor(Number(save.coins) || 0)),
    energyCrystals: Math.max(0, Math.floor(Number(save.energyCrystals) || 0)),
    pvpCoins: Math.max(0, Math.floor(Number(save.pvpCoins) || 0)),
    runs: Math.max(0, Math.floor(Number(save.runs) || 0)),
    wins: Math.max(0, Math.floor(Number(save.wins) || 0)),
    bestWave: Math.max(0, Math.floor(Number(save.bestWave) || 0)),
    bestEndlessWave: Math.max(0, Math.floor(Number(save.bestEndlessWave) || 0)),
    selectedStage: save.selectedStage,
    clearedStages,
    unlockedStage: Math.max(1, Math.floor(Number(save.progress?.unlockedStage) || 1)),
    ownedCharacters,
    ownedCosmetics,
    duelRank: duelRank ? pvpRankDisplayLabel(duelRank) : "未定级",
    duelRecord: duelRank ? pvpRankRecordText(duelRank) : "0胜 0负",
    battleRoyaleRank: battleRoyaleRank ? pvpRankDisplayLabel(battleRoyaleRank) : "未定级",
  };
}

function rowToAdminManagedUser(row: any) {
  return {
    userId: row.id,
    username: row.username || "",
    guestId: row.guest_id || "",
    nickname: row.nickname || defaultNickname(row.id),
    avatar: row.avatar || "avatar_green",
    isGuest: !row.username,
    status: adminUserRuntimeStatus(row),
    rawStatus: row.status || "active",
    bannedUntil: row.banned_until || null,
    createdAt: row.created_at || null,
    lastLoginAt: row.last_login_at || null,
    lastSeenAt: row.last_seen_at || null,
    activeSessions: Number(row.active_sessions || 0),
    playerRevision: Number(row.revision || 0),
    playerUpdatedAt: row.state_updated_at || null,
    summary: adminSaveSummary(row.snapshot),
  };
}

function redeemRewardLabel(reward: ShopReward) {
  if (reward.type === "coins") return `金币 ${reward.amount}`;
  if (reward.type === "pvpCoins") return `竞技币 ${reward.amount}`;
  if (reward.type === "energyCrystals") return `能源晶体 ${reward.amount}`;
  if (reward.type === "marbleShard") return `${MARBLE_LABELS[reward.marbleId]}碎片 ${reward.amount}`;
  if (reward.type === "randomMarbleShard") return `随机弹珠碎片 ${reward.amount}`;
  if (reward.type === "gem") return `${GEM_LABELS[reward.gemType]} Lv.${reward.level} x${reward.amount}`;
  if (reward.type === "collectible") return `${COLLECTIBLE_LABELS[reward.collectibleId]} ${reward.amount}`;
  if (reward.type === "characterUnlock") return `${CHARACTER_LABELS[reward.characterId as keyof typeof CHARACTER_LABELS]} 解锁`;
  if (reward.type === "ticket") return `${TICKET_LABELS[reward.ticketId]} ${reward.amount}`;
  if (reward.type === "allMarbleCosmetics") return "弹珠幻化全套";
  return "奖励";
}

function rowToAdminRedeemCode(row: any) {
  const rewards = normalizeRedeemRewards(row.rewards);
  const maxUses = row.max_uses === null || row.max_uses === undefined ? null : Number(row.max_uses);
  const usedCount = Number(row.used_count || 0);
  return {
    code: row.code,
    id: row.code,
    title: row.title || row.code,
    status: row.status || "draft",
    startsAt: row.starts_at || null,
    endsAt: row.ends_at || null,
    maxUses,
    usedCount,
    remaining: maxUses === null ? null : Math.max(0, maxUses - usedCount),
    rewards,
    rewardLabels: rewards.map(redeemRewardLabel),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function adminRedeemWhereClause(searchParams: URLSearchParams) {
  const where: string[] = [];
  const params: unknown[] = [];
  const status = String(searchParams.get("status") || "all").trim().toLowerCase();
  const query = String(searchParams.get("query") || "").trim().toUpperCase().slice(0, 64);

  if (query) {
    params.push(`%${query}%`);
    const index = params.length;
    where.push(`(upper(code) like $${index} or upper(title) like $${index})`);
  }

  if (status === "active" || status === "draft" || status === "paused" || status === "disabled") {
    params.push(status);
    where.push(`status = $${params.length}`);
  } else if (status === "expired") {
    where.push(`ends_at is not null and ends_at <= now()`);
  } else if (status !== "all") {
    throw createApiError("INVALID_REDEEM_CODE_STATUS_FILTER", "兑换码状态筛选不正确。", 400);
  }

  return {
    whereSql: where.length ? `where ${where.join(" and ")}` : "",
    params,
    status,
    query,
  };
}

async function handleAdminRedeemCodesList(searchParams: URLSearchParams) {
  const limit = clampInteger(searchParams.get("limit"), 10, 100, 50);
  const offset = clampInteger(searchParams.get("offset"), 0, 100_000, 0);
  const filter = adminRedeemWhereClause(searchParams);
  const count = await pool.query(`select count(*)::int as count from ${q("gm_redeem_codes")} ${filter.whereSql}`, filter.params);
  const params = [...filter.params, limit, offset];
  const result = await pool.query(
    `
      select
        c.code,
        c.title,
        c.status,
        c.starts_at,
        c.ends_at,
        c.max_uses,
        c.rewards,
        c.created_at,
        c.updated_at,
        coalesce(r.used_count, 0)::int as used_count
      from ${q("gm_redeem_codes")} c
      left join lateral (
        select count(*)::int as used_count
        from ${q("gm_redeem_redemptions")}
        where code = c.code
      ) r on true
      ${filter.whereSql}
      order by c.updated_at desc, c.created_at desc, c.code asc
      limit $${params.length - 1}
      offset $${params.length}
    `,
    params,
  );

  return {
    codes: result.rows.map(rowToAdminRedeemCode),
    total: Number(count.rows[0]?.count || 0),
    limit,
    offset,
    query: filter.query,
    status: filter.status,
    serverTime: Date.now(),
  };
}

async function handleAdminRedeemCodeDetail(codeValue: string) {
  const code = sanitizeRedeemCode(codeValue);
  const result = await pool.query(
    `
      select
        c.code,
        c.title,
        c.status,
        c.starts_at,
        c.ends_at,
        c.max_uses,
        c.rewards,
        c.created_at,
        c.updated_at,
        coalesce(r.used_count, 0)::int as used_count
      from ${q("gm_redeem_codes")} c
      left join lateral (
        select count(*)::int as used_count
        from ${q("gm_redeem_redemptions")}
        where code = c.code
      ) r on true
      where c.code = $1
    `,
    [code],
  );
  if (!result.rowCount) throw createApiError("REDEEM_CODE_NOT_FOUND", "兑换码不存在。", 404);
  const redemptions = await pool.query(
    `
      select
        r.user_id,
        r.reward_labels,
        r.redeemed_at,
        u.username,
        u.nickname,
        u.guest_id
      from ${q("gm_redeem_redemptions")} r
      left join ${q("gm_users")} u on u.id = r.user_id
      where r.code = $1
      order by r.redeemed_at desc
      limit 30
    `,
    [code],
  );

  return {
    code: rowToAdminRedeemCode(result.rows[0]),
    redemptions: redemptions.rows.map((row) => ({
      userId: row.user_id,
      username: row.username || "",
      guestId: row.guest_id || "",
      nickname: row.nickname || defaultNickname(String(row.user_id || "")),
      rewardLabels: Array.isArray(row.reward_labels) ? row.reward_labels : [],
      redeemedAt: row.redeemed_at || null,
    })),
    serverTime: Date.now(),
  };
}

async function handleAdminSaveRedeemCode(pathCode: string | null, body: any) {
  const code = sanitizeRedeemCode(pathCode || body.code);
  if (pathCode && body.code && sanitizeRedeemCode(body.code) !== code) {
    throw createApiError("REDEEM_CODE_IMMUTABLE", "兑换码创建后不能改码，请新建兑换码。", 400);
  }
  const title = String(body.title || "").trim().slice(0, 48);
  if (!title) throw createApiError("INVALID_REDEEM_TITLE", "请输入兑换码标题。", 400);
  const status = sanitizeRedeemCodeStatus(body.status);
  const startsAt = sanitizeOptionalDate(body.startsAt ?? body.starts_at, "开始");
  const endsAt = sanitizeOptionalDate(body.endsAt ?? body.ends_at, "结束");
  if (startsAt && endsAt && new Date(startsAt).getTime() >= new Date(endsAt).getTime()) {
    throw createApiError("INVALID_REDEEM_TIME_RANGE", "结束时间必须晚于开始时间。", 400);
  }
  const maxUsesRaw = body.maxUses ?? body.max_uses;
  const maxUses =
    maxUsesRaw === null || maxUsesRaw === undefined || String(maxUsesRaw).trim() === ""
      ? null
      : Math.max(1, Math.min(1_000_000, Math.floor(Number(maxUsesRaw) || 0)));
  const rewards = normalizeRedeemRewards(body.rewards);
  if (rewards.length <= 0) throw createApiError("REDEEM_CODE_EMPTY", "至少配置 1 个有效奖励。", 400);

  await pool.query(
    `
      insert into ${q("gm_redeem_codes")} (code, title, status, starts_at, ends_at, max_uses, rewards, updated_at)
      values ($1, $2, $3, $4, $5, $6, $7::jsonb, now())
      on conflict (code) do update
      set title = excluded.title,
          status = excluded.status,
          starts_at = excluded.starts_at,
          ends_at = excluded.ends_at,
          max_uses = excluded.max_uses,
          rewards = excluded.rewards,
          updated_at = now()
    `,
    [code, title, status, startsAt, endsAt, maxUses, JSON.stringify(rewards)],
  );

  return handleAdminRedeemCodeDetail(code);
}

function adminUserWhereClause(searchParams: URLSearchParams) {
  const where: string[] = [];
  const params: unknown[] = [];
  const status = String(searchParams.get("status") || "all").trim().toLowerCase();
  const query = String(searchParams.get("query") || "").trim().toLowerCase().slice(0, 64);

  if (query) {
    params.push(`%${query}%`);
    const index = params.length;
    where.push(
      `(lower(coalesce(u.username, '')) like $${index} or lower(coalesce(u.nickname, '')) like $${index} or lower(coalesce(u.guest_id, '')) like $${index} or u.id::text like $${index})`,
    );
  }

  if (status === "active") {
    where.push(`u.status = 'active' and (u.banned_until is null or u.banned_until <= now())`);
  } else if (status === "banned") {
    where.push(`(u.status = 'banned' or u.banned_until > now())`);
  } else if (status === "disabled") {
    where.push(`u.status = 'disabled'`);
  } else if (status !== "all") {
    throw createApiError("INVALID_USER_STATUS_FILTER", "用户状态筛选不正确。", 400);
  }

  return {
    whereSql: where.length ? `where ${where.join(" and ")}` : "",
    params,
    status,
    query,
  };
}

async function handleAdminUsersList(searchParams: URLSearchParams) {
  const limit = clampInteger(searchParams.get("limit"), 10, 80, 40);
  const offset = clampInteger(searchParams.get("offset"), 0, 100_000, 0);
  const filter = adminUserWhereClause(searchParams);
  const count = await pool.query(`select count(*)::int as count from ${q("gm_users")} u ${filter.whereSql}`, filter.params);
  const params = [...filter.params, limit, offset];
  const result = await pool.query(
    `
      select
        u.id,
        u.username,
        u.guest_id,
        u.nickname,
        u.avatar,
        u.status,
        u.banned_until,
        u.created_at,
        u.last_login_at,
        ps.revision,
        ps.updated_at as state_updated_at,
        ps.snapshot,
        sess.last_seen_at,
        sess.active_sessions
      from ${q("gm_users")} u
      left join ${q("gm_player_states")} ps on ps.user_id = u.id
      left join lateral (
        select max(last_seen_at) as last_seen_at, count(*)::int as active_sessions
        from ${q("gm_auth_sessions")}
        where user_id = u.id and expires_at > now()
      ) sess on true
      ${filter.whereSql}
      order by u.last_login_at desc nulls last, u.created_at desc
      limit $${params.length - 1}
      offset $${params.length}
    `,
    params,
  );

  return {
    users: result.rows.map(rowToAdminManagedUser),
    total: Number(count.rows[0]?.count || 0),
    limit,
    offset,
    query: filter.query,
    status: filter.status,
    serverTime: Date.now(),
  };
}

async function handleAdminUserDetail(userId: string) {
  assertUuid(userId);
  const result = await pool.query(
    `
      select
        u.id,
        u.username,
        u.guest_id,
        u.nickname,
        u.avatar,
        u.status,
        u.banned_until,
        u.created_at,
        u.last_login_at,
        ps.revision,
        ps.updated_at as state_updated_at,
        ps.snapshot,
        sess.last_seen_at,
        sess.active_sessions
      from ${q("gm_users")} u
      left join ${q("gm_player_states")} ps on ps.user_id = u.id
      left join lateral (
        select max(last_seen_at) as last_seen_at, count(*)::int as active_sessions
        from ${q("gm_auth_sessions")}
        where user_id = u.id and expires_at > now()
      ) sess on true
      where u.id = $1
    `,
    [userId],
  );
  if (!result.rowCount) throw createApiError("USER_NOT_FOUND", "用户不存在。", 404);
  return { user: rowToAdminManagedUser(result.rows[0]), serverTime: Date.now() };
}

async function handleAdminUpdateUserProfile(userId: string, body: any) {
  assertUuid(userId);
  const nickname = sanitizeNickname(body.nickname, userId);
  const avatar = sanitizeAvatar(body.avatar);
  const result = await pool.query(
    `
      update ${q("gm_users")}
      set nickname = $2,
          avatar = $3
      where id = $1
      returning id
    `,
    [userId, nickname, avatar],
  );
  if (!result.rowCount) throw createApiError("USER_NOT_FOUND", "用户不存在。", 404);
  return handleAdminUserDetail(userId);
}

async function handleAdminUpdateUserStatus(userId: string, body: any) {
  assertUuid(userId);
  const status = sanitizeAdminUserStatus(body.status);
  const banHours = clampInteger(body.banHours, 1, 24 * 365, 24);
  const bannedUntil = status === "banned" ? new Date(Date.now() + banHours * 60 * 60 * 1000).toISOString() : null;
  const result = await pool.query(
    `
      update ${q("gm_users")}
      set status = $2,
          banned_until = $3
      where id = $1
      returning id
    `,
    [userId, status, bannedUntil],
  );
  if (!result.rowCount) throw createApiError("USER_NOT_FOUND", "用户不存在。", 404);
  if (status !== "active") {
    await pool.query(`delete from ${q("gm_auth_sessions")} where user_id = $1`, [userId]);
  }
  return handleAdminUserDetail(userId);
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

async function createAdminSession(adminId: string) {
  const token = createToken();
  await pool.query(
    `
      insert into ${q("gm_admin_sessions")} (token_hash, admin_id, expires_at)
      values ($1, $2, now() + interval '12 hours')
      on conflict (token_hash) do update set last_seen_at = now()
    `,
    [tokenHash(token), adminId],
  );
  return token;
}

async function getAdminProfile(adminId: string) {
  const result = await pool.query(`select id, username, nickname, role from ${q("gm_admin_users")} where id = $1 and status = 'active'`, [adminId]);
  if (!result.rowCount) throw createApiError("ADMIN_NOT_FOUND", "Admin user does not exist.", 404);
  return rowToAdminProfile(result.rows[0]);
}

async function savePlayerState(userId: string, state: SaveData) {
  await loadRuntimeContentConfig(env.configEnvironment);
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
  await upsertSnapshotLeaderboardEntries(pool, userId, normalized);

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
  const contentConfig = await loadRuntimeContentConfig(env.configEnvironment);
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
    configVersion: contentConfig?.configVersion || CONFIG_VERSION,
    contentConfig,
  };
}

async function handleAuthLogin(body: any) {
  const username = sanitizeUsername(body.username);
  const password = sanitizePassword(body.password);
  const deviceId = String(body.deviceId || randomUUID()).slice(0, 160);
  const contentConfig = await loadRuntimeContentConfig(env.configEnvironment);
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
    configVersion: contentConfig?.configVersion || CONFIG_VERSION,
    contentConfig,
  };
}

async function handleAdminLogin(body: any) {
  const username = sanitizeUsername(body.username);
  const password = sanitizePassword(body.password);
  const result = await pool.query(
    `
      select id, username, nickname, role, password_hash, password_salt
      from ${q("gm_admin_users")}
      where lower(username) = $1 and status = 'active'
    `,
    [username],
  );

  if (!result.rowCount) throw createApiError("INVALID_ADMIN_CREDENTIALS", "管理员账号或密码错误。", 401);
  const row = result.rows[0];
  if (!verifyPassword(password, row.password_salt, row.password_hash)) {
    throw createApiError("INVALID_ADMIN_CREDENTIALS", "管理员账号或密码错误。", 401);
  }

  await pool.query(`update ${q("gm_admin_users")} set last_login_at = now() where id = $1`, [row.id]);
  const token = await createAdminSession(row.id);
  return {
    admin: rowToAdminProfile(row),
    accessToken: token,
    serverTime: Date.now(),
  };
}

function normalizeConfigReleaseBundle(value: unknown) {
  if (!value || typeof value !== "object") {
    throw createApiError("INVALID_CONFIG_BUNDLE", "配置包格式不正确。", 400);
  }
  const raw = value as Record<string, any>;
  const configVersion = cleanConfigText(raw.configVersion, `content-${Date.now()}`, 96);
  const title = cleanConfigText(raw.title, "内容配置发布", 80);
  const environment = sanitizeConfigEnvironment(raw.environment);
  const mode = raw.mode === "scheduled" ? "scheduled" : "now";
  const scheduledAt = mode === "scheduled" ? isoDate(raw.scheduledAt) || new Date(Date.now() + 60 * 60 * 1000).toISOString() : null;
  const modules = raw.modules && typeof raw.modules === "object" ? raw.modules : {};
  const totalItems = Object.values(modules).reduce((sum, module: any) => sum + (Array.isArray(module?.items) ? module.items.length : 0), 0);
  if (totalItems <= 0) {
    throw createApiError("EMPTY_CONFIG_BUNDLE", "没有可发布的配置项。", 400);
  }

  return {
    ...raw,
    configVersion,
    title,
    environment,
    mode,
    scheduledAt,
    createdAt: isoDate(raw.createdAt) || new Date().toISOString(),
    summary: {
      modules: Object.keys(modules).length,
      totalItems,
      byModule:
        raw.summary?.byModule && typeof raw.summary.byModule === "object"
          ? raw.summary.byModule
          : Object.fromEntries(Object.entries(modules).map(([moduleId, module]) => [moduleId, Array.isArray((module as any)?.items) ? (module as any).items.length : 0])),
    },
    modules,
  };
}

function rowToAdminConfigRelease(row: any) {
  return {
    id: row.id,
    kind: "release",
    title: row.title,
    configVersion: row.config_version,
    environment: row.environment,
    status: row.status,
    createdAt: isoDate(row.created_at),
    publishedAt: isoDate(row.published_at),
    author: row.author_username || row.author_nickname || "",
    bundle: row.bundle && typeof row.bundle === "object" ? row.bundle : {},
  };
}

async function handleAdminConfigReleasesList(searchParams: URLSearchParams) {
  const limit = Math.max(1, Math.min(60, Number(searchParams.get("limit")) || 30));
  const environment = searchParams.get("environment") ? sanitizeConfigEnvironment(searchParams.get("environment")) : "";
  const rawStatus = String(searchParams.get("status") || "").trim().toLowerCase();
  const status = rawStatus && rawStatus !== "all" ? sanitizeConfigReleaseStatus(rawStatus) : "";
  const where: string[] = [];
  const params: unknown[] = [];
  if (environment) {
    params.push(environment);
    where.push(`r.environment = $${params.length}`);
  }
  if (status && status !== "all") {
    params.push(status);
    where.push(`r.status = $${params.length}`);
  }
  const whereSql = where.length ? `where ${where.join(" and ")}` : "";
  params.push(limit);

  const result = await pool.query(
    `
      select
        r.id,
        r.config_version,
        r.title,
        r.environment,
        r.status,
        r.bundle,
        r.created_at,
        r.published_at,
        a.username as author_username,
        a.nickname as author_nickname
      from ${q("gm_config_releases")} r
      left join ${q("gm_admin_users")} a on a.id = r.created_by
      ${whereSql}
      order by r.created_at desc
      limit $${params.length}
    `,
    params,
  );

  return {
    releases: result.rows.map(rowToAdminConfigRelease),
    total: result.rows.length,
    serverTime: Date.now(),
  };
}

async function handleAdminConfigReleaseDetail(id: string) {
  const releaseId = cleanConfigText(id, "", 96).replace(/[^a-zA-Z0-9_-]/g, "");
  if (!releaseId) throw createApiError("INVALID_RELEASE_ID", "发布版本 ID 不正确。", 400);
  const result = await pool.query(
    `
      select
        r.id,
        r.config_version,
        r.title,
        r.environment,
        r.status,
        r.bundle,
        r.created_at,
        r.published_at,
        a.username as author_username,
        a.nickname as author_nickname
      from ${q("gm_config_releases")} r
      left join ${q("gm_admin_users")} a on a.id = r.created_by
      where r.id = $1
    `,
    [releaseId],
  );
  if (!result.rowCount) throw createApiError("CONFIG_RELEASE_NOT_FOUND", "发布版本不存在。", 404);
  return { release: rowToAdminConfigRelease(result.rows[0]), serverTime: Date.now() };
}

async function handleAdminCreateConfigRelease(auth: AdminAuthContext, body: any) {
  const bundle = normalizeConfigReleaseBundle(body.bundle || body);
  const id = `release_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const status = bundle.mode === "scheduled" ? "scheduled" : "published";
  const publishedAt = bundle.mode === "scheduled" ? bundle.scheduledAt : new Date().toISOString();

  const result = await pool.query(
    `
      insert into ${q("gm_config_releases")}
        (id, config_version, title, environment, status, bundle, created_by, published_at)
      values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
      returning id, config_version, title, environment, status, bundle, created_at, published_at
    `,
    [id, bundle.configVersion, bundle.title, bundle.environment, status, JSON.stringify(bundle), auth.adminId, publishedAt],
  );

  return {
    release: rowToAdminConfigRelease({ ...result.rows[0], author_username: "" }),
    serverTime: Date.now(),
  };
}

function mergeRuntimeContentConfig(rows: any[], environment: string) {
  if (!rows.length) return null;
  const moduleMaps = new Map<string, Map<string, any>>();
  for (const row of rows) {
    const bundle = row.bundle && typeof row.bundle === "object" ? row.bundle : {};
    const modules = bundle.modules && typeof bundle.modules === "object" ? bundle.modules : {};
    for (const [moduleId, modulePayload] of Object.entries(modules)) {
      const items = Array.isArray((modulePayload as any)?.items) ? (modulePayload as any).items : [];
      if (!moduleMaps.has(moduleId)) moduleMaps.set(moduleId, new Map());
      const itemMap = moduleMaps.get(moduleId)!;
      for (const item of items) {
        const id = cleanConfigText(item?.id || item?.config?.id, "", 96);
        if (!id) continue;
        itemMap.set(id, {
          id,
          config: item?.config || item,
        });
      }
    }
  }

  const latest = rows[rows.length - 1];
  const modules = Object.fromEntries(
    Array.from(moduleMaps.entries()).map(([moduleId, itemMap]) => [
      moduleId,
      {
        label: CONFIG_MODULE_LABELS[moduleId] || moduleId,
        items: Array.from(itemMap.values()),
      },
    ]),
  );
  const totalItems = Object.values(modules).reduce((sum, module: any) => sum + (Array.isArray(module.items) ? module.items.length : 0), 0);

  return {
    configVersion: latest.config_version || CONFIG_VERSION,
    title: latest.title || "内容配置",
    environment,
    mode: "compiled",
    createdAt: isoDate(latest.created_at),
    publishedAt: isoDate(latest.published_at),
    summary: {
      modules: Object.keys(modules).length,
      totalItems,
      byModule: Object.fromEntries(Object.entries(modules).map(([moduleId, module]: any) => [moduleId, module.items.length])),
    },
    modules,
  };
}

async function loadRuntimeContentConfig(environment: string) {
  const result = await pool.query(
    `
      select id, config_version, title, environment, status, bundle, created_at, published_at
      from ${q("gm_config_releases")}
      where environment = $1
        and status in ('published', 'scheduled')
        and (published_at is null or published_at <= now())
      order by coalesce(published_at, created_at) asc, created_at asc
    `,
    [sanitizeConfigEnvironment(environment)],
  );
  const contentConfig = mergeRuntimeContentConfig(result.rows, sanitizeConfigEnvironment(environment));
  if (contentConfig) applyRuntimeContentConfig(contentConfig);
  return contentConfig;
}

async function handleAuthGuest(body: any) {
  const deviceId = String(body.deviceId || body.guestId || randomUUID()).slice(0, 160);
  const contentConfig = await loadRuntimeContentConfig(env.configEnvironment);
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
    configVersion: contentConfig?.configVersion || CONFIG_VERSION,
    contentConfig,
  };
}

async function handleBootstrap(auth: AuthContext) {
  const contentConfig = await loadRuntimeContentConfig(env.configEnvironment);
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
    configVersion: contentConfig?.configVersion || CONFIG_VERSION,
    baseConfigVersion: CONFIG_VERSION,
    contentConfig,
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
  await loadRuntimeContentConfig(env.configEnvironment);
  const state = normalizeIncomingSave(body.state);
  const saved = await savePlayerState(auth.userId, state);
  return {
    ok: true,
    playerRevision: saved.revision,
    playerState: saved.snapshot,
  };
}

async function handleRedeemCode(auth: AuthContext, body: any) {
  await loadRuntimeContentConfig(env.configEnvironment);
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

    await upsertSnapshotLeaderboardEntries(client, auth.userId, normalizeIncomingSave(save));

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
  await loadRuntimeContentConfig(env.configEnvironment);
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
    await upsertSnapshotLeaderboardEntries(client, auth.userId, normalizeIncomingSave(save));

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

  if (req.method === "POST" && path === "/api/admin/login") {
    const body = await readJson(req);
    sendJson(req, res, 200, await handleAdminLogin(body));
    return;
  }

  if (path.startsWith("/api/admin/")) {
    const adminAuth = await requireAdminAuth(req);
    if (req.method === "GET" && path === "/api/admin/session") {
      sendJson(req, res, 200, { admin: await getAdminProfile(adminAuth.adminId), serverTime: Date.now() });
      return;
    }
    if (req.method === "GET" && path === "/api/admin/config-releases") {
      sendJson(req, res, 200, await handleAdminConfigReleasesList(url.searchParams));
      return;
    }
    if (req.method === "POST" && path === "/api/admin/config-releases") {
      const body = await readJson(req);
      sendJson(req, res, 200, await handleAdminCreateConfigRelease(adminAuth, body));
      return;
    }
    const adminConfigReleaseMatch = /^\/api\/admin\/config-releases\/([^/]+)$/i.exec(path);
    if (req.method === "GET" && adminConfigReleaseMatch) {
      sendJson(req, res, 200, await handleAdminConfigReleaseDetail(decodeURIComponent(adminConfigReleaseMatch[1])));
      return;
    }
    if (req.method === "GET" && path === "/api/admin/users") {
      sendJson(req, res, 200, await handleAdminUsersList(url.searchParams));
      return;
    }
    if (req.method === "GET" && path === "/api/admin/redeem-codes") {
      sendJson(req, res, 200, await handleAdminRedeemCodesList(url.searchParams));
      return;
    }
    if (req.method === "POST" && path === "/api/admin/redeem-codes") {
      const body = await readJson(req);
      sendJson(req, res, 200, await handleAdminSaveRedeemCode(null, body));
      return;
    }
    const adminRedeemCodeMatch = /^\/api\/admin\/redeem-codes\/([^/]+)$/i.exec(path);
    if (req.method === "GET" && adminRedeemCodeMatch) {
      sendJson(req, res, 200, await handleAdminRedeemCodeDetail(decodeURIComponent(adminRedeemCodeMatch[1])));
      return;
    }
    if (req.method === "POST" && adminRedeemCodeMatch) {
      const body = await readJson(req);
      sendJson(req, res, 200, await handleAdminSaveRedeemCode(decodeURIComponent(adminRedeemCodeMatch[1]), body));
      return;
    }
    const adminUserMatch = /^\/api\/admin\/users\/([0-9a-f-]{36})$/i.exec(path);
    if (req.method === "GET" && adminUserMatch) {
      sendJson(req, res, 200, await handleAdminUserDetail(adminUserMatch[1]));
      return;
    }
    const adminUserProfileMatch = /^\/api\/admin\/users\/([0-9a-f-]{36})\/profile$/i.exec(path);
    if (req.method === "POST" && adminUserProfileMatch) {
      const body = await readJson(req);
      sendJson(req, res, 200, await handleAdminUpdateUserProfile(adminUserProfileMatch[1], body));
      return;
    }
    const adminUserStatusMatch = /^\/api\/admin\/users\/([0-9a-f-]{36})\/status$/i.exec(path);
    if (req.method === "POST" && adminUserStatusMatch) {
      const body = await readJson(req);
      sendJson(req, res, 200, await handleAdminUpdateUserStatus(adminUserStatusMatch[1], body));
      return;
    }
    sendJson(req, res, 404, { code: "NOT_FOUND", message: `No admin route for ${req.method} ${path}` });
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
