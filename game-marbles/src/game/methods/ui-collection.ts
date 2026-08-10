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
  bonds,
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
  formations,
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
  tacticalDecks,
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

function collectionPageHtml(this: any) {
    const totalEntries = this.collectionTotalEntries();
    return `
      <div class="panel main-panel menu-page collection-page">
        ${this.menuPageTitleHtml("收藏室", `${totalEntries} 项资料`)}
        ${this.noticeHtml()}
        ${this.collectionSummaryHtml()}
        ${this.collectionTabsHtml()}
        <div class="collection-tab-content">
          ${this.collectionTabContentHtml()}
        </div>
      </div>
      ${this.collectionDetailKey ? this.collectionDetailModalHtml() : ""}
    `;
  }

function collectionSummaryHtml(this: any) {
    const ownedGemTypes = this.ownedGemTypes();
    const ownedLootCount = Object.values(collectibleConfigs).filter((item) => (this.inventory().collectibles[item.id] || 0) > 0).length;
    const pendingRewards = this.collectionPendingRewardCount();
    const collectionStats = [
      { label: "系统资料", value: String(this.collectionTotalEntries()) },
      { label: "待领取", value: String(pendingRewards) },
      { label: "角色", value: `${characters.filter((character) => this.characterProgress(character.id).owned).length}/${characters.length}` },
      { label: "收集物", value: `${ownedGemTypes.size + ownedLootCount}/${Object.values(gemConfigs).length + Object.values(collectibleConfigs).length}` },
    ];

    return `
      <section class="collection-summary-block">
        <div class="collection-summary">
          ${collectionStats
            .map(
              (item) => `
                <div>
                  <span>${item.label}</span>
                  <strong>${item.value}</strong>
                </div>
              `,
            )
            .join("")}
        </div>
        <button class="collection-claim-all" type="button" data-collection-claim-all ${pendingRewards > 0 ? "" : "disabled"}>
          <i></i>
          <span>全部领取</span>
          <strong>${pendingRewards > 0 ? `${pendingRewards} 项奖励` : "暂无奖励"}</strong>
        </button>
      </section>
    `;
  }

function collectionTabsHtml(this: any) {
    const tabs = this.collectionTabs();
    return `
      <div class="collection-tabs" role="tablist" aria-label="图鉴分类">
        ${tabs
          .map(
            (tab) => `
              <button
                class="collection-tab ${this.collectionTab === tab.id ? "active" : ""}"
                type="button"
                data-collection-tab="${tab.id}"
                role="tab"
                aria-selected="${this.collectionTab === tab.id ? "true" : "false"}"
              >
                <i class="collection-tab-icon ${tab.icon}"></i>
                <span>
                  <strong>${tab.label}</strong>
                  <em>${tab.hint}</em>
                </span>
              </button>
            `,
          )
          .join("")}
      </div>
    `;
  }

function collectionTabs(this: any): Array<{ id: CollectionTab; label: string; hint: string; icon: string }> {
    const bossEntries = this.bossCollectionEntries();
    const enemyTotal = Object.values(enemyConfigs).length + bossEntries.length;
    const enemyKnown = this.unlockedEnemyTypes().size + bossEntries.filter(({ stage }) => stage.index <= this.save.progress.unlockedStage).length;
    const ownedGemTypes = this.ownedGemTypes().size;
    const ownedLoot = Object.values(collectibleConfigs).filter((item) => (this.inventory().collectibles[item.id] || 0) > 0).length;
    const activeProtocols = metaUpgrades.filter((item) => upgradeLevel(this.save.upgrades, item.id) > 0).length;
    const achievements = this.collectionAchievementEntries();
    const achieved = achievements.filter((entry) => entry.state === "known").length;
    const cosmetics = this.collectionCosmeticEntries();
    const ownedCosmetics = cosmetics.filter((entry) => entry.state === "known").length;

    return [
      {
        id: "characters",
        label: "角色",
        hint: `${characters.filter((character) => this.characterProgress(character.id).owned).length}/${characters.length}`,
        icon: "characters",
      },
      { id: "enemies", label: "敌人/BOSS", hint: `${enemyKnown}/${enemyTotal}`, icon: "enemies" },
      { id: "gems", label: "宝石", hint: `${ownedGemTypes}/${Object.values(gemConfigs).length}`, icon: "gems" },
      { id: "marbles", label: "弹珠", hint: `${Object.values(marbleConfigs).length} 种`, icon: "marbles" },
      { id: "loot", label: "战利品", hint: `${ownedLoot}/${Object.values(collectibleConfigs).length}`, icon: "loot" },
      { id: "tactics", label: "战术升级", hint: `${upgradeCards.length + formations.length + tacticalDecks.length + bonds.length} 项`, icon: "tactics" },
      { id: "protocols", label: "基地协议", hint: `${activeProtocols}/${metaUpgrades.length}`, icon: "protocols" },
      { id: "achievements", label: "成就", hint: `${achieved}/${achievements.length}`, icon: "achievements" },
      { id: "cosmetics", label: "幻化", hint: `${ownedCosmetics}/${cosmetics.length}`, icon: "cosmetics" },
    ];
  }

function collectionTabContentHtml(this: any) {
    return this.collectionSectionsForTab(this.collectionTab)
      .map((section) => this.collectionSectionHtml(section.title, section.hint, section.entries))
      .join("");
  }

