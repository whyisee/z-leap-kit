import type { SaveData, ShopReward } from "../core/types";
import { normalizeSave } from "../state/save";

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

const AUTH_KEY = "game-marbles-auth-v1";
const API_BASE = apiBaseUrl();

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
      this.applyProfile(bootstrap.user);
      this.playerRevision = bootstrap.playerRevision;
      this.online = true;
      saveAuth(this.auth);
      return {
        online: true,
        save: normalizeSave(bootstrap.playerState),
        notice: `已同步远程存档 · ${bootstrap.configVersion}`,
        requiresLogin: false,
      };
    } catch (error) {
      console.warn("[backend] bootstrap failed", error);
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
      throw new Error(data?.message || `HTTP ${response.status}`);
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
    },
    notice: string,
  ) {
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
      notice,
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
