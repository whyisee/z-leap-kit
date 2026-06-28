// @ts-nocheck

import { characters } from "../config/characters";
import { cosmeticConfigs, cosmeticPools, cosmeticsForPool } from "../config/cosmetics";
import { collectibleConfigs, gemConfigs } from "../config/loot";
import { marbleConfigs } from "../config/marbles";
import { shopCategories, shopItems } from "../config/shop";
import { rarityName } from "../core/rarity";
import type { CosmeticConfig, ShopItemConfig } from "../core/types";

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

type AdminModule = "marble" | "character" | "gacha" | "shop" | "publish";

const ADMIN_AUTH_KEY = "game-marbles-admin-auth-v1";
const ADMIN_DRAFTS_KEY = "game-marbles-admin-content-drafts-v1";
const ADMIN_RELEASES_KEY = "game-marbles-admin-releases-v1";
const LOCAL_ADMIN_TOKEN = "local-dev-admin-token";
const API_BASE = adminApiBaseUrl();
const INITIAL_DRAFT_STATE = loadAdminDraftState();

const moduleLabels: Record<AdminModule, { title: string; nav: string; library: string; preview: string }> = {
  marble: { title: "弹珠幻化设计器", nav: "弹珠幻化", library: "弹珠外观内容库", preview: "战斗拖尾预览" },
  character: { title: "角色服装设计器", nav: "角色服装", library: "角色服装内容库", preview: "角色展示预览" },
  gacha: { title: "抽卡池设计器", nav: "抽卡池", library: "卡池配置", preview: "概率与投放预览" },
  shop: { title: "商店投放设计器", nav: "商店投放", library: "商品投放库", preview: "商品卡预览" },
  publish: { title: "发布中心", nav: "发布中心", library: "配置版本", preview: "发布摘要" },
};

const contentModuleIds: Array<Exclude<AdminModule, "publish">> = ["marble", "character", "gacha", "shop"];
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