function collectionSectionHtml(this: any, title: string, hint: string, entries: CollectionEntry[]) {
    return `
      <section class="collection-section">
        <div class="collection-section-head">
          <span>${title}</span>
          <em>${hint}</em>
        </div>
        <div class="collection-avatar-grid">
          ${entries.map((entry) => this.collectionAvatarCardHtml(entry)).join("")}
        </div>
      </section>
    `;
  }

function collectionAvatarCardHtml(this: any, entry: CollectionEntry) {
    const claimed = Boolean(this.save.collectionRewards[entry.key]);
    const rewardReady = entry.state === "known" && !claimed;
    const status = entry.state === "locked" ? "未解锁" : claimed ? "已领取" : "可领取";
    return `
      <button
        class="collection-avatar-card ${entry.state} ${rewardReady ? "reward-ready" : ""}"
        type="button"
        data-collection-entry="${this.escapeText(entry.key)}"
        style="--entry-color: ${entry.color}"
      >
        <span class="collection-avatar-icon">${entry.iconHtml}</span>
        <strong>${this.escapeText(entry.title)}</strong>
        <em>${status}</em>
      </button>
    `;
  }

function collectionDetailModalHtml(this: any) {
    const entry = this.collectionDetailKey ? this.collectionEntryByKey(this.collectionDetailKey) : null;
    if (!entry) return "";

    const claimed = Boolean(this.save.collectionRewards[entry.key]);
    const canClaim = entry.state === "known" && !claimed;
    const buttonText = entry.state === "locked" ? "未解锁" : claimed ? "已领取" : `领取 ${this.collectionRewardText(entry.reward)}`;

    return `
      <div class="collection-detail-modal" data-collection-detail-backdrop>
        <section class="collection-detail-panel ${entry.state}" style="--entry-color: ${entry.color}" aria-label="图鉴详情">
          <button class="hero-modal-close" type="button" data-collection-detail-close aria-label="关闭">×</button>
          <div class="collection-detail-head">
            <div class="collection-detail-icon">${entry.iconHtml}</div>
            <div>
              <span>${this.escapeText(entry.eyebrow)}</span>
              <h2>${this.escapeText(entry.title)}</h2>
              <p>${this.escapeText(entry.desc)}</p>
            </div>
          </div>
          <div class="collection-detail-facts">
            ${entry.facts.map((fact) => `<div><span>${this.escapeText(fact)}</span></div>`).join("")}
          </div>
          <div class="collection-detail-tags">
            ${entry.tags.map((tag) => `<em>${this.escapeText(tag)}</em>`).join("")}
          </div>
          <div class="collection-reward-panel">
            <div>
              <span>解锁奖励</span>
              <strong>${this.collectionRewardText(entry.reward)}</strong>
              <em>${entry.state === "known" ? "图鉴收录后可领取一次" : entry.footer}</em>
            </div>
            <button class="primary-button" type="button" data-collection-claim="${this.escapeText(entry.key)}" ${canClaim ? "" : "disabled"}>
              ${buttonText}
            </button>
          </div>
        </section>
      </div>
    `;
  }

function collectionSectionsForTab(this: any, tab: CollectionTab): Array<{ title: string; hint: string; entries: CollectionEntry[] }> {
    if (tab === "enemies") {
      return [
        { title: "怪物资料", hint: "按关卡推进逐步收录", entries: this.collectionEnemyEntries() },
        { title: "BOSS 档案", hint: "小 BOSS 与章节 BOSS", entries: this.collectionBossEntries() },
      ];
    }
    if (tab === "gems") return [{ title: "宝石图鉴", hint: "基地中枢可装备的高级战斗资源", entries: this.collectionGemEntries() }];
    if (tab === "marbles") return [{ title: "弹珠图鉴", hint: "玩家可为角色配置的弹珠类型", entries: this.collectionMarbleEntries() }];
    if (tab === "loot") return [{ title: "战利品图鉴", hint: "撤离后带回仓库，可出售换金币", entries: this.collectionLootEntries() }];
    if (tab === "tactics") return this.collectionTacticSections();
    if (tab === "protocols") return [{ title: "基地协议图鉴", hint: "基地中枢的长期成长项目", entries: this.collectionProtocolEntries() }];
    if (tab === "achievements") return [{ title: "成就档案", hint: "达成长期目标后收录，可领取一次奖励", entries: this.collectionAchievementEntries() }];
    if (tab === "cosmetics") return [{ title: "幻化图鉴", hint: "角色与弹珠外观收集，不影响战斗数值", entries: this.collectionCosmeticEntries() }];
    return [{ title: "角色图鉴", hint: "点头像查看技能、默认弹珠和解锁奖励", entries: this.collectionCharacterEntries() }];
  }

function collectionAllEntries(this: any) {
    const tabs: CollectionTab[] = ["characters", "enemies", "gems", "marbles", "loot", "tactics", "protocols", "achievements", "cosmetics"];
    return tabs.flatMap((tab) => this.collectionSectionsForTab(tab).flatMap((section) => section.entries));
  }

function collectionEntryByKey(this: any, key: string) {
    return this.collectionAllEntries().find((entry) => entry.key === key) || null;
  }

