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

function updateAutoBattle(this: any) {
    const session = this.session;
    if (!session || (!this.autoBattleEnabled && session.mode !== "pvp") || !this.autoSkillEnabled || this.phase !== "playing") return;
    if (session.enemies.length === 0) return;

    for (const character of session.characters) {
      if (character.skillTimer <= 0) this.castSkill(character.id);
    }
  }

function updateAutoUi(this: any) {
    this.autoToggle.checked = this.autoBattleEnabled;
    const autoRow = this.autoToggle.closest<HTMLElement>(".battle-check-row");
    autoRow?.classList.toggle("active", this.autoBattleEnabled);

    const skillText = byId("autoSkillText");
    skillText.textContent = this.autoSkillEnabled ? "ON" : "OFF";

    for (const button of this.autoPanel.querySelectorAll<HTMLElement>("[data-auto-mode]")) {
      button.classList.toggle("active", button.dataset.autoMode === this.autoUpgradeMode);
    }

    for (const button of this.autoPanel.querySelectorAll<HTMLElement>("[data-auto-extraction]")) {
      button.classList.toggle("active", button.dataset.autoExtraction === this.autoExtractionMode);
    }

    for (const button of this.autoPanel.querySelectorAll<HTMLElement>("[data-auto-run]")) {
      button.classList.toggle("active", button.dataset.autoRun === this.autoRunMode);
    }
  }

function createSkillMarble(this: any, ownerId: string, marbleId: MarbleId, x: number, y: number, damage: number): Marble {
    return {
      id: -1,
      marbleId,
      ownerId,
      x,
      y,
      vx: 0,
      vy: 0,
      radius: 1,
      damage,
      lifetime: 0,
      bounce: 0,
      maxBounce: 0,
      hitCount: 0,
      pierce: 0,
      splitDone: true,
      hitCooldown: new Map(),
      trail: [],
      small: false,
    };
  }

