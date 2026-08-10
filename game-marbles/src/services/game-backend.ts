import type {
  LeaderboardBoardId,
  LeaderboardCatalogResponse,
  LeaderboardResponse,
  PvpMiniEnemy,
  PvpMiniMarble,
  PvpPressureType,
  PvpRankMode,
  SaveData,
  ShopReward,
} from "../core/types";
import { applyRuntimeContentConfig } from "../config/cosmetics";
import { normalizeSave } from "../state/save";
import type { PvpRankApplyResult, PvpRankResultContext } from "../systems/pvp/rank";

type AuthCache = {
  deviceId: string;
  accessToken: string;
  userId: string;
  username: string;
  nickname: string;
  avatar: string;
};

type BootstrapResponse = {
  user: UserProfile;
  playerRevision: number;
  playerState: SaveData;
  configVersion: string;
  contentConfig?: unknown;
  activities: unknown[];
};

export type UserProfile = {
  userId: string;
  username: string;
  nickname: string;
  avatar: string;
  isGuest: boolean;
};

type BattleStartResponse = {
  battleId: string;
  seed: string;
  configVersion: string;
};

type BattleFinishPayload = {
  battleId: string | null;
  result: "win" | "lose";
  wave: number;
  durationMs: number;
  kills: number;
  selectedUpgrades: string[];
  acceptedRewards: {
    coins: number;
    shards: number;
    drops: unknown[];
  };
  clientSummary: Record<string, unknown>;
};

type RedeemCodeResponse = {
  ok: true;
  code: string;
  title: string;
  rewards: ShopReward[];
  rewardLabels: string[];
  rewardText: string;
  playerRevision: number;
  playerState: SaveData;
};

export type PvpServerEvent = {
  seq: number;
  kind: "system" | "battle" | "chat" | "pressure" | "result";
  from: string;
  text: string;
  color: string;
  pressureType?: PvpPressureType;
  result?: "win" | "lose";
};

export type PvpAiSnapshotResponse = {
  sessionId: string;
  serverTime: number;
  opponent: {
    id: string;
    name: string;
    avatar: string;
    lineup: string[];
    color: string;
    rankScore?: number;
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
    miniEntities: number;
  };
  events: PvpServerEvent[];
};

export type PvpMatchMode = "duel" | "battle_royale";
export type PvpMatchStatus = "queued" | "matched" | "cancelled";
export type PvpOpponentType = "player" | "server_ai";

export type PvpMatchProfile = {
  id: string;
  name: string;
  avatar: string;
  lineup?: string[];
  color: string;
  rank: string;
  rankScore?: number;
};

export type PvpMatchResponse = {
  ticketId: string;
  mode: PvpMatchMode;
  status: PvpMatchStatus;
  opponentType: PvpOpponentType | null;
  matchId: string | null;
  waitMs: number;
  timeoutMs: number;
  fallbackAt: number;
  serverTime: number;
  message: string;
  opponent: PvpMatchProfile | null;
};

export type PvpPlayerSnapshotPayload = {
  ticketId: string;
  snapshot: PvpAiSnapshotResponse["opponent"];
};

export type PvpPlayerFinishPayload = {
  ticketId: string;
  result: "win" | "lose";
  reason: string;
  wave: number;
  baseHp: number;
  kills: number;
  pressureSent: number;
  pressureTaken: number;
  snapshot: PvpAiSnapshotResponse["opponent"];
};

export type PvpRankFinishPayload = {
  mode: PvpRankMode;
  result: "win" | "lose";
  summary: PvpRankResultContext & {
    matchId?: string | null;
    ticketId?: string | null;
    opponentType?: PvpOpponentType | PvpSessionOpponentType | null;
  };
};

type PvpSessionOpponentType = "player" | "server_ai";

type PvpRankFinishResponse = {
  ok: true;
  playerRevision: number;
  playerState: SaveData;
  rankResult: PvpRankApplyResult;
  pvpCoins: number;
};