function collectionPendingRewardCount(this: any) {
    return this.collectionAllEntries().filter((entry) => entry.state === "known" && !this.save.collectionRewards[entry.key]).length;
  }

function collectionCharacterEntries(this: any): CollectionEntry[] {
    return characters.map((character) => {
      const progress = this.characterProgress(character.id);
      const stats = this.characterUiStats(character);
      return {
        key: `characters:${character.id}`,
        color: character.color,
        state: progress.owned ? "known" : "locked",
        iconHtml: `<span class="collection-portrait" style="--entry-color: ${character.color}">${this.characterPortraitHtml(character, "collection-portrait-img")}</span>`,
        eyebrow: `${rarityName(character.rarity)} · ${progress.owned ? "已收录" : "未解锁"}`,
        title: character.name,
        desc: `${character.role} · ${character.skillDesc}`,
        facts: [`战力 ${stats.power}`, `主动 ${character.skillName}`, `路线 ${character.routes.length}`],
        tags: [character.skillName, ...character.marbles.map((id) => marbleConfigs[id].name)],
        footer: progress.owned ? `Lv.${progress.level} · 技能 Lv.${this.characterSkillLevel(character.id)}` : this.characterUnlockText(character),
        reward: this.collectionRarityReward(character.rarity, 1.25),
      };
    });
  }

function collectionEnemyEntries(this: any): CollectionEntry[] {
    const unlockedEnemies = this.unlockedEnemyTypes();
    return Object.values(enemyConfigs).map((enemy) => {
      const firstStage = this.enemyFirstStage(enemy.type);
      const known = unlockedEnemies.has(enemy.type);
      return {
        key: `enemies:type:${enemy.type}`,
        color: enemy.color,
        state: known ? "known" : "locked",
        iconHtml: this.collectionEnemyIconHtml(enemy.type, enemy.color),
        eyebrow: firstStage ? `初遇 第 ${firstStage.chapter}-${firstStage.stage} 关` : "基础资料",
        title: enemy.name,
        desc: this.enemyDescription(enemy.type),
        facts: [`生命 ${enemy.hp}`, `速度 ${enemy.speed}`, `金币 ${enemy.coins}`],
        tags: this.enemyTraitLabels(enemy.type),
        footer: known ? "已遭遇" : firstStage ? `第 ${firstStage.index} 关解锁` : "未遭遇",
        reward: { coins: enemy.type === "elite" || enemy.type === "boss" ? 90 : 30 },
      };
    });
  }

function collectionBossEntries(this: any): CollectionEntry[] {
    return this.bossCollectionEntries().map(({ stage, boss }) => {
      const known = stage.index <= this.save.progress.unlockedStage;
      return {
        key: `enemies:boss:${stage.id}`,
        color: enemyConfigs.boss.color,
        state: known ? "known" : "locked",
        iconHtml: this.collectionEnemyIconHtml("boss", enemyConfigs.boss.color),
        eyebrow: `第 ${stage.chapter}-${stage.stage} 关 · ${stage.theme}`,
        title: boss.name,
        desc: boss.desc,
        facts: [`生命倍率 ${stage.hpMultiplier}`, `速度倍率 ${stage.speedMultiplier}`, `密度倍率 ${stage.densityMultiplier}`],
        tags: boss.skills,
        footer: known ? "已解锁" : `第 ${stage.index} 关解锁`,
        reward: { coins: stage.stage === 10 ? 180 : 120 },
      };
    });
  }

function collectionGemEntries(this: any): CollectionEntry[] {
    const ownedTypes = this.ownedGemTypes();
    return Object.values(gemConfigs).map((gem) => {
      const owned = ownedTypes.has(gem.type);
      return {
        key: `gems:${gem.type}`,
        color: gem.color,
        state: owned ? "known" : "locked",
        iconHtml: `<span class="collection-gem-icon" style="--entry-color: ${gem.color}"><i></i></span>`,
        eyebrow: owned ? "已获得" : "未获得",
        title: gem.name,
        desc: `强化方向：${gem.stat}`,
        facts: [`Lv.1 ${gemEffectText(gem.type, 1)}`, `Lv.${GEM_MAX_LEVEL} ${gemEffectText(gem.type, GEM_MAX_LEVEL)}`],
        tags: ["基地宝石", gem.stat],
        footer: owned ? "仓库已收录" : "精英和首领更容易掉落",
        reward: { coins: 90 },
      };
    });
  }

function collectionMarbleEntries(this: any): CollectionEntry[] {
    const shards = this.inventory().marbleShards;
    return Object.values(marbleConfigs).map((marble) => {
      const level = this.marbleLevel(marble.id);
      return {
        key: `marbles:${marble.id}`,
        color: marble.color,
        state: "known",
        iconHtml: `<span class="collection-marble-icon" style="--entry-color: ${marble.color}"><i></i></span>`,
        eyebrow: `Lv.${level}/${MARBLE_MAX_LEVEL}`,
        title: marble.name,
        desc: `伤害 ${marble.damage} · 冷却 ${marble.cooldown.toFixed(2)}s · 反弹 ${marble.maxBounce}`,
        facts: [`速度 ${marble.speed}`, `存在 ${marble.lifetime.toFixed(1)}s`, `碎片 ${shards[marble.id] || 0}`],
        tags: marble.tags.map((tag) => this.marbleTagLabel(tag)),
        footer: level >= MARBLE_MAX_LEVEL ? "已满级" : "碎片可用于强化",
        reward: { coins: 50 },
      };
    });
  }

