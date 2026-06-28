import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { enemyConfigs } from "../../src/config/enemies";
import type { EnemyType, PvpMiniEnemy, PvpMiniMarble, PvpPressureType } from "../../src/core/types";

type ApiError = {
  code: string;
  message: string;
  status?: number;
};

type PvpServerEvent = {
  seq: number;
  kind: "system" | "battle" | "chat" | "pressure" | "result";
  from: string;
  text: string;
  color: string;
  pressureType?: PvpPressureType;
  result?: "win" | "lose";
};

type ServerPvpOpponent = {
  id: string;
  name: string;
  avatar: string;
  lineup: string[];
  color: string;
  hp: number;
  maxHp: number;
  wave: number;
  kills: number;
  pressure: number;
  pressureTaken: number;
  lootValue: number;
  eliminated: boolean;
  statusText: string;
  lastEvent: string;
  eventTimer: number;
  fieldDensity: number;
  bossHpRatio: number;
  miniEnemies: PvpMiniEnemy[];
  miniMarbles: PvpMiniMarble[];
  miniSpawnTimer: number;
  miniShotTimer: number;
  miniEntities: number;
};

type ServerPvpAiSession = {
  id: string;
  createdAt: number;
  lastTick: number;
  deviceId: string;
  stageId: string;
  lineup: string[];
  nextSeq: number;
  opponent: ServerPvpOpponent;
  events: PvpServerEvent[];
};

const PVP_SESSION_TTL_MS = 30 * 60 * 1000;
const PVP_PRESSURE_COST = 60;
const pvpAiSessions = new Map<string, ServerPvpAiSession>();

export async function handlePvpAiStart(req: IncomingMessage, body: any) {
  cleanupPvpAiSessions();

  const now = Date.now();
  const session: ServerPvpAiSession = {
    id: randomUUID(),
    createdAt: now,
    lastTick: now,
    deviceId: String(body.deviceId || req.headers["x-device-id"] || "").slice(0, 160),
    stageId: String(body.stageId || "stage-1").slice(0, 80),
    lineup: Array.isArray(body.lineup) ? body.lineup.map((item: unknown) => String(item).slice(0, 40)).slice(0, 3) : [],
    nextSeq: 1,
    opponent: createServerOpponent(),
    events: [],
  };

  pushPvpEvent(session, {
    kind: "system",
    from: "系统",
    text: "已连接对手。",
    color: "#61e6a8",
  });
  pushPvpEvent(session, {
    kind: "battle",
    from: "对战",
    text: "对手战场正在推进。",
    color: "#9fb4d9",
  });

  pvpAiSessions.set(session.id, session);
  prewarmPvpAiSession(session, 0.9);
  return pvpAiSnapshot(session);
}

export async function handlePvpAiSnapshot(sessionId: string) {
  const session = requirePvpAiSession(sessionId);
  advancePvpAiSession(session);
  return pvpAiSnapshot(session);
}

export async function handlePvpAiPressure(sessionId: string, body: any) {
  const session = requirePvpAiSession(sessionId);
  const pressureType = sanitizePressureType(body.pressureType);
  const power = clamp(Math.floor(Number(body.power) || PVP_PRESSURE_COST), 1, 120);
  applyPressureToServerOpponent(session, pressureType, power);
  advancePvpAiSession(session);
  return pvpAiSnapshot(session);
}

export async function handlePvpAiChat(sessionId: string, body: any) {
  const session = requirePvpAiSession(sessionId);
  const text = sanitizeChatText(body.text);
  const from = sanitizeChatName(body.from || body.nickname || "我方");
  pushPvpEvent(session, {
    kind: "chat",
    from,
    text,
    color: "#61e6a8",
  });
  advancePvpAiSession(session);
  return pvpAiSnapshot(session);
}

function createServerOpponent(): ServerPvpOpponent {
  const avatars = ["bomber", "magnetist", "prism", "alchemist", "frostseer", "voidbinder"];
  const colors = ["#f6c95f", "#54c7ff", "#d58cff", "#ff7b5f", "#61e6a8"];
  const index = Math.floor(Math.random() * avatars.length);
  const lineups = [
    ["bomber", "magnetist", "sentinel"],
    ["prism", "alchemist", "frostseer"],
    ["voidbinder", "treasurer", "engineer"],
    ["sentinel", "frostseer", "bomber"],
    ["magnetist", "prism", "alchemist"],
    ["voidbinder", "sentinel", "treasurer"],
  ];

  return {
    id: `server-ai-${index + 1}`,
    name: "对手",
    avatar: avatars[index],
    lineup: lineups[index % lineups.length],
    color: colors[index % colors.length],
    hp: 10,
    maxHp: 10,
    wave: 1,
    kills: 0,
    pressure: 14,
    pressureTaken: 0,
    lootValue: 0,
    eliminated: false,
    statusText: "对战推进",
    lastEvent: "正在同步",
    eventTimer: 1.8,
    fieldDensity: 0.08,
    bossHpRatio: 1,
    miniEnemies: [],
    miniMarbles: [],
    miniSpawnTimer: 0.25,
    miniShotTimer: 0.32,
    miniEntities: 1,
  };
}

