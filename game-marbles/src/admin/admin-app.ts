// @ts-nocheck

import "@shoelace-style/shoelace/dist/themes/dark.css";
import "@shoelace-style/shoelace/dist/components/tree/tree.js";
import "@shoelace-style/shoelace/dist/components/tree-item/tree-item.js";
import Plus from "lucide/dist/esm/icons/plus.mjs";
import Search from "lucide/dist/esm/icons/search.mjs";
import { characters } from "../config/characters";
import { cosmeticConfigs, cosmeticPools, cosmeticsForPool } from "../config/cosmetics";
import { enemyConfigs } from "../config/enemies";
import { bonds } from "../config/bonds";
import { formations } from "../config/formations";
import { collectibleConfigs, gemConfigs } from "../config/loot";
import { marbleConfigs } from "../config/marbles";
import { shopCategories, shopItems } from "../config/shop";
import { stages } from "../config/stages";
import { tacticalDecks } from "../config/tactical-decks";
import { upgradeCards } from "../config/upgrades";
import { marbleShapeIconImage, marbleShapeIconUrl } from "../core/marble-shape-assets";
import { drawMarbleShapeDetail, drawMarbleShapePath, marbleShapeGroups, marbleShapeIds, marbleShapeLabels, marbleShapeRotation } from "../core/marble-shapes";
import { rarityName } from "../core/rarity";
import type { CosmeticConfig, EnemyConfig, EnemyType, ShopItemConfig, StageConfig, UpgradeCard } from "../core/types";

type AdminProfile = {
  adminId: string;
  username: string;
  nickname: string;
  role: string;
};

type AdminAuth = {
  accessToken: string;
  admin: AdminProfile | null;
};

type AdminModule = "marble" | "hero" | "skill" | "tactic" | "enemy" | "stage" | "character" | "gacha" | "shop" | "redeem" | "users" | "publish";
type AdminNavGroupId = "appearance" | "combat" | "operation" | "manage";
type ShoelaceTreeSelectionEvent = CustomEvent<{ selection: HTMLElement[] }>;

const ADMIN_AUTH_KEY = "game-marbles-admin-auth-v1";
const ADMIN_DRAFTS_KEY = "game-marbles-admin-content-drafts-v1";
const ADMIN_RELEASES_KEY = "game-marbles-admin-releases-v1";
const LOCAL_ADMIN_TOKEN = "local-dev-admin-token";
const API_BASE = adminApiBaseUrl();
const INITIAL_DRAFT_STATE = loadAdminDraftState();

const adminIcons = {
  plus: lucideIconHtml(Plus),
  search: lucideIconHtml(Search),
};

const moduleLabels: Record<AdminModule, { title: string; nav: string; library: string; preview: string }> = {
  marble: { title: "弹珠幻化设计器", nav: "弹珠幻化", library: "弹珠外观内容库", preview: "战斗拖尾预览" },
  hero: { title: "角色设计器", nav: "角色设计", library: "角色配置库", preview: "角色战斗定位" },
  skill: { title: "技能设计器", nav: "技能设计", library: "主动技能库", preview: "技能战斗预览" },
  tactic: { title: "战术设计器", nav: "战术设计", library: "战术卡库", preview: "战术卡预览" },
  enemy: { title: "怪物设计器", nav: "怪物设计", library: "怪物配置库", preview: "怪物战场预览" },
  stage: { title: "关卡设计器", nav: "关卡设计", library: "主线关卡库", preview: "关卡节奏预览" },
  character: { title: "角色服装设计器", nav: "角色服装", library: "角色服装内容库", preview: "角色展示预览" },
  gacha: { title: "抽卡池设计器", nav: "抽卡池", library: "卡池配置", preview: "概率与投放预览" },
  shop: { title: "商店投放设计器", nav: "商店投放", library: "商品投放库", preview: "商品卡预览" },
  redeem: { title: "兑换码管理", nav: "兑换码", library: "兑换码库", preview: "领取与奖励预览" },
  users: { title: "用户管理", nav: "用户管理", library: "玩家账号", preview: "玩家摘要" },
  publish: { title: "发布中心", nav: "发布中心", library: "配置版本", preview: "发布摘要" },
};

const adminNavGroups: Array<{ id: AdminNavGroupId; title: string; modules: AdminModule[] }> = [
  { id: "appearance", title: "外观与角色", modules: ["marble", "character", "hero", "skill"] },
  { id: "combat", title: "战斗关卡", modules: ["tactic", "enemy", "stage"] },
  { id: "operation", title: "商业运营", modules: ["gacha", "shop", "redeem"] },
  { id: "manage", title: "管理发布", modules: ["users", "publish"] },
];

const contentModuleIds: Array<Exclude<AdminModule, "publish" | "users" | "redeem">> = ["marble", "hero", "skill", "tactic", "enemy", "stage", "character", "gacha", "shop"];
const characterRarityOptions = ["common", "rare", "epic", "legendary"];
const characterRarityLabels: Record<string, string> = {
  common: "普通",
  rare: "稀有",
  epic: "史诗",
  legendary: "传说",
};
const heroUnlockTypeOptions = ["none", "stage", "wins", "collectible"];
const heroUnlockTypeLabels: Record<string, string> = {
  none: "初始解锁",
  stage: "主线进度",
  wins: "通关胜场",
  collectible: "收藏品",
};
const skillTargetingOptions = ["self", "densest", "bottom", "random", "lane", "global"];
const skillTargetingLabels: Record<string, string> = {
  self: "自身强化",
  densest: "敌群密集区",
  bottom: "靠近底线",
  random: "随机敌人",
  lane: "当前弹道",
  global: "全场效果",
};
const skillEffectTypeOptions = ["buff", "damage", "control", "summon", "economy", "defense"];
const skillEffectTypeLabels: Record<string, string> = {
  buff: "强化",
  damage: "伤害",
  control: "控制",
  summon: "召唤/弹幕",
  economy: "经济",
  defense: "防御",
};
const tacticKindOptions = ["stackable", "tiered", "character", "utility", "unique"];
const tacticKindLabels: Record<string, string> = {
  stackable: "可叠加",
  tiered: "升级链",
  character: "角色专属",
  utility: "功能卡",
  unique: "唯一机制",
};
const tacticEffectTypeOptions = ["attribute", "utility", "hybrid"];
const tacticEffectTypeLabels: Record<string, string> = {
  attribute: "属性",
  utility: "流程",
  hybrid: "机制",
};
const tacticTierOptions = ["none", "basic", "middle", "high"];
const tacticTierLabels: Record<string, string> = {
  none: "无阶级",
  basic: "初阶",
  middle: "中阶",
  high: "高阶",
};
const tacticSourceOptions = ["global", "formation", "character", "marble", "bond", "stage"];
const tacticSourceLabels: Record<string, string> = {
  global: "全局",
  formation: "阵法",
  character: "角色",
  marble: "弹珠",
  bond: "羁绊",
  stage: "关卡",
};
const tacticCoreTypeOptions = ["none", "main", "sub", "enhance"];
const tacticCoreTypeLabels: Record<string, string> = {
  none: "非核心",
  main: "主核心",
  sub: "副核心",
  enhance: "核心强化",
};
const enemyTypeOptions = Object.keys(enemyConfigs) as EnemyType[];
const enemyRoleOptions = ["swarm", "assault", "armor", "control", "support", "reward", "elite", "boss"];
const enemyRoleLabels: Record<string, string> = {
  swarm: "基础单位",
  assault: "高速突击",
  armor: "重甲压线",
  control: "机制单位",
  support: "辅助单位",
  reward: "奖励单位",
  elite: "精英单位",
  boss: "首领单位",
};
const enemyBehaviorOptions = ["none", "split", "shield", "heal", "gold", "eliteGuard", "bossCore"];
const enemyBehaviorLabels: Record<string, string> = {
  none: "普通推进",
  split: "死亡分裂",
  shield: "周期护盾",
  heal: "治疗支援",
  gold: "高金币掉落",
  eliteGuard: "精英压迫",
  bossCore: "首领阶段",
};
const stageWaveTypeOptions = ["normal", "pressure", "reward", "elite", "boss"];
const stageWaveTypeLabels: Record<string, string> = {
  normal: "普通",
  pressure: "压力",
  reward: "奖励",
  elite: "精英",
  boss: "首领",
};
const stageChapterOptions = ["1", "2", "3", "4", "5"];
const stageChapterLabels: Record<string, string> = {
  "1": "废城外环",
  "2": "磁轨工厂",
  "3": "熔火管道",
  "4": "幽蓝数据层",
  "5": "天穹防线",
};
const userStatusOptions = ["all", "active", "banned", "disabled"];
const userStatusLabels: Record<string, string> = {
  all: "全部状态",
  active: "正常",
  banned: "封禁中",
  disabled: "停用",
};
const redeemStatusOptions = ["all", "active", "draft", "paused", "disabled", "expired"];
const redeemStatusLabels: Record<string, string> = {
  all: "全部状态",
  active: "可领取",
  draft: "草稿",
  paused: "暂停",
  disabled: "停用",
  expired: "已过期",
};
const releaseEnvOptions = ["test", "gray", "production"];
const releaseEnvLabels: Record<string, string> = {
  test: "测试环境",
  gray: "灰度环境",
  production: "正式环境",
};
const releaseModeOptions = ["now", "scheduled"];
const releaseModeLabels: Record<string, string> = {
  now: "立即发布",
  scheduled: "定时发布",
};

const characterPortraitSources: Record<string, string> = {
  engineer: new URL("../assets/heroes/hero-engineer.png", import.meta.url).href,
  bomber: new URL("../assets/heroes/hero-bomber.png", import.meta.url).href,
  magnetist: new URL("../assets/heroes/hero-magnetist.png", import.meta.url).href,
  sentinel: new URL("../assets/heroes/hero-sentinel.png", import.meta.url).href,
  prism: new URL("../assets/heroes/hero-prism.png", import.meta.url).href,
  alchemist: new URL("../assets/heroes/hero-alchemist.png", import.meta.url).href,
  frostseer: new URL("../assets/heroes/hero-frostseer.png", import.meta.url).href,
  voidbinder: new URL("../assets/heroes/hero-voidbinder.png", import.meta.url).href,
  treasurer: new URL("../assets/heroes/hero-treasurer.png", import.meta.url).href,
};

const trailStyles = ["soft", "spark", "stardust", "leaf", "ribbon", "flame", "electric", "frost", "firework", "petal", "aurora", "galaxy"];
const trailStyleLabels: Record<string, string> = {
  soft: "柔光",
  spark: "火花",
  stardust: "星尘",
  leaf: "叶影",
  ribbon: "绸带",
  flame: "火焰",
  electric: "电弧",
  frost: "冰霜",
  firework: "礼花",
  petal: "花瓣",
  aurora: "极光",
  galaxy: "星河",
};

const trailAnimations = ["steady", "pulse", "flicker", "sparkle", "flow", "zigzag", "orbit"];
const trailAnimationLabels: Record<string, string> = {
  steady: "稳定",
  pulse: "脉冲",
  flicker: "闪烁",
  sparkle: "星闪",
  flow: "流动",
  zigzag: "折线",
  orbit: "环绕",
};

const marbleShapes = marbleShapeIds;

const outfitMotionOptions = ["idle", "repair", "burst", "float", "victory"];
const outfitMotionLabels: Record<string, string> = {
  idle: "待机",
  repair: "维修",
  burst: "爆发",
  float: "悬浮",
  victory: "胜利展示",
};

const skillFxOptions = ["base", "neon", "flame", "aurora", "void", "treasure"];
const skillFxLabels: Record<string, string> = {
  base: "基础",
  neon: "霓虹",
  flame: "熔火",
  aurora: "极光",
  void: "虚空",
  treasure: "财宝",
};

const currencyOptions = ["coins", "energyCrystals", "pvpCoins"];
const currencyLabels: Record<string, string> = {
  coins: "金币",
  energyCrystals: "能源晶体",
  pvpCoins: "竞技币",
};

const refreshOptions = ["daily", "weekly", "once"];
const refreshLabels: Record<string, string> = {
  daily: "每日刷新",
  weekly: "每周刷新",
  once: "账号一次",
};

const shopCategoryLabels: Record<string, string> = Object.fromEntries(shopCategories.map((item) => [item.id, item.label]));
const shopCategoryOptions = shopCategories.filter((item) => item.id !== "recommended").map((item) => item.id);

const rewardTypeOptions = [
  "coins",
  "pvpCoins",
  "energyCrystals",
  "marbleShard",
  "randomMarbleShard",
  "gem",
  "collectible",
  "characterUnlock",
  "ticket",
  "allMarbleCosmetics",
];
const rewardTypeLabels: Record<string, string> = {
  coins: "金币",
  pvpCoins: "竞技币",
  energyCrystals: "能源晶体",
  marbleShard: "指定弹珠碎片",
  randomMarbleShard: "随机弹珠碎片",
  gem: "宝石",
  collectible: "收藏品",
  characterUnlock: "角色解锁",
  ticket: "道具券",
  allMarbleCosmetics: "弹珠幻化全套",
};
const ticketOptions = ["insurance", "scan", "refresh"];
const ticketLabels: Record<string, string> = {
  insurance: "撤离保险券",
  scan: "战术扫描券",
  refresh: "刷新券",
};
const unlockTypeOptions = ["none", "stage", "wins", "pvpRank"];
const unlockTypeLabels: Record<string, string> = {
  none: "无门槛",
  stage: "主线关卡",
  wins: "胜场数量",
  pvpRank: "竞技段位",
};
const pvpRankModeLabels: Record<string, string> = {
  duel: "1v1",
  power_duel: "养成竞技",
  battle_royale: "吃鸡模式",
};
const pvpRankTierOptions = ["bronze", "silver", "gold", "platinum", "diamond", "master", "legend"];
const pvpRankTierLabels: Record<string, string> = {
  bronze: "青铜",
  silver: "白银",
  gold: "黄金",
  platinum: "铂金",
  diamond: "钻石",
  master: "大师",
  legend: "传说",
};
const pvpRankDivisionOptions = ["3", "2", "1"];

const numericFields = new Set([
  "marbleTrailLength",
  "marbleTrailWidth",
  "marbleTrailDensity",
  "marbleTrailOpacity",
  "marbleTrailGlow",
  "marbleTrailTurbulence",
  "marbleTrailFade",
  "marbleTrailSegmentSpacing",
  "marbleTrailSparkRate",
  "characterSkillFxIntensity",
  "characterAvatarGlow",
  "characterShowcaseGlow",
  "singleCrystalCost",
  "pityEpic",
  "pityLegendary",
  "rateRare",
  "rateEpic",
  "rateLegendary",
  "priceAmount",
  "stock",
  "shopPriority",
  "unlockValue",
  "unlockRankDivision",
  "releaseGrayPercent",
  "releaseScheduleDelayHours",
  "heroUnlockStage",
  "heroUnlockWins",
  "heroUnlockAmount",
  "skillCooldown",
  "skillDuration",
  "skillPower",
  "skillRadius",
  "skillProjectileCount",
  "skillControl",
  "skillGoldGain",
  "skillPreviewIntensity",
  "tacticWeight",
  "tacticMaxStacks",
  "enemyHp",
  "enemySpeed",
  "enemyRadius",
  "enemyExp",
  "enemyCoins",
  "enemyArmor",
  "enemySpawnWeight",
  "enemyThreatLevel",
  "stageIndex",
  "stageChapter",
  "stageNo",
  "stageHpMultiplier",
  "stageSpeedMultiplier",
  "stageDensityMultiplier",
  "stageRewardCoins",
]);

export function mountAdminApp() {
  document.body.classList.add("admin-mode");
  document.title = "弹珠打撤 · 后台内容工坊";
  const root = document.getElementById("app");
  if (!root) return;
  new AdminContentDesignerApp(root);
}

class AdminContentDesignerApp {
  private auth: AdminAuth = loadAdminAuth();
  private activeModule: AdminModule = "marble";
  private selectedIds: Record<AdminModule, string> = { marble: "", hero: "", skill: "", tactic: "", enemy: "", stage: "", character: "", gacha: "", shop: "", redeem: "", users: "", publish: "candidate" };
  private drafts: Record<string, any> = INITIAL_DRAFT_STATE.drafts;
  private touched: Record<string, boolean> = INITIAL_DRAFT_STATE.touched;
  private notice = "";
  private busy = false;
  private exportOpen = false;
  private previewFrame = 0;
  private users: any[] = [];
  private selectedUserDetail: any = null;
  private usersLoaded = false;
  private usersLoading = false;
  private userQuery = "";
  private userStatus = "all";
  private userTotal = 0;
  private redeemCodes: any[] = [];
  private selectedRedeemDetail: any = null;
  private redeemLoaded = false;
  private redeemLoading = false;
  private redeemQuery = "";
  private redeemStatus = "all";
  private redeemTotal = 0;
  private configReleases: any[] = [];
  private configReleasesLoaded = false;
  private configReleasesLoading = false;
  private shapePickerOpen = false;
  private shapePickerQuery = "";
  private shapePickerGroup = "all";

  constructor(private readonly root: HTMLElement) {
    this.selectedIds = {
      marble: this.moduleItems("marble")[0]?.id || "",
      hero: this.moduleItems("hero")[0]?.id || "",
      skill: this.moduleItems("skill")[0]?.id || "",
      tactic: this.moduleItems("tactic")[0]?.id || "",
      enemy: this.moduleItems("enemy")[0]?.id || "",
      stage: this.moduleItems("stage")[0]?.id || "",
      character: this.moduleItems("character")[0]?.id || "",
      gacha: this.moduleItems("gacha")[0]?.id || "",
      shop: this.moduleItems("shop")[0]?.id || "",
      redeem: "",
      users: "",
      publish: "candidate",
    };
    this.root.addEventListener("click", (event) => this.handleClick(event));
    this.root.addEventListener("sl-selection-change", (event) => this.handleNavSelection(event as ShoelaceTreeSelectionEvent));
    this.root.addEventListener("input", (event) => this.handleFieldInput(event));
    this.root.addEventListener("change", (event) => this.handleFieldInput(event));
    this.root.addEventListener("submit", (event) => {
      const form = (event.target as HTMLElement).closest("[data-admin-login-form]");
      if (!form) return;
      event.preventDefault();
      void this.login();
    });
    void this.restoreSession();
    this.render();
  }

  private async restoreSession() {
    if (!this.auth.accessToken) return;
    if (isLocalDevAdminToken(this.auth.accessToken)) {
      this.auth.admin = localDevAdminProfile();
      saveAdminAuth(this.auth);
      this.render();
      return;
    }
    try {
      const response = await this.request<{ admin: AdminProfile }>("/admin/session");
      this.auth.admin = response.admin;
      saveAdminAuth(this.auth);
      this.render();
    } catch {
      this.auth = { accessToken: "", admin: null };
      saveAdminAuth(this.auth);
      this.render();
    }
  }

