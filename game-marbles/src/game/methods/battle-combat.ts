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

function spawnEnemy(this: any, 
    type: EnemyType,
    wave: WaveConfig,
    x?: number,
    y?: number,
    hpScale = 1,
    vxOverride?: number,
    rowId: number | null = null,
    rowSpeed: number | null = null,
  ) {
    const session = this.requireSession();
    const config = enemyConfigs[type];
    const legendarySpeed = session.modifiers.cardStacks.enemySpeedDebt ? 1.08 : 1;
    const enemy: Enemy = {
      id: session.entities++,
      type,
      name: config.name,
      x: x ?? randomRange(FIELD.x + config.radius, FIELD_RIGHT - config.radius),
      y: y ?? FIELD.y - config.radius - randomRange(0, 42),
      vx: vxOverride ?? (type === "fast" ? randomChoice([-18, 18]) : randomRange(-8, 8)),
      hp: config.hp * wave.hpMultiplier * hpScale,
      maxHp: config.hp * wave.hpMultiplier * hpScale,
      speed: config.speed * wave.speedMultiplier * legendarySpeed,
      radius: config.radius,
      exp: config.exp * (1 + wave.wave * 0.035),
      coins: config.coins * (1 + wave.wave * 0.025),
      armor: config.armor || 0,
      rowId,
      rowSpeed,
      slowTimer: 0,
      slowPower: 0,
      burnTimer: 0,
      burnDps: 0,
      healTimer: 0,
      shieldTimer: randomRange(0, 2),
      bossPhase: 1,
      skillTimer: type === "boss" ? 4 : type === "elite" ? 5 : 0,
      dead: false,
    };

    session.enemies.push(enemy);
    return enemy;
  }

function updateCharacters(this: any, dt: number) {
    const session = this.requireSession();
    for (const character of session.characters) {
      const haste = this.characterHaste(character);
      for (const marbleId of character.marbles) {
        character.cooldowns[marbleId] -= dt;
        if (character.cooldowns[marbleId] <= 0) {
          this.fireMarble(character, marbleId);
          const base = marbleConfigs[marbleId].cooldown;
          character.cooldowns[marbleId] = base / (session.modifiers.fireRateMul * haste);
        }
      }
    }
  }

function characterHaste(this: any, character: CharacterRuntime) {
    const session = this.requireSession();
    let haste = this.characterBattleStats(character).fireRateMul;
    if (character.id === "engineer") haste *= 1 + (session.modifiers.cardStacks.engineerHaste || 0) * 0.18;
    return haste;
  }

function fireMarble(this: any, character: CharacterRuntime, marbleId: MarbleId, angleOffset = 0, small = false) {
    const session = this.requireSession();
    const config = marbleConfigs[marbleId];
    const target = this.pickTarget();
    let aimX = 0;
    let aimY = -1;

    if (target) {
      aimX = target.x - character.x;
      aimY = target.y - character.y;
      const len = Math.hypot(aimX, aimY) || 1;
      aimX /= len;
      aimY /= len;
    }

    const jitter = randomRange(-0.16, 0.16) + angleOffset;
    const rotated = rotate(aimX, aimY, jitter);
    const speed = config.speed * session.modifiers.marbleSpeedMul * (small ? 0.88 : 1);
    const splitLife = session.modifiers.cardStacks.splitLife || 0;
    const reboundLevel =
      character.id === "engineer" && (marbleId === "basic" || marbleId === "split")
        ? this.characterRouteLevel(character.id, "engineer_rebound")
        : 0;
    const sentinelPierce =
      character.id === "sentinel" && (marbleId === "basic" || marbleId === "slow")
        ? Math.floor(this.characterRouteLevel(character.id, "sentinel_pierce") / 3)
        : 0;
    const sentinelPassivePierce =
      character.id === "sentinel" && this.passiveUnlocked(character.id, "sentinel_fireline") && (marbleId === "basic" || marbleId === "slow")
        ? 1
        : 0;
    const prismLife =
      character.id === "prism" && marbleId === "split"
        ? this.characterRouteLevel(character.id, "prism_split") * 0.15 + (this.passiveUnlocked(character.id, "prism_facets") ? 0.4 : 0)
        : 0;
    const voidLife =
      character.id === "voidbinder" && marbleId === "split"
        ? this.characterRouteLevel(character.id, "voidbinder_split") * 0.12 + (this.passiveUnlocked(character.id, "voidbinder_gravity") ? 0.35 : 0)
        : 0;
    const smallDamageMul = small && character.id === "prism" && this.passiveUnlocked(character.id, "prism_facets") ? 1.12 : 1;
    const marble: Marble = {
      id: session.entities++,
      marbleId,
      ownerId: character.id,
      x: character.x,
      y: character.y,
      vx: rotated.x * speed,
      vy: rotated.y * speed,
      radius: Math.max(5, config.radius * (small ? 0.68 : 1)),
      damage: config.damage * this.marbleDamageLevelMul(marbleId) * (small ? 0.54 : 1) * smallDamageMul * this.characterDamageMul(character, marbleId),
      lifetime: config.lifetime + (marbleId === "split" ? splitLife * 0.5 : 0) + prismLife + voidLife,
      bounce: 0,
      maxBounce: config.maxBounce + Math.floor(reboundLevel / 2),
      hitCount: 0,
      pierce: session.modifiers.globalPierce + sentinelPierce + sentinelPassivePierce,
      splitDone: small,
      hitCooldown: new Map(),
      trail: [],
      small,
    };

    session.marbles.push(marble);
    this.sound.play("shoot", small ? 90 : 55, marbleIdSoundVariant(marbleId));

    if (character.id === "engineer" && Math.random() < 0.08) {
      this.addParticle(character.x, character.y, "#61e6a8", 8);
    }

    if (!small && character.id === "engineer" && this.passiveUnlocked(character.id, "engineer_replica") && Math.random() < 0.1) {
      this.fireMarble(character, marbleId, randomRange(-0.28, 0.28), true);
    }
  }