function collectionLootEntries(this: any): CollectionEntry[] {
    const inventory = this.inventory();
    return Object.values(collectibleConfigs).map((item) => {
      const count = inventory.collectibles[item.id] || 0;
      return {
        key: `loot:${item.id}`,
        color: rarityColor(item.rarity),
        state: count > 0 ? "known" : "locked",
        iconHtml: `<span class="collection-loot-icon ${item.rarity}">${dropIconText({ type: "collectible", id: item.id, amount: 1, rarity: item.rarity })}</span>`,
        eyebrow: `${rarityName(item.rarity)} · ${count > 0 ? "已获得" : "未获得"}`,
        title: item.name,
        desc: item.desc,
        facts: [`单价 ${item.value}`, `持有 ${count}`, `估值 ${count * item.value}`],
        tags: ["战利品", rarityName(item.rarity)],
        footer: count > 0 ? "仓库已收录" : "战斗掉落收录",
        reward: this.collectionRarityReward(item.rarity),
      };
    });
  }

function collectionTacticSections(this: any): Array<{ title: string; hint: string; entries: CollectionEntry[] }> {
    const systemSections = [
      { title: "出战阵法", hint: "开战前选择，决定构筑偏向和初始战术资源", entries: this.collectionFormationEntries() },
      { title: "战术卡组", hint: "战术升级从卡组池中优先抽取，自定义卡组可在作战终端配置", entries: this.collectionDeckEntries() },
      { title: "羁绊效果", hint: "角色、弹珠与阵法组合满足条件后激活", entries: this.collectionBondEntries() },
      { title: "核心质变", hint: "战局中积累进度后出现，拿到核心后可继续强化", entries: this.collectionCoreEntries() },
    ];
    const groups: Array<{ kind: NonNullable<UpgradeCard["kind"]>; title: string; hint: string }> = [
      { kind: "tiered", title: "升级链", hint: "初 / 中 / 高阶递进，低阶会解锁并提高高阶出现率" },
      { kind: "stackable", title: "无限叠加", hint: "可重复选择，越拿越稀有，适合堆核心数值" },
      { kind: "character", title: "角色专属", hint: "对应角色上阵后才会进入卡池" },
      { kind: "utility", title: "功能型", hint: "刷新、翻倍、检索等改变后续选卡流程" },
      { kind: "unique", title: "唯一效果", hint: "强机制卡，通常每局只生效一次" },
    ];

    const cardSections = groups
      .map((group) => {
        const entries = this.collectionTacticEntries(group.kind);
        return {
          title: `${group.title} · ${entries.length}`,
          hint: group.hint,
          entries,
        };
      })
      .filter((section) => section.entries.length > 0);

    return [...systemSections, ...cardSections];
  }

function collectionTacticEntries(this: any, kind: NonNullable<UpgradeCard["kind"]>): CollectionEntry[] {
    return upgradeCards
      .filter((card) => card.kind === kind && !card.core)
      .sort((a, b) => this.collectionTacticSortScore(a).localeCompare(this.collectionTacticSortScore(b)))
      .map((card) => ({
      key: `tactics:${card.id}`,
      color: rarityColor(card.rarity),
      state: "known",
      iconHtml: `<span class="collection-tactic-icon ${card.rarity}">${this.escapeText(this.collectionTacticIconText(card))}</span>`,
      eyebrow: `${rarityName(card.rarity)} · ${upgradeCardTypeLabel(card)}${card.tier ? ` · ${upgradeCardTierLabel(card)}阶` : ""}`,
      title: card.name,
      desc: card.desc,
      facts: [`类型 ${upgradeCardTypeLabel(card)}`, `叠加 ${this.collectionTacticStackText(card)}`, this.collectionTacticUnlockText(card)],
      tags: this.collectionTacticTags(card),
      footer: "战斗内出现",
      reward: this.collectionRarityReward(card.rarity, 0.45),
    }));
  }

function collectionFormationEntries(this: any): CollectionEntry[] {
    return formations.map((formation) => ({
      key: `formations:${formation.id}`,
      color: formation.color,
      state: "known",
      iconHtml: `<span class="collection-tactic-icon legendary" style="--entry-color:${formation.color}">${this.escapeText(formation.shortName.slice(0, 1))}</span>`,
      eyebrow: "出战阵法",
      title: formation.name,
      desc: formation.desc,
      facts: [`初始刷新 +${formation.initialRefreshCharges || 0}`, `推荐卡组 ${tacticalDecks.find((deck) => deck.id === formation.recommendedDeckId)?.name || "自动推荐"}`],
      tags: formation.tags,
      footer: formation.unlockText,
      reward: { coins: 120 },
    }));
  }