function requirePvpAiSession(sessionId: string) {
  cleanupPvpAiSessions();
  const session = pvpAiSessions.get(sessionId);
  if (!session) throw apiError("PVP_SESSION_NOT_FOUND", "PVP session does not exist.", 404);
  return session;
}

function advancePvpAiSession(session: ServerPvpAiSession) {
  const now = Date.now();
  let remaining = Math.min(2.5, Math.max(0, (now - session.lastTick) / 1000));
  session.lastTick = now;

  while (remaining > 0) {
    const step = Math.min(0.05, remaining);
    updateServerOpponent(session, step);
    remaining -= step;
  }
}

function prewarmPvpAiSession(session: ServerPvpAiSession, seconds: number) {
  let remaining = Math.max(0, seconds);
  while (remaining > 0) {
    const step = Math.min(0.05, remaining);
    updateServerOpponent(session, step);
    remaining -= step;
  }
  session.lastTick = Date.now();
}

function updateServerOpponent(session: ServerPvpAiSession, dt: number) {
  const opponent = session.opponent;
  if (opponent.eliminated) return;

  opponent.eventTimer = Math.max(0, opponent.eventTimer - dt);
  opponent.wave = clamp(Math.floor((Date.now() - session.createdAt) / 17_000) + 1, 1, 10);
  opponent.miniSpawnTimer -= dt * (1 + opponent.wave * 0.03);
  opponent.miniShotTimer -= dt;

  if (opponent.miniSpawnTimer <= 0) {
    spawnServerMiniEnemy(opponent, opponent.wave);
    opponent.miniSpawnTimer = clamp(0.95 - opponent.wave * 0.045 - opponent.pressureTaken * 0.0008, 0.28, 0.95);
  }

  if (opponent.miniShotTimer <= 0) {
    spawnServerMiniMarble(opponent, opponent.wave);
    opponent.miniShotTimer = clamp(0.55 - opponent.wave * 0.018, 0.26, 0.58);
  }

  for (const enemy of opponent.miniEnemies) {
    enemy.y += enemy.speed * dt;
    if (enemy.y > 1.04) {
      enemy.hp = 0;
      opponent.hp = Math.max(0, opponent.hp - (enemy.type === "elite" || enemy.type === "boss" ? 2 : 1));
      opponent.pressureTaken += 18;
      opponent.lastEvent = "敌人突破防线";
      opponent.eventTimer = 1.6;
    }
  }

  for (const marble of opponent.miniMarbles) {
    marble.life -= dt;
    marble.x += marble.vx * dt;
    marble.y += marble.vy * dt;
    if (marble.x < 0.06 || marble.x > 0.94) {
      marble.vx *= -1;
      marble.x = clamp(marble.x, 0.06, 0.94);
    }
    if (marble.y < 0.04) {
      marble.vy = Math.abs(marble.vy);
      marble.y = 0.04;
    }
    marble.trail.push({ x: marble.x, y: marble.y });
    if (marble.trail.length > 8) marble.trail.shift();

    for (const enemy of opponent.miniEnemies) {
      if (enemy.hp <= 0) continue;
      const dist = Math.hypot(enemy.x - marble.x, enemy.y - marble.y);
      if (dist <= enemy.radius + marble.radius) {
        enemy.hp -= marble.damage;
        marble.vx *= -0.72;
        marble.vy *= -0.72;
        if (enemy.hp <= 0) {
          opponent.kills += 1;
          opponent.pressure += enemy.type === "elite" ? 16 : enemy.type === "boss" ? 42 : enemy.type === "fast" ? 2 : 1.4;
        }
        break;
      }
    }
  }

  opponent.miniEnemies = opponent.miniEnemies.filter((enemy) => enemy.hp > 0).slice(-34);
  opponent.miniMarbles = opponent.miniMarbles.filter((marble) => marble.life > 0 && marble.y < 1.08).slice(-28);

  if (opponent.wave >= 10 && !opponent.miniEnemies.some((enemy) => enemy.type === "boss")) {
    spawnServerMiniEnemy(opponent, opponent.wave, "boss");
  }

  if (opponent.pressure >= PVP_PRESSURE_COST + 8) {
    opponent.pressure -= PVP_PRESSURE_COST;
    const pressureType = pickServerPressureType(opponent.wave);
    const label = pvpPressureLabel(pressureType);
    opponent.lastEvent = `发送 ${label}`;
    opponent.eventTimer = 2.4;
    pushPvpEvent(session, {
      kind: "pressure",
      from: opponent.name,
      text: label,
      color: "#ff9f43",
      pressureType,
    });
  }

  opponent.lootValue = Math.floor(opponent.kills * 0.42 + opponent.wave * 8);
  opponent.fieldDensity = clamp(opponent.miniEnemies.length / 22, 0.05, 1);
  opponent.bossHpRatio = opponent.wave >= 10 ? bossRatioForOpponent(opponent) : 1;
  opponent.statusText = opponent.hp <= 3 ? "防线危险" : opponent.pressure >= PVP_PRESSURE_COST ? "准备施压" : "对战推进";

  if (opponent.hp <= 0 && !opponent.eliminated) {
    opponent.eliminated = true;
    opponent.statusText = "已淘汰";
    opponent.lastEvent = "防线崩溃";
    opponent.eventTimer = 3;
    pushPvpEvent(session, {
      kind: "result",
      from: "对战",
      text: `${opponent.name} 防线崩溃。`,
      color: "#ff6c7e",
      result: "win",
    });
  }
}

