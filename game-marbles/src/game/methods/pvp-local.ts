// @ts-nocheck

import {
  FIELD,
  HEIGHT,
  WIDTH,
  byId,
  clamp,
  dropTotalValue,
  enemyConfigs,
  marbleConfigs,
  roundRect,
  type Enemy,
  type GameMethod,
  type PvpInfoMessage,
  type PvpOpponentState,
  type PvpPressureType,
  type PvpSessionState,
  type Session,
  type UpgradeCard,
  type WaveConfig,
} from "./shared";

const PVP_LEFT_RATIO = 2 / 3;
const PVP_LEFT_WIDTH = WIDTH * PVP_LEFT_RATIO;
const PVP_RIGHT_X = PVP_LEFT_WIDTH;
const PVP_HEADER_H = 88;
const PVP_INFO_H = 214;
const PVP_GAP = 12;
const PVP_PRESSURE_COST = 60;
const PVP_SYNC_INTERVAL = 0.22;
const PVP_RECONNECT_INTERVAL = 1.2;
const PVP_COUNTDOWN_DURATION = 3;
const PVP_LAUNCH_CUE_DURATION = 0.65;
const PVP_PRELOAD_DURATION = PVP_COUNTDOWN_DURATION + PVP_LAUNCH_CUE_DURATION;
const PVP_PREDICTION_MAX = 0.28;

function createLocalPvpState(this: any, match: any = null): PvpSessionState {
  const isPlayerMatch = match?.opponentType === "player" && match?.matchId && match?.ticketId;
  const account = this.backend.accountInfo;
  const localPlayerId = account.userId || account.deviceId || "local-player";
  const opponent = isPlayerMatch && match.opponent
    ? {
        id: match.opponent.id || "player-opponent",
        name: match.opponent.name || "对手",
        avatar: match.opponent.avatar || "engineer",
        lineup: Array.isArray(match.opponent.lineup) ? match.opponent.lineup.slice(0, 3) : [],
        color: match.opponent.color || "#54c7ff",
        rankScore: Math.max(0, Math.floor(Number(match.opponent.rankScore) || 0)),
        statusText: "等待对手",
        lastEvent: "对手已连接",
      }
    : {
        id: "server-opponent",
        name: "对手",
        avatar: "bomber",
        lineup: ["bomber", "magnetist", "sentinel"],
        color: "#f6c95f",
        rankScore: 1000,
        statusText: "等待对手",
        lastEvent: "等待战场",
  };
  return {
    localPlayerId,
    selectedOpponentId: opponent.id,
    opponentSource: isPlayerMatch ? "player" : "server_ai",
    matchId: isPlayerMatch ? match.matchId : null,
    matchTicketId: match?.ticketId || null,
    serverSessionId: isPlayerMatch ? match.matchId : null,
    serverSyncTimer: 0,
    serverSyncBusy: false,
    serverSyncError: "",
    lastServerEventSeq: 0,
    resultSubmitting: false,
    resultResolved: false,
    preloadTimer: PVP_PRELOAD_DURATION,
    preloadDuration: PVP_PRELOAD_DURATION,
    preloadComplete: false,
    infoTab: "battle",
    pressure: 0,
    pressureSent: 0,
    pressureTaken: 0,
    nextAutoPressureAt: PVP_PRESSURE_COST,
    lastPressureType: null,
    lastPressureText: "自动压制已接管",
    lastAutoUpgradeText: "等待首次自动升级",
    lastAutoUpgradeTimer: 0,
    skillModeText: "技能默认自动释放",
    skillModeTimer: 2.8,
    incomingPressureType: null,
    incomingPressureStacks: 0,
    chatMessages: [
      { from: "系统", text: "已匹配对手，正在准备战场。", color: "#61e6a8" },
      { from: "系统", text: "对战即将开始。", color: "#9fb4d9" },
    ],
    battleEvents: [{ from: "对战", text: "自动战斗、自动技能、自动升级已启用。", color: "#f6c95f" }],
    opponents: [
      {
        id: opponent.id,
        name: opponent.name,
        avatar: opponent.avatar,
        lineup: opponent.lineup,
        color: opponent.color,
        rankScore: opponent.rankScore,
        hp: 10,
        maxHp: 10,
        wave: 1,
        kills: 0,
        pressure: 0,
        pressureTaken: 0,
        lootValue: 0,
        eliminated: false,
        statusText: opponent.statusText,
        lastEvent: opponent.lastEvent,
        eventTimer: 1.8,
        fieldDensity: 0.05,
        bossHpRatio: 1,
        miniEnemies: [],
        miniMarbles: [],
        miniSpawnTimer: 0.3,
        miniShotTimer: 0.35,
        miniEntities: 1,
        snapshotAge: 0,
      },
    ],
  };
}

function restorePvpAutomation(this: any) {
  if (!this.pvpAutomationBefore) return;
  this.autoBattleEnabled = this.pvpAutomationBefore.autoBattleEnabled;
  this.autoSkillEnabled = this.pvpAutomationBefore.autoSkillEnabled;
  this.autoUpgradeMode = this.pvpAutomationBefore.autoUpgradeMode;
  this.pvpAutomationBefore = null;
  this.updateAutoUi();
}

function startPvpPreload(this: any) {
  const session = this.session as Session | null;
  const pvp = session?.pvp;
  if (!session || !pvp || session.mode !== "pvp") return;

  pvp.preloadTimer = PVP_PRELOAD_DURATION;
  pvp.preloadDuration = PVP_PRELOAD_DURATION;
  pvp.preloadComplete = false;
  pvp.serverSyncTimer = 0;
  pushPvpBattleEvent(pvp, "系统", "正在锁定双方战场。", "#54c7ff");
}

function bindPvpChatEvents(this: any) {
  const form = byId("pvpChatForm") as HTMLFormElement;
  const input = byId("pvpChatInput") as HTMLInputElement;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    this.submitPvpChatMessage(input.value);
  });
}

function updatePvpChatOverlay(this: any) {
  const form = byId("pvpChatForm") as HTMLFormElement;
  const input = byId("pvpChatInput") as HTMLInputElement;
  const session = this.session as Session | null;
  const pvp = session?.pvp;
  const visible = this.phase === "playing" && session?.mode === "pvp" && pvp?.infoTab === "chat";
  form.classList.toggle("hidden", !visible);
  input.disabled = !visible;
  form.querySelector<HTMLButtonElement>("button")!.disabled = !visible;
}