function castSkill(this: any, id: string) {
    const session = this.session;
    if (!session || this.phase !== "playing") return;
    const character = session.characters.find((char) => char.id === id);
    if (!character || character.skillTimer > 0) return;
    const skillBonus = this.characterSkillBonus(id);
    const visual = this.characterVisualConfig?.(id);
    const visualColor = visual?.color || character.color;
    const visualAccent = visual?.accentColor || visualColor;
    const blastColor = visual?.cosmetic ? visualAccent : "#f6c95f";

    character.skillTimer = this.skillCooldownFor(character);
    this.sound.play("skill", 120);

    if (id === "engineer") {
      const fieldLevel = this.characterRouteLevel("engineer", "engineer_field");
      const duration = 6 + fieldLevel * 0.4 + skillBonus * 0.35;
      character.skillActive = duration;
      this.addEffect("engineer-field", character.x, character.y, duration, 72, 270, visualColor);
      this.addBurst(character.x, character.y, visualAccent, 28, 95, 0.55);
      this.addFloatingText(character.x, character.y - 40, "折返板", visualAccent);
    }

    if (id === "bomber") {
      const blastLevel = this.characterRouteLevel("bomber", "bomber_blast");
      const center = densestPoint(session.enemies) || { x: WIDTH / 2, y: FIELD.y + FIELD.h * 0.38 };
      const skillScale = 1 + skillBonus * 0.035;
      this.addEffect(
        "blast-wave",
        center.x,
        center.y,
        0.75,
        32,
        235 * session.modifiers.blastRadiusMul * (1 + blastLevel * 0.03) * skillScale,
        blastColor,
      );
      this.addBurst(center.x, center.y, blastColor, 48, 230, 0.82);
      this.explode(center.x, center.y, 146 * session.modifiers.blastRadiusMul * (1 + blastLevel * 0.03) * skillScale, 110 * (1 + blastLevel * 0.05) * skillScale, {
        id: -1,
        marbleId: "blast",
        ownerId: id,
        x: center.x,
        y: center.y,
        vx: 0,
        vy: 0,
        radius: 1,
        damage: 110,
        lifetime: 0,
        bounce: 0,
        maxBounce: 0,
        hitCount: 0,
        pierce: 0,
        splitDone: true,
        hitCooldown: new Map(),
        trail: [],
        small: false,
      });
      this.addFloatingText(center.x, center.y - 70, "高爆弹", visualAccent);
    }

    if (id === "magnetist") {
      const bonus = (session.modifiers.cardStacks.magnetLong || 0) * 3;
      const focusLevel = this.characterRouteLevel("magnetist", "magnetist_focus");
      const duration = 7 + bonus + focusLevel * 0.45 + skillBonus * 0.35 + (this.passiveUnlocked(id, "magnetist_resonance") ? 1.2 : 0);
      session.modifiers.magnetic = duration;
      character.skillActive = duration;
      this.addEffect("magnet-field", character.x, character.y - 245, duration, 120, 360, visualColor);
      this.addBurst(character.x, character.y, visualAccent, 34, 130, 0.7);
      this.addFloatingText(character.x, character.y - 40, "磁场展开", visualAccent);
    }

    if (id === "sentinel") {
      const barrierLevel = this.characterRouteLevel("sentinel", "sentinel_barrier");
      const suppressLevel = this.characterRouteLevel("sentinel", "sentinel_suppress");
      const heal = 1 + Math.floor(barrierLevel / 3) + Math.floor(skillBonus / 4);
      session.baseHp = Math.min(session.maxBaseHp, session.baseHp + heal);
      character.skillActive = 4;
      const slowed = new Set<number>();
      for (const enemy of session.enemies) {
        const pressure = clamp((enemy.y - FIELD.y) / FIELD.h, 0, 1);
        if (!enemy.dead && pressure > 0.35 && !slowed.has(enemy.id)) {
          for (const target of this.applyConnectedSlow(enemy, 2.8 + skillBonus * 0.08 + suppressLevel * 0.1, 0.42 + skillBonus * 0.01 + suppressLevel * 0.02)) {
            slowed.add(target.id);
          }
        }
      }
      this.addEffect("engineer-field", WIDTH / 2, FIELD_BOTTOM - 80, 1.2, 140, 360, visualColor);
      this.addBurst(character.x, character.y, visualAccent, 38, 160, 0.72);
      this.addFloatingText(character.x, character.y - 42, `修复 +${heal}`, visualAccent);
    }

    if (id === "prism") {
      const burstLevel = this.characterRouteLevel("prism", "prism_burst");
      const shots = 4 + Math.floor(burstLevel / 2) + Math.floor(skillBonus / 3);
      character.skillActive = 3.2 + skillBonus * 0.1;
      for (let i = 0; i < shots; i += 1) {
        const offset = (i - (shots - 1) / 2) * 0.24;
        this.fireMarble(character, i % 2 === 0 ? "lightning" : "split", offset);
      }
      this.addEffect("magnet-field", character.x, character.y - 180, 1.1, 80, 250, visualColor);
      this.addBurst(character.x, character.y, visualAccent, 42, 180, 0.62);
      this.addFloatingText(character.x, character.y - 42, "棱镜齐射", visualAccent);
    }

    if (id === "alchemist") {
      const burnLevel = this.characterRouteLevel("alchemist", "alchemist_burn");
      const goldLevel = this.characterRouteLevel("alchemist", "alchemist_gold");
      const reactorLevel = this.characterRouteLevel("alchemist", "alchemist_reactor");
      const center = densestPoint(session.enemies) || { x: WIDTH / 2, y: FIELD.y + FIELD.h * 0.42 };
      const radius = 132 + skillBonus * 4 + reactorLevel * 8;
      let affected = 0;
      for (const enemy of session.enemies) {
        const dist = Math.hypot(enemy.x - center.x, enemy.y - center.y);
        if (!enemy.dead && dist < radius + enemy.radius) {
          affected += 1;
          enemy.burnTimer = Math.max(enemy.burnTimer, 4 + burnLevel * 0.12);
          enemy.burnDps = Math.max(enemy.burnDps, 5.2 * session.modifiers.burnMul * (1 + skillBonus * 0.04 + burnLevel * 0.05));
        }
      }
      const bonusCoins = affected > 0 ? Math.min(32, affected * (1 + goldLevel) + skillBonus) : 0;
      session.coins += bonusCoins;
      character.skillActive = 3;
      this.addEffect("blast-wave", center.x, center.y, 0.85, 32, radius * 1.55, visualColor);
      this.addBurst(center.x, center.y, visualAccent, 44, radius, 0.78);
      this.explode(center.x, center.y, radius, 78 * (1 + skillBonus * 0.05 + reactorLevel * 0.05), {
        id: -2,
        marbleId: "blast",
        ownerId: id,
        x: center.x,
        y: center.y,
        vx: 0,
        vy: 0,
        radius: 1,
        damage: 78,
        lifetime: 0,
        bounce: 0,
        maxBounce: 0,
        hitCount: 0,
        pierce: 0,
        splitDone: true,
        hitCooldown: new Map(),
        trail: [],
        small: false,
      });
      this.addFloatingText(center.x, center.y - 66, bonusCoins ? `热核 +${bonusCoins}` : "热核反应", visualAccent);
    }

    if (id === "frostseer") {
      const slowLevel = this.characterRouteLevel("frostseer", "frostseer_slow");
      const stasisLevel = this.characterRouteLevel("frostseer", "frostseer_stasis");
      const center = densestPoint(session.enemies) || { x: WIDTH / 2, y: FIELD.y + FIELD.h * 0.42 };
      const radius = 142 + skillBonus * 4 + stasisLevel * 8;
      let affected = 0;
      const slowed = new Set<number>();
      for (const enemy of session.enemies) {
        const dist = Math.hypot(enemy.x - center.x, enemy.y - center.y);
        if (!enemy.dead && dist < radius + enemy.radius) {
          affected += 1;
          if (!slowed.has(enemy.id)) {
            for (const target of this.applyConnectedSlow(enemy, 3 + skillBonus * 0.08 + stasisLevel * 0.18, 0.62 + skillBonus * 0.01 + slowLevel * 0.02)) {
              slowed.add(target.id);
            }
          }
          this.damageEnemy(enemy, 34 * (1 + skillBonus * 0.06 + slowLevel * 0.05), "slow", this.createSkillMarble(id, "slow", center.x, center.y, 34), false);
        }
      }
      character.skillActive = 3.2 + skillBonus * 0.08 + stasisLevel * 0.18;
      this.addEffect("magnet-field", center.x, center.y, 1.2, 70, radius * 1.7, visualColor);
      this.addBurst(center.x, center.y, visualAccent, 42, radius, 0.68);
      this.addFloatingText(center.x, center.y - 66, affected ? `冰环 ×${affected}` : "冰环静滞", visualAccent);
    }

    if (id === "voidbinder") {
      const blastLevel = this.characterRouteLevel("voidbinder", "voidbinder_blast");
      const coreLevel = this.characterRouteLevel("voidbinder", "voidbinder_core");
      const center = densestPoint(session.enemies) || { x: WIDTH / 2, y: FIELD.y + FIELD.h * 0.38 };
      const radius = 154 * (1 + skillBonus * 0.025 + blastLevel * 0.03);
      let affected = 0;
      const slowed = new Set<number>();
      for (const enemy of session.enemies) {
        const dist = Math.hypot(enemy.x - center.x, enemy.y - center.y);
        if (!enemy.dead && dist < radius + enemy.radius) {
          affected += 1;
          enemy.x = lerp(enemy.x, center.x, 0.34);
          enemy.y = lerp(enemy.y, center.y, 0.28);
          if (!slowed.has(enemy.id)) {
            for (const target of this.applyConnectedSlow(enemy, 1.6 + coreLevel * 0.08, 0.34)) {
              slowed.add(target.id);
            }
          }
        }
      }
      character.skillActive = 3;
      this.addEffect("magnet-field", center.x, center.y, 1.25, 56, radius * 1.8, visualColor);
      this.addBurst(center.x, center.y, visualAccent, 50, radius, 0.82);
      this.explode(center.x, center.y, radius, 86 * (1 + skillBonus * 0.06 + coreLevel * 0.05), this.createSkillMarble(id, "blast", center.x, center.y, 86));
      this.addFloatingText(center.x, center.y - 70, affected ? `坍缩 ×${affected}` : "虚空坍缩", visualAccent);
    }

    if (id === "treasurer") {
      const luckLevel = this.characterRouteLevel("treasurer", "treasurer_luck");
      const basicLevel = this.characterRouteLevel("treasurer", "treasurer_basic");
      const shots = 5 + Math.floor(skillBonus / 4) + Math.floor(basicLevel / 2);
      const bonusCoins = 8 + skillBonus + luckLevel * 2 + (this.passiveUnlocked(id, "treasurer_circuit") ? 6 : 0);
      session.coins += bonusCoins;
      character.skillActive = 2.8;
      for (let i = 0; i < shots; i += 1) {
        const offset = (i - (shots - 1) / 2) * 0.18;
        this.fireMarble(character, i % 3 === 0 ? "burn" : "basic", offset);
      }
      this.addEffect("engineer-field", character.x, character.y - 64, 0.85, 48, 150, visualColor);
      this.addBurst(character.x, character.y, visualAccent, 36, 130, 0.58);
      this.addFloatingText(character.x, character.y - 44, `点金 +${bonusCoins}`, visualAccent);
    }
  }

