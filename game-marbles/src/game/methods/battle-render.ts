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

function draw(this: any) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    const session = this.session;
    if (!session) {
      this.drawHomeBackground(ctx);
      return;
    }

    if (session.mode === "pvp") {
      this.drawPvpBattle(ctx, session);
      return;
    }

    this.drawBackground(ctx);
    this.drawField(ctx);
    this.drawEnemies(ctx, session);
    this.drawMarbles(ctx, session);
    this.drawSkillEffects(ctx, session);
    this.drawCharacters(ctx, session);
    this.drawParticles(ctx, session);
    this.drawDropVisuals(ctx, session);
    this.drawBattleInfo(ctx, session);
  }

function drawBackground(this: any, ctx: CanvasRenderingContext2D) {
    const session = this.session;
    const stage = session ? getStageById(session.stageId) : this.currentStage();
    const image = this.battleBackgrounds.get(this.battleBackgroundKey(stage));

    if (image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
      this.drawCoverImage(ctx, image);

      const shade = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      shade.addColorStop(0, "rgba(3, 7, 14, 0.22)");
      shade.addColorStop(0.36, stage.boss ? "rgba(3, 7, 14, 0.14)" : "rgba(3, 7, 14, 0.1)");
      shade.addColorStop(0.76, "rgba(3, 7, 14, 0.22)");
      shade.addColorStop(1, "rgba(3, 7, 14, 0.44)");
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      return;
    }

    this.drawFallbackBackground(ctx);
  }

function battleBackgroundKey(this: any, stage: StageConfig) {
    return `${stage.chapter}-${stage.boss ? "boss" : "normal"}`;
  }

function drawFallbackBackground(this: any, ctx: CanvasRenderingContext2D) {
    const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bg.addColorStop(0, "#121827");
    bg.addColorStop(0.56, "#151d2b");
    bg.addColorStop(1, "#10231f");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let x = 40; x < WIDTH; x += 46) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x - 80, HEIGHT);
      ctx.stroke();
    }
  }

function drawHomeBackground(this: any, ctx: CanvasRenderingContext2D) {
    const image = this.homeBackground;
    if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
      this.drawCoverImage(ctx, image);
    } else {
      this.drawFallbackBackground(ctx);
    }

    const shade = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    shade.addColorStop(0, "rgba(3, 8, 16, 0.16)");
    shade.addColorStop(0.28, "rgba(3, 8, 16, 0.08)");
    shade.addColorStop(0.72, "rgba(3, 8, 16, 0.26)");
    shade.addColorStop(1, "rgba(3, 8, 16, 0.46)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

function drawCoverImage(this: any, ctx: CanvasRenderingContext2D, image: HTMLImageElement) {
    const sourceRatio = image.naturalWidth / image.naturalHeight;
    const targetRatio = WIDTH / HEIGHT;
    let sx = 0;
    let sy = 0;
    let sw = image.naturalWidth;
    let sh = image.naturalHeight;

    if (sourceRatio > targetRatio) {
      sw = image.naturalHeight * targetRatio;
      sx = (image.naturalWidth - sw) / 2;
    } else {
      sh = image.naturalWidth / targetRatio;
      sy = (image.naturalHeight - sh) / 2;
    }

    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, WIDTH, HEIGHT);
  }

