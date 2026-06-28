import "./styles.css";
import { gameMethods } from "./game/methods";

import {
  BASE_GEM_SLOTS,
  CHARACTER_BASE_OFFSET,
  CHARACTER_SKILL_MAX_LEVEL,
  FIELD,
  FIELD_BOTTOM,
  FIELD_RIGHT,
  GEM_MAX_LEVEL,
  HEIGHT,
  HERO_MAX_LEVEL,
  LOOT_BAG_TARGET,
  MARBLE_MAX_LEVEL,
  WIDTH,
} from "./core/constants";
import type {
  AutoExtractionMode,
  AutoRunMode,
  AutoUpgradeMode,
  BattleMode,
  CharacterConfig,
  CharacterProgress,
  CharacterRoute,
  CharacterRouteId,
  CharacterRuntime,
  CharacterSortMode,
  CollectibleId,
  DropEntry,
  Enemy,
  EnemyType,
  ExtractionResult,
  GemType,
  InventoryData,
  Marble,
  MarbleConfig,
  MarbleId,
  MenuView,
  MetaUpgrade,
  Phase,
  Rarity,
  SaveData,
  Session,
  ShopCategory,
  ShopItemConfig,
  Speed,
  StageConfig,
  UpgradeCard,
  VisualEffect,
  WaveConfig,
} from "./core/types";
import { characters } from "./config/characters";
import { collectibleConfigs, gemConfigs } from "./config/loot";
import { enemyConfigs } from "./config/enemies";
import { marbleConfigs } from "./config/marbles";
import { metaUpgrades } from "./config/meta-upgrades";
import { shopCategories } from "./config/shop";
import { getStageById, getStageByIndex, stages } from "./config/stages";
import { upgradeCards } from "./config/upgrades";
import { byId } from "./app/dom";
import { formatTime } from "./core/format";
import { clamp, easeInOutCubic, easeOutCubic, lerp, rotate, roundRect } from "./core/math";
import { randomChoice, randomRange } from "./core/random";
import { rarityAutoScore, rarityColor, rarityName, rollRarity } from "./core/rarity";
import {
  defaultCharacterProgress,
  defaultInventory,
  defaultSave,
  loadSave,
  normalizeBaseGems,
  normalizeCharacterMarbles,
  normalizeLineup,
  saveGame,
  syncCharacterUnlocks,
} from "./state/save";
import { normalizeVelocity, reflectVelocity } from "./systems/battle/physics";
import { densestPoint, nearestEnemy } from "./systems/battle/targeting";
import { createWave, enemyThreatRank } from "./systems/battle/waves";
import {
  battleWaveBannerText,
  continuePreviewForSession,
  extractionDepthNameForSession,
  extractionResultEyebrowForMode,
  extractionResultTitleForMode,
  formatSessionWaveText,
  isEndlessMode,
  isRunComplete,
  maxHeatForMode,
  shouldOpenExtractionWindowForSession,
} from "./systems/battle/modes";
import { applyBattleProgressToSave, battleCoinReward, battleShardReward, calculateStageStars } from "./systems/battle/results";
import {
  collectibleForRarity,
  dropAmount,
  dropGemLevel,
  dropIconFill,
  dropIconText,
  dropShardAmount,
  dropShortLabel,
  dropTotalAmount,
  rollDropRarity,
} from "./systems/loot/drops";
import { gemEffectText, gemFuseChance, gemKey, gemLabel, gemRarity, parseGemKey, sortedGemEntries } from "./systems/loot/gems";
import {
  applyDropsToInventory,
  autoInsuredDropKeys,
  boostDropRarityForContinue,
  compactDropSummaryRows,
  dropSummaryRows,
  dropTotalValue,
  insuredDropCount,
  splitDropsForExtraction,
  toggleInsuredDropKey,
  type DropSummaryItem,
} from "./systems/loot/session-loot";
import { characterLevelCost, characterRouteCost, characterSkillCost } from "./systems/meta/characters";
import { metaCost, upgradeLevel } from "./systems/meta/base-upgrades";
import { marbleShardCost } from "./systems/meta/marble-levels";
import {
  combinedRarityBoost,
  compactSelectedUpgrades,
  consumeRarityBoostUse,
  createDefaultTacticalState,
  ensureTacticalState,
  isUpgradeCardAvailable,
  tacticalCardWeight,
  upgradeCardTierLabel,
  upgradeCardTypeLabel,
} from "./systems/progression/tactical-upgrades";
import { xpNeedForLevel } from "./systems/progression/xp";
import {
  ensureShopState,
  purchaseShopItem,
  refreshShardShop,
  shopItemBadge,
  shopItemColor,
  shopItemDisabledReason,
  shopItemPrice,
  shopItemsForCategory,
  shopPriceText,
  shopRefreshCost,
  shopRefreshLeft,
  shopRewardSummary,
  shopStockLeft,
} from "./systems/shop/offers";
import { upgradeCardHtml } from "./ui/overlays/upgrade";
import { GameBackend } from "./services/game-backend";
import { SoundManager } from "./services/sound";

const legacyAccountAvatarMap: Record<string, string> = {
  avatar_green: "engineer",
  avatar_yellow: "bomber",
  avatar_blue: "magnetist",
  avatar_violet: "prism",
  avatar_red: "alchemist",
};

const defaultAccountAvatarId = "engineer";

const characterSortModes: CharacterSortMode[] = ["power", "level", "rarity", "attack"];

const characterSortLabels: Record<CharacterSortMode, string> = {
  power: "战力",
  level: "等级",
  rarity: "稀有度",
  attack: "攻击力",
};

const navIconSources: Partial<Record<MenuView, string>> = {
  inventory: new URL("./assets/nav/nav-inventory.png", import.meta.url).href,
  roulette: new URL("./assets/nav/nav-shop.png", import.meta.url).href,
  home: new URL("./assets/nav/nav-base.png", import.meta.url).href,
  heroes: new URL("./assets/nav/nav-heroes.png", import.meta.url).href,
  marbles: new URL("./assets/nav/nav-marbles.png", import.meta.url).href,
};

const homeAssetSources = {
  background: new URL("./assets/home/home-hub-background.webp", import.meta.url).href,
  battleTerminal: new URL("./assets/home/entry-battle-terminal.png", import.meta.url).href,
  heroesBay: new URL("./assets/home/entry-heroes-bay.png", import.meta.url).href,
  marbleWorkshop: new URL("./assets/home/entry-marble-workshop.png", import.meta.url).href,
  inventoryVault: new URL("./assets/home/entry-inventory-vault.png", import.meta.url).href,
  shopStation: new URL("./assets/home/entry-shop-station.png", import.meta.url).href,
  protocolCore: new URL("./assets/home/entry-protocol-core.png", import.meta.url).href,
  collectionRoom: new URL("./assets/home/entry-collection-room.png", import.meta.url).href,
};

const characterPortraitSources: Record<string, string> = {
  engineer: new URL("./assets/heroes/hero-engineer.png", import.meta.url).href,
  bomber: new URL("./assets/heroes/hero-bomber.png", import.meta.url).href,
  magnetist: new URL("./assets/heroes/hero-magnetist.png", import.meta.url).href,
  sentinel: new URL("./assets/heroes/hero-sentinel.png", import.meta.url).href,
  prism: new URL("./assets/heroes/hero-prism.png", import.meta.url).href,
  alchemist: new URL("./assets/heroes/hero-alchemist.png", import.meta.url).href,
  frostseer: new URL("./assets/heroes/hero-frostseer.png", import.meta.url).href,
  voidbinder: new URL("./assets/heroes/hero-voidbinder.png", import.meta.url).href,
  treasurer: new URL("./assets/heroes/hero-treasurer.png", import.meta.url).href,
};