function skillCooldownFor(this: any, character: CharacterRuntime) {
    const session = this.session;
    const gemModifiers = this.baseGemModifiers();
    let cooldown =
      character.skillCooldown *
      clamp(1 - upgradeLevel(this.save.upgrades, "skillHaste") * 0.02 - gemModifiers.skillHaste, 0.55, 1.3) *
      this.characterBattleStats(character).skillCooldownMul;

    if (session && character.id === "bomber") {
      cooldown *= Math.pow(0.75, session.modifiers.cardStacks.bomberHaste || 0);
    }

    return Math.max(4, cooldown);
  }

function handleCanvasPointer(this: any, event: PointerEvent) {
    const session = this.session;
    if (!session || this.phase !== "playing") return;

    const rect = this.canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;
    if (this.handlePvpCanvasPointer?.(x, y)) return;
    const target = session.characters.find((character) => Math.abs(character.x - x) <= 58 && Math.abs(character.y - y) <= 58);
    if (!target) return;

    this.castSkill(target.id);
  }

function openUpgrade(this: any) {
    const session = this.requireSession();
    session.level += 1;
    session.xp -= session.xpNeed;
    session.xpNeed = xpNeedForLevel(session.level);

    if (session.mode === "pvp") {
      const choices = this.generateChoices();
      this.applyPvpAutoUpgradeChoices(choices);
      return;
    }

    session.pendingChoices = this.generateChoices();
    this.phase = "upgrade";
    session.phase = "upgrade";
    this.sound.play("levelUp");
    this.renderUpgradeScreen();

    if (this.autoBattleEnabled || session.mode === "pvp") {
      this.autoPickUpgrade();
    }
  }