function collectionDeckEntries(this: any): CollectionEntry[] {
    return tacticalDecks.map((deck) => ({
      key: `decks:${deck.id}`,
      color: deck.id === "custom" ? "#61e6a8" : deck.id === "auto" ? "#54c7ff" : "#f6c95f",
      state: "known",
      iconHtml: `<span class="collection-tactic-icon epic">${deck.id === "auto" ? "自" : deck.id === "custom" ? "编" : "组"}</span>`,
      eyebrow: deck.formationHint ? `适配 ${formations.find((formation) => formation.id === deck.formationHint)?.name || "阵法"}` : "通用卡组",
      title: deck.name,
      desc: deck.desc,
      facts: [`卡牌 ${deck.id === "custom" ? this.save.customTacticalDeck.cardIds.length : deck.cardIds.length}`, `标签 ${deck.tagHints.join("/") || "自动"}`],
      tags: ["战术卡组", ...deck.tagHints],
      footer: deck.id === "custom" ? "作战终端可编辑" : "作战终端可选择",
      reward: { coins: deck.id === "custom" ? 150 : 90 },
    }));
  }

function collectionBondEntries(this: any): CollectionEntry[] {
    return bonds.map((bond) => ({
      key: `bonds:${bond.id}`,
      color: bond.color,
      state: "known",
      iconHtml: `<span class="collection-tactic-icon rare" style="--entry-color:${bond.color}">羁</span>`,
      eyebrow: "组合羁绊",
      title: bond.name,
      desc: bond.desc,
      facts: [
        bond.requiredCharacters?.length ? `角色 ${bond.requiredCharacters.map((id) => characters.find((character) => character.id === id)?.name || id).join("/")}` : "角色不限",
        bond.requiredMarbles?.length ? `弹珠 ${bond.requiredMarbles.map((id) => marbleConfigs[id].name).join("/")}` : "弹珠标签触发",
        bond.requiredFormationId ? `阵法 ${formations.find((formation) => formation.id === bond.requiredFormationId)?.name || bond.requiredFormationId}` : "阵法不限",
      ],
      tags: ["羁绊", ...(bond.unlockedCardIds || []).slice(0, 3)],
      footer: bond.unlockedCoreIds?.length ? `解锁核心 ${bond.unlockedCoreIds.length} 项` : "解锁羁绊卡",
      reward: { coins: 140, energyCrystals: 1 },
    }));
  }

function collectionCoreEntries(this: any): CollectionEntry[] {
    return upgradeCards
      .filter((card) => card.core)
      .sort((a, b) => `${a.core?.coreId}:${a.core?.type}`.localeCompare(`${b.core?.coreId}:${b.core?.type}`))
      .map((card) => ({
        key: `cores:${card.id}`,
        color: rarityColor(card.rarity),
        state: "known",
        iconHtml: `<span class="collection-tactic-icon ${card.rarity}">${card.core?.type === "enhance" ? "强" : card.core?.type === "main" ? "主" : "副"}</span>`,
        eyebrow: `${rarityName(card.rarity)} · ${card.core?.type === "enhance" ? "核心强化" : card.core?.type === "main" ? "主核心" : "副核心"}`,
        title: card.name,
        desc: card.desc,
        facts: [`核心 ${card.core?.coreId || "unknown"}`, this.collectionTacticUnlockText(card), `叠加 ${this.collectionTacticStackText(card)}`],
        tags: this.collectionTacticTags(card),
        footer: card.core?.type === "enhance" ? "持有对应核心后出现" : "战斗中积累核心进度后出现",
        reward: this.collectionRarityReward(card.rarity, card.rarity === "legendary" ? 0.8 : 0.55),
      }));
  }

function collectionTacticSortScore(this: any, card: UpgradeCard) {
    const rarityRank: Record<Rarity, number> = { common: 1, rare: 2, epic: 3, legendary: 4 };
    const tierRank = { basic: 1, middle: 2, high: 3 }[card.tier || "basic"] || 9;
    const family = card.familyId || card.tag || card.id;
    return `${family.padEnd(24, " ")}:${String(tierRank).padStart(2, "0")}:${String(rarityRank[card.rarity]).padStart(2, "0")}:${card.id}`;
  }

function collectionTacticIconText(this: any, card: UpgradeCard) {
    const tier = upgradeCardTierLabel(card);
    if (tier) return tier;
    if (card.kind === "utility") return "功";
    if (card.kind === "character") return "角";
    if (card.kind === "unique") return "唯";
    if (card.kind === "stackable") return "叠";
    return card.tag.slice(0, 1);
  }

function collectionTacticStackText(this: any, card: UpgradeCard) {
    if (card.maxStacks === "infinite") return "无限";
    if (typeof card.maxStacks === "number") return `${card.maxStacks} 次`;
    return card.kind === "unique" ? "1 次" : "可重复";
  }

function collectionTacticUnlockText(this: any, card: UpgradeCard) {
    if (card.unlock?.characters?.length) {
      const names = card.unlock.characters
        .map((id) => characters.find((character) => character.id === id)?.name || id)
        .join("/");
      return `上阵 ${names}`;
    }
    if (card.unlock?.cards?.length) return "前置卡解锁";
    if (card.unlock?.families?.length) return "前置流派解锁";
    if (card.kind === "tiered" && card.tier === "middle") return "初阶后出现";
    if (card.kind === "tiered" && card.tier === "high") return "中阶后出现";
    if (card.requires) return "限定构筑";
    return "通用卡池";
  }

