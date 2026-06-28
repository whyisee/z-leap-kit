import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { PvpPressureType } from "../../src/core/types";

type ApiError = {
  code: string;
  message: string;
  status?: number;
};

type MatchMode = "duel" | "battle_royale";
type MatchStatus = "queued" | "matched" | "cancelled";
type OpponentType = "player" | "server_ai";

type MatchProfile = {
  id: string;
  name: string;
  avatar: string;
  color: string;
  rank: string;
  rankScore: number;
};

type MatchTicket = {
  id: string;
  mode: MatchMode;
  status: MatchStatus;
  opponentType: OpponentType | null;
  matchId: string | null;
  deviceId: string;
  createdAt: number;
  updatedAt: number;
  profile: MatchProfile;
  lineup: string[];
  opponentTicketId: string | null;
};

type MatchEvent = {
  seq: number;
  kind: "system" | "battle" | "chat" | "pressure" | "result";
  from: string;
  text: string;
  color: string;
  pressureType?: PvpPressureType;
  result?: "win" | "lose";
};

type MatchResult = {
  winnerTicketId: string;
  loserTicketId: string;
  reason: string;
  decidedAt: number;
};

type PlayerMatch = {
  id: string;
  mode: MatchMode;
  createdAt: number;
  ticketIds: [string, string];
  snapshots: Record<string, any>;
  snapshotTimes: Record<string, number>;
  events: Record<string, MatchEvent[]>;
  nextSeq: Record<string, number>;
  result: MatchResult | null;
};

const MATCH_TIMEOUT_MS = 5_000;
const QUEUE_ACTIVE_MS = MATCH_TIMEOUT_MS + 1_000;
const SNAPSHOT_STALE_MS = 4_000;
const TICKET_TTL_MS = 90_000;
const MATCH_TTL_MS = 30 * 60_000;
const tickets = new Map<string, MatchTicket>();
const queue: string[] = [];
const matches = new Map<string, PlayerMatch>();

export async function handlePvpMatchStart(req: IncomingMessage, body: any) {
  cleanupMatchmaking();
  const ticket = createTicket(req, body);
  cancelQueuedTicketsForDevice(ticket.deviceId);

  const opponent = findQueuedOpponent(ticket);
  tickets.set(ticket.id, ticket);
  if (opponent) {
    pairTickets(ticket, opponent);
  } else {
    queue.push(ticket.id);
  }

  return ticketResponse(ticket);
}

export async function handlePvpMatchStatus(ticketId: string) {
  cleanupMatchmaking();
  const ticket = requireTicket(ticketId);
  if (ticket.status === "queued") ticket.updatedAt = Date.now();
  if (ticket.status === "queued" && Date.now() - ticket.createdAt >= MATCH_TIMEOUT_MS) {
    removeFromQueue(ticket.id);
    ticket.status = "matched";
    ticket.opponentType = "server_ai";
    ticket.updatedAt = Date.now();
  }
  return ticketResponse(ticket);
}

export async function handlePvpMatchCancel(ticketId: string) {
  const ticket = requireTicket(ticketId);
  if (ticket.status === "queued") {
    ticket.status = "cancelled";
    ticket.updatedAt = Date.now();
    removeFromQueue(ticket.id);
  }
  return ticketResponse(ticket);
}

export async function handlePvpMatchSnapshot(matchId: string, body: any) {
  const { match, ticket } = requireMatchAndTicket(matchId, body.ticketId);
  const opponentTicket = opponentTicketFor(match, ticket.id);
  ticket.updatedAt = Date.now();
  if (body.snapshot && typeof body.snapshot === "object") {
    match.snapshots[ticket.id] = sanitizePlayerSnapshot(body.snapshot, ticket.profile, ticket.lineup);
    match.snapshotTimes[ticket.id] = Date.now();
  }

  return playerSnapshotResponse(match, ticket, opponentTicket);
}