function pickTarget(this: any) {
    const session = this.requireSession();
    if (session.enemies.length === 0) return null;

    let best: Enemy | null = null;
    for (const enemy of session.enemies) {
      if (enemy.dead) continue;
      if (!best) {
        best = enemy;
        continue;
      }
      if (enemy.type === "boss" && best.type !== "boss") {
        best = enemy;
        continue;
      }
      if (enemy.type !== "boss" && best.type === "boss") continue;
      if (enemy.y > best.y) best = enemy;
    }
    return best;
  }

function updateEnemies(this: any, dt: number) {
    const session = this.requireSession();

    for (const enemy of session.enemies) {
      enemy.slowTimer = Math.max(0, enemy.slowTimer - dt);
      enemy.burnTimer = Math.max(0, enemy.burnTimer - dt);
      enemy.shieldTimer += dt;
      enemy.healTimer -= dt;
      enemy.skillTimer -= dt;

      if (enemy.burnTimer > 0 && enemy.burnDps > 0) {
        this.damageEnemy(enemy, enemy.burnDps * dt, "burn", null, false);
      }

      if (enemy.type === "healer" && enemy.healTimer <= 0) {
        enemy.healTimer = 1.25;
        for (const ally of session.enemies) {
          const dist = Math.hypot(ally.x - enemy.x, ally.y - enemy.y);
          if (ally !== enemy && dist < 96) {
            ally.hp = Math.min(ally.maxHp, ally.hp + ally.maxHp * 0.05);
            this.addParticle(ally.x, ally.y, "#f4a261", 5);
          }
        }
      }

      if (enemy.type === "boss") this.updateBoss(enemy);
      if (enemy.dead) continue;

      const slow = enemy.slowTimer > 0 ? Math.max(0.25, 1 - enemy.slowPower) : 1;
      enemy.y += (enemy.rowSpeed ?? enemy.speed) * slow * dt;
      enemy.x += enemy.vx * dt;
      if (enemy.x < FIELD.x + enemy.radius || enemy.x > FIELD_RIGHT - enemy.radius) {
        enemy.vx *= -1;
        enemy.x = clamp(enemy.x, FIELD.x + enemy.radius, FIELD_RIGHT - enemy.radius);
      }

      if (enemy.y - enemy.radius > FIELD_BOTTOM) {
        this.enemyBreakthrough(enemy);
        enemy.dead = true;
      }
    }

    session.enemies = session.enemies.filter((enemy) => !enemy.dead);
  }

function updateBoss(this: any, enemy: Enemy) {
    const session = this.requireSession();
    const hpRatio = enemy.hp / enemy.maxHp;
    enemy.bossPhase = hpRatio < 0.18 ? 4 : hpRatio < 0.42 ? 3 : hpRatio < 0.72 ? 2 : 1;

    if (enemy.skillTimer > 0) return;
    enemy.skillTimer = enemy.bossPhase >= 3 ? 3.4 : 4.8;
    const waveConfig = createWave(session.wave, getStageById(session.stageId));

    if (this.nearbyReboundTargetCount(enemy) < 2) {
      this.spawnBossReboundGuards(enemy, waveConfig, 3);
    }

    if (enemy.bossPhase >= 2) {
      const addCount = enemy.bossPhase >= 4 ? 4 : 2;
      for (let i = 0; i < addCount; i += 1) {
        this.spawnEnemy(randomChoice(["small", "fast", "shield"]), waveConfig, enemy.x + randomRange(-88, 88), enemy.y + randomRange(-35, 35), 0.75);
      }
    }

    if (enemy.bossPhase >= 3) {
      enemy.y += 26;
      this.addFloatingText(enemy.x, enemy.y - 60, "核心下压", "#ff6c7e");
    }
  }