function renderUpgradeScreen(this: any) {
    const session = this.requireSession();
    const state = ensureTacticalState(session);
    const nextAttributeText =
      state.nextAttributeMultiplierUses > 0 && state.nextAttributeMultiplier > 1
        ? `下次属性卡 ×${state.nextAttributeMultiplier}`
        : "功能卡可改变后续抽卡";
    const rarityBoostUses = state.rarityBoosts.reduce((sum, boost) => sum + boost.uses, 0);
    const rarityBoostText = rarityBoostUses > 0 ? `高级概率提升 ${rarityBoostUses} 次` : "常规概率";
    this.upgradeScreen.classList.remove("hidden");
    this.upgradeScreen.classList.add("choice-layout");
    this.upgradeScreen.innerHTML = `
      <div class="panel main-panel">
        <p class="eyebrow">等级 ${session.level}</p>
        <h2>选择一次战术升级</h2>
        <p class="subcopy">战斗已暂停，选择后继续当前波次。</p>
        <div class="choice-tools">
          <span class="choice-tool-copy">
            <strong>${nextAttributeText}</strong>
            <span>${rarityBoostText}</span>
          </span>
          <button class="choice-refresh-button" type="button" data-upgrade-refresh ${state.refreshCharges <= 0 ? "disabled" : ""}>
            刷新 ${state.refreshCharges}/${state.refreshChargesMax}
          </button>
        </div>
        <div class="choice-grid">
          ${session.pendingChoices.map((card, index) => upgradeCardHtml(card, index)).join("")}
        </div>
      </div>
    `;
  }

function refreshUpgradeChoices(this: any, fromAuto = false) {
    const session = this.requireSession();
    if (this.phase !== "upgrade" || session.phase !== "upgrade") return false;
    const state = ensureTacticalState(session);
    if (state.refreshCharges <= 0) return false;

    state.refreshCharges = Math.max(0, state.refreshCharges - 1);
    session.pendingChoices = this.generateChoices();
    this.renderUpgradeScreen();
    if (!fromAuto && this.autoBattleEnabled) this.autoPickUpgrade();
    return true;
  }

function generateChoices(this: any, options: { consumeBoost?: boolean } = {}) {
    const session = this.requireSession();
    ensureTacticalState(session);
    const lucky = upgradeLevel(this.save.upgrades, "luckyCards");
    const rarityBoost = combinedRarityBoost(session);
    const available = upgradeCards.filter((card) => isUpgradeCardAvailable(card, session));

    const choices: UpgradeCard[] = [];
    while (choices.length < 3 && choices.length < available.length) {
      const rarity = rollRarity(session.wave, lucky, rarityBoost);
      const pool = available.filter((card) => card.rarity === rarity && !choices.includes(card));
      const fallback = available.filter((card) => !choices.includes(card));
      const choicePool = pool.length ? pool : fallback;
      if (choicePool.length === 0) break;
      choices.push(this.weightedUpgradeChoice(choicePool));
    }
    if (options.consumeBoost !== false) consumeRarityBoostUse(session);
    return choices;
  }

