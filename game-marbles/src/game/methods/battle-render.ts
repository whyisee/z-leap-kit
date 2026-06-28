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
    for (const marble of session.marbles) {
      const config = marbleConfigs[marble.marbleId];
      ctx.save();
      for (let i = 0; i < marble.trail.length; i += 1) {
        const point = marble.trail[i];
        const alpha = i / marble.trail.length;
        ctx.fillStyle = config.trail.replace(/0\.\d+\)/, `${0.05 + alpha * 0.22})`);
        ctx.beginPath();
        ctx.arc(point.x, point.y, marble.radius * (0.45 + alpha * 0.45), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = config.color;
      ctx.shadowColor = config.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(marble.x, marble.y, marble.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.beginPath();
      ctx.arc(marble.x - marble.radius * 0.28, marble.y - marble.radius * 0.34, Math.max(2, marble.radius * 0.28), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

function drawSkillEffects(this: any, ctx: CanvasRenderingContext2D, session: Session) {
    for (const effect of session.effects) {
      const age = effect.maxLife - effect.life;
      const t = clamp(age / effect.maxLife, 0, 1);
      const fade = clamp(effect.life / effect.maxLife, 0, 1);
      const radius = lerp(effect.radius, effect.maxRadius, easeOutCubic(t));

      ctx.save();

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
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.32)";
      ctx.beginPath();
      ctx.ellipse(character.x, character.y + 25, 34, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      const portrait = this.characterPortraits.get(character.id);
      const plateSize = 58;
      const plateX = character.x - plateSize / 2;
      const plateY = character.y - 33;

      ctx.fillStyle = "rgba(7, 12, 22, 0.92)";
      ctx.shadowColor = character.color;
      ctx.shadowBlur = character.skillActive > 0 ? 24 : 12;
      roundRect(ctx, plateX, plateY, plateSize, plateSize, 16);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.save();
      roundRect(ctx, plateX + 2, plateY + 2, plateSize - 4, plateSize - 4, 14);
      ctx.clip();
      const backdrop = ctx.createLinearGradient(plateX, plateY, plateX, plateY + plateSize);
      backdrop.addColorStop(0, "rgba(255,255,255,0.18)");
      backdrop.addColorStop(1, character.color);
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
      ctx.restore();

      ctx.strokeStyle = "rgba(255,255,255,0.44)";
      ctx.lineWidth = 2.5;
      roundRect(ctx, plateX, plateY, plateSize, plateSize, 16);
      ctx.stroke();

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

      ctx.strokeStyle = ready ? "#f6c95f" : character.color;
      ctx.shadowColor = ready ? "#f6c95f" : character.color;
      ctx.shadowBlur = ready ? 22 : 9;
      ctx.lineWidth = ready ? 7 : 6;
      ctx.beginPath();
      ctx.arc(character.x, character.y, ringRadius, startAngle, endAngle);
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (ready) {
        ctx.globalAlpha = 0.28 + pulse * 0.34;
        ctx.strokeStyle = "rgba(246,201,95,0.9)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(character.x, character.y, 43 + pulse * 8, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = 1;
        ctx.fillStyle = "#f6c95f";
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
        ctx.strokeStyle = character.color;
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
    const capped = session.speed === 4 ? Math.ceil(count * 0.45) : count;
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
    const capped = session.speed === 4 ? Math.ceil(count * 0.55) : count;

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

function addLineParticle(this: any, x1: number, y1: number, x2: number, y2: number, color: string) {
    const session = this.session;
    if (!session) return;
    const steps = 5;
    for (let i = 0; i < steps; i += 1) {
      const t = i / (steps - 1);
      this.addParticle(lerp(x1, x2, t), lerp(y1, y2, t), color, 1);
    }
  }

function addFloatingText(this: any, x: number, y: number, text: string, color: string) {
    const session = this.session;
    if (!session) return;
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
  addLineParticle,
  addFloatingText,
} satisfies Record<string, GameMethod>;