const battleBackgroundSources: Record<string, string> = {
  "1-normal": new URL("./assets/battle-bg/chapter-1-normal.webp", import.meta.url).href,
  "1-boss": new URL("./assets/battle-bg/chapter-1-boss.webp", import.meta.url).href,
  "2-normal": new URL("./assets/battle-bg/chapter-2-normal.webp", import.meta.url).href,
  "2-boss": new URL("./assets/battle-bg/chapter-2-boss.webp", import.meta.url).href,
  "3-normal": new URL("./assets/battle-bg/chapter-3-normal.webp", import.meta.url).href,
  "3-boss": new URL("./assets/battle-bg/chapter-3-boss.webp", import.meta.url).href,
  "4-normal": new URL("./assets/battle-bg/chapter-4-normal.webp", import.meta.url).href,
  "4-boss": new URL("./assets/battle-bg/chapter-4-boss.webp", import.meta.url).href,
  "5-normal": new URL("./assets/battle-bg/chapter-5-normal.webp", import.meta.url).href,
  "5-boss": new URL("./assets/battle-bg/chapter-5-boss.webp", import.meta.url).href,
};

type WarehouseTab = "gems" | "shards" | "collectibles";
type ProtocolTab = "gems" | "protocols";
type HeroDetailTab = "overview" | "skills" | "marbles" | "routes";
type ProfileEditMode = "summary" | "name" | "avatar";
type CollectionTab = "characters" | "enemies" | "gems" | "marbles" | "loot" | "tactics" | "protocols" | "achievements";
type CollectionReward = {
  coins: number;
  energyCrystals?: number;
};
type CollectionEntry = {
  key: string;
  color: string;
  state: "known" | "locked";
  iconHtml: string;
  eyebrow: string;
  title: string;
  desc: string;
  facts: string[];
  tags: string[];
  footer: string;
  reward: CollectionReward;
};
type CollectionAchievement = {
  id: string;
  category: string;
  title: string;
  desc: string;
  color: string;
  icon: string;
  current: number;
  target: number;
  goal: string;
  tags: string[];
  reward: CollectionReward;
};
type WarehouseDetail = {
  tab: WarehouseTab;
  key: string;
};

interface MarblesGame {
  renderMenu(view?: MenuView): void;
  collectionAllEntries(): CollectionEntry[];
  collectionEntryByKey(key: string): CollectionEntry | null;
  collectionRewardText(reward: CollectionReward): string;
}

class MarblesGame {
  [key: string]: any;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly surface = byId("gameSurface") as HTMLElement;
  private readonly menuScreen = byId("menuScreen");
  private readonly upgradeScreen = byId("upgradeScreen");
  private readonly extractionScreen = byId("extractionScreen");
  private readonly resultScreen = byId("resultScreen");
  private readonly pauseScreen = byId("pauseScreen");
  private readonly battleHud = byId("battleHud");
  private readonly bottomHud = byId("bottomHud");
  private readonly lootBag = byId("lootBag") as HTMLButtonElement;
  private readonly lootScreen = byId("lootScreen");
  private readonly baseText = byId("baseText");
  private readonly waveText = byId("waveText");
  private readonly levelText = byId("levelText");
  private readonly coinText = byId("coinText");
  private readonly lootValueText = byId("lootValueText");
  private readonly heatText = byId("heatText");
  private readonly xpFill = byId("xpFill");
  private readonly xpText = byId("xpText");
  private readonly lootCountText = byId("lootCountText");
  private readonly speedButton = byId("speedButton") as HTMLButtonElement;
  private readonly autoButton = byId("autoButton") as HTMLButtonElement;
  private readonly autoPanel = byId("autoPanel");
  private readonly tacticPanel = byId("tacticPanel");
  private readonly tacticToggle = byId("tacticToggle") as HTMLButtonElement;
  private readonly tacticList = byId("tacticList");
  private readonly tacticCountText = byId("tacticCountText");
  private readonly pauseButton = byId("pauseButton") as HTMLButtonElement;
  private readonly homeBackground = new Image();
  private readonly battleBackgrounds = new Map<string, HTMLImageElement>();
  private readonly characterPortraits = new Map<string, HTMLImageElement>();
  private save: SaveData = loadSave();
  private readonly backend = new GameBackend();
  private readonly sound = new SoundManager();
  private session: Session | null = null;
  private activeBattleId: string | null = null;
  private phase: Phase = "menu";
  private menuView: MenuView = "home";
  private warehouseTab: WarehouseTab = "gems";
  private protocolTab: ProtocolTab = "gems";
  private collectionTab: CollectionTab = "characters";
  private collectionDetailKey: string | null = null;
  private warehouseDetail: WarehouseDetail | null = null;
  private shopTab: ShopCategory = "recommended";
  private battleTerminalOpen = false;
  private selectedCharacterId = characters[0]?.id ?? "engineer";
  private heroModalCharacterId: string | null = null;
  private heroDetailTab: HeroDetailTab = "overview";
  private heroLineupPickerOpen = false;
  private heroMarbleSlot = 0;
  private heroMarblePickerOpen = false;
  private menuNotice = "";
  private accountBusy = this.backend.hasStoredSession;
  private accountModalOpen = false;
  private loginModalOpen = false;
  private profileAvatarDraft = this.backend.accountInfo.avatar;
  private profileEditMode: ProfileEditMode = "summary";
  private redeemBusy = false;
  private redeemNotice = "";
  private autoBattleEnabled = this.save.preferences.autoBattleEnabled;
  private autoUpgradeMode: AutoUpgradeMode = this.save.preferences.autoUpgradeMode;
  private autoExtractionMode: AutoExtractionMode = this.save.preferences.autoExtractionMode;
  private autoRunMode: AutoRunMode = this.save.preferences.autoRunMode;
  private autoSkillEnabled = this.save.preferences.autoSkillEnabled;
  private characterSortMode: CharacterSortMode = this.save.preferences.characterSortMode;
  private tacticPanelExpanded = false;
  private tacticPanelSignature = "";
  private lastTime = performance.now();

  constructor() {
    const canvas = byId("gameCanvas") as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context is not available.");
    }