function weightedUpgradeChoice(this: any, cards: UpgradeCard[]) {
    const session = this.requireSession();
    const weights = cards.map((card) => tacticalCardWeight(card, session));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (total <= 0) return randomChoice(cards);

    let roll = Math.random() * total;
    for (let index = 0; index < cards.length; index += 1) {
      roll -= weights[index];
      if (roll <= 0) return cards[index];
    }
    return cards[cards.length - 1];
  }

function pickUpgrade(this: any, index: number) {
    const session = this.requireSession();
    const card = session.pendingChoices[index];
    if (!card) return;

    const appliedMultiplier = this.applyUpgradeCard(card);
    session.modifiers.cardStacks[card.id] = (session.modifiers.cardStacks[card.id] || 0) + 1;
    session.selectedUpgradeIds.push(card.id);
    this.notePvpAutoUpgrade?.(card);
    session.pendingChoices = [];
    this.phase = "playing";
    session.phase = "playing";
    this.upgradeScreen.classList.add("hidden");
    this.updateTacticPanel();
    this.addFloatingText(WIDTH / 2, FIELD.y + 42, `${card.name}${appliedMultiplier > 1 ? ` ×${appliedMultiplier}` : ""}`, rarityColor(card.rarity));
    this.sound.play("upgrade");
  }

function applyUpgradeCard(this: any, card: UpgradeCard) {
    const session = this.requireSession();
    const state = ensureTacticalState(session);
    const multiplier =
      card.effectType === "attribute" && state.nextAttributeMultiplierUses > 0
        ? Math.max(1, Math.floor(state.nextAttributeMultiplier))
        : 1;

    for (let index = 0; index < multiplier; index += 1) card.apply(session);

    if (multiplier > 1) {
      state.nextAttributeMultiplierUses = Math.max(0, state.nextAttributeMultiplierUses - 1);
      if (state.nextAttributeMultiplierUses <= 0) state.nextAttributeMultiplier = 1;
    }

    return multiplier;
  }