function collectionTacticTags(this: any, card: UpgradeCard) {
    const tags = [card.tag, rarityName(card.rarity), upgradeCardTypeLabel(card)];
    const tier = upgradeCardTierLabel(card);
    if (tier) tags.push(`${tier}阶`);
    if (card.effectType === "attribute") tags.push("属性卡");
    if (card.effectType === "utility") tags.push("流程卡");
    if (card.effectType === "hybrid") tags.push("机制卡");
    return tags;
  }

function collectionProtocolEntries(this: any): CollectionEntry[] {
    return metaUpgrades.map((item) => {
      const level = upgradeLevel(this.save.upgrades, item.id);
      const capped = level >= item.max;
      return {
        key: `protocols:${item.id}`,
        color: level > 0 ? "#61e6a8" : "#54c7ff",
        state: level > 0 ? "known" : "locked",
        iconHtml: `<span class="collection-protocol-icon"><i></i></span>`,
        eyebrow: level > 0 ? `Lv.${level}/${item.max}` : "未激活",
        title: item.name,
        desc: item.desc,
        facts: [`上限 ${item.max}`, `当前 ${level}`, capped ? "已满级" : `下级 ${metaCost(item, level)}`],
        tags: ["基地协议", "永久强化"],
        footer: capped ? "协议已满级" : "基地中枢可升级",
        reward: { coins: 80 },
      };
    });
  }

function collectionAchievementEntries(this: any): CollectionEntry[] {
    const clearedCount = Object.values(this.save.progress.clearedStages).filter((record) => record.cleared).length;
    const totalStars = Object.values(this.save.progress.clearedStages).reduce((sum, record) => sum + (record.stars || 0), 0);
    const ownedCharacters = characters.filter((character) => this.characterProgress(character.id).owned).length;
    const highestHeroLevel = characters.reduce((max, character) => Math.max(max, this.characterProgress(character.id).level || 1), 1);
    const maxMarbleLevel = Object.keys(marbleConfigs).reduce(
      (max, id) => Math.max(max, this.marbleLevel(id as MarbleId)),
      1,
    );
    const ownedGemTypes = this.ownedGemTypes().size;
    const ownedLootTypes = Object.values(collectibleConfigs).filter((item) => (this.inventory().collectibles[item.id] || 0) > 0).length;
    const activeProtocols = metaUpgrades.filter((item) => upgradeLevel(this.save.upgrades, item.id) > 0).length;
    const bestWave = Math.max(this.save.bestWave, this.save.bestEndlessWave || 0);
    const achievements: CollectionAchievement[] = [
      {
        id: "first_sortie",
        category: "战斗",
        title: "首次出阵",
        desc: "完成第一次基地作战部署。",
        color: "#54c7ff",
        icon: "战",
        current: this.save.runs,
        target: 1,
        goal: "完成 1 次出战",
        tags: ["战斗", "新手"],
        reward: { coins: 50 },
      },
      {
        id: "veteran_sortie",
        category: "战斗",
        title: "老练指挥官",
        desc: "多次派遣小队，建立稳定作战节奏。",
        color: "#6ee7f6",
        icon: "令",
        current: this.save.runs,
        target: 10,
        goal: "累计出战 10 次",
        tags: ["战斗", "长期"],
        reward: { coins: 160 },
      },
      {
        id: "first_clear",
        category: "通关",
        title: "首个胜场",
        desc: "完成一次章节关卡通关。",
        color: "#61e6a8",
        icon: "胜",
        current: this.save.wins,
        target: 1,
        goal: "通关 1 次",
        tags: ["通关", "章节"],
        reward: { coins: 150, energyCrystals: 2 },
      },
      {
        id: "clear_streak",
        category: "通关",
        title: "连续突破",
        desc: "保持作战胜率，累计完成多次通关。",
        color: "#45d483",
        icon: "破",
        current: this.save.wins,
        target: 5,
        goal: "通关 5 次",
        tags: ["通关", "熟练"],
        reward: { coins: 320, energyCrystals: 6 },
      },
      {
        id: "sector_sweep",
        category: "推进",
        title: "区域清扫",
        desc: "清理一批固定关卡，打开更深层区域。",
        color: "#f6c95f",
        icon: "章",
        current: clearedCount,
        target: 10,
        goal: "通关 10 个关卡",
        tags: ["章节", "推进"],
        reward: { coins: 260, energyCrystals: 4 },
      },
      {
        id: "frontier_path",
        category: "推进",
        title: "远征航线",
        desc: "持续推进战线，穿过多个章节节点。",
        color: "#ffb86b",
        icon: "航",
        current: clearedCount,
        target: 30,
        goal: "通关 30 个关卡",
        tags: ["章节", "远征"],
        reward: { coins: 680, energyCrystals: 12 },
      },
      {
        id: "star_record",
        category: "评价",
        title: "三星战报",
        desc: "用更稳的基地生命和更快的速度取得高评价。",
        color: "#fff2bf",
        icon: "星",
        current: totalStars,
        target: 18,
        goal: "累计获得 18 颗星",
        tags: ["星级", "技巧"],
        reward: { coins: 300, energyCrystals: 5 },
      },
      {
        id: "deep_wave",
        category: "战斗",
        title: "深层波次",
        desc: "在一场战斗中坚持到关键后段波次。",
        color: "#b68cff",
        icon: "波",
        current: bestWave,
        target: 20,
        goal: "最高波次达到 20",
        tags: ["波次", "挑战"],
        reward: { coins: 220, energyCrystals: 3 },
      },
      {
        id: "squad_ready",
        category: "角色",
        title: "小队成形",
        desc: "收集足够角色，完成基础作战编组。",
        color: "#a8ffd7",
        icon: "队",
        current: ownedCharacters,
        target: 3,
        goal: "拥有 3 名角色",
        tags: ["角色", "收集"],
        reward: { coins: 180 },
      },
      {
        id: "hero_roster",
        category: "角色",
        title: "英雄集结",
        desc: "扩充基地角色池，准备更多战术搭配。",
        color: "#7de2ff",
        icon: "英",
        current: ownedCharacters,
        target: 6,
        goal: "拥有 6 名角色",
        tags: ["角色", "阵容"],
        reward: { coins: 420, energyCrystals: 8 },
      },
      {
        id: "hero_training",
        category: "养成",
        title: "训练有素",
        desc: "把核心角色培养到能承担主力的位置。",
        color: "#ff9bd2",
        icon: "训",
        current: highestHeroLevel,
        target: 10,
        goal: "任意角色达到 10 级",
        tags: ["角色", "养成"],
        reward: { coins: 280, energyCrystals: 4 },
      },
      {
        id: "marble_polish",
        category: "养成",
        title: "弹珠精炼",
        desc: "持续强化弹珠，让角色配置更有主轴。",
        color: "#54c7ff",
        icon: "珠",
        current: maxMarbleLevel,
        target: 5,
        goal: "任意弹珠达到 5 级",
        tags: ["弹珠", "强化"],
        reward: { coins: 240 },
      },
      {
        id: "gem_light",
        category: "仓库",
        title: "宝石初光",
        desc: "收集不同类型的基地宝石，开启更多属性方向。",
        color: "#61e6a8",
        icon: "石",
        current: ownedGemTypes,
        target: 3,
        goal: "拥有 3 类宝石",
        tags: ["宝石", "仓库"],
        reward: { coins: 220, energyCrystals: 3 },
      },
      {
        id: "loot_hunter",
        category: "仓库",
        title: "战利品猎手",
        desc: "把不同战利品带回基地仓库。",
        color: "#f6c95f",
        icon: "利",
        current: ownedLootTypes,
        target: 3,
        goal: "收录 3 类战利品",
        tags: ["战利品", "撤离"],
        reward: { coins: 260 },
      },
      {
        id: "protocol_online",
        category: "基地",
        title: "协议上线",
        desc: "激活多个基地协议，形成长期成长骨架。",
        color: "#9fd7ff",
        icon: "协",
        current: activeProtocols,
        target: 3,
        goal: "激活 3 个基地协议",
        tags: ["基地协议", "长期"],
        reward: { coins: 300, energyCrystals: 5 },
      },
    ];

    return achievements.map((achievement) => this.collectionAchievementEntryHtmlModel(achievement));
  }