function nearbyReboundTargetCount(this: any, enemy: Enemy) {
    const session = this.requireSession();
    return session.enemies.filter((target) => {
      if (target.dead || target === enemy || target.type === "boss" || target.type === "elite") return false;
      return Math.hypot(target.x - enemy.x, target.y - enemy.y) < enemy.radius + target.radius + 190;
    }).length;
  }

function enemyBreakthrough(this: any, enemy: Enemy) {
    const session = this.requireSession();
    if (session.mode === "test") {
      this.addFloatingText(enemy.x, FIELD_BOTTOM - 24, "免疫", "#61e6a8");
      this.addParticle(enemy.x, FIELD_BOTTOM, "#61e6a8", 12);
      return;
    }

    let damage = enemy.type === "boss" ? 3 : enemy.type === "elite" ? 2 : 1;
    if (session.heat >= 5) damage += 1;
    if (session.modifiers.cardStacks.touchArmor) {
      damage = Math.max(1, damage - 1);
    }
    session.baseHp -= damage;
    this.addFloatingText(enemy.x, FIELD_BOTTOM - 24, `-${damage}`, "#ff6c7e");
    this.addParticle(enemy.x, FIELD_BOTTOM, "#ff6c7e", 18);

    if (session.baseHp <= 0 && session.modifiers.revive) {
      session.modifiers.revive = false;
      session.baseHp = 1;
      session.enemies.forEach((target) => {
        if (target.type !== "boss" && target.type !== "elite") target.dead = true;
      });
      this.addFloatingText(WIDTH / 2, HEIGHT * 0.48, "备用防线启动", "#61e6a8");
      return;
    }

    if (session.baseHp <= 0 && session.mode === "pvp" && this.finishPvpByServer) {
      this.finishPvpByServer("lose", "PVP 防线被对手突破");
      return;
    }

    if (session.baseHp <= 0) {
      this.endGame("lose", `${enemy.name}突破了底线`, "failed");
    }
  }

function updateMarbles(this: any, dt: number) {
    const session = this.requireSession();
    const trailLimit = this.marbleTrailRecordLimit?.(session) ?? 0;
    const enemyGrid = this.buildEnemyCollisionGrid?.(session.enemies);

    for (const marble of session.marbles) {
      marble.lifetime -= dt;

      if (session.modifiers.magnetic > 0) {
        const target = nearestEnemy(session.enemies, marble.x, marble.y);
        if (target) {
          const dx = target.x - marble.x;
          const dy = target.y - marble.y;
          const len = Math.hypot(dx, dy) || 1;
          const pull = 92 * dt;
          marble.vx += (dx / len) * pull;
          marble.vy += (dy / len) * pull;
          normalizeVelocity(marble, marbleConfigs[marble.marbleId].speed * session.modifiers.marbleSpeedMul);
        }
      }

      marble.x += marble.vx * dt;
      marble.y += marble.vy * dt;
      if (trailLimit > 0) {
        marble.trail.push({ x: marble.x, y: marble.y });
        while (marble.trail.length > trailLimit) marble.trail.shift();
      } else if (marble.trail.length > 0) {
        marble.trail.length = 0;
      }

      if (marble.x - marble.radius < FIELD.x) {
        marble.x = FIELD.x + marble.radius;
        marble.vx = Math.abs(marble.vx);
        marble.bounce += 1;
      }
      if (marble.x + marble.radius > FIELD_RIGHT) {
        marble.x = FIELD_RIGHT - marble.radius;
        marble.vx = -Math.abs(marble.vx);
        marble.bounce += 1;
      }
      if (marble.y - marble.radius < FIELD.y) {
        marble.y = FIELD.y + marble.radius;
        marble.vy = Math.abs(marble.vy);
        marble.bounce += 1;
      }
      if (marble.y + marble.radius > FIELD_BOTTOM) {
        marble.y = FIELD_BOTTOM - marble.radius;
        marble.vy = -Math.abs(marble.vy);
        marble.bounce += 1;
      }

      for (const [enemyId, timer] of marble.hitCooldown) {
        if (timer <= dt) marble.hitCooldown.delete(enemyId);
        else marble.hitCooldown.set(enemyId, timer - dt);
      }

      const collisionTargets = enemyGrid ? this.enemyCollisionCandidates(enemyGrid, marble) : session.enemies;
      for (const enemy of collisionTargets) {
        if (enemy.dead || marble.hitCooldown.has(enemy.id)) continue;
        const hitRange = enemy.radius + marble.radius;
        const dx = enemy.x - marble.x;
        const dy = enemy.y - marble.y;
        if (Math.abs(dx) > hitRange || Math.abs(dy) > hitRange) continue;
        const distSq = dx * dx + dy * dy;
        if (distSq <= hitRange * hitRange) {
          const dist = Math.sqrt(distSq) || 1;
          this.handleMarbleHit(marble, enemy);
          marble.hitCooldown.set(enemy.id, 0.18);
          if (marble.pierce > 0) marble.pierce -= 1;
          else {
            const normalX = (marble.x - enemy.x) / (dist || 1);
            const normalY = (marble.y - enemy.y) / (dist || 1);
            reflectVelocity(marble, normalX, normalY);
          }
        }
      }
    }

    session.marbles = session.marbles.filter((marble) => marble.lifetime > 0 && marble.bounce <= marble.maxBounce);
  }

