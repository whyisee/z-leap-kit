// @ts-nocheck

import {
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
  autoInsuredDropKeys,
  battleBackgroundSources,
  battleCoinReward,
  battleShardReward,
  battleWaveBannerText,
  boostDropRarityForContinue,
  byId,
  calculateStageStars,
  characterLevelCost,
  characterPortraitSources,
  characterRouteCost,
  characterSkillCost,
  characterSortLabels,
  characterSortModes,
  characters,
  clamp,
  collectibleConfigs,
  collectibleForRarity,
  combinedRarityBoost,
  compactDropSummaryRows,
  compactSelectedUpgrades,
  consumeRarityBoostUse,
  continuePreviewForSession,
  countInsuredDrops,
  createDefaultTacticalState,
  createWave,
  defaultAccountAvatarId,
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
  homeAssetSources,
  isEndlessMode,
  isRunComplete,
  isUpgradeCardAvailable,
  legacyAccountAvatarMap,
  lerp,
  loadSave,
  marbleConfigs,
  marbleShardCost,
  maxHeatForMode,
  metaCost,
  metaUpgrades,
  navIconSources,
  nearestEnemy,
  normalizeBaseGems,
  normalizeCharacterMarbles,
  normalizeLineup,
  normalizeVelocity,
  parseGemKey,
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
  type AutoExtractionMode,
  type AutoRunMode,
  type AutoUpgradeMode,
  type BattleMode,
  type CharacterConfig,
  type CharacterProgress,
  type CharacterRoute,
  type CharacterRouteId,
  type CharacterRuntime,
  type CharacterSortMode,
  type CollectibleId,
  type CollectionAchievement,
  type CollectionEntry,
  type CollectionReward,
  type CollectionTab,
  type DropEntry,
  type DropSummaryItem,
  type Enemy,
  type EnemyType,
  type ExtractionResult,
  type GameMethod,
  type GemType,
  type HeroDetailTab,
  type InventoryData,
  type Marble,
  type MarbleConfig,
  type MarbleId,
  type MenuView,
  type MetaUpgrade,
  type Phase,
  type ProfileEditMode,
  type ProtocolTab,
  type Rarity,
  type SaveData,
  type Session,
  type ShopCategory,
  type ShopItemConfig,
  type Speed,
  type StageConfig,
  type UpgradeCard,
  type VisualEffect,
  type WarehouseDetail,
  type WarehouseTab,
  type WaveConfig,
} from "./shared";

function baseGemModifiers(this: any) {
    const modifiers = {
      damage: 0,
      baseHp: 0,
      coin: 0,
      exp: 0,
      drop: 0,
      fireRate: 0,
      skillHaste: 0,
      critChance: 0,
      critDamage: 0,
    };

    for (const key of normalizeBaseGems(this.save.baseGems)) {
      if (!key) continue;
      const gem = parseGemKey(key);
      if (!gem) continue;

      if (gem.type === "power") {
        modifiers.damage += gem.level * 0.012;
      }

      if (gem.type === "guard") {
        modifiers.baseHp += Math.max(1, Math.ceil(gem.level / 5));
      }

      if (gem.type === "fortune") {
        modifiers.coin += gem.level * 0.01;
        modifiers.exp += gem.level * 0.004;
        modifiers.drop += gem.level * 0.012;
      }

      if (gem.type === "swift") {
        modifiers.fireRate += gem.level * 0.006;
      }

      if (gem.type === "focus") {
        modifiers.skillHaste += gem.level * 0.005;
      }

      if (gem.type === "rupture") {
        modifiers.critChance += gem.level * 0.004;
        modifiers.critDamage += gem.level * 0.01;
      }
    }

    return modifiers;
  }

function characterBattleStats(this: any, character: CharacterConfig | CharacterRuntime) {
    const progress = this.characterProgress(character.id);
    const levelBonus = Math.max(0, progress.level - 1);
    const routes = progress.routes;

    let damageMul = 1 + levelBonus * 0.025;
    let fireRateMul = 1 + levelBonus * 0.012;
    let skillCooldownMul = 1 - levelBonus * 0.006;

    if (character.id === "engineer") {
      fireRateMul += (routes.engineer_overclock || 0) * 0.04;
      skillCooldownMul -= (routes.engineer_field || 0) * 0.03;
      if (this.passiveUnlocked(character.id, "engineer_maintenance")) fireRateMul += 0.08;
    }

    if (character.id === "bomber") {
      fireRateMul += (routes.bomber_supply || 0) * 0.03;
      skillCooldownMul -= (routes.bomber_supply || 0) * 0.025;
    }

    if (character.id === "magnetist") {
      fireRateMul += (routes.magnetist_focus || 0) * 0.02;
      skillCooldownMul -= (routes.magnetist_focus || 0) * 0.025;
    }

    if (character.id === "sentinel") {
      fireRateMul += (routes.sentinel_suppress || 0) * 0.018;
      skillCooldownMul -= (routes.sentinel_barrier || 0) * 0.03;
    }

    if (character.id === "prism") {
      fireRateMul += (routes.prism_burst || 0) * 0.02;
      skillCooldownMul -= (routes.prism_burst || 0) * 0.025;
    }

    if (character.id === "alchemist") {
      fireRateMul += (routes.alchemist_gold || 0) * 0.02;
      skillCooldownMul -= (routes.alchemist_reactor || 0) * 0.025;
    }

    if (character.id === "frostseer") {
      fireRateMul += (routes.frostseer_stasis || 0) * 0.012;
      skillCooldownMul -= (routes.frostseer_stasis || 0) * 0.025;
    }

    if (character.id === "voidbinder") {
      fireRateMul += (routes.voidbinder_split || 0) * 0.012;
      skillCooldownMul -= (routes.voidbinder_core || 0) * 0.025;
    }

    if (character.id === "treasurer") {
      fireRateMul += (routes.treasurer_basic || 0) * 0.015 + (routes.treasurer_luck || 0) * 0.02;
      skillCooldownMul -= (routes.treasurer_luck || 0) * 0.015;
    }

    skillCooldownMul -= this.characterSkillBonus(character.id) * 0.018;

    return {
      level: progress.level,
      damageMul,
      fireRateMul,
      skillCooldownMul: clamp(skillCooldownMul, 0.55, 1.3),
    };
  }

