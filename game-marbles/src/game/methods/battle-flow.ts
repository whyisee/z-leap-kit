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
  createPvpWave,
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

function update(this: any, dt: number, realDt: number) {
    const session = this.session;
    if (!session) return;

    if (session.mode === "pvp" && !session.pvp?.preloadComplete) {
      this.updatePvpSession?.(0, realDt);
      return;
    }

    session.elapsed += dt;
    session.modifiers.magnetic = Math.max(0, session.modifiers.magnetic - dt);

    this.updateExtractionWindow(realDt);
    this.updateWave(dt);
    this.updateCharacters(dt);
    this.updateEnemies(dt);
    this.updateMarbles(dt);
    this.updateParticles(dt);
    this.updateEffects(dt);
    this.updateDropVisuals(realDt);
    this.updatePvpSession?.(dt, realDt);

    for (const character of session.characters) {
      character.skillTimer = Math.max(0, character.skillTimer - dt);
      character.skillActive = Math.max(0, character.skillActive - dt);
    }

    this.updateAutoBattle();

    session.waveBannerTimer = Math.max(0, session.waveBannerTimer - realDt);

    if (session.xp >= session.xpNeed && this.phase === "playing" && session.extractionWindowWave === null) {
      this.openUpgrade();
    }
  }

function updateExtractionWindow(this: any, realDt: number) {
    const session = this.session;
    if (!session || session.extractionWindowWave === null || this.phase !== "playing") return;
    if (session.mode === "test") return;

    session.extractionWindowTimer = Math.max(0, session.extractionWindowTimer - realDt);
    if (session.extractionWindowTimer <= 0) {
      this.continueRun();
    }
  }

function updateWave(this: any, dt: number) {
    const session = this.requireSession();
    if (!session.waveConfig) return;
    if (session.extractionWindowWave !== null && session.mode !== "test") return;

    if (session.spawnQueue.length > 0) {
      session.spawnTimer -= dt;
      if (session.spawnTimer <= 0) {
        const row = this.takeSpawnRow(session.waveConfig);
        if (row.length > 0) this.spawnEnemyRow(row, session.waveConfig);
        session.spawnTimer = this.spawnRowInterval(session.waveConfig, row.length);
      }
    } else if (session.enemies.length === 0) {
      if (isRunComplete(session)) {
        if (session.mode === "pvp" && this.finishPvpByServer) {
          this.finishPvpByServer("win", "PVP 决胜波已清除");
          return;
        }
        const stage = getStageById(session.stageId);
        this.endGame("win", `清除 ${stage.name}${stage.boss ? ` · 击败${stage.boss.name}` : ""}`, "cleared");
        return;
      }

      if (session.modifiers.baseRegen && session.wave % 3 === 0) {
        session.baseHp = Math.min(session.maxBaseHp, session.baseHp + session.modifiers.baseRegen);
        this.addFloatingText(WIDTH / 2, FIELD_BOTTOM - 20, "+1 修复", "#61e6a8");
      }

      if (shouldOpenExtractionWindowForSession(session, session.wave)) {
        this.openExtractionWindow(session.wave);
        return;
      }

      this.startWave(session.wave + 1);
    }
  }

function startWave(this: any, wave: number) {
    const session = this.requireSession();
    const config = session.mode === "pvp" ? createPvpWave(wave, getStageById(session.stageId)) : createWave(wave, getStageById(session.stageId));
    this.applyHeatToWave(config);
    this.applyPvpPressureToWave?.(config);
    session.wave = wave;
    session.waveConfig = config;
    session.spawnQueue = this.arrangeSpawnQueueForRows(config.queue);
    session.spawnTimer = 0.35;
    session.waveBannerTimer = 1.6;

    if (config.type === "boss") {
      const boss = this.spawnEnemy("boss", config);
      this.spawnBossReboundGuards(boss, config, 5);
    }
  }

function takeSpawnRow(this: any, config: WaveConfig) {
    const session = this.requireSession();
    const maxCount = Math.min(this.spawnRowSize(config), session.spawnQueue.length);
    const availableWidth = FIELD.w - 28;
    const gap = this.spawnRowGap();
    const row: EnemyType[] = [];
    let width = 0;
    const primaryType = session.spawnQueue[0];

    while (row.length < maxCount && session.spawnQueue.length > 0 && session.spawnQueue[0] === primaryType) {
      const next = session.spawnQueue[0];
      const nextWidth = enemyConfigs[next].radius * 2;
      const projectedWidth = width + nextWidth + (row.length > 0 ? gap : 0);
      if (row.length > 0 && projectedWidth > availableWidth) break;
      row.push(session.spawnQueue.shift() as EnemyType);
      width = projectedWidth;
    }

    return row;
  }