  private async login() {
    if (this.busy) return;
    const username = this.root.querySelector<HTMLInputElement>("[data-admin-username]")?.value.trim() || "";
    const password = this.root.querySelector<HTMLInputElement>("[data-admin-password]")?.value || "";
    if (!username || !password) {
      this.notice = "请输入管理员账号和密码";
      this.render();
      return;
    }

    this.busy = true;
    this.notice = "正在登录后台...";
    this.render();
    try {
      const response = await this.request<{ admin: AdminProfile; accessToken: string }>("/admin/login", {
        method: "POST",
        auth: false,
        body: { username, password },
      });
      this.auth = { accessToken: response.accessToken, admin: response.admin };
      saveAdminAuth(this.auth);
      this.notice = "登录成功";
    } catch (error) {
      if (canUseLocalDevAdmin(username, password, error)) {
        this.auth = { accessToken: LOCAL_ADMIN_TOKEN, admin: localDevAdminProfile() };
        saveAdminAuth(this.auth);
        this.notice = "已进入本地开发后台";
      } else {
        this.notice = error instanceof Error ? error.message : "登录失败";
      }
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private logout() {
    this.auth = { accessToken: "", admin: null };
    saveAdminAuth(this.auth);
    this.notice = "已退出后台";
    this.render();
  }

  private render() {
    if (!this.auth.accessToken || !this.auth.admin) {
      this.stopPreview();
      this.root.innerHTML = this.loginHtml();
      return;
    }

    if (this.activeModule === "users" && !this.usersLoaded && !this.usersLoading) void this.loadAdminUsers();
    if (this.activeModule === "redeem" && !this.redeemLoaded && !this.redeemLoading) void this.loadRedeemCodes();
    if (this.activeModule === "publish" && !this.configReleasesLoaded && !this.configReleasesLoading) void this.loadConfigReleases();
    const selected = this.selectedItem();
    const draft = this.activeModule === "users" ? selected : this.draftFor(this.activeModule, selected.id);
    this.root.innerHTML = this.workspaceHtml(selected, draft);
    if (this.activeModule === "marble") this.mountPreview();
    else this.stopPreview();
  }

  private loginHtml() {
    return `
      <main class="admin-login-page">
        <section class="admin-login-panel">
          <div class="admin-login-brand">
            <span>Game Marbles Admin</span>
            <h1>后台内容工坊</h1>
            <p>通过管理员账号登录后，可以编辑幻化、服装、抽卡池和投放配置。</p>
          </div>
          <form class="admin-login-form" data-admin-login-form>
            <label>
              <span>管理员账号</span>
              <input data-admin-username type="text" autocomplete="username" placeholder="admin" />
            </label>
            <label>
              <span>密码</span>
              <input data-admin-password type="password" autocomplete="current-password" placeholder="请输入管理员密码" />
            </label>
            ${this.notice ? `<div class="admin-login-notice">${escapeHtml(this.notice)}</div>` : ""}
            <button type="submit" ${this.busy ? "disabled" : ""}>${this.busy ? "登录中..." : "登录后台"}</button>
          </form>
        </section>
      </main>
    `;
  }

  private workspaceHtml(selected: any, draft: any) {
    const admin = this.auth.admin;
    const meta = moduleLabels[this.activeModule];
    const perf = this.performanceScore(draft);
    const validation = this.validationRows(draft, perf);
    return `
      <main class="admin-workbench">
        <aside class="admin-sidebar">
          <div class="admin-logo">
            <span>GM</span>
            <strong>内容工坊</strong>
          </div>
          <nav class="admin-nav" aria-label="后台模块">
            ${this.moduleGroupNavHtml()}
          </nav>
        </aside>

        <section class="admin-main">
          <header class="admin-topbar">
            <div>
              <span>后台管理页面</span>
              <h1>${meta.title}</h1>
            </div>
            <div class="admin-account">
              <span>${escapeHtml(admin?.nickname || "管理员")} · ${escapeHtml(admin?.role || "")}</span>
              <button type="button" data-admin-action="logout">退出</button>
            </div>
          </header>

          ${this.notice ? `<div class="admin-notice">${escapeHtml(this.notice)}</div>` : ""}

          <div class="admin-content-grid ${this.activeModule === "gacha" || this.activeModule === "shop" ? "admin-content-grid-gacha" : ""} ${this.activeModule === "redeem" ? "admin-content-grid-redeem" : ""} ${this.activeModule === "users" ? "admin-content-grid-users" : ""} ${this.activeModule === "publish" ? "admin-content-grid-publish" : ""}">
            <section class="admin-library">
              <div class="admin-panel-head">
                <strong>${meta.library}</strong>
                <span>${this.moduleCountLabel(this.activeModule)} 项</span>
              </div>
              ${this.librarySearchHtml()}
              <div class="admin-item-list">
                ${this.moduleItems(this.activeModule).map((item) => this.libraryItemHtml(item, this.isSelectedItem(item, selected))).join("")}
              </div>
            </section>

            <section class="admin-editor">
              <div class="admin-panel-head">
                <div class="admin-panel-title">
                  <strong>${escapeHtml(this.editorTitle(draft))}</strong>
                  <span>${this.editorMetaText(draft)}</span>
                </div>
                ${this.editorHeaderActionsHtml(draft)}
              </div>
              ${this.editorHtml(draft)}
            </section>

            <aside class="admin-preview">
              <div class="admin-panel-head">
                <strong>${meta.preview}</strong>
                <span>${this.previewStateLabel(selected)}</span>
              </div>
              ${this.previewHtml(draft, perf, validation)}
            </aside>
          </div>
        </section>
      </main>
      ${this.exportOpen ? this.exportModalHtml(draft) : ""}
      ${this.shapePickerOpen ? this.shapePickerOverlayHtml(draft) : ""}
    `;
  }

  private isSelectedItem(item: any, selected: any) {
    if (this.activeModule === "users") return (item.userId || item.id) === (selected?.userId || selected?.id);
    if (this.activeModule === "redeem") return (item.code || item.id) === (selected?.code || selected?.id);
    return item.id === selected?.id;
  }

  private editorTitle(draft: any) {
    if (this.activeModule === "users") return draft?.empty ? "玩家账号" : draft?.nickname || draft?.username || "玩家账号";
    if (this.activeModule === "redeem") return draft?.empty ? "兑换码" : draft?.title || draft?.code || "兑换码";
    return draft?.name || "未命名内容";
  }

  private previewStateLabel(selected: any) {
    if (this.activeModule === "users") return this.usersLoading ? "同步中" : "数据库";
    if (this.activeModule === "redeem") return this.redeemLoading ? "同步中" : this.touched[this.draftKey("redeem", selected.id)] ? "草稿" : "数据库";
    return this.touched[this.draftKey(this.activeModule, selected.id)] ? "草稿" : "原始";
  }

  private moduleButtonHtml(module: AdminModule) {
    const meta = moduleLabels[module];
    return `
      <sl-tree-item class="admin-nav-item" data-admin-module="${module}" ${this.activeModule === module ? "selected" : ""}>
        <span class="admin-nav-module-copy">
          <span>${escapeHtml(meta.nav)}</span>
          <em>${this.moduleCountLabel(module)}</em>
        </span>
      </sl-tree-item>
    `;
  }

  private moduleGroupNavHtml() {
    return `
      <sl-tree class="admin-nav-tree sl-theme-dark" selection="leaf">
        ${adminNavGroups
          .map((group) => {
            const active = group.modules.includes(this.activeModule);
            return `
              <sl-tree-item class="admin-nav-group ${active ? "active" : ""}" ${active ? "expanded" : ""}>
                <span class="admin-nav-primary-copy">
                  <strong>${escapeHtml(group.title)}</strong>
                </span>
                ${group.modules.map((module) => this.moduleButtonHtml(module)).join("")}
              </sl-tree-item>
            `;
          })
          .join("")}
      </sl-tree>
    `;
  }

  private moduleCountLabel(module: AdminModule) {
    if (module === "users") return this.usersLoaded ? String(this.userTotal) : "...";
    if (module === "redeem") return this.redeemLoaded ? String(this.redeemTotal) : "...";
    return String(this.moduleItems(module).length);
  }

  private librarySearchHtml() {
    if (this.activeModule === "redeem") {
      return `
        <div class="admin-search-row admin-redeem-search-row">
          <div class="admin-redeem-status-segment" role="group" aria-label="兑换码状态筛选">
            ${redeemStatusOptions
              .map(
                (option) => `
                  <button
                    class="admin-redeem-status-chip ${this.redeemStatus === option ? "active" : ""}"
                    type="button"
                    data-admin-redeem-status-option="${escapeHtml(option)}"
                    aria-pressed="${this.redeemStatus === option ? "true" : "false"}"
                    title="${escapeHtml(redeemStatusLabels[option] || option)}"
                  >
                    ${escapeHtml(redeemStatusLabels[option] || option)}
                  </button>
                `,
              )
              .join("")}
          </div>
          <input type="search" value="${escapeHtml(this.redeemQuery)}" placeholder="搜索兑换码 / 标题" data-admin-redeem-search />
          <button class="admin-redeem-icon-button" type="button" data-admin-action="refreshRedeemCodes" aria-label="${this.redeemLoading ? "加载中" : "查询"}" title="${this.redeemLoading ? "加载中" : "查询"}">
            <span class="admin-button-symbol" aria-hidden="true">${adminIcons.search}</span>
          </button>
          <button class="admin-redeem-icon-button primary" type="button" data-admin-action="newRedeemCode" aria-label="新建兑换码" title="新建兑换码">
            <span class="admin-button-symbol" aria-hidden="true">${adminIcons.plus}</span>
          </button>
        </div>
      `;
    }
    if (this.activeModule === "users") {
      return `
        <div class="admin-search-row admin-user-search-row">
          <input type="search" value="${escapeHtml(this.userQuery)}" placeholder="搜索昵称 / 账号 / ID" data-admin-users-search />
          <select data-admin-users-status>
            ${userStatusOptions.map((option) => `<option value="${option}" ${this.userStatus === option ? "selected" : ""}>${userStatusLabels[option] || option}</option>`).join("")}
          </select>
          <button type="button" data-admin-action="refreshUsers">${this.usersLoading ? "加载中" : "查询"}</button>
        </div>
      `;
    }
    return `
      <div class="admin-search-row">
        <input type="text" value="" placeholder="搜索后续开放" disabled />
      </div>
    `;
  }

  private editorHtml(draft: any) {
    if (this.activeModule === "hero") return this.heroEditorHtml(draft);
    if (this.activeModule === "skill") return this.skillEditorHtml(draft);
    if (this.activeModule === "tactic") return this.tacticEditorHtml(draft);
    if (this.activeModule === "enemy") return this.enemyEditorHtml(draft);
    if (this.activeModule === "stage") return this.stageEditorHtml(draft);
    if (this.activeModule === "character") return this.characterEditorHtml(draft);
    if (this.activeModule === "gacha") return this.gachaEditorHtml(draft);
    if (this.activeModule === "shop") return this.shopEditorHtml(draft);
    if (this.activeModule === "redeem") return this.redeemEditorHtml(draft);
    if (this.activeModule === "users") return this.userEditorHtml(draft);
    if (this.activeModule === "publish") return this.publishEditorHtml(draft);
    return this.marbleEditorHtml(draft);
  }

  private marbleEditorHtml(draft: any) {
    return `
      <div class="admin-editor-scroll">
        <section class="admin-edit-section">
          <h2>基础信息</h2>
          <div class="admin-form-grid">
            ${this.textField("name", "名称", draft.name, 24)}
            ${this.textField("theme", "主题", draft.theme || "", 16)}
            ${this.textField("visualLabel", "标记", draft.visualLabel || "", 2)}
            ${this.marbleShapePickerFieldHtml(draft.marbleShape || "orb")}
          </div>
        </section>
        <section class="admin-edit-section">
          <h2>本体颜色</h2>
          <div class="admin-color-grid">
            ${this.colorField("color", "主色", draft.color)}
            ${this.colorField("accentColor", "强调色", draft.accentColor || draft.color)}
          </div>
        </section>
        <section class="admin-edit-section">
          <h2>拖尾属性</h2>
          <div class="admin-form-grid">
            ${this.selectField("marbleTrailStyle", "风格", draft.marbleTrailStyle || "soft", trailStyles, trailStyleLabels)}
            ${this.selectField("marbleTrailAnimation", "动效", draft.marbleTrailAnimation || "steady", trailAnimations, trailAnimationLabels)}
          </div>
          <div class="admin-color-grid">
            ${this.colorField("marbleTrailColor", "拖尾主色", draft.marbleTrailColor || draft.color)}
            ${this.colorField("marbleTrailAccentColor", "拖尾强调", draft.marbleTrailAccentColor || draft.accentColor || draft.color)}
            ${this.colorField("marbleTrailHighlightColor", "高光色", draft.marbleTrailHighlightColor || draft.marbleTrailAccentColor || draft.accentColor || draft.color)}
          </div>
          <div class="admin-slider-grid">
            ${this.sliderField("marbleTrailLength", "长度", draft.marbleTrailLength, 0.35, 2.8)}
            ${this.sliderField("marbleTrailWidth", "宽度", draft.marbleTrailWidth, 0.45, 2.2)}
            ${this.sliderField("marbleTrailDensity", "密度", draft.marbleTrailDensity, 0.35, 2.2)}
            ${this.sliderField("marbleTrailOpacity", "透明度", draft.marbleTrailOpacity, 0.1, 1)}
            ${this.sliderField("marbleTrailGlow", "发光", draft.marbleTrailGlow, 0, 2)}
            ${this.sliderField("marbleTrailTurbulence", "扰动", draft.marbleTrailTurbulence, 0, 1)}
            ${this.sliderField("marbleTrailFade", "淡出", draft.marbleTrailFade, 0.2, 1)}
            ${this.sliderField("marbleTrailSegmentSpacing", "段距", draft.marbleTrailSegmentSpacing, 0.5, 2)}
            ${this.sliderField("marbleTrailSparkRate", "闪烁频率", draft.marbleTrailSparkRate, 0, 2)}
          </div>
        </section>
      </div>
    `;
  }

  private heroEditorHtml(draft: any) {
    return `
      <div class="admin-editor-scroll">
        <section class="admin-edit-section">
          <h2>角色基础</h2>
          <div class="admin-form-grid">
            ${this.textField("name", "角色名称", draft.name, 20)}
            ${this.textField("role", "战斗定位", draft.role || "", 18)}
            ${this.selectField("rarity", "稀有度", draft.rarity || "common", characterRarityOptions, characterRarityLabels)}
            ${this.colorField("color", "角色主色", draft.color || "#61e6a8")}
            ${this.selectField("heroMarblePrimary", "弹珠 1", draft.heroMarblePrimary || "basic", Object.keys(marbleConfigs), marbleNameLabels())}
            ${this.selectField("heroMarbleSecondary", "弹珠 2", draft.heroMarbleSecondary || "split", Object.keys(marbleConfigs), marbleNameLabels())}
          </div>
        </section>

        <section class="admin-edit-section">
          <h2>解锁条件</h2>
          <div class="admin-form-grid">
            ${this.selectField("heroUnlockType", "解锁类型", draft.heroUnlockType || "none", heroUnlockTypeOptions, heroUnlockTypeLabels)}
            ${this.heroUnlockEditorHtml(draft)}
          </div>
        </section>

        <section class="admin-edit-section">
          <h2>被动技能</h2>
          <div class="admin-designer-list">
            ${(draft.passives || []).map((passive: any, index: number) => this.characterPassiveEditorHtml(passive, index)).join("")}
          </div>
        </section>

        <section class="admin-edit-section">
          <h2>养成路线</h2>
          <div class="admin-designer-list">
            ${(draft.routes || []).map((route: any, index: number) => this.characterRouteEditorHtml(route, index)).join("")}
          </div>
        </section>
      </div>
    `;
  }

  private heroUnlockEditorHtml(draft: any) {
    if (draft.heroUnlockType === "stage") {
      return `
        ${this.numberField("heroUnlockStage", "主线进度", draft.heroUnlockStage || 1, 1, 999)}
        ${this.textField("heroUnlockDesc", "展示文案", draft.heroUnlockDesc || "", 28)}
      `;
    }
    if (draft.heroUnlockType === "wins") {
      return `
        ${this.numberField("heroUnlockWins", "通关胜场", draft.heroUnlockWins || 1, 1, 999)}
        ${this.textField("heroUnlockDesc", "展示文案", draft.heroUnlockDesc || "", 28)}
      `;
    }
    if (draft.heroUnlockType === "collectible") {
      return `
        ${this.selectField("heroUnlockCollectible", "收藏品", draft.heroUnlockCollectible || "void_lens", Object.keys(collectibleConfigs), Object.fromEntries(Object.values(collectibleConfigs).map((item) => [item.id, item.name])))}
        ${this.numberField("heroUnlockAmount", "数量", draft.heroUnlockAmount || 1, 1, 999)}
        ${this.textField("heroUnlockDesc", "展示文案", draft.heroUnlockDesc || "", 28)}
      `;
    }
    return `<div class="admin-empty-note">初始解锁角色会直接进入玩家可用角色池。</div>`;
  }

  private characterPassiveEditorHtml(passive: any, index: number) {
    return `
      <div class="admin-designer-item">
        <div class="admin-designer-item-head">
          <strong>被动 ${index + 1}</strong>
          <span>Lv.${Math.max(1, Math.round(Number(passive.unlockLevel) || 1))}</span>
        </div>
        <div class="admin-form-grid">
          ${this.characterArrayText("passive", index, "name", "名称", passive.name || "", 18)}
          ${this.characterArrayNumber("passive", index, "unlockLevel", "解锁等级", passive.unlockLevel || 3, 1, 99)}
          ${this.characterArrayText("passive", index, "desc", "效果描述", passive.desc || "", 64, true)}
        </div>
      </div>
    `;
  }

  private characterRouteEditorHtml(route: any, index: number) {
    return `
      <div class="admin-designer-item">
        <div class="admin-designer-item-head">
          <strong>路线 ${index + 1}</strong>
          <span>${escapeHtml(route.focus || "成长")}</span>
        </div>
        <div class="admin-form-grid">
          ${this.characterArrayText("route", index, "name", "路线名称", route.name || "", 18)}
          ${this.characterArrayText("route", index, "focus", "定位", route.focus || "", 12)}
          ${this.characterArrayNumber("route", index, "max", "等级上限", route.max || 6, 1, 20)}
          ${this.characterArrayNumber("route", index, "baseCost", "基础消耗", route.baseCost || 80, 1, 9999)}
          ${this.characterArrayNumber("route", index, "growth", "消耗成长", route.growth || 1.45, 1, 3, 0.01)}
          ${this.characterArrayText("route", index, "desc", "效果描述", route.desc || "", 72, true)}
        </div>
      </div>
    `;
  }

  private characterArrayText(kind: "passive" | "route", index: number, prop: string, label: string, value: string, maxLength: number, wide = false) {
    return `
      <label class="admin-field ${wide ? "admin-field-wide" : ""}">
        <span>${label}</span>
        <input type="text" maxlength="${maxLength}" value="${escapeHtml(value || "")}" data-admin-character-array="${kind}" data-admin-character-index="${index}" data-admin-character-prop="${prop}" />
      </label>
    `;
  }

  private characterArrayNumber(kind: "passive" | "route", index: number, prop: string, label: string, value: number, min: number, max: number, step = 1) {
    const current = clampNumber(Number(value) || min, min, max);
    return `
      <label class="admin-field">
        <span>${label}</span>
        <input type="number" min="${min}" max="${max}" step="${step}" value="${step === 1 ? Math.round(current) : current.toFixed(2)}" data-admin-character-array="${kind}" data-admin-character-index="${index}" data-admin-character-prop="${prop}" />
      </label>
    `;
  }

  private skillEditorHtml(draft: any) {
    return `
      <div class="admin-editor-scroll">
        <section class="admin-edit-section">
          <h2>技能基础</h2>
          <div class="admin-form-grid">
            ${this.textField("skillName", "技能名称", draft.skillName || "", 20)}
            ${this.selectField("targetId", "所属角色", draft.targetId || characters[0]?.id, characters.map((item) => item.id), Object.fromEntries(characters.map((item) => [item.id, item.name])))}
            ${this.selectField("skillEffectType", "技能类型", draft.skillEffectType || "buff", skillEffectTypeOptions, skillEffectTypeLabels)}
            ${this.selectField("skillTargeting", "目标逻辑", draft.skillTargeting || "self", skillTargetingOptions, skillTargetingLabels)}
          </div>
          ${this.textareaField("skillDesc", "技能描述", draft.skillDesc || "", 3)}
        </section>

        <section class="admin-edit-section">
          <h2>战斗参数</h2>
          <div class="admin-slider-grid">
            ${this.sliderField("skillCooldown", "冷却秒数", draft.skillCooldown, 6, 45)}
            ${this.sliderField("skillDuration", "持续时间", draft.skillDuration, 0, 12)}
            ${this.sliderField("skillPower", "强度倍率", draft.skillPower, 0.1, 4)}
            ${this.sliderField("skillRadius", "影响半径", draft.skillRadius, 0, 420)}
            ${this.sliderField("skillProjectileCount", "弹体数量", draft.skillProjectileCount, 0, 12)}
            ${this.sliderField("skillControl", "控制强度", draft.skillControl, 0, 1)}
            ${this.sliderField("skillGoldGain", "金币收益", draft.skillGoldGain, 0, 30)}
            ${this.sliderField("skillPreviewIntensity", "表现强度", draft.skillPreviewIntensity, 0.2, 2)}
          </div>
        </section>

        <section class="admin-edit-section">
          <h2>表现配置</h2>
          <div class="admin-form-grid">
            ${this.selectField("skillFxPreset", "特效预设", draft.skillFxPreset || "base", skillFxOptions, skillFxLabels)}
            ${this.textField("skillAssetKey", "技能素材 Key", draft.skillAssetKey || "", 64)}
            ${this.textField("skillSoundKey", "音效 Key", draft.skillSoundKey || "", 64)}
          </div>
        </section>
      </div>
    `;
  }

  private tacticEditorHtml(draft: any) {
    return `
      <div class="admin-editor-scroll">
        <section class="admin-edit-section">
          <h2>战术基础</h2>
          <div class="admin-form-grid">
            ${this.textField("name", "卡牌名称", draft.name || "", 20)}
            ${this.selectField("rarity", "稀有度", draft.rarity || "common", characterRarityOptions, characterRarityLabels)}
            ${this.textField("tag", "战术标签", draft.tag || "", 12)}
            ${this.selectField("tacticKind", "卡牌类型", draft.tacticKind || "stackable", tacticKindOptions, tacticKindLabels)}
            ${this.selectField("tacticEffectType", "效果类型", draft.tacticEffectType || "attribute", tacticEffectTypeOptions, tacticEffectTypeLabels)}
            ${this.selectField("tacticSource", "投放来源", draft.tacticSource || "global", tacticSourceOptions, tacticSourceLabels)}
            ${this.textField("tacticFamilyId", "流派 ID", draft.tacticFamilyId || "", 32)}
          </div>
          ${this.textareaField("desc", "效果描述", draft.desc || "", 3)}
        </section>

        <section class="admin-edit-section">
          <h2>抽取与叠加</h2>
          <div class="admin-form-grid">
            ${this.selectField("tacticTier", "阶级", draft.tacticTier || "none", tacticTierOptions, tacticTierLabels)}
            ${this.numberField("tacticMaxStacks", "叠加上限", draft.tacticMaxStacks || 1, 1, 99)}
          </div>
          <div class="admin-check-grid">
            ${this.checkboxField("tacticInfiniteStacks", "允许无限叠加", Boolean(draft.tacticInfiniteStacks))}
            ${this.checkboxField("tacticEnabled", "启用投放", draft.tacticEnabled !== false)}
          </div>
          <div class="admin-slider-grid">
            ${this.sliderField("tacticWeight", "抽取权重", draft.tacticWeight || 1, 0.1, 2.5)}
          </div>
        </section>

        <section class="admin-edit-section">
          <h2>解锁条件</h2>
          <div class="admin-form-grid">
            ${this.textField("tacticUnlockCharacters", "角色解锁", draft.tacticUnlockCharacters || "", 96)}
            ${this.textField("tacticUnlockCards", "前置卡牌", draft.tacticUnlockCards || "", 96)}
            ${this.textField("tacticUnlockFamilies", "前置流派", draft.tacticUnlockFamilies || "", 96)}
            ${this.textField("tacticApplyRef", "效果引用", draft.tacticApplyRef || draft.id, 48)}
          </div>
          <div class="admin-empty-note">多个 ID 使用英文逗号分隔；效果引用对应代码中的 apply 实现。</div>
        </section>

        <section class="admin-edit-section">
          <h2>核心与构筑归属</h2>
          <div class="admin-form-grid">
            ${this.selectField("tacticCoreType", "核心类型", draft.tacticCoreType || "none", tacticCoreTypeOptions, tacticCoreTypeLabels)}
            ${this.textField("tacticCoreId", "核心 ID", draft.tacticCoreId || "", 48)}
            ${this.textField("tacticCoreExclusiveGroup", "互斥组", draft.tacticCoreExclusiveGroup || "", 48)}
          </div>
          <div class="admin-empty-note">主核心通常使用 main_core 互斥组；强化卡使用相同核心 ID，并把核心类型设为「核心强化」。</div>
        </section>

        ${this.tacticBuildDesignerHtml()}
      </div>
    `;
  }

  private tacticBuildDesignerHtml() {
    const coreCards = upgradeCards.filter((card) => card.core);
    return `
      <section class="admin-edit-section">
        <h2>构筑配置索引</h2>
        <div class="admin-build-index">
          <div>
            <strong>阵法</strong>
            ${formations.map((formation) => `<span style="--item-color:${formation.color}">${escapeHtml(formation.name)} · ${escapeHtml(formation.tags.join("/"))}</span>`).join("")}
          </div>
          <div>
            <strong>卡组</strong>
            ${tacticalDecks.map((deck) => `<span>${escapeHtml(deck.name)} · ${deck.cardIds.length || "自动"} 张</span>`).join("")}
          </div>
          <div>
            <strong>羁绊</strong>
            ${bonds.map((bond) => `<span style="--item-color:${bond.color}">${escapeHtml(bond.name)} · ${(bond.unlockedCardIds || []).length} 卡</span>`).join("")}
          </div>
          <div>
            <strong>核心卡</strong>
            ${coreCards.map((card) => `<span>${escapeHtml(card.name)} · ${escapeHtml(tacticCoreTypeLabels[card.core?.type || "none"] || "核心")}</span>`).join("")}
          </div>
        </div>
      </section>
    `;
  }

  private enemyEditorHtml(draft: any) {
    return `
      <div class="admin-editor-scroll">
        <section class="admin-edit-section">
          <h2>怪物基础</h2>
          <div class="admin-form-grid">
            ${this.textField("name", "怪物名称", draft.name || "", 18)}
            ${this.selectField("type", "怪物类型", draft.type || "small", enemyTypeOptions, enemyTypeLabels())}
            ${this.selectField("enemyRole", "战场定位", draft.enemyRole || enemyRoleForType(draft.type), enemyRoleOptions, enemyRoleLabels)}
            ${this.selectField("enemyBehavior", "机制预设", draft.enemyBehavior || enemyBehaviorForType(draft.type), enemyBehaviorOptions, enemyBehaviorLabels)}
          </div>
          <div class="admin-color-grid">
            ${this.colorField("color", "主体颜色", draft.color || "#6ee7f9")}
          </div>
        </section>

        <section class="admin-edit-section">
          <h2>战斗数值</h2>
          <div class="admin-form-grid">
            ${this.numberField("enemyHp", "基础血量", draft.enemyHp || 20, 1, 9999)}
            ${this.numberField("enemySpeed", "推进速度", draft.enemySpeed || 58, 1, 240)}
            ${this.numberField("enemyRadius", "体型半径", draft.enemyRadius || 18, 8, 180)}
            ${this.numberField("enemyExp", "经验奖励", draft.enemyExp || 1, 0, 999)}
            ${this.numberField("enemyCoins", "金币奖励", draft.enemyCoins || 0, 0, 9999)}
          </div>
          <div class="admin-slider-grid">
            ${this.sliderField("enemyArmor", "护甲减伤", draft.enemyArmor || 0, 0, 5)}
            ${this.sliderField("enemyThreatLevel", "威胁等级", draft.enemyThreatLevel || enemyThreatLevel(draft), 1, 10)}
            ${this.sliderField("enemySpawnWeight", "投放权重", draft.enemySpawnWeight || defaultEnemySpawnWeight(draft.type), 0.1, 3)}
          </div>
        </section>

        <section class="admin-edit-section">
          <h2>投放说明</h2>
          <div class="admin-form-grid">
            ${this.textField("enemyStageHint", "推荐关卡", draft.enemyStageHint || enemyStageHint(draft.type), 24)}
            ${this.textField("enemyCounterHint", "克制提示", draft.enemyCounterHint || enemyCounterHint(draft.type), 32)}
          </div>
          <div class="admin-check-grid">
            ${this.checkboxField("enemyEnabled", "允许关卡投放", draft.enemyEnabled !== false)}
            ${this.checkboxField("enemyPvpEnabled", "允许 PVP 投放", draft.enemyPvpEnabled !== false)}
          </div>
        </section>
      </div>
    `;
  }

  private stageEditorHtml(draft: any) {
    return `
      <div class="admin-editor-scroll">
        <section class="admin-edit-section">
          <h2>关卡基础</h2>
          <div class="admin-form-grid">
            ${this.textField("id", "关卡 ID", draft.id || stageIdFromDraft(draft), 18)}
            ${this.numberField("stageIndex", "主线序号", draft.stageIndex || draft.index || 1, 1, 999)}
            ${this.selectField("stageChapter", "章节", String(draft.stageChapter || draft.chapter || 1), stageChapterOptions, stageChapterLabels)}
            ${this.numberField("stageNo", "章内关卡", draft.stageNo || draft.stage || 1, 1, 99)}
            ${this.textField("name", "关卡名称", draft.name || "", 18)}
            ${this.textField("theme", "主题标签", draft.theme || "", 18)}
          </div>
          ${this.textareaField("objective", "关卡目标", draft.objective || "", 3)}
        </section>

        <section class="admin-edit-section">
          <h2>难度节奏</h2>
          <div class="admin-slider-grid">
            ${this.sliderField("stageHpMultiplier", "血量倍率", draft.stageHpMultiplier || 1, 0.5, 3)}
            ${this.sliderField("stageSpeedMultiplier", "速度倍率", draft.stageSpeedMultiplier || 1, 0.5, 2.5)}
            ${this.sliderField("stageDensityMultiplier", "密度倍率", draft.stageDensityMultiplier || 1, 0.5, 2.5)}
            ${this.sliderField("stageRewardCoins", "金币倍率", draft.stageRewardCoins || 1, 0.5, 3)}
          </div>
        </section>

        <section class="admin-edit-section">
          <h2>敌人池</h2>
          <div class="admin-form-grid">
            ${this.textField("stageEnemyBias", "出怪倾向", draft.stageEnemyBias || "", 120)}
            ${this.textField("stageFeaturedEnemies", "展示怪物", draft.stageFeaturedEnemies || "", 120)}
          </div>
          <div class="admin-empty-note">多个怪物 ID 用英文逗号分隔，例如 small,fast,tank。</div>
        </section>

        <section class="admin-edit-section">
          <h2>波次事件</h2>
          ${this.textareaField("stageWaveEvents", "事件脚本", draft.stageWaveEvents || "", 8)}
          <div class="admin-empty-note">每行一个事件：波次 | 名称 | 类型 | 怪物列表 | 数量加成 | 血量倍率 | 速度倍率 | 间隔倍率</div>
        </section>

        <section class="admin-edit-section">
          <h2>Boss 配置</h2>
          <div class="admin-check-grid">
            ${this.checkboxField("stageHasBoss", "Boss 关卡", Boolean(draft.stageHasBoss))}
          </div>
          <div class="admin-form-grid">
            ${this.textField("stageBossName", "Boss 名称", draft.stageBossName || "", 20)}
            ${this.textField("stageBossDesc", "Boss 描述", draft.stageBossDesc || "", 64)}
            ${this.textField("stageBossSkills", "Boss 技能", draft.stageBossSkills || "", 120)}
          </div>
        </section>

        <section class="admin-edit-section">
          <h2>奖励偏向</h2>
          <div class="admin-form-grid">
            ${this.textField("stageRewardShards", "弹珠碎片", draft.stageRewardShards || "", 120)}
            ${this.textField("stageRewardGems", "宝石倾向", draft.stageRewardGems || "", 120)}
            ${this.textField("stageRewardCollectibles", "收藏品", draft.stageRewardCollectibles || "", 120)}
          </div>
        </section>
      </div>
    `;
  }

  private characterEditorHtml(draft: any) {
    return `
      <div class="admin-editor-scroll">
        <section class="admin-edit-section">
          <h2>基础信息</h2>
          <div class="admin-form-grid">
            ${this.textField("name", "名称", draft.name, 28)}
            ${this.textField("theme", "主题", draft.theme || "", 16)}
            ${this.textField("visualLabel", "标记", draft.visualLabel || "", 2)}
            ${this.selectField("targetId", "目标角色", draft.targetId || characters[0]?.id, characters.map((item) => item.id), Object.fromEntries(characters.map((item) => [item.id, item.name])))}
            ${this.selectField("rarity", "稀有度", draft.rarity || "rare", ["rare", "epic", "legendary"], { rare: "稀有", epic: "史诗", legendary: "传说" })}
          </div>
          ${this.textareaField("desc", "描述", draft.desc || "", 3)}
        </section>
        <section class="admin-edit-section">
          <h2>服装色彩</h2>
          <div class="admin-color-grid">
            ${this.colorField("color", "主色", draft.color)}
            ${this.colorField("accentColor", "强调色", draft.accentColor || draft.color)}
          </div>
        </section>
        <section class="admin-edit-section">
          <h2>展示表现</h2>
          <div class="admin-form-grid">
            ${this.selectField("characterShowcaseMotion", "展示动作", draft.characterShowcaseMotion || "idle", outfitMotionOptions, outfitMotionLabels)}
            ${this.selectField("characterSkillFxPreset", "技能特效", draft.characterSkillFxPreset || "base", skillFxOptions, skillFxLabels)}
            ${this.textField("characterShopTag", "投放标签", draft.characterShopTag || "常驻", 12)}
          </div>
          <div class="admin-slider-grid">
            ${this.sliderField("characterSkillFxIntensity", "技能强度", draft.characterSkillFxIntensity, 0, 2)}
            ${this.sliderField("characterAvatarGlow", "头像光效", draft.characterAvatarGlow, 0, 2)}
            ${this.sliderField("characterShowcaseGlow", "展示光效", draft.characterShowcaseGlow, 0, 2)}
          </div>
        </section>
        <section class="admin-edit-section">
          <h2>素材引用</h2>
          <div class="admin-form-grid">
            ${this.textField("characterAssetPortrait", "立绘资源", draft.characterAssetPortrait || "", 64)}
            ${this.textField("characterAssetBattle", "战斗头像", draft.characterAssetBattle || "", 64)}
            ${this.textField("characterEffectSkill", "技能特效", draft.characterEffectSkill || "", 64)}
          </div>
        </section>
      </div>
    `;
  }

  private gachaEditorHtml(draft: any) {
    const summary = this.gachaSummary(draft);
    return `
      <div class="admin-editor-scroll">
        <section class="admin-edit-section">
          <h2>卡池基础</h2>
          <div class="admin-form-grid">
            ${this.textField("name", "卡池名称", draft.name, 18)}
            ${this.selectField("ticket", "抽卡券", draft.ticket, ["characterCosmetic", "marbleCosmetic"], { characterCosmetic: "角色幻化券", marbleCosmetic: "弹珠幻化券" })}
            ${this.sliderField("singleCrystalCost", "单抽晶体", draft.singleCrystalCost, 10, 300)}
            ${this.textField("featuredTheme", "主题标签", draft.featuredTheme || "常驻", 12)}
          </div>
          ${this.textareaField("desc", "卡池描述", draft.desc || "", 3)}
        </section>
        <section class="admin-edit-section">
          <h2>概率与保底</h2>
          <div class="admin-slider-grid">
            ${this.sliderField("rateRare", "稀有概率", draft.rateRare, 0, 100)}
            ${this.sliderField("rateEpic", "史诗概率", draft.rateEpic, 0, 100)}
            ${this.sliderField("rateLegendary", "传说概率", draft.rateLegendary, 0, 100)}
            ${this.sliderField("pityEpic", "史诗保底", draft.pityEpic, 1, 30)}
            ${this.sliderField("pityLegendary", "传说保底", draft.pityLegendary, 10, 120)}
          </div>
        </section>
        <section class="admin-edit-section">
          <h2>内容投放</h2>
          <div class="admin-pool-summary">
            <div><span>已启用</span><strong>${summary.enabled}/${summary.total}</strong></div>
            <div><span>UP</span><strong>${summary.up}</strong></div>
            <div><span>传说</span><strong>${summary.legendary}</strong></div>
          </div>
          <div class="admin-pool-list">
            ${this.gachaPoolItems(draft)
              .map((item) => this.gachaPoolItemHtml(draft, item))
              .join("")}
          </div>
        </section>
      </div>
    `;
  }

  private shopEditorHtml(draft: any) {
    const summary = this.shopSummary(draft);
    return `
      <div class="admin-editor-scroll">
        <section class="admin-edit-section">
          <h2>商品基础</h2>
          <div class="admin-form-grid">
            ${this.textField("name", "商品名称", draft.name, 24)}
            ${this.selectField("category", "投放货架", draft.category, shopCategoryOptions, shopCategoryLabels)}
            ${this.textField("shopBadge", "角标", draft.shopBadge || this.shopBadgeForDraft(draft), 8)}
            ${this.numberField("shopPriority", "排序权重", draft.shopPriority, 1, 999)}
          </div>
          ${this.textareaField("desc", "商品描述", draft.desc || "", 3)}
          <div class="admin-check-grid">
            ${this.checkboxField("shopEnabled", "启用投放", draft.shopEnabled !== false)}
            ${this.checkboxField("shopFeatured", "推荐展示", Boolean(draft.shopFeatured))}
          </div>
        </section>

        <section class="admin-edit-section">
          <h2>价格与库存</h2>
          <div class="admin-form-grid">
            ${this.selectField("priceCurrency", "价格货币", draft.priceCurrency, currencyOptions, currencyLabels)}
            ${this.numberField("priceAmount", "价格数量", draft.priceAmount, 0, 999999)}
            ${this.numberField("stock", "限购库存", draft.stock, 1, 999)}
            ${this.selectField("refresh", "刷新周期", draft.refresh, refreshOptions, refreshLabels)}
          </div>
        </section>

        <section class="admin-edit-section">
          <h2>解锁条件</h2>
          <div class="admin-form-grid">
            ${this.selectField("unlockType", "门槛类型", draft.unlockType || "none", unlockTypeOptions, unlockTypeLabels)}
            ${this.unlockEditorHtml(draft)}
          </div>
        </section>

        <section class="admin-edit-section">
          <div class="admin-section-title-row">
            <h2>奖励内容</h2>
            <button class="admin-mini-button" type="button" data-admin-action="addReward">增加奖励</button>
          </div>
          <div class="admin-pool-summary admin-shop-summary">
            <div><span>奖励项</span><strong>${summary.rewardCount}</strong></div>
            <div><span>投放状态</span><strong>${draft.shopEnabled === false ? "已停用" : "启用"}</strong></div>
            <div><span>价值校验</span><strong>${summary.economy}</strong></div>
          </div>
          <div class="admin-reward-list">
            ${(draft.rewards || []).map((reward: any, index: number) => this.shopRewardEditorHtml(reward, index)).join("")}
          </div>
        </section>
      </div>
    `;
  }

  private redeemEditorHtml(draft: any) {
    if (!draft || draft.empty) {
      return `
        <div class="admin-editor-scroll">
          <section class="admin-edit-section admin-user-empty">
            <h2>${this.redeemLoading ? "正在加载兑换码" : "暂无兑换码"}</h2>
            <p>${this.redeemLoading ? "服务器返回后会显示兑换码列表。" : "点击左侧的新建兑换码开始配置礼包。"}</p>
            <button class="admin-mini-button" type="button" data-admin-action="refreshRedeemCodes">${this.redeemLoading ? "刷新中" : "重新查询"}</button>
          </section>
        </div>
      `;
    }
    const isNew = Boolean(draft.isNew);
    return `
      <div class="admin-editor-scroll">
        <section class="admin-edit-section">
          <h2>兑换码基础</h2>
          <div class="admin-form-grid admin-redeem-basic-grid">
            <label class="admin-field">
              <span>兑换码</span>
              <input type="text" maxlength="32" value="${escapeHtml(draft.code || "")}" data-admin-field="code" ${isNew ? "" : "disabled"} />
            </label>
            ${this.textField("title", "礼包标题", draft.title || "", 48)}
            ${this.selectField("status", "状态", draft.status || "draft", ["active", "draft", "paused", "disabled"], redeemStatusLabels)}
            <label class="admin-field">
              <span>领取上限</span>
              <input type="number" min="1" max="1000000" step="1" value="${draft.maxUses ?? ""}" placeholder="不限" data-admin-field="maxUses" />
            </label>
          </div>
        </section>

        <section class="admin-edit-section">
          <h2>有效期</h2>
          <div class="admin-form-grid admin-redeem-time-grid">
            <label class="admin-field">
              <span>开始时间</span>
              <input type="datetime-local" value="${dateTimeLocalValue(draft.startsAt)}" data-admin-field="startsAt" />
            </label>
            <label class="admin-field">
              <span>结束时间</span>
              <input type="datetime-local" value="${dateTimeLocalValue(draft.endsAt)}" data-admin-field="endsAt" />
            </label>
          </div>
          <div class="admin-empty-note">时间为空表示不限制；兑换码保存后玩家端会实时生效。</div>
        </section>

        <section class="admin-edit-section">
          <div class="admin-section-title-row">
            <h2>礼包奖励</h2>
            <button class="admin-mini-button" type="button" data-admin-action="addRedeemReward">增加奖励</button>
          </div>
          <div class="admin-reward-list">
            ${(draft.rewards || []).map((reward: any, index: number) => this.redeemRewardEditorHtml(reward, index)).join("")}
          </div>
        </section>

        <section class="admin-edit-section">
          <h2>领取记录</h2>
          <div class="admin-redeem-redemption-list">
            ${this.redeemRedemptionsHtml()}
          </div>
        </section>
      </div>
    `;
  }

  private redeemRewardEditorHtml(reward: any, index: number) {
    return `
      <div class="admin-reward-item">
        <div class="admin-reward-head">
          <strong>奖励 ${index + 1}</strong>
          <button class="admin-mini-button danger" type="button" data-admin-action="removeRedeemReward" data-admin-reward-index="${index}" ${index <= 0 ? "disabled" : ""}>移除</button>
        </div>
        <div class="admin-reward-fields admin-redeem-reward-fields">
          ${this.rewardSelect(index, "type", "奖励类型", reward.type || "coins", rewardTypeOptions, rewardTypeLabels)}
          ${this.rewardTargetEditorHtml(reward, index)}
          ${this.rewardAmountEditorHtml(reward, index)}
        </div>
      </div>
    `;
  }

  private redeemRedemptionsHtml() {
    const rows = this.selectedRedeemDetail?.redemptions || [];
    if (this.selectedIds.redeem?.startsWith("__")) return `<div class="admin-empty-note">新建兑换码保存后会显示领取记录。</div>`;
    if (!rows.length) return `<div class="admin-empty-note">暂无玩家领取记录。</div>`;
    return rows
      .map(
        (row: any) => `
          <div class="admin-redeem-redemption">
            <strong>${escapeHtml(row.nickname || row.username || row.guestId || row.userId)}</strong>
            <span>${escapeHtml(formatDateTime(row.redeemedAt))}</span>
            <em>${escapeHtml((row.rewardLabels || []).join("、") || "奖励")}</em>
          </div>
        `,
      )
      .join("");
  }

  private userEditorHtml(user: any) {
    if (!user || user.empty) {
      return `
        <div class="admin-editor-scroll">
          <section class="admin-edit-section admin-user-empty">
            <h2>${this.usersLoading ? "正在加载玩家账号" : "暂无玩家账号"}</h2>
            <p>${this.usersLoading ? "正在连接后台服务并读取数据库用户。" : "当前筛选条件下没有找到玩家，可以调整搜索条件后重新查询。"}</p>
            <button class="admin-mini-button" type="button" data-admin-action="refreshUsers">${this.usersLoading ? "刷新中" : "重新查询"}</button>
          </section>
        </div>
      `;
    }
    const detail = this.selectedUserDetail?.userId === user.userId ? this.selectedUserDetail : user;
    return `
      <div class="admin-editor-scroll">
        <section class="admin-edit-section">
          <h2>账号资料</h2>
          <div class="admin-user-identity">
            <i>${escapeHtml((detail.nickname || "玩").slice(0, 1).toUpperCase())}</i>
            <div>
              <strong>${escapeHtml(detail.nickname || "未命名玩家")}</strong>
              <span>${escapeHtml(detail.username || detail.guestId || detail.userId)}</span>
            </div>
            <b class="${detail.status}">${escapeHtml(userStatusLabels[detail.status] || detail.status)}</b>
          </div>
          <div class="admin-form-grid">
            ${this.textField("userNickname", "昵称", detail.nickname || "", 12)}
            ${this.textField("userAvatar", "头像标识", detail.avatar || "avatar_green", 32)}
          </div>
          <div class="admin-user-readonly-grid">
            <div><span>用户 ID</span><strong>${escapeHtml(detail.userId)}</strong></div>
            <div><span>登录账号</span><strong>${escapeHtml(detail.username || "游客账号")}</strong></div>
            <div><span>账号类型</span><strong>${detail.isGuest ? "游客" : "注册用户"}</strong></div>
            <div><span>状态</span><strong>${escapeHtml(userStatusLabels[detail.status] || detail.status)}</strong></div>
          </div>
          <div class="admin-actions admin-user-actions">
            <button type="button" data-admin-action="refreshUserDetail">刷新详情</button>
            <button class="primary" type="button" data-admin-action="saveUserProfile">保存资料</button>
          </div>
        </section>

        <section class="admin-edit-section">
          <h2>风控状态</h2>
          <div class="admin-user-status-panel">
            <div>
              <span>当前状态</span>
              <strong class="${detail.status}">${escapeHtml(userStatusLabels[detail.status] || detail.status)}</strong>
              <em>${detail.bannedUntil ? `封禁至 ${escapeHtml(formatDateTime(detail.bannedUntil))}` : "没有封禁时间"}</em>
            </div>
            <div>
              <span>会话</span>
              <strong>${Number(detail.activeSessions || 0)}</strong>
              <em>封禁或停用会立即清理在线会话</em>
            </div>
          </div>
          <div class="admin-actions admin-user-actions">
            <button type="button" data-admin-action="banUser24">封禁 24 小时</button>
            <button type="button" data-admin-action="banUser7">封禁 7 天</button>
            <button type="button" data-admin-action="disableUser">停用账号</button>
            <button class="primary" type="button" data-admin-action="unbanUser">恢复正常</button>
          </div>
        </section>
      </div>
    `;
  }

  private publishEditorHtml(draft: any) {
    if (draft.kind === "release") return this.releaseRecordEditorHtml(draft);
    const summary = this.releaseSummary(draft);
    return `
      <div class="admin-editor-scroll">
        <section class="admin-edit-section">
          <h2>候选版本</h2>
          <div class="admin-form-grid">
            ${this.textField("releaseTitle", "版本标题", draft.releaseTitle || "", 28)}
            ${this.textField("configVersion", "配置版本号", draft.configVersion || "", 32)}
            ${this.selectField("releaseEnv", "目标环境", draft.releaseEnv || "test", releaseEnvOptions, releaseEnvLabels)}
            ${this.selectField("releaseMode", "发布方式", draft.releaseMode || "now", releaseModeOptions, releaseModeLabels)}
            ${this.numberField("releaseGrayPercent", "灰度比例", draft.releaseGrayPercent || 10, 1, 100)}
            ${this.numberField("releaseScheduleDelayHours", "延迟小时", draft.releaseScheduleDelayHours || 1, 1, 168)}
          </div>
          ${this.textareaField("releaseNotes", "发布说明", draft.releaseNotes || "", 5)}
        </section>

        <section class="admin-edit-section">
          <h2>纳入内容</h2>
          <div class="admin-release-module-grid">
            ${contentModuleIds.map((module) => this.releaseModuleToggleHtml(draft, module)).join("")}
          </div>
        </section>

        <section class="admin-edit-section">
          <h2>发布检查</h2>
          <div class="admin-pool-summary admin-release-summary">
            <div><span>草稿项</span><strong>${summary.changed}</strong></div>
            <div><span>模块</span><strong>${summary.modules}</strong></div>
            <div><span>风险</span><strong>${summary.risk}</strong></div>
          </div>
          <div class="admin-check-grid">
            ${this.checkboxField("releaseSchemaChecked", "结构校验已通过", Boolean(draft.releaseSchemaChecked))}
            ${this.checkboxField("releaseEconomyChecked", "经济校验已通过", Boolean(draft.releaseEconomyChecked))}
            ${this.checkboxField("releaseVisualChecked", "视觉预览已确认", Boolean(draft.releaseVisualChecked))}
            ${this.checkboxField("releaseProdConfirmed", "正式发布二次确认", Boolean(draft.releaseProdConfirmed))}
          </div>
        </section>
      </div>
    `;
  }

  private releaseRecordEditorHtml(draft: any) {
    const bundle = draft.bundle || {};
    return `
      <div class="admin-editor-scroll">
        <section class="admin-edit-section">
          <h2>版本详情</h2>
          <div class="admin-release-detail">
            <div><span>配置版本</span><strong>${escapeHtml(draft.configVersion || "-")}</strong></div>
            <div><span>状态</span><strong>${escapeHtml(draft.status || "published")}</strong></div>
            <div><span>环境</span><strong>${escapeHtml(releaseEnvLabels[draft.environment] || draft.environment || "-")}</strong></div>
            <div><span>发布时间</span><strong>${escapeHtml(formatDateTime(draft.publishedAt || draft.createdAt))}</strong></div>
          </div>
          <p class="admin-release-note">${escapeHtml(bundle.releaseNotes || draft.releaseNotes || "无发布说明")}</p>
        </section>
        <section class="admin-edit-section">
          <h2>内容摘要</h2>
          <div class="admin-release-module-grid">
            ${contentModuleIds
              .map((module) => {
                const count = bundle.modules?.[module]?.items?.length || 0;
                return `<div class="admin-release-module-card"><strong>${moduleLabels[module].nav}</strong><span>${count} 项</span></div>`;
              })
              .join("")}
          </div>
        </section>
      </div>
    `;
  }

  private releaseModuleToggleHtml(draft: any, module: Exclude<AdminModule, "publish" | "users">) {
    const field = `releaseInclude${capitalize(module)}`;
    const count = this.changedDraftsForModule(module).length;
    return `
      <label class="admin-release-module-card ${draft[field] !== false ? "active" : ""}">
        <input type="checkbox" ${draft[field] !== false ? "checked" : ""} data-admin-field="${field}" />
        <strong>${moduleLabels[module].nav}</strong>
        <span>${count} 个草稿</span>
      </label>
    `;
  }

  private previewHtml(draft: any, perf: any, validation: Array<{ level: string; title: string; text: string }>) {
    if (this.activeModule === "hero") return this.heroPreviewHtml(draft, validation);
    if (this.activeModule === "skill") return this.skillPreviewHtml(draft, validation);
    if (this.activeModule === "tactic") return this.tacticPreviewHtml(draft, validation);
    if (this.activeModule === "enemy") return this.enemyPreviewHtml(draft, validation);
    if (this.activeModule === "stage") return this.stagePreviewHtml(draft, validation);
    if (this.activeModule === "character") return this.characterPreviewHtml(draft, validation);
    if (this.activeModule === "gacha") return this.gachaPreviewHtml(draft, validation);
    if (this.activeModule === "shop") return this.shopPreviewHtml(draft, validation);
    if (this.activeModule === "redeem") return this.redeemPreviewHtml(draft, validation);
    if (this.activeModule === "users") return this.userPreviewHtml(draft, validation);
    if (this.activeModule === "publish") return this.publishPreviewHtml(draft, validation);
    return `
      <canvas data-admin-preview width="520" height="360"></canvas>
      <div class="admin-preview-meta">
        <div><span>性能评分</span><strong class="${perf.level}">${perf.score}</strong></div>
        <div><span>PVP 缩略</span><strong>${perf.pvp}</strong></div>
        <div><span>状态</span><strong>${this.touched[this.draftKey(this.activeModule, this.selectedIds[this.activeModule])] ? "草稿" : "原始"}</strong></div>
      </div>
      ${this.validationHtml(validation)}
      ${this.previewActionsHtml()}
    `;
  }

  private heroPreviewHtml(draft: any, validation: Array<{ level: string; title: string; text: string }>) {
    const portrait = characterPortraitSources[draft.id] || characterPortraitSources[draft.targetId] || "";
    const marbleOne = marbleConfigs[draft.heroMarblePrimary] || marbleConfigs.basic;
    const marbleTwo = marbleConfigs[draft.heroMarbleSecondary] || marbleConfigs.split;
    const unlock = this.heroUnlockLabel(draft);
    return `
      <div class="admin-hero-preview" style="--hero-color:${normalizeColor(draft.color)};--hero-accent:${marbleTwo.color}">
        <article class="admin-hero-card">
          <div class="admin-hero-portrait">${portrait ? `<img src="${portrait}" alt="${escapeHtml(draft.name)}" draggable="false" />` : `<i>${escapeHtml((draft.name || "角").slice(0, 1))}</i>`}</div>
          <div class="admin-hero-copy">
            <span>${escapeHtml(characterRarityLabels[draft.rarity] || draft.rarity || "角色")}</span>
            <strong>${escapeHtml(draft.name || "未命名角色")}</strong>
            <em>${escapeHtml(draft.role || "未设置定位")}</em>
          </div>
        </article>
        <div class="admin-hero-marble-row">
          <div style="--marble-color:${marbleOne.color}"><i></i><span>${escapeHtml(marbleOne.name)}</span></div>
          <div style="--marble-color:${marbleTwo.color}"><i></i><span>${escapeHtml(marbleTwo.name)}</span></div>
        </div>
        <div class="admin-pool-summary">
          <div><span>被动</span><strong>${(draft.passives || []).length}</strong></div>
          <div><span>路线</span><strong>${(draft.routes || []).length}</strong></div>
          <div><span>解锁</span><strong>${escapeHtml(unlock)}</strong></div>
        </div>
      </div>
      ${this.validationHtml(validation)}
      ${this.previewActionsHtml()}
    `;
  }

  private skillPreviewHtml(draft: any, validation: Array<{ level: string; title: string; text: string }>) {
    const character = characters.find((item) => item.id === draft.targetId) || characters.find((item) => item.id === draft.id) || characters[0];
    const portrait = characterPortraitSources[character.id] || "";
    const cooldown = clampNumber(Number(draft.skillCooldown) || character.skillCooldown || 18, 6, 45);
    const power = clampNumber(Number(draft.skillPower) || 1, 0.1, 4);
    return `
      <div class="admin-skill-preview" style="--skill-color:${normalizeColor(character.color)};--skill-accent:${skillFxColor(draft.skillFxPreset)}">
        <article class="admin-skill-card">
          <div class="admin-skill-orb">
            ${portrait ? `<img src="${portrait}" alt="${escapeHtml(character.name)}" draggable="false" />` : ""}
            <i>${Math.round(cooldown)}s</i>
          </div>
          <div>
            <span>${escapeHtml(character.name)} · ${escapeHtml(skillEffectTypeLabels[draft.skillEffectType] || "技能")}</span>
            <strong>${escapeHtml(draft.skillName || character.skillName)}</strong>
            <em>${escapeHtml(draft.skillDesc || character.skillDesc)}</em>
          </div>
        </article>
        <div class="admin-skill-bars">
          ${this.rateBarHtml("冷却预算", Math.round(((45 - cooldown) / 39) * 100), "#61e6a8")}
          ${this.rateBarHtml("强度预算", Math.round((power / 4) * 100), "#f6c95f")}
          ${this.rateBarHtml("表现预算", Math.round((clampNumber(Number(draft.skillPreviewIntensity) || 1, 0.2, 2) / 2) * 100), "#b68cff")}
        </div>
        <div class="admin-pool-summary">
          <div><span>目标</span><strong>${escapeHtml(skillTargetingLabels[draft.skillTargeting] || "自身")}</strong></div>
          <div><span>持续</span><strong>${Number(draft.skillDuration || 0).toFixed(1)}s</strong></div>
          <div><span>弹体</span><strong>${Math.round(Number(draft.skillProjectileCount) || 0)}</strong></div>
        </div>
      </div>
      ${this.validationHtml(validation)}
      ${this.previewActionsHtml()}
    `;
  }

  private tacticPreviewHtml(draft: any, validation: Array<{ level: string; title: string; text: string }>) {
    const color = tacticRarityColor(draft.rarity);
    const stacks = draft.tacticInfiniteStacks ? "无限" : `${Math.round(Number(draft.tacticMaxStacks) || 1)} 次`;
    return `
      <div class="admin-tactic-preview" style="--tactic-color:${color};--tactic-accent:${tacticTagColor(draft.tag)}">
        <article class="admin-tactic-card">
          <div class="admin-tactic-card-head">
            <i>${escapeHtml(tacticCardIcon(draft))}</i>
            <span>${escapeHtml(rarityName(draft.rarity || "common"))}</span>
            <b>${escapeHtml(draft.tag || "战术")}</b>
          </div>
          <strong>${escapeHtml(draft.name || "未命名战术")}</strong>
          <p>${escapeHtml(draft.desc || "暂无效果描述")}</p>
          <div class="admin-tactic-card-foot">
            <span>${escapeHtml(tacticKindLabels[draft.tacticKind] || "战术")}</span>
            <span>${escapeHtml(tacticEffectTypeLabels[draft.tacticEffectType] || "效果")}</span>
          </div>
        </article>
        <div class="admin-rate-bars">
          ${this.rateBarHtml("抽取权重", Math.round((Number(draft.tacticWeight) || 1) / 2.5 * 100), color)}
          ${this.rateBarHtml("叠加预算", draft.tacticInfiniteStacks ? 100 : Math.round((Number(draft.tacticMaxStacks) || 1) / 8 * 100), "#61e6a8")}
        </div>
        <div class="admin-pool-summary">
          <div><span>流派</span><strong>${escapeHtml(draft.tacticFamilyId || "无")}</strong></div>
          <div><span>阶级</span><strong>${escapeHtml(tacticTierLabels[draft.tacticTier] || "无")}</strong></div>
          <div><span>叠加</span><strong>${escapeHtml(stacks)}</strong></div>
          <div><span>来源</span><strong>${escapeHtml(tacticSourceLabels[draft.tacticSource] || "全局")}</strong></div>
          <div><span>核心</span><strong>${escapeHtml(draft.tacticCoreType && draft.tacticCoreType !== "none" ? `${tacticCoreTypeLabels[draft.tacticCoreType]} · ${draft.tacticCoreId || "未填"}` : "非核心")}</strong></div>
        </div>
        <div class="admin-tactic-unlocks">
          ${tacticUnlockChips(draft).map((chip) => `<span>${escapeHtml(chip)}</span>`).join("") || `<span>无前置条件</span>`}
        </div>
      </div>
      ${this.validationHtml(validation)}
      ${this.previewActionsHtml()}
    `;
  }

  private enemyPreviewHtml(draft: any, validation: Array<{ level: string; title: string; text: string }>) {
    const color = normalizeColor(draft.color || "#6ee7f9");
    const radius = clampNumber(Number(draft.enemyRadius) || 18, 8, 180);
    const size = clampNumber(radius * 1.18, 28, 132);
    const hp = Math.max(1, Math.round(Number(draft.enemyHp) || 1));
    const speed = Math.max(1, Math.round(Number(draft.enemySpeed) || 1));
    const armor = Number(draft.enemyArmor) || 0;
    const threat = enemyThreatLevel(draft);
    const hpBaseline = draft.type === "boss" ? 1600 : draft.type === "elite" ? 320 : draft.type === "tank" ? 90 : 100;
    const hpRatio = clampNumber(hp / hpBaseline, 0.18, 1);
    return `
      <div class="admin-enemy-preview" style="--enemy-color:${color};--enemy-size:${size}px;--enemy-hp:${hpRatio * 100}%">
        <article class="admin-enemy-stage">
          <div class="admin-enemy-lane">
            <span></span><span></span><span></span>
          </div>
          <div class="admin-enemy-unit ${draft.type === "boss" ? "boss" : draft.type === "elite" ? "elite" : ""}">
            <i>${escapeHtml(enemyGlyph(draft))}</i>
            ${armor > 0 ? `<b>${armor.toFixed(1)}</b>` : ""}
          </div>
          <div class="admin-enemy-hp"><i></i></div>
        </article>
        <div class="admin-pool-summary">
          <div><span>血量</span><strong>${formatNumber(hp)}</strong></div>
          <div><span>速度</span><strong>${speed}</strong></div>
          <div><span>威胁</span><strong>${threat.toFixed(1)}</strong></div>
        </div>
        <div class="admin-enemy-tags">
          <span>${escapeHtml(enemyRoleLabels[draft.enemyRole] || enemyRoleForType(draft.type))}</span>
          <span>${escapeHtml(enemyBehaviorLabels[draft.enemyBehavior] || enemyBehaviorForType(draft.type))}</span>
          <span>${draft.enemyPvpEnabled === false ? "PVP 禁用" : "PVP 可投放"}</span>
        </div>
        <div class="admin-rate-bars">
          ${this.rateBarHtml("血量压力", Math.round(Math.min(100, hp / 16)), color)}
          ${this.rateBarHtml("速度压力", Math.round(Math.min(100, speed / 1.4)), "#54c7ff")}
          ${this.rateBarHtml("收益预算", Math.round(Math.min(100, (Number(draft.enemyCoins) || 0) * 7 + (Number(draft.enemyExp) || 0) * 2)), "#f6c95f")}
        </div>
      </div>
      ${this.validationHtml(validation)}
      ${this.previewActionsHtml()}
    `;
  }

  private stagePreviewHtml(draft: any, validation: Array<{ level: string; title: string; text: string }>) {
    const events = stageEventLinesToEvents(draft.stageWaveEvents);
    const enemies = stageCsv(draft.stageEnemyBias).filter((id) => enemyConfigs[id as EnemyType]).slice(0, 8);
    const featured = stageCsv(draft.stageFeaturedEnemies).filter((id) => enemyConfigs[id as EnemyType]).slice(0, 5);
    const difficulty = stageDifficultyScore(draft);
    return `
      <div class="admin-stage-preview">
        <article class="admin-stage-card">
          <div class="admin-stage-card-head">
            <span>${escapeHtml(stageChapterLabels[String(draft.stageChapter || draft.chapter || 1)] || `第 ${draft.stageChapter || 1} 章`)}</span>
            <b>${escapeHtml(stageTypeBadge(draft))}</b>
          </div>
          <strong>${escapeHtml(draft.name || "未命名关卡")}</strong>
          <em>${escapeHtml(draft.objective || "暂无目标")}</em>
          <div class="admin-stage-route">
            ${[5, 10, 15, 20].map((wave) => `<i class="${events.some((event) => Number(event.wave) === wave) ? "active" : ""}">${wave}</i>`).join("")}
          </div>
        </article>
        <div class="admin-rate-bars">
          ${this.rateBarHtml("血量压力", Math.round(clampNumber(Number(draft.stageHpMultiplier) || 1, 0.5, 3) / 3 * 100), "#ff8a5f")}
          ${this.rateBarHtml("速度压力", Math.round(clampNumber(Number(draft.stageSpeedMultiplier) || 1, 0.5, 2.5) / 2.5 * 100), "#54c7ff")}
          ${this.rateBarHtml("密度压力", Math.round(clampNumber(Number(draft.stageDensityMultiplier) || 1, 0.5, 2.5) / 2.5 * 100), "#b68cff")}
        </div>
        <div class="admin-pool-summary">
          <div><span>难度</span><strong>${difficulty.toFixed(1)}</strong></div>
          <div><span>事件</span><strong>${events.length}</strong></div>
          <div><span>奖励</span><strong>${Number(draft.stageRewardCoins || 1).toFixed(2)}x</strong></div>
        </div>
        <div class="admin-stage-enemies">
          ${(featured.length ? featured : enemies).map((id) => `<span style="--enemy-color:${enemyConfigs[id as EnemyType]?.color || "#54c7ff"}">${escapeHtml(enemyConfigs[id as EnemyType]?.name || id)}</span>`).join("")}
        </div>
        <div class="admin-stage-timeline">
          ${
            events.length
              ? events.slice(0, 5).map((event) => `<div><strong>第 ${Math.round(Number(event.wave) || 1)} 波 · ${escapeHtml(event.label || "事件")}</strong><span>${escapeHtml((event.enemies || []).map((id) => enemyConfigs[id]?.name || id).join(" / ") || stageWaveTypeLabels[event.type || "normal"] || "普通")}</span></div>`).join("")
              : `<div><strong>暂无波次事件</strong><span>建议至少配置 3 个关键事件</span></div>`
          }
        </div>
        <div class="admin-stage-rewards">
          ${stageRewardChips(draft).map((chip) => `<span>${escapeHtml(chip)}</span>`).join("") || `<span>使用章节默认奖励</span>`}
        </div>
      </div>
      ${this.validationHtml(validation)}
      ${this.previewActionsHtml()}
    `;
  }

  private userPreviewHtml(user: any, validation: Array<{ level: string; title: string; text: string }>) {
    if (!user || user.empty) {
      return `
        <div class="admin-user-preview-empty">
          <strong>${this.usersLoading ? "读取玩家中" : "没有可展示玩家"}</strong>
          <span>${this.usersLoading ? "用户列表加载完成后会显示账号摘要。" : "调整左侧筛选条件后重新查询。"}</span>
        </div>
        ${this.validationHtml(validation)}
      `;
    }
    const detail = this.selectedUserDetail?.userId === user.userId ? this.selectedUserDetail : user;
    const summary = detail.summary || {};
    return `
      <div class="admin-user-preview">
        <article class="admin-user-card ${detail.status}">
          <span>${detail.isGuest ? "游客玩家" : "注册玩家"}</span>
          <strong>${escapeHtml(detail.nickname || "未命名玩家")}</strong>
          <em>${escapeHtml(detail.username || detail.guestId || detail.userId)}</em>
          <div class="admin-user-card-meter"><i style="width:${detail.status === "active" ? 100 : detail.status === "banned" ? 46 : 18}%"></i></div>
          <small>${escapeHtml(userStatusLabels[detail.status] || detail.status)}</small>
        </article>
        <div class="admin-user-stat-grid">
          <div><span>金币</span><strong>${formatNumber(summary.coins)}</strong></div>
          <div><span>能源晶体</span><strong>${formatNumber(summary.energyCrystals)}</strong></div>
          <div><span>竞技币</span><strong>${formatNumber(summary.pvpCoins)}</strong></div>
          <div><span>胜场</span><strong>${formatNumber(summary.wins)}</strong></div>
          <div><span>最佳波次</span><strong>${formatNumber(summary.bestWave)}</strong></div>
          <div><span>主线进度</span><strong>${formatNumber(summary.unlockedStage)}</strong></div>
          <div><span>角色</span><strong>${formatNumber(summary.ownedCharacters)}</strong></div>
          <div><span>幻化</span><strong>${formatNumber(summary.ownedCosmetics)}</strong></div>
        </div>
        <div class="admin-user-rank-box">
          <div><span>1v1 段位</span><strong>${escapeHtml(summary.duelRank || "未定级")}</strong><em>${escapeHtml(summary.duelRecord || "0胜 0负")}</em></div>
          <div><span>吃鸡段位</span><strong>${escapeHtml(summary.battleRoyaleRank || "未定级")}</strong><em>玩家竞技资产摘要</em></div>
        </div>
      </div>
      ${this.validationHtml(validation)}
    `;
  }

  private characterPreviewHtml(draft: any, validation: Array<{ level: string; title: string; text: string }>) {
    const character = characters.find((item) => item.id === draft.targetId) || characters[0];
    const portrait = characterPortraitSources[character.id] || "";
    return `
      <div class="admin-character-preview" style="--skin-color:${normalizeColor(draft.color)};--skin-accent:${normalizeColor(draft.accentColor || draft.color)}">
        <div class="admin-character-stage">
          <div class="admin-character-halo"></div>
          <img src="${portrait}" alt="${escapeHtml(character.name)}" draggable="false" />
          <strong>${escapeHtml(draft.name.split("·").pop()?.trim() || draft.name)}</strong>
          <span>${escapeHtml(character.name)} · ${escapeHtml(outfitMotionLabels[draft.characterShowcaseMotion] || "待机")}</span>
        </div>
        <div class="admin-character-card-row">
          <div><span>头像</span><strong>${escapeHtml(draft.visualLabel || "外")}</strong></div>
          <div><span>技能</span><strong>${escapeHtml(skillFxLabels[draft.characterSkillFxPreset] || "基础")}</strong></div>
          <div><span>标签</span><strong>${escapeHtml(draft.characterShopTag || "常驻")}</strong></div>
        </div>
      </div>
      ${this.validationHtml(validation)}
      ${this.previewActionsHtml()}
    `;
  }

  private gachaPreviewHtml(draft: any, validation: Array<{ level: string; title: string; text: string }>) {
    const summary = this.gachaSummary(draft);
    const rateSum = this.gachaRateSum(draft);
    const upItems = this.gachaPoolItems(draft).filter((item) => this.poolItemTuning(draft, item.id).up);
    return `
      <div class="admin-gacha-preview">
        <div class="admin-gacha-machine">
          <span>${escapeHtml(draft.kind === "character" ? "角色池" : "弹珠池")}</span>
          <strong>${escapeHtml(draft.name)}</strong>
          <em>${escapeHtml(draft.featuredTheme || "常驻")}</em>
        </div>
        <div class="admin-rate-bars">
          ${this.rateBarHtml("稀有", draft.rateRare, "#54c7ff")}
          ${this.rateBarHtml("史诗", draft.rateEpic, "#b68cff")}
          ${this.rateBarHtml("传说", draft.rateLegendary, "#f6c95f")}
        </div>
        <div class="admin-pool-summary">
          <div><span>概率合计</span><strong>${rateSum}%</strong></div>
          <div><span>启用内容</span><strong>${summary.enabled}</strong></div>
          <div><span>UP 内容</span><strong>${summary.up}</strong></div>
        </div>
        <div class="admin-up-chips">
          ${
            upItems.length
              ? upItems.map((item) => `<span>${escapeHtml(item.name.split("·").pop()?.trim() || item.name)}</span>`).join("")
              : `<span>暂无 UP 内容</span>`
          }
        </div>
      </div>
      ${this.validationHtml(validation)}
      ${this.previewActionsHtml()}
    `;
  }

  private shopPreviewHtml(draft: any, validation: Array<{ level: string; title: string; text: string }>) {
    const color = this.shopColorForDraft(draft);
    const summary = this.shopSummary(draft);
    return `
      <div class="admin-shop-preview" style="--shop-color:${color};--shop-accent:${this.shopAccentForDraft(draft)}">
        <article class="admin-shop-card">
          <div class="admin-shop-card-head">
            <i>${escapeHtml(draft.shopBadge || this.shopBadgeForDraft(draft))}</i>
            <span>${escapeHtml(shopCategoryLabels[draft.category] || "商店")}</span>
            <b>${draft.shopFeatured ? "推荐" : refreshLabels[draft.refresh] || "投放"}</b>
          </div>
          <strong>${escapeHtml(draft.name)}</strong>
          <p>${escapeHtml(draft.desc || "")}</p>
          <div class="admin-shop-card-price">
            <span>${escapeHtml(currencyLabels[draft.priceCurrency] || "货币")}</span>
            <em>${Number(draft.priceAmount) <= 0 ? "领取" : Math.round(Number(draft.priceAmount) || 0)}</em>
          </div>
          <div class="admin-shop-card-foot">
            <span>库存 ${Math.round(Number(draft.stock) || 0)}</span>
            <span>${draft.shopEnabled === false ? "停用" : refreshLabels[draft.refresh] || "刷新"}</span>
          </div>
        </article>
        <div class="admin-shop-reward-chips">
          ${(draft.rewards || []).map((reward: any) => `<span>${escapeHtml(shopRewardDraftLabel(reward))}</span>`).join("")}
        </div>
        <div class="admin-pool-summary">
          <div><span>奖励项</span><strong>${summary.rewardCount}</strong></div>
          <div><span>价格带</span><strong>${summary.priceBand}</strong></div>
          <div><span>门槛</span><strong>${summary.unlock}</strong></div>
        </div>
      </div>
      ${this.validationHtml(validation)}
      ${this.previewActionsHtml()}
    `;
  }

  private redeemPreviewHtml(draft: any, validation: Array<{ level: string; title: string; text: string }>) {
    if (!draft || draft.empty) {
      return `
        <div class="admin-user-preview-empty">
          <strong>${this.redeemLoading ? "读取兑换码中" : "没有可展示兑换码"}</strong>
          <span>${this.redeemLoading ? "兑换码列表加载完成后会显示礼包摘要。" : "点击左侧新建兑换码配置礼包。"}</span>
        </div>
        ${this.validationHtml(validation)}
      `;
    }
    const used = Math.max(0, Math.round(Number(draft.usedCount) || 0));
    const maxUses = redeemMaxUsesValue(draft.maxUses);
    const progress = maxUses ? clampNumber((used / maxUses) * 100, 0, 100) : clampNumber(used * 6, 0, 100);
    const rewards = Array.isArray(draft.rewards) ? draft.rewards : [];
    return `
      <div class="admin-redeem-preview">
        <article class="admin-redeem-card ${escapeHtml(draft.status || "draft")}">
          <span>${escapeHtml(redeemRuntimeLabel(draft))}</span>
          <strong>${escapeHtml(draft.code || "NEWCODE")}</strong>
          <em>${escapeHtml(draft.title || "未命名礼包")}</em>
          <div class="admin-redeem-meter"><i style="width:${progress}%"></i></div>
          <small>${maxUses ? `${used}/${maxUses} 次领取` : `${used} 次领取 · 不限量`}</small>
        </article>
        <div class="admin-shop-reward-chips">
          ${rewards.length ? rewards.map((reward: any) => `<span>${escapeHtml(shopRewardDraftLabel(reward))}</span>`).join("") : `<span>暂无奖励</span>`}
        </div>
        <div class="admin-pool-summary">
          <div><span>奖励项</span><strong>${rewards.length}</strong></div>
          <div><span>有效期</span><strong>${escapeHtml(redeemTimeWindowLabel(draft))}</strong></div>
          <div><span>剩余</span><strong>${maxUses ? Math.max(0, maxUses - used) : "不限"}</strong></div>
        </div>
      </div>
      ${this.validationHtml(validation)}
      <div class="admin-actions">
        <button type="button" data-admin-action="reset">重置</button>
        <button type="button" data-admin-action="export">导出 JSON</button>
        <button class="primary" type="button" data-admin-action="saveRedeemCode">保存到服务器</button>
      </div>
    `;
  }

  private publishPreviewHtml(draft: any, validation: Array<{ level: string; title: string; text: string }>) {
    if (draft.kind === "release") return this.releaseRecordPreviewHtml(draft, validation);
    const bundle = this.buildReleaseBundle(draft);
    const releases = this.releaseRecordsForUi();
    return `
      <div class="admin-release-preview">
        <article class="admin-release-card">
          <span>${escapeHtml(releaseEnvLabels[draft.releaseEnv] || "测试环境")}</span>
          <strong>${escapeHtml(draft.releaseTitle || "未命名版本")}</strong>
          <em>${escapeHtml(draft.configVersion || "未生成版本号")}</em>
          <div class="admin-release-meter">
            <i style="width:${clampNumber(Number(draft.releaseGrayPercent) || 10, 1, 100)}%"></i>
          </div>
          <small>${escapeHtml(draft.releaseMode === "scheduled" ? `${draft.releaseScheduleDelayHours || 1} 小时后发布` : "立即发布")}</small>
        </article>
        <div class="admin-pool-summary">
          <div><span>配置项</span><strong>${bundle.summary.totalItems}</strong></div>
          <div><span>模块数</span><strong>${bundle.summary.modules}</strong></div>
          <div><span>历史版本</span><strong>${releases.length}</strong></div>
        </div>
        <div class="admin-release-timeline">
          ${
            releases.length
              ? releases.slice(0, 4).map((item) => `<div><strong>${escapeHtml(item.configVersion)}</strong><span>${escapeHtml(item.title)} · ${escapeHtml(formatDateTime(item.publishedAt))}</span></div>`).join("")
              : `<div><strong>暂无发布记录</strong><span>发布后会在这里形成审计时间线</span></div>`
          }
        </div>
      </div>
      ${this.validationHtml(validation)}
      <div class="admin-actions admin-release-actions">
        <button type="button" data-admin-action="buildRelease">生成候选</button>
        <button type="button" data-admin-action="export">导出配置包</button>
        <button class="primary" type="button" data-admin-action="publishRelease">发布到环境</button>
      </div>
    `;
  }

  private releaseRecordPreviewHtml(draft: any, validation: Array<{ level: string; title: string; text: string }>) {
    const bundle = draft.bundle || {};
    return `
      <div class="admin-release-preview">
        <article class="admin-release-card published">
          <span>${escapeHtml(releaseEnvLabels[draft.environment] || draft.environment || "环境")}</span>
          <strong>${escapeHtml(draft.title || "已发布版本")}</strong>
          <em>${escapeHtml(draft.configVersion || "-")}</em>
          <div class="admin-release-meter"><i style="width:100%"></i></div>
          <small>${escapeHtml(formatDateTime(draft.publishedAt || draft.createdAt))}</small>
        </article>
        <div class="admin-pool-summary">
          <div><span>配置项</span><strong>${bundle.summary?.totalItems || 0}</strong></div>
          <div><span>模块数</span><strong>${bundle.summary?.modules || 0}</strong></div>
          <div><span>状态</span><strong>${escapeHtml(draft.status || "published")}</strong></div>
        </div>
      </div>
      ${this.validationHtml(validation)}
      <div class="admin-actions admin-release-actions">
        <button type="button" data-admin-action="rollbackRelease">生成回滚候选</button>
        <button class="primary" type="button" data-admin-action="export">导出此版本</button>
      </div>
    `;
  }

  private validationHtml(validation: Array<{ level: string; title: string; text: string }>) {
    return `<div class="admin-validation">${validation.map((row) => `<div class="${row.level}"><span>${row.title}</span><strong>${row.text}</strong></div>`).join("")}</div>`;
  }

  private previewActionsHtml() {
    return `
      <div class="admin-actions">
        <button type="button" data-admin-action="reset">重置</button>
        <button type="button" data-admin-action="saveDraft">保存草稿</button>
        <button class="primary" type="button" data-admin-action="export">导出 JSON</button>
      </div>
    `;
  }

  private editorHeaderActionsHtml(draft: any) {
    if (this.activeModule === "publish") {
      if (draft?.kind === "release") {
        return `
          <div class="admin-editor-quick-actions">
            <button class="primary" type="button" data-admin-action="rollbackRelease">生成回滚候选</button>
          </div>
        `;
      }
      return `
        <div class="admin-editor-quick-actions">
          <button type="button" data-admin-action="buildRelease">生成候选</button>
          <button class="primary" type="button" data-admin-action="publishRelease">发布到环境</button>
        </div>
      `;
    }
    if (!this.canUseDraftActions()) return "";
    return `
      <div class="admin-editor-quick-actions">
        <button type="button" data-admin-action="saveDraft">保存草稿</button>
        <button class="primary" type="button" data-admin-action="saveAndOpenPublish">去发布</button>
      </div>
    `;
  }

  private canUseDraftActions() {
    return this.activeModule !== "users" && this.activeModule !== "redeem" && this.activeModule !== "publish";
  }

  private libraryItemHtml(item: any, active: boolean) {
    if (this.activeModule === "hero") return this.heroLibraryItemHtml(item, active);
    if (this.activeModule === "skill") return this.skillLibraryItemHtml(item, active);
    if (this.activeModule === "tactic") return this.tacticLibraryItemHtml(item, active);
    if (this.activeModule === "enemy") return this.enemyLibraryItemHtml(item, active);
    if (this.activeModule === "stage") return this.stageLibraryItemHtml(item, active);
    if (this.activeModule === "character") return this.characterLibraryItemHtml(item, active);
    if (this.activeModule === "gacha") return this.gachaLibraryItemHtml(item, active);
    if (this.activeModule === "shop") return this.shopLibraryItemHtml(item, active);
    if (this.activeModule === "redeem") return this.redeemLibraryItemHtml(item, active);
    if (this.activeModule === "users") return this.userLibraryItemHtml(item, active);
    if (this.activeModule === "publish") return this.publishLibraryItemHtml(item, active);
    const draft = this.draftFor("marble", item.id);
    const target = marbleConfigs[item.targetId as keyof typeof marbleConfigs];
    return `
      <button class="admin-item ${active ? "active" : ""}" type="button" data-admin-select="${item.id}" style="--item-color:${draft.color};--item-accent:${draft.accentColor || draft.color}">
        <i>${escapeHtml(draft.visualLabel || "")}</i>
        <span>
          <strong>${escapeHtml(item.name.split("·").pop()?.trim() || item.name)}</strong>
          <em>${escapeHtml(target?.name || "弹珠")} · ${escapeHtml(draft.theme || "主题")}</em>
        </span>
        <b>${this.touched[this.draftKey("marble", item.id)] ? "草稿" : rarityName(item.rarity)}</b>
      </button>
    `;
  }

  private userLibraryItemHtml(item: any, active: boolean) {
    if (item.empty) {
      return `
        <button class="admin-item admin-user-item ${active ? "active" : ""}" type="button" data-admin-select="${item.id}" style="--item-color:#4d6076;--item-accent:#92a7c1">
          <i>?</i>
          <span>
            <strong>${escapeHtml(item.name || "暂无玩家")}</strong>
            <em>${this.usersLoading ? "正在加载数据库用户" : "调整筛选条件后查询"}</em>
          </span>
          <b>${this.usersLoading ? "加载" : "空"}</b>
        </button>
      `;
    }
    return `
      <button class="admin-item admin-user-item ${active ? "active" : ""}" type="button" data-admin-select="${escapeHtml(item.userId)}" style="--item-color:${userStatusColor(item.status)};--item-accent:#61e6a8">
        <i>${escapeHtml((item.nickname || "玩").slice(0, 1).toUpperCase())}</i>
        <span>
          <strong>${escapeHtml(item.nickname || "未命名玩家")}</strong>
          <em>${escapeHtml(item.username || item.guestId || item.userId)} · ${escapeHtml(formatDateTime(item.lastLoginAt))}</em>
        </span>
        <b class="${item.status}">${escapeHtml(userStatusLabels[item.status] || item.status)}</b>
      </button>
    `;
  }

  private redeemLibraryItemHtml(item: any, active: boolean) {
    if (item.empty) {
      return `
        <button class="admin-item admin-redeem-item ${active ? "active" : ""}" type="button" data-admin-select="${item.id}" style="--item-color:#4d6076;--item-accent:#92a7c1">
          <i>兑</i>
          <span>
            <strong>${escapeHtml(item.title || item.name || "暂无兑换码")}</strong>
            <em>${this.redeemLoading ? "正在加载服务器兑换码" : "点击新建兑换码开始配置"}</em>
          </span>
          <b>空</b>
        </button>
      `;
    }
    const used = Math.max(0, Math.round(Number(item.usedCount) || 0));
    const maxUses = redeemMaxUsesValue(item.maxUses);
    const status = item.isNew ? "draft" : item.status || "draft";
    return `
      <button class="admin-item admin-redeem-item ${active ? "active" : ""}" type="button" data-admin-select="${escapeHtml(item.code || item.id)}" style="--item-color:${redeemStatusColor(status)};--item-accent:#61e6a8">
        <i>${escapeHtml(redeemStatusIcon(status))}</i>
        <span>
          <strong>${escapeHtml(item.title || "未命名礼包")}</strong>
          <em>${escapeHtml(item.isNew ? "新建兑换码" : item.code || item.id)} · ${maxUses ? `${used}/${maxUses}` : `${used} 次`}</em>
        </span>
        <b class="${escapeHtml(status)}">${escapeHtml(item.isNew ? "草稿" : redeemStatusLabels[status] || status)}</b>
      </button>
    `;
  }

  private tacticLibraryItemHtml(item: UpgradeCard, active: boolean) {
    const draft = this.draftFor("tactic", item.id);
    return `
      <button class="admin-item ${active ? "active" : ""}" type="button" data-admin-select="${item.id}" style="--item-color:${tacticRarityColor(draft.rarity)};--item-accent:${tacticTagColor(draft.tag)}">
        <i>${escapeHtml(tacticCardIcon(draft))}</i>
        <span>
          <strong>${escapeHtml(draft.name)}</strong>
          <em>${escapeHtml(draft.tag || "战术")} · ${escapeHtml(tacticKindLabels[draft.tacticKind] || "战术")} · ${escapeHtml(tacticEffectTypeLabels[draft.tacticEffectType] || "效果")}</em>
        </span>
        <b>${this.touched[this.draftKey("tactic", item.id)] ? "草稿" : rarityName(draft.rarity)}</b>
      </button>
    `;
  }

  private enemyLibraryItemHtml(item: EnemyConfig & { id: string }, active: boolean) {
    const draft = this.draftFor("enemy", item.id);
    return `
      <button class="admin-item ${active ? "active" : ""}" type="button" data-admin-select="${item.id}" style="--item-color:${normalizeColor(draft.color)};--item-accent:${enemyAccentColor(draft)}">
        <i>${escapeHtml(enemyGlyph(draft))}</i>
        <span>
          <strong>${escapeHtml(draft.name)}</strong>
          <em>${escapeHtml(enemyRoleLabels[draft.enemyRole] || enemyRoleForType(draft.type))} · HP ${formatNumber(draft.enemyHp)} · SPD ${Math.round(Number(draft.enemySpeed) || 0)}</em>
        </span>
        <b>${this.touched[this.draftKey("enemy", item.id)] ? "草稿" : enemyThreatBadge(draft)}</b>
      </button>
    `;
  }

  private stageLibraryItemHtml(item: StageConfig, active: boolean) {
    const draft = this.draftFor("stage", item.id);
    return `
      <button class="admin-item ${active ? "active" : ""}" type="button" data-admin-select="${item.id}" style="--item-color:${stageAccentColor(draft)};--item-accent:${draft.stageHasBoss ? "#ffe59a" : "#54c7ff"}">
        <i>${draft.stageHasBoss ? "首" : String(draft.stageNo || draft.stage || 1)}</i>
        <span>
          <strong>${escapeHtml(draft.name)}</strong>
          <em>${escapeHtml(stageChapterLabels[String(draft.stageChapter || draft.chapter)] || `第 ${draft.stageChapter || draft.chapter} 章`)} · ${escapeHtml(draft.theme || "主题")} · 难度 ${stageDifficultyScore(draft).toFixed(1)}</em>
        </span>
        <b>${this.touched[this.draftKey("stage", item.id)] ? "草稿" : `#${draft.stageIndex || draft.index}`}</b>
      </button>
    `;
  }

  private heroLibraryItemHtml(item: any, active: boolean) {
    const draft = this.draftFor("hero", item.id);
    const portrait = characterPortraitSources[draft.id] || "";
    return `
      <button class="admin-item admin-character-item ${active ? "active" : ""}" type="button" data-admin-select="${item.id}" style="--item-color:${draft.color};--item-accent:${marbleConfigs[draft.heroMarbleSecondary]?.color || draft.color}">
        <i>${portrait ? `<img src="${portrait}" alt="" draggable="false" />` : escapeHtml((draft.name || "角").slice(0, 1))}</i>
        <span>
          <strong>${escapeHtml(draft.name)}</strong>
          <em>${escapeHtml(draft.role || "定位")} · ${escapeHtml(characterRarityLabels[draft.rarity] || draft.rarity)}</em>
        </span>
        <b>${this.touched[this.draftKey("hero", item.id)] ? "草稿" : "角色"}</b>
      </button>
    `;
  }

  private skillLibraryItemHtml(item: any, active: boolean) {
    const draft = this.draftFor("skill", item.id);
    const character = characters.find((entry) => entry.id === draft.targetId) || item;
    return `
      <button class="admin-item ${active ? "active" : ""}" type="button" data-admin-select="${item.id}" style="--item-color:${character.color};--item-accent:${skillFxColor(draft.skillFxPreset)}">
        <i>技</i>
        <span>
          <strong>${escapeHtml(draft.skillName || item.skillName)}</strong>
          <em>${escapeHtml(character.name)} · ${Math.round(Number(draft.skillCooldown) || item.skillCooldown)} 秒冷却</em>
        </span>
        <b>${this.touched[this.draftKey("skill", item.id)] ? "草稿" : "技能"}</b>
      </button>
    `;
  }

  private characterLibraryItemHtml(item: CosmeticConfig, active: boolean) {
    const draft = this.draftFor("character", item.id);
    const character = characters.find((entry) => entry.id === draft.targetId) || characters[0];
    const portrait = characterPortraitSources[character.id] || "";
    return `
      <button class="admin-item admin-character-item ${active ? "active" : ""}" type="button" data-admin-select="${item.id}" style="--item-color:${draft.color};--item-accent:${draft.accentColor || draft.color}">
        <i><img src="${portrait}" alt="" draggable="false" /></i>
        <span>
          <strong>${escapeHtml(item.name.split("·").pop()?.trim() || item.name)}</strong>
          <em>${escapeHtml(character.name)} · ${escapeHtml(draft.theme || "主题")}</em>
        </span>
        <b>${this.touched[this.draftKey("character", item.id)] ? "草稿" : rarityName(item.rarity)}</b>
      </button>
    `;
  }

  private gachaLibraryItemHtml(item: any, active: boolean) {
    const draft = this.draftFor("gacha", item.id);
    const summary = this.gachaSummary(draft);
    return `
      <button class="admin-item ${active ? "active" : ""}" type="button" data-admin-select="${item.id}" style="--item-color:${draft.kind === "character" ? "#b68cff" : "#54c7ff"};--item-accent:#61e6a8">
        <i>池</i>
        <span>
          <strong>${escapeHtml(draft.name)}</strong>
          <em>${summary.enabled} 个内容 · ${draft.singleCrystalCost} 晶体/抽</em>
        </span>
        <b>${this.touched[this.draftKey("gacha", item.id)] ? "草稿" : "配置"}</b>
      </button>
    `;
  }

  private shopLibraryItemHtml(item: ShopItemConfig, active: boolean) {
    const draft = this.draftFor("shop", item.id);
    return `
      <button class="admin-item ${active ? "active" : ""}" type="button" data-admin-select="${item.id}" style="--item-color:${this.shopColorForDraft(draft)};--item-accent:${this.shopAccentForDraft(draft)}">
        <i>${escapeHtml(draft.shopBadge || this.shopBadgeForDraft(draft))}</i>
        <span>
          <strong>${escapeHtml(draft.name)}</strong>
          <em>${escapeHtml(shopCategoryLabels[draft.category] || "商店")} · ${escapeHtml(currencyLabels[draft.priceCurrency] || "货币")} ${Number(draft.priceAmount) || 0}</em>
        </span>
        <b>${this.touched[this.draftKey("shop", item.id)] ? "草稿" : refreshLabels[draft.refresh] || "投放"}</b>
      </button>
    `;
  }

  private publishLibraryItemHtml(item: any, active: boolean) {
    if (item.kind === "candidate") {
      const draft = this.draftFor("publish", "candidate");
      const summary = this.releaseSummary(draft);
      return `
        <button class="admin-item ${active ? "active" : ""}" type="button" data-admin-select="candidate" style="--item-color:#61e6a8;--item-accent:#54c7ff">
          <i>候</i>
          <span>
            <strong>发布候选</strong>
            <em>${summary.changed} 个草稿 · ${escapeHtml(releaseEnvLabels[draft.releaseEnv] || "测试环境")}</em>
          </span>
          <b>${this.touched[this.draftKey("publish", "candidate")] ? "草稿" : "准备"}</b>
        </button>
      `;
    }
    return `
      <button class="admin-item ${active ? "active" : ""}" type="button" data-admin-select="${escapeHtml(item.id)}" style="--item-color:#f6c95f;--item-accent:#61e6a8">
        <i>版</i>
        <span>
          <strong>${escapeHtml(item.configVersion || item.title)}</strong>
          <em>${escapeHtml(releaseEnvLabels[item.environment] || item.environment || "环境")} · ${escapeHtml(formatDateTime(item.publishedAt))}</em>
        </span>
        <b>${escapeHtml(item.status || "published")}</b>
      </button>
    `;
  }

  private textField(field: string, label: string, value: string, maxLength: number) {
    return `
      <label class="admin-field">
        <span>${label}</span>
        <input type="text" maxlength="${maxLength}" value="${escapeHtml(value || "")}" data-admin-field="${field}" />
      </label>
    `;
  }

  private textareaField(field: string, label: string, value: string, rows: number) {
    return `
      <label class="admin-field admin-field-wide">
        <span>${label}</span>
        <textarea rows="${rows}" data-admin-field="${field}">${escapeHtml(value || "")}</textarea>
      </label>
    `;
  }

  private colorField(field: string, label: string, value: string) {
    const color = normalizeColor(value);
    return `
      <label class="admin-color-field">
        <span>${label}</span>
        <input type="color" value="${color}" data-admin-field="${field}" />
        <strong data-admin-value="${field}">${color.toUpperCase()}</strong>
      </label>
    `;
  }

  private selectField(field: string, label: string, value: string, options: string[], labels: Record<string, string>) {
    return `
      <label class="admin-field">
        <span>${label}</span>
        <select data-admin-field="${field}">
          ${options.map((option) => `<option value="${option}" ${option === value ? "selected" : ""}>${labels[option] || option}</option>`).join("")}
        </select>
      </label>
    `;
  }

  private marbleShapePickerFieldHtml(value: string) {
    const icon = marbleShapeIconUrl(value);
    const label = marbleShapeLabels[value] || value;
    const group = marbleShapeGroups.find((item) => item.shapes.some(([shape]) => shape === value));
    return `
      <div class="admin-field admin-shape-field">
        <span>本体形态</span>
        <input type="hidden" value="${escapeHtml(value)}" data-admin-field="marbleShape" />
        <button class="admin-shape-picker-trigger" type="button" data-admin-action="openShapePicker">
          <i>${icon ? `<img src="${icon}" alt="" draggable="false" />` : escapeHtml(label.slice(0, 1))}</i>
          <strong>${escapeHtml(label)}</strong>
          <em>${escapeHtml(group?.label || "全部形态")}</em>
        </button>
      </div>
    `;
  }

  private shapePickerOverlayHtml(draft: any) {
    const current = draft.marbleShape || "orb";
    const query = this.shapePickerQuery.trim().toLowerCase();
    const groups = this.shapePickerGroup === "all" ? marbleShapeGroups : marbleShapeGroups.filter((group) => group.id === this.shapePickerGroup);
    const matches = groups
      .map((group) => ({
        ...group,
        shapes: group.shapes.filter(([id, label]) => {
          if (!query) return true;
          return id.toLowerCase().includes(query) || label.toLowerCase().includes(query);
        }),
      }))
      .filter((group) => group.shapes.length);
    const total = matches.reduce((sum, group) => sum + group.shapes.length, 0);
    return `
      <div class="admin-shape-picker-backdrop" data-admin-shape-backdrop>
        <section class="admin-shape-picker-modal" role="dialog" aria-label="选择本体形态" data-admin-shape-dialog>
          <header class="admin-shape-picker-head">
            <div>
              <span>Marble Body Shape</span>
              <h2>选择本体形态</h2>
            </div>
            <button type="button" class="admin-close" data-admin-action="closeShapePicker">×</button>
          </header>
          <div class="admin-shape-picker-toolbar">
            <div class="admin-shape-search">
              <span class="admin-button-symbol" aria-hidden="true">${adminIcons.search}</span>
              <input type="search" value="${escapeHtml(this.shapePickerQuery)}" placeholder="搜索形态名称 / ID" data-admin-shape-search />
            </div>
            <div class="admin-shape-group-tabs" role="tablist" aria-label="形态分类">
              ${[
                { id: "all", label: "全部" },
                ...marbleShapeGroups.map((group) => ({ id: group.id, label: group.label })),
              ]
                .map(
                  (group) => `
                    <button
                      type="button"
                      class="${this.shapePickerGroup === group.id ? "active" : ""}"
                      data-admin-shape-group="${group.id}"
                    >${escapeHtml(group.label)}</button>
                  `,
                )
                .join("")}
            </div>
          </div>
          <div class="admin-shape-picker-body">
            ${
              total
                ? matches
                    .map(
                      (group) => `
                        <section class="admin-shape-picker-group">
                          <div class="admin-shape-picker-group-head">
                            <strong>${escapeHtml(group.label)}</strong>
                            <span>${group.shapes.length}</span>
                          </div>
                          <div class="admin-shape-grid">
                            ${group.shapes.map(([id, label]) => this.shapeOptionHtml(id, label, current)).join("")}
                          </div>
                        </section>
                      `,
                    )
                    .join("")
                : `<div class="admin-shape-empty">没有匹配的形态</div>`
            }
          </div>
        </section>
      </div>
    `;
  }

  private shapeOptionHtml(id: string, label: string, current: string) {
    const icon = marbleShapeIconUrl(id);
    return `
      <button
        class="admin-shape-option ${id === current ? "active" : ""}"
        type="button"
        data-admin-shape-option="${id}"
        title="${escapeHtml(label)}"
      >
        <i>${icon ? `<img src="${icon}" alt="" draggable="false" />` : escapeHtml(label.slice(0, 1))}</i>
        <span>${escapeHtml(label)}</span>
        <em>${escapeHtml(id)}</em>
      </button>
    `;
  }

  private sliderField(field: string, label: string, value: number, min: number, max: number) {
    const current = clampNumber(Number(value) || 0, min, max);
    return `
      <label class="admin-slider">
        <span>${label}<strong data-admin-value="${field}">${current.toFixed(2)}</strong></span>
        <input type="range" min="${min}" max="${max}" step="0.01" value="${current}" data-admin-field="${field}" />
      </label>
    `;
  }

  private numberField(field: string, label: string, value: number, min: number, max: number) {
    const current = clampNumber(Math.round(Number(value) || 0), min, max);
    return `
      <label class="admin-field">
        <span>${label}</span>
        <input type="number" min="${min}" max="${max}" step="1" value="${current}" data-admin-field="${field}" />
      </label>
    `;
  }

  private checkboxField(field: string, label: string, checked: boolean) {
    return `
      <label class="admin-check-field">
        <input type="checkbox" ${checked ? "checked" : ""} data-admin-field="${field}" />
        <span>${label}</span>
      </label>
    `;
  }

  private unlockEditorHtml(draft: any) {
    if (draft.unlockType === "pvpRank") {
      return `
        ${this.selectField("unlockRankMode", "竞技模式", draft.unlockRankMode || "duel", ["duel", "power_duel", "battle_royale"], pvpRankModeLabels)}
        ${this.selectField("unlockRankTier", "段位", draft.unlockRankTier || "silver", pvpRankTierOptions, pvpRankTierLabels)}
        ${this.selectField("unlockRankDivision", "分段", String(draft.unlockRankDivision || 3), pvpRankDivisionOptions, { "3": "III", "2": "II", "1": "I" })}
        ${this.textField("unlockDesc", "展示文案", draft.unlockDesc || "", 24)}
      `;
    }
    if (draft.unlockType === "stage" || draft.unlockType === "wins") {
      return `
        ${this.numberField("unlockValue", draft.unlockType === "stage" ? "通关进度" : "胜场数量", draft.unlockValue || 1, 1, 999)}
        ${this.textField("unlockDesc", "展示文案", draft.unlockDesc || "", 24)}
      `;
    }
    return `<div class="admin-empty-note">无门槛商品会直接出现在对应货架。</div>`;
  }

  private shopRewardEditorHtml(reward: any, index: number) {
    return `
      <div class="admin-reward-item">
        <div class="admin-reward-head">
          <strong>奖励 ${index + 1}</strong>
          <button class="admin-mini-button danger" type="button" data-admin-action="removeReward" data-admin-reward-index="${index}" ${index <= 0 ? "disabled" : ""}>移除</button>
        </div>
        <div class="admin-reward-fields">
          ${this.rewardSelect(index, "type", "奖励类型", reward.type || "coins", rewardTypeOptions, rewardTypeLabels)}
          ${this.rewardTargetEditorHtml(reward, index)}
          ${this.rewardAmountEditorHtml(reward, index)}
        </div>
      </div>
    `;
  }

  private rewardTargetEditorHtml(reward: any, index: number) {
    if (reward.type === "marbleShard") {
      return this.rewardSelect(index, "target", "目标弹珠", reward.target || "basic", Object.keys(marbleConfigs), Object.fromEntries(Object.values(marbleConfigs).map((item) => [item.id, item.name])));
    }
    if (reward.type === "gem") {
      return this.rewardSelect(index, "target", "宝石类型", reward.target || "power", Object.keys(gemConfigs), Object.fromEntries(Object.values(gemConfigs).map((item) => [item.type, item.name])));
    }
    if (reward.type === "collectible") {
      return this.rewardSelect(index, "target", "收藏品", reward.target || "scrap_shell", Object.keys(collectibleConfigs), Object.fromEntries(Object.values(collectibleConfigs).map((item) => [item.id, item.name])));
    }
    if (reward.type === "characterUnlock") {
      return this.rewardSelect(index, "target", "目标角色", reward.target || characters[0]?.id, characters.map((item) => item.id), Object.fromEntries(characters.map((item) => [item.id, item.name])));
    }
    if (reward.type === "ticket") {
      return this.rewardSelect(index, "target", "道具券", reward.target || "insurance", ticketOptions, ticketLabels);
    }
    return `<label class="admin-field"><span>目标</span><input type="text" value="-" disabled /></label>`;
  }

  private rewardAmountEditorHtml(reward: any, index: number) {
    if (reward.type === "characterUnlock" || reward.type === "allMarbleCosmetics") {
      return `<label class="admin-field"><span>数量</span><input type="text" value="唯一" disabled /></label>`;
    }
    if (reward.type === "gem") {
      return `
        ${this.rewardNumber(index, "amount", "数量", reward.amount || 1, 1, 999)}
        ${this.rewardNumber(index, "level", "等级", reward.level || 1, 1, 10)}
      `;
    }
    return this.rewardNumber(index, "amount", "数量", reward.amount || 1, 1, 999999);
  }

  private rewardSelect(index: number, prop: string, label: string, value: string, options: string[], labels: Record<string, string>) {
    return `
      <label class="admin-field">
        <span>${label}</span>
        <select data-admin-reward-index="${index}" data-admin-reward-prop="${prop}">
          ${options.map((option) => `<option value="${option}" ${String(option) === String(value) ? "selected" : ""}>${labels[option] || option}</option>`).join("")}
        </select>
      </label>
    `;
  }

  private rewardNumber(index: number, prop: string, label: string, value: number, min: number, max: number) {
    const current = clampNumber(Math.round(Number(value) || min), min, max);
    return `
      <label class="admin-field">
        <span>${label}</span>
        <input type="number" min="${min}" max="${max}" step="1" value="${current}" data-admin-reward-index="${index}" data-admin-reward-prop="${prop}" />
      </label>
    `;
  }

  private gachaPoolItemHtml(draft: any, item: CosmeticConfig) {
    const tuning = this.poolItemTuning(draft, item.id);
    const label = item.name.split("·").pop()?.trim() || item.name;
    return `
      <div class="admin-pool-item" style="--item-color:${item.color};--item-accent:${item.accentColor || item.color}">
        <input type="checkbox" ${tuning.enabled ? "checked" : ""} data-admin-pool-item="${item.id}" data-admin-pool-prop="enabled" />
        <i>${escapeHtml(item.visualLabel || "")}</i>
        <span>
          <strong>${escapeHtml(label)}</strong>
          <em>${escapeHtml(rarityName(item.rarity))} · ${escapeHtml(item.theme || "主题")}</em>
        </span>
        <span class="admin-pool-up">
          <input type="checkbox" ${tuning.up ? "checked" : ""} data-admin-pool-item="${item.id}" data-admin-pool-prop="up" />
          <b>UP</b>
        </span>
        <input class="admin-pool-weight" type="number" min="0.1" max="10" step="0.1" value="${tuning.weight}" data-admin-pool-item="${item.id}" data-admin-pool-prop="weight" />
      </div>
    `;
  }

  private handleClick(event: Event) {
    const target = event.target as HTMLElement;
    const redeemStatusOption = target.closest<HTMLElement>("[data-admin-redeem-status-option]")?.dataset.adminRedeemStatusOption;
    const shapeBackdrop = target.dataset.adminShapeBackdrop !== undefined;
    const shapeOption = target.closest<HTMLElement>("[data-admin-shape-option]")?.dataset.adminShapeOption;
    const shapeGroup = target.closest<HTMLElement>("[data-admin-shape-group]")?.dataset.adminShapeGroup;
    const select = target.closest<HTMLElement>("[data-admin-select]")?.dataset.adminSelect;
    const action = target.closest<HTMLElement>("[data-admin-action]")?.dataset.adminAction;

    if (shapeBackdrop) {
      this.shapePickerOpen = false;
      this.render();
      return;
    }

    if (redeemStatusOption) {
      if (this.redeemStatus !== redeemStatusOption) {
        this.redeemStatus = redeemStatusOption;
        void this.loadRedeemCodes();
      }
      return;
    }

    if (shapeGroup) {
      this.shapePickerGroup = shapeGroup;
      this.render();
      return;
    }

    if (shapeOption) {
      const draft = this.draftFor(this.activeModule, this.selectedIds[this.activeModule]);
      draft.marbleShape = shapeOption;
      this.touched[this.draftKey(this.activeModule, this.selectedIds[this.activeModule])] = true;
      this.shapePickerOpen = false;
      this.render();
      return;
    }

    if (select) {
      this.selectedIds[this.activeModule] = select;
      if (this.activeModule === "users" && !select.startsWith("__")) {
        this.selectedUserDetail = null;
        void this.loadAdminUserDetail(select);
      }
      if (this.activeModule === "redeem" && !select.startsWith("__")) {
        this.selectedRedeemDetail = null;
        void this.loadRedeemCodeDetail(select);
      }
      this.exportOpen = false;
      this.render();
      return;
    }

    if (!action) return;
    if (action === "logout") this.logout();
    if (action === "openShapePicker") {
      this.shapePickerOpen = true;
      this.shapePickerGroup = this.shapePickerGroup || "all";
      this.render();
    }
    if (action === "closeShapePicker") {
      this.shapePickerOpen = false;
      this.render();
    }
    if (action === "reset") this.resetDraft();
    if (action === "saveDraft") this.saveDraft();
    if (action === "saveAndOpenPublish") this.saveAndOpenPublish();
    if (action === "addReward") this.addShopReward();
    if (action === "removeReward") this.removeShopReward(Number(target.closest<HTMLElement>("[data-admin-reward-index]")?.dataset.adminRewardIndex || -1));
    if (action === "newRedeemCode") this.newRedeemCode();
    if (action === "refreshRedeemCodes") void this.loadRedeemCodes();
    if (action === "saveRedeemCode") void this.saveRedeemCode();
    if (action === "addRedeemReward") this.addRedeemReward();
    if (action === "removeRedeemReward") this.removeRedeemReward(Number(target.closest<HTMLElement>("[data-admin-reward-index]")?.dataset.adminRewardIndex || -1));
    if (action === "refreshUsers") void this.loadAdminUsers();
    if (action === "refreshUserDetail") void this.loadAdminUserDetail(this.selectedIds.users);
    if (action === "saveUserProfile") void this.saveUserProfile();
    if (action === "banUser24") void this.updateUserStatus("banned", 24);
    if (action === "banUser7") void this.updateUserStatus("banned", 24 * 7);
    if (action === "disableUser") void this.updateUserStatus("disabled");
    if (action === "unbanUser") void this.updateUserStatus("active");
    if (action === "buildRelease") this.buildReleaseCandidate();
    if (action === "publishRelease") void this.publishRelease();
    if (action === "rollbackRelease") this.rollbackRelease();
    if (action === "export") {
      this.syncDraftFromForm();
      this.exportOpen = true;
      this.render();
    }
    if (action === "closeExport") {
      this.exportOpen = false;
      this.render();
    }
    if (action === "copyExport") {
      this.syncDraftFromForm();
      void navigator.clipboard?.writeText(this.exportJson(this.draftFor(this.activeModule, this.selectedIds[this.activeModule])));
      this.exportOpen = false;
      this.notice = "已复制 JSON";
      this.render();
    }
  }

  private handleNavSelection(event: ShoelaceTreeSelectionEvent) {
    const selectedItem = event.detail?.selection?.find((item) => item.dataset.adminModule);
    const module = selectedItem?.dataset.adminModule as AdminModule | undefined;
    if (!module || !(module in moduleLabels) || module === this.activeModule) return;
    this.activeModule = module;
    this.exportOpen = false;
    this.notice = "";
    this.render();
  }

  private handleFieldInput(event: Event) {
    const input = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    if (input.dataset.adminUsersSearch !== undefined) {
      this.userQuery = input.value;
      if (event.type === "change") void this.loadAdminUsers();
      return;
    }
    if (input.dataset.adminUsersStatus !== undefined) {
      this.userStatus = input.value;
      void this.loadAdminUsers();
      return;
    }
    if (input.dataset.adminRedeemSearch !== undefined) {
      this.redeemQuery = input.value;
      if (event.type === "change") void this.loadRedeemCodes();
      return;
    }
    if (input.dataset.adminRedeemStatus !== undefined) {
      this.redeemStatus = input.value;
      void this.loadRedeemCodes();
      return;
    }
    if (input.dataset.adminShapeSearch !== undefined) {
      this.shapePickerQuery = input.value;
      this.render();
      return;
    }
    if (this.activeModule === "users") return;
    if (input.dataset.adminCharacterArray) {
      this.updateCharacterArray(input as HTMLInputElement, event.type);
      return;
    }
    if (input.dataset.adminPoolItem) {
      this.updatePoolItem(input as HTMLInputElement, event.type);
      return;
    }
    if (input.dataset.adminRewardIndex) {
      this.updateShopReward(input as HTMLInputElement | HTMLSelectElement, event.type);
      return;
    }

    const field = input.dataset.adminField;
    if (!field || !this.selectedIds[this.activeModule]) return;
    const draft = this.draftFor(this.activeModule, this.selectedIds[this.activeModule]);
    draft[field] = input instanceof HTMLInputElement && input.type === "checkbox" ? input.checked : numericFields.has(field) ? Number(input.value) : input.value;
    this.touched[this.draftKey(this.activeModule, this.selectedIds[this.activeModule])] = true;
    const label = this.root.querySelector<HTMLElement>(`[data-admin-value="${field}"]`);
    if (label) label.textContent = numericFields.has(field) ? Number(input.value).toFixed(2) : String(input.value).toUpperCase();
    if (this.activeModule === "marble") this.paintPreview();
    else if (event.type === "change") this.render();
  }

  private updateCharacterArray(input: HTMLInputElement, eventType: string) {
    if (this.activeModule !== "hero") return;
    const draft = this.draftFor("hero", this.selectedIds.hero);
    const kind = input.dataset.adminCharacterArray || "";
    const index = Number(input.dataset.adminCharacterIndex || -1);
    const prop = input.dataset.adminCharacterProp || "";
    const collection = kind === "passive" ? draft.passives : kind === "route" ? draft.routes : null;
    if (!Array.isArray(collection) || index < 0 || !collection[index] || !prop) return;
    if (input.type === "number") {
      collection[index][prop] = prop === "growth" ? Number(input.value) : Math.round(Number(input.value) || 0);
    } else {
      collection[index][prop] = input.value;
    }
    this.touched[this.draftKey("hero", this.selectedIds.hero)] = true;
    if (eventType === "change") this.render();
  }

  private async loadAdminUsers() {
    if (this.usersLoading) return;
    this.usersLoading = true;
    this.notice = this.usersLoaded ? "正在刷新用户列表..." : "";
    this.render();
    try {
      const params = new URLSearchParams({
        limit: "40",
        status: this.userStatus || "all",
      });
      if (this.userQuery.trim()) params.set("query", this.userQuery.trim());
      const response = await this.request<{ users: any[]; total: number }>(`/admin/users?${params.toString()}`);
      this.users = Array.isArray(response.users) ? response.users : [];
      this.userTotal = Number(response.total || this.users.length);
      this.usersLoaded = true;
      if (!this.users.some((item) => item.userId === this.selectedIds.users)) {
        this.selectedIds.users = this.users[0]?.userId || "__empty_users__";
      }
      this.selectedUserDetail = this.users.find((item) => item.userId === this.selectedIds.users) || null;
      this.notice = this.users.length ? `已加载 ${this.users.length}/${this.userTotal} 名玩家` : "没有找到符合条件的玩家";
    } catch (error) {
      this.usersLoaded = true;
      this.users = [];
      this.userTotal = 0;
      this.selectedIds.users = "__empty_users__";
      this.selectedUserDetail = null;
      this.notice = error instanceof Error ? `用户服务连接失败：${error.message}` : "用户服务连接失败";
    } finally {
      this.usersLoading = false;
      this.render();
    }
  }

  private async loadAdminUserDetail(userId: string) {
    if (!userId || userId.startsWith("__")) return;
    try {
      const response = await this.request<{ user: any }>(`/admin/users/${encodeURIComponent(userId)}`);
      this.selectedUserDetail = response.user;
      const index = this.users.findIndex((item) => item.userId === userId);
      if (index >= 0) this.users[index] = response.user;
      this.render();
    } catch (error) {
      this.notice = error instanceof Error ? `读取玩家详情失败：${error.message}` : "读取玩家详情失败";
      this.render();
    }
  }

  private async saveUserProfile() {
    if (this.activeModule !== "users" || !this.selectedIds.users || this.selectedIds.users.startsWith("__")) return;
    const nickname = this.root.querySelector<HTMLInputElement>('[data-admin-field="userNickname"]')?.value || "";
    const avatar = this.root.querySelector<HTMLInputElement>('[data-admin-field="userAvatar"]')?.value || "";
    this.busy = true;
    this.notice = "正在保存玩家资料...";
    this.render();
    try {
      const response = await this.request<{ user: any }>(`/admin/users/${encodeURIComponent(this.selectedIds.users)}/profile`, {
        method: "POST",
        body: { nickname, avatar },
      });
      this.applyUserUpdate(response.user);
      this.notice = "玩家资料已保存";
    } catch (error) {
      this.notice = error instanceof Error ? `保存失败：${error.message}` : "保存失败";
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private async updateUserStatus(status: string, banHours?: number) {
    if (this.activeModule !== "users" || !this.selectedIds.users || this.selectedIds.users.startsWith("__")) return;
    this.busy = true;
    this.notice = "正在更新玩家状态...";
    this.render();
    try {
      const response = await this.request<{ user: any }>(`/admin/users/${encodeURIComponent(this.selectedIds.users)}/status`, {
        method: "POST",
        body: { status, banHours },
      });
      this.applyUserUpdate(response.user);
      this.notice = status === "active" ? "玩家账号已恢复正常" : status === "disabled" ? "玩家账号已停用" : "玩家账号已封禁";
    } catch (error) {
      this.notice = error instanceof Error ? `状态更新失败：${error.message}` : "状态更新失败";
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private applyUserUpdate(user: any) {
    if (!user?.userId) return;
    this.selectedUserDetail = user;
    const index = this.users.findIndex((item) => item.userId === user.userId);
    if (index >= 0) this.users[index] = user;
    else this.users.unshift(user);
    this.selectedIds.users = user.userId;
  }

  private async loadRedeemCodes() {
    if (this.redeemLoading) return;
    this.redeemLoading = true;
    this.notice = this.redeemLoaded ? "正在刷新兑换码列表..." : "";
    this.render();
    try {
      const params = new URLSearchParams({
        limit: "60",
        status: this.redeemStatus || "all",
      });
      if (this.redeemQuery.trim()) params.set("query", this.redeemQuery.trim());
      const response = await this.request<{ codes: any[]; total: number }>(`/admin/redeem-codes?${params.toString()}`);
      this.redeemCodes = Array.isArray(response.codes) ? response.codes : [];
      this.redeemTotal = Number(response.total || this.redeemCodes.length);
      this.redeemLoaded = true;
      if (!this.selectedIds.redeem?.startsWith("__") && !this.redeemCodes.some((item) => item.code === this.selectedIds.redeem)) {
        this.selectedIds.redeem = this.redeemCodes[0]?.code || "__empty_redeem__";
      }
      this.selectedRedeemDetail = this.redeemCodes.find((item) => item.code === this.selectedIds.redeem) || null;
      this.notice = this.redeemCodes.length ? `已加载 ${this.redeemCodes.length}/${this.redeemTotal} 个兑换码` : "没有找到符合条件的兑换码";
      if (this.selectedIds.redeem && !this.selectedIds.redeem.startsWith("__")) void this.loadRedeemCodeDetail(this.selectedIds.redeem);
    } catch (error) {
      this.redeemLoaded = true;
      this.redeemCodes = [];
      this.redeemTotal = 0;
      this.selectedIds.redeem = "__empty_redeem__";
      this.selectedRedeemDetail = null;
      this.notice = error instanceof Error ? `兑换码服务连接失败：${error.message}` : "兑换码服务连接失败";
    } finally {
      this.redeemLoading = false;
      this.render();
    }
  }

  private async loadRedeemCodeDetail(code: string) {
    if (!code || code.startsWith("__")) return;
    try {
      const response = await this.request<{ code: any; redemptions: any[] }>(`/admin/redeem-codes/${encodeURIComponent(code)}`);
      this.applyRedeemDetail(response);
      this.render();
    } catch (error) {
      this.notice = error instanceof Error ? `读取兑换码详情失败：${error.message}` : "读取兑换码详情失败";
      this.render();
    }
  }

  private applyRedeemDetail(detail: any) {
    const code = detail?.code || detail;
    if (!code?.code) return;
    const index = this.redeemCodes.findIndex((item) => item.code === code.code);
    if (index >= 0) this.redeemCodes[index] = code;
    else this.redeemCodes.unshift(code);
    this.redeemTotal = Math.max(this.redeemTotal, this.redeemCodes.length);
    this.selectedIds.redeem = code.code;
    this.selectedRedeemDetail = {
      ...code,
      redemptions: Array.isArray(detail?.redemptions) ? detail.redemptions : this.selectedRedeemDetail?.redemptions || [],
    };
    const key = this.draftKey("redeem", code.code);
    if (!this.touched[key]) this.drafts[key] = this.createRedeemDraft(code);
  }

  private newRedeemCode() {
    const id = "__new_redeem__";
    this.selectedIds.redeem = id;
    this.selectedRedeemDetail = null;
    this.drafts[this.draftKey("redeem", id)] = this.createRedeemDraft({
      id,
      code: "",
      title: "新礼包兑换码",
      status: "draft",
      isNew: true,
      rewards: [{ type: "coins", amount: 500 }],
    });
    this.touched[this.draftKey("redeem", id)] = true;
    this.exportOpen = false;
    this.notice = "正在新建兑换码";
    this.render();
  }

  private addRedeemReward() {
    if (this.activeModule !== "redeem") return;
    const draft = this.draftFor("redeem", this.selectedIds.redeem);
    if (draft?.empty) return;
    draft.rewards ||= [];
    draft.rewards.push({ type: "coins", amount: 100 });
    this.touched[this.draftKey("redeem", this.selectedIds.redeem)] = true;
    this.render();
  }

  private removeRedeemReward(index: number) {
    if (this.activeModule !== "redeem") return;
    const draft = this.draftFor("redeem", this.selectedIds.redeem);
    if (!Array.isArray(draft.rewards) || draft.rewards.length <= 1 || index < 0) return;
    draft.rewards.splice(index, 1);
    this.touched[this.draftKey("redeem", this.selectedIds.redeem)] = true;
    this.render();
  }

  private async saveRedeemCode() {
    if (this.activeModule !== "redeem" || !this.selectedIds.redeem || this.selectedIds.redeem.startsWith("__empty")) return;
    this.syncDraftFromForm();
    const oldKey = this.draftKey("redeem", this.selectedIds.redeem);
    const draft = this.draftFor("redeem", this.selectedIds.redeem);
    if (!draft || draft.empty) return;
    const payload = JSON.parse(this.exportRedeemJson(draft));
    const isNew = Boolean(draft.isNew || this.selectedIds.redeem.startsWith("__new"));
    this.busy = true;
    this.notice = "正在保存兑换码...";
    this.render();
    try {
      const response = await this.request<{ code: any; redemptions: any[] }>(isNew ? "/admin/redeem-codes" : `/admin/redeem-codes/${encodeURIComponent(draft.code)}`, {
        method: "POST",
        body: payload,
      });
      const savedCode = response.code?.code;
      if (savedCode) {
        if (oldKey !== this.draftKey("redeem", savedCode)) {
          delete this.drafts[oldKey];
          delete this.touched[oldKey];
        }
        this.applyRedeemDetail(response);
        const key = this.draftKey("redeem", savedCode);
        this.drafts[key] = this.createRedeemDraft(response.code);
        this.touched[key] = false;
      }
      saveAdminDraftState(this.drafts, this.touched);
      this.notice = "兑换码已保存到服务器";
    } catch (error) {
      this.notice = error instanceof Error ? `保存兑换码失败：${error.message}` : "保存兑换码失败";
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private async loadConfigReleases() {
    if (this.configReleasesLoading) return;
    this.configReleasesLoading = true;
    this.notice = this.configReleasesLoaded ? "正在刷新发布版本..." : this.notice;
    this.render();
    try {
      const response = await this.request<{ releases: any[]; total: number }>("/admin/config-releases?limit=30");
      this.configReleases = Array.isArray(response.releases) ? response.releases : [];
      this.configReleasesLoaded = true;
      if (this.selectedIds.publish !== "candidate" && !this.configReleases.some((item) => item.id === this.selectedIds.publish)) {
        this.selectedIds.publish = this.configReleases[0]?.id || "candidate";
      }
      this.notice = this.configReleases.length ? `已加载 ${this.configReleases.length} 个服务器发布版本` : "暂无服务器发布版本";
    } catch (error) {
      this.configReleasesLoaded = true;
      this.configReleases = [];
      this.notice = error instanceof Error ? `发布服务连接失败：${error.message}` : "发布服务连接失败";
    } finally {
      this.configReleasesLoading = false;
      this.render();
    }
  }

  private addShopReward() {
    if (this.activeModule !== "shop") return;
    const draft = this.draftFor("shop", this.selectedIds.shop);
    draft.rewards ||= [];
    draft.rewards.push({ type: "coins", amount: 100 });
    this.touched[this.draftKey("shop", this.selectedIds.shop)] = true;
    this.render();
  }

  private removeShopReward(index: number) {
    if (this.activeModule !== "shop") return;
    const draft = this.draftFor("shop", this.selectedIds.shop);
    if (!Array.isArray(draft.rewards) || draft.rewards.length <= 1 || index < 0) return;
    draft.rewards.splice(index, 1);
    this.touched[this.draftKey("shop", this.selectedIds.shop)] = true;
    this.render();
  }

  private updateShopReward(input: HTMLInputElement | HTMLSelectElement, eventType: string) {
    if (this.activeModule !== "shop" && this.activeModule !== "redeem") return;
    const module = this.activeModule === "redeem" ? "redeem" : "shop";
    const draft = this.draftFor(module, this.selectedIds[module]);
    const index = Number(input.dataset.adminRewardIndex || -1);
    const prop = input.dataset.adminRewardProp || "";
    if (!Array.isArray(draft.rewards) || index < 0 || !draft.rewards[index]) return;
    const reward = draft.rewards[index];
    if (prop === "type") {
      draft.rewards[index] = defaultShopReward(input.value);
    } else if (prop === "amount" || prop === "level") {
      reward[prop] = clampNumber(Math.round(Number(input.value) || 1), 1, 999999);
    } else if (prop === "target") {
      reward.target = input.value;
    }
    this.touched[this.draftKey(module, this.selectedIds[module])] = true;
    if (eventType === "change" || prop === "type") this.render();
  }

  private updatePoolItem(input: HTMLInputElement, eventType: string) {
    const draft = this.draftFor("gacha", this.selectedIds.gacha);
    const itemId = input.dataset.adminPoolItem || "";
    const prop = input.dataset.adminPoolProp || "";
    const tuning = this.poolItemTuning(draft, itemId);
    if (prop === "weight") tuning.weight = clampNumber(Number(input.value) || 1, 0.1, 10);
    else tuning[prop] = input.checked;
    this.touched[this.draftKey("gacha", this.selectedIds.gacha)] = true;
    if (input.type !== "number" || eventType === "change") this.render();
  }

  private resetDraft() {
    if (this.activeModule === "users") return;
    const key = this.draftKey(this.activeModule, this.selectedIds[this.activeModule]);
    delete this.drafts[key];
    delete this.touched[key];
    saveAdminDraftState(this.drafts, this.touched);
    this.exportOpen = false;
    this.notice = "当前草稿已重置";
    this.render();
  }

  private saveDraft() {
    if (this.activeModule === "users") return;
    if (this.activeModule === "redeem") {
      void this.saveRedeemCode();
      return;
    }
    this.syncDraftFromForm();
    this.touched[this.draftKey(this.activeModule, this.selectedIds[this.activeModule])] = true;
    saveAdminDraftState(this.drafts, this.touched);
    this.exportOpen = false;
    this.notice = "草稿已保存到本机";
    this.render();
  }

  private saveAndOpenPublish() {
    if (!this.canUseDraftActions()) return;
    this.syncDraftFromForm();
    this.touched[this.draftKey(this.activeModule, this.selectedIds[this.activeModule])] = true;
    saveAdminDraftState(this.drafts, this.touched);
    this.activeModule = "publish";
    this.selectedIds.publish = "candidate";
    this.exportOpen = false;
    this.notice = "草稿已保存，请在发布中心确认检查项后发布";
    this.render();
  }

  private syncDraftFromForm() {
    const draft = this.draftFor(this.activeModule, this.selectedIds[this.activeModule]);
    this.root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("[data-admin-field]").forEach((input) => {
      const field = input.dataset.adminField;
      if (!field) return;
      draft[field] = input instanceof HTMLInputElement && input.type === "checkbox" ? input.checked : numericFields.has(field) ? Number(input.value) : input.value;
    });
  }

  private moduleItems(module: AdminModule) {
    if (module === "hero" || module === "skill") return characters;
    if (module === "tactic") return upgradeCards;
    if (module === "enemy") return enemyTypeOptions.map((type) => ({ id: type, ...enemyConfigs[type] }));
    if (module === "stage") return stages;
    if (module === "character") return sortCosmetics(cosmeticsForPool("character"));
    if (module === "gacha") return Object.values(cosmeticPools);
    if (module === "shop") return shopItems;
    if (module === "users") {
      if (this.users.length) return this.users;
      return [{ id: "__empty_users__", empty: true, name: this.usersLoading ? "正在加载玩家" : "暂无玩家" }];
    }
    if (module === "redeem") {
      const items = this.redeemCodes.length
        ? this.redeemCodes
        : [{ id: "__empty_redeem__", code: "__empty_redeem__", empty: true, title: this.redeemLoading ? "正在加载兑换码" : "暂无兑换码" }];
      if (this.selectedIds.redeem?.startsWith("__new")) {
        const draft = this.drafts[this.draftKey("redeem", this.selectedIds.redeem)];
        return [
          {
            id: this.selectedIds.redeem,
            code: this.selectedIds.redeem,
            title: draft?.title || "新建兑换码",
            status: draft?.status || "draft",
            usedCount: 0,
            maxUses: draft?.maxUses ?? null,
            isNew: true,
          },
          ...items.filter((item) => !item.empty),
        ];
      }
      return items;
    }
    if (module === "publish") return this.publishItems();
    return sortCosmetics(cosmeticsForPool("marble"));
  }

  private selectedItem() {
    const id = this.selectedIds[this.activeModule];
    const items = this.moduleItems(this.activeModule);
    const idField = this.activeModule === "users" ? "userId" : this.activeModule === "redeem" ? "code" : "id";
    return items.find((item) => item[idField] === id || item.id === id) || items[0] || { id: "__empty__", empty: true, name: "暂无内容" };
  }

  private draftFor(module: AdminModule, itemId: string) {
    if (module === "users") return this.selectedItem();
    const key = this.draftKey(module, itemId);
    if (this.drafts[key]) return this.drafts[key];
    const item = this.moduleItems(module).find((entry) => entry.id === itemId) || this.moduleItems(module)[0];
    if (module === "hero") this.drafts[key] = this.createHeroDraft(item);
    else if (module === "skill") this.drafts[key] = this.createSkillDraft(item);
    else if (module === "tactic") this.drafts[key] = this.createTacticDraft(item);
    else if (module === "enemy") this.drafts[key] = this.createEnemyDraft(item);
    else if (module === "stage") this.drafts[key] = this.createStageDraft(item);
    else if (module === "character") this.drafts[key] = this.createCharacterDraft(item);
    else if (module === "gacha") this.drafts[key] = this.createGachaDraft(item);
    else if (module === "shop") this.drafts[key] = this.createShopDraft(item);
    else if (module === "redeem") this.drafts[key] = this.createRedeemDraft(item);
    else if (module === "publish") this.drafts[key] = this.createPublishDraft(item);
    else this.drafts[key] = this.createMarbleDraft(item);
    return this.drafts[key];
  }

  private createMarbleDraft(item: CosmeticConfig) {
    return {
      ...item,
      marbleShape: item.marbleShape || "orb",
      marbleTrailStyle: item.marbleTrailStyle || "soft",
      marbleTrailColor: item.marbleTrailColor || item.color,
      marbleTrailAccentColor: item.marbleTrailAccentColor || item.accentColor || item.color,
      marbleTrailHighlightColor: item.marbleTrailHighlightColor || item.marbleTrailAccentColor || item.accentColor || item.color,
      marbleTrailLength: item.marbleTrailLength || 1,
      marbleTrailWidth: item.marbleTrailWidth || 1,
      marbleTrailAnimation: item.marbleTrailAnimation || "steady",
      marbleTrailDensity: item.marbleTrailDensity || 1,
      marbleTrailOpacity: 0.72,
      marbleTrailGlow: item.rarity === "legendary" ? 1.35 : item.rarity === "epic" ? 1.05 : 0.75,
      marbleTrailTurbulence: 0.28,
      marbleTrailFade: 0.72,
      marbleTrailSegmentSpacing: 1,
      marbleTrailSparkRate: 1,
    };
  }

  private createHeroDraft(item: any) {
    return {
      ...item,
      heroMarblePrimary: item.marbles?.[0] || "basic",
      heroMarbleSecondary: item.marbles?.[1] || "split",
      heroUnlockType: item.unlock?.type || "none",
      heroUnlockStage: item.unlock?.stage || 1,
      heroUnlockWins: item.unlock?.wins || 1,
      heroUnlockCollectible: item.unlock?.collectible || "void_lens",
      heroUnlockAmount: item.unlock?.amount || 1,
      heroUnlockDesc: item.unlock?.desc || "",
      passives: (item.passives || []).map((passive: any) => ({ ...passive })),
      routes: (item.routes || []).map((route: any) => ({ ...route })),
    };
  }

  private createSkillDraft(item: any) {
    const type = defaultSkillEffectType(item.id);
    return {
      id: item.id,
      targetId: item.id,
      name: item.skillName,
      skillName: item.skillName,
      skillDesc: item.skillDesc,
      skillCooldown: item.skillCooldown,
      skillEffectType: type,
      skillTargeting: defaultSkillTargeting(item.id),
      skillDuration: defaultSkillDuration(item.id),
      skillPower: defaultSkillPower(item.id),
      skillRadius: defaultSkillRadius(item.id),
      skillProjectileCount: defaultSkillProjectileCount(item.id),
      skillControl: defaultSkillControl(item.id),
      skillGoldGain: item.id === "treasurer" ? 6 : item.id === "alchemist" ? 2 : 0,
      skillFxPreset: defaultSkillFxPreset(item.id),
      skillPreviewIntensity: item.rarity === "legendary" ? 1.45 : item.rarity === "epic" ? 1.15 : 0.85,
      skillAssetKey: `skill:${item.id}:active`,
      skillSoundKey: `skill:${item.id}:cast`,
    };
  }

  private createTacticDraft(item: UpgradeCard) {
    const maxStacks = item.maxStacks ?? 1;
    return {
      ...item,
      tacticKind: item.kind || "stackable",
      tacticEffectType: item.effectType || "attribute",
      tacticSource: item.source || "global",
      tacticFamilyId: item.familyId || "",
      tacticTier: item.tier || "none",
      tacticCoreType: item.core?.type || "none",
      tacticCoreId: item.core?.coreId || "",
      tacticCoreExclusiveGroup: item.core?.exclusiveGroup || "",
      tacticInfiniteStacks: maxStacks === "infinite",
      tacticMaxStacks: typeof maxStacks === "number" ? maxStacks : 1,
      tacticWeight: item.weight || 1,
      tacticEnabled: true,
      tacticUnlockCharacters: (item.unlock?.characters || []).join(","),
      tacticUnlockCards: (item.unlock?.cards || []).join(","),
      tacticUnlockFamilies: (item.unlock?.families || []).join(","),
      tacticApplyRef: item.id,
    };
  }

  private createEnemyDraft(item: EnemyConfig & { id?: string }) {
    return {
      id: item.type,
      type: item.type,
      name: item.name,
      color: item.color,
      enemyHp: item.hp,
      enemySpeed: item.speed,
      enemyRadius: item.radius,
      enemyExp: item.exp,
      enemyCoins: item.coins,
      enemyArmor: item.armor || 0,
      enemyRole: enemyRoleForType(item.type),
      enemyBehavior: enemyBehaviorForType(item.type),
      enemySpawnWeight: defaultEnemySpawnWeight(item.type),
      enemyThreatLevel: enemyThreatLevel({ ...item, enemyHp: item.hp, enemySpeed: item.speed, enemyRadius: item.radius, enemyArmor: item.armor || 0 }),
      enemyStageHint: enemyStageHint(item.type),
      enemyCounterHint: enemyCounterHint(item.type),
      enemyEnabled: true,
      enemyPvpEnabled: item.type !== "gold",
    };
  }

  private createStageDraft(item: StageConfig) {
    return {
      ...item,
      stageIndex: item.index,
      stageChapter: item.chapter,
      stageNo: item.stage,
      stageHpMultiplier: item.hpMultiplier,
      stageSpeedMultiplier: item.speedMultiplier,
      stageDensityMultiplier: item.densityMultiplier,
      stageEnemyBias: (item.enemyBias || []).join(","),
      stageFeaturedEnemies: (item.featuredEnemies || []).join(","),
      stageWaveEvents: stageEventsToLines(item.waveEvents || []),
      stageHasBoss: Boolean(item.boss),
      stageBossName: item.boss?.name || "",
      stageBossDesc: item.boss?.desc || "",
      stageBossSkills: (item.boss?.skills || []).join(","),
      stageRewardCoins: item.rewardBias?.coins || 1,
      stageRewardShards: (item.rewardBias?.shards || []).join(","),
      stageRewardGems: (item.rewardBias?.gems || []).join(","),
      stageRewardCollectibles: (item.rewardBias?.collectibles || []).join(","),
    };
  }

  private createCharacterDraft(item: CosmeticConfig) {
    return {
      ...item,
      characterShowcaseMotion: item.rarity === "legendary" ? "victory" : item.rarity === "epic" ? "float" : "idle",
      characterSkillFxPreset: item.theme?.includes("熔火") ? "flame" : item.theme?.includes("星海") ? "aurora" : item.theme?.includes("幽蓝") ? "neon" : "base",
      characterSkillFxIntensity: item.rarity === "legendary" ? 1.45 : item.rarity === "epic" ? 1.1 : 0.72,
      characterAvatarGlow: item.rarity === "legendary" ? 1.35 : item.rarity === "epic" ? 0.9 : 0.55,
      characterShowcaseGlow: item.rarity === "legendary" ? 1.45 : item.rarity === "epic" ? 1 : 0.65,
      characterShopTag: item.rarity === "legendary" ? "限定" : "常驻",
      characterAssetPortrait: item.assetKeys?.[0] || `character:${item.targetId}:portrait`,
      characterAssetBattle: item.assetKeys?.[1] || `character:${item.targetId}:battle`,
      characterEffectSkill: item.effectKeys?.[0] || `skill:${item.targetId}:cosmetic`,
    };
  }

  private createGachaDraft(pool: any) {
    const itemTuning: Record<string, any> = {};
    for (const itemId of pool.itemIds || []) itemTuning[itemId] = { enabled: true, up: false, weight: 1 };
    return {
      ...pool,
      pityEpic: pool.pity?.epic || 10,
      pityLegendary: pool.pity?.legendary || 60,
      rateRare: 82,
      rateEpic: 15,
      rateLegendary: 3,
      featuredTheme: "常驻",
      itemTuning,
    };
  }

  private createShopDraft(item: ShopItemConfig) {
    const index = Math.max(0, shopItems.findIndex((entry) => entry.id === item.id));
    return {
      ...item,
      priceCurrency: item.price?.currency || "coins",
      priceAmount: item.price?.amount || 0,
      stock: item.stock || 1,
      refresh: item.refresh || "daily",
      shopEnabled: true,
      shopFeatured: item.category === "arena" || item.category === "bundles",
      shopPriority: index + 1,
      shopBadge: this.shopBadgeForDraft(item),
      unlockType: item.unlock?.type || "none",
      unlockValue: item.unlock?.value || 1,
      unlockRankMode: item.unlock?.mode || "duel",
      unlockRankTier: item.unlock?.tier || "silver",
      unlockRankDivision: item.unlock?.division || 3,
      unlockDesc: item.unlock?.desc || "",
      rewards: (item.rewards || []).map((reward) => normalizeShopRewardDraft(reward)),
    };
  }

  private createRedeemDraft(item: any) {
    if (!item || item.empty) {
      return {
        id: item?.id || "__empty_redeem__",
        code: item?.code || item?.id || "__empty_redeem__",
        title: item?.title || item?.name || "暂无兑换码",
        empty: true,
        rewards: [],
      };
    }
    const isNew = Boolean(item.isNew || String(item.id || item.code || "").startsWith("__new"));
    return {
      id: isNew ? item.id || "__new_redeem__" : item.code || item.id,
      code: isNew ? item.code || "" : item.code || item.id || "",
      title: item.title || "",
      status: item.status || "draft",
      startsAt: item.startsAt || "",
      endsAt: item.endsAt || "",
      maxUses: item.maxUses ?? "",
      usedCount: Math.max(0, Math.round(Number(item.usedCount) || 0)),
      remaining: item.remaining ?? null,
      rewards: (item.rewards || []).map((reward: any) => normalizeShopRewardDraft(reward)),
      rewardLabels: item.rewardLabels || [],
      createdAt: item.createdAt || "",
      updatedAt: item.updatedAt || "",
      isNew,
    };
  }

  private createPublishDraft(item: any) {
    if (item?.kind === "release") return item;
    return {
      id: "candidate",
      kind: "candidate",
      name: "发布候选",
      releaseTitle: "内容配置发布",
      configVersion: nextConfigVersion(),
      releaseEnv: "test",
      releaseMode: "now",
      releaseGrayPercent: 10,
      releaseScheduleDelayHours: 1,
      releaseNotes: "更新后台内容配置。",
      releaseIncludeMarble: true,
      releaseIncludeHero: true,
      releaseIncludeSkill: true,
      releaseIncludeTactic: true,
      releaseIncludeEnemy: true,
      releaseIncludeStage: true,
      releaseIncludeCharacter: true,
      releaseIncludeGacha: true,
      releaseIncludeShop: true,
      releaseSchemaChecked: false,
      releaseEconomyChecked: false,
      releaseVisualChecked: false,
      releaseProdConfirmed: false,
    };
  }

  private draftKey(module: AdminModule, itemId: string) {
    return `${module}:${itemId}`;
  }

  private editorMetaText(draft: any) {
    if (this.activeModule === "users") {
      if (draft?.empty) return this.usersLoading ? "加载中" : "空列表";
      return `${escapeHtml(userStatusLabels[draft.status] || draft.status)} · ${draft.isGuest ? "游客" : "注册"}`;
    }
    if (this.activeModule === "hero") return `${escapeHtml(characterRarityLabels[draft.rarity] || draft.rarity || "角色")} · ${escapeHtml(draft.role || "定位")}`;
    if (this.activeModule === "skill") return `${escapeHtml(skillEffectTypeLabels[draft.skillEffectType] || "技能")} · ${Math.round(Number(draft.skillCooldown) || 0)} 秒冷却`;
    if (this.activeModule === "tactic") return `${escapeHtml(rarityName(draft.rarity || "common"))} · ${escapeHtml(tacticKindLabels[draft.tacticKind] || "战术")} · ${escapeHtml(draft.tag || "标签")}`;
    if (this.activeModule === "enemy") return `${escapeHtml(enemyRoleLabels[draft.enemyRole] || "怪物")} · 威胁 ${enemyThreatLevel(draft).toFixed(1)}`;
    if (this.activeModule === "stage") return `${escapeHtml(stageChapterLabels[String(draft.stageChapter || draft.chapter || 1)] || "章节")} · ${escapeHtml(stageTypeBadge(draft))}`;
    if (this.activeModule === "gacha") return `${draft.kind === "character" ? "角色池" : "弹珠池"} · ${draft.singleCrystalCost} 晶体/抽`;
    if (this.activeModule === "shop") return `${escapeHtml(shopCategoryLabels[draft.category] || "商店")} · ${escapeHtml(currencyLabels[draft.priceCurrency] || "货币")} ${Number(draft.priceAmount) || 0}`;
    if (this.activeModule === "redeem") {
      if (draft?.empty) return this.redeemLoading ? "加载中" : "空列表";
      const used = Math.max(0, Math.round(Number(draft.usedCount) || 0));
      const maxUses = redeemMaxUsesValue(draft.maxUses);
      return `${escapeHtml(redeemStatusLabels[draft.status] || draft.status || "状态")} · ${used}/${maxUses || "不限"}`;
    }
    if (this.activeModule === "publish") return draft.kind === "release" ? `${escapeHtml(releaseEnvLabels[draft.environment] || "环境")} · ${escapeHtml(formatDateTime(draft.publishedAt))}` : `${this.releaseSummary(draft).changed} 个草稿 · ${escapeHtml(releaseEnvLabels[draft.releaseEnv] || "测试环境")}`;
    return `${escapeHtml(rarityName(draft.rarity))} · ${escapeHtml(draft.theme || "未分组")}`;
  }

  private performanceScore(draft: any) {
    if (this.activeModule === "users") {
      return { score: draft?.empty ? 0 : 88, level: draft?.status === "active" ? "ok" : "mid", pvp: "账号数据" };
    }
    if (this.activeModule === "hero") {
      const routeCost = (draft.routes || []).reduce((sum: number, route: any) => sum + (Number(route.baseCost) || 0) / 100 + (Number(route.growth) || 1.45) * 8, 0);
      const score = Math.max(36, Math.min(96, Math.round(98 - Math.max(0, routeCost - 44))));
      return { score, level: score >= 78 ? "ok" : score >= 62 ? "mid" : "low", pvp: "角色配置" };
    }
    if (this.activeModule === "skill") {
      const load =
        (Number(draft.skillPower) || 1) * 12 +
        (Number(draft.skillRadius) || 0) / 18 +
        (Number(draft.skillProjectileCount) || 0) * 3 +
        (Number(draft.skillPreviewIntensity) || 1) * 8;
      const cooldownBudget = Math.max(0, 24 - (Number(draft.skillCooldown) || 18)) * 1.2;
      const score = Math.max(24, Math.min(98, Math.round(110 - load - cooldownBudget)));
      return { score, level: score >= 78 ? "ok" : score >= 62 ? "mid" : "low", pvp: "技能预算" };
    }
    if (this.activeModule === "tactic") {
      const stacks = draft.tacticInfiniteStacks ? 9 : Number(draft.tacticMaxStacks) || 1;
      const rarityLoad = { common: 4, rare: 8, epic: 13, legendary: 18 }[draft.rarity] || 8;
      const weightLoad = Math.max(0, (Number(draft.tacticWeight) || 1) - 1) * 18;
      const score = Math.max(28, Math.min(98, Math.round(102 - rarityLoad - stacks * 2.6 - weightLoad)));
      return { score, level: score >= 78 ? "ok" : score >= 62 ? "mid" : "low", pvp: "战术预算" };
    }
    if (this.activeModule === "enemy") {
      const threat = enemyThreatLevel(draft);
      const reward = (Number(draft.enemyCoins) || 0) / 18 + (Number(draft.enemyExp) || 0) / 12;
      const mismatch = Math.abs(threat - reward);
      const score = Math.max(24, Math.min(98, Math.round(96 - mismatch * 7 - Math.max(0, threat - 8.5) * 5)));
      return { score, level: score >= 78 ? "ok" : score >= 62 ? "mid" : "low", pvp: draft.enemyPvpEnabled === false ? "PVP 禁用" : "PVP 可用" };
    }
    if (this.activeModule === "stage") {
      const difficulty = stageDifficultyScore(draft);
      const events = stageEventLinesToEvents(draft.stageWaveEvents);
      const score = Math.max(24, Math.min(98, Math.round(104 - difficulty * 5 - Math.max(0, events.length - 5) * 4)));
      return { score, level: score >= 78 ? "ok" : score >= 62 ? "mid" : "low", pvp: draft.stageHasBoss ? "Boss 关" : "主线关" };
    }
    if (this.activeModule === "character") {
      const load = (draft.characterSkillFxIntensity || 1) * 10 + (draft.characterAvatarGlow || 1) * 5 + (draft.characterShowcaseGlow || 1) * 7;
      const score = Math.max(40, Math.min(98, Math.round(106 - load)));
      return { score, level: score >= 78 ? "ok" : score >= 62 ? "mid" : "low", pvp: score >= 62 ? "头像可用" : "需降级" };
    }
    if (this.activeModule === "gacha") {
      const sum = this.gachaRateSum(draft);
      const summary = this.gachaSummary(draft);
      const score = sum === 100 && summary.enabled >= 3 ? 92 : 56;
      return { score, level: score >= 78 ? "ok" : "low", pvp: "不影响" };
    }
    if (this.activeModule === "shop") {
      const validation = shopDraftIssueCount(draft);
      const rewardCount = Array.isArray(draft.rewards) ? draft.rewards.length : 0;
      const score = Math.max(35, Math.min(96, 96 - validation * 22 - Math.max(0, 1 - rewardCount) * 20));
      return { score, level: score >= 78 ? "ok" : score >= 62 ? "mid" : "low", pvp: "经济配置" };
    }
    if (this.activeModule === "redeem") {
      const issues = redeemDraftIssueCount(draft);
      const score = draft?.empty ? 0 : Math.max(30, 96 - issues * 22);
      return { score, level: score >= 78 ? "ok" : score >= 62 ? "mid" : "low", pvp: "实时礼包" };
    }
    if (this.activeModule === "publish") {
      if (draft.kind === "release") return { score: 92, level: "ok", pvp: "已发布" };
      const issues = this.releaseValidationRows(draft).filter((row) => row.level === "warn").length;
      const score = Math.max(30, 96 - issues * 18);
      return { score, level: score >= 78 ? "ok" : score >= 62 ? "mid" : "low", pvp: "发布配置" };
    }
    const load =
      (draft.marbleTrailLength || 1) * 7 +
      (draft.marbleTrailWidth || 1) * 8 +
      (draft.marbleTrailDensity || 1) * 10 +
      (draft.marbleTrailGlow || 1) * 6 +
      (draft.marbleTrailSparkRate || 1) * 5 +
      (draft.marbleTrailTurbulence || 0) * 4;
    const score = Math.max(20, Math.min(98, Math.round(115 - load)));
    return {
      score,
      level: score >= 78 ? "ok" : score >= 62 ? "mid" : "low",
      pvp: score >= 62 ? "可用" : "需降级",
    };
  }

  private validationRows(draft: any, perf: { score: number }) {
    if (this.activeModule === "users") {
      if (draft?.empty) {
        return [
          { level: this.usersLoading ? "ok" : "warn", title: "列表", text: this.usersLoading ? "正在加载" : "没有玩家" },
          { level: "ok", title: "来源", text: "服务器数据库" },
          { level: "ok", title: "操作", text: "资料和状态管理" },
        ];
      }
      return [
        { level: "ok", title: "来源", text: "服务器数据库" },
        draft.status === "active" ? { level: "ok", title: "状态", text: "账号正常" } : { level: "warn", title: "状态", text: userStatusLabels[draft.status] || draft.status },
        Number(draft.activeSessions || 0) > 0 ? { level: "ok", title: "会话", text: `${draft.activeSessions} 个在线会话` } : { level: "ok", title: "会话", text: "暂无在线会话" },
      ];
    }
    if (this.activeModule === "hero") {
      const sameMarble = draft.heroMarblePrimary === draft.heroMarbleSecondary;
      const routeIssues = (draft.routes || []).filter((route: any) => !route.name || !route.desc || Number(route.max) <= 0).length;
      return [
        draft.name && draft.role ? { level: "ok", title: "身份", text: "名称和定位完整" } : { level: "warn", title: "身份", text: "需要名称和定位" },
        sameMarble ? { level: "warn", title: "弹珠", text: "两枚弹珠重复" } : { level: "ok", title: "弹珠", text: "双弹珠配置正常" },
        routeIssues <= 0 ? { level: "ok", title: "养成", text: `${(draft.routes || []).length} 条路线` } : { level: "warn", title: "养成", text: `${routeIssues} 条路线需补全` },
      ];
    }
    if (this.activeModule === "skill") {
      const cooldown = Number(draft.skillCooldown) || 0;
      return [
        draft.skillName && draft.skillDesc ? { level: "ok", title: "文本", text: "技能名称和描述完整" } : { level: "warn", title: "文本", text: "需要补全名称和描述" },
        cooldown >= 10 ? { level: "ok", title: "冷却", text: `${Math.round(cooldown)} 秒` } : { level: "warn", title: "冷却", text: "冷却过短" },
        perf.score >= 62 ? { level: "ok", title: "预算", text: "战斗表现预算正常" } : { level: "warn", title: "预算", text: "强度或表现偏高" },
      ];
    }
    if (this.activeModule === "tactic") {
      const hasTierFamily = draft.tacticKind !== "tiered" || Boolean(draft.tacticFamilyId);
      const stacksOk = draft.tacticInfiniteStacks || Number(draft.tacticMaxStacks) >= 1;
      const coreOk = !draft.tacticCoreType || draft.tacticCoreType === "none" || Boolean(draft.tacticCoreId);
      return [
        draft.name && draft.desc ? { level: "ok", title: "文本", text: "名称和描述完整" } : { level: "warn", title: "文本", text: "需要补全名称和描述" },
        hasTierFamily ? { level: "ok", title: "流派", text: draft.tacticFamilyId || "无流派" } : { level: "warn", title: "流派", text: "升级链需要流派 ID" },
        coreOk ? { level: "ok", title: "核心", text: draft.tacticCoreType && draft.tacticCoreType !== "none" ? `${tacticCoreTypeLabels[draft.tacticCoreType]} · ${draft.tacticCoreId}` : "非核心卡" } : { level: "warn", title: "核心", text: "核心卡需要填写核心 ID" },
        stacksOk && perf.score >= 62 ? { level: "ok", title: "投放", text: `${Number(draft.tacticWeight || 1).toFixed(2)} 权重` } : { level: "warn", title: "投放", text: "叠加或权重需检查" },
      ];
    }
    if (this.activeModule === "enemy") {
      const hp = Number(draft.enemyHp) || 0;
      const speed = Number(draft.enemySpeed) || 0;
      const rewardPressure = (Number(draft.enemyCoins) || 0) + (Number(draft.enemyExp) || 0);
      return [
        draft.name && normalizeColor(draft.color) ? { level: "ok", title: "身份", text: "名称和颜色完整" } : { level: "warn", title: "身份", text: "需要名称和颜色" },
        hp > 0 && speed > 0 ? { level: "ok", title: "战斗", text: `HP ${formatNumber(hp)} / 速度 ${Math.round(speed)}` } : { level: "warn", title: "战斗", text: "血量和速度必须大于 0" },
        perf.score >= 62 ? { level: "ok", title: "收益", text: `收益 ${formatNumber(rewardPressure)}` } : { level: "warn", title: "收益", text: "威胁与收益不匹配" },
      ];
    }
    if (this.activeModule === "stage") {
      const enemies = stageCsv(draft.stageEnemyBias).filter((id) => enemyConfigs[id as EnemyType]);
      const events = stageEventLinesToEvents(draft.stageWaveEvents);
      return [
        draft.name && draft.objective ? { level: "ok", title: "目标", text: "名称和目标完整" } : { level: "warn", title: "目标", text: "需要名称和目标" },
        enemies.length >= 2 ? { level: "ok", title: "敌人池", text: `${enemies.length} 种怪物` } : { level: "warn", title: "敌人池", text: "至少配置 2 种怪物" },
        events.length >= 3 ? { level: "ok", title: "波次", text: `${events.length} 个关键事件` } : { level: "warn", title: "波次", text: "建议至少 3 个关键事件" },
      ];
    }
    if (this.activeModule === "character") {
      const character = characters.find((item) => item.id === draft.targetId);
      return [
        character ? { level: "ok", title: "角色", text: `绑定 ${character.name}` } : { level: "warn", title: "角色", text: "目标角色不存在" },
        { level: "ok", title: "数值", text: "不包含战斗属性" },
        perf.score >= 62 ? { level: "ok", title: "头像", text: "PVP 与资料卡可用" } : { level: "warn", title: "头像", text: "光效偏高" },
      ];
    }
    if (this.activeModule === "gacha") {
      const sum = this.gachaRateSum(draft);
      const summary = this.gachaSummary(draft);
      return [
        sum === 100 ? { level: "ok", title: "概率", text: "合计 100%" } : { level: "warn", title: "概率", text: `当前合计 ${sum}%` },
        draft.pityLegendary > draft.pityEpic ? { level: "ok", title: "保底", text: "保底顺序正确" } : { level: "warn", title: "保底", text: "传说保底需大于史诗" },
        summary.enabled >= 3 ? { level: "ok", title: "内容", text: `启用 ${summary.enabled} 项` } : { level: "warn", title: "内容", text: "启用内容过少" },
      ];
    }
    if (this.activeModule === "shop") {
      const rewards = Array.isArray(draft.rewards) ? draft.rewards : [];
      const price = Math.round(Number(draft.priceAmount) || 0);
      return [
        rewards.length > 0 ? { level: "ok", title: "奖励", text: `${rewards.length} 个奖励项` } : { level: "warn", title: "奖励", text: "至少配置 1 个奖励" },
        Number(draft.stock) > 0 ? { level: "ok", title: "库存", text: `${Math.round(Number(draft.stock) || 0)} 件` } : { level: "warn", title: "库存", text: "库存必须大于 0" },
        draft.category === "arena" && draft.priceCurrency !== "pvpCoins"
          ? { level: "warn", title: "货币", text: "竞技货架建议使用竞技币" }
          : { level: "ok", title: "价格", text: price <= 0 ? "免费领取" : `${currencyLabels[draft.priceCurrency] || "货币"} ${price}` },
      ];
    }
    if (this.activeModule === "redeem") {
      if (draft?.empty) {
        return [
          { level: this.redeemLoading ? "ok" : "warn", title: "列表", text: this.redeemLoading ? "正在加载" : "没有兑换码" },
          { level: "ok", title: "来源", text: "服务器数据库" },
          { level: "ok", title: "操作", text: "实时生效" },
        ];
      }
      const rewards = Array.isArray(draft.rewards) ? draft.rewards : [];
      const maxUses = redeemMaxUsesValue(draft.maxUses);
      const used = Math.max(0, Math.round(Number(draft.usedCount) || 0));
      const start = draft.startsAt ? new Date(draft.startsAt).getTime() : 0;
      const end = draft.endsAt ? new Date(draft.endsAt).getTime() : 0;
      const timeOk = (!draft.startsAt || Number.isFinite(start)) && (!draft.endsAt || Number.isFinite(end)) && (!start || !end || start < end);
      return [
        draft.code && draft.title ? { level: "ok", title: "基础", text: "码和标题完整" } : { level: "warn", title: "基础", text: "需要兑换码和标题" },
        rewards.length > 0 ? { level: "ok", title: "奖励", text: `${rewards.length} 个奖励项` } : { level: "warn", title: "奖励", text: "至少配置 1 个奖励" },
        !maxUses || used <= maxUses ? { level: "ok", title: "库存", text: maxUses ? `剩余 ${Math.max(0, maxUses - used)}` : "不限量" } : { level: "warn", title: "库存", text: "领取次数已超过上限" },
        timeOk ? { level: "ok", title: "时间", text: redeemTimeWindowLabel(draft) } : { level: "warn", title: "时间", text: "有效期配置不正确" },
      ];
    }
    if (this.activeModule === "publish") return this.releaseValidationRows(draft);
    return [
      { level: "ok", title: "结构", text: "字段完整，可导出" },
      perf.score >= 62 ? { level: "ok", title: "性能", text: "预算正常" } : { level: "warn", title: "性能", text: "建议降低密度或发光" },
      (draft.marbleTrailLength || 1) > 2.1 && (draft.marbleTrailWidth || 1) > 1.45
        ? { level: "warn", title: "可读性", text: "长且宽，可能遮挡战场" }
        : { level: "ok", title: "可读性", text: "适合战斗场景" },
    ];
  }

  private exportModalHtml(draft: any) {
    return `
      <div class="admin-export-modal" role="dialog" aria-label="导出配置">
        <section class="admin-export-panel">
          <button type="button" class="admin-close" data-admin-action="closeExport">×</button>
          <div class="admin-panel-head">
            <strong>配置 JSON</strong>
            <span>${escapeHtml(draft.id)}</span>
          </div>
          <pre>${escapeHtml(this.exportJson(draft))}</pre>
          <div class="admin-actions">
            <button type="button" data-admin-action="closeExport">关闭</button>
            <button class="primary" type="button" data-admin-action="copyExport">复制 JSON</button>
          </div>
        </section>
      </div>
    `;
  }

  private exportJson(draft: any) {
    if (this.activeModule === "hero") return this.exportHeroJson(draft);
    if (this.activeModule === "skill") return this.exportSkillJson(draft);
    if (this.activeModule === "tactic") return this.exportTacticJson(draft);
    if (this.activeModule === "enemy") return this.exportEnemyJson(draft);
    if (this.activeModule === "stage") return this.exportStageJson(draft);
    if (this.activeModule === "character") return this.exportCharacterJson(draft);
    if (this.activeModule === "gacha") return this.exportGachaJson(draft);
    if (this.activeModule === "shop") return this.exportShopJson(draft);
    if (this.activeModule === "redeem") return this.exportRedeemJson(draft);
    if (this.activeModule === "users") return JSON.stringify(draft, null, 2);
    if (this.activeModule === "publish") return this.exportPublishJson(draft);
    return this.exportMarbleJson(draft);
  }

  private exportMarbleJson(draft: any) {
    return JSON.stringify(
      {
        id: draft.id,
        type: draft.type,
        targetId: draft.targetId,
        rarity: draft.rarity,
        name: draft.name,
        desc: draft.desc,
        theme: draft.theme,
        color: draft.color,
        accentColor: draft.accentColor,
        visualLabel: draft.visualLabel,
        assetKeys: draft.assetKeys || [],
        effectKeys: draft.effectKeys || [],
        marbleShape: draft.marbleShape,
        marbleTrailStyle: draft.marbleTrailStyle,
        marbleTrailColor: draft.marbleTrailColor,
        marbleTrailAccentColor: draft.marbleTrailAccentColor,
        marbleTrailHighlightColor: draft.marbleTrailHighlightColor,
        marbleTrailLength: Number(draft.marbleTrailLength),
        marbleTrailWidth: Number(draft.marbleTrailWidth),
        marbleTrailAnimation: draft.marbleTrailAnimation,
        marbleTrailDensity: Number(draft.marbleTrailDensity),
        designerTrailTuning: {
          opacity: Number(draft.marbleTrailOpacity),
          glow: Number(draft.marbleTrailGlow),
          turbulence: Number(draft.marbleTrailTurbulence),
          fade: Number(draft.marbleTrailFade),
          segmentSpacing: Number(draft.marbleTrailSegmentSpacing),
          sparkRate: Number(draft.marbleTrailSparkRate),
        },
      },
      null,
      2,
    );
  }

  private exportHeroJson(draft: any) {
    return JSON.stringify(
      {
        id: draft.id,
        name: draft.name,
        role: draft.role,
        rarity: draft.rarity,
        color: draft.color,
        marbles: [draft.heroMarblePrimary || "basic", draft.heroMarbleSecondary || "split"],
        skillName: draft.skillName,
        skillDesc: draft.skillDesc,
        skillCooldown: Number(draft.skillCooldown),
        passives: (draft.passives || []).map((passive: any, index: number) => ({
          id: passive.id || `${draft.id}_passive_${index + 1}`,
          name: passive.name,
          unlockLevel: Math.max(1, Math.round(Number(passive.unlockLevel) || 1)),
          desc: passive.desc,
        })),
        ...(this.exportHeroUnlock(draft) ? { unlock: this.exportHeroUnlock(draft) } : {}),
        routes: (draft.routes || []).map((route: any, index: number) => ({
          id: route.id || `${draft.id}_route_${index + 1}`,
          name: route.name,
          focus: route.focus,
          desc: route.desc,
          max: Math.max(1, Math.round(Number(route.max) || 1)),
          baseCost: Math.max(1, Math.round(Number(route.baseCost) || 1)),
          growth: Number(route.growth) || 1.45,
        })),
      },
      null,
      2,
    );
  }

  private exportHeroUnlock(draft: any) {
    if (!draft.heroUnlockType || draft.heroUnlockType === "none") return null;
    if (draft.heroUnlockType === "stage") {
      return {
        type: "stage",
        stage: Math.max(1, Math.round(Number(draft.heroUnlockStage) || 1)),
        desc: draft.heroUnlockDesc || "通关指定主线后解锁",
      };
    }
    if (draft.heroUnlockType === "wins") {
      return {
        type: "wins",
        wins: Math.max(1, Math.round(Number(draft.heroUnlockWins) || 1)),
        desc: draft.heroUnlockDesc || "完成指定通关次数后解锁",
      };
    }
    if (draft.heroUnlockType === "collectible") {
      return {
        type: "collectible",
        collectible: draft.heroUnlockCollectible || "void_lens",
        amount: Math.max(1, Math.round(Number(draft.heroUnlockAmount) || 1)),
        desc: draft.heroUnlockDesc || "收集指定收藏品后解锁",
      };
    }
    return null;
  }

  private exportSkillJson(draft: any) {
    return JSON.stringify(
      {
        characterId: draft.targetId || draft.id,
        skillName: draft.skillName,
        skillDesc: draft.skillDesc,
        skillCooldown: Number(draft.skillCooldown),
        designerSkillTuning: {
          effectType: draft.skillEffectType || "buff",
          targeting: draft.skillTargeting || "self",
          duration: Number(draft.skillDuration) || 0,
          power: Number(draft.skillPower) || 1,
          radius: Number(draft.skillRadius) || 0,
          projectileCount: Math.round(Number(draft.skillProjectileCount) || 0),
          control: Number(draft.skillControl) || 0,
          goldGain: Math.round(Number(draft.skillGoldGain) || 0),
          fxPreset: draft.skillFxPreset || "base",
          previewIntensity: Number(draft.skillPreviewIntensity) || 1,
          assetKey: draft.skillAssetKey || "",
          soundKey: draft.skillSoundKey || "",
        },
      },
      null,
      2,
    );
  }

  private exportTacticJson(draft: any) {
    const unlock = exportTacticUnlock(draft);
    const maxStacks = draft.tacticInfiniteStacks ? "infinite" : Math.max(1, Math.round(Number(draft.tacticMaxStacks) || 1));
    return JSON.stringify(
      {
        id: draft.id,
        name: draft.name,
        rarity: draft.rarity,
        tag: draft.tag,
        desc: draft.desc,
        kind: draft.tacticKind || "stackable",
        effectType: draft.tacticEffectType || "attribute",
        source: draft.tacticSource || "global",
        ...(draft.tacticFamilyId ? { familyId: draft.tacticFamilyId } : {}),
        ...(draft.tacticTier && draft.tacticTier !== "none" ? { tier: draft.tacticTier } : {}),
        ...(draft.tacticCoreType && draft.tacticCoreType !== "none"
          ? {
              core: {
                type: draft.tacticCoreType,
                coreId: draft.tacticCoreId || draft.id,
                ...(draft.tacticCoreExclusiveGroup ? { exclusiveGroup: draft.tacticCoreExclusiveGroup } : {}),
              },
            }
          : {}),
        maxStacks,
        ...(unlock ? { unlock } : {}),
        weight: Number(draft.tacticWeight) || 1,
        designerTacticTuning: {
          enabled: draft.tacticEnabled !== false,
          applyRef: draft.tacticApplyRef || draft.id,
        },
      },
      null,
      2,
    );
  }

  private exportEnemyJson(draft: any) {
    return JSON.stringify(
      {
        type: draft.type,
        name: draft.name,
        color: normalizeColor(draft.color),
        hp: Math.max(1, Math.round(Number(draft.enemyHp) || 1)),
        speed: Math.max(1, Math.round(Number(draft.enemySpeed) || 1)),
        radius: Math.max(8, Math.round(Number(draft.enemyRadius) || 8)),
        exp: Math.max(0, Math.round(Number(draft.enemyExp) || 0)),
        coins: Math.max(0, Math.round(Number(draft.enemyCoins) || 0)),
        ...(Number(draft.enemyArmor) > 0 ? { armor: Number(draft.enemyArmor) } : {}),
        designerEnemyTuning: {
          enabled: draft.enemyEnabled !== false,
          pvpEnabled: draft.enemyPvpEnabled !== false,
          role: draft.enemyRole || enemyRoleForType(draft.type),
          behavior: draft.enemyBehavior || enemyBehaviorForType(draft.type),
          spawnWeight: Number(draft.enemySpawnWeight) || 1,
          threatLevel: Number(draft.enemyThreatLevel) || enemyThreatLevel(draft),
          stageHint: draft.enemyStageHint || "",
          counterHint: draft.enemyCounterHint || "",
        },
      },
      null,
      2,
    );
  }

  private exportStageJson(draft: any) {
    const rewardBias = exportStageRewardBias(draft);
    const chapter = Math.max(1, Math.round(Number(draft.stageChapter) || Number(draft.chapter) || 1));
    const stageNo = Math.max(1, Math.round(Number(draft.stageNo) || Number(draft.stage) || 1));
    return JSON.stringify(
      {
        id: draft.id || `c${chapter}s${stageNo}`,
        index: Math.max(1, Math.round(Number(draft.stageIndex) || Number(draft.index) || 1)),
        chapter,
        stage: stageNo,
        name: draft.name,
        theme: draft.theme,
        objective: draft.objective,
        enemyBias: stageEnemyCsv(draft.stageEnemyBias),
        featuredEnemies: stageEnemyCsv(draft.stageFeaturedEnemies),
        hpMultiplier: Number(draft.stageHpMultiplier) || 1,
        speedMultiplier: Number(draft.stageSpeedMultiplier) || 1,
        densityMultiplier: Number(draft.stageDensityMultiplier) || 1,
        waveEvents: stageEventLinesToEvents(draft.stageWaveEvents),
        ...(draft.stageHasBoss
          ? {
              boss: {
                name: draft.stageBossName || `${draft.name}首领`,
                enemyType: "boss",
                desc: draft.stageBossDesc || "关卡首领。",
                skills: stageCsv(draft.stageBossSkills),
              },
            }
          : {}),
        rewardBias,
        designerStageTuning: {
          difficulty: stageDifficultyScore(draft),
          type: stageTypeBadge(draft),
        },
      },
      null,
      2,
    );
  }

  private exportCharacterJson(draft: any) {
    return JSON.stringify(
      {
        id: draft.id,
        type: "character",
        targetId: draft.targetId,
        rarity: draft.rarity,
        name: draft.name,
        desc: draft.desc,
        theme: draft.theme,
        color: draft.color,
        accentColor: draft.accentColor,
        visualLabel: draft.visualLabel,
        assetKeys: [draft.characterAssetPortrait, draft.characterAssetBattle].filter(Boolean),
        effectKeys: [draft.characterEffectSkill].filter(Boolean),
        designerOutfitTuning: {
          showcaseMotion: draft.characterShowcaseMotion,
          skillFxPreset: draft.characterSkillFxPreset,
          skillFxIntensity: Number(draft.characterSkillFxIntensity),
          avatarGlow: Number(draft.characterAvatarGlow),
          showcaseGlow: Number(draft.characterShowcaseGlow),
          shopTag: draft.characterShopTag,
        },
      },
      null,
      2,
    );
  }

  private exportGachaJson(draft: any) {
    const items = this.gachaPoolItems(draft);
    const enabledItemIds = items.filter((item) => this.poolItemTuning(draft, item.id).enabled).map((item) => item.id);
    const upItemIds = items.filter((item) => this.poolItemTuning(draft, item.id).up).map((item) => item.id);
    const weights = Object.fromEntries(items.map((item) => [item.id, Number(this.poolItemTuning(draft, item.id).weight)]));
    return JSON.stringify(
      {
        id: draft.id,
        kind: draft.kind,
        name: draft.name,
        desc: draft.desc,
        ticket: draft.ticket,
        singleCrystalCost: Number(draft.singleCrystalCost),
        pity: {
          epic: Math.round(Number(draft.pityEpic)),
          legendary: Math.round(Number(draft.pityLegendary)),
        },
        itemIds: enabledItemIds,
        designerGachaTuning: {
          rates: {
            rare: Number(draft.rateRare),
            epic: Number(draft.rateEpic),
            legendary: Number(draft.rateLegendary),
          },
          featuredTheme: draft.featuredTheme,
          upItemIds,
          weights,
        },
      },
      null,
      2,
    );
  }

  private exportShopJson(draft: any) {
    const unlock = exportShopUnlock(draft);
    return JSON.stringify(
      {
        id: draft.id,
        category: draft.category,
        name: draft.name,
        desc: draft.desc,
        price: {
          currency: draft.priceCurrency,
          amount: Math.max(0, Math.round(Number(draft.priceAmount) || 0)),
        },
        stock: Math.max(1, Math.round(Number(draft.stock) || 1)),
        refresh: draft.refresh,
        ...(unlock ? { unlock } : {}),
        rewards: (draft.rewards || []).map((reward: any) => exportShopReward(reward)).filter(Boolean),
        designerShopTuning: {
          enabled: draft.shopEnabled !== false,
          featured: Boolean(draft.shopFeatured),
          priority: Math.max(1, Math.round(Number(draft.shopPriority) || 1)),
          badge: draft.shopBadge || this.shopBadgeForDraft(draft),
        },
      },
      null,
      2,
    );
  }

  private exportRedeemJson(draft: any) {
    return JSON.stringify(
      {
        code: String(draft.code || "").trim().replace(/\s+/g, "").toUpperCase(),
        title: String(draft.title || "").trim(),
        status: draft.status || "draft",
        startsAt: draft.startsAt || null,
        endsAt: draft.endsAt || null,
        maxUses: redeemMaxUsesValue(draft.maxUses),
        rewards: (draft.rewards || []).map((reward: any) => exportShopReward(reward)).filter(Boolean),
      },
      null,
      2,
    );
  }

  private exportPublishJson(draft: any) {
    return JSON.stringify(draft.kind === "release" ? draft.bundle || draft : this.buildReleaseBundle(draft), null, 2);
  }

  private gachaPoolItems(draft: any) {
    const poolId = draft.kind === "character" ? "character" : "marble";
    return cosmeticsForPool(poolId);
  }

  private poolItemTuning(draft: any, itemId: string) {
    draft.itemTuning ||= {};
    draft.itemTuning[itemId] ||= { enabled: true, up: false, weight: 1 };
    return draft.itemTuning[itemId];
  }

  private gachaSummary(draft: any) {
    const items = this.gachaPoolItems(draft);
    const enabled = items.filter((item) => this.poolItemTuning(draft, item.id).enabled);
    return {
      total: items.length,
      enabled: enabled.length,
      up: items.filter((item) => this.poolItemTuning(draft, item.id).up).length,
      legendary: enabled.filter((item) => item.rarity === "legendary").length,
    };
  }

  private gachaRateSum(draft: any) {
    return Math.round((Number(draft.rateRare) || 0) + (Number(draft.rateEpic) || 0) + (Number(draft.rateLegendary) || 0));
  }

  private rateBarHtml(label: string, value: number, color: string) {
    return `
      <div class="admin-rate-bar" style="--rate-color:${color};--rate-width:${clampNumber(Number(value) || 0, 0, 100)}%">
        <span>${label}</span>
        <strong>${Number(value).toFixed(0)}%</strong>
        <i></i>
      </div>
    `;
  }

  private shopSummary(draft: any) {
    const price = Math.round(Number(draft.priceAmount) || 0);
    const rewardCount = Array.isArray(draft.rewards) ? draft.rewards.length : 0;
    return {
      rewardCount,
      economy: shopDraftIssueCount(draft) > 0 ? "需检查" : "正常",
      priceBand: price <= 0 ? "免费" : price >= 500 ? "高价" : price >= 100 ? "中价" : "低价",
      unlock: draft.unlockType === "none" || !draft.unlockType ? "无" : unlockTypeLabels[draft.unlockType] || "门槛",
    };
  }

  private heroUnlockLabel(draft: any) {
    if (!draft.heroUnlockType || draft.heroUnlockType === "none") return "初始";
    if (draft.heroUnlockType === "stage") return `主线 ${Math.round(Number(draft.heroUnlockStage) || 1)}`;
    if (draft.heroUnlockType === "wins") return `${Math.round(Number(draft.heroUnlockWins) || 1)} 胜`;
    if (draft.heroUnlockType === "collectible") {
      return `${collectibleConfigs[draft.heroUnlockCollectible]?.name || "收藏品"} x${Math.round(Number(draft.heroUnlockAmount) || 1)}`;
    }
    return "条件";
  }

  private publishItems() {
    return [
      { id: "candidate", kind: "candidate", name: "发布候选" },
      ...this.releaseRecordsForUi().map((release: any) => ({ ...release, kind: "release", name: release.title || release.configVersion })),
    ];
  }

  private releaseRecordsForUi() {
    const local = loadAdminReleases();
    const records = this.configReleasesLoaded || this.configReleases.length ? this.configReleases : local;
    const seen = new Set(records.map((item: any) => item.id));
    return [
      ...records,
      ...local.filter((item: any) => item?.id && !seen.has(item.id)).map((item: any) => ({ ...item, status: item.status || "local" })),
    ];
  }

  private changedDraftsForModule(module: Exclude<AdminModule, "publish" | "users">) {
    return Object.entries(this.drafts)
      .filter(([key]) => key.startsWith(`${module}:`) && this.touched[key])
      .map(([key, draft]) => ({ key, id: key.slice(module.length + 1), draft }));
  }

  private releaseSummary(draft: any) {
    if (draft.kind === "release") {
      return {
        changed: draft.bundle?.summary?.totalItems || 0,
        modules: draft.bundle?.summary?.modules || 0,
        risk: "已发布",
      };
    }
    const bundle = this.buildReleaseBundle(draft);
    return {
      changed: bundle.summary.totalItems,
      modules: bundle.summary.modules,
      risk: this.releaseValidationRows(draft).some((row) => row.level === "warn") ? "需检查" : "正常",
    };
  }

  private releaseValidationRows(draft: any) {
    if (draft.kind === "release") {
      return [
        { level: "ok", title: "版本", text: draft.configVersion || "已发布" },
        { level: "ok", title: "环境", text: releaseEnvLabels[draft.environment] || draft.environment || "环境" },
        { level: "ok", title: "回滚", text: "可生成回滚候选" },
      ];
    }
    const bundle = this.buildReleaseBundle(draft);
    return [
      bundle.summary.totalItems > 0 ? { level: "ok", title: "内容", text: `${bundle.summary.totalItems} 个草稿` } : { level: "warn", title: "内容", text: "没有可发布草稿" },
      draft.releaseSchemaChecked && draft.releaseEconomyChecked && draft.releaseVisualChecked
        ? { level: "ok", title: "校验", text: "结构、经济和预览已确认" }
        : { level: "warn", title: "校验", text: "请确认结构、经济和视觉预览" },
      draft.releaseEnv !== "production" || draft.releaseProdConfirmed
        ? { level: "ok", title: "环境", text: releaseEnvLabels[draft.releaseEnv] || "测试环境" }
        : { level: "warn", title: "环境", text: "正式环境需要二次确认" },
    ];
  }

  private buildReleaseBundle(draft: any) {
    if (draft.rollbackBundle) {
      return {
        ...draft.rollbackBundle,
        configVersion: draft.configVersion || nextConfigVersion(),
        title: draft.releaseTitle || `回滚至 ${draft.rollbackFrom || "历史版本"}`,
        environment: draft.releaseEnv || draft.rollbackBundle.environment || "test",
        mode: draft.releaseMode || "now",
        grayPercent: Math.max(1, Math.min(100, Math.round(Number(draft.releaseGrayPercent) || 100))),
        scheduledAt: null,
        releaseNotes: draft.releaseNotes || `回滚来源：${draft.rollbackFrom || ""}`,
        createdAt: new Date().toISOString(),
        author: this.auth.admin?.username || "admin",
        rollbackFrom: draft.rollbackFrom || draft.rollbackBundle.configVersion,
      };
    }
    const modules: Record<string, any> = {};
    let totalItems = 0;
    for (const module of contentModuleIds) {
      const includeField = `releaseInclude${capitalize(module)}`;
      if (draft[includeField] === false) continue;
      const items = this.changedDraftsForModule(module).map(({ id, draft: itemDraft }) => ({
        id,
        config: this.exportDraftObject(module, itemDraft),
      }));
      if (items.length <= 0) continue;
      modules[module] = {
        label: moduleLabels[module].nav,
        items,
      };
      totalItems += items.length;
    }
    const createdAt = new Date().toISOString();
    return {
      configVersion: draft.configVersion || nextConfigVersion(),
      title: draft.releaseTitle || "内容配置发布",
      environment: draft.releaseEnv || "test",
      mode: draft.releaseMode || "now",
      grayPercent: Math.max(1, Math.min(100, Math.round(Number(draft.releaseGrayPercent) || 10))),
      scheduledAt:
        draft.releaseMode === "scheduled"
          ? new Date(Date.now() + Math.max(1, Number(draft.releaseScheduleDelayHours) || 1) * 60 * 60 * 1000).toISOString()
          : null,
      releaseNotes: draft.releaseNotes || "",
      createdAt,
      author: this.auth.admin?.username || "admin",
      summary: {
        modules: Object.keys(modules).length,
        totalItems,
        byModule: Object.fromEntries(Object.entries(modules).map(([module, payload]) => [module, payload.items.length])),
      },
      checks: {
        schema: Boolean(draft.releaseSchemaChecked),
        economy: Boolean(draft.releaseEconomyChecked),
        visual: Boolean(draft.releaseVisualChecked),
        productionConfirmed: Boolean(draft.releaseProdConfirmed),
      },
      modules,
    };
  }

  private exportDraftObject(module: Exclude<AdminModule, "publish" | "users">, draft: any) {
    if (module === "hero") return JSON.parse(this.exportHeroJson(draft));
    if (module === "skill") return JSON.parse(this.exportSkillJson(draft));
    if (module === "tactic") return JSON.parse(this.exportTacticJson(draft));
    if (module === "enemy") return JSON.parse(this.exportEnemyJson(draft));
    if (module === "stage") return JSON.parse(this.exportStageJson(draft));
    if (module === "character") return JSON.parse(this.exportCharacterJson(draft));
    if (module === "gacha") return JSON.parse(this.exportGachaJson(draft));
    if (module === "shop") return JSON.parse(this.exportShopJson(draft));
    return JSON.parse(this.exportMarbleJson(draft));
  }

  private buildReleaseCandidate() {
    if (this.activeModule !== "publish") return;
    const draft = this.draftFor("publish", "candidate");
    if (draft.kind === "release") return;
    this.syncDraftFromForm();
    this.touched[this.draftKey("publish", "candidate")] = true;
    saveAdminDraftState(this.drafts, this.touched);
    const bundle = this.buildReleaseBundle(draft);
    this.notice = `已生成候选配置包：${bundle.summary.totalItems} 个配置项`;
    this.render();
  }

  private async publishRelease() {
    if (this.activeModule !== "publish") return;
    const draft = this.draftFor("publish", "candidate");
    if (draft.kind === "release") return;
    this.syncDraftFromForm();
    const warnings = this.releaseValidationRows(draft).filter((row) => row.level === "warn");
    if (warnings.length) {
      this.notice = `发布前需要处理：${warnings.map((row) => row.text).join(" / ")}`;
      this.render();
      return;
    }
    const bundle = this.buildReleaseBundle(draft);
    this.busy = true;
    this.notice = "正在发布到服务器...";
    this.render();
    try {
      const response = await this.request<{ release: any }>("/admin/config-releases", {
        method: "POST",
        body: { bundle },
      });
      const record = { ...response.release, kind: "release", bundle: response.release?.bundle || bundle };
      const releases = loadAdminReleases();
      saveAdminReleases([record, ...releases.filter((item: any) => item.id !== record.id)].slice(0, 30));
      this.configReleases = [record, ...this.configReleases.filter((item) => item.id !== record.id)].slice(0, 30);
      this.configReleasesLoaded = true;
      this.notice = `${releaseEnvLabels[bundle.environment] || "环境"}已发布版本 ${bundle.configVersion}`;
      this.selectedIds.publish = record.id;
      this.exportOpen = false;
    } catch (error) {
      this.notice = error instanceof Error ? `发布失败：${error.message}` : "发布失败";
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private rollbackRelease() {
    if (this.activeModule !== "publish") return;
    const selected = this.selectedItem();
    if (selected?.kind !== "release") return;
    const draft = this.draftFor("publish", "candidate");
    Object.assign(draft, {
      kind: "candidate",
      name: "发布候选",
      releaseTitle: `回滚至 ${selected.configVersion}`,
      configVersion: nextConfigVersion(),
      releaseEnv: selected.environment || "test",
      releaseMode: "now",
      releaseGrayPercent: 100,
      releaseScheduleDelayHours: 1,
      releaseNotes: `回滚来源：${selected.configVersion}`,
      releaseIncludeMarble: true,
      releaseIncludeHero: true,
      releaseIncludeSkill: true,
      releaseIncludeTactic: true,
      releaseIncludeEnemy: true,
      releaseIncludeStage: true,
      releaseIncludeCharacter: true,
      releaseIncludeGacha: true,
      releaseIncludeShop: true,
      releaseSchemaChecked: true,
      releaseEconomyChecked: true,
      releaseVisualChecked: true,
      releaseProdConfirmed: selected.environment !== "production",
      rollbackFrom: selected.configVersion,
      rollbackBundle: selected.bundle,
    });
    this.touched[this.draftKey("publish", "candidate")] = true;
    saveAdminDraftState(this.drafts, this.touched);
    this.selectedIds.publish = "candidate";
    this.notice = `已基于 ${selected.configVersion} 生成回滚候选`;
    this.render();
  }

  private shopBadgeForDraft(draft: any) {
    if (draft.shopBadge) return draft.shopBadge;
    if (draft.priceAmount <= 0) return "免";
    if (draft.category === "arena") return "竞";
    if (draft.category === "growth") return "育";
    if (draft.category === "crystal") return "晶";
    if (draft.category === "bundles") return "包";
    return "补";
  }

  private shopColorForDraft(draft: any) {
    if (draft.priceCurrency === "pvpCoins") return "#54c7ff";
    if (draft.priceCurrency === "energyCrystals") return "#b68cff";
    const reward = Array.isArray(draft.rewards) ? draft.rewards[0] : null;
    if (reward?.type === "marbleShard" && marbleConfigs[reward.target]) return marbleConfigs[reward.target].color;
    if (reward?.type === "gem" && gemConfigs[reward.target]) return gemConfigs[reward.target].color;
    if (reward?.type === "characterUnlock") return characters.find((item) => item.id === reward.target)?.color || "#f6c95f";
    if (reward?.type === "pvpCoins") return "#54c7ff";
    if (reward?.type === "energyCrystals") return "#b68cff";
    return "#f6c95f";
  }

  private shopAccentForDraft(draft: any) {
    if (draft.category === "arena") return "#61e6a8";
    if (draft.category === "bundles") return "#ffd86b";
    if (draft.category === "crystal") return "#7de2ff";
    return "#ffffff";
  }

  private mountPreview() {
    this.stopPreview();
    const loop = () => {
      this.paintPreview();
      this.previewFrame = requestAnimationFrame(loop);
    };
    this.previewFrame = requestAnimationFrame(loop);
  }

  private stopPreview() {
    if (this.previewFrame) cancelAnimationFrame(this.previewFrame);
    this.previewFrame = 0;
  }

  private paintPreview() {
    const canvas = this.root.querySelector<HTMLCanvasElement>("[data-admin-preview]");
    if (!canvas || this.activeModule !== "marble") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(420, Math.round(rect.width || 520));
    const height = Math.max(300, Math.round(rect.height || 360));
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawTrailPreview(ctx, width, height, this.draftFor("marble", this.selectedIds.marble));
  }

  private async request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      auth?: boolean;
    } = {},
  ) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (options.auth !== false && this.auth.accessToken) headers.authorization = `Bearer ${this.auth.accessToken}`;
    const response = await fetch(`${API_BASE}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || `HTTP ${response.status}`);
    return data as T;
  }
}

function normalizeShopRewardDraft(reward: any) {
  if (!reward || !reward.type) return defaultShopReward("coins");
  if (reward.type === "marbleShard") return { type: reward.type, target: reward.marbleId || "basic", amount: reward.amount || 1 };
  if (reward.type === "gem") return { type: reward.type, target: reward.gemType || "power", level: reward.level || 1, amount: reward.amount || 1 };
  if (reward.type === "collectible") return { type: reward.type, target: reward.collectibleId || "scrap_shell", amount: reward.amount || 1 };
  if (reward.type === "characterUnlock") return { type: reward.type, target: reward.characterId || characters[0]?.id };
  if (reward.type === "ticket") return { type: reward.type, target: reward.ticketId || "insurance", amount: reward.amount || 1 };
  if (reward.type === "allMarbleCosmetics") return { type: reward.type };
  return { type: reward.type, amount: reward.amount || 1 };
}

function defaultShopReward(type: string) {
  if (type === "marbleShard") return { type, target: "basic", amount: 10 };
  if (type === "randomMarbleShard") return { type, amount: 10 };
  if (type === "gem") return { type, target: "power", level: 1, amount: 1 };
  if (type === "collectible") return { type, target: "scrap_shell", amount: 1 };
  if (type === "characterUnlock") return { type, target: characters[0]?.id || "engineer" };
  if (type === "ticket") return { type, target: "insurance", amount: 1 };
  if (type === "allMarbleCosmetics") return { type };
  if (type === "pvpCoins") return { type, amount: 100 };
  if (type === "energyCrystals") return { type, amount: 20 };
  return { type: "coins", amount: 100 };
}

function exportShopUnlock(draft: any) {
  if (!draft.unlockType || draft.unlockType === "none") return null;
  if (draft.unlockType === "pvpRank") {
    return {
      type: "pvpRank",
      mode: draft.unlockRankMode || "duel",
      tier: draft.unlockRankTier || "silver",
      division: Math.max(1, Math.min(3, Math.round(Number(draft.unlockRankDivision) || 3))),
      desc: draft.unlockDesc || `${pvpRankTierLabels[draft.unlockRankTier] || "段位"}解锁`,
    };
  }
  return {
    type: draft.unlockType,
    value: Math.max(1, Math.round(Number(draft.unlockValue) || 1)),
    desc: draft.unlockDesc || "达成条件后解锁",
  };
}

function exportShopReward(reward: any) {
  if (!reward || !reward.type) return null;
  const amount = Math.max(1, Math.round(Number(reward.amount) || 1));
  if (reward.type === "coins" || reward.type === "pvpCoins" || reward.type === "energyCrystals" || reward.type === "randomMarbleShard") {
    return { type: reward.type, amount };
  }
  if (reward.type === "marbleShard") return { type: "marbleShard", marbleId: reward.target || "basic", amount };
  if (reward.type === "gem") return { type: "gem", gemType: reward.target || "power", level: Math.max(1, Math.round(Number(reward.level) || 1)), amount };
  if (reward.type === "collectible") return { type: "collectible", collectibleId: reward.target || "scrap_shell", amount };
  if (reward.type === "characterUnlock") return { type: "characterUnlock", characterId: reward.target || characters[0]?.id || "engineer" };
  if (reward.type === "ticket") return { type: "ticket", ticketId: reward.target || "insurance", amount };
  if (reward.type === "allMarbleCosmetics") return { type: "allMarbleCosmetics" };
  return null;
}

function shopRewardDraftLabel(reward: any) {
  if (!reward) return "空奖励";
  const amount = Math.max(1, Math.round(Number(reward.amount) || 1));
  if (reward.type === "coins") return `金币 x${amount}`;
  if (reward.type === "pvpCoins") return `竞技币 x${amount}`;
  if (reward.type === "energyCrystals") return `能源晶体 x${amount}`;
  if (reward.type === "randomMarbleShard") return `随机弹珠碎片 x${amount}`;
  if (reward.type === "marbleShard") return `${marbleConfigs[reward.target]?.name || "弹珠"}碎片 x${amount}`;
  if (reward.type === "gem") return `${gemConfigs[reward.target]?.name || "宝石"} Lv.${reward.level || 1} x${amount}`;
  if (reward.type === "collectible") return `${collectibleConfigs[reward.target]?.name || "收藏品"} x${amount}`;
  if (reward.type === "characterUnlock") return `${characters.find((item) => item.id === reward.target)?.name || "角色"}解锁`;
  if (reward.type === "ticket") return `${ticketLabels[reward.target] || "道具券"} x${amount}`;
  if (reward.type === "allMarbleCosmetics") return "弹珠幻化全套";
  return rewardTypeLabels[reward.type] || "奖励";
}

function shopDraftIssueCount(draft: any) {
  let count = 0;
  if (!Array.isArray(draft.rewards) || draft.rewards.length <= 0) count += 1;
  if (Number(draft.stock) <= 0) count += 1;
  if (draft.category === "arena" && draft.priceCurrency !== "pvpCoins") count += 1;
  if (draft.unlockType === "pvpRank" && !draft.unlockRankTier) count += 1;
  return count;
}

function redeemMaxUsesValue(value: any) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const amount = Math.floor(Number(raw));
  return Number.isFinite(amount) && amount > 0 ? Math.min(1_000_000, amount) : null;
}