function submitPvpChatMessage(this: any, rawText: string) {
  const session = this.session as Session | null;
  const pvp = session?.pvp;
  if (!session || !pvp || session.mode !== "pvp") return;

  const input = byId("pvpChatInput") as HTMLInputElement;
  const text = String(rawText || "").trim().replace(/\s+/g, " ").slice(0, 80);
  if (!text) return;
  input.value = "";

  if (!pvp.serverSessionId) {
    pushPvpChatMessage(pvp, "我方", text, "#61e6a8");
    pushPvpChatMessage(pvp, "系统", "消息已暂存，等待对手连接。", "#f6c95f");
    pvp.serverSyncTimer = 0;
    return;
  }

  const request =
    pvp.opponentSource === "player" && pvp.matchId && pvp.matchTicketId
      ? this.backend.sendPvpPlayerChat(pvp.matchId, {
          ticketId: pvp.matchTicketId,
          text,
          from: this.backend.accountInfo.nickname || "我方",
        })
      : this.backend.sendPvpAiChat(pvp.serverSessionId, {
          text,
          from: this.backend.accountInfo.nickname || "我方",
        });

  void request
    .then((snapshot: any) => {
      this.applyPvpServerSnapshot(snapshot);
    })
    .catch(() => {
      const current = this.session?.pvp;
      if (!current) return;
      pushPvpChatMessage(current, "系统", "聊天发送失败，请稍后重试。", "#ff6c7e");
    });
}

function updatePvpSession(this: any, dt: number, realDt: number) {
  const session = this.session as Session | null;
  const pvp = session?.pvp;
  if (!session || !pvp || session.mode !== "pvp") return;

  if (!pvp.preloadComplete) {
    pvp.preloadTimer = Math.max(0, pvp.preloadTimer - realDt);
    if (pvp.preloadTimer <= 0 && this.phase === "playing") {
      pvp.preloadTimer = 0;
      pvp.preloadComplete = true;
      pvp.serverSyncTimer = 0;
      pushPvpBattleEvent(pvp, "系统", "开战！", "#61e6a8");
      this.addFloatingText(WIDTH / 2, FIELD.y + 70, "开战！", "#61e6a8");
      if (session.wave <= 0 && !session.waveConfig) this.startWave(1);
    }
    return;
  }

  pvp.lastAutoUpgradeTimer = Math.max(0, pvp.lastAutoUpgradeTimer - realDt);
  pvp.skillModeTimer = Math.max(0, pvp.skillModeTimer - realDt);
  pvp.serverSyncTimer -= realDt;

  if (!pvp.serverSyncBusy && pvp.serverSyncTimer <= 0) {
    pvp.serverSyncTimer = pvp.serverSessionId ? PVP_SYNC_INTERVAL : PVP_RECONNECT_INTERVAL;
    void this.syncPvpServerOpponent();
  }

  for (const opponent of pvp.opponents) {
    opponent.eventTimer = Math.max(0, opponent.eventTimer - realDt);
    opponent.snapshotAge = Math.min(PVP_PREDICTION_MAX, (opponent.snapshotAge || 0) + realDt);

    if (opponent.hp <= 0) {
      opponent.eliminated = true;
      opponent.statusText = "已淘汰";
      opponent.lastEvent = "防线崩溃";
      this.finishPvpByServer("win", "PVP 压垮对手防线");
    }
  }

  if (session.baseHp <= 0 && this.phase === "playing") {
    this.finishPvpByServer("lose", "PVP 防线被对手突破");
  }
}

function finishPvpByServer(this: any, result: "win" | "lose", reason: string) {
  const session = this.session as Session | null;
  const pvp = session?.pvp;
  if (!session || !pvp || session.mode !== "pvp" || this.phase !== "playing") return;
  if (pvp.resultSubmitting || pvp.resultResolved) return;

  const extractionResult = result === "win" ? "cleared" : "failed";
  if (pvp.opponentSource !== "player" || !pvp.matchId || !pvp.matchTicketId) {
    pvp.resultResolved = true;
    this.endGame(result, reason, extractionResult);
    return;
  }

  pvp.resultSubmitting = true;
  pushPvpBattleEvent(pvp, "对战", "正在同步结算。", "#f6c95f");
  void this.backend
    .finishPvpPlayerMatch(pvp.matchId, {
      ticketId: pvp.matchTicketId,
      result,
      reason,
      wave: session.wave,
      baseHp: session.baseHp,
      kills: session.kills,
      pressureSent: Math.floor(pvp.pressureSent),
      pressureTaken: Math.floor(pvp.pressureTaken),
      snapshot: this.buildLocalPvpPlayerSnapshot(),
    })
    .then((snapshot: any) => {
      const current = this.session?.pvp;
      if (current) current.resultSubmitting = false;
      this.applyPvpServerSnapshot(snapshot);
    })
    .catch(() => {
      const current = this.session?.pvp;
      if (!current) return;
      current.resultSubmitting = false;
      current.serverSyncTimer = 0;
      pushPvpBattleEvent(current, "系统", "结算同步中，请稍候。", "#ff6c7e");
    });
}

async function syncPvpServerOpponent(this: any) {
  const session = this.session as Session | null;
  const pvp = session?.pvp;
  if (!session || !pvp || session.mode !== "pvp" || pvp.serverSyncBusy) return;

  pvp.serverSyncBusy = true;
  try {
    let snapshot;
    if (pvp.opponentSource === "player" && pvp.matchId && pvp.matchTicketId) {
      snapshot = await this.backend.syncPvpPlayerSnapshot(pvp.matchId, {
        ticketId: pvp.matchTicketId,
        snapshot: this.buildLocalPvpPlayerSnapshot(),
      });
    } else {
      snapshot = pvp.serverSessionId
        ? await this.backend.getPvpAiSnapshot(pvp.serverSessionId)
        : await this.backend.startPvpAiOpponent({
            stageId: session.stageId,
            lineup: this.save.lineup,
            avatar: this.backend.accountInfo.avatar || "engineer",
            nickname: this.backend.accountInfo.nickname || "玩家",
          });
    }
    this.applyPvpServerSnapshot(snapshot);
  } catch (error) {
    const current = this.session?.pvp;
    if (!current) return;
    current.serverSyncError = "对手战场暂不可用";
    current.serverSyncTimer = PVP_RECONNECT_INTERVAL;
    const opponent = this.selectedPvpOpponent();
    if (opponent) {
      opponent.statusText = "同步失败";
      opponent.lastEvent = "等待对手";
      opponent.eventTimer = 2;
    }
  } finally {
    const current = this.session?.pvp;
    if (current) current.serverSyncBusy = false;
  }
}