function autoPickUpgrade(this: any) {
    const session = this.session;
    if (!session || this.phase !== "upgrade" || session.pendingChoices.length === 0) return;

    const best = session.pendingChoices
      .map((card, index) => ({ card, index, score: this.autoUpgradeScore(card, index) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)[0];

    if (!best) return;

    if (this.shouldAutoRefreshUpgrade(best.score)) {
      window.setTimeout(() => {
        if (this.phase !== "upgrade") return;
        if (!this.refreshUpgradeChoices(true)) return;
        this.autoPickUpgrade();
      }, 180);
      return;
    }

    window.setTimeout(() => {
      if (this.phase !== "upgrade") return;
      const current = this.session?.pendingChoices[best.index];
      if (!current || current.id !== best.card.id) return;
      this.pickUpgrade(best.index);
    }, 260);
  }

function applyPvpAutoUpgradeChoices(this: any, choices: UpgradeCard[]) {
    const session = this.requireSession();
    if (session.mode !== "pvp" || choices.length === 0) return;

    const applied = choices.slice(0, 3).map((card) => {
      const multiplier = this.applyUpgradeCard(card);
      session.modifiers.cardStacks[card.id] = (session.modifiers.cardStacks[card.id] || 0) + 1;
      session.selectedUpgradeIds.push(card.id);
      return { card, multiplier };
    });

    session.pendingChoices = [];
    this.phase = "playing";
    session.phase = "playing";
    this.upgradeScreen.classList.add("hidden");
    this.updateTacticPanel();
    this.notePvpAutoUpgradeBatch?.(applied);
    this.addFloatingText(WIDTH / 2, FIELD.y + 42, `自动升级 ×${applied.length}`, "#d58cff");
    this.sound.play("upgrade");
  }

function autoUpgradeScore(this: any, card: UpgradeCard, index: number) {
    const session = this.requireSession();
    const rarityScore = rarityAutoScore(card.rarity);
    const tagScore = this.autoUpgradeTagScore(card);
    const idScore = this.autoUpgradeIdScore(card);
    const utilityScore = this.autoUpgradeUtilityScore(card);
    const lowHpBonus = session.baseHp / session.maxBaseHp <= 0.45 && card.tag === "生存" ? 28 : 0;
    const earlyIncomeBonus = this.autoUpgradeMode === "income" && session.wave <= 12 && ["经济", "成长"].includes(card.tag) ? 12 : 0;

    return rarityScore + tagScore + idScore + utilityScore + lowHpBonus + earlyIncomeBonus - index * 0.01;
  }

function shouldAutoRefreshUpgrade(this: any, bestScore: number) {
    const session = this.session;
    if (!session || !this.autoBattleEnabled) return false;
    const state = ensureTacticalState(session);
    if (state.refreshCharges <= 0) return false;
    const threshold = this.autoUpgradeMode === "rarity" ? 34 : 18;
    return bestScore < threshold && session.pendingChoices.every((card) => card.rarity === "common");
  }

function autoUpgradeTagScore(this: any, card: UpgradeCard) {
    const table: Record<AutoUpgradeMode, Partial<Record<string, number>>> = {
      rarity: {
        传说: 34,
        Boss: 18,
        角色: 12,
        功能: 18,
      },
      attack: {
        全队: 28,
        弹珠: 24,
        暴击: 23,
        反弹: 22,
        多弹: 22,
        爆炸: 24,
        燃烧: 22,
        连锁: 22,
        Boss: 24,
        角色: 18,
        功能: 8,
        传说: 30,
      },
      defense: {
        生存: 34,
        控制: 26,
        全队: 16,
        弹珠: 10,
        Boss: 12,
        功能: 8,
        传说: 24,
      },
      income: {
        经济: 34,
        成长: 32,
        功能: 12,
        全队: 12,
        传说: 18,
      },
    };

    return table[this.autoUpgradeMode][card.tag] || 0;
  }

function autoUpgradeUtilityScore(this: any, card: UpgradeCard) {
    if (card.kind !== "utility") return 0;
    const session = this.requireSession();
    const state = ensureTacticalState(session);
    if (card.id === "utility_refresh_charge") return state.refreshCharges >= state.refreshChargesMax ? -30 : this.autoBattleEnabled ? 4 : 16;
    if (card.id === "utility_attribute_echo") return state.nextAttributeMultiplierUses > 0 ? 8 : 22;
    if (card.id === "utility_rarity_boost") return this.autoUpgradeMode === "rarity" ? 28 : 16;
    if (card.id === "utility_assault_bias") return this.autoUpgradeMode === "attack" ? 20 : 10;
    return 8;
  }

function autoUpgradeIdScore(this: any, card: UpgradeCard) {
    const mode = this.autoUpgradeMode;
    const scores: Partial<Record<AutoUpgradeMode, Partial<Record<string, number>>>> = {
      attack: {
        damage_up: 10,
        damage_up_mid: 15,
        damage_up_high: 21,
        fire_rate: 10,
        fire_rate_mid: 15,
        fire_rate_high: 21,
        crit_mid: 12,
        crit_high: 17,
        crit_damage: 8,
        endless_calibration: 6,
        legend_all: 14,
        boss_killer: 8,
        prism_refraction_card: 10,
        alchemist_recycle_card: 9,
      },
      defense: {
        base_hp: 10,
        regen_wave: 12,
        revive: 16,
        slow_vulnerability: 8,
        legend_safety: 16,
        last_line: 10,
        sentinel_barrier_card: 12,
      },
      income: {
        coin_gain: 14,
        xp_gain: 13,
        gold_damage: 10,
        endless_calibration: 5,
        alchemist_recycle_card: 8,
      },
      rarity: {
        legend_all: 10,
        legend_safety: 10,
        utility_rarity_boost: 12,
        damage_up_high: 8,
        fire_rate_high: 8,
        crit_high: 8,
      },
    };

    return scores[mode]?.[card.id] || 0;
  }

export const gameBattleUpgradeMethods = {
  updateAutoBattle,
  updateAutoUi,
  createSkillMarble,
  castSkill,
  skillCooldownFor,
  handleCanvasPointer,
  openUpgrade,
  renderUpgradeScreen,
  refreshUpgradeChoices,
  generateChoices,
  weightedUpgradeChoice,
  pickUpgrade,
  applyUpgradeCard,
  autoPickUpgrade,
  applyPvpAutoUpgradeChoices,
  autoUpgradeScore,
  shouldAutoRefreshUpgrade,
  autoUpgradeTagScore,
  autoUpgradeUtilityScore,
  autoUpgradeIdScore,
} satisfies Record<string, GameMethod>;