function buildEnemyCollisionGrid(this: any, enemies: Enemy[]) {
    const cellSize = 96;
    const cols = Math.ceil(WIDTH / cellSize);
    const rows = Math.ceil(HEIGHT / cellSize);
    const cells = new Map<number, Enemy[]>();
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      const minX = clamp(Math.floor((enemy.x - enemy.radius) / cellSize), 0, cols - 1);
      const maxX = clamp(Math.floor((enemy.x + enemy.radius) / cellSize), 0, cols - 1);
      const minY = clamp(Math.floor((enemy.y - enemy.radius) / cellSize), 0, rows - 1);
      const maxY = clamp(Math.floor((enemy.y + enemy.radius) / cellSize), 0, rows - 1);
      for (let cy = minY; cy <= maxY; cy += 1) {
        for (let cx = minX; cx <= maxX; cx += 1) {
          const key = cy * cols + cx;
          const bucket = cells.get(key);
          if (bucket) bucket.push(enemy);
          else cells.set(key, [enemy]);
        }
      }
    }
    return { cellSize, cols, rows, cells };
  }

function enemyCollisionCandidates(this: any, index: any, marble: Marble) {
    const minX = clamp(Math.floor((marble.x - marble.radius) / index.cellSize), 0, index.cols - 1);
    const maxX = clamp(Math.floor((marble.x + marble.radius) / index.cellSize), 0, index.cols - 1);
    const minY = clamp(Math.floor((marble.y - marble.radius) / index.cellSize), 0, index.rows - 1);
    const maxY = clamp(Math.floor((marble.y + marble.radius) / index.cellSize), 0, index.rows - 1);
    const candidates: Enemy[] = [];
    const seen = new Set<number>();
    for (let cy = minY; cy <= maxY; cy += 1) {
      for (let cx = minX; cx <= maxX; cx += 1) {
        const bucket = index.cells.get(cy * index.cols + cx);
        if (!bucket) continue;
        for (const enemy of bucket) {
          if (seen.has(enemy.id)) continue;
          seen.add(enemy.id);
          candidates.push(enemy);
        }
      }
    }
    return candidates;
  }

function marbleTrailRecordLimit(this: any, session: Session) {
    if (this.save?.preferences?.battleEffectsEnabled === false) return 0;
    const intensity = this.save?.preferences?.cosmeticEffectIntensity || "medium";
    if (session.marbles.length > 140) return intensity === "high" ? 5 : 4;
    if (session.speed >= 3 || session.marbles.length > 72) return intensity === "high" ? 8 : intensity === "medium" ? 6 : 4;
    if (session.marbles.length > 24) return intensity === "high" ? 12 : intensity === "medium" ? 8 : 6;
    if (intensity === "high") return 18;
    if (intensity === "medium") return 12;
    return 8;
  }

