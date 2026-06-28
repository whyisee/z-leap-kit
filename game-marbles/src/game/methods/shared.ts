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
} from "../../core/constants";
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
  CosmeticConfig,
  CosmeticDrawResult,
  CosmeticEffectIntensity,
  CosmeticGachaPool,
  CosmeticPoolId,
  CosmeticRarity,
  CosmeticTicketId,
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
  PvpInfoMessage,
  PvpInfoTab,
  PvpMiniEnemy,
  PvpMiniMarble,
  PvpOpponentState,
  PvpPressureType,
  PvpRankDivision,
  PvpRankMode,
  PvpRankProfile,
  PvpRankTier,
  PvpSessionState,
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
} from "../../core/types";
import { characters } from "../../config/characters";
import { cosmeticById, cosmeticConfigs, cosmeticPools, cosmeticsForPool } from "../../config/cosmetics";
import { collectibleConfigs, gemConfigs } from "../../config/loot";
import { enemyConfigs } from "../../config/enemies";
import { marbleConfigs } from "../../config/marbles";
import { metaUpgrades } from "../../config/meta-upgrades";
import { shopCategories } from "../../config/shop";
import { getStageById, getStageByIndex, stages } from "../../config/stages";
import { upgradeCards } from "../../config/upgrades";
import { byId } from "../../app/dom";
import { formatTime } from "../../core/format";
import { clamp, easeInOutCubic, easeOutCubic, lerp, rotate, roundRect } from "../../core/math";
import { randomChoice, randomRange } from "../../core/random";
import { rarityAutoScore, rarityColor, rarityName, rollRarity } from "../../core/rarity";
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
} from "../../state/save";
import { normalizeVelocity, reflectVelocity } from "../../systems/battle/physics";
import { densestPoint, nearestEnemy } from "../../systems/battle/targeting";
import { createPvpWave, createWave, enemyThreatRank } from "../../systems/battle/waves";
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
} from "../../systems/battle/modes";
import { applyBattleProgressToSave, battleCoinReward, battleShardReward, calculateStageStars } from "../../systems/battle/results";
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
} from "../../systems/loot/drops";
import { gemEffectText, gemFuseChance, gemKey, gemLabel, gemRarity, parseGemKey, sortedGemEntries } from "../../systems/loot/gems";
import {
  applyDropsToInventory,
  autoInsuredDropKeys,
  boostDropRarityForContinue,
  compactDropSummaryRows,
  dropSummaryRows,
  dropTotalValue,
  insuredDropCount as countInsuredDrops,
  splitDropsForExtraction,
  toggleInsuredDropKey,
  type DropSummaryItem,
} from "../../systems/loot/session-loot";
import { characterLevelCost, characterRouteCost, characterSkillCost } from "../../systems/meta/characters";
import { metaCost, upgradeLevel } from "../../systems/meta/base-upgrades";
import { marbleShardCost } from "../../systems/meta/marble-levels";
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
} from "../../systems/progression/tactical-upgrades";
import { xpNeedForLevel } from "../../systems/progression/xp";
import {
  applyPvpRankResult,
  pvpRankDeltaText,
  pvpRankDisplayLabel,
  pvpRankLabel,
  pvpRankMatchScore,
  pvpRankMeetsRequirement,
  pvpRankProgressRatio,
  pvpRankProgressText,
  pvpRankRecordText,
  pvpRankRequirementLabel,
  pvpRankSeasonText,
} from "../../systems/pvp/rank";
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
} from "../../systems/shop/offers";
import { upgradeCardHtml } from "../../ui/overlays/upgrade";
import { GameBackend } from "../../services/game-backend";
import { SoundManager } from "../../services/sound";

export const legacyAccountAvatarMap: Record<string, string> = {
  avatar_green: "engineer",
  avatar_yellow: "bomber",
  avatar_blue: "magnetist",
  avatar_violet: "prism",
  avatar_red: "alchemist",
};

export const defaultAccountAvatarId = "engineer";

export const characterSortModes: CharacterSortMode[] = ["power", "level", "rarity", "attack"];

export const characterSortLabels: Record<CharacterSortMode, string> = {
  power: "战力",
  level: "等级",
  rarity: "稀有度",
  attack: "攻击力",
};

export const navIconSources: Partial<Record<MenuView, string>> = {
  inventory: new URL("../../assets/nav/nav-inventory.png", import.meta.url).href,
  roulette: new URL("../../assets/nav/nav-shop.png", import.meta.url).href,
  home: new URL("../../assets/nav/nav-base.png", import.meta.url).href,
  heroes: new URL("../../assets/nav/nav-heroes.png", import.meta.url).href,
  marbles: new URL("../../assets/nav/nav-marbles.png", import.meta.url).href,
};