function collectionAchievementEntryHtmlModel(this: any, achievement: CollectionAchievement): CollectionEntry {
    const current = Math.max(0, Math.floor(achievement.current));
    const progress = Math.min(current, achievement.target);
    const unlocked = current >= achievement.target;
    const missing = Math.max(0, achievement.target - current);

    return {
      key: `achievements:${achievement.id}`,
      color: achievement.color,
      state: unlocked ? "known" : "locked",
      iconHtml: `<span class="collection-achievement-icon" style="--entry-color: ${achievement.color}"><i>${this.escapeText(achievement.icon)}</i></span>`,
      eyebrow: `${achievement.category} · ${unlocked ? "已达成" : "进行中"}`,
      title: achievement.title,
      desc: achievement.desc,
      facts: [`进度 ${progress}/${achievement.target}`, achievement.goal, unlocked ? "奖励可领取" : `还差 ${missing}`],
      tags: achievement.tags,
      footer: unlocked ? "成就已达成" : achievement.goal,
      reward: achievement.reward,
    };
  }

function collectionCosmeticEntries(this: any): CollectionEntry[] {
    return [...cosmeticsForPool("character"), ...cosmeticsForPool("marble")].map((item) => {
      const owned = Boolean(this.save.cosmetics.owned[item.id]);
      const targetName = this.cosmeticTargetName(item);
      return {
        key: `cosmetics:${item.id}`,
        color: item.color,
        state: owned ? "known" : "locked",
        iconHtml: this.cosmeticIconHtml(item).replace("cosmetic-icon", "collection-cosmetic-icon cosmetic-icon"),
        eyebrow: `${this.cosmeticRarityName(item.rarity)} · ${owned ? "已拥有" : "未拥有"}`,
        title: item.name,
        desc: item.desc,
        facts: [targetName, item.theme || "常驻", item.type === "character" ? "角色外观" : "弹珠特效"],
        tags: [this.cosmeticRarityName(item.rarity), item.theme || "常驻", item.type === "character" ? "角色幻化" : "弹珠幻化"],
        footer: owned ? `拥有 ${this.save.cosmetics.owned[item.id]} 个` : "前往幻化舱获取",
        reward: { coins: item.rarity === "legendary" ? 120 : item.rarity === "epic" ? 80 : 40 },
      };
    });
  }