function applyPvpServerSnapshot(this: any, snapshot: any) {
  const session = this.session as Session | null;
  const pvp = session?.pvp;
  if (!session || !pvp || session.mode !== "pvp" || !snapshot?.opponent) return;

  const remote = snapshot.opponent;
  pvp.serverSessionId = snapshot.sessionId || pvp.serverSessionId;
  pvp.serverSyncError = "";

  const opponentState: PvpOpponentState = {
    id: remote.id,
    name: remote.name,
    avatar: remote.avatar,
    lineup: Array.isArray(remote.lineup) ? remote.lineup.slice(0, 3) : [remote.avatar].filter(Boolean),
    color: remote.color,
    rankScore: Math.max(0, Math.floor(Number(remote.rankScore) || 0)),
    hp: remote.hp,
    maxHp: remote.maxHp,
    wave: remote.wave,
    kills: remote.kills,
    pressure: remote.pressure,
    pressureTaken: remote.pressureTaken,
    lootValue: remote.lootValue,
    eliminated: remote.eliminated,
    statusText: remote.statusText,
    lastEvent: remote.lastEvent,
    eventTimer: remote.eventTimer,
    fieldDensity: remote.fieldDensity,
    bossHpRatio: remote.bossHpRatio,
    miniEnemies: remote.miniEnemies || [],
    miniMarbles: remote.miniMarbles || [],
    miniSpawnTimer: 0,
    miniShotTimer: 0,
    miniEntities: remote.miniEntities || 0,
    snapshotAge: 0,
  };

  pvp.opponents = [opponentState];
  pvp.selectedOpponentId = remote.id;

  for (const event of snapshot.events || []) {
    if (!event || event.seq <= pvp.lastServerEventSeq) continue;
    pvp.lastServerEventSeq = Math.max(pvp.lastServerEventSeq, event.seq);
    if (event.kind === "pressure" && event.pressureType) {
      this.applyPvpIncomingPressure(event.pressureType, event.from || remote.name);
      continue;
    }
    if (event.kind === "system" || event.kind === "chat") {
      pushPvpChatMessage(pvp, event.from || "系统", event.text || "", event.color || "#9fb4d9");
    } else {
      pushPvpBattleEvent(pvp, event.from || "对战", event.text || "", event.color || "#9fb4d9");
    }
    if (event.kind === "result" && event.result && this.phase === "playing") {
      pvp.resultResolved = true;
      pvp.resultSubmitting = false;
      this.endGame(event.result, event.text || (event.result === "win" ? "PVP 对战获胜" : "PVP 对战失败"), event.result === "win" ? "cleared" : "failed");
    }
  }
}

function buildLocalPvpPlayerSnapshot(this: any) {
  const session = this.session as Session | null;
  const pvp = session?.pvp;
  if (!session || !pvp) return null;

  const normalizeX = (x: number) => clamp((x - FIELD.x) / FIELD.w, 0, 1);
  const normalizeY = (y: number) => clamp((y - FIELD.y) / FIELD.h, -0.12, 1.12);
  const boss = session.enemies.find((enemy: Enemy) => enemy.type === "boss");
  const lastEvent = pvp.lastAutoUpgradeTimer > 0 ? pvp.lastAutoUpgradeText : pvp.lastPressureText || "同步中";

  return {
    id: pvp.localPlayerId,
    name: this.backend.accountInfo.nickname || "我方",
    avatar: this.backend.accountInfo.avatar || "engineer",
    lineup: this.save.lineup.slice(0, 3),
    color: "#61e6a8",
    hp: session.baseHp,
    maxHp: session.maxBaseHp,
    wave: session.wave || 1,
    kills: session.kills,
    pressure: Math.floor(pvp.pressure),
    pressureTaken: pvp.pressureTaken,
    lootValue: dropTotalValue(session.drops),
    eliminated: Boolean(session.result || session.baseHp <= 0),
    statusText: session.result ? "已结束" : "玩家推进",
    lastEvent,
    eventTimer: 1.2,
    fieldDensity: clamp(session.enemies.length / 42, 0.04, 1),
    bossHpRatio: boss ? clamp(boss.hp / Math.max(1, boss.maxHp), 0, 1) : 1,
    miniEnemies: session.enemies.slice(0, 48).map((enemy: Enemy) => ({
      id: enemy.id,
      type: enemy.type,
      x: normalizeX(enemy.x),
      y: normalizeY(enemy.y),
      radius: clamp(enemy.radius / FIELD.w, 0.012, 0.08),
      hp: enemy.hp,
      maxHp: enemy.maxHp,
      speed: enemy.speed / FIELD.h,
    })),
    miniMarbles: session.marbles.slice(0, 32).map((marble: any) => {
      const config = marbleConfigs[marble.marbleId] || marbleConfigs.basic;
      return {
        id: marble.id,
        x: normalizeX(marble.x),
        y: normalizeY(marble.y),
        vx: marble.vx / FIELD.w,
        vy: marble.vy / FIELD.h,
        radius: clamp(marble.radius / FIELD.w, 0.008, 0.045),
        damage: marble.damage,
        life: marble.lifetime,
        color: config.color || "#54c7ff",
        trail: (marble.trail || []).slice(-8).map((point: any) => ({
          x: normalizeX(point.x),
          y: normalizeY(point.y),
        })),
      };
    }),
    miniEntities: session.entities,
  };
}

function addPvpPressureForKill(this: any, enemy: Enemy) {
  const session = this.session as Session | null;
  const pvp = session?.pvp;
  if (!session || !pvp || session.mode !== "pvp") return;

  const gain: Record<string, number> = {
    small: 1,
    fast: 2,
    splitter: 2,
    tank: 3,
    shield: 3,
    healer: 3,
    gold: 2,
    elite: 18,
    boss: 45,
  };
  pvp.pressure = Math.min(140, pvp.pressure + (gain[enemy.type] || 1));
  if (pvp.pressure >= pvp.nextAutoPressureAt) this.sendLocalPvpPressure();
}

function sendLocalPvpPressure(this: any) {
  const session = this.session as Session | null;
  const pvp = session?.pvp;
  if (!session || !pvp || session.mode !== "pvp") return;
  const opponent = this.selectedPvpOpponent();
  if (!opponent || opponent.eliminated) return;

  if (!pvp.serverSessionId) {
    pvp.lastPressureText = "等待对手连接";
    pvp.serverSyncTimer = 0;
    return;
  }

  const type = pickLocalPressureType(session, pvp.pressure);
  const cost = type === "boss_boost" || type === "elite_drop" ? 90 : PVP_PRESSURE_COST;
  if (pvp.pressure < cost) return;

  pvp.pressure -= cost;
  pvp.pressureSent += cost;
  pvp.lastPressureType = type;
  pvp.lastPressureText = `发送中：${pvpPressureLabel(type)}`;
  opponent.lastEvent = "等待对手响应";
  opponent.eventTimer = 2.4;
  this.addFloatingText(WIDTH * 0.34, FIELD.y + 74, pvp.lastPressureText, "#f6c95f");

  const request =
    pvp.opponentSource === "player" && pvp.matchId && pvp.matchTicketId
      ? this.backend.sendPvpPlayerPressure(pvp.matchId, { ticketId: pvp.matchTicketId, pressureType: type, power: cost })
      : this.backend.sendPvpAiPressure(pvp.serverSessionId, { pressureType: type, power: cost });

  void request
    .then((snapshot: any) => {
      this.applyPvpServerSnapshot(snapshot);
      const current = this.session?.pvp;
      if (current) current.lastPressureText = `已发送：${pvpPressureLabel(type)}`;
    })
    .catch(() => {
      const current = this.session?.pvp;
      if (!current) return;
      current.pressure = Math.min(140, current.pressure + cost);
      current.pressureSent = Math.max(0, current.pressureSent - cost);
      current.lastPressureText = "压力发送失败";
      current.serverSyncError = "压力发送失败";
      pushPvpBattleEvent(current, "系统", "压力发送失败，已退还压力。", "#ff6c7e");
    });
}