const marbleShapes = ["orb", "candy", "star", "leaf", "crystal", "bomb", "flame", "bolt", "snowflake", "ring", "flower", "comet"];
const marbleShapeLabels: Record<string, string> = {
  orb: "圆珠",
  candy: "糖芯",
  star: "星形",
  leaf: "叶片",
  crystal: "晶体",
  bomb: "爆弹",
  flame: "火球",
  bolt: "电芯",
  snowflake: "雪晶",
  ring: "星环",
  flower: "花瓣",
  comet: "彗核",
};

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
  private selectedIds: Record<AdminModule, string> = { marble: "", character: "", gacha: "", shop: "", publish: "candidate" };
  private drafts: Record<string, any> = INITIAL_DRAFT_STATE.drafts;
  private touched: Record<string, boolean> = INITIAL_DRAFT_STATE.touched;
  private notice = "";
  private busy = false;
  private exportOpen = false;
  private previewFrame = 0;

  constructor(private readonly root: HTMLElement) {
    this.selectedIds = {
      marble: this.moduleItems("marble")[0]?.id || "",
      character: this.moduleItems("character")[0]?.id || "",
      gacha: this.moduleItems("gacha")[0]?.id || "",
      shop: this.moduleItems("shop")[0]?.id || "",
      publish: "candidate",
    };
    this.root.addEventListener("click", (event) => this.handleClick(event));
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

    const selected = this.selectedItem();
    const draft = this.draftFor(this.activeModule, selected.id);
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
            ${this.moduleButtonHtml("marble")}
            ${this.moduleButtonHtml("character")}
            ${this.moduleButtonHtml("gacha")}
            ${this.moduleButtonHtml("shop")}
            ${this.moduleButtonHtml("publish")}
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

          <div class="admin-content-grid ${this.activeModule === "gacha" || this.activeModule === "shop" ? "admin-content-grid-gacha" : ""} ${this.activeModule === "publish" ? "admin-content-grid-publish" : ""}">
            <section class="admin-library">
              <div class="admin-panel-head">
                <strong>${meta.library}</strong>
                <span>${this.moduleItems(this.activeModule).length} 项</span>
              </div>
              <div class="admin-search-row">
                <input type="text" value="" placeholder="搜索后续开放" disabled />
              </div>
              <div class="admin-item-list">
                ${this.moduleItems(this.activeModule).map((item) => this.libraryItemHtml(item, item.id === selected.id)).join("")}
              </div>
            </section>

            <section class="admin-editor">
              <div class="admin-panel-head">
                <strong>${escapeHtml(draft.name)}</strong>
                <span>${this.editorMetaText(draft)}</span>
              </div>
              ${this.editorHtml(draft)}
            </section>

            <aside class="admin-preview">
              <div class="admin-panel-head">
                <strong>${meta.preview}</strong>
                <span>${this.touched[this.draftKey(this.activeModule, selected.id)] ? "草稿" : "原始"}</span>
              </div>
              ${this.previewHtml(draft, perf, validation)}
            </aside>
          </div>
        </section>
      </main>
      ${this.exportOpen ? this.exportModalHtml(draft) : ""}
    `;
  }

  private moduleButtonHtml(module: AdminModule) {
    const meta = moduleLabels[module];
    return `
      <button class="${this.activeModule === module ? "active" : ""}" type="button" data-admin-module="${module}">
        <span>${meta.nav}</span>
        <em>${this.moduleItems(module).length}</em>
      </button>
    `;
  }

  private editorHtml(draft: any) {
    if (this.activeModule === "character") return this.characterEditorHtml(draft);
    if (this.activeModule === "gacha") return this.gachaEditorHtml(draft);
    if (this.activeModule === "shop") return this.shopEditorHtml(draft);
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
            ${this.selectField("marbleShape", "本体形态", draft.marbleShape || "orb", marbleShapes, marbleShapeLabels)}
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

  private releaseModuleToggleHtml(draft: any, module: Exclude<AdminModule, "publish">) {
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
    if (this.activeModule === "character") return this.characterPreviewHtml(draft, validation);
    if (this.activeModule === "gacha") return this.gachaPreviewHtml(draft, validation);
    if (this.activeModule === "shop") return this.shopPreviewHtml(draft, validation);
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

  private publishPreviewHtml(draft: any, validation: Array<{ level: string; title: string; text: string }>) {
    if (draft.kind === "release") return this.releaseRecordPreviewHtml(draft, validation);
    const bundle = this.buildReleaseBundle(draft);
    const releases = loadAdminReleases();
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

  private libraryItemHtml(item: any, active: boolean) {
    if (this.activeModule === "character") return this.characterLibraryItemHtml(item, active);
    if (this.activeModule === "gacha") return this.gachaLibraryItemHtml(item, active);
    if (this.activeModule === "shop") return this.shopLibraryItemHtml(item, active);
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
    const module = target.closest<HTMLElement>("[data-admin-module]")?.dataset.adminModule as AdminModule | undefined;
    const select = target.closest<HTMLElement>("[data-admin-select]")?.dataset.adminSelect;
    const action = target.closest<HTMLElement>("[data-admin-action]")?.dataset.adminAction;

    if (module && module in moduleLabels) {
      this.activeModule = module;
      this.exportOpen = false;
      this.notice = "";
      this.render();
      return;
    }

    if (select) {
      this.selectedIds[this.activeModule] = select;
      this.exportOpen = false;
      this.render();
      return;
    }

    if (!action) return;
    if (action === "logout") this.logout();
    if (action === "reset") this.resetDraft();
    if (action === "saveDraft") this.saveDraft();
    if (action === "addReward") this.addShopReward();
    if (action === "removeReward") this.removeShopReward(Number(target.closest<HTMLElement>("[data-admin-reward-index]")?.dataset.adminRewardIndex || -1));
    if (action === "buildRelease") this.buildReleaseCandidate();
    if (action === "publishRelease") this.publishRelease();
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

  private handleFieldInput(event: Event) {
    const input = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
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
    const draft = this.draftFor("shop", this.selectedIds.shop);
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
    this.touched[this.draftKey("shop", this.selectedIds.shop)] = true;
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
    const key = this.draftKey(this.activeModule, this.selectedIds[this.activeModule]);
    delete this.drafts[key];
    delete this.touched[key];
    saveAdminDraftState(this.drafts, this.touched);
    this.exportOpen = false;
    this.notice = "当前草稿已重置";
    this.render();
  }

  private saveDraft() {
    this.syncDraftFromForm();
    this.touched[this.draftKey(this.activeModule, this.selectedIds[this.activeModule])] = true;
    saveAdminDraftState(this.drafts, this.touched);
    this.exportOpen = false;
    this.notice = "草稿已保存到本机";
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
    if (module === "character") return sortCosmetics(cosmeticsForPool("character"));
    if (module === "gacha") return Object.values(cosmeticPools);
    if (module === "shop") return shopItems;
    if (module === "publish") return this.publishItems();
    return sortCosmetics(cosmeticsForPool("marble"));
  }

  private selectedItem() {
    const id = this.selectedIds[this.activeModule];
    return this.moduleItems(this.activeModule).find((item) => item.id === id) || this.moduleItems(this.activeModule)[0];
  }

  private draftFor(module: AdminModule, itemId: string) {
    const key = this.draftKey(module, itemId);
    if (this.drafts[key]) return this.drafts[key];
    const item = this.moduleItems(module).find((entry) => entry.id === itemId) || this.moduleItems(module)[0];
    if (module === "character") this.drafts[key] = this.createCharacterDraft(item);
    else if (module === "gacha") this.drafts[key] = this.createGachaDraft(item);
    else if (module === "shop") this.drafts[key] = this.createShopDraft(item);
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
    if (this.activeModule === "gacha") return `${draft.kind === "character" ? "角色池" : "弹珠池"} · ${draft.singleCrystalCost} 晶体/抽`;
    if (this.activeModule === "shop") return `${escapeHtml(shopCategoryLabels[draft.category] || "商店")} · ${escapeHtml(currencyLabels[draft.priceCurrency] || "货币")} ${Number(draft.priceAmount) || 0}`;
    if (this.activeModule === "publish") return draft.kind === "release" ? `${escapeHtml(releaseEnvLabels[draft.environment] || "环境")} · ${escapeHtml(formatDateTime(draft.publishedAt))}` : `${this.releaseSummary(draft).changed} 个草稿 · ${escapeHtml(releaseEnvLabels[draft.releaseEnv] || "测试环境")}`;
    return `${escapeHtml(rarityName(draft.rarity))} · ${escapeHtml(draft.theme || "未分组")}`;
  }

  private performanceScore(draft: any) {
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
    if (this.activeModule === "character") return this.exportCharacterJson(draft);
    if (this.activeModule === "gacha") return this.exportGachaJson(draft);
    if (this.activeModule === "shop") return this.exportShopJson(draft);
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

  private publishItems() {
    return [
      { id: "candidate", kind: "candidate", name: "发布候选" },
      ...loadAdminReleases().map((release: any) => ({ ...release, kind: "release", name: release.title || release.configVersion })),
    ];
  }

  private changedDraftsForModule(module: Exclude<AdminModule, "publish">) {
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

  private exportDraftObject(module: Exclude<AdminModule, "publish">, draft: any) {
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

  private publishRelease() {
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
    const releases = loadAdminReleases();
    const now = new Date().toISOString();
    const record = {
      id: `release_${Date.now()}`,
      kind: "release",
      title: bundle.title,
      configVersion: bundle.configVersion,
      environment: bundle.environment,
      status: bundle.mode === "scheduled" ? "scheduled" : "published",
      createdAt: now,
      publishedAt: bundle.mode === "scheduled" ? bundle.scheduledAt : now,
      author: this.auth.admin?.username || "admin",
      bundle,
    };
    saveAdminReleases([record, ...releases].slice(0, 30));
    this.notice = `${releaseEnvLabels[bundle.environment] || "环境"}已记录发布版本 ${bundle.configVersion}`;
    this.selectedIds.publish = record.id;
    this.exportOpen = false;
    this.render();
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
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowColor = accent;
  ctx.shadowBlur = 26 * glow;
  const body = ctx.createRadialGradient(x - 6, y - 8, 2, x, y, radius);
  body.addColorStop(0, "#ffffff");
  body.addColorStop(0.36, normalizeColor(draft.color));
  body.addColorStop(1, normalizeColor(draft.accentColor || draft.color));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = hexToRgba(highlight, 0.95);
  ctx.stroke();
  if (animation === "orbit") {
    ctx.strokeStyle = hexToRgba(highlight, 0.72);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 1.72, radius * 0.72, now * 1.6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(7, 16, 27, 0.82)";
  ctx.font = "800 14px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(draft.visualLabel || "").slice(0, 2), x, y + 1);
  ctx.restore();
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