function collectionRarityReward(this: any, rarity: Rarity, scale = 1): CollectionReward {
    const coins = {
      common: 40,
      rare: 70,
      epic: 110,
      legendary: 170,
    }[rarity];
    return { coins: Math.max(1, Math.round(coins * scale)) };
  }

function collectionRewardText(this: any, reward: CollectionReward) {
    const parts = [`${reward.coins} 金币`];
    if (reward.energyCrystals) parts.push(`${reward.energyCrystals} 能源晶体`);
    return parts.join(" · ");
  }

function collectionTotalEntries(this: any) {
    return (
      characters.length +
      Object.values(enemyConfigs).length +
      this.bossCollectionEntries().length +
      Object.values(gemConfigs).length +
      Object.values(marbleConfigs).length +
      Object.values(collectibleConfigs).length +
      upgradeCards.length +
      formations.length +
      tacticalDecks.length +
      bonds.length +
      metaUpgrades.length +
      this.collectionAchievementEntries().length +
      this.collectionCosmeticEntries().length
    );
  }

function ownedGemTypes(this: any) {
    const owned = new Set<GemType>();
    for (const [key, count] of Object.entries(this.inventory().gems)) {
      if (count <= 0) continue;
      const gem = parseGemKey(key);
      if (gem) owned.add(gem.type);
    }
    return owned;
  }

function unlockedEnemyTypes(this: any) {
    const unlocked = new Set<EnemyType>();
    for (const stage of stages) {
      if (stage.index > this.save.progress.unlockedStage) continue;
      for (const type of this.stageEnemyTypes(stage)) unlocked.add(type);
    }
    return unlocked;
  }

function stageEnemyTypes(this: any, stage: StageConfig) {
    const types = new Set<EnemyType>([...stage.enemyBias, ...stage.featuredEnemies]);
    for (const event of stage.waveEvents) {
      for (const type of event.enemies || []) types.add(type);
    }
    if (stage.boss) types.add(stage.boss.enemyType);
    return Array.from(types);
  }

function enemyFirstStage(this: any, type: EnemyType) {
    return stages.find((stage) => this.stageEnemyTypes(stage).includes(type));
  }

function bossCollectionEntries(this: any) {
    return stages
      .filter((stage): stage is StageConfig & { boss: NonNullable<StageConfig["boss"]> } => Boolean(stage.boss))
      .map((stage) => ({ stage, boss: stage.boss }));
  }

function enemyDescription(this: any, type: EnemyType) {
    const descriptions: Record<EnemyType, string> = {
      small: "标准推进单位，数量多但单体威胁较低。",
      tank: "高生命装甲单位，适合用持续火力击穿。",
      fast: "高速突进单位，会快速压缩防线反应时间。",
      splitter: "死亡后制造二次压力，需要范围和多弹处理。",
      shield: "携带护盾与减伤，拖慢清场节奏。",
      healer: "治疗附近单位，是混编波次中的优先目标。",
      gold: "高收益单位，会诱导玩家承担更多推进风险。",
      elite: "精英单位，生命高、掉落好，常作为波次核心。",
      boss: "首领级核心，拥有阶段技能和高额掉落。",
    };
    return descriptions[type];
  }

function enemyTraitLabels(this: any, type: EnemyType) {
    const traits: Record<EnemyType, string[]> = {
      small: ["基础", "数量"],
      tank: ["厚甲", "高生命"],
      fast: ["高速", "突进"],
      splitter: ["分裂", "二段压力"],
      shield: ["护盾", "减伤"],
      healer: ["治疗", "支援"],
      gold: ["金币", "收益"],
      elite: ["精英", "高掉落"],
      boss: ["首领", "阶段技能"],
    };
    return traits[type];
  }

function collectionEnemyIconHtml(this: any, type: EnemyType, color: string) {
    return `<span class="collection-enemy-icon ${type}" style="--entry-color: ${color}"><i></i></span>`;
  }

export const gameCollectionUiMethods = {
  collectionPageHtml,
  collectionSummaryHtml,
  collectionTabsHtml,
  collectionTabs,
  collectionTabContentHtml,
  collectionSectionHtml,
  collectionAvatarCardHtml,
  collectionDetailModalHtml,
  collectionSectionsForTab,
  collectionAllEntries,
  collectionEntryByKey,
  collectionPendingRewardCount,
  collectionCharacterEntries,
  collectionEnemyEntries,
  collectionBossEntries,
  collectionGemEntries,
  collectionMarbleEntries,
  collectionLootEntries,
  collectionTacticSections,
  collectionTacticEntries,
  collectionFormationEntries,
  collectionDeckEntries,
  collectionBondEntries,
  collectionCoreEntries,
  collectionTacticSortScore,
  collectionTacticIconText,
  collectionTacticStackText,
  collectionTacticUnlockText,
  collectionTacticTags,
  collectionProtocolEntries,
  collectionAchievementEntries,
  collectionAchievementEntryHtmlModel,
  collectionCosmeticEntries,
  collectionRarityReward,
  collectionRewardText,
  collectionTotalEntries,
  ownedGemTypes,
  unlockedEnemyTypes,
  stageEnemyTypes,
  enemyFirstStage,
  bossCollectionEntries,
  enemyDescription,
  enemyTraitLabels,
  collectionEnemyIconHtml,
} satisfies Record<string, GameMethod>;