function arrangeSpawnQueueForRows(this: any, queue: EnemyType[]) {
    const counts = new Map<EnemyType, number>();
    for (const type of queue) {
      counts.set(type, (counts.get(type) || 0) + 1);
    }

    return [...counts.keys()]
      .sort(
        (a, b) =>
          Number(b === "elite") - Number(a === "elite") ||
          (counts.get(b) || 0) - (counts.get(a) || 0) ||
          enemyConfigs[b].radius - enemyConfigs[a].radius,
      )
      .flatMap((type) => Array.from({ length: counts.get(type) || 0 }, () => type));
  }

function spawnRowSize(this: any, config: WaveConfig) {
    if (config.type === "boss") return 10;
    if (config.type === "elite") return 10;
    if (config.type === "reward") return 15;
    if (config.type === "pressure") return 14;
    return config.wave <= 3 ? 12 : 14;
  }

function spawnRowGap(this: any) {
    return 0;
  }

function spawnRowInterval(this: any, config: WaveConfig, rowSize: number) {
    return clamp(config.spawnInterval * Math.max(1, rowSize) * randomRange(0.86, 1.12), 0.62, 1.55);
  }

function spawnEnemyRow(this: any, types: EnemyType[], wave: WaveConfig) {
    if (types.length === 0) return;

    const session = this.requireSession();
    const maxRadius = Math.max(...types.map((type) => enemyConfigs[type].radius));
    const gap = this.spawnRowGap();
    const rowWidth = types.reduce((sum, type) => sum + enemyConfigs[type].radius * 2, 0) + gap * Math.max(0, types.length - 1);
    let cursor = FIELD.x + FIELD.w / 2 - rowWidth / 2;
    const y = FIELD.y - maxRadius - 8;
    const rowId = session.entities++;
    const rowSpeed = this.spawnRowSpeed(types, wave);

    const spawned = types.map((type, index) => {
      const radius = enemyConfigs[type].radius;
      const x = cursor + radius;
      cursor += radius * 2 + (index < types.length - 1 ? gap : 0);
      return this.spawnEnemy(type, wave, clamp(x, FIELD.x + radius, FIELD_RIGHT - radius), y, 1, 0, rowId, rowSpeed);
    });

    this.spawnEliteReboundGuards(spawned, wave);
  }

function spawnRowSpeed(this: any, types: EnemyType[], wave: WaveConfig) {
    const session = this.requireSession();
    const legendarySpeed = session.modifiers.cardStacks.enemySpeedDebt ? 1.08 : 1;
    const averageBaseSpeed = types.reduce((sum, type) => sum + enemyConfigs[type].speed, 0) / Math.max(1, types.length);
    return averageBaseSpeed * wave.speedMultiplier * legendarySpeed;
  }

function spawnEliteReboundGuards(this: any, enemies: Enemy[], wave: WaveConfig) {
    const elites = enemies.filter((enemy) => enemy.type === "elite");
    if (elites.length === 0) return;

    const count = Math.min(5, Math.max(3, elites.length + 2));
    const anchorX = elites.reduce((sum, enemy) => sum + enemy.x, 0) / elites.length;
    const anchorY = elites.reduce((sum, enemy) => sum + enemy.y, 0) / elites.length;
    const anchorRadius = Math.max(...elites.map((enemy) => enemy.radius));
    const rowSpeed = elites[0].rowSpeed ?? this.spawnRowSpeed(["elite"], wave);
    this.spawnReboundGuardLine(anchorX, anchorY, anchorRadius, wave, count, 2.1, rowSpeed, elites[0].rowId);
  }

function spawnBossReboundGuards(this: any, boss: Enemy, wave: WaveConfig, count = 5) {
    this.spawnReboundGuardLine(boss.x, boss.y, boss.radius, wave, count, 2.8, boss.rowSpeed ?? boss.speed, boss.rowId);
  }

function spawnReboundGuardLine(this: any, 
    anchorX: number,
    anchorY: number,
    anchorRadius: number,
    wave: WaveConfig,
    count: number,
    hpScale: number,
    rowSpeed: number,
    rowId: number | null,
  ) {
    const session = this.requireSession();
    const guardTypes: EnemyType[] = Array.from({ length: count }, (_, index) => (index % 2 === 0 ? "tank" : "shield"));
    const guardRadius = Math.max(...guardTypes.map((type) => enemyConfigs[type].radius));
    const rowWidth = guardTypes.reduce((sum, type) => sum + enemyConfigs[type].radius * 2, 0);
    const safeRowId = rowId ?? session.entities++;
    let cursor = anchorX - rowWidth / 2;
    let y = anchorY + anchorRadius + guardRadius - 2;

    if (y > FIELD_BOTTOM - guardRadius - 120) {
      y = anchorY - anchorRadius - guardRadius + 2;
    }

    y = clamp(y, FIELD.y + guardRadius, FIELD_BOTTOM - guardRadius - 30);

    guardTypes.forEach((type) => {
      const radius = enemyConfigs[type].radius;
      const x = clamp(cursor + radius, FIELD.x + radius, FIELD_RIGHT - radius);
      cursor += radius * 2;
      this.spawnEnemy(type, wave, x, y, hpScale, 0, safeRowId, rowSpeed);
    });
  }