function handleMarbleHit(this: any, marble: Marble, enemy: Enemy) {
    const session = this.requireSession();
    marble.hitCount += 1;
    const connectedSlowTargets = marble.marbleId === "slow" ? this.connectedEnemies(enemy) : null;
    const visual = this.marbleVisualConfig?.(marble.marbleId);
    this.damageEnemy(enemy, this.marbleDamage(marble, enemy), marble.marbleId, marble, true);
    this.sound.play("hit", 55, marbleIdSoundVariant(marble.marbleId));
    const particleBudget = session.speed === 4 || session.marbles.length > 56 ? 0.45 : session.marbles.length > 32 ? 0.68 : 1;
    this.addParticle(
      marble.x,
      marble.y,
      visual?.color || marbleConfigs[marble.marbleId].color,
      Math.max(2, Math.round((visual?.cosmetic ? 6 : 4) * particleBudget)),
    );
    if (visual?.cosmetic && particleBudget > 0.6) this.addParticle(marble.x, marble.y, visual.accentColor || visual.color, 2);
    if (visual?.cosmetic && !enemy.dead) this.addMarbleCosmeticEffect?.(marble, enemy.x, enemy.y, "hit", enemy);

    if (marble.marbleId === "split" && marble.hitCount >= 3 && !marble.splitDone) {
      marble.splitDone = true;
      const owner = session.characters.find((char) => char.id === marble.ownerId) || session.characters[0];
      const baseAngle = Math.atan2(marble.vy, marble.vx);
      this.fireMarble(owner, "split", baseAngle - Math.atan2(-1, 0) - 0.55, true);
      this.fireMarble(owner, "split", baseAngle - Math.atan2(-1, 0) + 0.55, true);
    }

    if (marble.marbleId === "blast") {
      const blastRoute = marble.ownerId === "bomber" ? this.characterRouteLevel("bomber", "bomber_blast") : 0;
      const reactorRoute =
        marble.ownerId === "alchemist" ? this.characterRouteLevel("alchemist", "alchemist_reactor") : 0;
      const voidRoute =
        marble.ownerId === "voidbinder" ? this.characterRouteLevel("voidbinder", "voidbinder_blast") : 0;
      const passiveRadius =
        (marble.ownerId === "bomber" && this.passiveUnlocked(marble.ownerId, "bomber_chain") ? 0.12 : 0) +
        (marble.ownerId === "alchemist" && this.passiveUnlocked(marble.ownerId, "alchemist_core") ? 0.1 : 0) +
        (marble.ownerId === "voidbinder" && this.passiveUnlocked(marble.ownerId, "voidbinder_gravity") ? 0.08 : 0);
      this.explode(
        marble.x,
        marble.y,
        62 * session.modifiers.blastRadiusMul * (1 + passiveRadius + blastRoute * 0.03 + reactorRoute * 0.02 + voidRoute * 0.03),
        marble.damage * 0.64,
        marble,
      );
    }

    if (marble.marbleId === "burn") {
      const burnRoute = marble.ownerId === "bomber" ? this.characterRouteLevel("bomber", "bomber_burn") : 0;
      const alchemyBurn =
        marble.ownerId === "alchemist" ? this.characterRouteLevel("alchemist", "alchemist_burn") : 0;
      const treasureBurn =
        marble.ownerId === "treasurer" ? this.characterRouteLevel("treasurer", "treasurer_burn") : 0;
      const passiveBurn =
        (marble.ownerId === "bomber" && this.passiveUnlocked(marble.ownerId, "bomber_afterburn") ? 0.15 : 0) +
        (marble.ownerId === "alchemist" && this.passiveUnlocked(marble.ownerId, "alchemist_core") ? 0.1 : 0);
      enemy.burnTimer = Math.max(enemy.burnTimer, (3.2 + burnRoute * 0.08 + alchemyBurn * 0.08 + treasureBurn * 0.08) * (1 + passiveBurn));
      enemy.burnDps = Math.max(
        enemy.burnDps,
        4.2 * session.modifiers.burnMul * (1 + passiveBurn + burnRoute * 0.06 + alchemyBurn * 0.05 + treasureBurn * 0.04),
      );
    }

    if (marble.marbleId === "lightning") {
      const chainRoute = marble.ownerId === "magnetist" ? this.characterRouteLevel("magnetist", "magnetist_chain") : 0;
      const prismRoute = marble.ownerId === "prism" ? this.characterRouteLevel("prism", "prism_chain") : 0;
      const frostRoute = marble.ownerId === "frostseer" ? this.characterRouteLevel("frostseer", "frostseer_chain") : 0;
      const passiveChain =
        (marble.ownerId === "magnetist" && this.passiveUnlocked(marble.ownerId, "magnetist_conductor") ? 1 : 0) +
        (marble.ownerId === "prism" && this.passiveUnlocked(marble.ownerId, "prism_afterglow") ? 1 : 0);
      this.lightning(
        enemy,
        3 + session.modifiers.chainBonus + passiveChain + Math.floor(chainRoute / 3) + Math.floor(prismRoute / 3) + Math.floor(frostRoute / 3),
        marble.damage * 0.72,
        marble,
      );
    }

    if (marble.marbleId === "slow") {
      const controlRoute =
        marble.ownerId === "magnetist" ? this.characterRouteLevel("magnetist", "magnetist_control") : 0;
      const suppressRoute =
        marble.ownerId === "sentinel" ? this.characterRouteLevel("sentinel", "sentinel_suppress") : 0;
      const frostRoute = marble.ownerId === "frostseer" ? this.characterRouteLevel("frostseer", "frostseer_slow") : 0;
      const passiveSlowDuration =
        (marble.ownerId === "magnetist" && this.passiveUnlocked(marble.ownerId, "magnetist_conductor") ? 0.25 : 0) +
        (marble.ownerId === "frostseer" && this.passiveUnlocked(marble.ownerId, "frostseer_spread") ? 0.35 : 0);
      const passiveSlowPower = marble.ownerId === "frostseer" && this.passiveUnlocked(marble.ownerId, "frostseer_spread") ? 0.04 : 0;
      this.applySlowToTargets(
        connectedSlowTargets?.length ? connectedSlowTargets : this.connectedEnemies(enemy),
        2.1 + passiveSlowDuration + controlRoute * 0.08 + suppressRoute * 0.08 + frostRoute * 0.1,
        0.25 + passiveSlowPower + session.modifiers.slowBonus + controlRoute * 0.025 + suppressRoute * 0.02 + frostRoute * 0.02,
      );
    }
  }