export async function handlePvpMatchFinish(matchId: string, body: any) {
  const { match, ticket } = requireMatchAndTicket(matchId, body.ticketId);
  const opponentTicket = opponentTicketFor(match, ticket.id);
  ticket.updatedAt = Date.now();
  opponentTicket.updatedAt = Date.now();

  if (body.snapshot && typeof body.snapshot === "object") {
    match.snapshots[ticket.id] = sanitizePlayerSnapshot(body.snapshot, ticket.profile, ticket.lineup);
    match.snapshotTimes[ticket.id] = Date.now();
  }

  if (!match.result) {
    const reportedResult = body.result === "lose" ? "lose" : "win";
    const winnerTicketId = reportedResult === "lose" ? opponentTicket.id : ticket.id;
    const loserTicketId = reportedResult === "lose" ? ticket.id : opponentTicket.id;
    const winnerTicket = tickets.get(winnerTicketId);
    const loserTicket = tickets.get(loserTicketId);
    const reason = sanitizeText(body.reason, 40) || "PVP 对战结束";
    match.result = {
      winnerTicketId,
      loserTicketId,
      reason,
      decidedAt: Date.now(),
    };

    if (winnerTicket) {
      pushMatchEvent(match, winnerTicket.id, {
        kind: "result",
        from: "对战",
        text: "PVP 对战获胜",
        color: "#61e6a8",
        result: "win",
      });
    }
    if (loserTicket) {
      pushMatchEvent(match, loserTicket.id, {
        kind: "result",
        from: "对战",
        text: "PVP 对战失败",
        color: "#ff6c7e",
        result: "lose",
      });
    }
  }

  return playerSnapshotResponse(match, ticket, opponentTicket);
}

export async function handlePvpMatchPressure(matchId: string, body: any) {
  const { match, ticket } = requireMatchAndTicket(matchId, body.ticketId);
  const opponentTicket = opponentTicketFor(match, ticket.id);
  const pressureType = sanitizePressureType(body.pressureType);
  pushMatchEvent(match, opponentTicket.id, {
    kind: "pressure",
    from: ticket.profile.name,
    text: `${ticket.profile.name} 发送压力。`,
    color: "#f6c95f",
    pressureType,
  });
  pushMatchEvent(match, ticket.id, {
    kind: "battle",
    from: "对战",
    text: `已向 ${opponentTicket.profile.name} 发送压力。`,
    color: "#f6c95f",
  });
  return playerSnapshotResponse(match, ticket, opponentTicket);
}

export async function handlePvpMatchChat(matchId: string, body: any) {
  const { match, ticket } = requireMatchAndTicket(matchId, body.ticketId);
  const opponentTicket = opponentTicketFor(match, ticket.id);
  const text = sanitizeText(body.text, 80) || "……";
  const event = {
    kind: "chat" as const,
    from: sanitizeText(body.from, 12) || ticket.profile.name,
    text,
    color: "#61e6a8",
  };
  pushMatchEvent(match, ticket.id, event);
  pushMatchEvent(match, opponentTicket.id, event);
  return playerSnapshotResponse(match, ticket, opponentTicket);
}

function createTicket(req: IncomingMessage, body: any): MatchTicket {
  const deviceId = sanitizeText(body.deviceId || req.headers["x-device-id"] || randomUUID(), 160) || randomUUID();
  const mode = sanitizeMode(body.mode);
  const now = Date.now();
  const playerId = sanitizeText(body.userId || deviceId, 80) || deviceId;
  return {
    id: randomUUID(),
    mode,
    status: "queued",
    opponentType: null,
    matchId: null,
    deviceId,
    createdAt: now,
    updatedAt: now,
    profile: {
      id: playerId,
      name: sanitizeText(body.nickname, 12) || `玩家${playerId.slice(0, 4).toUpperCase()}`,
      avatar: sanitizeAvatar(body.avatar),
      color: sanitizeColor(body.color) || "#61e6a8",
      rank: sanitizeText(body.rank, 12) || "青铜 III",
      rankScore: sanitizeRankScore(body.rankScore),
    },
    lineup: Array.isArray(body.lineup) ? body.lineup.map((item: unknown) => sanitizeText(item, 40)).filter(Boolean).slice(0, 3) : [],
    opponentTicketId: null,
  };
}

function findQueuedOpponent(ticket: MatchTicket) {
  const now = Date.now();
  for (const id of queue) {
    const opponent = tickets.get(id);
    if (!opponent || opponent.status !== "queued") continue;
    if (now - opponent.updatedAt > QUEUE_ACTIVE_MS) {
      opponent.status = "cancelled";
      removeFromQueue(opponent.id);
      continue;
    }
    if (opponent.mode !== ticket.mode) continue;
    if (opponent.deviceId === ticket.deviceId) continue;
    if (!rankInMatchRange(ticket, opponent, now)) continue;
    return opponent;
  }
  return null;
}

function rankInMatchRange(ticket: MatchTicket, opponent: MatchTicket, now: number) {
  if (ticket.mode !== "duel") return true;
  const waitMs = Math.max(now - ticket.createdAt, now - opponent.createdAt);
  const maxDistance = waitMs < 1_500 ? 120 : waitMs < 3_500 ? 240 : waitMs < 5_000 ? 420 : 999999;
  return Math.abs(ticket.profile.rankScore - opponent.profile.rankScore) <= maxDistance;
}