function applyPvpIncomingPressure(this: any, type: PvpPressureType, fromName = "对手") {
  const session = this.session as Session | null;
  const pvp = session?.pvp;
  if (!session || !pvp || session.mode !== "pvp") return;

  pvp.pressureTaken += PVP_PRESSURE_COST;
  pvp.incomingPressureType = type;
  pvp.incomingPressureStacks += 1;
  pvp.lastPressureText = `${fromName} 发送：${pvpPressureLabel(type)}`;
  const opponent = this.selectedPvpOpponent();
  if (opponent) {
    opponent.lastEvent = pvpPressureLabel(type);
    opponent.eventTimer = 2.4;
  }
  pushPvpBattleEvent(pvp, fromName, pvpPressureLabel(type), "#ff9f43");

  if (session.waveConfig && session.spawnQueue.length > 0) this.applyPvpPressureToWave(session.waveConfig);
  this.addFloatingText(WIDTH * 0.34, FIELD.y + 108, pvp.lastPressureText, "#ff9f43");
}

function applyPvpPressureToWave(this: any, config: WaveConfig) {
  const session = this.session as Session | null;
  const pvp = session?.pvp;
  if (!session || !pvp || session.mode !== "pvp" || !pvp.incomingPressureType || pvp.incomingPressureStacks <= 0) return;

  const additions = pvpPressureEnemies(pvp.incomingPressureType, config.type);
  session.spawnQueue.push(...additions);
  if (pvp.incomingPressureType === "shield_boost") {
    for (const enemy of session.enemies.slice(0, 8)) {
      enemy.hp *= 1.12;
      enemy.maxHp *= 1.12;
      enemy.armor += 0.25;
    }
  }
  if (pvp.incomingPressureType === "boss_boost") {
    const boss = session.enemies.find((enemy) => enemy.type === "boss");
    if (boss) {
      boss.hp *= 1.12;
      boss.maxHp *= 1.12;
      boss.armor += 0.5;
    }
  }

  pvp.incomingPressureStacks = 0;
  pvp.incomingPressureType = null;
}

function notePvpAutoUpgrade(this: any, card: UpgradeCard) {
  const session = this.session as Session | null;
  const pvp = session?.pvp;
  if (!session || !pvp || session.mode !== "pvp") return;
  pvp.lastAutoUpgradeText = `自动升级：${card.name}`;
  pvp.lastAutoUpgradeTimer = 2.8;
  pushPvpBattleEvent(pvp, "战术", `自动选择 ${card.name}`, "#d58cff");
}

function notePvpAutoUpgradeBatch(this: any, applied: Array<{ card: UpgradeCard; multiplier: number }>) {
  const session = this.session as Session | null;
  const pvp = session?.pvp;
  if (!session || !pvp || session.mode !== "pvp" || applied.length === 0) return;
  const names = applied.map((item) => `${item.card.name}${item.multiplier > 1 ? `×${item.multiplier}` : ""}`);
  pvp.lastAutoUpgradeText = `自动升级：${names.join(" / ")}`;
  pvp.lastAutoUpgradeTimer = 2.8;
  pushPvpBattleEvent(pvp, "战术", `自动选择 3 张：${names.join(" / ")}`, "#d58cff");
}

function handlePvpCanvasPointer(this: any, x: number, y: number) {
  const session = this.session as Session | null;
  const pvp = session?.pvp;
  if (!session || !pvp || session.mode !== "pvp") return false;
  const layout = pvpLayout();
  const controls = pvpSkillControlLayout(layout.local);

  if (pointInRect(x, y, controls.toggle)) {
    this.autoSkillEnabled = !this.autoSkillEnabled;
    pvp.skillModeText = this.autoSkillEnabled ? "技能自动释放" : "技能手动释放";
    pvp.skillModeTimer = 2.4;
    pushPvpBattleEvent(pvp, "技能", pvp.skillModeText, this.autoSkillEnabled ? "#61e6a8" : "#f6c95f");
    this.sound.play("ui");
    return true;
  }

  if (y >= layout.info.y && y <= layout.info.y + 48) {
    if (x >= layout.info.x + 16 && x <= layout.info.x + 130) {
      pvp.infoTab = "chat";
      this.sound.play("ui");
      return true;
    }
    if (x >= layout.info.x + 140 && x <= layout.info.x + 254) {
      pvp.infoTab = "battle";
      this.sound.play("ui");
      return true;
    }
  }

  const localPoint = pvpLocalWorldPoint(layout.local, x, y);
  if (localPoint) {
    const target = session.characters.find((character) => Math.abs(character.x - localPoint.x) <= 58 && Math.abs(character.y - localPoint.y) <= 58);
    if (target) {
      if (this.autoSkillEnabled) {
        pvp.skillModeText = "自动技能运行中";
        pvp.skillModeTimer = 1.4;
        this.sound.play("ui", 30);
        return true;
      }
      if (target.skillTimer > 0) {
        pvp.skillModeText = `${target.name} 冷却 ${Math.ceil(target.skillTimer)}s`;
        pvp.skillModeTimer = 1.6;
        this.sound.play("ui", 35);
        return true;
      }
      this.castSkill(target.id);
      pvp.skillModeText = `手动释放：${target.skillName}`;
      pvp.skillModeTimer = 2.2;
      pushPvpBattleEvent(pvp, "技能", `手动释放 ${target.skillName}`, target.color);
      return true;
    }
  }

  if (y > PVP_HEADER_H) return false;
  const visibleOpponents = pvp.opponents.slice(0, 1);
  for (let index = 0; index < visibleOpponents.length; index += 1) {
    const cx = 132 + index * 74;
    if (Math.hypot(x - cx, y - 42) <= 32) {
      pvp.selectedOpponentId = visibleOpponents[index].id;
      this.sound.play("ui");
      return true;
    }
  }

  return false;
}

function selectedPvpOpponent(this: any) {
  const pvp = this.session?.pvp;
  if (!pvp) return null;
  return pvp.opponents.find((opponent: PvpOpponentState) => opponent.id === pvp.selectedOpponentId) || pvp.opponents[0] || null;
}