function spawnServerMiniEnemy(opponent: ServerPvpOpponent, wave: number, forcedType?: EnemyType) {
  const type = forcedType || miniEnemyTypeForWave(wave, opponent.pressureTaken);
  const config = enemyConfigs[type];
  const radius = type === "boss" ? 0.095 : type === "elite" ? 0.064 : config.radius / 650;
  const maxHp = type === "boss" ? 260 + wave * 18 : type === "elite" ? 92 + wave * 9 : 18 + wave * 4 + (config.armor || 0) * 16;
  const lane = opponent.miniEntities % 5;
  opponent.miniEntities += 1;
  opponent.miniEnemies.push({
    id: opponent.miniEntities,
    type,
    x: 0.16 + lane * 0.17 + Math.sin(opponent.miniEntities * 1.7) * 0.035,
    y: type === "boss" ? 0.08 : -0.04,
    radius,
    hp: maxHp,
    maxHp,
    speed: type === "boss" ? 0.025 : (0.052 + wave * 0.004) * (type === "fast" ? 1.45 : type === "tank" ? 0.72 : 1),
  });
}

function spawnServerMiniMarble(opponent: ServerPvpOpponent, wave: number) {
  const colors = ["#61e6a8", "#54c7ff", "#d58cff", "#f6c95f", "#ff7b5f"];
  const index = opponent.miniEntities % colors.length;
  opponent.miniEntities += 1;
  const target = opponent.miniEnemies[Math.floor(Math.random() * Math.max(1, opponent.miniEnemies.length))];
  const startX = 0.28 + (index % 3) * 0.22;
  const dx = target ? target.x - startX : (index - 2) * 0.12;
  opponent.miniMarbles.push({
    id: opponent.miniEntities,
    x: startX,
    y: 0.95,
    vx: clamp(dx * 0.42 + Math.sin(opponent.miniEntities) * 0.13, -0.36, 0.36),
    vy: -0.42 - wave * 0.008,
    radius: 0.018,
    damage: 13 + wave * 2.2,
    life: 3.8,
    color: colors[index],
    trail: [],
  });
}

function applyPressureToServerOpponent(session: ServerPvpAiSession, type: PvpPressureType, power: number) {
  const opponent = session.opponent;
  if (opponent.eliminated) return;

  const label = pvpPressureLabel(type);
  opponent.pressureTaken += power;
  opponent.lastEvent = `受到 ${label}`;
  opponent.eventTimer = 2.4;

  for (const enemyType of pvpPressureEnemies(type, type === "boss_boost" ? "boss" : "pressure")) {
    spawnServerMiniEnemy(opponent, opponent.wave, enemyType);
  }
  if (type === "shield_boost") {
    for (const enemy of opponent.miniEnemies.slice(0, 8)) {
      enemy.hp *= 1.18;
      enemy.maxHp *= 1.18;
    }
  }
  if (type === "boss_boost") {
    const boss = opponent.miniEnemies.find((enemy) => enemy.type === "boss");
    if (boss) {
      boss.hp *= 1.22;
      boss.maxHp *= 1.22;
    }
  }

  pushPvpEvent(session, {
    kind: "battle",
    from: "我方",
    text: `发送 ${label}`,
    color: "#f6c95f",
  });
}