const AUTH_KEY = "game-marbles-auth-v1";
const API_BASE = apiBaseUrl();

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code = "",
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export class GameBackend {
  private auth: AuthCache = loadAuth();
  private playerRevision = 0;
  private online = false;
  private saveQueue: Promise<void> = Promise.resolve();

  get isOnline() {
    return this.online;
  }

  get hasStoredSession() {
    return Boolean(this.auth.accessToken);
  }

  get isLoggedIn() {
    return Boolean(this.auth.accessToken && this.auth.userId);
  }

  get accountInfo() {
    return {
      userId: this.auth.userId,
      shortId: this.auth.userId ? this.auth.userId.slice(0, 8).toUpperCase() : "",
      nickname: this.auth.nickname,
      username: this.auth.username,
      avatar: this.auth.avatar || "avatar_green",
      deviceId: this.auth.deviceId,
      online: this.online,
      loggedIn: this.isLoggedIn,
    };
  }

  async bootstrap(localSave: SaveData) {
    try {
      if (!this.auth.accessToken) {
        return {
          online: false,
          save: localSave,
          notice: "本地离线模式 · 登录后可同步存档和使用兑换码",
          requiresLogin: true,
        };
      }

      const bootstrap = await this.request<BootstrapResponse>("/bootstrap");
      const runtimeConfig = applyRuntimeContentConfig(bootstrap.contentConfig);
      this.applyProfile(bootstrap.user);
      this.playerRevision = bootstrap.playerRevision;
      this.online = true;
      saveAuth(this.auth);
      return {
        online: true,
        save: normalizeSave(bootstrap.playerState),
        notice:
          runtimeConfig.appliedCosmetics > 0
            ? `已同步远程存档 · ${bootstrap.configVersion} · 幻化配置 ${runtimeConfig.appliedCosmetics} 项`
            : `已同步远程存档 · ${bootstrap.configVersion}`,
        requiresLogin: false,
      };
    } catch (error) {
      console.warn("[backend] bootstrap failed", error);
      if (error instanceof ApiRequestError && error.status === 401) {
        this.switchAccount();
        return {
          online: false,
          save: localSave,
          notice: "登录状态已失效，请重新登录",
          requiresLogin: true,
        };
      }
      this.online = false;
      return {
        online: false,
        save: localSave,
        notice: "后端暂不可用，当前使用本地缓存",
        requiresLogin: false,
      };
    }
  }

  async loginWithPassword(username: string, password: string) {
    const auth = await this.request<{
      userId: string;
      user: UserProfile;
      accessToken: string;
      playerRevision: number;
      playerState: SaveData;
      configVersion?: string;
      contentConfig?: unknown;
    }>("/auth/login", {
      method: "POST",
      auth: false,
      body: {
        deviceId: this.auth.deviceId,
        username,
        password,
      },
    });
    return this.applyAuthResponse(auth, `登录成功 · ${auth.user.nickname}`);
  }

  async registerWithPassword(username: string, password: string, localSave: SaveData) {
    const auth = await this.request<{
      userId: string;
      user: UserProfile;
      accessToken: string;
      playerRevision: number;
      playerState: SaveData;
      configVersion?: string;
      contentConfig?: unknown;
    }>("/auth/register", {
      method: "POST",
      auth: false,
      body: {
        deviceId: this.auth.deviceId,
        username,
        password,
        localSave,
      },
    });
    return this.applyAuthResponse(auth, `注册成功 · ${auth.user.nickname}`);
  }

  async updateProfile(profile: { nickname: string; avatar: string }) {
    const response = await this.request<{ user: UserProfile }>("/profile", {
      method: "PUT",
      body: {
        opId: opId("profile"),
        nickname: profile.nickname,
        avatar: profile.avatar,
      },
    });
    this.applyProfile(response.user);
    this.online = true;
    saveAuth(this.auth);
    return response.user;
  }

  switchAccount() {
    this.auth = {
      deviceId: createDeviceId(),
      accessToken: "",
      userId: "",
      username: "",
      nickname: "",
      avatar: "avatar_green",
    };
    this.playerRevision = 0;
    this.online = false;
    saveAuth(this.auth);
  }

  saveState(save: SaveData, reason: string) {
    this.saveQueue = this.saveQueue
      .catch(() => undefined)
      .then(async () => {
        if (!this.auth.accessToken) return;
        try {
          const response = await this.request<{ playerRevision: number; playerState: SaveData }>("/player/state", {
            method: "PUT",
            body: {
              opId: opId(reason),
              baseRevision: this.playerRevision,
              reason,
              state: save,
            },
          });
          this.playerRevision = response.playerRevision;
          this.online = true;
        } catch (error) {
          console.warn("[backend] save state failed", error);
          this.online = false;
        }
      });
    return this.saveQueue;
  }

  async startBattle(payload: {
    mode: string;
    stage: number;
    lineup: string[];
    baseGems: Array<string | null>;
    characterMarbles: SaveData["characterMarbles"];
  }) {
    if (!this.auth.accessToken) return null;
    try {
      const response = await this.request<BattleStartResponse>("/battle/start", {
        method: "POST",
        body: {
          opId: opId("battle-start"),
          ...payload,
        },
      });
      this.online = true;
      return response;
    } catch (error) {
      console.warn("[backend] battle start failed", error);
      this.online = false;
      return null;
    }
  }

  async finishBattle(payload: BattleFinishPayload) {
    if (!this.auth.accessToken || !payload.battleId) return null;
    try {
      const response = await this.request<{ accepted: boolean; validationFlags: string[] }>("/battle/finish", {
        method: "POST",
        body: {
          opId: opId("battle-finish"),
          ...payload,
        },
      });
      this.online = true;
      return response;
    } catch (error) {
      console.warn("[backend] battle finish failed", error);
      this.online = false;
      return null;
    }
  }

  async startPvpAiOpponent(payload: { stageId: string; lineup: string[]; avatar: string; nickname: string }) {
    try {
      const response = await this.request<PvpAiSnapshotResponse>("/pvp/ai/start", {
        method: "POST",
        auth: false,
        body: {
          ...payload,
          deviceId: this.auth.deviceId,
        },
      });
      this.online = true;
      return response;
    } catch (error) {
      console.warn("[backend] pvp ai start failed", error);
      this.online = false;
      throw error;
    }
  }

  async startPvpMatchmaking(payload: { mode: PvpMatchMode; rank: string; rankScore?: number; lineup: string[] }) {
    try {
      const response = await this.request<PvpMatchResponse>("/pvp/match/start", {
        method: "POST",
        auth: false,
        body: {
          ...payload,
          userId: this.auth.userId,
          deviceId: this.auth.deviceId,
          nickname: this.auth.nickname || "玩家",
          avatar: this.auth.avatar || "engineer",
        },
      });
      this.online = true;
      return response;
    } catch (error) {
      console.warn("[backend] pvp match start failed", error);
      this.online = false;
      throw error;
    }
  }

  async getPvpMatchStatus(ticketId: string) {
    try {
      const response = await this.request<PvpMatchResponse>(`/pvp/match/${encodeURIComponent(ticketId)}`, {
        auth: false,
      });
      this.online = true;
      return response;
    } catch (error) {
      console.warn("[backend] pvp match status failed", error);
      this.online = false;
      throw error;
    }
  }

  async cancelPvpMatchmaking(ticketId: string) {
    try {
      const response = await this.request<PvpMatchResponse>(`/pvp/match/${encodeURIComponent(ticketId)}/cancel`, {
        method: "POST",
        auth: false,
      });
      this.online = true;
      return response;
    } catch (error) {
      console.warn("[backend] pvp match cancel failed", error);
      this.online = false;
      throw error;
    }
  }

  async syncPvpPlayerSnapshot(matchId: string, payload: PvpPlayerSnapshotPayload) {
    try {
      const response = await this.request<PvpAiSnapshotResponse>(`/pvp/matches/${encodeURIComponent(matchId)}/snapshot`, {
        method: "POST",
        auth: false,
        body: payload,
      });
      this.online = true;
      return response;
    } catch (error) {
      console.warn("[backend] pvp player snapshot failed", error);
      this.online = false;
      throw error;
    }
  }

  async sendPvpPlayerPressure(matchId: string, payload: { ticketId: string; pressureType: PvpPressureType; power: number }) {
    try {
      const response = await this.request<PvpAiSnapshotResponse>(`/pvp/matches/${encodeURIComponent(matchId)}/pressure`, {
        method: "POST",
        auth: false,
        body: payload,
      });
      this.online = true;
      return response;
    } catch (error) {
      console.warn("[backend] pvp player pressure failed", error);
      this.online = false;
      throw error;
    }
  }

  async finishPvpPlayerMatch(matchId: string, payload: PvpPlayerFinishPayload) {
    try {
      const response = await this.request<PvpAiSnapshotResponse>(`/pvp/matches/${encodeURIComponent(matchId)}/finish`, {
        method: "POST",
        auth: false,
        body: payload,
      });
      this.online = true;
      return response;
    } catch (error) {
      console.warn("[backend] pvp player finish failed", error);
      this.online = false;
      throw error;
    }
  }

  async finishPvpRank(payload: PvpRankFinishPayload) {
    if (!this.auth.accessToken) return null;
    try {
      await this.saveQueue.catch(() => undefined);
      const response = await this.request<PvpRankFinishResponse>("/pvp/rank/finish", {
        method: "POST",
        body: {
          opId: opId("pvp-rank-finish"),
          ...payload,
        },
      });
      this.playerRevision = response.playerRevision;
      this.online = true;
      return {
        ...response,
        save: normalizeSave(response.playerState),
      };
    } catch (error) {
      console.warn("[backend] pvp rank finish failed", error);
      this.online = false;
      return null;
    }
  }

  async sendPvpPlayerChat(matchId: string, payload: { ticketId: string; text: string; from: string }) {
    try {
      const response = await this.request<PvpAiSnapshotResponse>(`/pvp/matches/${encodeURIComponent(matchId)}/chat`, {
        method: "POST",
        auth: false,
        body: payload,
      });
      this.online = true;
      return response;
    } catch (error) {
      console.warn("[backend] pvp player chat failed", error);
      this.online = false;
      throw error;
    }
  }

  async getPvpAiSnapshot(sessionId: string) {
    try {
      const response = await this.request<PvpAiSnapshotResponse>(`/pvp/ai/${encodeURIComponent(sessionId)}/snapshot`, {
        auth: false,
      });
      this.online = true;
      return response;
    } catch (error) {
      console.warn("[backend] pvp ai snapshot failed", error);
      this.online = false;
      throw error;
    }
  }

  async sendPvpAiPressure(sessionId: string, payload: { pressureType: PvpPressureType; power: number }) {
    try {
      const response = await this.request<PvpAiSnapshotResponse>(`/pvp/ai/${encodeURIComponent(sessionId)}/pressure`, {
        method: "POST",
        auth: false,
        body: payload,
      });
      this.online = true;
      return response;
    } catch (error) {
      console.warn("[backend] pvp ai pressure failed", error);
      this.online = false;
      throw error;
    }
  }

  async sendPvpAiChat(sessionId: string, payload: { text: string; from: string }) {
    try {
      const response = await this.request<PvpAiSnapshotResponse>(`/pvp/ai/${encodeURIComponent(sessionId)}/chat`, {
        method: "POST",
        auth: false,
        body: payload,
      });
      this.online = true;
      return response;
    } catch (error) {
      console.warn("[backend] pvp ai chat failed", error);
      this.online = false;
      throw error;
    }
  }

  async redeemCode(code: string) {
    if (!this.auth.accessToken) throw new Error("请先登录账号");
    const response = await this.request<RedeemCodeResponse>("/redeem-code", {
      method: "POST",
      body: {
        opId: opId("redeem-code"),
        code,
      },
    });
    this.playerRevision = response.playerRevision;
    this.online = true;
    return {
      ...response,
      save: normalizeSave(response.playerState),
    };
  }

  async getLeaderboards() {
    if (!this.auth.accessToken) throw new Error("请先登录账号");
    const response = await this.request<LeaderboardCatalogResponse>("/leaderboards");
    this.online = true;
    return response;
  }

  async getLeaderboard(
    boardId: LeaderboardBoardId,
    params: { seasonId?: string; offset?: number; limit?: number } = {},
  ) {
    if (!this.auth.accessToken) throw new Error("请先登录账号");
    const query = new URLSearchParams();
    if (params.seasonId) query.set("seasonId", params.seasonId);
    if (params.offset !== undefined) query.set("offset", String(params.offset));
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    const suffix = query.toString() ? `?${query.toString()}` : "";
    const response = await this.request<LeaderboardResponse>(`/leaderboards/${encodeURIComponent(boardId)}${suffix}`);
    this.online = true;
    return response;
  }

  async getLeaderboardAroundMe(boardId: LeaderboardBoardId, params: { seasonId?: string; radius?: number } = {}) {
    if (!this.auth.accessToken) throw new Error("请先登录账号");
    const query = new URLSearchParams();
    if (params.seasonId) query.set("seasonId", params.seasonId);
    if (params.radius !== undefined) query.set("radius", String(params.radius));
    const suffix = query.toString() ? `?${query.toString()}` : "";
    const response = await this.request<LeaderboardResponse>(`/leaderboards/${encodeURIComponent(boardId)}/me${suffix}`);
    this.online = true;
    return response;
  }

  private async request<T>(
    path: string,
    options: {
      method?: "GET" | "POST" | "PUT";
      body?: unknown;
      auth?: boolean;
    } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-client-version": "h5-dev",
      "x-device-id": this.auth.deviceId,
    };
    if (options.auth !== false && this.auth.accessToken) {
      headers.authorization = `Bearer ${this.auth.accessToken}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ApiRequestError(data?.message || `HTTP ${response.status}`, response.status, data?.code || "");
    }
    return data as T;
  }

  private applyProfile(profile: UserProfile) {
    this.auth.userId = profile.userId;
    this.auth.username = profile.username;
    this.auth.nickname = profile.nickname;
    this.auth.avatar = profile.avatar;
  }

  private applyAuthResponse(
    auth: {
      userId: string;
      user: UserProfile;
      accessToken: string;
      playerRevision: number;
      playerState: SaveData;
      configVersion?: string;
      contentConfig?: unknown;
    },
    notice: string,
  ) {
    const runtimeConfig = applyRuntimeContentConfig(auth.contentConfig);
    this.auth = {
      ...this.auth,
      userId: auth.userId,
      accessToken: auth.accessToken,
    };
    this.applyProfile(auth.user);
    this.playerRevision = auth.playerRevision;
    saveAuth(this.auth);
    this.online = true;
    return {
      save: normalizeSave(auth.playerState),
      notice:
        runtimeConfig.appliedCosmetics > 0 && auth.configVersion
          ? `${notice} · 幻化配置 ${runtimeConfig.appliedCosmetics} 项`
          : notice,
    };
  }
}

function apiBaseUrl() {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env;
  return (env?.VITE_API_URL || "http://localhost:4325/api").replace(/\/+$/, "");
}

function loadAuth(): AuthCache {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      deviceId: parsed.deviceId || createDeviceId(),
      accessToken: parsed.accessToken || "",
      userId: parsed.userId || "",
      username: parsed.username || "",
      nickname: parsed.nickname || "",
      avatar: parsed.avatar || "avatar_green",
    };
  } catch {
    return {
      deviceId: createDeviceId(),
      accessToken: "",
      userId: "",
      username: "",
      nickname: "",
      avatar: "avatar_green",
    };
  }
}

function saveAuth(auth: AuthCache) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

function createDeviceId() {
  return globalThis.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function opId(reason: string) {
  const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${reason}:${id}`;
}