function applyConnectedSlow(this: any, origin: Enemy, duration: number, power: number) {
    return this.applySlowToTargets(this.connectedEnemies(origin), duration, power);
  }

function applySlowToTargets(this: any, targets: Enemy[], duration: number, power: number) {
    for (const enemy of targets) {
      if (enemy.dead) continue;
      enemy.slowTimer = Math.max(enemy.slowTimer, duration);
      enemy.slowPower = Math.max(enemy.slowPower, power);
    }
    return targets;
  }

function connectedEnemies(this: any, origin: Enemy) {
    const session = this.requireSession();
    const connected: Enemy[] = [];
    const visited = new Set<number>();
    const queue: Enemy[] = [origin];
    visited.add(origin.id);

    while (queue.length > 0) {
      const current = queue.shift() as Enemy;
      if (current.dead) continue;
      connected.push(current);

      for (const candidate of session.enemies) {
        if (candidate.dead || visited.has(candidate.id)) continue;
        if (!this.areEnemiesConnected(current, candidate)) continue;
        visited.add(candidate.id);
        queue.push(candidate);
      }
    }

    return connected;
  }

function areEnemiesConnected(this: any, a: Enemy, b: Enemy) {
    const gap = Math.hypot(a.x - b.x, a.y - b.y) - a.radius - b.radius;
    return gap <= 8;
  }

function marbleDamage(this: any, marble: Marble, enemy: Enemy) {
    const session = this.requireSession();
    const config = marbleConfigs[marble.marbleId];
    let damage = marble.damage * session.modifiers.damageMul;
    damage *= 1 + (session.modifiers.marbleDamage[marble.marbleId] || 0);

    for (const tag of config.tags) {
      damage *= 1 + (session.modifiers.tagDamage[tag] || 0);
    }

    if (session.modifiers.cardStacks.swarm) {
      damage *= 1 + Math.min(0.3, Math.floor(session.marbles.length / 12) * 0.05);
    }

    if (session.modifiers.cardStacks.goldDamage) {
      damage *= 1 + Math.min(0.28, Math.floor(session.coins / 80) * 0.01);
    }

    if (session.modifiers.bounceDamage) {
      const bounceBonus = Math.min(12, marble.bounce) * session.modifiers.bounceDamage;
      const engineerActive = session.characters.find((char) => char.id === "engineer")?.skillActive ?? 0;
      damage *= 1 + bounceBonus * (engineerActive > 0 ? 2 : 1);
    }

    if (session.modifiers.cardStacks.bossDamage && (enemy.type === "boss" || enemy.type === "elite")) {
      damage *= 1 + session.modifiers.cardStacks.bossDamage * 0.32;
    }

    if (session.modifiers.cardStacks.lastLine) {
      const pressure = clamp((enemy.y - FIELD.y) / FIELD.h, 0, 1);
      damage *= 1 + pressure * 0.25;
    }

    if (session.modifiers.cardStacks.slowVulnerable && enemy.slowTimer > 0) {
      damage *= 1.14;
    }

    if (marble.marbleId === "lightning" && session.modifiers.cardStacks.slowShock && enemy.slowTimer > 0) {
      damage *= 1.35;
    }

    if (marble.ownerId === "frostseer" && this.passiveUnlocked(marble.ownerId, "frostseer_weakness") && enemy.slowTimer > 0) {
      damage *= 1.1;
    }

    if (Math.random() < session.modifiers.critChance) {
      damage *= session.modifiers.critDamage;
      this.addFloatingText(enemy.x, enemy.y - enemy.radius, "暴击", "#f6c95f");
    }

    return damage;
  }

function damageEnemy(this: any, enemy: Enemy, amount: number, source: string, marble: Marble | null, showNumber: boolean) {
    const session = this.requireSession();
    if (enemy.dead) return;

    const shielded = enemy.type === "shield" && Math.sin(enemy.shieldTimer * 3.4) > 0.2;
    const shieldMul = shielded ? 0.55 : 1;
    const finalDamage = Math.max(1, amount * shieldMul - enemy.armor);
    enemy.hp -= finalDamage;

    if (showNumber && Math.random() < 0.46) {
      this.addFloatingText(enemy.x + randomRange(-12, 12), enemy.y - enemy.radius, String(Math.floor(finalDamage)), "#eaf2ff");
    }

    if (enemy.hp <= 0) {
      this.killEnemy(enemy, source, marble);
    }
  }