export const homeAssetSources = {
  background: new URL("../../assets/home/home-hub-background.webp", import.meta.url).href,
  battleTerminal: new URL("../../assets/home/entry-battle-terminal.png", import.meta.url).href,
  pvpArena: new URL("../../assets/home/entry-pvp-arena.png", import.meta.url).href,
  heroesBay: new URL("../../assets/home/entry-heroes-bay.png", import.meta.url).href,
  marbleWorkshop: new URL("../../assets/home/entry-marble-workshop.png", import.meta.url).href,
  inventoryVault: new URL("../../assets/home/entry-inventory-vault.png", import.meta.url).href,
  shopStation: new URL("../../assets/home/entry-shop-station.png", import.meta.url).href,
  protocolCore: new URL("../../assets/home/entry-protocol-core.png", import.meta.url).href,
  collectionRoom: new URL("../../assets/home/entry-collection-room.png", import.meta.url).href,
  cosmeticChamber: new URL("../../assets/home/entry-cosmetic-chamber.png", import.meta.url).href,
};

export const leaderboardIconSources: Record<string, string> = {
  duel: new URL("../../assets/leaderboards/icon-arena.png", import.meta.url).href,
  base: new URL("../../assets/leaderboards/icon-base.png", import.meta.url).href,
  character: new URL("../../assets/leaderboards/icon-character.png", import.meta.url).href,
  cosmetic: new URL("../../assets/leaderboards/icon-cosmetic.png", import.meta.url).href,
  campaign: new URL("../../assets/leaderboards/icon-campaign.png", import.meta.url).href,
  wealth: new URL("../../assets/leaderboards/icon-wealth.png", import.meta.url).href,
  achievement: new URL("../../assets/leaderboards/icon-achievement.png", import.meta.url).href,
  endless: new URL("../../assets/leaderboards/icon-endless.png", import.meta.url).href,
  battle_royale: new URL("../../assets/leaderboards/icon-battle-royale.png", import.meta.url).href,
};

export const cosmeticAssetSources = {
  pools: {
    character: new URL("../../assets/cosmetics/pool-character.webp", import.meta.url).href,
    marble: new URL("../../assets/cosmetics/pool-marble.webp", import.meta.url).href,
  },
  resources: {
    characterCosmetic: new URL("../../assets/cosmetics/resource-character-ticket.png", import.meta.url).href,
    marbleCosmetic: new URL("../../assets/cosmetics/resource-marble-ticket.png", import.meta.url).href,
    prismDust: new URL("../../assets/cosmetics/resource-prism-dust.png", import.meta.url).href,
    energyCrystal: new URL("../../assets/cosmetics/resource-energy-crystal.png", import.meta.url).href,
  },
  tabs: {
    character: new URL("../../assets/cosmetics/pool-tab-character.png", import.meta.url).href,
    marble: new URL("../../assets/cosmetics/pool-tab-marble.png", import.meta.url).href,
  },
  items: {
    character: {
      rare: new URL("../../assets/cosmetics/item-character-rare.png", import.meta.url).href,
      epic: new URL("../../assets/cosmetics/item-character-epic.png", import.meta.url).href,
      legendary: new URL("../../assets/cosmetics/item-character-legendary.png", import.meta.url).href,
    },
    marble: {
      rare: new URL("../../assets/cosmetics/item-marble-rare.png", import.meta.url).href,
      epic: new URL("../../assets/cosmetics/item-marble-epic.png", import.meta.url).href,
      legendary: new URL("../../assets/cosmetics/item-marble-legendary.png", import.meta.url).href,
    },
  },
};

export const characterPortraitSources: Record<string, string> = {
  engineer: new URL("../../assets/heroes/hero-engineer.png", import.meta.url).href,
  bomber: new URL("../../assets/heroes/hero-bomber.png", import.meta.url).href,
  magnetist: new URL("../../assets/heroes/hero-magnetist.png", import.meta.url).href,
  sentinel: new URL("../../assets/heroes/hero-sentinel.png", import.meta.url).href,
  prism: new URL("../../assets/heroes/hero-prism.png", import.meta.url).href,
  alchemist: new URL("../../assets/heroes/hero-alchemist.png", import.meta.url).href,
  frostseer: new URL("../../assets/heroes/hero-frostseer.png", import.meta.url).href,
  voidbinder: new URL("../../assets/heroes/hero-voidbinder.png", import.meta.url).href,
  treasurer: new URL("../../assets/heroes/hero-treasurer.png", import.meta.url).href,
};

export const battleBackgroundSources: Record<string, string> = {
  "1-normal": new URL("../../assets/battle-bg/chapter-1-normal.webp", import.meta.url).href,
  "1-boss": new URL("../../assets/battle-bg/chapter-1-boss.webp", import.meta.url).href,
  "2-normal": new URL("../../assets/battle-bg/chapter-2-normal.webp", import.meta.url).href,
  "2-boss": new URL("../../assets/battle-bg/chapter-2-boss.webp", import.meta.url).href,
  "3-normal": new URL("../../assets/battle-bg/chapter-3-normal.webp", import.meta.url).href,
  "3-boss": new URL("../../assets/battle-bg/chapter-3-boss.webp", import.meta.url).href,
  "4-normal": new URL("../../assets/battle-bg/chapter-4-normal.webp", import.meta.url).href,
  "4-boss": new URL("../../assets/battle-bg/chapter-4-boss.webp", import.meta.url).href,
  "5-normal": new URL("../../assets/battle-bg/chapter-5-normal.webp", import.meta.url).href,
  "5-boss": new URL("../../assets/battle-bg/chapter-5-boss.webp", import.meta.url).href,
};