function pvpPreloadCountdownState(pvp: PvpSessionState) {
  const duration = Math.max(0.1, pvp.preloadDuration || PVP_PRELOAD_DURATION);
  const elapsed = clamp(duration - Math.max(0, pvp.preloadTimer || 0), 0, duration);
  const launchDuration = Math.min(PVP_LAUNCH_CUE_DURATION, duration * 0.4);
  const countdownDuration = Math.max(0.1, duration - launchDuration);
  if (elapsed >= countdownDuration) {
    return {
      phase: "launch",
      count: 0,
      local: clamp((elapsed - countdownDuration) / Math.max(0.001, launchDuration), 0, 1),
    };
  }
  const stepLength = countdownDuration / 3;
  const stepIndex = Math.min(2, Math.floor(elapsed / Math.max(0.001, stepLength)));
  return {
    phase: "countdown",
    count: Math.max(1, 3 - stepIndex),
    local: clamp((elapsed - stepIndex * stepLength) / Math.max(0.001, stepLength), 0, 1),
  };
}

function drawPvpBattle(this: any, ctx: CanvasRenderingContext2D, session: Session) {
  const layout = pvpLayout();
  ctx.save();
  ctx.fillStyle = "#050a12";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.restore();

  drawScaledLocalBattle.call(this, ctx, session, layout.local);
  this.drawPvpOpponentPanel(ctx, session, layout.right);
  this.drawPvpHeader(ctx, session);
  this.drawPvpFooter(ctx, session, layout.info);
  drawPvpPreloadOverlay(ctx, session, layout);
}

function drawScaledLocalBattle(this: any, ctx: CanvasRenderingContext2D, session: Session, rect: any) {
  ctx.save();
  ctx.fillStyle = "rgba(8,14,24,0.82)";
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8);
  ctx.fill();
  ctx.beginPath();
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8);
  ctx.clip();

  const viewport = pvpLocalViewport(rect);
  ctx.translate(viewport.x, viewport.y);
  ctx.scale(viewport.scale, viewport.scale);
  this.drawBackground(ctx);
  this.drawField(ctx);
  this.drawEnemies(ctx, session);
  this.drawMarbles(ctx, session);
  this.drawSkillEffects(ctx, session);
  this.drawCharacters(ctx, session);
  this.drawParticles(ctx, session);
  this.drawDropVisuals(ctx, session);
  this.drawBattleInfo(ctx, session);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(190,213,255,0.24)";
  ctx.lineWidth = 2;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8);
  ctx.stroke();
  ctx.restore();

  drawPvpBattleStatusBar(
    ctx,
    rect.x + 14,
    rect.y + 12,
    rect.w - 28,
    [
      { label: "生命", value: `${session.baseHp}/${session.maxBaseHp}`, color: session.baseHp <= 3 ? "#ff6c7e" : "#61e6a8" },
      { label: "波次", value: `${session.wave || 1}/10`, color: "#54c7ff" },
      { label: "压力", value: `${Math.floor(session.pvp?.pressure || 0)}/${session.pvp?.nextAutoPressureAt || PVP_PRESSURE_COST}`, color: "#f6c95f" },
    ],
    session.baseHp / Math.max(1, session.maxBaseHp),
    session.baseHp <= 3 ? "#ff6c7e" : "#61e6a8",
  );
  drawPvpSkillControls.call(this, ctx, session, rect);
}

function drawPvpHeader(this: any, ctx: CanvasRenderingContext2D, session: Session) {
  const pvp = session.pvp;
  if (!pvp) return;

  ctx.save();
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, 0);
  gradient.addColorStop(0, "rgba(5, 10, 18, 0.94)");
  gradient.addColorStop(0.66, "rgba(10, 20, 33, 0.88)");
  gradient.addColorStop(1, "rgba(18, 14, 26, 0.94)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, PVP_HEADER_H);
  ctx.strokeStyle = "rgba(190,213,255,0.18)";
  ctx.beginPath();
  ctx.moveTo(0, PVP_HEADER_H);
  ctx.lineTo(WIDTH, PVP_HEADER_H);
  ctx.stroke();

  drawPvpAvatar(ctx, this, {
    x: 46,
    y: 42,
    id: this.backend.accountInfo.avatar || "engineer",
    color: "#61e6a8",
    label: "我方",
    hp: session.baseHp,
    maxHp: session.maxBaseHp,
    active: true,
  });

  pvp.opponents.slice(0, 1).forEach((opponent: PvpOpponentState, index: number) => {
    drawPvpAvatar(ctx, this, {
      x: 132 + index * 74,
      y: 42,
      id: opponent.avatar,
      color: opponent.color,
      label: opponent.name,
      hp: opponent.hp,
      maxHp: opponent.maxHp,
      active: opponent.id === pvp.selectedOpponentId,
      eliminated: opponent.eliminated,
    });
  });

  ctx.fillStyle = "#eef4ff";
  ctx.font = "900 16px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("PVP 对战", WIDTH - 20, 39);
  ctx.restore();
}