function pvpAiSnapshot(session: ServerPvpAiSession) {
  const opponent = session.opponent;
  return {
    sessionId: session.id,
    serverTime: Date.now(),
    opponent: {
      id: opponent.id,
      name: opponent.name,
      avatar: opponent.avatar,
      lineup: opponent.lineup,
      color: opponent.color,
      hp: opponent.hp,
      maxHp: opponent.maxHp,
      wave: opponent.wave,
      kills: opponent.kills,
      pressure: opponent.pressure,
      pressureTaken: opponent.pressureTaken,
      lootValue: opponent.lootValue,
      eliminated: opponent.eliminated,
      statusText: opponent.statusText,
      lastEvent: opponent.lastEvent,
      eventTimer: opponent.eventTimer,
      fieldDensity: opponent.fieldDensity,
      bossHpRatio: opponent.bossHpRatio,
      miniEnemies: opponent.miniEnemies,
      miniMarbles: opponent.miniMarbles,
      miniEntities: opponent.miniEntities,
    },
    events: session.events.slice(-20),
  };
}

function pushPvpEvent(session: ServerPvpAiSession, event: Omit<PvpServerEvent, "seq">) {
  session.events.push({ seq: session.nextSeq, ...event });
  session.nextSeq += 1;
  session.events = session.events.slice(-60);
}

function cleanupPvpAiSessions() {
  const now = Date.now();
  for (const [id, session] of pvpAiSessions) {
    if (now - session.lastTick > PVP_SESSION_TTL_MS) pvpAiSessions.delete(id);
  }
}

function miniEnemyTypeForWave(wave: number, pressureTaken: number): EnemyType {
  if (wave >= 10 && Math.random() < 0.08) return "boss";
  if (pressureTaken > 150 && Math.random() < 0.16) return "elite";
  if (wave >= 7 && Math.random() < 0.18) return "shield";
  if (wave >= 5 && Math.random() < 0.2) return "tank";
  if (wave >= 3 && Math.random() < 0.28) return "fast";
  return Math.random() < 0.18 ? "splitter" : "small";
}

function pickServerPressureType(wave: number): PvpPressureType {
  if (wave >= 9) return "elite_drop";
  if (wave >= 7) return "shield_boost";
  if (wave >= 3) return "fast_raid";
  return "small_reinforce";
}

function pvpPressureEnemies(type: PvpPressureType, waveType: "boss" | "pressure"): EnemyType[] {
  if (type === "fast_raid") return ["fast", "fast", "fast"];
  if (type === "shield_boost") return ["shield", "tank", "shield"];
  if (type === "elite_drop") return ["elite"];
  if (type === "boss_boost") return waveType === "boss" ? ["shield", "tank", "healer", "boss"] : ["tank", "shield"];
  return ["small", "small", "small", "small", "fast"];
}

function pvpPressureLabel(type: PvpPressureType) {
  return {
    small_reinforce: "小怪增援",
    fast_raid: "快速突袭",
    shield_boost: "护盾强化",
    elite_drop: "精英投放",
    boss_boost: "Boss 强化",
  }[type];
}

function sanitizePressureType(value: unknown): PvpPressureType {
  if (
    value === "small_reinforce" ||
    value === "fast_raid" ||
    value === "shield_boost" ||
    value === "elite_drop" ||
    value === "boss_boost"
  ) {
    return value;
  }
  throw apiError("INVALID_PRESSURE_TYPE", "Invalid pressure type.", 400);
}

function sanitizeChatText(value: unknown) {
  const text = String(value || "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (!text) throw apiError("EMPTY_CHAT_MESSAGE", "Chat message is required.", 400);
  return text;
}

function sanitizeChatName(value: unknown) {
  return String(value || "我方").trim().replace(/\s+/g, " ").slice(0, 12) || "我方";
}

function bossRatioForOpponent(opponent: ServerPvpOpponent) {
  const boss = opponent.miniEnemies.find((enemy) => enemy.type === "boss");
  if (!boss) return 0;
  return clamp(boss.hp / boss.maxHp, 0, 1);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function apiError(code: string, message: string, status = 400): ApiError {
  return { code, message, status };
}