export type WarehouseTab = "gems" | "shards" | "collectibles";
export type ProtocolTab = "gems" | "protocols";
export type HeroDetailTab = "overview" | "skills" | "marbles" | "routes" | "cosmetics";
export type ProfileEditMode = "summary" | "name" | "avatar";
export type CollectionTab = "characters" | "enemies" | "gems" | "marbles" | "loot" | "tactics" | "protocols" | "achievements" | "cosmetics";
export type CollectionReward = {
  coins: number;
  energyCrystals?: number;
};
export type CollectionEntry = {
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
export type CollectionAchievement = {
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
export type WarehouseDetail = {
  tab: WarehouseTab;
  key: string;
};


export type GameMethod = (this: any, ...args: any[]) => any;

export {
  BASE_GEM_SLOTS,
  CHARACTER_BASE_OFFSET,
  CHARACTER_SKILL_MAX_LEVEL,
  FIELD,
  FIELD_BOTTOM,
  FIELD_RIGHT,
  GEM_MAX_LEVEL,
  GameBackend,
  HEIGHT,
  HERO_MAX_LEVEL,
  LOOT_BAG_TARGET,
  MARBLE_MAX_LEVEL,
  SoundManager,
  WIDTH,
  applyBattleProgressToSave,
  applyDropsToInventory,
  applyPvpRankResult,
  autoInsuredDropKeys,
  battleCoinReward,
  battleShardReward,
  battleWaveBannerText,
  boostDropRarityForContinue,
  byId,
  calculateStageStars,
  characterLevelCost,
  characterRouteCost,
  characterSkillCost,
  characters,
  clamp,
  cosmeticById,
  cosmeticConfigs,
  cosmeticPools,
  cosmeticsForPool,
  collectibleConfigs,
  collectibleForRarity,
  combinedRarityBoost,
  compactDropSummaryRows,
  compactSelectedUpgrades,
  consumeRarityBoostUse,
  continuePreviewForSession,
  countInsuredDrops,
  createDefaultTacticalState,
  createPvpWave,
  createWave,
  defaultCharacterProgress,
  defaultInventory,
  defaultSave,
  densestPoint,
  dropAmount,
  dropGemLevel,
  dropIconFill,
  dropIconText,
  dropShardAmount,
  dropShortLabel,
  dropSummaryRows,
  dropTotalAmount,
  dropTotalValue,
  easeInOutCubic,
  easeOutCubic,
  enemyConfigs,
  enemyThreatRank,
  ensureShopState,
  ensureTacticalState,
  extractionDepthNameForSession,
  extractionResultEyebrowForMode,
  extractionResultTitleForMode,
  formatSessionWaveText,
  formatTime,
  gemConfigs,
  gemEffectText,
  gemFuseChance,
  gemKey,
  gemLabel,
  gemRarity,
  getStageById,
  getStageByIndex,
  isEndlessMode,
  isRunComplete,
  isUpgradeCardAvailable,
  lerp,
  loadSave,
  marbleConfigs,
  marbleShardCost,
  maxHeatForMode,
  metaCost,
  metaUpgrades,
  nearestEnemy,
  normalizeBaseGems,
  normalizeCharacterMarbles,
  normalizeLineup,
  normalizeVelocity,
  parseGemKey,
  pvpRankDeltaText,
  pvpRankDisplayLabel,
  pvpRankLabel,
  pvpRankMatchScore,
  pvpRankMeetsRequirement,
  pvpRankProgressRatio,
  pvpRankProgressText,
  pvpRankRecordText,
  pvpRankRequirementLabel,
  pvpRankSeasonText,
  purchaseShopItem,
  randomChoice,
  randomRange,
  rarityAutoScore,
  rarityColor,
  rarityName,
  reflectVelocity,
  refreshShardShop,
  rollDropRarity,
  rollRarity,
  rotate,
  roundRect,
  saveGame,
  shopCategories,
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
  shouldOpenExtractionWindowForSession,
  sortedGemEntries,
  splitDropsForExtraction,
  stages,
  syncCharacterUnlocks,
  tacticalCardWeight,
  toggleInsuredDropKey,
  upgradeCardHtml,
  upgradeCardTierLabel,
  upgradeCardTypeLabel,
  upgradeCards,
  upgradeLevel,
  xpNeedForLevel,
};

export type {
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
  CosmeticConfig,
  CosmeticDrawResult,
  CosmeticEffectIntensity,
  CosmeticGachaPool,
  CosmeticPoolId,
  CosmeticRarity,
  CosmeticTicketId,
  DropEntry,
  DropSummaryItem,
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
  PvpInfoMessage,
  PvpInfoTab,
  PvpMiniEnemy,
  PvpMiniMarble,
  PvpOpponentState,
  PvpPressureType,
  PvpRankDivision,
  PvpRankMode,
  PvpRankProfile,
  PvpRankTier,
  PvpSessionState,
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
};