function pairTickets(a: MatchTicket, b: MatchTicket) {
  const matchId = randomUUID();
  const match: PlayerMatch = {
    id: matchId,
    mode: a.mode,
    createdAt: Date.now(),
    ticketIds: [a.id, b.id],
    snapshots: {},
    snapshotTimes: {},
    events: {
      [a.id]: [],
      [b.id]: [],
    },
    nextSeq: {
      [a.id]: 1,
      [b.id]: 1,
    },
    result: null,
  };

  a.status = "matched";
  a.opponentType = "player";
  a.matchId = matchId;
  a.opponentTicketId = b.id;
  a.updatedAt = Date.now();

  b.status = "matched";
  b.opponentType = "player";
  b.matchId = matchId;
  b.opponentTicketId = a.id;
  b.updatedAt = Date.now();

  removeFromQueue(b.id);
  matches.set(matchId, match);
  pushMatchEvent(match, a.id, {
    kind: "system",
    from: "系统",
    text: `已匹配对手：${b.profile.name}`,
    color: "#61e6a8",
  });
  pushMatchEvent(match, b.id, {
    kind: "system",
    from: "系统",
    text: `已匹配对手：${a.profile.name}`,
    color: "#61e6a8",
  });
}

function ticketResponse(ticket: MatchTicket) {
  const opponent = ticket.opponentTicketId ? tickets.get(ticket.opponentTicketId) : null;
  return {
    ticketId: ticket.id,
    mode: ticket.mode,
    status: ticket.status,
    opponentType: ticket.opponentType,
    matchId: ticket.matchId,
    waitMs: Math.max(0, Date.now() - ticket.createdAt),
    timeoutMs: MATCH_TIMEOUT_MS,
    fallbackAt: ticket.createdAt + MATCH_TIMEOUT_MS,
    serverTime: Date.now(),
    message: ticketMessage(ticket),
    opponent: opponent ? { ...opponent.profile, lineup: opponent.lineup } : null,
  };
}

function ticketMessage(ticket: MatchTicket) {
  if (ticket.status === "cancelled") return "匹配已取消。";
  if (ticket.status === "matched") return "匹配成功，正在进入对战。";
  return "正在匹配对手。";
}

function playerSnapshotResponse(match: PlayerMatch, ticket: MatchTicket, opponentTicket: MatchTicket) {
  const opponent = opponentSnapshotFor(match, opponentTicket);
  const events = match.events[ticket.id] || [];
  match.events[ticket.id] = [];
  return {
    sessionId: match.id,
    serverTime: Date.now(),
    opponent,
    events,
  };
}

function opponentSnapshotFor(match: PlayerMatch, opponentTicket: MatchTicket) {
  const snapshot = match.snapshots[opponentTicket.id];
  const snapshotAt = match.snapshotTimes[opponentTicket.id] || 0;
  const now = Date.now();
  if (snapshot) {
    if (now - snapshotAt <= SNAPSHOT_STALE_MS) return snapshot;
    return {
      ...snapshot,
      statusText: "同步中",
      lastEvent: "等待同步",
      eventTimer: 1.2,
    };
  }
  return placeholderSnapshot(opponentTicket.profile, opponentTicket.lineup);
}

function placeholderSnapshot(profile: MatchProfile, lineup: string[] = []) {
  return {
    id: profile.id,
    name: profile.name,
    avatar: profile.avatar,
    lineup: sanitizeLineup(lineup),
    color: profile.color,
    rankScore: profile.rankScore,
    hp: 10,
    maxHp: 10,
    wave: 1,
    kills: 0,
    pressure: 0,
    pressureTaken: 0,
    lootValue: 0,
    eliminated: false,
    statusText: "等待对手",
    lastEvent: "对手已连接",
    eventTimer: 1.8,
    fieldDensity: 0.05,
    bossHpRatio: 1,
    miniEnemies: [],
    miniMarbles: [],
    miniEntities: 1,
  };
}