function drawMenuPreview(this: any, ctx: CanvasRenderingContext2D) {
    const bay = ctx.createLinearGradient(0, 90, 0, HEIGHT);
    bay.addColorStop(0, "rgba(84, 199, 255, 0.08)");
    bay.addColorStop(0.38, "rgba(13, 22, 36, 0.34)");
    bay.addColorStop(0.78, "rgba(8, 18, 28, 0.82)");
    bay.addColorStop(1, "rgba(5, 10, 18, 0.95)");
    ctx.fillStyle = bay;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.save();
    ctx.globalAlpha = 0.48;
    const sideGlow = ctx.createRadialGradient(WIDTH * 0.5, HEIGHT * 0.55, 40, WIDTH * 0.5, HEIGHT * 0.55, 420);
    sideGlow.addColorStop(0, "rgba(97, 230, 168, 0.18)");
    sideGlow.addColorStop(0.48, "rgba(84, 199, 255, 0.08)");
    sideGlow.addColorStop(1, "rgba(84, 199, 255, 0)");
    ctx.fillStyle = sideGlow;
    ctx.fillRect(0, 160, WIDTH, HEIGHT - 160);

    ctx.strokeStyle = "rgba(190, 213, 255, 0.08)";
    ctx.lineWidth = 2;
    for (let y = 150; y < HEIGHT; y += 104) {
      ctx.beginPath();
      ctx.moveTo(84, y);
      ctx.lineTo(WIDTH - 84, y + 36);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(97, 230, 168, 0.12)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(76, 710);
    ctx.lineTo(WIDTH / 2, 610);
    ctx.lineTo(WIDTH - 76, 710);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    const platformY = 702;
    const platform = ctx.createLinearGradient(0, platformY - 48, 0, platformY + 180);
    platform.addColorStop(0, "rgba(84, 199, 255, 0.16)");
    platform.addColorStop(0.55, "rgba(12, 25, 37, 0.72)");
    platform.addColorStop(1, "rgba(3, 8, 15, 0.92)");
    ctx.fillStyle = platform;
    ctx.strokeStyle = "rgba(97, 230, 168, 0.22)";
    ctx.lineWidth = 2;
    roundRect(ctx, 70, platformY - 48, WIDTH - 140, 210, 8);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let x = 118; x < WIDTH - 90; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, platformY - 34);
      ctx.lineTo(x + 44, platformY + 148);
      ctx.stroke();
    }

    const pads = [
      { x: WIDTH * 0.25, color: "#61e6a8" },
      { x: WIDTH * 0.5, color: "#f6c95f" },
      { x: WIDTH * 0.75, color: "#54c7ff" },
    ];
    for (const pad of pads) {
      const glow = ctx.createRadialGradient(pad.x, platformY + 22, 6, pad.x, platformY + 22, 80);
      glow.addColorStop(0, `${pad.color}55`);
      glow.addColorStop(1, `${pad.color}00`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.ellipse(pad.x, platformY + 22, 92, 34, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(7, 14, 25, 0.72)";
      ctx.strokeStyle = `${pad.color}55`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(pad.x, platformY + 16, 70, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

function drawField(this: any, ctx: CanvasRenderingContext2D, top = FIELD.y) {
    const bottom = FIELD_BOTTOM;
    ctx.save();
    ctx.fillStyle = "rgba(7, 12, 22, 0.62)";
    ctx.strokeStyle = "rgba(190, 213, 255, 0.22)";
    ctx.lineWidth = 2;
    roundRect(ctx, FIELD.x, top, FIELD.w, bottom - top, 8);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let y = top + 72; y < bottom; y += 72) {
      ctx.beginPath();
      ctx.moveTo(FIELD.x, y);
      ctx.lineTo(FIELD_RIGHT, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(255,108,126,0.55)";
    ctx.setLineDash([9, 8]);
    ctx.beginPath();
    ctx.moveTo(FIELD.x, bottom);
    ctx.lineTo(FIELD_RIGHT, bottom);
    ctx.stroke();
    ctx.restore();
  }

function drawEnemies(this: any, ctx: CanvasRenderingContext2D, session: Session) {
    for (const enemy of session.enemies) {
      const config = enemyConfigs[enemy.type];
      const hpRatio = clamp(enemy.hp / enemy.maxHp, 0, 1);
      const isBoss = enemy.type === "boss";
      const isElite = enemy.type === "elite";
      const bodyX = -enemy.radius;
      const bodyY = isBoss ? -enemy.radius * 0.78 : -enemy.radius;
      const bodyW = enemy.radius * 2;
      const bodyH = isBoss ? enemy.radius * 1.56 : enemy.radius * 2;
      const bodyRadius = isBoss ? 18 : isElite ? 10 : 7;
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.fillStyle = config.color;
      ctx.shadowColor = config.color;
      ctx.shadowBlur = isBoss ? 34 : isElite ? 18 : 10;

      roundRect(ctx, bodyX, bodyY, bodyW, bodyH, bodyRadius);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (isBoss || isElite) {
        ctx.strokeStyle = isBoss ? "rgba(255,236,188,0.88)" : "rgba(255,246,214,0.78)";
        ctx.lineWidth = isBoss ? 6 : 4;
        roundRect(ctx, bodyX, bodyY, bodyW, bodyH, bodyRadius);
        ctx.stroke();
      }

      if (isBoss) {
        const plateW = enemy.radius * 0.34;
        const plateH = enemy.radius * 0.18;
        const inset = enemy.radius * 0.13;
        ctx.fillStyle = "rgba(255,236,188,0.32)";
        for (const xSign of [-1, 1]) {
          const plateX = xSign < 0 ? bodyX + inset : bodyX + bodyW - inset - plateW;
          roundRect(ctx, plateX, bodyY + inset, plateW, plateH, 5);
          ctx.fill();
          roundRect(ctx, plateX, bodyY + bodyH - inset - plateH, plateW, plateH, 5);
          ctx.fill();
        }
      }

      if (enemy.type === "shield" && Math.sin(enemy.shieldTimer * 3.4) > 0.2) {
        ctx.strokeStyle = "rgba(234,242,255,0.78)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, enemy.radius + 7, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (enemy.slowTimer > 0) {
        ctx.strokeStyle = "rgba(84,199,255,0.8)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, enemy.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (enemy.burnTimer > 0) {
        ctx.fillStyle = "rgba(255,123,95,0.32)";
        ctx.beginPath();
        ctx.arc(0, 0, enemy.radius + 8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "rgba(0,0,0,0.45)";
      const hpBarY = bodyY - (isBoss ? 18 : 12);
      const hpBarH = isBoss ? 7 : isElite ? 6 : 5;
      roundRect(ctx, bodyX, hpBarY, bodyW, hpBarH, 3);
      ctx.fill();
      ctx.fillStyle = hpRatio > 0.35 ? "#61e6a8" : "#ff6c7e";
      roundRect(ctx, bodyX, hpBarY, bodyW * hpRatio, hpBarH, 3);
      ctx.fill();
      ctx.fillStyle = "#f7fbff";
      ctx.strokeStyle = "rgba(5,10,18,0.82)";
      ctx.lineWidth = 5;
      ctx.font = `900 ${isBoss ? clamp(enemy.radius * 0.38, 24, 34) : clamp(enemy.radius * 0.72, 14, isElite ? 28 : 21)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const hpText = String(Math.max(1, Math.ceil(enemy.hp)));
      ctx.strokeText(hpText, 0, isBoss ? 1 : 0);
      ctx.fillText(hpText, 0, isBoss ? 1 : 0);
      ctx.restore();
    }
  }

function drawMarbles(this: any, ctx: CanvasRenderingContext2D, session: Session) {
    const budget = this.marbleRenderBudget(session);
    const visualCache = new Map<string, any>();
    for (const marble of session.marbles) {
      const config = marbleConfigs[marble.marbleId];
      let visual = visualCache.get(marble.marbleId);
      if (!visual) {
        visual = this.marbleVisualConfig?.(marble.marbleId) || {
          color: config.color,
          accentColor: config.color,
          trail: config.trail,
          shape: "orb",
          trailStyle: "soft",
          cosmetic: null,
        };
        visualCache.set(marble.marbleId, visual);
      }
      const angle = budget.needsAngle ? Math.atan2(marble.vy, marble.vx) : 0;
      if (budget.drawTrailLine) this.drawMarbleTrail(ctx, marble, visual, session, angle, budget);
      if (visual.cosmetic && budget.drawCosmeticAura) this.drawMarbleCosmeticAura(ctx, marble, visual, angle, budget);
      if (visual.cosmetic && budget.drawCosmeticWake) this.drawMarbleCosmeticWake(ctx, marble, visual, session, angle, budget);
      this.drawMarbleBody(ctx, marble, visual, session, angle, budget);
    }
  }

function marbleRenderBudget(this: any, session: Session) {
    const count = session.marbles.length;
    const effectsEnabled = this.save?.preferences?.battleEffectsEnabled !== false;
    const intensity = this.save?.preferences?.cosmeticEffectIntensity || "medium";
    let quality = effectsEnabled ? (intensity === "high" ? 2 : intensity === "medium" ? 1 : 0) : 0;
    if (session.speed >= 3 || count > 16) quality = 0;
    else if (count > 8) quality = Math.min(quality, 1);
    const cosmeticVisible = effectsEnabled && count <= 180;
    const dense = session.speed >= 3 || count > 72;
    const busy = count > 24;
    const cosmeticTrailPoints =
      !cosmeticVisible
        ? 0
        : dense
          ? intensity === "high" ? 7 : intensity === "medium" ? 5 : 4
          : busy
            ? intensity === "high" ? 10 : intensity === "medium" ? 7 : 5
            : intensity === "high" ? 14 : intensity === "medium" ? 10 : 7;
    const baseTrailPoints = !effectsEnabled ? 0 : dense ? 3 : busy ? 4 : intensity === "high" ? 5 : intensity === "medium" ? 4 : 3;
    const bodyScale = intensity === "high" ? 1.12 : intensity === "medium" ? 1.08 : 1.04;
    const effectScale = count > 120 ? 1.08 : count > 72 ? 1.16 : intensity === "high" ? 1.34 : intensity === "medium" ? 1.24 : 1.16;
    const trailDetail = dense ? 0.55 : busy ? 0.72 : 1;
    return {
      quality,
      effectsEnabled,
      maxTrailPoints: quality >= 2 ? 5 : quality === 1 ? 3 : 0,
      baseTrailPoints,
      cosmeticTrailPoints,
      cheapTrailPoints: cosmeticVisible ? Math.min(3, cosmeticTrailPoints) : 0,
      trailStride: dense ? 2 : 1,
      trailDetail,
      drawTrailLine: quality >= 1 || cosmeticVisible,
      drawCosmeticAura: cosmeticVisible,
      drawCosmeticWake: cosmeticVisible,
      drawTrailMarks: cosmeticVisible,
      drawBaseTrailMarks: effectsEnabled && count <= 140 && session.speed < 4,
      drawFancyTrailLine: cosmeticVisible && count <= (intensity === "low" ? 48 : 120),
      useGlow: cosmeticVisible && !busy && session.speed < 3 && intensity !== "low",
      useGradient: quality >= 2 && count <= 12 && session.speed < 3,
      bodyScale,
      effectScale,
      drawShapeDetail: cosmeticVisible,
      drawSkinMark: cosmeticVisible,
      drawHalo: cosmeticVisible && !busy && intensity === "high",
      needsAngle: quality >= 1 || cosmeticVisible,
    };
  }

function marbleTrailProfile(visual: any) {
    if (visual?.__trailProfile) return visual.__trailProfile;
    const style = visual?.trailStyle || "soft";
    const rarity = visual?.rarity || "base";
    const color = visual?.color || "#54c7ff";
    const accent = visual?.accentColor || color;
    const legendary = rarity === "legendary";
    const epic = rarity === "epic";
    const rarityLength = legendary ? 1.12 : epic ? 1.06 : 1;
    const rarityFlash = legendary ? 1.18 : epic ? 1.08 : 1;
    const profile = {
      style,
      primaryColor: color,
      secondaryColor: accent,
      highlightColor: accent,
      lengthMul: 1,
      wakeTailMul: 1,
      wakeWidthMul: 1,
      lineWidthMul: 1,
      markScale: 1,
      markStride: 1,
      plumeAlphaMul: 1,
      animation: visual?.trailAnimation || "steady",
      flicker: 0.08,
      flickerSpeed: 9,
      sparkCount: 4,
      orbitCount: 2,
    };

    if (style === "flame") {
      profile.primaryColor = "#ff5d2e";
      profile.secondaryColor = "#ffd166";
      profile.highlightColor = "#ff8a3d";
      profile.lengthMul = 1.45 * rarityLength;
      profile.wakeTailMul = 1.32;
      profile.wakeWidthMul = 1.08;
      profile.lineWidthMul = 1.12;
      profile.markScale = 1.12;
      profile.flicker = 0.28 * rarityFlash;
      profile.flickerSpeed = 15;
      profile.sparkCount = legendary ? 5 : 4;
    } else if (style === "firework") {
      profile.primaryColor = "#ffb13d";
      profile.secondaryColor = "#ff6c2e";
      profile.highlightColor = "#ffd166";
      profile.lengthMul = 0.92 * rarityLength;
      profile.wakeTailMul = 0.78;
      profile.wakeWidthMul = 1.28;
      profile.lineWidthMul = 0.82;
      profile.markScale = 1.28;
      profile.plumeAlphaMul = 0.42;
      profile.flicker = 0.46 * rarityFlash;
      profile.flickerSpeed = 22;
      profile.sparkCount = legendary ? 9 : epic ? 7 : 5;
    } else if (style === "petal" || style === "leaf") {
      profile.primaryColor = style === "petal" ? "#ff4fb8" : "#61e6a8";
      profile.secondaryColor = style === "petal" ? "#61e6a8" : "#ff9bd2";
      profile.highlightColor = style === "petal" ? "#ff9bd2" : "#8cffc1";
      profile.lengthMul = 0.78 * rarityLength;
      profile.wakeTailMul = 0.7;
      profile.wakeWidthMul = 1.38;
      profile.lineWidthMul = 0.78;
      profile.markScale = 1.35;
      profile.plumeAlphaMul = 0.34;
      profile.flicker = 0.14 * rarityFlash;
      profile.flickerSpeed = 7;
      profile.sparkCount = legendary ? 8 : 6;
    } else if (style === "frost") {
      profile.primaryColor = "#54c7ff";
      profile.secondaryColor = "#8b6cff";
      profile.highlightColor = "#38e8ff";
      profile.lengthMul = 0.66 * rarityLength;
      profile.wakeTailMul = 0.66;
      profile.wakeWidthMul = 1.44;
      profile.lineWidthMul = 0.86;
      profile.markScale = 1.42;
      profile.plumeAlphaMul = 0.38;
      profile.flicker = 0.18 * rarityFlash;
      profile.flickerSpeed = 11;
      profile.sparkCount = legendary ? 7 : 5;
    } else if (style === "electric") {
      profile.primaryColor = "#00d5ff";
      profile.secondaryColor = "#b68cff";
      profile.highlightColor = "#00f0ff";
      profile.lengthMul = 0.72 * rarityLength;
      profile.wakeTailMul = 0.72;
      profile.wakeWidthMul = 0.64;
      profile.lineWidthMul = 0.8;
      profile.markScale = 0.92;
      profile.flicker = 0.52 * rarityFlash;
      profile.flickerSpeed = 26;
      profile.sparkCount = legendary ? 6 : 4;
    } else if (style === "galaxy") {
      profile.primaryColor = "#8b6cff";
      profile.secondaryColor = "#f6c95f";
      profile.highlightColor = "#6d5cff";
      profile.lengthMul = 1.75 * rarityLength;
      profile.wakeTailMul = 1.62;
      profile.wakeWidthMul = 0.92;
      profile.lineWidthMul = 1.18;
      profile.markScale = 1.08;
      profile.markStride = 2;
      profile.flicker = 0.16 * rarityFlash;
      profile.flickerSpeed = 6;
      profile.sparkCount = legendary ? 6 : 4;
      profile.orbitCount = legendary ? 3 : 2;
    } else if (style === "aurora") {
      profile.primaryColor = "#61e6a8";
      profile.secondaryColor = "#7de2ff";
      profile.highlightColor = "#b68cff";
      profile.lengthMul = 1.55 * rarityLength;
      profile.wakeTailMul = 1.42;
      profile.wakeWidthMul = 1.06;
      profile.lineWidthMul = 1.08;
      profile.markStride = 2;
      profile.flicker = 0.22 * rarityFlash;
      profile.flickerSpeed = 8;
      profile.orbitCount = legendary ? 3 : 2;
    } else if (style === "ribbon") {
      profile.primaryColor = accent;
      profile.secondaryColor = "#ff9bd2";
      profile.highlightColor = "#ffd166";
      profile.lengthMul = 1.68 * rarityLength;
      profile.wakeTailMul = 1.5;
      profile.wakeWidthMul = 0.74;
      profile.lineWidthMul = 1.05;
      profile.markStride = 2;
      profile.flicker = 0.1 * rarityFlash;
      profile.flickerSpeed = 6;
    } else if (style === "spark" || style === "stardust") {
      profile.primaryColor = style === "stardust" ? "#54c7ff" : color;
      profile.secondaryColor = style === "stardust" ? "#f6c95f" : accent;
      profile.highlightColor = style === "stardust" ? "#f6c95f" : accent;
      profile.lengthMul = 1.08 * rarityLength;
      profile.wakeTailMul = 1.04;
      profile.wakeWidthMul = 0.92;
      profile.markScale = 1.08;
      profile.flicker = 0.38 * rarityFlash;
      profile.flickerSpeed = 18;
      profile.sparkCount = legendary ? 7 : 5;
    }

    const configuredLength = Number(visual?.trailLength) || 1;
    const configuredWidth = Number(visual?.trailWidth) || 1;
    const configuredDensity = Number(visual?.trailDensity) || 1;
    profile.primaryColor = visual?.trailColor || profile.primaryColor;
    profile.secondaryColor = visual?.trailAccentColor || profile.secondaryColor;
    profile.highlightColor = visual?.trailHighlightColor || profile.highlightColor;
    profile.lengthMul *= clamp(configuredLength, 0.35, 2.8);
    profile.wakeTailMul *= clamp(configuredLength, 0.45, 2.4);
    profile.lineWidthMul *= clamp(configuredWidth, 0.45, 2.2);
    profile.wakeWidthMul *= clamp(configuredWidth, 0.45, 2.4);
    profile.markScale *= clamp(configuredWidth, 0.55, 2.2);
    profile.sparkCount = Math.max(1, Math.round(profile.sparkCount * clamp(configuredDensity, 0.35, 2.2)));
    if (configuredDensity < 0.95) profile.markStride = Math.max(profile.markStride, Math.round(1 / clamp(configuredDensity, 0.35, 1)));

    if (profile.animation === "steady") {
      profile.flicker *= 0.45;
      profile.flickerSpeed *= 0.7;
    } else if (profile.animation === "pulse") {
      profile.flicker = Math.max(profile.flicker, 0.22 * rarityFlash);
      profile.flickerSpeed = Math.max(profile.flickerSpeed, 8);
      profile.wakeWidthMul *= 1.08;
    } else if (profile.animation === "flicker") {
      profile.flicker = Math.max(profile.flicker, 0.38 * rarityFlash);
      profile.flickerSpeed = Math.max(profile.flickerSpeed, 17);
    } else if (profile.animation === "sparkle") {
      profile.flicker = Math.max(profile.flicker, 0.42 * rarityFlash);
      profile.flickerSpeed = Math.max(profile.flickerSpeed, 20);
      profile.sparkCount = Math.round(profile.sparkCount * 1.22);
    } else if (profile.animation === "flow") {
      profile.flicker *= 0.65;
      profile.flickerSpeed = Math.min(profile.flickerSpeed, 8);
      profile.wakeTailMul *= 1.08;
    } else if (profile.animation === "zigzag") {
      profile.flicker = Math.max(profile.flicker, 0.5 * rarityFlash);
      profile.flickerSpeed = Math.max(profile.flickerSpeed, 26);
      profile.wakeWidthMul *= 0.82;
    } else if (profile.animation === "orbit") {
      profile.flicker = Math.max(profile.flicker, 0.16 * rarityFlash);
      profile.flickerSpeed = Math.min(profile.flickerSpeed, 8);
      profile.lengthMul *= 1.12;
      profile.orbitCount += legendary ? 2 : 1;
    }

    if (visual) visual.__trailProfile = profile;
    return profile;
  }

function drawMarbleCosmeticAura(this: any, ctx: CanvasRenderingContext2D, marble: Marble, visual: any, angle: number, budget: any) {
    const baseRadius = marble.radius * marbleCosmeticEffectScale(visual, budget);
    const accent = visual.accentColor || visual.color;
    const rarity = visual.rarity || "rare";
    const ringColor = rarityColor(rarity);
    const alpha = rarity === "legendary" ? 0.62 : rarity === "epic" ? 0.5 : 0.36;

    ctx.save();
    ctx.translate(marble.x, marble.y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = rarity === "legendary" ? 3 : rarity === "epic" ? 2.4 : 1.8;
    ctx.beginPath();
    ctx.ellipse(0, 0, baseRadius * 1.75, baseRadius * 1.12, 0.18, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = Math.max(0.14, alpha * 0.42);
    ctx.strokeStyle = accent;
    ctx.lineWidth = rarity === "legendary" ? 7.2 : rarity === "epic" ? 5.8 : 4.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, baseRadius * 1.86, baseRadius * 1.2, 0.18, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = Math.min(0.34, alpha + 0.03);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.2;
    if (rarity === "legendary" || rarity === "epic") {
      for (let i = 0; i < 2; i += 1) {
        const side = i === 0 ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(-baseRadius * 0.2, side * baseRadius * 1.02);
        ctx.lineTo(baseRadius * 0.58, side * baseRadius * 1.32);
        ctx.lineTo(baseRadius * 0.28, side * baseRadius * 0.72);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

function drawMarbleCosmeticWake(this: any, ctx: CanvasRenderingContext2D, marble: Marble, visual: any, session: Session, angle: number, budget: any) {
    const radius = marble.radius * marbleCosmeticEffectScale(visual, budget);
    const style = visual.trailStyle || "soft";
    const rarity = visual.rarity || "rare";
    const profile = marbleTrailProfile(visual);
    const accent = profile.secondaryColor;
    const color = profile.primaryColor;
    const detail = budget.trailDetail || 1;
    const phase = session.elapsed * (rarity === "legendary" ? 14.5 : rarity === "epic" ? 12.2 : 10.4) * (0.88 + profile.flickerSpeed * 0.012) + marble.id * 0.37;
    const pulse = 0.5 + Math.sin(phase) * 0.5;
    const flicker = 1 + Math.sin(phase * profile.flickerSpeed * 0.13 + marble.id * 0.41) * profile.flicker;
    const wave = Math.sin(phase * 0.86) * radius * 0.58;
    const tail = radius * (rarity === "legendary" ? 9.2 : rarity === "epic" ? 7.8 : 6.4) * profile.wakeTailMul * (0.92 + pulse * 0.16);
    const width = radius * (rarity === "legendary" ? 0.92 : rarity === "epic" ? 0.78 : 0.66) * profile.wakeWidthMul * (0.92 + pulse * 0.08);
    const tipY = wave * 0.92;
    const plumeAlphaMul = profile.plumeAlphaMul;

    ctx.save();
    ctx.translate(marble.x, marble.y);
    ctx.rotate(angle);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = (rarity === "legendary" ? 0.58 : rarity === "epic" ? 0.48 : 0.38) * plumeAlphaMul * flicker;

    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.64, -width * 0.38);
    ctx.bezierCurveTo(-tail * 0.26, -width * 0.48 + wave * 0.2, -tail * 0.72, -width * 0.2 + wave * 0.44, -tail, tipY);
    ctx.bezierCurveTo(-tail * 0.72, width * 0.2 + wave * 0.44, -tail * 0.26, width * 0.48 + wave * 0.2, -radius * 0.64, width * 0.38);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = (rarity === "legendary" ? 0.46 : rarity === "epic" ? 0.38 : 0.3) * plumeAlphaMul * flicker;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.28, -width * 0.14);
    ctx.bezierCurveTo(-tail * 0.3, -width * 0.14 + wave * 0.14, -tail * 0.62, wave * 0.28, -tail * 0.9, tipY * 0.48);
    ctx.bezierCurveTo(-tail * 0.62, wave * 0.28, -tail * 0.3, width * 0.14 + wave * 0.14, -radius * 0.28, width * 0.14);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = rarity === "legendary" ? 0.96 : rarity === "epic" ? 0.9 : 0.82;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.8, radius * 0.18);
    ctx.lineCap = "round";
    if (style === "electric") {
      ctx.beginPath();
      ctx.moveTo(-radius * 0.9, 0);
      ctx.lineTo(-tail * 0.34, -width * 0.34 + wave * 0.16);
      ctx.lineTo(-tail * 0.52, width * 0.22 + wave * 0.26);
      ctx.lineTo(-tail * 0.72, -width * 0.2 + tipY * 0.34);
      ctx.lineTo(-tail * 0.94, width * 0.12 + tipY * 0.42);
      ctx.stroke();
    } else if (style === "frost" || style === "leaf" || style === "petal") {
      ctx.beginPath();
      ctx.moveTo(-radius * 0.95, 0);
      ctx.quadraticCurveTo(-tail * 0.5, wave * 0.28, -tail * 0.98, tipY * 0.18);
      ctx.moveTo(-radius * 1.4, -width * 0.28);
      ctx.quadraticCurveTo(-tail * 0.48, -width * 0.42 + wave * 0.22, -tail * 0.86, -width * 0.24 + tipY * 0.14);
      ctx.moveTo(-radius * 1.4, width * 0.28);
      ctx.quadraticCurveTo(-tail * 0.48, width * 0.42 + wave * 0.22, -tail * 0.86, width * 0.24 + tipY * 0.14);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(-radius * 0.95, 0);
      ctx.quadraticCurveTo(-tail * 0.48, wave * 0.44, -tail * 0.9, tipY * 0.36);
      ctx.stroke();
    }

    if (style === "firework" || style === "spark" || style === "stardust") {
      const sparks = Math.max(3, Math.round(profile.sparkCount * detail));
      ctx.strokeStyle = accent;
      ctx.fillStyle = rarity === "legendary" ? rarityColor("legendary") : color;
      ctx.lineWidth = Math.max(1.4, radius * 0.12);
      for (let i = 0; i < sparks; i += 1) {
        const progress = (i + 1) / (sparks + 1);
        const x = -tail * progress;
        const y = Math.sin(phase * 0.62 + i * 1.7) * width * (0.32 + progress * 0.72);
        const sparkRadius = radius * (0.28 + (i % 3) * 0.12 + progress * 0.18);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(phase * 0.18 + i);
        ctx.globalAlpha = (rarity === "legendary" ? 0.9 : 0.74) * (0.48 + progress * 0.52);
        drawStarPath(ctx, 0, 0, sparkRadius, sparkRadius * 0.42, style === "firework" ? 6 : 4);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    } else if (style === "flame") {
      const tongues = Math.max(2, Math.round(profile.sparkCount * detail));
      ctx.fillStyle = accent;
      for (let i = 0; i < tongues; i += 1) {
        const side = i % 2 === 0 ? -1 : 1;
        const progress = 0.22 + i * 0.2;
        const tongueTail = tail * (0.48 + i * 0.16);
        ctx.globalAlpha = (rarity === "legendary" ? 0.58 : 0.46) * (1 - i * 0.08);
        ctx.beginPath();
        ctx.moveTo(-radius * 0.42, side * width * 0.18);
        ctx.quadraticCurveTo(-tongueTail * 0.42, side * width * (0.82 + progress), -tongueTail, side * width * 0.2 + wave * 0.16);
        ctx.quadraticCurveTo(-tongueTail * 0.52, side * width * -0.22, -radius * 0.28, -side * width * 0.08);
        ctx.closePath();
        ctx.fill();
      }
    } else if (style === "petal" || style === "leaf") {
      const petals = Math.max(3, Math.round(profile.sparkCount * detail));
      ctx.fillStyle = style === "petal" ? accent : color;
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1, radius * 0.1);
      for (let i = 0; i < petals; i += 1) {
        const progress = (i + 1) / (petals + 1);
        const x = -tail * progress;
        const side = i % 2 === 0 ? -1 : 1;
        const y = side * width * (0.28 + progress * 0.52) + Math.sin(phase + i) * radius * 0.12;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(side * 0.9 + Math.sin(phase * 0.2 + i) * 0.35);
        ctx.globalAlpha = 0.46 + progress * 0.28;
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * (0.5 + progress * 0.24), radius * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    } else if (style === "frost") {
      const flakes = Math.max(3, Math.round(profile.sparkCount * detail));
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1.2, radius * 0.1);
      for (let i = 0; i < flakes; i += 1) {
        const progress = (i + 1) / (flakes + 1);
        const x = -tail * progress;
        const y = Math.sin(phase * 0.5 + i * 1.35) * width * 0.72;
        const size = radius * (0.3 + progress * 0.22);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(phase * 0.08 + i);
        ctx.globalAlpha = 0.58 + progress * 0.28;
        for (let arm = 0; arm < 3; arm += 1) {
          ctx.rotate(Math.PI / 3);
          ctx.beginPath();
          ctx.moveTo(-size, 0);
          ctx.lineTo(size, 0);
          ctx.stroke();
        }
        ctx.restore();
      }
    } else if (style === "galaxy" || style === "aurora") {
      ctx.strokeStyle = rarityColor(rarity);
      ctx.lineWidth = Math.max(1.4, radius * 0.12);
      const orbits = Math.max(1, Math.round(profile.orbitCount * detail));
      for (let i = 0; i < orbits; i += 1) {
        ctx.save();
        ctx.translate(-tail * (0.36 + i * 0.24), Math.sin(phase * 0.5 + i) * width * 0.35);
        ctx.rotate(phase * 0.12 + i * 0.8);
        ctx.globalAlpha = rarity === "legendary" ? 0.76 : 0.58;
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * (0.56 + i * 0.16), radius * (0.2 + i * 0.08), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    const highlightColor = profile.highlightColor;
    ctx.globalAlpha = (rarity === "legendary" ? 0.7 : rarity === "epic" ? 0.58 : 0.46) * flicker;
    ctx.strokeStyle = highlightColor;
    ctx.lineWidth = Math.max(1.4, radius * 0.13);
    ctx.beginPath();
    const streakStart = -tail * (0.14 + pulse * 0.5);
    const streakEnd = Math.max(streakStart - tail * 0.4, -tail * 1.02);
    ctx.moveTo(streakStart, -width * 0.16 + wave * 0.18);
    ctx.quadraticCurveTo((streakStart + streakEnd) * 0.5, wave * 0.36, streakEnd, width * 0.08 + tipY * 0.28);
    ctx.stroke();

    ctx.globalAlpha = rarity === "legendary" ? 0.86 : rarity === "epic" ? 0.72 : 0.58;
    ctx.strokeStyle = profile.highlightColor;
    ctx.lineWidth = Math.max(1.2, radius * 0.13);
    const sparkX = -tail * (0.7 + pulse * 0.18);
    const sparkY = tipY * 0.72;
    const spark = radius * (rarity === "legendary" ? 0.5 : rarity === "epic" ? 0.4 : 0.32);
    ctx.beginPath();
    ctx.moveTo(sparkX - spark, sparkY);
    ctx.lineTo(sparkX + spark, sparkY);
    ctx.moveTo(sparkX, sparkY - spark);
    ctx.lineTo(sparkX, sparkY + spark);
    ctx.moveTo(sparkX - spark * 0.62, sparkY - spark * 0.62);
    ctx.lineTo(sparkX + spark * 0.62, sparkY + spark * 0.62);
    ctx.moveTo(sparkX + spark * 0.62, sparkY - spark * 0.62);
    ctx.lineTo(sparkX - spark * 0.62, sparkY + spark * 0.62);
    ctx.stroke();

    if (rarity === "legendary") {
      ctx.strokeStyle = rarityColor("legendary");
      ctx.lineWidth = Math.max(1.4, radius * 0.16);
      ctx.beginPath();
      ctx.moveTo(-radius * 0.9, -width * 0.44);
      ctx.quadraticCurveTo(-tail * 0.42, -width * 0.78 + wave * 0.42, -tail * 0.92, -width * 0.14 + tipY * 0.3);
      ctx.moveTo(-radius * 0.9, width * 0.44);
      ctx.quadraticCurveTo(-tail * 0.42, width * 0.78 + wave * 0.42, -tail * 0.92, width * 0.14 + tipY * 0.3);
      ctx.stroke();
    }

    ctx.restore();
  }

function drawMarbleTrail(this: any, ctx: CanvasRenderingContext2D, marble: Marble, visual: any, session: Session, angle: number, budget: any) {
    if (marble.trail.length <= 1) return;
    const cosmetic = Boolean(visual.cosmetic);
    const style = visual.trailStyle || "soft";
    const styledTrail = style !== "soft";
    const rarity = visual.rarity || "rare";
    const profile = marbleTrailProfile(visual);
    const accent = cosmetic ? profile.secondaryColor : visual.accentColor || visual.color;
    const color = cosmetic ? profile.primaryColor : visual.trail || this.hexToRgba?.(accent, styledTrail ? 0.28 : 0.2) || accent;
    const baseMaxTrailPoints = cosmetic
      ? Math.max(budget.cosmeticTrailPoints || 0, budget.cheapTrailPoints || 0)
      : styledTrail
        ? Math.max(budget.maxTrailPoints || 0, budget.baseTrailPoints || 0)
        : budget.maxTrailPoints || 0;
    const maxTrailPoints = cosmetic ? Math.max(2, Math.round(baseMaxTrailPoints * profile.lengthMul)) : baseMaxTrailPoints;
    if (maxTrailPoints <= 1) return;
    const start = Math.max(0, marble.trail.length - maxTrailPoints);
    const flicker = cosmetic ? 1 + Math.sin(session.elapsed * profile.flickerSpeed + marble.id * 0.47) * profile.flicker : 1;

    ctx.save();
    if (cosmetic) ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = cosmetic ? (rarity === "legendary" ? 0.72 : rarity === "epic" ? 0.62 : 0.52) * flicker : styledTrail ? 0.36 : 0.3;
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1.4, marble.radius * (cosmetic ? 0.52 * profile.lineWidthMul : styledTrail ? 0.28 : 0.24));
    ctx.beginPath();
    for (let i = start; i < marble.trail.length; i += 1) {
      const point = marble.trail[i];
      if (i === start) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();

    const drawMarks = budget.drawTrailMarks && (cosmetic || (styledTrail && budget.drawBaseTrailMarks));
    if (!drawMarks) {
      ctx.restore();
      return;
    }

    const baseRadius = marble.radius * (cosmetic ? (rarity === "legendary" ? 1.62 : rarity === "epic" ? 1.42 : 1.22) * profile.markScale : styledTrail ? 0.96 : 0.88);
    const drawFancy = budget.drawFancyTrailLine && (cosmetic || (styledTrail && budget.drawBaseTrailMarks));

    if (style === "electric" && drawFancy) {
      ctx.strokeStyle = color;
      ctx.shadowColor = accent;
      ctx.shadowBlur = budget.useGlow ? (cosmetic ? 12 : 6) : 0;
      ctx.lineWidth = Math.max(2, marble.radius * 0.48 * profile.lineWidthMul);
      ctx.beginPath();
      for (let i = start; i < marble.trail.length; i += 1) {
        const point = marble.trail[i];
        const index = i - start;
        const t = index / Math.max(1, marble.trail.length - start - 1);
        const jitterStrength = profile.animation === "zigzag" ? 0.86 : profile.animation === "flicker" ? 0.58 : 0.42;
        const jitter = Math.sin(session.elapsed * profile.flickerSpeed + index * 2.35 + marble.x * 0.03) * marble.radius * jitterStrength * t;
        const normal = angle + Math.PI / 2;
        const x = point.x + Math.cos(normal) * jitter;
        const y = point.y + Math.sin(normal) * jitter;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    if (drawFancy && (style === "ribbon" || style === "aurora" || style === "galaxy")) {
      ctx.strokeStyle = color;
      ctx.shadowColor = accent;
      ctx.shadowBlur = budget.useGlow ? (style === "galaxy" ? 14 : 9) : 0;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = marble.radius * (style === "galaxy" ? 0.66 : 0.5) * profile.lineWidthMul;
      ctx.beginPath();
      for (let i = start; i < marble.trail.length; i += 1) {
        const point = marble.trail[i];
        const index = i - start;
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      }
      ctx.stroke();
    }

    if (drawFancy && cosmetic && (style === "flame" || style === "firework" || style === "frost" || style === "petal" || style === "leaf" || style === "stardust" || style === "spark")) {
      ctx.strokeStyle = style === "flame" || style === "firework" ? accent : color;
      ctx.shadowColor = accent;
      ctx.shadowBlur = budget.useGlow ? (rarity === "legendary" ? 16 : 10) : 0;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = marble.radius * (rarity === "legendary" ? 0.82 : 0.68) * profile.lineWidthMul;
      ctx.beginPath();
      for (let i = start; i < marble.trail.length; i += 1) {
        const point = marble.trail[i];
        const index = i - start;
        const t = index / Math.max(1, marble.trail.length - start - 1);
        const swaySpeed = profile.animation === "flow" || profile.animation === "orbit" ? 5.6 : profile.animation === "sparkle" ? 13 : profile.flickerSpeed;
        const swayStrength = profile.animation === "flow" ? 0.46 : profile.animation === "zigzag" ? 0.72 : profile.animation === "pulse" ? 0.24 : 0.32;
        const sway = Math.sin(session.elapsed * swaySpeed + index * 1.65 + marble.id) * marble.radius * swayStrength * t;
        const normal = angle + Math.PI / 2;
        const x = point.x + Math.cos(normal) * sway;
        const y = point.y + Math.sin(normal) * sway;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    const markerStride = cosmetic ? Math.max(budget.trailStride, profile.markStride) : budget.trailStride;
    const markVisual = cosmetic ? { ...visual, color, accentColor: accent } : visual;
    for (let i = start; i < marble.trail.length; i += markerStride) {
      const point = marble.trail[i];
      const t = (i - start) / Math.max(1, marble.trail.length - start - 1);
      const markerPulse = cosmetic ? 1 + Math.sin(session.elapsed * profile.flickerSpeed + i * 1.37) * profile.flicker * (0.5 + t * 0.5) : 1;
      const alpha = ((cosmetic ? 0.24 : 0.06) + t * (cosmetic ? 0.72 : 0.2)) * markerPulse;
      const radius = baseRadius * (cosmetic ? 0.48 + t * 0.88 : 0.32 + t * 0.7);
      ctx.save();
      ctx.globalAlpha = Math.min(0.96, alpha);
      ctx.translate(point.x, point.y);
      ctx.rotate(angle + Math.sin(session.elapsed * 5 + i) * 0.28);
      ctx.fillStyle = style === "flame" ? accent : color;
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1, marble.radius * 0.14);
      this.drawMarbleTrailMark(ctx, style, radius, i, session.elapsed, markVisual);
      ctx.restore();
    }

    ctx.restore();
  }

function drawMarbleTrailMark(this: any, ctx: CanvasRenderingContext2D, style: string, radius: number, index: number, elapsed: number, visual: any) {
    const accent = visual.accentColor || visual.color;
    if (style === "flame") {
      ctx.beginPath();
      ctx.moveTo(-radius * 1.45, 0);
      ctx.quadraticCurveTo(-radius * 0.42, -radius * 0.95, radius * 0.34, 0);
      ctx.quadraticCurveTo(-radius * 0.42, radius * 0.95, -radius * 1.45, 0);
      ctx.fill();
      return;
    }

    if (style === "leaf" || style === "petal") {
      ctx.rotate(index % 2 ? 0.55 : -0.55);
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 0.85, radius * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (style === "frost") {
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1, radius * 0.18);
      for (let j = 0; j < 3; j += 1) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(-radius * 0.75, 0);
        ctx.lineTo(radius * 0.75, 0);
        ctx.stroke();
      }
      return;
    }

    if (style === "spark" || style === "stardust" || style === "firework") {
      const spikes = style === "firework" ? 6 : 4;
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1, radius * 0.16);
      for (let j = 0; j < spikes; j += 1) {
        const a = j * ((Math.PI * 2) / spikes) + elapsed * 0.8;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * radius * 0.12, Math.sin(a) * radius * 0.12);
        ctx.lineTo(Math.cos(a) * radius * 0.86, Math.sin(a) * radius * 0.86);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.24, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (style === "galaxy" || style === "aurora") {
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1, radius * 0.16);
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 0.82, radius * 0.32, elapsed + index, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.22, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (style === "ribbon") {
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 1.08, radius * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.56, 0, Math.PI * 2);
    ctx.fill();
  }

function drawMarbleBody(this: any, ctx: CanvasRenderingContext2D, marble: Marble, visual: any, session: Session, angle: number, budget: any) {
    const shape = visual.shape || "orb";
    const cosmetic = Boolean(visual.cosmetic);
    const color = visual.color || marbleConfigs[marble.marbleId].color;
    const accent = visual.accentColor || color;
    const radius = marble.radius * (cosmetic ? marbleCosmeticBodyScale(visual, budget) : 1);
    if (budget.quality <= 0) {
      if (budget.drawShapeDetail && cosmetic) {
        ctx.save();
        ctx.translate(marble.x, marble.y);
        ctx.rotate(angle);
        ctx.fillStyle = color;
        ctx.strokeStyle = accent;
        ctx.lineWidth = Math.max(2, radius * 0.22);
        this.drawFastMarbleShape(ctx, shape, radius);
        ctx.fill();
        ctx.stroke();
        this.drawMarbleSkinMark(ctx, visual, radius, accent, budget);
        ctx.restore();
        return;
      }
      ctx.fillStyle = color;
      ctx.strokeStyle = cosmetic ? accent : "rgba(255,255,255,0.68)";
      ctx.lineWidth = cosmetic ? 1.4 : 1;
      ctx.beginPath();
      ctx.arc(marble.x, marble.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      return;
    }
    const spin = cosmetic ? session.elapsed * (shape === "ring" || shape === "star" ? 2.4 : 1.1) : 0;
    if (!budget.useGradient) {
      ctx.save();
      ctx.translate(marble.x, marble.y);
      ctx.rotate(angle + (budget.quality >= 1 ? spin * 0.45 : 0));
      ctx.fillStyle = color;
      ctx.strokeStyle = accent;
      ctx.lineWidth = cosmetic ? 1.8 : 1.2;
      if (budget.useGlow) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
      }
      if (budget.drawShapeDetail && cosmetic) this.drawFastMarbleShape(ctx, shape, radius);
      else {
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.stroke();
      this.drawMarbleSkinMark(ctx, visual, radius, accent, budget);
      ctx.restore();
      return;
    }

    const fill = ctx.createRadialGradient(-radius * 0.36, -radius * 0.42, radius * 0.18, 0, 0, radius * 1.45);
    fill.addColorStop(0, "rgba(255,255,255,0.96)");
    fill.addColorStop(0.34, accent);
    fill.addColorStop(0.72, color);
    fill.addColorStop(1, "rgba(8,12,22,0.92)");

    ctx.save();
    ctx.translate(marble.x, marble.y);
    ctx.rotate(angle + spin);
    ctx.shadowColor = color;
    ctx.shadowBlur = budget.useGlow ? (cosmetic ? 14 : 7) : 0;
    ctx.fillStyle = fill;
    ctx.strokeStyle = accent;
    ctx.lineWidth = cosmetic ? 2.4 : 1.4;

    if (shape === "star") {
      drawStarPath(ctx, 0, 0, radius * 1.18, radius * 0.52, 5);
      ctx.fill();
      ctx.stroke();
    } else if (shape === "leaf") {
      ctx.rotate(-0.35);
      ctx.beginPath();
      ctx.moveTo(-radius * 1.12, 0);
      ctx.bezierCurveTo(-radius * 0.35, -radius * 0.92, radius * 0.86, -radius * 0.72, radius * 1.08, 0);
      ctx.bezierCurveTo(radius * 0.54, radius * 0.72, -radius * 0.48, radius * 0.9, -radius * 1.12, 0);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.42)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-radius * 0.62, 0);
      ctx.lineTo(radius * 0.58, 0);
      ctx.stroke();
    } else if (shape === "crystal") {
      polygonPath(ctx, radius * 1.12, 6, -Math.PI / 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.36)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -radius * 0.92);
      ctx.lineTo(0, radius * 0.86);
      ctx.moveTo(-radius * 0.82, -radius * 0.1);
      ctx.lineTo(radius * 0.82, -radius * 0.1);
      ctx.stroke();
    } else if (shape === "bomb") {
      ctx.beginPath();
      ctx.arc(0, radius * 0.08, radius * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = accent;
      roundRect(ctx, -radius * 0.26, -radius * 1.1, radius * 0.52, radius * 0.35, radius * 0.12);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -radius * 1.1);
      ctx.quadraticCurveTo(radius * 0.48, -radius * 1.45, radius * 0.84, -radius * 1.08);
      ctx.stroke();
    } else if (shape === "flame") {
      ctx.beginPath();
      ctx.moveTo(radius * 0.95, 0);
      ctx.bezierCurveTo(radius * 0.32, -radius * 1.1, -radius * 0.82, -radius * 0.52, -radius * 0.78, radius * 0.28);
      ctx.bezierCurveTo(-radius * 0.68, radius * 1.02, radius * 0.34, radius * 0.9, radius * 0.95, 0);
      ctx.fill();
      ctx.stroke();
    } else if (shape === "bolt") {
      ctx.beginPath();
      ctx.moveTo(-radius * 0.28, -radius * 1.05);
      ctx.lineTo(radius * 0.72, -radius * 0.16);
      ctx.lineTo(radius * 0.18, -radius * 0.04);
      ctx.lineTo(radius * 0.38, radius * 1.06);
      ctx.lineTo(-radius * 0.72, radius * 0.04);
      ctx.lineTo(-radius * 0.18, -radius * 0.08);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (shape === "snowflake") {
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 6; i += 1) {
        const a = i * (Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * radius * 0.18, Math.sin(a) * radius * 0.18);
        ctx.lineTo(Math.cos(a) * radius * 1.05, Math.sin(a) * radius * 1.05);
        ctx.stroke();
      }
    } else if (shape === "ring") {
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.02, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "rgba(4,9,16,0.86)";
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.44, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.62)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.48, 0, Math.PI * 2);
      ctx.stroke();
    } else if (shape === "flower") {
      for (let i = 0; i < 6; i += 1) {
        const a = i * (Math.PI / 3);
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * radius * 0.42, Math.sin(a) * radius * 0.42, radius * 0.42, radius * 0.26, a, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (shape === "comet") {
      ctx.beginPath();
      ctx.moveTo(radius * 1.12, 0);
      ctx.quadraticCurveTo(-radius * 0.1, -radius * 0.95, -radius * 1.06, -radius * 0.34);
      ctx.quadraticCurveTo(-radius * 0.42, 0, -radius * 1.06, radius * 0.34);
      ctx.quadraticCurveTo(-radius * 0.1, radius * 0.95, radius * 1.12, 0);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (shape === "candy") {
        ctx.strokeStyle = "rgba(255,255,255,0.72)";
        ctx.lineWidth = Math.max(2, radius * 0.24);
        ctx.beginPath();
        ctx.moveTo(-radius * 0.78, radius * 0.56);
        ctx.lineTo(radius * 0.72, -radius * 0.52);
        ctx.stroke();
      }
    }

    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(255,255,255,0.76)";
    ctx.beginPath();
    ctx.arc(-radius * 0.28, -radius * 0.34, Math.max(2, radius * 0.22), 0, Math.PI * 2);
    ctx.fill();

    if (cosmetic && budget.drawHalo) {
      ctx.strokeStyle = this.hexToRgba?.(accent, 0.66) || accent;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.36, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

function drawFastMarbleShape(this: any, ctx: CanvasRenderingContext2D, shape: string, radius: number) {
    if (shape === "star" || shape === "flower") {
      drawStarPath(ctx, 0, 0, radius * 1.04, radius * 0.52, shape === "flower" ? 6 : 5);
      return;
    }
    if (shape === "leaf" || shape === "comet") {
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 1.06, radius * 0.62, 0, 0, Math.PI * 2);
      return;
    }
    if (shape === "crystal" || shape === "snowflake") {
      polygonPath(ctx, radius * 1.02, shape === "snowflake" ? 8 : 6, -Math.PI / 2);
      return;
    }
    if (shape === "bolt") {
      ctx.beginPath();
      ctx.moveTo(-radius * 0.22, -radius);
      ctx.lineTo(radius * 0.72, -radius * 0.12);
      ctx.lineTo(radius * 0.18, -radius * 0.02);
      ctx.lineTo(radius * 0.34, radius);
      ctx.lineTo(-radius * 0.72, radius * 0.04);
      ctx.lineTo(-radius * 0.18, -radius * 0.08);
      ctx.closePath();
      return;
    }
    if (shape === "flame") {
      ctx.beginPath();
      ctx.moveTo(radius * 0.9, 0);
      ctx.quadraticCurveTo(0, -radius * 1.12, -radius * 0.82, radius * 0.18);
      ctx.quadraticCurveTo(0, radius * 1.02, radius * 0.9, 0);
      return;
    }
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
  }

function marbleCosmeticBodyScale(visual: any, budget: any) {
    if (!budget.effectsEnabled) return 1;
    const rarity = visual.rarity || "rare";
    const rarityBoost = rarity === "legendary" ? 0.42 : rarity === "epic" ? 0.3 : 0.18;
    return (budget.bodyScale || 1.06) + rarityBoost;
  }

function marbleCosmeticEffectScale(visual: any, budget: any) {
    if (!budget.effectsEnabled) return 1;
    const rarity = visual.rarity || "rare";
    const rarityBoost = rarity === "legendary" ? 0.34 : rarity === "epic" ? 0.22 : 0.12;
    return (budget.effectScale || 1.2) + rarityBoost;
  }

function drawMarbleSkinMark(this: any, ctx: CanvasRenderingContext2D, visual: any, radius: number, accent: string, budget: any) {
    if (!budget.drawSkinMark) return;
    const shape = visual.shape || "orb";
    const rarity = visual.rarity || "rare";

    ctx.save();
    ctx.strokeStyle = rarityColor(rarity);
    ctx.lineWidth = Math.max(1.6, radius * 0.18);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.18, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.lineWidth = Math.max(1.2, radius * 0.14);
    ctx.beginPath();
    ctx.arc(-radius * 0.34, -radius * 0.36, Math.max(1.8, radius * 0.18), 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(1.3, radius * 0.18);
    if (shape === "star") {
      drawStarPath(ctx, 0, 0, radius * 0.48, radius * 0.22, 5);
      ctx.stroke();
    } else if (shape === "flower") {
      for (let i = 0; i < 5; i += 1) {
        const a = i * ((Math.PI * 2) / 5);
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * radius * 0.22, Math.sin(a) * radius * 0.22, radius * 0.22, radius * 0.1, a, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (shape === "crystal" || shape === "snowflake") {
      polygonPath(ctx, radius * 0.46, shape === "snowflake" ? 6 : 4, -Math.PI / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -radius * 0.42);
      ctx.lineTo(0, radius * 0.42);
      ctx.moveTo(-radius * 0.42, 0);
      ctx.lineTo(radius * 0.42, 0);
      ctx.stroke();
    } else if (shape === "bolt") {
      ctx.beginPath();
      ctx.moveTo(-radius * 0.2, -radius * 0.42);
      ctx.lineTo(radius * 0.26, -radius * 0.04);
      ctx.lineTo(-radius * 0.04, radius * 0.02);
      ctx.lineTo(radius * 0.16, radius * 0.48);
      ctx.stroke();
    } else if (shape === "ring" || shape === "orb" || shape === "candy") {
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.54, 0, Math.PI * 2);
      ctx.stroke();
      if (shape === "candy") {
        ctx.beginPath();
        ctx.moveTo(-radius * 0.4, radius * 0.28);
        ctx.lineTo(radius * 0.4, -radius * 0.28);
        ctx.stroke();
      }
    } else if (shape === "flame" || shape === "comet") {
      ctx.beginPath();
      ctx.moveTo(-radius * 0.36, radius * 0.28);
      ctx.quadraticCurveTo(radius * 0.1, -radius * 0.5, radius * 0.38, radius * 0.18);
      ctx.stroke();
    } else if (shape === "leaf") {
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * 0.46, radius * 0.22, -0.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-radius * 0.34, radius * 0.1);
      ctx.lineTo(radius * 0.34, -radius * 0.1);
      ctx.stroke();
    } else if (shape === "bomb") {
      ctx.beginPath();
      ctx.arc(0, radius * 0.08, radius * 0.34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(radius * 0.08, -radius * 0.24);
      ctx.quadraticCurveTo(radius * 0.38, -radius * 0.5, radius * 0.54, -radius * 0.28);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(-radius * 0.48, 0);
      ctx.lineTo(radius * 0.48, 0);
      ctx.moveTo(0, -radius * 0.48);
      ctx.lineTo(0, radius * 0.48);
      ctx.stroke();
    }
    ctx.restore();
  }

function drawStarPath(ctx: CanvasRenderingContext2D, x: number, y: number, outer: number, inner: number, points: number) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i += 1) {
      const r = i % 2 === 0 ? outer : inner;
      const a = -Math.PI / 2 + i * (Math.PI / points);
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

function polygonPath(ctx: CanvasRenderingContext2D, radius: number, sides: number, offset = 0) {
    ctx.beginPath();
    for (let i = 0; i < sides; i += 1) {
      const a = offset + i * ((Math.PI * 2) / sides);
      const x = Math.cos(a) * radius;
      const y = Math.sin(a) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

function drawMarbleCosmeticImpact(this: any, ctx: CanvasRenderingContext2D, effect: VisualEffect, session: Session, t: number, fade: number, radius: number) {
    const defeat = effect.kind === "marble-defeat";
    const style = effect.style || "spark";
    const color = effect.color || "#54c7ff";
    const accent = effect.accentColor || color;
    const rarity = effect.rarity || "rare";
    const rarityBoost = rarity === "legendary" ? 1.28 : rarity === "epic" ? 1.12 : 1;
    const ringRadius = radius * (defeat ? 1.04 : 0.86);
    const alpha = fade * (defeat ? 0.78 : 0.58);
    const spin = session.elapsed * (defeat ? 2.4 : 4.2) + (effect.angle || 0);
    const pulse = 0.5 + Math.sin(session.elapsed * 13 + effect.x * 0.02) * 0.5;
    const rgba = this.hexToRgba?.bind(this);

    ctx.translate(effect.x, effect.y);
    ctx.rotate(effect.angle || 0);
    ctx.globalCompositeOperation = "lighter";

    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, ringRadius * (defeat ? 1.48 : 1.1));
    glow.addColorStop(0, rgba?.(accent, defeat ? 0.34 * alpha : 0.28 * alpha) || accent);
    glow.addColorStop(0.58, rgba?.(color, defeat ? 0.16 * alpha : 0.1 * alpha) || color);
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius * (defeat ? 1.52 : 1.12), 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = rarity === "legendary" ? 18 : rarity === "epic" ? 13 : 8;
    ctx.lineWidth = Math.max(1.6, ringRadius * (defeat ? 0.08 : 0.06));
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    if (defeat) {
      ctx.globalAlpha = alpha * 0.68;
      ctx.strokeStyle = rarityColor(rarity);
      ctx.lineWidth = Math.max(1.2, ringRadius * 0.04);
      ctx.beginPath();
      ctx.arc(0, 0, ringRadius * (1.28 + pulse * 0.16), 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.shadowBlur = rarity === "legendary" ? 14 : 8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (style === "electric") {
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1.6, ringRadius * 0.05);
      const bolts = defeat ? 8 : 5;
      for (let i = 0; i < bolts; i += 1) {
        const a = spin + i * ((Math.PI * 2) / bolts);
        const reach = ringRadius * (defeat ? 1.65 : 1.18) * rarityBoost;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * ringRadius * 0.24, Math.sin(a) * ringRadius * 0.24);
        ctx.lineTo(Math.cos(a + 0.18) * reach * 0.46, Math.sin(a + 0.18) * reach * 0.46);
        ctx.lineTo(Math.cos(a - 0.22) * reach * 0.72, Math.sin(a - 0.22) * reach * 0.72);
        ctx.lineTo(Math.cos(a + 0.08) * reach, Math.sin(a + 0.08) * reach);
        ctx.stroke();
      }
    } else if (style === "frost" || style === "crystal") {
      ctx.strokeStyle = style === "crystal" ? rarityColor(rarity) : accent;
      ctx.fillStyle = rgba?.(color, 0.28 * alpha) || color;
      const shards = defeat ? 8 : 5;
      for (let i = 0; i < shards; i += 1) {
        const a = spin + i * ((Math.PI * 2) / shards);
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(ringRadius * 0.22, 0);
        ctx.lineTo(ringRadius * (defeat ? 1.42 : 0.94), -ringRadius * 0.13);
        ctx.lineTo(ringRadius * (defeat ? 1.12 : 0.72), ringRadius * 0.16);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    } else if (style === "petal") {
      ctx.fillStyle = rgba?.(accent, 0.4 * alpha) || accent;
      ctx.strokeStyle = color;
      const petals = defeat ? 9 : 6;
      for (let i = 0; i < petals; i += 1) {
        const a = spin + i * ((Math.PI * 2) / petals);
        const distance = ringRadius * (defeat ? 0.9 + t * 0.58 : 0.54 + t * 0.34);
        ctx.save();
        ctx.translate(Math.cos(a) * distance, Math.sin(a) * distance);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, 0, ringRadius * 0.25, ringRadius * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    } else if (style === "ribbon") {
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(2, ringRadius * 0.07);
      const ribbons = defeat ? 3 : 2;
      for (let i = 0; i < ribbons; i += 1) {
        const offset = (i - (ribbons - 1) / 2) * ringRadius * 0.32;
        ctx.beginPath();
        ctx.moveTo(-ringRadius * 1.2, offset);
        ctx.bezierCurveTo(-ringRadius * 0.36, -ringRadius * 0.7 + offset, ringRadius * 0.32, ringRadius * 0.72 - offset, ringRadius * 1.22, -offset * 0.42);
        ctx.stroke();
      }
    } else if (style === "galaxy" || style === "pulse") {
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(1.6, ringRadius * 0.045);
      const orbits = style === "pulse" ? 2 : 3;
      for (let i = 0; i < orbits; i += 1) {
        ctx.save();
        ctx.rotate(spin * 0.35 + i * 0.82);
        ctx.beginPath();
        ctx.ellipse(0, 0, ringRadius * (0.74 + i * 0.22), ringRadius * (0.28 + i * 0.08), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = rarityColor(rarity);
      for (let i = 0; i < (defeat ? 5 : 3); i += 1) {
        const a = spin + i * ((Math.PI * 2) / (defeat ? 5 : 3));
        drawStarPath(ctx, Math.cos(a) * ringRadius * 0.95, Math.sin(a) * ringRadius * 0.58, ringRadius * 0.13, ringRadius * 0.05, 4);
        ctx.fill();
      }
    } else {
      ctx.strokeStyle = style === "flare" ? rarityColor(rarity) : accent;
      ctx.lineWidth = Math.max(1.5, ringRadius * 0.045);
      const rays = style === "flare" ? (defeat ? 14 : 8) : defeat ? 10 : 6;
      for (let i = 0; i < rays; i += 1) {
        const a = spin + i * ((Math.PI * 2) / rays);
        const inner = ringRadius * (style === "flare" ? 0.32 : 0.46);
        const outer = ringRadius * (defeat ? 1.58 : 1.08) * (0.88 + ((i % 3) * 0.08));
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
        ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
        ctx.stroke();
      }
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
  }

function drawSkillEffects(this: any, ctx: CanvasRenderingContext2D, session: Session) {
    for (const effect of session.effects) {
      const age = effect.maxLife - effect.life;
      const t = clamp(age / effect.maxLife, 0, 1);
      const fade = clamp(effect.life / effect.maxLife, 0, 1);
      const radius = lerp(effect.radius, effect.maxRadius, easeOutCubic(t));

      ctx.save();

      if (effect.kind === "marble-hit" || effect.kind === "marble-defeat") {
        this.drawMarbleCosmeticImpact(ctx, effect, session, t, fade, radius);
        ctx.restore();
        continue;
      }

      if (effect.kind === "blast-wave") {
        ctx.globalAlpha = fade;
        const glow = ctx.createRadialGradient(effect.x, effect.y, 0, effect.x, effect.y, radius);
        glow.addColorStop(0, "rgba(246, 201, 95, 0.34)");
        glow.addColorStop(0.48, "rgba(246, 201, 95, 0.16)");
        glow.addColorStop(1, "rgba(246, 201, 95, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = effect.color;
        ctx.shadowColor = effect.color;
        ctx.shadowBlur = 28;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, radius * 0.92, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (effect.kind === "magnet-field") {
        const spin = session.elapsed * 2.2;
        ctx.globalAlpha = 0.22 + fade * 0.28;
        ctx.strokeStyle = effect.color;
        ctx.shadowColor = effect.color;
        ctx.shadowBlur = 22;
        ctx.lineWidth = 4;

        for (let i = 0; i < 3; i += 1) {
          const ring = radius * (0.45 + i * 0.22);
          ctx.beginPath();
          ctx.ellipse(effect.x, effect.y, ring, ring * 0.48, spin + i * 0.9, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.globalAlpha = 0.5 * fade;
        for (let i = 0; i < 10; i += 1) {
          const angle = spin + i * ((Math.PI * 2) / 10);
          const dotRadius = radius * (0.25 + (i % 3) * 0.16);
          ctx.fillStyle = i % 2 ? "#b68cff" : effect.color;
          ctx.beginPath();
          ctx.arc(effect.x + Math.cos(angle) * dotRadius, effect.y + Math.sin(angle) * dotRadius * 0.56, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (effect.kind === "engineer-field") {
        const pulse = 0.5 + Math.sin(session.elapsed * 7) * 0.5;
        ctx.globalAlpha = 0.18 + fade * 0.28;
        ctx.strokeStyle = effect.color;
        ctx.shadowColor = effect.color;
        ctx.shadowBlur = 22;
        ctx.lineWidth = 5;

        for (let i = 0; i < 4; i += 1) {
          const y = FIELD_BOTTOM - 78 - i * 64;
          ctx.beginPath();
          ctx.moveTo(FIELD.x + 18, y + Math.sin(session.elapsed * 4 + i) * 10);
          ctx.lineTo(FIELD_RIGHT - 18, y + Math.cos(session.elapsed * 3.5 + i) * 10);
          ctx.stroke();
        }

        ctx.globalAlpha = 0.45 * fade;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, 72 + pulse * 18, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

function drawCharacters(this: any, ctx: CanvasRenderingContext2D, session: Session) {
    for (const character of session.characters) {
      const visual = this.characterVisualConfig?.(character.id) || { color: character.color, accentColor: character.color, cosmetic: null, label: "" };
      const bodyColor = visual.color || character.color;
      const accentColor = visual.accentColor || bodyColor;
      const cosmetic = visual.cosmetic;
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.32)";
      ctx.beginPath();
      ctx.ellipse(character.x, character.y + 25, 34, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      const portrait = this.characterPortraits.get(character.id);
      const plateSize = 58;
      const plateX = character.x - plateSize / 2;
      const plateY = character.y - 33;

      if (cosmetic) {
        const aura = 0.5 + Math.sin(session.elapsed * 4.8 + character.x * 0.02) * 0.5;
        ctx.globalAlpha = 0.18 + aura * 0.16;
        ctx.strokeStyle = this.hexToRgba?.(accentColor, 0.9) || accentColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(character.x, character.y + 22, 44 + aura * 5, 16 + aura * 3, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = "rgba(7, 12, 22, 0.92)";
      ctx.shadowColor = cosmetic ? accentColor : character.color;
      ctx.shadowBlur = character.skillActive > 0 ? (cosmetic ? 30 : 24) : cosmetic ? 18 : 12;
      roundRect(ctx, plateX, plateY, plateSize, plateSize, 16);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.save();
      roundRect(ctx, plateX + 2, plateY + 2, plateSize - 4, plateSize - 4, 14);
      ctx.clip();
      const backdrop = ctx.createLinearGradient(plateX, plateY, plateX, plateY + plateSize);
      backdrop.addColorStop(0, cosmetic ? this.hexToRgba?.(accentColor, 0.5) || "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.18)");
      backdrop.addColorStop(1, bodyColor);
      ctx.fillStyle = backdrop;
      ctx.fillRect(plateX, plateY, plateSize, plateSize);

      if (portrait?.complete && portrait.naturalWidth > 0) {
        ctx.drawImage(portrait, character.x - 36, character.y - 48, 72, 72);
      } else {
        ctx.fillStyle = "#101522";
        ctx.font = "800 18px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(character.name.slice(0, 1), character.x, character.y - 3);
      }
      if (cosmetic) {
        const coatY = plateY + plateSize * 0.58;
        ctx.fillStyle = this.hexToRgba?.(bodyColor, 0.52) || "rgba(84,199,255,0.52)";
        ctx.beginPath();
        ctx.moveTo(plateX + 4, coatY);
        ctx.lineTo(plateX + plateSize - 4, coatY - 6);
        ctx.lineTo(plateX + plateSize - 2, plateY + plateSize - 2);
        ctx.lineTo(plateX + 2, plateY + plateSize - 2);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = this.hexToRgba?.(accentColor, 0.68) || "rgba(246,201,95,0.68)";
        ctx.beginPath();
        ctx.moveTo(plateX + 8, plateY + plateSize - 7);
        ctx.lineTo(plateX + 25, coatY + 4);
        ctx.lineTo(plateX + 31, plateY + plateSize - 2);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(plateX + plateSize - 8, plateY + plateSize - 7);
        ctx.lineTo(plateX + plateSize - 25, coatY + 2);
        ctx.lineTo(plateX + plateSize - 31, plateY + plateSize - 2);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = this.hexToRgba?.(accentColor, 0.74) || accentColor;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(plateX + 9, plateY + plateSize - 9);
        ctx.lineTo(plateX + plateSize - 8, plateY + 13);
        ctx.stroke();
      }
      ctx.restore();

      ctx.strokeStyle = cosmetic ? accentColor : "rgba(255,255,255,0.44)";
      ctx.lineWidth = cosmetic ? 3.2 : 2.5;
      roundRect(ctx, plateX, plateY, plateSize, plateSize, 16);
      ctx.stroke();

      if (cosmetic) {
        ctx.fillStyle = this.hexToRgba?.(bodyColor, 0.88) || bodyColor;
        ctx.shadowColor = bodyColor;
        ctx.shadowBlur = 12;
        roundRect(ctx, plateX + 5, plateY - 15, plateSize - 10, 16, 7);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fff";
        ctx.font = "950 9px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(cosmetic.name || "幻化").split("·").pop()?.trim().slice(0, 4) || "幻化", character.x, plateY - 7);

        ctx.fillStyle = accentColor;
        ctx.shadowColor = accentColor;
        ctx.shadowBlur = 10;
        roundRect(ctx, plateX + plateSize - 22, plateY + plateSize - 20, 19, 17, 6);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#08111d";
        ctx.font = "950 10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(visual.label || "幻").slice(0, 1), plateX + plateSize - 12.5, plateY + plateSize - 11.5);

        for (let i = 0; i < 3; i += 1) {
          const angle = session.elapsed * 2.1 + i * ((Math.PI * 2) / 3);
          const sparkleX = character.x + Math.cos(angle) * (34 + i * 2);
          const sparkleY = character.y - 5 + Math.sin(angle) * 22;
          ctx.fillStyle = i % 2 === 0 ? accentColor : bodyColor;
          ctx.globalAlpha = 0.58;
          ctx.beginPath();
          ctx.arc(sparkleX, sparkleY, 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      const cooldown = this.skillCooldownFor(character);
      const progress = cooldown <= 0 ? 1 : clamp(1 - character.skillTimer / cooldown, 0, 1);
      const ready = progress >= 1;
      const pulse = 0.5 + Math.sin(session.elapsed * 8) * 0.5;
      const ringRadius = ready ? 34 + pulse * 3 : 32;
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + Math.PI * 2 * progress;

      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(5,10,18,0.84)";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(character.x, character.y, 33, 0, Math.PI * 2);
      ctx.stroke();

      const ringColor = ready ? (cosmetic ? accentColor : "#f6c95f") : bodyColor;
      ctx.strokeStyle = ringColor;
      ctx.shadowColor = ringColor;
      ctx.shadowBlur = ready ? 22 : 9;
      ctx.lineWidth = ready ? 7 : 6;
      ctx.beginPath();
      ctx.arc(character.x, character.y, ringRadius, startAngle, endAngle);
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (ready) {
        ctx.globalAlpha = 0.28 + pulse * 0.34;
        ctx.strokeStyle = cosmetic ? this.hexToRgba?.(accentColor, 0.9) || accentColor : "rgba(246,201,95,0.9)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(character.x, character.y, 43 + pulse * 8, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = 1;
        ctx.fillStyle = cosmetic ? accentColor : "#f6c95f";
        for (let i = 0; i < 4; i += 1) {
          const angle = session.elapsed * 3.2 + i * (Math.PI / 2);
          ctx.beginPath();
          ctx.arc(character.x + Math.cos(angle) * 48, character.y + Math.sin(angle) * 48, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (character.skillActive > 0) {
        const activePulse = 0.5 + Math.sin(session.elapsed * 9) * 0.5;
        ctx.globalAlpha = 0.22 + activePulse * 0.24;
        ctx.strokeStyle = bodyColor;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(character.x, character.y, 55 + activePulse * 10, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

function drawParticles(this: any, ctx: CanvasRenderingContext2D, session: Session) {
    for (const particle of session.particles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      if (particle.text) {
        ctx.fillStyle = particle.color;
        ctx.font = "800 20px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(particle.text, particle.x, particle.y);
      } else {
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius * (0.65 + alpha * 0.55), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

function drawDropVisuals(this: any, ctx: CanvasRenderingContext2D, session: Session) {
    for (const visual of session.dropVisuals) {
      const flying = visual.age > visual.hold;
      const flyT = flying ? clamp((visual.age - visual.hold) / visual.fly, 0, 1) : 0;
      const pulse = 0.5 + Math.sin(session.elapsed * 7 + visual.seed) * 0.5;
      const scale = flying ? lerp(1, 0.46, easeInOutCubic(flyT)) : 1 + pulse * 0.06;
      const alpha = flying ? 1 - flyT * 0.18 : 1;
      this.drawDropCard(ctx, visual.drop, visual.x, visual.y, scale, alpha, !flying);
    }
  }

function drawDropCard(this: any, ctx: CanvasRenderingContext2D, drop: DropEntry, x: number, y: number, scale: number, alpha: number, showLabel: boolean) {
    const rarity = drop.rarity;
    const color = rarityColor(rarity);
    const icon = dropIconText(drop);
    const amount = dropAmount(drop);
    const label = dropShortLabel(drop);

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;

    const width = showLabel ? 84 : 58;
    const height = showLabel ? 66 : 54;
    ctx.shadowColor = color;
    ctx.shadowBlur = rarity === "legendary" ? 30 : rarity === "epic" ? 23 : 16;
    ctx.fillStyle = "rgba(8, 15, 27, 0.88)";
    ctx.strokeStyle = color;
    ctx.lineWidth = rarity === "legendary" ? 3 : 2;
    roundRect(ctx, -width / 2, -height / 2, width, height, 8);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = dropIconFill(drop);
    ctx.strokeStyle = "rgba(255,255,255,0.58)";
    ctx.lineWidth = 2;
    this.drawDropIconShape(ctx, drop, 0, showLabel ? -9 : 0, 26);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#09131a";
    ctx.font = "900 18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon, 0, showLabel ? -9 : 0);

    if (amount > 1) {
      ctx.fillStyle = color;
      ctx.font = "900 13px system-ui, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`×${amount}`, width / 2 - 8, -height / 2 + 12);
    }

    if (showLabel) {
      ctx.fillStyle = "#eef4ff";
      ctx.font = "900 12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, 0, 22);
    }

    ctx.restore();
  }

function drawDropIconShape(this: any, ctx: CanvasRenderingContext2D, drop: DropEntry, x: number, y: number, size: number) {
    if (drop.type === "gem") {
      ctx.beginPath();
      ctx.moveTo(x, y - size * 0.62);
      ctx.lineTo(x + size * 0.62, y);
      ctx.lineTo(x, y + size * 0.62);
      ctx.lineTo(x - size * 0.62, y);
      ctx.closePath();
      return;
    }

    if (drop.type === "marbleShard") {
      ctx.beginPath();
      ctx.arc(x, y, size * 0.58, 0, Math.PI * 2);
      return;
    }

    roundRect(ctx, x - size * 0.58, y - size * 0.58, size * 1.16, size * 1.16, 7);
  }

function drawBattleInfo(this: any, ctx: CanvasRenderingContext2D, session: Session) {
    ctx.save();
    if (session.waveBannerTimer > 0) {
      ctx.globalAlpha = clamp(session.waveBannerTimer, 0, 1);
      ctx.fillStyle = "rgba(12,20,34,0.82)";
      roundRect(ctx, 180, 570, 360, 92, 8);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 34px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(battleWaveBannerText(session), WIDTH / 2, 625);
    }
    ctx.restore();
  }

function addParticle(this: any, x: number, y: number, color: string, count: number) {
    const session = this.session;
    if (!session) return;
    const room = (this.battleParticleLimit?.(session) ?? 32) - session.particles.length;
    if (room <= 0) return;
    const capped = Math.min(room, session.speed >= 3 ? Math.ceil(count * 0.25) : Math.ceil(count * 0.55));
    for (let i = 0; i < capped; i += 1) {
      const angle = randomRange(0, Math.PI * 2);
      const speed = randomRange(32, 160);
      session.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: randomRange(0.28, 0.62),
        maxLife: 0.62,
        radius: randomRange(2, 5),
        color,
      });
    }
  }

function addBurst(this: any, x: number, y: number, color: string, count: number, force: number, life: number) {
    const session = this.session;
    if (!session) return;
    const room = (this.battleParticleLimit?.(session) ?? 32) - session.particles.length;
    if (room <= 0) return;
    const capped = Math.min(room, session.speed >= 3 ? Math.ceil(count * 0.25) : Math.ceil(count * 0.5));

    for (let i = 0; i < capped; i += 1) {
      const angle = randomRange(0, Math.PI * 2);
      const speed = randomRange(force * 0.35, force);
      session.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: randomRange(life * 0.65, life),
        maxLife: life,
        radius: randomRange(3, 8),
        color,
      });
    }
  }

function addEffect(this: any, kind: VisualEffect["kind"], x: number, y: number, life: number, radius: number, maxRadius: number, color: string) {
    const session = this.session;
    if (!session) return;
    if (session.effects.length >= (session.speed >= 3 ? 10 : 18)) return;
    session.effects.push({
      kind,
      x,
      y,
      life,
      maxLife: life,
      radius,
      maxRadius,
      color,
    });
  }

function addMarbleCosmeticEffect(this: any, marble: Marble | null, x: number, y: number, mode: "hit" | "defeat", enemy: Enemy | null = null) {
    const session = this.session;
    if (!session || !marble) return;
    if (this.save?.preferences?.battleEffectsEnabled === false) return;
    const visual = this.marbleVisualConfig?.(marble.marbleId);
    if (!visual?.cosmetic) return;

    const intensity = this.save?.preferences?.cosmeticEffectIntensity || "medium";
    const defeat = mode === "defeat";
    if (!defeat) {
      const chance = intensity === "high" ? 0.7 : intensity === "medium" ? 0.5 : 0.28;
      const crowdPenalty = session.marbles.length > 72 ? 0.32 : session.marbles.length > 36 ? 0.58 : 1;
      const speedPenalty = session.speed >= 3 ? 0.45 : 1;
      if (Math.random() > chance * crowdPenalty * speedPenalty) return;
    }

    const maxEffects = session.speed >= 3 ? (defeat ? 9 : 7) : intensity === "high" ? 24 : 18;
    if (session.effects.length >= maxEffects) return;

    const rarity = visual.rarity || "rare";
    const rarityScale = rarity === "legendary" ? 1.28 : rarity === "epic" ? 1.12 : 1;
    const baseRadius = Math.max(marble.radius * 1.6, enemy?.radius || marble.radius);
    const life = defeat ? (rarity === "legendary" ? 0.72 : 0.58) : 0.28;
    const maxRadius = defeat
      ? clamp(baseRadius * (enemy?.type === "boss" ? 2.2 : 1.75) * rarityScale, 42, enemy?.type === "boss" ? 190 : 110)
      : clamp(baseRadius * 1.18 * rarityScale, 20, 56);

    session.effects.push({
      kind: defeat ? "marble-defeat" : "marble-hit",
      x,
      y,
      life,
      maxLife: life,
      radius: defeat ? Math.max(10, baseRadius * 0.34) : Math.max(6, baseRadius * 0.18),
      maxRadius,
      color: visual.color,
      accentColor: visual.accentColor || visual.color,
      style: defeat ? visual.defeatStyle || visual.hitStyle : visual.hitStyle,
      rarity,
      angle: Math.atan2(marble.vy, marble.vx),
    });

    if (session.speed < 4 && session.marbles.length <= 72) {
      const burstCount = defeat ? (rarity === "legendary" ? 10 : rarity === "epic" ? 7 : 5) : 2;
      const scaledCount = intensity === "low" ? Math.ceil(burstCount * 0.45) : intensity === "high" ? burstCount + 2 : burstCount;
      if (defeat) this.addBurst(x, y, visual.accentColor || visual.color, scaledCount, enemy?.type === "boss" ? 220 : 150, life * 0.82);
      else this.addParticle(x, y, visual.accentColor || visual.color, scaledCount);
    }
  }

function addLineParticle(this: any, x1: number, y1: number, x2: number, y2: number, color: string) {
    const session = this.session;
    if (!session) return;
    const steps = session.speed >= 3 || session.marbles.length > 24 ? 2 : 3;
    for (let i = 0; i < steps; i += 1) {
      const t = i / (steps - 1);
      this.addParticle(lerp(x1, x2, t), lerp(y1, y2, t), color, 1);
    }
  }

function battleParticleLimit(this: any, session: Session) {
    if (session.speed >= 3) return 24;
    if (session.marbles.length > 48) return 28;
    if (session.marbles.length > 24) return 36;
    return 48;
  }

function addFloatingText(this: any, x: number, y: number, text: string, color: string) {
    const session = this.session;
    if (!session) return;
    if (session.particles.length >= (this.battleParticleLimit?.(session) ?? 32)) return;
    session.particles.push({
      x,
      y,
      vx: randomRange(-8, 8),
      vy: -52,
      life: 0.78,
      maxLife: 0.78,
      radius: 1,
      color,
      text,
    });
  }

export const gameBattleRenderMethods = {
  draw,
  drawBackground,
  battleBackgroundKey,
  drawFallbackBackground,
  drawHomeBackground,
  drawCoverImage,
  drawMenuPreview,
  drawField,
  drawEnemies,
  drawMarbles,
  marbleRenderBudget,
  drawMarbleCosmeticAura,
  drawMarbleCosmeticWake,
  drawMarbleTrail,
  drawMarbleTrailMark,
  drawMarbleBody,
  drawFastMarbleShape,
  marbleCosmeticBodyScale,
  marbleCosmeticEffectScale,
  drawMarbleSkinMark,
  drawMarbleCosmeticImpact,
  drawSkillEffects,
  drawCharacters,
  drawParticles,
  drawDropVisuals,
  drawDropCard,
  drawDropIconShape,
  drawBattleInfo,
  addParticle,
  addBurst,
  addEffect,
  addMarbleCosmeticEffect,
  addLineParticle,
  battleParticleLimit,
  addFloatingText,
} satisfies Record<string, GameMethod>;