function drawPvpOpponentPanel(this: any, ctx: CanvasRenderingContext2D, session: Session, rect: any) {
  const opponent = this.selectedPvpOpponent();
  if (!opponent) return;
  const pvp = session.pvp;

  ctx.save();
  ctx.fillStyle = "rgba(5, 10, 18, 0.92)";
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(190,213,255,0.2)";
  ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.font = "900 17px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(opponent.name, rect.x + rect.w / 2, rect.y + 31);
  ctx.fillStyle = opponent.eliminated ? "#ff6c7e" : "#9fb4d9";
  ctx.font = "800 12px system-ui, sans-serif";
  const syncLabel = pvp?.serverSyncError || (!pvp?.preloadComplete ? "等待开战" : pvp?.serverSessionId ? "对战中" : "连接中");
  ctx.fillText(syncLabel, rect.x + rect.w / 2, rect.y + 52);

  const mini = { x: rect.x + 12, y: rect.y + 70, w: rect.w - 24, h: rect.h - 242 };
  drawPvpMiniBattle.call(this, ctx, opponent, session, mini);

  const metricsY = mini.y + mini.h + 14;
  drawPvpMetric(ctx, rect.x + 12, metricsY, "货值", `${opponent.lootValue}`, "#d58cff", rect.w - 24);

  if (opponent.eventTimer > 0) {
    ctx.fillStyle = "rgba(246,201,95,0.16)";
    ctx.strokeStyle = "rgba(246,201,95,0.44)";
    roundRect(ctx, rect.x + 12, rect.y + rect.h - 44, rect.w - 24, 32, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fff7d6";
    ctx.font = "900 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(opponent.lastEvent, rect.x + rect.w / 2, rect.y + rect.h - 23);
  }
  ctx.restore();
}

function drawPvpMiniBattle(this: any, ctx: CanvasRenderingContext2D, opponent: PvpOpponentState, session: Session, rect: any) {
  ctx.save();
  const field = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  field.addColorStop(0, "rgba(84,199,255,0.16)");
  field.addColorStop(0.5, "rgba(18,28,44,0.86)");
  field.addColorStop(1, "rgba(255,108,126,0.16)");
  ctx.fillStyle = field;
  ctx.strokeStyle = "rgba(190,213,255,0.22)";
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8);
  ctx.clip();

  ctx.strokeStyle = "rgba(255,255,255,0.055)";
  ctx.lineWidth = 1;
  for (let y = rect.y + 52; y < rect.y + rect.h; y += 58) {
    ctx.beginPath();
    ctx.moveTo(rect.x + 10, y);
    ctx.lineTo(rect.x + rect.w - 10, y);
    ctx.stroke();
  }

  if (opponent.miniMarbles.length === 0 && opponent.miniEnemies.length === 0) {
    ctx.fillStyle = "#9fb4d9";
    ctx.font = "800 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(session.pvp?.serverSyncError || "等待对手战场", rect.x + rect.w / 2, rect.y + rect.h / 2);
  }

  const prediction = clamp(opponent.snapshotAge || 0, 0, PVP_PREDICTION_MAX);

  for (const marble of opponent.miniMarbles) {
    const marbleX = clamp(marble.x + marble.vx * prediction, 0.04, 0.96);
    const marbleY = clamp(marble.y + marble.vy * prediction, 0.04, 1.06);
    for (let i = 0; i < marble.trail.length; i += 1) {
      const point = marble.trail[i];
      const alpha = i / Math.max(1, marble.trail.length);
      ctx.fillStyle = marble.color.replace("#", "rgba(") === marble.color ? `${marble.color}55` : marble.color;
      ctx.globalAlpha = 0.18 + alpha * 0.22;
      ctx.beginPath();
      ctx.arc(rect.x + point.x * rect.w, rect.y + point.y * rect.h, Math.max(2, marble.radius * rect.w * (0.5 + alpha)), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = marble.color;
    ctx.shadowColor = marble.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(rect.x + marbleX * rect.w, rect.y + marbleY * rect.h, marble.radius * rect.w, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  for (const enemy of opponent.miniEnemies) {
    const color = enemyConfigs[enemy.type].color;
    const x = rect.x + enemy.x * rect.w;
    const y = rect.y + clamp(enemy.y + enemy.speed * prediction, -0.08, 1.08) * rect.h;
    const size = enemy.radius * rect.w * 2;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = enemy.type === "boss" ? 18 : 10;
    roundRect(ctx, x - size / 2, y - size / 2, size, size, enemy.type === "boss" ? 10 : 5);
    ctx.fill();
    ctx.shadowBlur = 0;

    const hpRatio = clamp(enemy.hp / enemy.maxHp, 0, 1);
    ctx.fillStyle = "rgba(0,0,0,0.48)";
    roundRect(ctx, x - size / 2, y - size / 2 - 8, size, 4, 2);
    ctx.fill();
    ctx.fillStyle = hpRatio > 0.35 ? "#61e6a8" : "#ff6c7e";
    roundRect(ctx, x - size / 2, y - size / 2 - 8, size * hpRatio, 4, 2);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(255,108,126,0.5)";
  ctx.setLineDash([8, 7]);
  ctx.beginPath();
  ctx.moveTo(rect.x + 10, rect.y + rect.h - 22);
  ctx.lineTo(rect.x + rect.w - 10, rect.y + rect.h - 22);
  ctx.stroke();
  ctx.setLineDash([]);
  drawPvpMiniDefenders(ctx, this, opponent, rect);
  drawPvpBattleStatusBar(
    ctx,
    rect.x + 10,
    rect.y + 10,
    rect.w - 20,
    [
      { label: "生命", value: `${opponent.hp}/${opponent.maxHp}`, color: opponent.hp <= 3 ? "#ff6c7e" : "#61e6a8" },
      { label: "波次", value: `${opponent.wave}/10`, color: "#54c7ff" },
      { label: "压力", value: `${Math.floor(opponent.pressure)}/${PVP_PRESSURE_COST}`, color: "#f6c95f" },
    ],
    opponent.hp / Math.max(1, opponent.maxHp),
    opponent.hp <= 3 ? "#ff6c7e" : "#61e6a8",
  );
  ctx.restore();
}

function drawPvpMiniDefenders(ctx: CanvasRenderingContext2D, game: any, opponent: PvpOpponentState, rect: any) {
  const y = rect.y + rect.h - 34;
  const ids = (Array.isArray(opponent.lineup) ? opponent.lineup : []).filter(Boolean).slice(0, 3);
  if (ids.length === 0 && opponent.avatar) ids.push(opponent.avatar);
  const ratios = ids.length <= 1 ? [0.5] : ids.length === 2 ? [0.42, 0.58] : [0.34, 0.5, 0.66];
  const activeIndex = Math.floor((ids.length - 1) / 2);

  ctx.save();
  ctx.fillStyle = "rgba(97,230,168,0.08)";
  ctx.strokeStyle = "rgba(97,230,168,0.26)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(rect.x + rect.w / 2, y + 15, Math.max(36, rect.w * 0.28), 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ratios.forEach((ratio, index) => {
    const x = rect.x + rect.w * ratio;
    const size = index === activeIndex ? 33 : 26;
    const alpha = index === activeIndex ? 1 : 0.72;
    ctx.save();
    ctx.globalAlpha = opponent.eliminated ? 0.42 : alpha;
    ctx.fillStyle = "rgba(7,12,22,0.96)";
    ctx.strokeStyle = index === activeIndex ? opponent.color : "rgba(190,213,255,0.28)";
    ctx.lineWidth = index === activeIndex ? 2.5 : 1.5;
    ctx.shadowColor = index === activeIndex ? opponent.color : "transparent";
    ctx.shadowBlur = index === activeIndex ? 12 : 0;
    roundRect(ctx, x - size / 2, y - size / 2, size, size, 8);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.save();
    roundRect(ctx, x - size / 2 + 2, y - size / 2 + 2, size - 4, size - 4, 7);
    ctx.clip();
    ctx.fillStyle = opponent.color;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
    const characterId = ids[index];
    const portrait = game.characterPortraits.get(characterId);
    if (portrait?.complete && portrait.naturalWidth > 0) {
      ctx.drawImage(portrait, x - size * 0.62, y - size * 0.72, size * 1.24, size * 1.24);
    } else {
      ctx.fillStyle = "#08111f";
      ctx.font = `900 ${Math.max(11, Math.floor(size * 0.44))}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(opponent.name.slice(0, 1), x, y);
    }
    ctx.restore();
    ctx.restore();
  });

  ctx.restore();
}

function drawPvpPreloadOverlay(ctx: CanvasRenderingContext2D, session: Session, layout: any) {
  const pvp = session.pvp;
  if (!pvp || pvp.preloadComplete) return;

  const countdown = pvpPreloadCountdownState(pvp);
  const pulse = Math.sin(countdown.local * Math.PI);
  const panel = {
    x: layout.local.x + layout.local.w * 0.2,
    y: layout.local.y + layout.local.h * 0.34,
    w: layout.local.w * 0.6,
    h: 136,
  };
  const cx = panel.x + panel.w / 2;
  const countY = panel.y + panel.h / 2;

  ctx.save();
  ctx.fillStyle = "rgba(3,7,14,0.58)";
  ctx.fillRect(layout.local.x, layout.local.y, layout.local.w, layout.local.h);
  const body = ctx.createLinearGradient(panel.x, panel.y, panel.x, panel.y + panel.h);
  body.addColorStop(0, "rgba(8,18,32,0.96)");
  body.addColorStop(0.55, "rgba(5,10,18,0.94)");
  body.addColorStop(1, "rgba(12,18,30,0.92)");
  ctx.fillStyle = body;
  roundRect(ctx, panel.x, panel.y, panel.w, panel.h, 14);
  ctx.fill();

  ctx.save();
  ctx.translate(cx, countY);
  const launchCue = countdown.phase === "launch";
  const text = launchCue ? "开战！" : String(countdown.count);
  ctx.shadowColor = launchCue || countdown.count === 1 ? "#f6c95f" : "#54c7ff";
  ctx.shadowBlur = 22 + pulse * 18;
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(2,7,14,0.92)";
  ctx.font = `950 ${Math.round((launchCue ? 62 : 96) + pulse * 10)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const metrics = ctx.measureText(text);
  const visualOffsetX =
    Number.isFinite(metrics.actualBoundingBoxLeft) && Number.isFinite(metrics.actualBoundingBoxRight)
      ? (metrics.actualBoundingBoxLeft - metrics.actualBoundingBoxRight) / 2
      : 0;
  ctx.strokeText(text, visualOffsetX, 0);
  ctx.fillStyle = launchCue || countdown.count === 1 ? "#fff0a8" : "#eef4ff";
  ctx.fillText(text, visualOffsetX, 0);
  ctx.restore();
  ctx.restore();
}

function drawPvpFooter(this: any, ctx: CanvasRenderingContext2D, session: Session, rect: any) {
  const pvp = session.pvp;
  if (!pvp) return;

  ctx.save();
  ctx.fillStyle = "rgba(5,10,18,0.9)";
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(190,213,255,0.18)";
  ctx.stroke();

  drawPvpTab(ctx, rect.x + 16, rect.y + 14, "聊天信息", pvp.infoTab === "chat");
  drawPvpTab(ctx, rect.x + 140, rect.y + 14, "对战信息", pvp.infoTab === "battle");

  if (pvp.infoTab === "chat") drawPvpMessages(ctx, pvp.chatMessages, rect, "暂无聊天信息", 3);
  else drawPvpMessages(ctx, pvp.battleEvents, rect, "暂无对战信息", 4);

  ctx.restore();
}

function drawPvpMessages(ctx: CanvasRenderingContext2D, messages: PvpInfoMessage[], rect: any, emptyText: string, maxLines: number) {
  const list = messages.slice(0, maxLines);
  if (list.length === 0) {
    ctx.fillStyle = "#9fb4d9";
    ctx.font = "800 14px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(emptyText, rect.x + 24, rect.y + 88);
    return;
  }

  list.forEach((message, index) => {
    const y = rect.y + 84 + index * 30;
    ctx.fillStyle = message.color;
    ctx.font = "900 13px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(message.from, rect.x + 24, y);
    ctx.fillStyle = "#eef4ff";
    ctx.font = "800 13px system-ui, sans-serif";
    ctx.fillText(message.text, rect.x + 92, y);
  });
}

function drawPvpBattleStatusBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  items: Array<{ label: string; value: string; color: string }>,
  ratio: number,
  color: string,
) {
  const safeRatio = clamp(ratio, 0, 1);
  ctx.save();
  ctx.fillStyle = "rgba(5,10,18,0.78)";
  ctx.strokeStyle = "rgba(190,213,255,0.22)";
  roundRect(ctx, x, y, width, 34, 8);
  ctx.fill();
  ctx.stroke();

  const colWidth = (width - 20) / Math.max(1, items.length);
  items.forEach((item, index) => {
    const left = x + 10 + index * colWidth;
    ctx.textAlign = "left";
    ctx.font = "900 10px system-ui, sans-serif";
    ctx.fillStyle = "#cbd8f2";
    ctx.fillText(item.label, left + 2, y + 17);
    ctx.font = "950 10px system-ui, sans-serif";
    ctx.fillStyle = item.color;
    ctx.fillText(item.value, left + 27, y + 17);
  });

  ctx.fillStyle = "rgba(255,255,255,0.1)";
  roundRect(ctx, x + 10, y + 24, width - 20, 5, 3);
  ctx.fill();
  const fill = ctx.createLinearGradient(x + 10, 0, x + width - 10, 0);
  fill.addColorStop(0, color);
  fill.addColorStop(1, safeRatio <= 0.35 ? "#ff9f43" : "#b9f7a6");
  ctx.fillStyle = fill;
  roundRect(ctx, x + 10, y + 24, (width - 20) * safeRatio, 5, 3);
  ctx.fill();
  ctx.restore();
}

function drawPvpTab(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, active: boolean) {
  ctx.fillStyle = active ? "rgba(97,230,168,0.2)" : "rgba(255,255,255,0.07)";
  ctx.strokeStyle = active ? "rgba(97,230,168,0.62)" : "rgba(190,213,255,0.16)";
  roundRect(ctx, x, y, 112, 36, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = active ? "#dfffea" : "#9fb4d9";
  ctx.font = "900 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, x + 56, y + 23);
}

function drawPvpAvatar(
  ctx: CanvasRenderingContext2D,
  game: any,
  data: { x: number; y: number; id: string; color: string; label: string; hp: number; maxHp: number; active: boolean; eliminated?: boolean },
) {
  ctx.save();
  ctx.globalAlpha = data.eliminated ? 0.48 : 1;
  ctx.fillStyle = "rgba(7,12,22,0.96)";
  ctx.strokeStyle = data.active ? data.color : "rgba(190,213,255,0.28)";
  ctx.lineWidth = data.active ? 3 : 2;
  ctx.shadowColor = data.active ? data.color : "transparent";
  ctx.shadowBlur = data.active ? 18 : 0;
  roundRect(ctx, data.x - 25, data.y - 28, 50, 50, 14);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.save();
  roundRect(ctx, data.x - 22, data.y - 25, 44, 44, 12);
  ctx.clip();
  ctx.fillStyle = data.color;
  ctx.fillRect(data.x - 22, data.y - 25, 44, 44);
  const portrait = game.characterPortraits.get(data.id);
  if (portrait?.complete && portrait.naturalWidth > 0) ctx.drawImage(portrait, data.x - 29, data.y - 33, 58, 58);
  else {
    ctx.fillStyle = "#08111f";
    ctx.font = "900 18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(data.label.slice(0, 1), data.x, data.y - 3);
  }
  ctx.restore();

  const ratio = clamp(data.hp / Math.max(1, data.maxHp), 0, 1);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  roundRect(ctx, data.x - 25, data.y + 27, 50, 5, 3);
  ctx.fill();
  ctx.fillStyle = ratio <= 0.35 ? "#ff6c7e" : "#61e6a8";
  roundRect(ctx, data.x - 25, data.y + 27, 50 * ratio, 5, 3);
  ctx.fill();
  ctx.restore();
}

function drawPvpMetric(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, value: string, color: string, width: number) {
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  roundRect(ctx, x, y, width, 36, 8);
  ctx.fill();
  ctx.fillStyle = "#9fb4d9";
  ctx.font = "800 11px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(label, x + 10, y + 22);
  ctx.fillStyle = color;
  ctx.font = "900 15px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(value, x + width - 10, y + 23);
}

function drawPvpSkillControls(this: any, ctx: CanvasRenderingContext2D, session: Session, rect: any) {
  const pvp = session.pvp;
  if (!pvp) return;
  const controls = pvpSkillControlLayout(rect);
  const modeColor = this.autoSkillEnabled ? "#61e6a8" : "#f6c95f";
  const modeText = this.autoSkillEnabled ? "自动" : "手动";

  ctx.save();
  ctx.fillStyle = "rgba(5,10,18,0.86)";
  ctx.strokeStyle = this.autoSkillEnabled ? "rgba(97,230,168,0.48)" : "rgba(246,201,95,0.52)";
  ctx.lineWidth = 2;
  ctx.shadowColor = this.autoSkillEnabled ? "rgba(97,230,168,0.45)" : "rgba(246,201,95,0.42)";
  ctx.shadowBlur = 12;
  roundRect(ctx, controls.toggle.x, controls.toggle.y, controls.toggle.w, controls.toggle.h, 10);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = modeColor;
  ctx.font = "950 14px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(modeText, controls.toggle.x + controls.toggle.w / 2, controls.toggle.y + 14);
  ctx.fillStyle = "#9fb4d9";
  ctx.font = "850 10px system-ui, sans-serif";
  ctx.fillText(this.autoSkillEnabled ? "技能" : "技能", controls.toggle.x + controls.toggle.w / 2, controls.toggle.y + 30);

  const status = pvp.skillModeTimer > 0 ? pvp.skillModeText : this.autoSkillEnabled ? "技能自动释放中" : "手动技能待命";
  if (pvp.skillModeTimer > 0) {
    ctx.fillStyle = "rgba(5,10,18,0.72)";
    ctx.strokeStyle = "rgba(190,213,255,0.18)";
    roundRect(ctx, controls.status.x, controls.status.y, controls.status.w, controls.status.h, 9);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = this.autoSkillEnabled ? "#61e6a8" : "#f6c95f";
    ctx.font = "900 12px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(status, controls.status.x + controls.status.w - 10, controls.status.y + 19);
  }
  ctx.restore();
}

function pvpLayout() {
  return {
    local: {
      x: 12,
      y: PVP_HEADER_H + PVP_GAP,
      w: PVP_LEFT_WIDTH - 24,
      h: HEIGHT - PVP_HEADER_H - PVP_INFO_H - PVP_GAP * 3,
    },
    right: {
      x: PVP_RIGHT_X + 10,
      y: PVP_HEADER_H + PVP_GAP,
      w: WIDTH - PVP_RIGHT_X - 22,
      h: HEIGHT - PVP_HEADER_H - PVP_INFO_H - PVP_GAP * 3,
    },
    info: {
      x: 12,
      y: HEIGHT - PVP_INFO_H - PVP_GAP,
      w: WIDTH - 24,
      h: PVP_INFO_H,
    },
  };
}

function pvpSkillControlLayout(rect: any) {
  const toggle = {
    x: rect.x + rect.w - 92,
    y: rect.y + 48,
    w: 78,
    h: 38,
  };
  return {
    toggle,
    status: {
      x: Math.max(rect.x + 14, toggle.x - 170),
      y: toggle.y + 44,
      w: 248,
      h: 28,
    },
  };
}

function pvpLocalViewport(rect: any) {
  const scale = Math.min(rect.w / WIDTH, rect.h / HEIGHT);
  return {
    scale,
    x: rect.x + (rect.w - WIDTH * scale) / 2,
    y: rect.y + (rect.h - HEIGHT * scale) / 2,
    w: WIDTH * scale,
    h: HEIGHT * scale,
  };
}

function pvpLocalWorldPoint(rect: any, x: number, y: number) {
  const viewport = pvpLocalViewport(rect);
  if (x < viewport.x || x > viewport.x + viewport.w || y < viewport.y || y > viewport.y + viewport.h) return null;
  return {
    x: (x - viewport.x) / viewport.scale,
    y: (y - viewport.y) / viewport.scale,
  };
}

function pointInRect(x: number, y: number, rect: any) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function pushPvpBattleEvent(pvp: PvpSessionState, from: string, text: string, color: string) {
  pvp.battleEvents.unshift({ from, text, color });
  pvp.battleEvents = pvp.battleEvents.slice(0, 8);
}

function pushPvpChatMessage(pvp: PvpSessionState, from: string, text: string, color: string) {
  pvp.chatMessages.unshift({ from, text, color });
  pvp.chatMessages = pvp.chatMessages.slice(0, 8);
}

function pickLocalPressureType(session: Session, pressure: number): PvpPressureType {
  if (session.wave >= 10 && pressure >= 90) return "boss_boost";
  if (session.wave >= 8 && pressure >= 90) return "elite_drop";
  if (session.wave >= 6) return "shield_boost";
  if (session.wave >= 3) return "fast_raid";
  return "small_reinforce";
}

function pvpPressureEnemies(type: PvpPressureType, waveType: WaveConfig["type"]) {
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

export const gamePvpLocalMethods = {
  createLocalPvpState,
  restorePvpAutomation,
  startPvpPreload,
  bindPvpChatEvents,
  updatePvpChatOverlay,
  submitPvpChatMessage,
  updatePvpSession,
  finishPvpByServer,
  syncPvpServerOpponent,
  applyPvpServerSnapshot,
  buildLocalPvpPlayerSnapshot,
  addPvpPressureForKill,
  sendLocalPvpPressure,
  applyPvpIncomingPressure,
  applyPvpPressureToWave,
  notePvpAutoUpgrade,
  notePvpAutoUpgradeBatch,
  handlePvpCanvasPointer,
  selectedPvpOpponent,
  drawPvpBattle,
  drawPvpHeader,
  drawPvpOpponentPanel,
  drawPvpFooter,
} satisfies Record<string, GameMethod>;