function redeemDraftIssueCount(draft: any) {
  if (!draft || draft.empty) return 3;
  let count = 0;
  if (!draft.code || !draft.title) count += 1;
  if (!Array.isArray(draft.rewards) || draft.rewards.length <= 0) count += 1;
  const maxUses = redeemMaxUsesValue(draft.maxUses);
  if (maxUses && Number(draft.usedCount || 0) > maxUses) count += 1;
  const start = draft.startsAt ? new Date(draft.startsAt).getTime() : 0;
  const end = draft.endsAt ? new Date(draft.endsAt).getTime() : 0;
  if ((draft.startsAt && !Number.isFinite(start)) || (draft.endsAt && !Number.isFinite(end)) || (start && end && start >= end)) count += 1;
  return count;
}

function redeemStatusColor(status: string) {
  if (status === "active") return "#61e6a8";
  if (status === "paused") return "#ffd86b";
  if (status === "disabled") return "#92a7c1";
  if (status === "expired") return "#ff8a7a";
  return "#b68cff";
}

function redeemStatusIcon(status: string) {
  if (status === "active") return "领";
  if (status === "paused") return "停";
  if (status === "disabled") return "禁";
  if (status === "expired") return "期";
  return "草";
}

function redeemRuntimeLabel(draft: any) {
  const status = draft?.status || "draft";
  if (status !== "active") return redeemStatusLabels[status] || status;
  const now = Date.now();
  const startsAt = draft.startsAt ? new Date(draft.startsAt).getTime() : 0;
  const endsAt = draft.endsAt ? new Date(draft.endsAt).getTime() : 0;
  if (startsAt && Number.isFinite(startsAt) && startsAt > now) return "未开始";
  if (endsAt && Number.isFinite(endsAt) && endsAt < now) return "已过期";
  return "可领取";
}