    this.canvas = canvas;
    this.ctx = ctx;
    this.homeBackground.src = homeAssetSources.background;
    for (const [key, src] of Object.entries(battleBackgroundSources)) {
      const image = new Image();
      image.src = src;
      this.battleBackgrounds.set(key, image);
    }
    for (const [id, src] of Object.entries(characterPortraitSources)) {
      const image = new Image();
      image.src = src;
      this.characterPortraits.set(id, image);
    }
    this.profileAvatarDraft = this.accountAvatarCharacter(this.profileAvatarDraft).id;
    this.bindEvents();
    this.resizeCanvas();
    this.renderMenu();
    void this.bootstrapBackend();
    requestAnimationFrame((time) => this.loop(time));
  }

  private async bootstrapBackend() {
    const result = await this.backend.bootstrap(this.save);
    this.save = result.save;
    this.applyBattlePreferences();
    const unlocked = this.unlockReadyCharacters();
    saveGame(this.save);
    this.accountBusy = false;
    this.menuNotice = unlocked.length > 0 ? this.menuNotice : result.notice;
    this.renderMenu(this.menuView);
  }

  private openLoginModal() {
    if (this.accountBusy) return;
    this.accountModalOpen = false;
    this.loginModalOpen = true;
    this.renderMenu("home");
  }

  private closeLoginModal() {
    this.loginModalOpen = false;
    this.renderMenu("home");
  }

  private async submitPasswordLogin(mode: "login" | "register") {
    if (this.accountBusy) return;
    const usernameInput = this.menuScreen.querySelector<HTMLInputElement>("[data-login-username]");
    const passwordInput = this.menuScreen.querySelector<HTMLInputElement>("[data-login-password]");
    const username = usernameInput?.value.trim() || "";
    const password = passwordInput?.value || "";
    if (!username || !password) {
      this.menuNotice = "请输入用户名和密码";
      this.renderMenu("home");
      return;
    }

    this.accountBusy = true;
    this.menuNotice = mode === "login" ? "正在登录账号..." : "正在注册账号...";

    try {
      const result =
        mode === "login"
          ? await this.backend.loginWithPassword(username, password)
          : await this.backend.registerWithPassword(username, password, this.save);
      this.save = result.save;
      this.applyBattlePreferences();
      const unlocked = this.unlockReadyCharacters();
      saveGame(this.save);
      this.menuNotice = unlocked.length > 0 ? this.menuNotice : result.notice;
      this.loginModalOpen = false;
    } catch {
      this.menuNotice = mode === "login" ? "登录失败，请检查用户名和密码" : "注册失败，用户名可能已存在";
    } finally {
      this.accountBusy = false;
      this.renderMenu("home");
    }
  }

  private openAccountModal() {
    if (!this.backend.isLoggedIn) {
      this.openLoginModal();
      return;
    }
    this.profileAvatarDraft = this.accountAvatarCharacter(this.backend.accountInfo.avatar).id;
    this.profileEditMode = "summary";
    this.accountModalOpen = true;
    this.renderMenu("home");
  }

  private closeAccountModal() {
    this.accountModalOpen = false;
    this.profileEditMode = "summary";
    this.renderMenu("home");
  }

  private async saveAccountProfile() {
    if (this.accountBusy || !this.backend.isLoggedIn) return;
    const nameInput = this.menuScreen.querySelector<HTMLInputElement>("[data-profile-name]");
    const fallbackName = this.backend.accountInfo.nickname || `用户 ${this.backend.accountInfo.shortId}`;
    const nickname = (nameInput?.value ?? fallbackName).trim();
    if (!nickname) {
      this.menuNotice = "昵称不能为空";
      this.profileEditMode = "name";
      this.renderMenu("home");
      return;
    }
    this.accountBusy = true;
    this.menuNotice = "正在保存资料...";

    try {
      const profile = await this.backend.updateProfile({
        nickname,
        avatar: this.profileAvatarDraft,
      });
      this.menuNotice = `资料已更新 · ${profile.nickname}`;
      this.accountModalOpen = false;
      this.profileEditMode = "summary";
    } catch {
      this.menuNotice = "资料保存失败，请稍后再试";
    } finally {
      this.accountBusy = false;
      this.renderMenu("home");
    }
  }

  private switchAccount() {
    if (this.accountBusy) return;
    const confirmed = window.confirm("切换账号会退出当前游客账号，并回到未登录状态。继续吗？");
    if (!confirmed) return;

    this.backend.switchAccount();
    this.save = defaultSave();
    this.applyBattlePreferences();
    saveGame(this.save);
    this.accountModalOpen = false;
    this.loginModalOpen = true;
    this.profileAvatarDraft = this.accountAvatarCharacter(this.backend.accountInfo.avatar).id;
    this.profileEditMode = "summary";
    this.menuNotice = "已切换账号，请登录";
    this.renderMenu("home");
  }

  private bindEvents() {
    window.addEventListener("resize", () => this.resizeCanvas());

    this.speedButton.addEventListener("click", () => {
      if (!this.session) return;
      this.sound.play("ui");
      const next: Speed = this.session.speed === 1 ? 2 : this.session.speed === 2 ? 4 : 1;
      this.session.speed = next;
      this.speedButton.textContent = `${next}x`;
      this.saveBattlePreferences();
    });

    this.autoButton.addEventListener("click", () => {
      if (!this.session) return;
      this.sound.play("ui");
      this.autoBattleEnabled = !this.autoBattleEnabled;
      this.autoPanel.classList.remove("hidden");
      this.updateAutoUi();
      this.saveBattlePreferences();
    });

    this.battleHud.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-auto-close]")) {
        this.sound.play("ui");
        this.autoPanel.classList.add("hidden");
        return;
      }

      if (target.closest("[data-auto-toggle]")) {
        this.sound.play("confirm");
        this.autoBattleEnabled = !this.autoBattleEnabled;
        this.updateAutoUi();
        this.saveBattlePreferences();
        return;
      }

      const mode = target.closest<HTMLElement>("[data-auto-mode]")?.dataset.autoMode as AutoUpgradeMode | undefined;
      if (mode) {
        this.sound.play("ui");
        this.autoUpgradeMode = mode;
        this.updateAutoUi();
        this.saveBattlePreferences();
        return;
      }

      const extractionMode = target.closest<HTMLElement>("[data-auto-extraction]")?.dataset.autoExtraction as
        | AutoExtractionMode
        | undefined;
      if (extractionMode) {
        this.sound.play("ui");
        this.autoExtractionMode = extractionMode;
        this.updateAutoUi();
        this.saveBattlePreferences();
        return;
      }

      const runMode = target.closest<HTMLElement>("[data-auto-run]")?.dataset.autoRun as AutoRunMode | undefined;
      if (runMode) {
        this.sound.play("ui");
        this.autoRunMode = runMode;
        this.updateAutoUi();
        this.saveBattlePreferences();
        return;
      }

      if (target.closest("[data-auto-skill]")) {
        this.sound.play("ui");
        this.autoSkillEnabled = !this.autoSkillEnabled;
        this.updateAutoUi();
        this.saveBattlePreferences();
        return;
      }

      if (target.closest("[data-tactic-toggle]")) {
        this.sound.play("ui");
        this.tacticPanelExpanded = !this.tacticPanelExpanded;
        this.updateTacticPanelState();
      }
    });

    this.pauseButton.addEventListener("click", () => {
      if (this.phase !== "playing") return;
      this.sound.play("ui");
      this.openPause();
    });

    this.canvas.addEventListener("pointerdown", (event) => {
      this.handleCanvasPointer(event);
    });

    this.menuScreen.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      if (target.closest("button")) this.sound.play("ui", 40);
      const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
      const accountAction = target.closest<HTMLElement>("[data-account-action]")?.dataset.accountAction;
      const loginAction = target.closest<HTMLElement>("[data-login-action]")?.dataset.loginAction;
      const avatarChoice = target.closest<HTMLElement>("[data-avatar-choice]")?.dataset.avatarChoice;
      const menuView = target.closest<HTMLElement>("[data-menu]")?.dataset.menu as MenuView | undefined;
      const warehouseTab = target.closest<HTMLElement>("[data-warehouse-tab]")?.dataset.warehouseTab as
        | WarehouseTab
        | undefined;
      const protocolTab = target.closest<HTMLElement>("[data-protocol-tab]")?.dataset.protocolTab as
        | ProtocolTab
        | undefined;
      const collectionTab = target.closest<HTMLElement>("[data-collection-tab]")?.dataset.collectionTab as
        | CollectionTab
        | undefined;
      const collectionEntry = target.closest<HTMLElement>("[data-collection-entry]")?.dataset.collectionEntry;
      const collectionClaim = target.closest<HTMLElement>("[data-collection-claim]")?.dataset.collectionClaim;
      const collectionClaimAll = target.closest("[data-collection-claim-all]");
      const warehouseItem = target.closest<HTMLElement>("[data-warehouse-item]");
      const shopTab = target.closest<HTMLElement>("[data-shop-tab]")?.dataset.shopTab as ShopCategory | undefined;
      const shopBuy = target.closest<HTMLElement>("[data-shop-buy]")?.dataset.shopBuy;
      const stageSelect = target.closest<HTMLElement>("[data-stage-select]")?.dataset.stageSelect;
      const upgradeId = target.closest<HTMLElement>("[data-buy]")?.dataset.buy;
      const heroSelect = target.closest<HTMLElement>("[data-hero-select]")?.dataset.heroSelect;
      const heroLevel = target.closest<HTMLElement>("[data-hero-level]")?.dataset.heroLevel;
      const heroSkillLevel = target.closest<HTMLElement>("[data-hero-skill-level]")?.dataset.heroSkillLevel;
      const heroLineupPicker = target.closest<HTMLElement>("[data-hero-lineup-picker]")?.dataset.heroLineupPicker;
      const heroLineupSlotButton = target.closest<HTMLElement>("[data-hero-lineup-slot]");
      const heroLineupRemove = target.closest<HTMLElement>("[data-hero-lineup-remove]")?.dataset.heroLineupRemove;
      const heroSort = target.closest<HTMLElement>("[data-hero-sort]")?.dataset.heroSort as CharacterSortMode | undefined;
      const heroDetailTab = target.closest<HTMLElement>("[data-hero-detail-tab]")?.dataset.heroDetailTab as
        | HeroDetailTab
        | undefined;
      const heroMarbleSlot = target.closest<HTMLElement>("[data-hero-marble-slot]")?.dataset.heroMarbleSlot;
      const heroMarbleEquipButton = target.closest<HTMLElement>("[data-hero-marble-equip]");
      const heroMarblePickerClose = target.closest("[data-hero-marble-picker-close]");
      const routeButton = target.closest<HTMLElement>("[data-hero-route]");
      const marbleUpgrade = target.closest<HTMLElement>("[data-marble-upgrade]")?.dataset.marbleUpgrade as
        | MarbleId
        | undefined;
      const sellCollectible = target.closest<HTMLElement>("[data-sell-collectible]")?.dataset.sellCollectible as
        | CollectibleId
        | undefined;
      const equipGemButton = target.closest<HTMLElement>("[data-gem-equip]");
      const unequipGem = target.closest<HTMLElement>("[data-gem-unequip]")?.dataset.gemUnequip;
      const fuseGem = target.closest<HTMLElement>("[data-gem-fuse]")?.dataset.gemFuse;
      if (target.closest("[data-hero-modal-close]")) {
        this.closeHeroModal();
        return;
      }
      if (target.dataset.battleTerminalBackdrop !== undefined) {
        this.battleTerminalOpen = false;
        this.renderMenu("home");
        return;
      }
      if (target.dataset.warehouseDetailBackdrop !== undefined || target.closest("[data-warehouse-detail-close]")) {
        this.warehouseDetail = null;
        this.renderMenu("inventory");
        return;
      }
      if (target.dataset.collectionDetailBackdrop !== undefined || target.closest("[data-collection-detail-close]")) {
        this.collectionDetailKey = null;
        this.renderMenu("collection");
        return;
      }
      if (collectionClaim) {
        this.claimCollectionReward(collectionClaim);
        return;
      }
      if (collectionClaimAll) {
        this.claimAllCollectionRewards();
        return;
      }
      if (collectionEntry) {
        this.collectionDetailKey = collectionEntry;
        this.renderMenu("collection");
        return;
      }
      if (heroSort) {
        this.setCharacterSortMode(heroSort);
        return;
      }
      if (heroDetailTab) {
        this.heroDetailTab = heroDetailTab;
        this.heroLineupPickerOpen = false;
        if (heroDetailTab !== "marbles") this.heroMarblePickerOpen = false;
        this.renderMenu("heroes");
        return;
      }
      if (heroMarbleSlot !== undefined) {
        this.heroLineupPickerOpen = false;
        this.heroMarbleSlot = clamp(Math.floor(Number(heroMarbleSlot)), 0, 1);
        this.heroMarblePickerOpen = true;
        this.renderMenu("heroes");
        return;
      }
      if (heroMarblePickerClose) {
        this.heroMarblePickerOpen = false;
        this.renderMenu("heroes");
        return;
      }
      if (heroMarbleEquipButton) {
        const heroId = heroMarbleEquipButton.dataset.heroId;
        const marbleId = heroMarbleEquipButton.dataset.heroMarbleEquip as MarbleId | undefined;
        if (heroId && marbleId) this.equipCharacterMarble(heroId, marbleId);
        return;
      }
      if (heroLineupPicker) {
        this.heroLineupPickerOpen = !this.heroLineupPickerOpen;
        this.heroMarblePickerOpen = false;
        this.renderMenu("heroes");
        return;
      }
      if (heroLineupSlotButton) {
        const heroId = heroLineupSlotButton.dataset.heroId;
        const slot = Number(heroLineupSlotButton.dataset.heroLineupSlot);
        if (heroId) this.placeLineupCharacter(heroId, slot);
        return;
      }
      if (heroLineupRemove) {
        this.removeLineupCharacter(heroLineupRemove);
        return;
      }
      if (heroSelect) {
        this.openHeroModal(heroSelect);
        return;
      }
      if (heroLevel) {
        this.buyCharacterLevel(heroLevel);
        return;
      }
      if (heroSkillLevel) {
        this.buyCharacterSkillLevel(heroSkillLevel);
        return;
      }
      if (routeButton) {
        const heroId = routeButton.dataset.heroId;
        const routeId = routeButton.dataset.heroRoute as CharacterRouteId | undefined;
        if (heroId && routeId) this.buyCharacterRoute(heroId, routeId);
        return;
      }
      if (marbleUpgrade) {
        this.upgradeMarble(marbleUpgrade);
        return;
      }
      if (sellCollectible) {
        this.sellCollectible(sellCollectible);
        return;
      }
      if (action === "sellAll") {
        this.sellAllCollectibles();
        return;
      }
      if (equipGemButton) {
        const key = equipGemButton.dataset.gemEquip;
        const slot = Number(equipGemButton.dataset.gemSlot);
        if (key) this.equipGem(key, slot);
        return;
      }
      if (unequipGem !== undefined) {
        this.unequipGem(Number(unequipGem));
        return;
      }
      if (fuseGem) {
        this.fuseGem(fuseGem);
        return;
      }
      if (target.dataset.accountBackdrop !== undefined) {
        this.closeAccountModal();
        return;
      }
      if (target.dataset.loginBackdrop !== undefined) {
        this.closeLoginModal();
        return;
      }
      if (loginAction === "close") {
        this.closeLoginModal();
        return;
      }
      if (loginAction === "login" || loginAction === "register") {
        void this.submitPasswordLogin(loginAction);
        return;
      }
      if (avatarChoice) {
        this.profileAvatarDraft = this.accountAvatarCharacter(avatarChoice).id;
        if (this.accountModalOpen && this.profileEditMode === "avatar") {
          this.renderMenu("home");
          return;
        }
        this.menuScreen.querySelectorAll("[data-avatar-choice]").forEach((button) => {
          button.classList.toggle("active", (button as HTMLElement).dataset.avatarChoice === this.profileAvatarDraft);
        });
        const preview = this.menuScreen.querySelector<HTMLElement>("[data-profile-avatar-preview]");
        if (preview) {
          preview.setAttribute("style", this.accountAvatarStyle(this.profileAvatarDraft));
          preview.innerHTML = this.accountAvatarImageHtml(this.profileAvatarDraft, "account-profile-avatar-img");
        }
        return;
      }
      if (accountAction === "close") {
        this.closeAccountModal();
        return;
      }
      if (accountAction === "edit-name") {
        this.profileEditMode = "name";
        this.renderMenu("home");
        return;
      }
      if (accountAction === "edit-avatar") {
        this.profileAvatarDraft = this.accountAvatarCharacter(this.backend.accountInfo.avatar).id;
        this.profileEditMode = "avatar";
        this.renderMenu("home");
        return;
      }
      if (accountAction === "cancel-edit") {
        this.profileAvatarDraft = this.accountAvatarCharacter(this.backend.accountInfo.avatar).id;
        this.profileEditMode = "summary";
        this.renderMenu("home");
        return;
      }
      if (accountAction === "save") {
        void this.saveAccountProfile();
        return;
      }
      if (accountAction === "switch") {
        this.switchAccount();
        return;
      }
      if (stageSelect) {
        this.selectStage(stageSelect);
        return;
      }
      if (warehouseTab) {
        this.warehouseTab = warehouseTab;
        this.warehouseDetail = null;
        this.renderMenu("inventory");
        return;
      }
      if (protocolTab) {
        this.protocolTab = protocolTab;
        this.renderMenu("protocols");
        return;
      }
      if (collectionTab) {
        this.collectionTab = collectionTab;
        this.collectionDetailKey = null;
        this.renderMenu("collection");
        return;
      }
      if (warehouseItem) {
        const tab = warehouseItem.dataset.warehouseItemType as WarehouseTab | undefined;
        const key = warehouseItem.dataset.warehouseItem;
        if (tab && key) {
          this.warehouseDetail = { tab, key };
          this.renderMenu("inventory");
        }
        return;
      }
      if (shopTab) {
        this.shopTab = shopTab;
        this.renderMenu("roulette");
        return;
      }
      if (shopBuy) {
        this.buyShopItem(shopBuy);
        return;
      }
      if (target.closest("[data-shop-refresh-shards]")) {
        this.refreshShopShards();
        return;
      }
      if (action === "openBattleTerminal") {
        this.battleTerminalOpen = true;
        this.renderMenu("home");
        return;
      }
      if (action === "closeBattleTerminal") {
        this.battleTerminalOpen = false;
        this.renderMenu("home");
        return;
      }
      if (menuView) {
        this.renderMenu(menuView);
        return;
      }
      if (action === "account-profile") {
        this.openAccountModal();
        return;
      }
      if (action === "login") {
        this.openLoginModal();
        return;
      }
      if (action === "toggleSound") {
        this.sound.toggle();
        this.renderMenu("settings");
        return;
      }
      if (action === "toggleMusic") {
        this.sound.toggleMusic();
        this.renderMenu("settings");
        return;
      }
      if (action === "redeemCode") {
        void this.redeemCode();
        return;
      }
      if (action === "start") {
        this.startGame();
        return;
      }
      if (action === "startEndless") {
        this.startGame("endless");
        return;
      }
      if (action === "reset") {
        this.resetSave();
        return;
      }
      if (upgradeId) this.buyMetaUpgrade(upgradeId);
    });

    this.menuScreen.addEventListener("input", (event) => {
      const input = event.target as HTMLInputElement;
      if (input.dataset.sfxVolume !== undefined) {
        this.sound.setSfxVolume(Number(input.value) / 100);
        this.updateAudioVolumeLabel("sfx", this.sound.sfxVolumePercent);
        return;
      }
      if (input.dataset.musicVolume !== undefined) {
        this.sound.setMusicVolume(Number(input.value) / 100);
        this.updateAudioVolumeLabel("music", this.sound.musicVolumePercent);
      }
    });

    this.menuScreen.addEventListener("change", (event) => {
      const input = event.target as HTMLInputElement;
      if (input.dataset.sfxVolume !== undefined) this.sound.play("confirm");
    });

    this.upgradeScreen.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const refresh = target.closest<HTMLElement>("[data-upgrade-refresh]");
      if (refresh) {
        if (this.refreshUpgradeChoices()) this.sound.play("ui");
        return;
      }
      const choiceIndex = target.closest<HTMLElement>("[data-choice]")?.dataset.choice;
      if (choiceIndex !== undefined) {
        this.sound.play("ui");
        this.pickUpgrade(Number(choiceIndex));
      }
    });

    this.extractionScreen.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const action = target.closest<HTMLElement>("[data-extraction-action]")?.dataset.extractionAction;
      if (action === "extract") {
        this.sound.play("confirm");
        this.extractNow();
      }
      if (action === "continue") {
        this.sound.play("start");
        this.continueRun();
      }
    });

    this.resultScreen.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
      if (target.closest("button")) this.sound.play("ui", 40);
      if (action === "again") this.startGame(this.session?.mode || "normal");
      if (action === "next") this.startNextResultStage();
      if (action === "retry") this.retryResultStage();
      if (action === "menu" || action === "upgrade") this.renderMenu("home");
    });

    this.pauseScreen.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const action = target.closest<HTMLElement>("[data-action]")?.dataset.action;
      if (target.closest("button")) this.sound.play("ui", 40);
      if (action === "resume") this.closePause();
      if (action === "restart") this.startGame(this.session?.mode || "normal");
      if (action === "menu") this.renderMenu();
    });

    this.lootBag.addEventListener("click", () => {
      if (!this.session || this.phase === "menu" || this.phase === "result") return;
      this.sound.play("ui");
      this.openLootScreen();
    });

    this.lootScreen.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const insureKey = target.closest<HTMLElement>("[data-insure-drop]")?.dataset.insureDrop;
      if (insureKey) {
        this.sound.play("confirm");
        this.toggleInsuredDrop(insureKey);
        return;
      }
      if (target === this.lootScreen || target.closest("[data-loot-close]")) {
        this.sound.play("ui");
        this.closeLootScreen();
      }
    });
  }

  private resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(WIDTH * dpr);
    this.canvas.height = Math.floor(HEIGHT * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const scale = Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT, 1);
    this.surface.style.transform = `translateX(-50%) scale(${scale})`;
  }

  private loop(time: number) {
    const realDt = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;

    if (this.session && this.phase === "playing") {
      this.update(realDt * this.session.speed, realDt);
    }

    this.draw();
    this.updateHud();
    requestAnimationFrame((next) => this.loop(next));
  }

  private startGame(mode: BattleMode = "normal") {
    if (!this.canPlay()) {
      this.sound.play("lose");
      this.menuNotice = "账号同步中，请稍候";
      this.renderMenu("home");
      return;
    }

    const stage = this.currentStage();
    if (stage.index > this.save.progress.unlockedStage) {
      this.sound.play("lose");
      this.menuNotice = "该关卡尚未解锁";
      this.save.selectedStage = getStageByIndex(this.save.progress.unlockedStage).id;
      this.persistSave("stage-lock");
      this.renderMenu("home");
      return;
    }

    const upgrades = this.save.upgrades;
    const gemModifiers = this.baseGemModifiers();
    const skillHaste = clamp(1 - upgradeLevel(upgrades, "skillHaste") * 0.02 - gemModifiers.skillHaste, 0.55, 1.3);
    this.save.lineup = normalizeLineup(this.save.lineup, this.save.characters);
    this.save.characterMarbles = normalizeCharacterMarbles(this.save.characterMarbles);
    const battleCharacters = this.lineupCharacters();
    const hasTeamPassive = (passiveId: string) => battleCharacters.some((character) => this.passiveUnlocked(character.id, passiveId));
    const maxBaseHp =
      10 +
      Math.floor(upgradeLevel(upgrades, "baseHealth") / 3) +
      gemModifiers.baseHp +
      (hasTeamPassive("sentinel_wall") ? 1 : 0);
    const runtimeCharacters = battleCharacters.map((char, index) => {
      const x = FIELD.x + FIELD.w * ([0.32, 0.5, 0.68][index] || 0.5);
      const marbles = this.characterMarbles(char);
      const cooldowns = Object.fromEntries(marbles.map((id) => [id, 0])) as Record<MarbleId, number>;
      const battleStats = this.characterBattleStats(char);
      return {
        ...char,
        marbles,
        x,
        y: FIELD_BOTTOM - CHARACTER_BASE_OFFSET,
        cooldowns,
        skillTimer: char.skillCooldown * skillHaste * battleStats.skillCooldownMul * 0.55,
        skillActive: 0,
      };
    });

    const session: Session = {
      phase: "playing",
      mode,
      stageId: stage.id,
      wave: 0,
      waveConfig: null,
      spawnQueue: [],
      spawnTimer: 0,
      waveBannerTimer: 0,
      elapsed: 0,
      speed: this.save.preferences.battleSpeed,
      baseHp: maxBaseHp,
      maxBaseHp,
      level: 1,
      xp: upgradeLevel(upgrades, "initialXp") * 4,
      xpNeed: xpNeedForLevel(1),
      coins: 0,
      kills: 0,
      result: null,
      resultReason: "",
      entities: 1,
      characters: runtimeCharacters,
      enemies: [],
      marbles: [],
      particles: [],
      effects: [],
      dropVisuals: [],
      pendingChoices: [],
      selectedUpgradeIds: [],
      drops: [],
      insuredDropKeys: [],
      extractionWindowsSeen: [],
      extractionResult: "none",
      extractedAtWave: null,
      lostDrops: [],
      heat: 0,
      maxHeat: 0,
      continueCount: 0,
      continueBonus: 0,
      tacticState: createDefaultTacticalState(),
      modifiers: {
        damageMul: (1 + upgradeLevel(upgrades, "teamDamage") * 0.03) * (1 + gemModifiers.damage),
        fireRateMul: (1 + upgradeLevel(upgrades, "fireRate") * 0.02) * (1 + gemModifiers.fireRate),
        marbleSpeedMul: 1,
        critChance: clamp(0.05 + upgradeLevel(upgrades, "critCore") * 0.008 + gemModifiers.critChance, 0.05, 0.85),
        critDamage: 1.5 + gemModifiers.critDamage,
        coinMul: (1 + upgradeLevel(upgrades, "coinGain") * 0.03) * (1 + gemModifiers.coin + (hasTeamPassive("treasurer_circuit") ? 0.08 : 0)),
        expMul: 1 + gemModifiers.exp,
        blastRadiusMul: 1,
        burnMul: 1,
        chainBonus: 0,
        slowBonus: 0,
        globalPierce: 0,
        bounceDamage: 0,
        baseRegen: hasTeamPassive("sentinel_repair") ? 1 : 0,
        revive: false,
        magnetic: 0,
        dropLuck: gemModifiers.drop + (hasTeamPassive("treasurer_instinct") ? 0.05 : 0),
        tagDamage: {},
        marbleDamage: {},
        cardStacks: {},
      },
    };

    this.session = session;
    this.phase = "playing";
    this.speedButton.textContent = `${session.speed}x`;
    this.autoPanel.classList.add("hidden");
    this.updateAutoUi();
    this.hideScreens();
    this.battleHud.classList.remove("hidden");
    this.bottomHud.classList.remove("hidden");
    this.lootBag.classList.remove("hidden");
    this.tacticPanel.classList.remove("hidden");
    this.tacticPanelExpanded = false;
    this.activeBattleId = null;
    void this.backend
      .startBattle({
        mode,
        stage: stage.index,
        lineup: this.save.lineup,
        baseGems: this.save.baseGems,
        characterMarbles: this.save.characterMarbles,
      })
      .then((battle) => {
        this.activeBattleId = battle?.battleId || null;
      });
    this.updateTacticPanelState();
    this.updateTacticPanel();
    this.sound.setMusicMode("battle");
    this.sound.play("start");
    this.startWave(1);
  }

  private resetSave() {
    this.save = defaultSave();
    this.applyBattlePreferences();
    this.persistSave("reset");
    this.renderMenu();
  }

  private persistSave(reason = "state") {
    saveGame(this.save);
    void this.backend.saveState(this.save, reason);
  }

  private async redeemCode() {
    if (this.redeemBusy) return;
    const input = this.menuScreen.querySelector<HTMLInputElement>("[data-redeem-code]");
    const code = input?.value.trim() || "";

    if (!code) {
      this.redeemNotice = "请输入兑换码";
      this.renderMenu("settings");
      return;
    }

    if (!this.backend.isLoggedIn) {
      this.redeemNotice = "请先登录账号后兑换";
      this.openLoginModal();
      return;
    }

    this.redeemBusy = true;
    try {
      const result = await this.backend.redeemCode(code);
      this.save = result.save;
      saveGame(this.save);
      this.redeemNotice = `兑换成功：${result.rewardText || result.title}`;
      this.menuNotice = this.redeemNotice;
      this.sound.play("confirm");
    } catch (error) {
      this.redeemNotice = error instanceof Error ? error.message : "兑换失败，请稍后再试";
      this.sound.play("lose");
    } finally {
      this.redeemBusy = false;
      this.renderMenu("settings");
    }
  }

  private applyBattlePreferences() {
    const preferences = this.save.preferences;
    this.autoBattleEnabled = preferences.autoBattleEnabled;
    this.autoUpgradeMode = preferences.autoUpgradeMode;
    this.autoExtractionMode = preferences.autoExtractionMode;
    this.autoRunMode = preferences.autoRunMode;
    this.autoSkillEnabled = preferences.autoSkillEnabled;
    this.characterSortMode = preferences.characterSortMode;

    if (this.session) {
      this.session.speed = preferences.battleSpeed;
      this.speedButton.textContent = `${preferences.battleSpeed}x`;
    }

    this.updateAutoUi();
  }

  private saveBattlePreferences() {
    this.save.preferences = {
      autoBattleEnabled: this.autoBattleEnabled,
      autoUpgradeMode: this.autoUpgradeMode,
      autoExtractionMode: this.autoExtractionMode,
      autoRunMode: this.autoRunMode,
      autoSkillEnabled: this.autoSkillEnabled,
      battleSpeed: this.session?.speed ?? this.save.preferences.battleSpeed,
      characterSortMode: this.characterSortMode,
    };
    this.persistSave("battle-preferences");
  }

  private unlockReadyCharacters() {
    const unlocked = syncCharacterUnlocks(this.save);
    if (unlocked.length > 0) {
      this.save.lineup = normalizeLineup(this.save.lineup, this.save.characters);
      this.menuNotice = `新角色解锁：${unlocked.map((character) => character.name).join("、")}`;
    }
    return unlocked;
  }

  private currentStage(): StageConfig {
    const stage = getStageById(this.save.selectedStage);
    if (stage.index > this.save.progress.unlockedStage) return getStageByIndex(this.save.progress.unlockedStage);
    return stage;
  }

  private selectStage(stageId: string) {
    const stage = getStageById(stageId);
    if (stage.index > this.save.progress.unlockedStage) {
      this.menuNotice = "该关卡尚未解锁";
      this.renderMenu("home");
      return;
    }

    this.save.selectedStage = stage.id;
    this.menuNotice = "";
    this.persistSave("stage-select");
    this.renderMenu("home");
  }

  private retryResultStage() {
    const stageId = this.session?.stageId;
    const mode = this.session?.mode || "normal";
    if (stageId) {
      this.save.selectedStage = stageId;
      this.persistSave("stage-retry");
    }
    this.startGame(mode);
  }

  private startNextResultStage() {
    const stage = getStageById(this.session?.stageId);
    if (stage.index >= stages.length) return;

    this.save.selectedStage = getStageByIndex(stage.index + 1).id;
    this.persistSave("stage-next");
    this.startGame();
  }

  private claimCollectionReward(key: string) {
    const entry = this.collectionEntryByKey(key);
    if (!entry || entry.state !== "known" || this.save.collectionRewards[key]) return;

    this.save.collectionRewards[key] = true;
    this.save.coins += entry.reward.coins;
    if (entry.reward.energyCrystals) this.save.energyCrystals += entry.reward.energyCrystals;
    this.menuNotice = `图鉴奖励：${entry.title} +${this.collectionRewardText(entry.reward)}`;
    this.persistSave("collection-reward");
    this.renderMenu("collection");
  }

  private claimAllCollectionRewards() {
    const entries = this.collectionAllEntries().filter((entry) => entry.state === "known" && !this.save.collectionRewards[entry.key]);
    if (entries.length <= 0) {
      this.menuNotice = "当前没有可领取的图鉴奖励";
      this.renderMenu("collection");
      return;
    }

    const reward = entries.reduce<CollectionReward>(
      (total, entry) => ({
        coins: total.coins + entry.reward.coins,
        energyCrystals: (total.energyCrystals || 0) + (entry.reward.energyCrystals || 0),
      }),
      { coins: 0, energyCrystals: 0 },
    );

    for (const entry of entries) {
      this.save.collectionRewards[entry.key] = true;
    }
    this.save.coins += reward.coins;
    if (reward.energyCrystals) this.save.energyCrystals += reward.energyCrystals;
    this.collectionDetailKey = null;
    this.menuNotice = `一键领取 ${entries.length} 项图鉴奖励：+${this.collectionRewardText(reward)}`;
    this.persistSave("collection-reward-all");
    this.renderMenu("collection");
  }

  private buyMetaUpgrade(id: string) {
    const upgrade = metaUpgrades.find((item) => item.id === id);
    if (!upgrade) return;

    const current = upgradeLevel(this.save.upgrades, id);
    if (current >= upgrade.max) return;

    const cost = metaCost(upgrade, current);
    if (this.save.coins < cost) return;

    this.save.coins -= cost;
    this.save.upgrades[id] = current + 1;
    this.persistSave();
    this.renderMenu(this.menuView);
  }

  private buyCharacterLevel(id: string) {
    const progress = this.characterProgress(id);
    if (!progress.owned || progress.level >= HERO_MAX_LEVEL) return;

    const cost = characterLevelCost(progress.level);
    if (this.save.coins < cost) return;

    this.save.coins -= cost;
    progress.level += 1;
    this.persistSave();
    this.renderMenu("heroes");
  }

  private buyCharacterSkillLevel(id: string) {
    const progress = this.characterProgress(id);
    if (!progress.owned || progress.skillLevel >= CHARACTER_SKILL_MAX_LEVEL) return;

    const cost = characterSkillCost(progress.skillLevel);
    if (this.save.coins < cost) return;

    this.save.coins -= cost;
    progress.skillLevel += 1;
    this.menuNotice = `${characters.find((item) => item.id === id)?.skillName || "主动技能"} 升至 Lv.${progress.skillLevel}`;
    this.persistSave();
    this.renderMenu("heroes");
  }

  private buyCharacterRoute(id: string, routeId: CharacterRouteId) {
    const character = characters.find((item) => item.id === id);
    const route = character?.routes.find((item) => item.id === routeId);
    if (!character || !route) return;

    const progress = this.characterProgress(id);
    if (!progress.owned) return;

    const current = progress.routes[routeId] || 0;
    if (current >= route.max) return;

    const cost = characterRouteCost(route, current);
    if (this.save.coins < cost) return;

    this.save.coins -= cost;
    progress.routes[routeId] = current + 1;
    this.persistSave();
    this.renderMenu("heroes");
  }

  private upgradeMarble(id: MarbleId) {
    const level = this.marbleLevel(id);
    if (level >= MARBLE_MAX_LEVEL) return;

    const inventory = this.inventory();
    const cost = marbleShardCost(level);
    const owned = inventory.marbleShards[id] || 0;
    if (owned < cost) return;

    inventory.marbleShards[id] = owned - cost;
    this.save.marbleLevels[id] = level + 1;
    this.menuNotice = `${marbleConfigs[id].name} 升至 Lv.${level + 1}`;
    this.persistSave();
    this.renderMenu("marbles");
  }

  private sellCollectible(id: CollectibleId) {
    const inventory = this.inventory();
    const count = inventory.collectibles[id] || 0;
    if (count <= 0) return;

    const config = collectibleConfigs[id];
    const coins = count * config.value;
    inventory.collectibles[id] = 0;
    this.save.coins += coins;
    this.menuNotice = `出售 ${config.name} ×${count}，获得 ${coins} 金币`;
    this.warehouseDetail = null;
    this.persistSave();
    this.renderMenu("inventory");
  }

  private sellAllCollectibles() {
    const inventory = this.inventory();
    let total = 0;
    let count = 0;

    for (const item of Object.values(collectibleConfigs)) {
      const owned = inventory.collectibles[item.id] || 0;
      if (owned <= 0) continue;
      total += owned * item.value;
      count += owned;
      inventory.collectibles[item.id] = 0;
    }

    if (total <= 0) return;
    this.save.coins += total;
    this.menuNotice = `出售收藏品 ×${count}，获得 ${total} 金币`;
    this.warehouseDetail = null;
    this.persistSave();
    this.renderMenu("inventory");
  }

  private equipGem(key: string, slot: number) {
    const parsed = parseGemKey(key);
    if (!parsed) return;

    const inventory = this.inventory();
    if ((inventory.gems[key] || 0) <= 0) return;

    const safeSlot = Number.isFinite(slot) && slot >= 0 && slot < BASE_GEM_SLOTS ? Math.floor(slot) : this.firstEmptyGemSlot();
    if (safeSlot < 0) return;

    const current = this.save.baseGems[safeSlot];
    if (current) {
      inventory.gems[current] = (inventory.gems[current] || 0) + 1;
    }

    inventory.gems[key] -= 1;
    this.save.baseGems[safeSlot] = key;
    this.menuNotice = `${gemConfigs[parsed.type].name} Lv.${parsed.level} 已装备到 ${safeSlot + 1} 号槽`;
    this.persistSave();
    this.renderMenu("protocols");
  }

  private unequipGem(slot: number) {
    const safeSlot = Math.floor(slot);
    if (safeSlot < 0 || safeSlot >= BASE_GEM_SLOTS) return;

    const key = this.save.baseGems[safeSlot];
    if (!key) return;

    const inventory = this.inventory();
    inventory.gems[key] = (inventory.gems[key] || 0) + 1;
    this.save.baseGems[safeSlot] = null;
    this.menuNotice = `已卸下 ${gemLabel(key)}`;
    this.persistSave();
    this.renderMenu("protocols");
  }

  private fuseGem(key: string) {
    const parsed = parseGemKey(key);
    if (!parsed || parsed.level >= GEM_MAX_LEVEL) return;

    const inventory = this.inventory();
    if ((inventory.gems[key] || 0) < 2) return;

    inventory.gems[key] -= 2;
    const chance = gemFuseChance(parsed.level);
    const success = Math.random() < chance;

    if (success) {
      const nextKey = gemKey(parsed.type, parsed.level + 1);
      inventory.gems[nextKey] = (inventory.gems[nextKey] || 0) + 1;
      this.menuNotice = `合成成功：${gemLabel(nextKey)}`;
    } else {
      inventory.gems[key] = (inventory.gems[key] || 0) + 1;
      this.menuNotice = `合成失败，返还 ${gemLabel(key)} ×1`;
    }

    this.warehouseDetail = null;
    this.persistSave();
    this.renderMenu(this.menuView === "protocols" ? "protocols" : "inventory");
  }

  private firstEmptyGemSlot() {
    return this.save.baseGems.findIndex((key) => !key);
  }

  private inventory() {
    this.save.inventory ||= defaultInventory();
    this.save.inventory.collectibles ||= {};
    this.save.inventory.marbleShards ||= {};
    this.save.inventory.gems ||= {};
    this.save.marbleLevels ||= {};
    this.save.baseGems = normalizeBaseGems(this.save.baseGems);
    return this.save.inventory;
  }

  private shop() {
    return ensureShopState(this.save);
  }

  private buyShopItem(id: string) {
    const result = purchaseShopItem(this.save, id);
    this.menuNotice = result.message;
    if (result.ok) {
      this.sound.play("confirm");
      this.persistSave("shop-purchase");
    } else {
      this.sound.play("lose");
    }
    this.renderMenu("roulette");
  }

  private refreshShopShards() {
    const result = refreshShardShop(this.save);
    this.menuNotice = result.message;
    if (result.ok) {
      this.sound.play("confirm");
      this.persistSave("shop-refresh");
    } else {
      this.sound.play("lose");
    }
    this.shopTab = "growth";
    this.renderMenu("roulette");
  }

  private characterProgress(id: string) {
    const character = characters.find((item) => item.id === id);
    this.save.characters ||= {};
    this.save.characters[id] ||= defaultCharacterProgress(!character?.unlock);
    return this.save.characters[id];
  }

  private lineupCharacters() {
    this.save.lineup = normalizeLineup(this.save.lineup, this.save.characters);
    return this.save.lineup
      .map((id) => characters.find((character) => character.id === id))
      .filter((character): character is CharacterConfig => !!character)
      .slice(0, 3);
  }

  private characterMarbles(character: CharacterConfig) {
    this.save.characterMarbles = normalizeCharacterMarbles(this.save.characterMarbles);
    return this.save.characterMarbles[character.id] || character.marbles;
  }

  private equipCharacterMarble(characterId: string, marbleId: MarbleId) {
    const character = characters.find((item) => item.id === characterId);
    if (!character || !(marbleId in marbleConfigs)) return;

    const progress = this.characterProgress(character.id);
    if (!progress.owned) {
      this.menuNotice = "未解锁角色不能调整弹珠";
      this.renderMenu("heroes");
      return;
    }

    const slot = clamp(Math.floor(this.heroMarbleSlot), 0, 1);
    const loadout = [...this.characterMarbles(character)] as [MarbleId, MarbleId];
    const duplicateSlot = loadout.findIndex((id, index) => index !== slot && id === marbleId);

    if (duplicateSlot >= 0) {
      this.menuNotice = "同一角色不能重复装配同一种弹珠";
      this.renderMenu("heroes");
      return;
    }

    if (loadout[slot] === marbleId) {
      this.heroMarblePickerOpen = false;
      this.renderMenu("heroes");
      return;
    }

    loadout[slot] = marbleId;
    this.save.characterMarbles[character.id] = loadout;
    this.heroMarblePickerOpen = false;
    this.menuNotice = `${character.name} ${slot + 1}号槽已装配 ${marbleConfigs[marbleId].name}`;
    this.persistSave("character-marble");
    this.renderMenu("heroes");
  }

  private openHeroModal(id: string) {
    if (!characters.some((character) => character.id === id)) return;
    this.selectedCharacterId = id;
    this.heroModalCharacterId = id;
    this.heroDetailTab = "overview";
    this.heroLineupPickerOpen = false;
    this.heroMarbleSlot = 0;
    this.heroMarblePickerOpen = false;
    this.renderMenu("heroes");
  }

  private closeHeroModal() {
    this.heroModalCharacterId = null;
    this.renderMenu("heroes");
  }

  private placeLineupCharacter(id: string, slot: number) {
    const progress = this.characterProgress(id);
    if (!progress.owned) return;

    this.save.lineup = normalizeLineup(this.save.lineup, this.save.characters);
    const safeSlot = Math.floor(slot);
    if (safeSlot < 0 || safeSlot >= 3) return;
    const currentSlot = this.save.lineup.indexOf(id);

    if (currentSlot === safeSlot) {
      this.heroLineupPickerOpen = false;
      this.renderMenu("heroes");
      return;
    }

    if (currentSlot >= 0) {
      if (safeSlot >= this.save.lineup.length) return;
      const replaced = this.save.lineup[safeSlot];
      this.save.lineup[safeSlot] = id;
      this.save.lineup[currentSlot] = replaced;
    } else {
      if (safeSlot > this.save.lineup.length) return;

      if (safeSlot === this.save.lineup.length) {
        this.save.lineup.push(id);
      } else {
        this.save.lineup[safeSlot] = id;
      }
    }

    this.save.lineup = normalizeLineup(this.save.lineup, this.save.characters);
    this.selectedCharacterId = id;
    this.heroDetailTab = "overview";
    this.heroLineupPickerOpen = false;
    this.heroMarblePickerOpen = false;
    this.persistSave();
    this.renderMenu("heroes");
  }

  private removeLineupCharacter(id: string) {
    const progress = this.characterProgress(id);
    if (!progress.owned) return;

    this.save.lineup = normalizeLineup(this.save.lineup, this.save.characters);
    if (!this.save.lineup.includes(id)) return;

    if (this.save.lineup.length <= 1) {
      this.menuNotice = "至少需要保留 1 名出战角色";
      this.heroLineupPickerOpen = false;
      this.renderMenu("heroes");
      return;
    }

    this.save.lineup = this.save.lineup.filter((characterId) => characterId !== id);
    this.save.lineup = normalizeLineup(this.save.lineup, this.save.characters);
    this.selectedCharacterId = id;
    this.heroDetailTab = "overview";
    this.heroLineupPickerOpen = false;
    this.heroMarblePickerOpen = false;
    this.persistSave();
    this.renderMenu("heroes");
  }

  private setCharacterSortMode(mode: CharacterSortMode) {
    if (!characterSortModes.includes(mode)) return;
    this.characterSortMode = mode;
    this.save.preferences.characterSortMode = mode;
    this.persistSave("character-sort");
    this.renderMenu("heroes");
  }

  private characterRouteLevel(id: string, routeId: CharacterRouteId) {
    return this.characterProgress(id).routes[routeId] || 0;
  }

  private characterSkillLevel(id: string) {
    return clamp(Math.floor(this.characterProgress(id).skillLevel || 1), 1, CHARACTER_SKILL_MAX_LEVEL);
  }

  private characterSkillBonus(id: string) {
    return this.characterSkillLevel(id) - 1;
  }

  private passiveUnlocked(characterId: string, passiveId: string) {
    const character = characters.find((item) => item.id === characterId);
    const passive = character?.passives.find((item) => item.id === passiveId);
    return !!passive && this.characterProgress(characterId).level >= passive.unlockLevel;
  }

  private marbleLevel(id: MarbleId) {
    return clamp(Math.floor(this.save.marbleLevels?.[id] || 1), 1, MARBLE_MAX_LEVEL);
  }

  private marbleDamageLevelMul(id: MarbleId) {
    return 1 + (this.marbleLevel(id) - 1) * 0.045;
  }

  private requireSession() {
    if (!this.session) throw new Error("No active session.");
    return this.session;
  }
}

Object.assign(MarblesGame.prototype, gameMethods);

new MarblesGame();

function marbleIdSoundVariant(id: MarbleId) {
  return {
    basic: 0,
    split: 1,
    blast: 2,
    burn: 3,
    lightning: 4,
    slow: 5,
  }[id];
}