function killEnemy(this: any, enemy: Enemy, source: string, marble: Marble | null) {
    const session = this.requireSession();
    if (enemy.dead) return;
    enemy.dead = true;
    session.kills += 1;
    this.addPvpPressureForKill?.(enemy);
    session.xp += enemy.exp * session.modifiers.expMul;
    if (session.mode !== "test") session.coins += enemy.coins * session.modifiers.coinMul;
    if (session.mode !== "test" && enemy.burnTimer > 0 && session.characters.some((character) => character.id === "alchemist" && this.passiveUnlocked(character.id, "alchemist_salvage"))) {
      session.coins += 1 * session.modifiers.coinMul;
    }
    this.addMarbleCosmeticEffect?.(marble, enemy.x, enemy.y, "defeat", enemy);
    this.addParticle(enemy.x, enemy.y, enemyConfigs[enemy.type].color, enemy.type === "boss" ? 44 : 14);
    this.sound.play(enemy.type === "elite" || enemy.type === "boss" ? "eliteKill" : "kill", enemy.type === "boss" ? 0 : 80);
    this.rollEnemyDrops(enemy);

    if (enemy.type === "splitter") {
      const waveConfig = createWave(session.wave, getStageById(session.stageId));
      this.spawnEnemy("small", waveConfig, enemy.x - 18, enemy.y, 0.55);
      this.spawnEnemy("small", waveConfig, enemy.x + 18, enemy.y, 0.55);
    }

    if (session.modifiers.cardStacks.burnSpread && enemy.burnTimer > 0) {
      for (const target of session.enemies) {
        const dist = Math.hypot(target.x - enemy.x, target.y - enemy.y);
        if (!target.dead && target !== enemy && dist < 112) {
          target.burnTimer = Math.max(target.burnTimer, 2.5);
          target.burnDps = Math.max(target.burnDps, 4.2 * session.modifiers.burnMul);
        }
      }
    }

    if (session.modifiers.cardStacks.chainBlast && source === "blast" && marble) {
      this.explode(enemy.x, enemy.y, 42 * session.modifiers.blastRadiusMul, marble.damage * 0.45, marble);
    }
  }

function rollEnemyDrops(this: any, enemy: Enemy) {
    const session = this.requireSession();
    if (session.mode === "test") return;
    const baseChance: Record<EnemyType, number> = {
      small: 0.035,
      tank: 0.06,
      fast: 0.04,
      splitter: 0.065,
      shield: 0.075,
      healer: 0.075,
      gold: 0.12,
      elite: 1,
      boss: 1,
    };
    const rolls = enemy.type === "boss" ? 5 : enemy.type === "elite" ? 3 : 1;
    const chance = Math.min(1, baseChance[enemy.type] * (1 + session.modifiers.dropLuck + session.continueBonus));

    for (let i = 0; i < rolls; i += 1) {
      if (Math.random() > chance) continue;
      const drop = this.createDrop(enemy);
      session.drops.push(drop);
      this.ensureAutoInsuredDrops();
      this.addDropVisual(enemy.x + randomRange(-20, 20), enemy.y - enemy.radius - 12 - i * 18, drop, i);
      this.addDropText(enemy.x + randomRange(-18, 18), enemy.y - enemy.radius - 14 - i * 14, drop);
      this.sound.play("drop", 90);
    }
  }

function addDropVisual(this: any, x: number, y: number, drop: DropEntry, offset = 0) {
    const session = this.requireSession();
    const clampedX = clamp(x, FIELD.x + 38, FIELD_RIGHT - 38);
    const clampedY = clamp(y, FIELD.y + 62, FIELD_BOTTOM - 118);
    session.dropVisuals.push({
      id: session.entities++,
      drop,
      x: clampedX,
      y: clampedY,
      startX: clampedX,
      startY: clampedY,
      targetX: LOOT_BAG_TARGET.x,
      targetY: LOOT_BAG_TARGET.y,
      age: 0,
      hold: 1.65 + offset * 0.18,
      fly: 0.75,
      seed: randomRange(0, Math.PI * 2),
      collected: false,
    });
  }

function createDrop(this: any, enemy: Enemy): DropEntry {
    const rarity = boostDropRarityForContinue(rollDropRarity(enemy.type, this.session?.wave || 1), this.session?.continueBonus || 0);
    const rewardBias = this.session ? getStageById(this.session.stageId).rewardBias : undefined;
    const gemWeight = enemy.type === "boss" ? 0.36 : enemy.type === "elite" ? 0.26 : 0.13;
    const shardWeight = enemy.type === "gold" ? 0.52 : 0.42;
    const roll = Math.random();

    if (roll < gemWeight) {
      return {
        type: "gem",
        gemType: randomChoice(rewardBias?.gems?.length ? rewardBias.gems : (Object.keys(gemConfigs) as GemType[])),
        level: dropGemLevel(rarity, enemy.type),
        amount: 1,
        rarity,
      };
    }

    if (roll < gemWeight + shardWeight) {
      const marbleId = randomChoice(rewardBias?.shards?.length ? rewardBias.shards : (Object.keys(marbleConfigs) as MarbleId[]));
      const amount = dropShardAmount(rarity, enemy.type);
      return {
        type: "marbleShard",
        marbleId,
        amount,
        rarity,
      };
    }

    return {
      type: "collectible",
      id: rewardBias?.collectibles?.length && Math.random() < 0.7 ? randomChoice(rewardBias.collectibles) : collectibleForRarity(rarity),
      amount: 1,
      rarity,
    };
  }