function characterDamageMul(this: any, character: CharacterRuntime, marbleId: MarbleId) {
    let mul = this.characterBattleStats(character).damageMul;
    mul *= this.characterPassiveDamageMul(character.id, marbleId);

    if (character.id === "engineer" && (marbleId === "basic" || marbleId === "split")) {
      mul *= 1 + this.characterRouteLevel(character.id, "engineer_rebound") * 0.04;
    }

    if (character.id === "bomber" && marbleId === "blast") {
      mul *= 1 + this.characterRouteLevel(character.id, "bomber_blast") * 0.05;
    }

    if (character.id === "bomber" && marbleId === "burn") {
      mul *= 1 + this.characterRouteLevel(character.id, "bomber_burn") * 0.04;
    }

    if (character.id === "magnetist" && marbleId === "lightning") {
      mul *= 1 + this.characterRouteLevel(character.id, "magnetist_chain") * 0.04;
    }

    if (character.id === "magnetist" && marbleId === "slow") {
      mul *= 1 + this.characterRouteLevel(character.id, "magnetist_control") * 0.04;
    }

    if (character.id === "sentinel" && (marbleId === "basic" || marbleId === "slow")) {
      mul *= 1 + this.characterRouteLevel(character.id, "sentinel_pierce") * 0.04;
    }

    if (character.id === "sentinel" && marbleId === "slow") {
      mul *= 1 + this.characterRouteLevel(character.id, "sentinel_suppress") * 0.04;
    }

    if (character.id === "prism" && marbleId === "lightning") {
      mul *= 1 + this.characterRouteLevel(character.id, "prism_chain") * 0.04;
    }

    if (character.id === "prism" && marbleId === "split") {
      mul *= 1 + this.characterRouteLevel(character.id, "prism_split") * 0.04;
    }

    if (character.id === "alchemist" && marbleId === "burn") {
      mul *= 1 + this.characterRouteLevel(character.id, "alchemist_burn") * 0.05;
    }

    if (character.id === "alchemist" && marbleId === "blast") {
      mul *= 1 + this.characterRouteLevel(character.id, "alchemist_reactor") * 0.05;
    }

    if (character.id === "frostseer" && marbleId === "slow") {
      mul *= 1 + this.characterRouteLevel(character.id, "frostseer_slow") * 0.05;
    }

    if (character.id === "frostseer" && marbleId === "lightning") {
      mul *= 1 + this.characterRouteLevel(character.id, "frostseer_chain") * 0.04;
    }

    if (character.id === "voidbinder" && marbleId === "split") {
      mul *= 1 + this.characterRouteLevel(character.id, "voidbinder_split") * 0.04;
    }

    if (character.id === "voidbinder" && marbleId === "blast") {
      mul *= 1 + this.characterRouteLevel(character.id, "voidbinder_blast") * 0.05;
    }

    if (character.id === "treasurer" && marbleId === "basic") {
      mul *= 1 + this.characterRouteLevel(character.id, "treasurer_basic") * 0.04;
    }

    if (character.id === "treasurer" && marbleId === "burn") {
      mul *= 1 + this.characterRouteLevel(character.id, "treasurer_burn") * 0.05;
    }

    return mul;
  }

function characterUiStats(this: any, character: CharacterConfig) {
    const battleStats = this.characterBattleStats(character);
    const marbles = this.characterMarbles(character);
    const averageDamage =
      marbles.reduce((sum, id) => sum + marbleConfigs[id].damage * this.marbleDamageLevelMul(id), 0) / marbles.length;
    const routeDamage =
      marbles.reduce((sum, id) => sum + this.characterDamageMulForConfig(character, id), 0) / marbles.length;
    const attack = Math.round(averageDamage * battleStats.damageMul * routeDamage * 10);
    const speed = Math.round(battleStats.fireRateMul * 100);
    const skill = Math.round((1 - battleStats.skillCooldownMul) * 100);
    return {
      level: battleStats.level,
      attack,
      speed,
      skill,
      power: Math.round(attack * (speed / 100) * (1 + Math.max(0, skill) / 180)),
    };
  }