function sanitizePlayerSnapshot(snapshot: any, fallback: MatchProfile, fallbackLineup: string[] = []) {
  const result = placeholderSnapshot(fallback, fallbackLineup);
  const numbers = ["hp", "maxHp", "wave", "kills", "pressure", "pressureTaken", "lootValue", "fieldDensity", "bossHpRatio", "miniEntities"];
  for (const key of numbers) {
    if (Number.isFinite(Number(snapshot[key]))) (result as any)[key] = Number(snapshot[key]);
  }
  result.id = fallback.id;
  result.name = sanitizeText(snapshot.name, 12) || fallback.name;
  result.avatar = sanitizeAvatar(snapshot.avatar || fallback.avatar);
  result.lineup = sanitizeLineup(Array.isArray(snapshot.lineup) && snapshot.lineup.length > 0 ? snapshot.lineup : fallbackLineup);
  result.color = sanitizeColor(snapshot.color) || fallback.color;
  result.rankScore = fallback.rankScore;
  result.eliminated = Boolean(snapshot.eliminated);
  result.statusText = sanitizeText(snapshot.statusText, 18) || "玩家推进";
  result.lastEvent = sanitizeText(snapshot.lastEvent, 24) || "同步中";
  result.eventTimer = Math.max(0, Math.min(3, Number(snapshot.eventTimer) || 0));
  result.miniEnemies = Array.isArray(snapshot.miniEnemies) ? snapshot.miniEnemies.slice(0, 48) : [];
  result.miniMarbles = Array.isArray(snapshot.miniMarbles) ? snapshot.miniMarbles.slice(0, 32) : [];
  return result;
}

function sanitizeLineup(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => sanitizeText(item, 40)).filter(Boolean).slice(0, 3);
}

function pushMatchEvent(match: PlayerMatch, ticketId: string, event: Omit<MatchEvent, "seq">) {
  const seq = match.nextSeq[ticketId] || 1;
  match.nextSeq[ticketId] = seq + 1;
  match.events[ticketId] ||= [];
  match.events[ticketId].push({ seq, ...event });
  match.events[ticketId] = match.events[ticketId].slice(-20);
}

function requireTicket(ticketId: string) {
  cleanupMatchmaking();
  const ticket = tickets.get(ticketId);
  if (!ticket) throw apiError("PVP_MATCH_NOT_FOUND", "PVP match ticket does not exist.", 404);
  return ticket;
}

function requireMatchAndTicket(matchId: string, ticketId: string) {
  cleanupMatchmaking();
  const match = matches.get(matchId);
  if (!match) throw apiError("PVP_MATCH_NOT_FOUND", "PVP match does not exist.", 404);
  const ticket = tickets.get(ticketId);
  if (!ticket || !match.ticketIds.includes(ticket.id)) throw apiError("PVP_MATCH_FORBIDDEN", "Ticket does not belong to this match.", 403);
  return { match, ticket };
}

function opponentTicketFor(match: PlayerMatch, ticketId: string) {
  const opponentId = match.ticketIds.find((id) => id !== ticketId);
  const opponent = opponentId ? tickets.get(opponentId) : null;
  if (!opponent) throw apiError("PVP_OPPONENT_NOT_FOUND", "Opponent ticket does not exist.", 404);
  return opponent;
}

function cancelQueuedTicketsForDevice(deviceId: string) {
  for (const ticket of tickets.values()) {
    if (ticket.deviceId !== deviceId || ticket.status !== "queued") continue;
    ticket.status = "cancelled";
    ticket.updatedAt = Date.now();
    removeFromQueue(ticket.id);
  }
}

function removeFromQueue(ticketId: string) {
  const index = queue.indexOf(ticketId);
  if (index >= 0) queue.splice(index, 1);
}

function cleanupMatchmaking() {
  const now = Date.now();
  for (const ticket of tickets.values()) {
    if (ticket.status === "queued" && now - ticket.createdAt > TICKET_TTL_MS) {
      ticket.status = "cancelled";
      removeFromQueue(ticket.id);
    }
    if (ticket.status !== "queued" && now - ticket.updatedAt > MATCH_TTL_MS) {
      tickets.delete(ticket.id);
    }
  }
  for (const match of matches.values()) {
    if (now - match.createdAt > MATCH_TTL_MS) matches.delete(match.id);
  }
}

function sanitizeMode(value: unknown): MatchMode {
  return value === "battle_royale" ? "battle_royale" : "duel";
}

function sanitizePressureType(value: unknown): PvpPressureType {
  const text = String(value || "small_reinforce");
  if (["small_reinforce", "fast_raid", "shield_boost", "elite_drop", "boss_boost"].includes(text)) {
    return text as PvpPressureType;
  }
  return "small_reinforce";
}

function sanitizeText(value: unknown, max: number) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function sanitizeAvatar(value: unknown) {
  const avatar = sanitizeText(value || "engineer", 32);
  return /^[a-z0-9_-]{1,32}$/i.test(avatar) ? avatar : "engineer";
}

function sanitizeColor(value: unknown) {
  const color = sanitizeText(value, 16);
  return /^#[0-9a-f]{6}$/i.test(color) ? color : "";
}

function sanitizeRankScore(value: unknown) {
  const score = Math.floor(Number(value));
  return Number.isFinite(score) ? clamp(score, 0, 999999) : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function apiError(code: string, message: string, status = 400): ApiError {
  return { code, message, status };
}