function addDropText(this: any, x: number, y: number, drop: DropEntry) {
    if (drop.type === "collectible") {
      this.addFloatingText(x, y, `+${collectibleConfigs[drop.id].name}`, rarityColor(drop.rarity));
      return;
    }

    if (drop.type === "marbleShard") {
      this.addFloatingText(x, y, `+${marbleConfigs[drop.marbleId].name}碎片×${drop.amount}`, rarityColor(drop.rarity));
      return;
    }

    this.addFloatingText(x, y, `+${gemConfigs[drop.gemType].name} Lv.${drop.level}`, rarityColor(drop.rarity));
  }

function explode(this: any, x: number, y: number, radius: number, damage: number, marble: Marble) {
    const session = this.requireSession();
    this.addParticle(x, y, "#f6c95f", session.speed >= 3 ? 4 : 8);
    const maxDist = radius + 44;
    const maxDistSq = maxDist * maxDist;
    for (const enemy of session.enemies) {
      if (enemy.dead) continue;
      const dx = enemy.x - x;
      const dy = enemy.y - y;
      if (dx * dx + dy * dy > maxDistSq) continue;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < radius + enemy.radius) {
        const falloff = 1 - Math.min(0.65, dist / (radius + enemy.radius) * 0.55);
        this.damageEnemy(enemy, damage * falloff * session.modifiers.damageMul, "blast", marble, false);
      }
    }
  }

function lightning(this: any, first: Enemy, jumps: number, damage: number, marble: Marble) {
    const session = this.requireSession();
    const visited = new Set<number>([first.id]);
    let current = first;
    let currentDamage = damage;

    for (let i = 0; i < jumps; i += 1) {
      let next: Enemy | null = null;
      let nextDistSq = 180 * 180;
      for (const enemy of session.enemies) {
        if (enemy.dead || visited.has(enemy.id)) continue;
        const dx = enemy.x - current.x;
        const dy = enemy.y - current.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < nextDistSq) {
          next = enemy;
          nextDistSq = distSq;
        }
      }

      if (!next) break;
      visited.add(next.id);
      this.addLineParticle(current.x, current.y, next.x, next.y, "#b68cff");
      this.damageEnemy(next, currentDamage, "lightning", marble, false);
      current = next;
      currentDamage *= 0.78;
    }
  }

function updateParticles(this: any, dt: number) {
    const session = this.requireSession();
    for (const particle of session.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 18 * dt;
    }
    session.particles = session.particles.filter((particle) => particle.life > 0);
  }

function updateEffects(this: any, dt: number) {
    const session = this.requireSession();
    for (const effect of session.effects) {
      effect.life -= dt;
    }
    session.effects = session.effects.filter((effect) => effect.life > 0);
  }

function updateDropVisuals(this: any, realDt: number) {
    const session = this.requireSession();
    for (const visual of session.dropVisuals) {
      visual.age += realDt;

      if (visual.age <= visual.hold) {
        visual.x = visual.startX + Math.sin(session.elapsed * 4 + visual.seed) * 4;
        visual.y = visual.startY + Math.cos(session.elapsed * 3.2 + visual.seed) * 5;
        continue;
      }

      const flyT = clamp((visual.age - visual.hold) / visual.fly, 0, 1);
      const eased = easeInOutCubic(flyT);
      visual.x = lerp(visual.startX, visual.targetX, eased);
      visual.y = lerp(visual.startY, visual.targetY, eased) - Math.sin(flyT * Math.PI) * 78;

      if (flyT >= 1 && !visual.collected) {
        visual.collected = true;
        this.pulseLootBag();
      }
    }

    session.dropVisuals = session.dropVisuals.filter((visual) => visual.age < visual.hold + visual.fly);
  }

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

export const gameBattleCombatMethods = {
  spawnEnemy,
  updateCharacters,
  characterHaste,
  fireMarble,
  pickTarget,
  updateEnemies,
  updateBoss,
  nearbyReboundTargetCount,
  enemyBreakthrough,
  updateMarbles,
  buildEnemyCollisionGrid,
  enemyCollisionCandidates,
  marbleTrailRecordLimit,
  handleMarbleHit,
  applyConnectedSlow,
  applySlowToTargets,
  connectedEnemies,
  areEnemiesConnected,
  marbleDamage,
  damageEnemy,
  killEnemy,
  rollEnemyDrops,
  addDropVisual,
  createDrop,
  addDropText,
  explode,
  lightning,
  updateParticles,
  updateEffects,
  updateDropVisuals,
} satisfies Record<string, GameMethod>;