function characterDamageMulForConfig(this: any, character: CharacterConfig, marbleId: MarbleId) {
    const routeLevel = (routeId: CharacterRouteId) => this.characterRouteLevel(character.id, routeId);
    let mul = this.characterPassiveDamageMul(character.id, marbleId);

    if (character.id === "engineer" && (marbleId === "basic" || marbleId === "split")) {
      mul *= 1 + routeLevel("engineer_rebound") * 0.04;
    }

    if (character.id === "bomber" && marbleId === "blast") mul *= 1 + routeLevel("bomber_blast") * 0.05;
    if (character.id === "bomber" && marbleId === "burn") mul *= 1 + routeLevel("bomber_burn") * 0.04;
    if (character.id === "magnetist" && marbleId === "lightning") {
      mul *= 1 + routeLevel("magnetist_chain") * 0.04;
    }
    if (character.id === "magnetist" && marbleId === "slow") mul *= 1 + routeLevel("magnetist_control") * 0.04;
    if (character.id === "sentinel" && (marbleId === "basic" || marbleId === "slow")) {
      mul *= 1 + routeLevel("sentinel_pierce") * 0.04;
    }
    if (character.id === "sentinel" && marbleId === "slow") mul *= 1 + routeLevel("sentinel_suppress") * 0.04;
    if (character.id === "prism" && marbleId === "lightning") mul *= 1 + routeLevel("prism_chain") * 0.04;
    if (character.id === "prism" && marbleId === "split") mul *= 1 + routeLevel("prism_split") * 0.04;
    if (character.id === "alchemist" && marbleId === "burn") mul *= 1 + routeLevel("alchemist_burn") * 0.05;
    if (character.id === "alchemist" && marbleId === "blast") mul *= 1 + routeLevel("alchemist_reactor") * 0.05;
    if (character.id === "frostseer" && marbleId === "slow") mul *= 1 + routeLevel("frostseer_slow") * 0.05;
    if (character.id === "frostseer" && marbleId === "lightning") mul *= 1 + routeLevel("frostseer_chain") * 0.04;
    if (character.id === "voidbinder" && marbleId === "split") mul *= 1 + routeLevel("voidbinder_split") * 0.04;
    if (character.id === "voidbinder" && marbleId === "blast") mul *= 1 + routeLevel("voidbinder_blast") * 0.05;
    if (character.id === "treasurer" && marbleId === "basic") mul *= 1 + routeLevel("treasurer_basic") * 0.04;
    if (character.id === "treasurer" && marbleId === "burn") mul *= 1 + routeLevel("treasurer_burn") * 0.05;

    return mul;
  }

function characterPassiveDamageMul(this: any, characterId: string, marbleId: MarbleId) {
    let mul = 1;
    const tags = marbleConfigs[marbleId].tags;

    if (characterId === "engineer" && this.passiveUnlocked(characterId, "engineer_structure") && (tags.includes("physical") || tags.includes("multi"))) {
      mul *= 1.08;
    }

    if (characterId === "bomber" && this.passiveUnlocked(characterId, "bomber_charge") && (marbleId === "blast" || marbleId === "burn")) {
      mul *= 1.1;
    }

    if (characterId === "magnetist" && this.passiveUnlocked(characterId, "magnetist_coil") && (marbleId === "lightning" || marbleId === "slow")) {
      mul *= 1.08;
    }

    if (characterId === "prism" && this.passiveUnlocked(characterId, "prism_calibration") && (marbleId === "lightning" || marbleId === "split")) {
      mul *= 1.08;
    }

    if (characterId === "alchemist" && this.passiveUnlocked(characterId, "alchemist_catalyst") && (marbleId === "burn" || marbleId === "blast")) {
      mul *= 1.08;
    }

    if (characterId === "frostseer" && this.passiveUnlocked(characterId, "frostseer_mark") && marbleId === "slow") {
      mul *= 1.1;
    }

    if (characterId === "voidbinder" && this.passiveUnlocked(characterId, "voidbinder_rift") && (marbleId === "split" || marbleId === "blast")) {
      mul *= 1.08;
    }

    if (characterId === "voidbinder" && this.passiveUnlocked(characterId, "voidbinder_singularity") && marbleId === "blast") {
      mul *= 1.12;
    }

    if (characterId === "treasurer" && this.passiveUnlocked(characterId, "treasurer_silver") && (marbleId === "basic" || marbleId === "burn")) {
      mul *= 1.08;
    }

    return mul;
  }

export const gameStatsMethods = {
  baseGemModifiers,
  characterBattleStats,
  characterDamageMul,
  characterUiStats,
  characterDamageMulForConfig,
  characterPassiveDamageMul,
} satisfies Record<string, GameMethod>;