function applyHeatToWave(this: any, config: WaveConfig) {
    const session = this.requireSession();
    const heat = session.heat;
    if (heat <= 0) return;

    config.hpMultiplier *= 1 + Math.min(0.3, heat * 0.045);
    config.speedMultiplier *= 1 + Math.max(0, heat - 1) * 0.025;

    if (config.type !== "boss" && heat >= 3) {
      const extra = 1 + Math.floor((heat - 3) / 2);
      for (let i = 0; i < extra; i += 1) {
        config.queue.push(randomChoice(["fast", "tank", "shield"]));
      }
      config.spawnInterval = clamp(config.targetDuration / Math.max(1, config.queue.length), 0.16, 0.72);
    }
  }

function openExtractionWindow(this: any, wave: number) {
    const session = this.requireSession();
    session.extractionWindowsSeen.push(wave);
    this.ensureAutoInsuredDrops();
    this.closeLootScreen();
    session.extractionWindowWave = wave;
    session.extractionWindowDuration = 5;
    session.extractionWindowTimer = session.extractionWindowDuration;
    this.updateHud();
    this.addFloatingText(FIELD.x + 72, FIELD_BOTTOM - 88, "撤离窗口 5 秒", "#f6c95f");

    if (this.autoBattleEnabled) {
      this.autoResolveExtractionWindow(wave);
    }
  }

function autoResolveExtractionWindow(this: any, wave: number) {
    const shouldExtract = this.shouldAutoExtract(wave);
    window.setTimeout(() => {
      const session = this.session;
      if (!session || this.phase !== "playing" || session.extractionWindowWave !== wave) return;
      if (!this.autoBattleEnabled) return;
      if (shouldExtract) this.extractNow();
    }, 420);
  }

function shouldAutoExtract(this: any, wave: number) {
    if (this.autoExtractionMode === "safe") return wave >= 5;
    if (this.autoExtractionMode === "balanced") return wave >= 10;
    if (this.autoExtractionMode === "deep") return wave >= 15;
    return false;
  }

function extractNow(this: any) {
    const session = this.session;
    if (!session) return;
    const wave = session.mode === "test" ? session.wave : session.extractionWindowWave ?? session.wave;
    if (this.phase !== "extraction" && !(this.phase === "playing" && (session.extractionWindowWave !== null || session.mode === "test"))) return;
    session.extractionWindowWave = null;
    session.extractionWindowTimer = 0;
    session.extractedAtWave = wave;
    this.quickExtractionButton?.classList.add("hidden");
    this.endGame("win", session.mode === "test" ? `测试到第 ${session.wave} 波后撤离` : `第 ${wave} 波后安全撤离`, "extracted");
  }

function continueRun(this: any) {
    const session = this.session;
    if (!session) return;
    if (this.phase !== "extraction" && !(this.phase === "playing" && session.extractionWindowWave !== null)) return;

    const wave = session.extractionWindowWave ?? session.wave;
    const preview = continuePreviewForSession(session, wave);
    session.continueCount += 1;
    session.continueBonus += preview.bonus;
    session.heat = clamp(session.heat + preview.heat, 0, maxHeatForMode(session.mode));
    session.maxHeat = Math.max(session.maxHeat, session.heat);
    session.extractionWindowWave = null;
    session.extractionWindowTimer = 0;
    this.phase = "playing";
    session.phase = "playing";
    this.extractionScreen.classList.add("hidden");
    this.closeLootScreen();
    this.quickExtractionButton?.classList.add("hidden");
    this.addFloatingText(WIDTH / 2, FIELD.y + 48, `继续深入 · 热度 ${session.heat}`, "#f6c95f");
    this.startWave(wave + 1);
  }

export const gameBattleFlowMethods = {
  update,
  updateExtractionWindow,
  updateWave,
  startWave,
  takeSpawnRow,
  arrangeSpawnQueueForRows,
  spawnRowSize,
  spawnRowGap,
  spawnRowInterval,
  spawnEnemyRow,
  spawnRowSpeed,
  spawnEliteReboundGuards,
  spawnBossReboundGuards,
  spawnReboundGuardLine,
  applyHeatToWave,
  openExtractionWindow,
  autoResolveExtractionWindow,
  shouldAutoExtract,
  extractNow,
  continueRun,
} satisfies Record<string, GameMethod>;