function redeemTimeWindowLabel(draft: any) {
  const startsAt = draft?.startsAt ? formatDateTime(draft.startsAt) : "";
  const endsAt = draft?.endsAt ? formatDateTime(draft.endsAt) : "";
  if (startsAt && endsAt) return `${startsAt} 至 ${endsAt}`;
  if (startsAt) return `${startsAt} 起`;
  if (endsAt) return `${endsAt} 截止`;
  return "长期有效";
}

function dateTimeLocalValue(value: any) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function drawTrailPreview(ctx: CanvasRenderingContext2D, width: number, height: number, draft: any) {
  const now = performance.now() / 1000;
  const primary = normalizeColor(draft.marbleTrailColor || draft.color);
  const accent = normalizeColor(draft.marbleTrailAccentColor || draft.accentColor || draft.color);
  const highlight = normalizeColor(draft.marbleTrailHighlightColor || accent);
  const length = Number(draft.marbleTrailLength) || 1;
  const widthMul = Number(draft.marbleTrailWidth) || 1;
  const density = Number(draft.marbleTrailDensity) || 1;
  const opacity = Number(draft.marbleTrailOpacity) || 0.72;
  const glow = Number(draft.marbleTrailGlow) || 1;
  const turbulence = Number(draft.marbleTrailTurbulence) || 0.25;
  const fade = Number(draft.marbleTrailFade) || 0.72;
  const spacing = Number(draft.marbleTrailSegmentSpacing) || 1;
  const sparkRate = Number(draft.marbleTrailSparkRate) || 1;
  const animation = draft.marbleTrailAnimation || "steady";

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, "#0b1320");
  bg.addColorStop(0.55, "#102739");
  bg.addColorStop(1, "#1a1b2d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "rgba(159, 215, 255, 0.28)";
  for (let y = 42; y < height; y += 58) {
    ctx.beginPath();
    ctx.moveTo(24, y);
    ctx.lineTo(width - 24, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const t = (now * 0.15) % 1;
  const x = 90 + t * (width - 180);
  const y = height * 0.54 + Math.sin(now * 1.7) * height * 0.12;
  const tailLength = (110 + length * 92) * spacing;
  const points = Math.max(10, Math.round((20 + length * 18) * density));
  const pulse = animation === "pulse" ? 1 + Math.sin(now * 6) * 0.22 : 1;
  const flicker = animation === "flicker" || animation === "sparkle" ? 0.8 + Math.abs(Math.sin(now * 16)) * 0.28 : 1;
  const zig = animation === "zigzag" ? 1 : 0;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (let i = points; i >= 1; i -= 1) {
    const p = i / points;
    const px = x - p * tailLength;
    const wave = Math.sin(now * (animation === "flow" ? 5.5 : 9) + i * 0.65) * turbulence * 20;
    const py = y + wave + zig * Math.sign(Math.sin(i * 1.7)) * 13 * turbulence;
    const alpha = Math.pow(1 - p, fade) * opacity * flicker;
    ctx.strokeStyle = hexToRgba(i % 3 === 0 ? highlight : i % 2 === 0 ? accent : primary, alpha);
    ctx.shadowColor = accent;
    ctx.shadowBlur = 12 * glow * (1 - p);
    ctx.lineWidth = Math.max(1.4, 8.5 * widthMul * pulse * (1 - p * 0.62));
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + tailLength / points * 0.78, py + Math.sin(now * 4 + i) * 4 * turbulence);
    ctx.stroke();

    if ((animation === "sparkle" || animation === "orbit" || draft.marbleTrailStyle === "firework") && i % Math.max(2, Math.round(5 / Math.max(0.5, sparkRate))) === 0) {
      ctx.fillStyle = hexToRgba(highlight, alpha);
      ctx.shadowBlur = 16 * glow;
      ctx.beginPath();
      ctx.arc(px + Math.sin(now * 8 + i) * 8, py + Math.cos(now * 7 + i) * 8, 2 + widthMul, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  const radius = 20 + widthMul * 2.8;
  drawMarblePreviewBody(ctx, x, y, radius, draft, { now, accent, highlight, glow });
  if (animation === "orbit") {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = hexToRgba(highlight, 0.72);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 1.72, radius * 0.72, now * 1.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawMarblePreviewBody(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  draft: any,
  state: { now: number; accent: string; highlight: string; glow: number },
) {
  const shape = draft.marbleShape || "orb";
  const color = normalizeColor(draft.color);
  const accent = normalizeColor(draft.accentColor || state.accent || draft.color);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(previewShapeRotation(shape, state.now));
  const fill = ctx.createRadialGradient(-radius * 0.34, -radius * 0.42, radius * 0.16, 0, 0, radius * 1.45);
  fill.addColorStop(0, "#ffffff");
  fill.addColorStop(0.34, accent);
  fill.addColorStop(0.72, color);
  fill.addColorStop(1, "rgba(8, 12, 22, 0.92)");
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowColor = accent;
  ctx.shadowBlur = 22 * state.glow;
  ctx.fillStyle = fill;
  ctx.strokeStyle = hexToRgba(state.highlight, 0.95);
  ctx.lineWidth = 2.4;

  if (shape === "flower") {
    for (let i = 0; i < 6; i += 1) {
      const a = i * (Math.PI / 3);
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * radius * 0.42, Math.sin(a) * radius * 0.42, radius * 0.46, radius * 0.26, a, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    drawMarblePreviewShapePath(ctx, shape, radius);
    ctx.fill();
    ctx.stroke();
  }

  const shapeIcon = marbleShapeIconImage(shape);
  if (shapeIcon?.complete && shapeIcon.naturalWidth > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.92;
    ctx.shadowBlur = 0;
    ctx.drawImage(shapeIcon, -radius * 1.1, -radius * 1.1, radius * 2.2, radius * 2.2);
    ctx.restore();
  } else {
    drawMarblePreviewShapeDetail(ctx, shape, radius, draft, state.highlight);
  }
  ctx.restore();
}

function previewShapeRotation(shape: string, now: number) {
  return marbleShapeRotation(shape, now);
}

function drawMarblePreviewShapePath(ctx: CanvasRenderingContext2D, shape: string, radius: number) {
  drawMarbleShapePath(ctx, shape, radius);
}

function drawMarblePreviewShapeDetail(ctx: CanvasRenderingContext2D, shape: string, radius: number, draft: any, highlight: string) {
  drawMarbleShapeDetail(ctx, shape, radius, {
    accent: normalizeColor(draft.accentColor || draft.color),
    highlight,
    label: draft.visualLabel || "",
    drawLabel: true,
  });
}

function sortCosmetics(items: CosmeticConfig[]) {
  return items.slice().sort((a, b) => rarityWeight(b.rarity) - rarityWeight(a.rarity) || a.name.localeCompare(b.name, "zh-Hans-CN"));
}

function loadAdminAuth(): AdminAuth {
  try {
    const raw = localStorage.getItem(ADMIN_AUTH_KEY);
    return raw ? { accessToken: "", admin: null, ...JSON.parse(raw) } : { accessToken: "", admin: null };
  } catch {
    return { accessToken: "", admin: null };
  }
}

function saveAdminAuth(auth: AdminAuth) {
  localStorage.setItem(ADMIN_AUTH_KEY, JSON.stringify(auth));
}

function loadAdminDraftState(): { drafts: Record<string, any>; touched: Record<string, boolean> } {
  try {
    const raw = localStorage.getItem(ADMIN_DRAFTS_KEY);
    if (!raw) return { drafts: {}, touched: {} };
    const parsed = JSON.parse(raw);
    return {
      drafts: parsed && typeof parsed.drafts === "object" ? parsed.drafts : {},
      touched: parsed && typeof parsed.touched === "object" ? parsed.touched : {},
    };
  } catch {
    return { drafts: {}, touched: {} };
  }
}

function saveAdminDraftState(drafts: Record<string, any>, touched: Record<string, boolean>) {
  localStorage.setItem(ADMIN_DRAFTS_KEY, JSON.stringify({ drafts, touched, savedAt: Date.now() }));
}

function loadAdminReleases() {
  try {
    const raw = localStorage.getItem(ADMIN_RELEASES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAdminReleases(releases: any[]) {
  localStorage.setItem(ADMIN_RELEASES_KEY, JSON.stringify(releases));
}

function adminApiBaseUrl() {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env;
  return (env?.VITE_API_URL || "http://localhost:4325/api").replace(/\/+$/, "");
}

function canUseLocalDevAdmin(username: string, password: string, error: unknown) {
  const env = (import.meta as unknown as { env?: Record<string, string | boolean> }).env;
  const isDev = Boolean(env?.DEV);
  if (!isDev) return false;
  if (!(error instanceof TypeError)) return false;
  const adminUsername = String(env?.VITE_ADMIN_USERNAME || "admin").toLowerCase();
  const adminPassword = String(env?.VITE_ADMIN_PASSWORD || "Admin@2026");
  return username.toLowerCase() === adminUsername && password === adminPassword;
}

function isLocalDevAdminToken(token: string) {
  const env = (import.meta as unknown as { env?: Record<string, string | boolean> }).env;
  return Boolean(env?.DEV) && token === LOCAL_ADMIN_TOKEN;
}

function localDevAdminProfile(): AdminProfile {
  const env = (import.meta as unknown as { env?: Record<string, string | boolean> }).env;
  return {
    adminId: "local-dev-admin",
    username: String(env?.VITE_ADMIN_USERNAME || "admin"),
    nickname: String(env?.VITE_ADMIN_NICKNAME || "本地管理员"),
    role: "super_admin",
  };
}

function rarityWeight(rarity: string) {
  return { rare: 1, epic: 2, legendary: 3 }[rarity] || 0;
}

function userStatusColor(status: string) {
  if (status === "active") return "#61e6a8";
  if (status === "banned") return "#ff8a7a";
  if (status === "disabled") return "#92a7c1";
  return "#54c7ff";
}

function marbleNameLabels() {
  return Object.fromEntries(Object.values(marbleConfigs).map((item) => [item.id, item.name]));
}

function enemyTypeLabels() {
  return Object.fromEntries(enemyTypeOptions.map((type) => [type, enemyConfigs[type].name]));
}

function enemyRoleForType(type: string) {
  if (type === "fast") return "assault";
  if (type === "tank" || type === "shield") return "armor";
  if (type === "splitter") return "control";
  if (type === "healer") return "support";
  if (type === "gold") return "reward";
  if (type === "elite") return "elite";
  if (type === "boss") return "boss";
  return "swarm";
}

function enemyBehaviorForType(type: string) {
  if (type === "splitter") return "split";
  if (type === "shield") return "shield";
  if (type === "healer") return "heal";
  if (type === "gold") return "gold";
  if (type === "elite") return "eliteGuard";
  if (type === "boss") return "bossCore";
  return "none";
}

function defaultEnemySpawnWeight(type: string) {
  if (type === "small") return 1.2;
  if (type === "fast" || type === "splitter") return 0.88;
  if (type === "tank" || type === "shield" || type === "healer") return 0.72;
  if (type === "gold") return 0.2;
  if (type === "elite") return 0.18;
  if (type === "boss") return 0.05;
  return 1;
}

function enemyStageHint(type: string) {
  if (type === "small") return "全章节基础波次";
  if (type === "fast") return "第 3 波后";
  if (type === "tank") return "第 5 波后";
  if (type === "splitter") return "章节 2 后";
  if (type === "shield") return "第 7 波后";
  if (type === "healer") return "章节 2 精英波";
  if (type === "gold") return "奖励波";
  if (type === "elite") return "精英波";
  if (type === "boss") return "首领波";
  return "按关卡配置";
}

function enemyCounterHint(type: string) {
  if (type === "fast") return "减速、底线防御";
  if (type === "tank") return "高伤害、护甲穿透";
  if (type === "splitter") return "范围伤害、连锁清场";
  if (type === "shield") return "持续输出、破盾";
  if (type === "healer") return "优先集火";
  if (type === "gold") return "快速击杀拿收益";
  if (type === "elite") return "爆发技能、压制护卫";
  if (type === "boss") return "长线输出、阶段清怪";
  return "常规弹珠输出";
}

function enemyThreatLevel(draft: any) {
  const hp = Number(draft.enemyHp ?? draft.hp) || 20;
  const speed = Number(draft.enemySpeed ?? draft.speed) || 58;
  const radius = Number(draft.enemyRadius ?? draft.radius) || 18;
  const armor = Number(draft.enemyArmor ?? draft.armor) || 0;
  const roleBonus = draft.type === "boss" ? 2.4 : draft.type === "elite" ? 1.3 : draft.type === "healer" || draft.type === "shield" ? 0.45 : 0;
  return clampNumber(hp / 260 + speed / 95 + radius / 58 + armor * 0.72 + roleBonus, 1, 10);
}

function enemyThreatBadge(draft: any) {
  const threat = enemyThreatLevel(draft);
  if (draft.type === "boss") return "首领";
  if (threat >= 5) return "高危";
  if (threat >= 2.6) return "精锐";
  return "普通";
}

function enemyAccentColor(draft: any) {
  if (draft.type === "boss") return "#ffe59a";
  if (draft.type === "elite") return "#ff9f43";
  if (draft.enemyBehavior === "shield") return "#b68cff";
  if (draft.enemyBehavior === "heal") return "#61e6a8";
  if (draft.enemyBehavior === "gold") return "#f6c95f";
  return "#54c7ff";
}

function enemyGlyph(draft: any) {
  if (draft.type === "boss") return "王";
  if (draft.type === "elite") return "精";
  if (draft.type === "fast") return "速";
  if (draft.type === "tank") return "甲";
  if (draft.type === "splitter") return "裂";
  if (draft.type === "shield") return "盾";
  if (draft.type === "healer") return "疗";
  if (draft.type === "gold") return "金";
  return "小";
}

function stageIdFromDraft(draft: any) {
  const chapter = Math.max(1, Math.round(Number(draft.stageChapter || draft.chapter) || 1));
  const stageNo = Math.max(1, Math.round(Number(draft.stageNo || draft.stage) || 1));
  return `c${chapter}s${stageNo}`;
}

function stageCsv(value: unknown) {
  return String(value || "")
    .split(/[，,\\/]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function stageEnemyCsv(value: unknown) {
  return stageCsv(value).filter((id) => Boolean(enemyConfigs[id as EnemyType]));
}

function stageEventsToLines(events: any[]) {
  return (events || [])
    .map((event) =>
      [
        event.wave || 1,
        event.label || "事件",
        event.type || "normal",
        (event.enemies || []).join(","),
        event.countBonus ?? 0,
        event.hpMultiplier ?? 1,
        event.speedMultiplier ?? 1,
        event.spawnIntervalMultiplier ?? 1,
      ].join(" | "),
    )
    .join("\n");
}

function stageEventLinesToEvents(value: unknown) {
  if (Array.isArray(value)) return value;
  const text = String(value || "").trim();
  if (!text) return [];
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((part) => part.trim());
      const wave = Math.max(1, Math.round(Number(parts[0]) || 1));
      const label = parts[1] || `第 ${wave} 波`;
      const hasType = stageWaveTypeOptions.includes(parts[2]);
      const rawType = hasType ? parts[2] : "normal";
      const enemyIndex = hasType ? 3 : 2;
      const enemies = stageEnemyCsv(parts[enemyIndex]);
      const countBonus = Number(parts[enemyIndex + 1] || 0);
      const hpMultiplier = Number(parts[enemyIndex + 2] || 1);
      const speedMultiplier = Number(parts[enemyIndex + 3] || 1);
      const spawnIntervalMultiplier = Number(parts[enemyIndex + 4] || 1);
      return {
        wave,
        label,
        ...(rawType && rawType !== "normal" ? { type: rawType } : {}),
        ...(enemies.length ? { enemies } : {}),
        ...(countBonus ? { countBonus } : {}),
        ...(hpMultiplier && hpMultiplier !== 1 ? { hpMultiplier } : {}),
        ...(speedMultiplier && speedMultiplier !== 1 ? { speedMultiplier } : {}),
        ...(spawnIntervalMultiplier && spawnIntervalMultiplier !== 1 ? { spawnIntervalMultiplier } : {}),
      };
    });
}

function stageDifficultyScore(draft: any) {
  const hp = Number(draft.stageHpMultiplier ?? draft.hpMultiplier) || 1;
  const speed = Number(draft.stageSpeedMultiplier ?? draft.speedMultiplier) || 1;
  const density = Number(draft.stageDensityMultiplier ?? draft.densityMultiplier) || 1;
  const enemyCount = stageEnemyCsv(draft.stageEnemyBias).length;
  const events = stageEventLinesToEvents(draft.stageWaveEvents).length;
  const boss = draft.stageHasBoss || draft.boss ? 1.4 : 0;
  return clampNumber(hp * 1.6 + speed * 1.2 + density * 1.5 + enemyCount * 0.22 + events * 0.24 + boss, 1, 10);
}

function stageTypeBadge(draft: any) {
  if (draft.stageHasBoss || draft.boss) return "Boss 关";
  if (Number(draft.stageRewardCoins || 1) >= 1.18 || stageEnemyCsv(draft.stageEnemyBias).includes("gold")) return "奖励关";
  if ((Number(draft.stageDensityMultiplier) || 1) >= 1.25 || (Number(draft.stageHpMultiplier) || 1) >= 1.28) return "压力关";
  return "普通关";
}

function stageAccentColor(draft: any) {
  const chapter = Number(draft.stageChapter || draft.chapter || 1);
  if (chapter === 2) return "#54c7ff";
  if (chapter === 3) return "#ff8a5f";
  if (chapter === 4) return "#b68cff";
  if (chapter === 5) return "#f6c95f";
  return "#61e6a8";
}

function stageRewardChips(draft: any) {
  const chips: string[] = [];
  const coins = Number(draft.stageRewardCoins || 1);
  if (coins !== 1) chips.push(`金币 x${coins.toFixed(2)}`);
  for (const id of stageCsv(draft.stageRewardShards)) chips.push(`碎片 ${marbleConfigs[id]?.name || id}`);
  for (const id of stageCsv(draft.stageRewardGems)) chips.push(`宝石 ${gemConfigs[id]?.name || id}`);
  for (const id of stageCsv(draft.stageRewardCollectibles)) chips.push(`收藏 ${collectibleConfigs[id]?.name || id}`);
  return chips;
}

function exportStageRewardBias(draft: any) {
  const rewardBias: Record<string, any> = {};
  const coins = Number(draft.stageRewardCoins || 1);
  const shards = stageCsv(draft.stageRewardShards).filter((id) => Boolean(marbleConfigs[id]));
  const gems = stageCsv(draft.stageRewardGems).filter((id) => Boolean(gemConfigs[id]));
  const collectibles = stageCsv(draft.stageRewardCollectibles).filter((id) => Boolean(collectibleConfigs[id]));
  if (coins !== 1) rewardBias.coins = coins;
  if (shards.length) rewardBias.shards = shards;
  if (gems.length) rewardBias.gems = gems;
  if (collectibles.length) rewardBias.collectibles = collectibles;
  return rewardBias;
}

function defaultSkillEffectType(characterId: string) {
  if (characterId === "engineer" || characterId === "magnetist") return "buff";
  if (characterId === "sentinel") return "defense";
  if (characterId === "frostseer" || characterId === "voidbinder") return "control";
  if (characterId === "treasurer" || characterId === "alchemist") return "economy";
  return "damage";
}

function defaultSkillTargeting(characterId: string) {
  if (characterId === "engineer" || characterId === "magnetist" || characterId === "prism" || characterId === "treasurer") return "self";
  if (characterId === "sentinel") return "bottom";
  return "densest";
}

function defaultSkillDuration(characterId: string) {
  if (characterId === "engineer") return 6;
  if (characterId === "magnetist") return 7;
  if (characterId === "frostseer") return 3.4;
  if (characterId === "voidbinder") return 3;
  if (characterId === "treasurer") return 2.8;
  return 0;
}

function defaultSkillPower(characterId: string) {
  if (characterId === "voidbinder") return 2.3;
  if (characterId === "bomber" || characterId === "alchemist") return 2;
  if (characterId === "frostseer") return 1.55;
  if (characterId === "sentinel") return 1.25;
  return 1;
}

function defaultSkillRadius(characterId: string) {
  if (characterId === "bomber" || characterId === "alchemist") return 150;
  if (characterId === "frostseer") return 170;
  if (characterId === "voidbinder") return 190;
  if (characterId === "sentinel") return 210;
  return 0;
}

function defaultSkillProjectileCount(characterId: string) {
  if (characterId === "prism") return 5;
  if (characterId === "treasurer") return 8;
  return 0;
}

function defaultSkillControl(characterId: string) {
  if (characterId === "frostseer") return 0.82;
  if (characterId === "voidbinder") return 0.72;
  if (characterId === "magnetist") return 0.38;
  if (characterId === "sentinel") return 0.26;
  return 0;
}

function defaultSkillFxPreset(characterId: string) {
  if (characterId === "bomber" || characterId === "alchemist") return "flame";
  if (characterId === "magnetist") return "neon";
  if (characterId === "frostseer" || characterId === "prism") return "aurora";
  if (characterId === "voidbinder") return "void";
  if (characterId === "treasurer") return "treasure";
  return "base";
}

function skillFxColor(preset: string) {
  if (preset === "flame") return "#ff8a5f";
  if (preset === "neon") return "#54c7ff";
  if (preset === "aurora") return "#b68cff";
  if (preset === "void") return "#9f79ff";
  if (preset === "treasure") return "#ffd166";
  return "#61e6a8";
}

function tacticRarityColor(rarity: string) {
  if (rarity === "legendary") return "#f6c95f";
  if (rarity === "epic") return "#b68cff";
  if (rarity === "rare") return "#54c7ff";
  return "#61e6a8";
}

function tacticTagColor(tag: string) {
  if (tag === "传说") return "#f6c95f";
  if (tag === "角色") return "#d58cff";
  if (tag === "功能") return "#61e6a8";
  if (tag === "生存") return "#ff8fb3";
  if (tag === "经济") return "#ffd166";
  if (tag === "爆炸" || tag === "燃烧") return "#ff8a5f";
  if (tag === "控制" || tag === "连锁") return "#54c7ff";
  return "#9abce5";
}

function tacticCardIcon(draft: any) {
  if (draft.tacticCoreType === "main") return "主";
  if (draft.tacticCoreType === "sub") return "副";
  if (draft.tacticCoreType === "enhance") return "强";
  if (draft.tacticKind === "tiered") return tacticTierLabels[draft.tacticTier] || "链";
  if (draft.tacticKind === "character") return "角";
  if (draft.tacticKind === "utility") return "用";
  if (draft.tacticKind === "unique") return "唯";
  return "叠";
}

function tacticCsv(value: unknown) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function tacticUnlockChips(draft: any) {
  return [
    ...tacticCsv(draft.tacticUnlockCharacters).map((id) => `角色 ${characters.find((item) => item.id === id)?.name || id}`),
    ...tacticCsv(draft.tacticUnlockCards).map((id) => `前置卡 ${id}`),
    ...tacticCsv(draft.tacticUnlockFamilies).map((id) => `流派 ${id}`),
  ];
}

function exportTacticUnlock(draft: any) {
  const characterIds = tacticCsv(draft.tacticUnlockCharacters);
  const cardIds = tacticCsv(draft.tacticUnlockCards);
  const familyIds = tacticCsv(draft.tacticUnlockFamilies);
  const unlock: Record<string, string[]> = {};
  if (characterIds.length) unlock.characters = characterIds;
  if (cardIds.length) unlock.cards = cardIds;
  if (familyIds.length) unlock.families = familyIds;
  return Object.keys(unlock).length ? unlock : null;
}

function formatNumber(value: unknown) {
  const number = Math.floor(Number(value) || 0);
  return number.toLocaleString("zh-CN");
}

function normalizeColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value || "") ? value : "#54c7ff";
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function nextConfigVersion() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `cfg-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function formatDateTime(value: string | number | Date | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function capitalize(value: string) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

function hexToRgba(color: string, alpha: number) {
  const normalized = normalizeColor(color).replace("#", "");
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function escapeHtml(value: string) {
  return String(value).replace(/[&<>"']/g, (char) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char] as string;
  });
}

function lucideIconHtml(iconNode: Array<[string, Record<string, string | number>]>) {
  const children = iconNode
    .map(([tag, attrs]) => `<${tag} ${svgAttrs(attrs)}></${tag}>`)
    .join("");
  return `<svg class="admin-lucide-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" focusable="false">${children}</svg>`;
}

function svgAttrs(attrs: Record<string, string | number>) {
  return Object.entries(attrs)
    .map(([key, value]) => `${key}="${escapeHtml(String(value))}"`)
    .join(" ");
}
