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
  cosmeticConfigs,
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
  defaultCustomTacticalDeck,
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
  formationById,
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
  leaderboardIconSources,
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
  normalizeCustomTacticalDeck,
  normalizeLineup,
  normalizeVelocity,
  parseGemKey,
  pvpRankDisplayLabel,
  pvpRankLabel,
  pvpRankProgressRatio,
  pvpRankProgressText,
  pvpRankRecordText,
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
  tacticalDeckById,
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

function renderMenu(this: any, view: MenuView = "home") {
    const returningFromBattle = this.phase !== "menu";
    this.restorePvpAutomation?.();
    if (view !== "pvp") this.cancelPvpMatchmaking?.(false);
    this.menuView = view;
    if (view !== "home" || returningFromBattle) this.battleTerminalOpen = false;
    if (view !== "inventory") this.warehouseDetail = null;
    if (view !== "collection") this.collectionDetailKey = null;
    if (view !== "marbles") this.marbleDetailId = null;
    this.phase = "menu";
    this.session = null;
    this.surface.classList.remove("pvp-mode");
    this.sound.setMusicMode("menu");
    this.hideScreens();
    this.battleHud.classList.add("hidden");
    this.bottomHud.classList.add("hidden");
    this.tacticPanel.classList.add("hidden");
    this.lootBag.classList.add("hidden");
    this.quickExtractionButton?.classList.add("hidden");
    this.lootScreen.classList.add("hidden");
    this.menuScreen.classList.remove("hidden");
    this.menuScreen.innerHTML = `
      ${view === "home" || view === "challenges" || view === "stagePicker" ? this.homeMenuHtml(view === "challenges", view === "stagePicker") : this.menuPageHtml(view)}
      ${this.menuNavHtml(view)}
      ${view !== "home" && view !== "challenges" && view !== "stagePicker" ? this.pageReturnHtml() : ""}
    `;
    if (view === "ranking") this.ensureLeaderboardLoaded?.();
  }

function homeMenuHtml(this: any, showChallenges = false, showStagePicker = false) {
    const selectedStage = this.currentStage();
    const clearedCount = Object.values(this.save.progress.clearedStages).filter((record) => record.cleared).length;
    const homeCharacters = this.lineupCharacters();
    const canStart = this.canPlay();
    const totalPower = homeCharacters.reduce((sum, character) => sum + this.characterUiStats(character).power, 0);
    return `
      <div class="home-ui">
        <div class="home-topbar">
          ${this.accountPanelHtml()}
          ${this.homeResourceStripHtml()}
          <div class="home-tools" aria-label="快捷入口">
            <button class="settings-button home-tool-button" type="button" data-menu="settings" aria-label="设置" title="设置">
              ${this.settingsIconHtml()}
            </button>
          </div>
        </div>

        <main class="home-hub">
          <section class="home-squad-dock" aria-label="出阵小队">
            <div class="home-section-head">
              <span>出阵小队</span>
            </div>
            <div class="squad-grid">
              ${homeCharacters.map((character) => this.characterCardHtml(character)).join("")}
            </div>
          </section>

          <section class="home-scene" aria-label="基地场景">
            ${this.homeBattleTerminalHtml()}
            ${this.homeFacilitySceneHtml()}
          </section>
        </main>
      </div>
      ${this.battleTerminalOpen ? this.battleStartModalHtml(selectedStage, clearedCount, totalPower, canStart) : ""}
      ${showChallenges ? this.challengeModalHtml() : ""}
      ${showStagePicker ? this.stagePickerModalHtml(selectedStage) : ""}
      ${this.accountModalOpen ? this.accountModalHtml() : ""}
      ${this.loginModalOpen ? this.loginModalHtml() : ""}
    `;
  }

function homeResourceStripHtml(this: any) {
    const coins = Math.floor(this.save.coins);
    const crystals = Math.floor(this.save.energyCrystals);
    return `
      <div class="home-resource-strip" aria-label="资源状态">
        <div aria-label="金币" title="金币 ${coins.toLocaleString("zh-CN")}">
          <img src="${homeAssetSources.coin}" alt="" draggable="false" />
          <strong>${formatHomeResourceAmount(coins)}</strong>
        </div>
        <div aria-label="能源晶体" title="能源晶体 ${crystals.toLocaleString("zh-CN")}">
          <img src="${homeAssetSources.energyCrystal}" alt="" draggable="false" />
          <strong>${formatHomeResourceAmount(crystals)}</strong>
        </div>
      </div>
    `;
  }

function formatHomeResourceAmount(value: number) {
    const amount = Math.max(0, Math.floor(Number(value) || 0));
    if (amount < 10000) return String(amount);
    if (amount < 100000000) return `${formatCompactUnit(amount / 10000)}万`;
    return `${formatCompactUnit(amount / 100000000)}亿`;
  }

function formatCompactUnit(value: number) {
    const fixed = value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2);
    return fixed.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
  }

function homeBattleTerminalHtml(this: any) {
    return `
      <button class="battle-terminal" type="button" data-action="openBattleTerminal" aria-label="打开作战终端">
        <span class="battle-terminal-visual">
          <img src="${homeAssetSources.battleTerminal}" alt="" draggable="false" />
        </span>
        <span class="battle-terminal-label">
          <strong>作战终端</strong>
        </span>
      </button>
    `;
  }

function battleStartModalHtml(this: any, stage: StageConfig, clearedCount: number, totalPower: number, canStart: boolean) {
    const loadoutSelect = this.battleLoadoutStartSelectHtml();
    return `
      <div class="battle-start-modal" data-battle-terminal-backdrop>
        <section class="battle-start-panel" aria-label="作战终端">
          <button class="hero-modal-close" type="button" data-action="closeBattleTerminal" aria-label="关闭">×</button>
          <div class="battle-start-head">
            <img src="${homeAssetSources.battleTerminal}" alt="" draggable="false" />
            <div>
              <span class="stage-cta-kicker">第 ${stage.chapter} 章 · ${stage.stage} 关</span>
              <h2>${this.escapeText(stage.name)}</h2>
              <p>${this.escapeText(stage.objective)}</p>
            </div>
          </div>
          <div class="mission-meta-grid">
            <div><span>进度</span><strong>${clearedCount}/50</strong></div>
            <div><span>战力</span><strong>${totalPower}</strong></div>
            <div><span>收益</span><strong>${this.stageRewardText(stage)}</strong></div>
          </div>
          ${loadoutSelect}
          <button class="primary-button menu-start-button" type="button" data-action="start" ${canStart ? "" : "disabled"}>
            开始战斗
          </button>
          <div class="mission-actions">
            <button class="secondary-button mission-small-button" type="button" data-menu="stagePicker">选关</button>
            <button class="secondary-button mission-small-button" type="button" data-menu="challenges">挑战</button>
          </div>
        </section>
      </div>
    `;
  }

function battleLoadoutStartSelectHtml(this: any) {
    const activeId = this.save.activeBattleLoadoutId;
    const presets = this.save.battleLoadouts || [];
    const activePreset = presets.find((preset: any) => preset.id === activeId) || presets.find((preset: any) => Array.isArray(preset.lineup) && preset.lineup.length > 0) || presets[0];
    const lineup = Array.isArray(activePreset?.lineup) ? activePreset.lineup : [];
    const members = lineup.map((id: string) => characters.find((character) => character.id === id)).filter(Boolean);
    const saved = members.length > 0;
    const power = members.reduce((sum: number, character: any) => sum + this.characterUiStats(character).power, 0);
    return `
      <div class="battle-loadout-select">
        <div class="battle-loadout-select-head">
          <strong>当前阵容方案</strong>
          <button class="battle-loadout-adjust-button" type="button" data-loadout-config-open>调整</button>
        </div>
        <article class="battle-loadout-card active ${saved ? "saved" : "empty"}">
          <span class="battle-loadout-card-head">
            <strong>${this.escapeText(activePreset?.name || "未选择方案")}</strong>
            <em>${saved ? `战力 ${power}` : "空方案"}</em>
          </span>
          <span class="battle-loadout-portraits">
            ${
              saved
                ? members
                    .slice(0, 3)
                    .map((character: any, index: number) => {
                      const src = characterPortraitSources[character.id];
                      return `<i style="--hero-color:${character.color}"><b>${index + 1}</b>${src ? `<img src="${src}" alt="" draggable="false" />` : this.escapeText(character.name.slice(0, 1))}</i>`;
                    })
                    .join("")
                : `<em>未保存阵容</em>`
            }
          </span>
        </article>
      </div>
    `;
  }

function battleBuildPreviewHtml(this: any) {
    const selectedFormation = formationById(this.save.preferences.formationId);
    const selectedDeck = tacticalDeckById(this.save.preferences.tacticalDeckId);
    const lineup = this.lineupCharacters();
    const activeBonds = this.activeBondPreview(lineup, selectedFormation.id);
    const bondText =
      activeBonds.length > 0
        ? activeBonds.map((bond) => `<span style="--bond-color:${bond.color}">${this.escapeText(bond.name)}</span>`).join("")
        : `<em>调整角色和弹珠可激活羁绊</em>`;

    return `
      <div class="battle-build-preview">
        <div class="battle-build-head">
          <strong>战斗构筑</strong>
          <span>${this.escapeText(selectedFormation.shortName)} · ${this.escapeText(selectedDeck.name)}</span>
        </div>
        <div class="formation-select-grid" aria-label="选择出战阵法">
          ${formations
            .map(
              (formation) => `
                <button
                  class="formation-select-card ${formation.id === selectedFormation.id ? "active" : ""}"
                  type="button"
                  data-formation-select="${formation.id}"
                  style="--formation-color:${formation.color}; --formation-accent:${formation.accentColor}"
                >
                  <strong>${this.escapeText(formation.name)}</strong>
                  <span>${formation.tags.map((tag) => this.escapeText(tag)).join(" / ")}</span>
                </button>
              `,
            )
            .join("")}
        </div>
        <div class="deck-select-row" aria-label="选择战术卡组">
          ${tacticalDecks
            .map(
              (deck) => `
                <button class="${deck.id === selectedDeck.id ? "active" : ""}" type="button" data-tactical-deck-select="${deck.id}">
                  ${this.escapeText(deck.name)}
                </button>
              `,
            )
            .join("")}
        </div>
        ${this.customDeckEditorHtml(selectedDeck)}
        <div class="bond-preview-row">
          <strong>羁绊</strong>
          <div>${bondText}</div>
        </div>
      </div>
    `;
  }

function customDeckEditorHtml(this: any, selectedDeck: TacticalDeckConfig) {
    const customDeck = normalizeCustomTacticalDeck(this.save.customTacticalDeck);
    const selectedIds = new Set(customDeck.cardIds);
    const sourceDeck = selectedDeck.id === "auto" ? tacticalDeckById(formationById(this.save.preferences.formationId).recommendedDeckId) : selectedDeck;
    const canCopy = sourceDeck.id !== "custom" && sourceDeck.cardIds.length > 0;
    const coreCards = upgradeCards.filter((card) => card.core);
    const regularCards = upgradeCards.filter((card) => !card.core);
    const cards = [...coreCards, ...regularCards];
    const tags = [...new Set(customDeck.cardIds.map((id) => upgradeCards.find((card) => card.id === id)?.tag).filter(Boolean))].slice(0, 5);

    return `
      <div class="custom-deck-editor ${selectedDeck.id === "custom" ? "active" : ""}">
        <div class="custom-deck-head">
          <div>
            <strong>自定义卡组 ${customDeck.cardIds.length}/24</strong>
            <span>${tags.length ? tags.map((tag) => this.escapeText(tag)).join(" / ") : "从预设复制后微调"}</span>
          </div>
          <div>
            <button type="button" data-action="copyDeckToCustom" ${canCopy ? "" : "disabled"}>复制当前</button>
            <button type="button" data-action="resetCustomDeck">重置</button>
          </div>
        </div>
        <div class="custom-deck-card-grid">
          ${cards
            .map(
              (card) => `
                <button
                  class="custom-deck-card ${selectedIds.has(card.id) ? "active" : ""} ${card.rarity}"
                  type="button"
                  data-deck-card-toggle="${card.id}"
                  title="${this.escapeText(card.desc)}"
                >
                  <span>${this.escapeText(card.tag)}</span>
                  <strong>${this.escapeText(card.name)}</strong>
                </button>
              `,
            )
            .join("")}
        </div>
      </div>
    `;
  }

function copyCurrentDeckToCustom(this: any) {
    const selectedFormation = formationById(this.save.preferences.formationId);
    const selectedDeck = tacticalDeckById(this.save.preferences.tacticalDeckId);
    const sourceDeck =
      selectedDeck.id === "auto"
        ? tacticalDeckById(selectedFormation.recommendedDeckId)
        : selectedDeck.id === "custom"
          ? this.save.customTacticalDeck
          : selectedDeck;
    this.save.customTacticalDeck = normalizeCustomTacticalDeck({
      ...this.save.customTacticalDeck,
      formationHint: sourceDeck.formationHint || selectedFormation.id,
      tagHints: sourceDeck.tagHints,
      cardIds: sourceDeck.cardIds,
    });
    this.save.preferences.tacticalDeckId = "custom";
    this.menuNotice = `已复制「${sourceDeck.name}」到自定义卡组`;
    this.persistSave("custom-deck-copy");
    this.renderMenu("home");
  }

function resetCustomTacticalDeck(this: any) {
    this.save.customTacticalDeck = defaultCustomTacticalDeck();
    this.save.preferences.tacticalDeckId = "custom";
    this.menuNotice = "自定义卡组已重置";
    this.persistSave("custom-deck-reset");
    this.renderMenu("home");
  }

function toggleCustomDeckCard(this: any, cardId: string) {
    const card = upgradeCards.find((item) => item.id === cardId);
    if (!card) return;
    const customDeck = normalizeCustomTacticalDeck(this.save.customTacticalDeck);
    const selected = new Set(customDeck.cardIds);
    if (selected.has(cardId)) {
      if (selected.size <= 8) {
        this.menuNotice = "自定义卡组至少保留 8 张卡";
        this.renderMenu("home");
        return;
      }
      selected.delete(cardId);
    } else {
      if (selected.size >= 24) {
        this.menuNotice = "自定义卡组最多选择 24 张卡";
        this.renderMenu("home");
        return;
      }
      selected.add(cardId);
    }

    const cardIds = upgradeCards.filter((item) => selected.has(item.id)).map((item) => item.id);
    const tagHints = [...new Set(cardIds.map((id) => upgradeCards.find((item) => item.id === id)?.tag).filter(Boolean))].slice(0, 5);
    this.save.customTacticalDeck = normalizeCustomTacticalDeck({
      ...customDeck,
      formationHint: this.save.preferences.formationId,
      tagHints,
      cardIds,
    });
    this.save.preferences.tacticalDeckId = "custom";
    this.persistSave("custom-deck-toggle");
    this.renderMenu("home");
  }

function activeBondPreview(this: any, lineup: CharacterConfig[], formationId: string) {
    const characterIds = new Set(lineup.map((character) => character.id));
    const marbleIds = new Set<string>();
    const tags = new Set<string>();

    for (const character of lineup) {
      for (const marbleId of this.characterMarbles(character)) {
        marbleIds.add(marbleId);
        for (const tag of marbleConfigs[marbleId].tags) tags.add(tag);
      }
    }

    return bonds.filter((bond) => {
      if (bond.requiredFormationId && bond.requiredFormationId !== formationId) return false;
      if (bond.requiredCharacters?.some((id) => !characterIds.has(id))) return false;
      if (bond.requiredMarbles?.some((id) => !marbleIds.has(id))) return false;
      if (bond.requiredTags?.some((tag) => !tags.has(tag))) return false;
      return true;
    });
  }

function homeFacilitySceneHtml(this: any) {
    const inventory = this.inventory();
    const upgradeableMarbles = Object.values(marbleConfigs).filter((marble) => {
      const level = this.marbleLevel(marble.id);
      return level < MARBLE_MAX_LEVEL && (inventory.marbleShards[marble.id] || 0) >= marbleShardCost(level);
    }).length;
    const upgradeableProtocols = metaUpgrades.filter((item) => {
      const level = upgradeLevel(this.save.upgrades, item.id);
      return level < item.max && this.save.coins >= metaCost(item, level);
    }).length;
    const cosmeticTickets = (this.save.cosmetics.tickets.characterCosmetic || 0) + (this.save.cosmetics.tickets.marbleCosmetic || 0);
    const cosmeticOwned = Object.keys(this.save.cosmetics.owned).length;

    const entries: Array<{
      title: string;
      subtitle: string;
      target: MenuView;
      image: string;
      tone: string;
    }> = [
      {
        title: "竞技大厅",
        subtitle: `${pvpRankDisplayLabel(this.save.pvpRanks.duel)} · ${Math.floor(this.save.pvpCoins || 0)} 竞技币`,
        target: "pvp",
        image: homeAssetSources.pvpArena,
        tone: "pvp",
      },
      {
        title: "排行榜",
        subtitle: "赛季与总榜",
        target: "ranking",
        image: homeAssetSources.rankingTerminal,
        tone: "ranking",
      },
      {
        title: "编队舱",
        subtitle: "角色整备",
        target: "heroes",
        image: homeAssetSources.heroesBay,
        tone: "heroes",
      },
      {
        title: "弹珠工坊",
        subtitle: upgradeableMarbles > 0 ? `${upgradeableMarbles} 个可升级` : "强化弹珠",
        target: "marbles",
        image: homeAssetSources.marbleWorkshop,
        tone: "marbles",
      },
      {
        title: "仓储库",
        subtitle: "战利品仓储",
        target: "inventory",
        image: homeAssetSources.inventoryVault,
        tone: "inventory",
      },
      {
        title: "补给站",
        subtitle: "补给与转盘奖励",
        target: "roulette",
        image: homeAssetSources.shopStation,
        tone: "shop",
      },
      {
        title: "收藏室",
        subtitle: "系统图鉴",
        target: "collection",
        image: homeAssetSources.collectionRoom,
        tone: "collection",
      },
      {
        title: "幻化舱",
        subtitle: cosmeticTickets > 0 ? `${cosmeticTickets} 张可抽` : `${cosmeticOwned} 个外观`,
        target: "cosmetics",
        image: homeAssetSources.cosmeticChamber,
        tone: "cosmetic",
      },
      {
        title: "基地中枢",
        subtitle: upgradeableProtocols > 0 ? `${upgradeableProtocols} 项可升级` : "永久协议",
        target: "protocols",
        image: homeAssetSources.protocolCore,
        tone: "protocol",
      },
    ];

    return entries.map((entry) => this.homeFacilityEntryHtml(entry)).join("");
  }

function homeFacilityEntryHtml(this: any, entry: {
    title: string;
    subtitle: string;
    target: MenuView;
    image: string;
    tone: string;
  }) {
    return `
      <button class="facility-entry ${entry.tone}" type="button" data-menu="${entry.target}">
        <span class="facility-art">
          <img src="${entry.image}" alt="" draggable="false" />
        </span>
        <span class="facility-copy">
          <strong>${entry.title}</strong>
          <em>${entry.subtitle}</em>
        </span>
      </button>
    `;
  }

function stageRewardText(this: any, stage: StageConfig) {
    const shard = stage.rewardBias.shards?.[0];
    if (shard) return marbleConfigs[shard].name.replace("弹珠", "");
    const gem = stage.rewardBias.gems?.[0];
    if (gem) return gemConfigs[gem].name.replace("宝石", "");
    const collectible = stage.rewardBias.collectibles?.[0];
    if (collectible) return collectibleConfigs[collectible].name.slice(0, 2);
    return "金币";
  }

function stagePickerModalHtml(this: any, selectedStage: StageConfig) {
    return `
      <div class="stage-picker-modal" role="dialog" aria-label="选择关卡">
        <div class="stage-picker-panel">
          <div class="stage-picker-head">
            ${this.menuPageTitleHtml("选择关卡", `${this.save.progress.unlockedStage}/50`)}
            <button class="hero-modal-close" type="button" data-menu="home" aria-label="关闭">×</button>
          </div>
          ${this.stageSelectorHtml(selectedStage)}
        </div>
      </div>
    `;
  }

function stageSelectorHtml(this: any, selectedStage: StageConfig) {
    const chapters = Array.from(new Set(stages.map((stage) => stage.chapter)));
    const chapterStages = stages.filter((stage) => stage.chapter === selectedStage.chapter);

    return `
      <section class="stage-selector" aria-label="章节关卡">
        <div class="stage-selector-head">
          <strong>第 ${selectedStage.chapter} 章</strong>
          <span>${this.escapeText(selectedStage.theme)}</span>
        </div>
        <div class="stage-chapter-tabs">
          ${chapters
            .map((chapter) => {
              const first = stages.find((stage) => stage.chapter === chapter);
              const firstUnlocked = stages.find((stage) => stage.chapter === chapter && stage.index <= this.save.progress.unlockedStage);
              const available = Boolean(firstUnlocked);
              const target = firstUnlocked || first;
              return `
                <button
                  type="button"
                  class="${chapter === selectedStage.chapter ? "active" : ""}"
                  ${available && target ? `data-stage-select="${target.id}"` : "disabled"}
                >${chapter}</button>
              `;
            })
            .join("")}
        </div>
        <div class="stage-grid" role="list">
          ${chapterStages.map((stage) => this.stageChipHtml(stage, selectedStage.id)).join("")}
        </div>
      </section>
    `;
  }

function stageChipHtml(this: any, stage: StageConfig, selectedStageId: string) {
    const record = this.save.progress.clearedStages[stage.id];
    const locked = stage.index > this.save.progress.unlockedStage;
    const stars = record?.stars || 0;
    const classes = [
      "stage-chip",
      stage.id === selectedStageId ? "selected" : "",
      record?.cleared ? "cleared" : "",
      locked ? "locked" : "",
      stage.stage === 5 || stage.stage === 10 ? "boss" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return `
      <button
        type="button"
        class="${classes}"
        ${locked ? "disabled" : `data-stage-select="${stage.id}"`}
        title="${this.escapeText(stage.name)}"
        role="listitem"
      >
        <strong>${stage.stage}</strong>
        <span>${stars > 0 ? "★".repeat(stars) : locked ? "锁" : stage.stage === 5 || stage.stage === 10 ? "首" : ""}</span>
      </button>
    `;
  }

function canPlay(this: any) {
    return !this.accountBusy;
  }

function accountPanelHtml(this: any) {
    const account = this.backend.accountInfo;
    const statusClass = this.accountBusy ? "syncing" : account.loggedIn && account.online ? "online" : "offline";
    const title = this.accountBusy ? "同步中" : account.loggedIn ? this.escapeText(account.nickname || `用户 ${account.shortId}`) : "未登录";
    const power = this.lineupCharacters().reduce((sum, character) => sum + this.characterUiStats(character).power, 0);
    const detail = this.accountBusy ? "账号同步中" : `战力 ${power}`;
    const avatarId = this.accountAvatarCharacter(account.avatar).id;

    return `
      <div class="account-panel ${statusClass}">
        <button class="account-avatar" type="button" data-action="account-profile" style="${this.accountAvatarStyle(avatarId)}" aria-label="用户资料">
          ${this.accountAvatarImageHtml(avatarId, "account-avatar-img")}
        </button>
        <div class="account-copy">
          <strong>${title}</strong>
          <span>${detail}</span>
        </div>
        ${account.loggedIn && account.online ? "" : `<button class="account-login-button" type="button" data-action="login" ${this.accountBusy ? "disabled" : ""}>${account.loggedIn ? "重登" : "登录"}</button>`}
      </div>
    `;
  }

function accountModalHtml(this: any) {
    const account = this.backend.accountInfo;
    const displayName = account.nickname || `用户 ${account.shortId}`;
    const nickname = this.escapeText(displayName);
    const activeAvatarId = this.accountAvatarCharacter(this.profileAvatarDraft).id;
    const accountAvatarId = this.accountAvatarCharacter(account.avatar).id;
    const activeAvatar = this.accountAvatarCharacter(activeAvatarId);
    const avatarChoices = this.accountAvatarChoices();
    const profileStatus = account.online ? "云端已连接" : "本地缓存";

    return `
      <div class="account-modal" data-account-backdrop>
        <section class="account-modal-panel" aria-label="用户资料">
          <button class="hero-modal-close" type="button" data-account-action="close" aria-label="关闭">×</button>
          <div class="account-profile-head" style="${this.accountAvatarStyle(activeAvatarId)}">
            <div class="account-profile-avatar" style="${this.accountAvatarStyle(activeAvatarId)}" data-profile-avatar-preview>
              ${this.accountAvatarImageHtml(activeAvatarId, "account-profile-avatar-img")}
            </div>
            <div>
              <p class="eyebrow">资料卡</p>
              <h2>${nickname}</h2>
              <p class="subcopy">${profileStatus} · ID ${account.shortId}</p>
            </div>
          </div>

          <div class="profile-summary-card">
            <div class="profile-summary-row">
              <span>昵称</span>
              <strong>${nickname}</strong>
              <button class="small-button" type="button" data-account-action="edit-name">修改昵称</button>
            </div>
            <div class="profile-summary-row">
              <span>头像</span>
              <strong>${this.escapeText(this.accountAvatarCharacter(accountAvatarId).name)}</strong>
              <button class="small-button" type="button" data-account-action="edit-avatar">更换头像</button>
            </div>
          </div>

          ${
            this.profileEditMode === "name"
              ? `<section class="profile-edit-panel">
                  <div class="profile-edit-head">
                    <span>修改昵称</span>
                    <em>最多 12 个字符</em>
                  </div>
                  <label class="profile-field compact">
                    <span>新昵称</span>
                    <input type="text" maxlength="12" value="${nickname}" data-profile-name />
                  </label>
                  <div class="profile-edit-actions">
                    <button class="secondary-button" type="button" data-account-action="cancel-edit">取消</button>
                    <button class="primary-button" type="button" data-account-action="save" ${this.accountBusy ? "disabled" : ""}>保存昵称</button>
                  </div>
                </section>`
              : ""
          }

          ${
            this.profileEditMode === "avatar"
              ? `<section class="profile-edit-panel">
                  <div class="profile-edit-head">
                    <span>更换头像</span>
                    <em>${this.escapeText(activeAvatar.name)}</em>
                  </div>
                  <div class="profile-avatar-edit-preview" style="${this.accountAvatarStyle(activeAvatarId)}">
                    <div class="account-profile-avatar" style="${this.accountAvatarStyle(activeAvatarId)}" data-profile-avatar-preview>
                      ${this.accountAvatarImageHtml(activeAvatarId, "account-profile-avatar-img")}
                    </div>
                    <div>
                      <strong>${this.escapeText(activeAvatar.name)}</strong>
                      <span>当前选择</span>
                    </div>
                  </div>
                  <div class="avatar-choice-grid">
                    ${avatarChoices
                      .map(
                        (character) => `
                          <button
                            class="avatar-choice ${character.id === activeAvatarId ? "active" : ""}"
                            type="button"
                            data-avatar-choice="${character.id}"
                            style="${this.accountAvatarStyle(character.id)}"
                            aria-label="${this.escapeText(character.name)}"
                            title="${this.escapeText(character.name)}"
                          >
                            ${this.accountAvatarImageHtml(character.id, "avatar-choice-img")}
                          </button>
                        `,
                      )
                      .join("")}
                  </div>
                  <div class="profile-edit-actions">
                    <button class="secondary-button" type="button" data-account-action="cancel-edit">取消</button>
                    <button class="primary-button" type="button" data-account-action="save" ${this.accountBusy ? "disabled" : ""}>保存头像</button>
                  </div>
                </section>`
              : ""
          }

          ${this.accountSaveCardHtml()}

          ${
            this.profileEditMode === "summary"
              ? `<div class="account-actions">
                  <button class="secondary-button" type="button" data-account-action="switch">切换账号</button>
                  <button class="primary-button" type="button" data-account-action="close">完成</button>
                </div>`
              : ""
          }
        </section>
      </div>
    `;
  }

function accountSaveCardHtml(this: any) {
    const inventory = this.inventory();
    const itemCount =
      Object.values(inventory.collectibles).reduce((sum, amount) => sum + (amount || 0), 0) +
      Object.values(inventory.gems).reduce((sum, amount) => sum + amount, 0);

    return `
      <div class="account-save-card">
        <div class="account-save-head">
          <span>${this.saveIconHtml()}</span>
          <strong>存档</strong>
          <em>${this.backend.isOnline ? "已连接" : "本地缓存"}</em>
        </div>
        <div class="account-save-stats">
          <div><span>闯关最高</span><strong>${this.save.bestWave}/20</strong></div>
          <div><span>出战</span><strong>${this.save.runs}</strong></div>
          <div><span>无尽最高</span><strong>${this.save.bestEndlessWave || 0}</strong></div>
          <div><span>物品</span><strong>${itemCount}</strong></div>
        </div>
        <button class="secondary-button account-save-button" type="button" data-menu="inventory">查看存档</button>
      </div>
    `;
  }

function loginModalHtml(this: any) {
    return `
      <div class="account-modal login-modal" data-login-backdrop>
        <section class="account-modal-panel login-modal-panel" aria-label="账号登录">
          <button class="hero-modal-close" type="button" data-login-action="close" aria-label="关闭">×</button>
          <div class="login-title">
            <p class="eyebrow">账号登录</p>
            <h2>登录后同步存档</h2>
            <p class="subcopy">本地可直接战斗；登录用于云端同步、兑换码和账号资料。</p>
          </div>

          <label class="profile-field">
            <span>用户名</span>
            <input type="text" maxlength="20" autocomplete="username" placeholder="3-20 位英文/数字/下划线" data-login-username />
          </label>

          <label class="profile-field">
            <span>密码</span>
            <input type="password" maxlength="32" autocomplete="current-password" placeholder="6-32 位密码" data-login-password />
          </label>

          <div class="account-actions">
            <button class="secondary-button" type="button" data-login-action="register" ${this.accountBusy ? "disabled" : ""}>注册</button>
            <button class="primary-button" type="button" data-login-action="login" ${this.accountBusy ? "disabled" : ""}>登录</button>
          </div>
        </section>
      </div>
    `;
  }

function accountAvatarCharacter(this: any, id: string) {
    const mappedId = legacyAccountAvatarMap[id] || id || defaultAccountAvatarId;
    return (
      characters.find((character) => character.id === mappedId) ||
      characters.find((character) => character.id === this.save.lineup[0]) ||
      characters.find((character) => character.id === defaultAccountAvatarId) ||
      characters[0]
    );
  }

function accountAvatarChoices(this: any) {
    const owned = characters.filter((character) => this.characterProgress(character.id).owned);
    return owned.length > 0 ? owned : characters.slice(0, 1);
  }

function accountAvatarStyle(this: any, id: string) {
    const character = this.accountAvatarCharacter(id);
    return `--avatar-color: ${character.color};`;
  }

function accountAvatarImageHtml(this: any, id: string, className: string) {
    const character = this.accountAvatarCharacter(id);
    return this.characterPortraitHtml(character, className);
  }

function escapeText(this: any, value: string) {
    return value.replace(/[&<>"']/g, (char) => {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[char] as string;
    });
  }

function menuPageHtml(this: any, view: MenuView) {
    if (view === "heroes") {
      const selected = characters.find((character) => character.id === this.selectedCharacterId) || characters[0];
      if (this.loadoutConfigOpen) {
        return `
          <div class="panel main-panel menu-page hero-page hero-loadout-page">
            ${this.menuPageTitleHtml("作战方案配置", `${this.save.battleLoadouts?.length || 0}/10`)}
            ${this.loadoutConfigPageHtml()}
          </div>
        `;
      }
      return `
        <div class="panel main-panel menu-page hero-page">
          ${this.menuPageTitleHtml("角色", `金币 ${Math.floor(this.save.coins)}`)}
          ${this.heroTeamHtml()}
          ${this.heroCollectionHtml(selected.id)}
        </div>
        ${this.heroModalHtml()}
      `;
    }

    if (view === "marbles") {
      const totalShards = Object.values(this.inventory().marbleShards).reduce((sum, amount) => sum + (amount || 0), 0);
      return `
        <div class="panel main-panel menu-page marble-page">
          ${this.menuPageTitleHtml("弹珠库", `碎片 ${totalShards}`)}
          ${this.noticeHtml()}
          <div class="hero-section-title">
            <span>弹珠列表</span>
            <em>点击查看详情与强化</em>
          </div>
          ${this.marbleLibraryHtml()}
        </div>
        ${this.marbleModalHtml()}
      `;
    }

    if (view === "roulette") {
      return this.shopPageHtml();
    }

    if (view === "ranking") {
      return this.rankingPageHtml();
    }

    if (view === "pvp") {
      return this.pvpPageHtml();
    }

    if (view === "guide") {
      return `
        <div class="panel main-panel menu-page compact-menu-page">
          ${this.menuPageTitleHtml("引导")}
          <div class="guide-list">
            <article>
              <strong>组队</strong>
              <span>3 名角色同时上阵，每名角色携带 2 种弹珠。</span>
            </article>
            <article>
              <strong>升级</strong>
              <span>击败敌人获得经验，升级时从 3 张战术卡中选择 1 张。</span>
            </article>
            <article>
              <strong>撤离</strong>
              <span>第 5、10、15 波后可安全带回战利品，也可以继续深入。</span>
            </article>
          </div>
          <button class="secondary-button" type="button" data-menu="home">返回主界面</button>
        </div>
      `;
    }

    if (view === "settings") {
      return `
        <div class="panel main-panel menu-page compact-menu-page">
          ${this.menuPageTitleHtml("设置")}
          <div class="setting-list">
            ${this.settingsAudioCardHtml({
              title: "音效",
              enabled: this.sound.isEnabled,
              percent: this.sound.sfxVolumePercent,
              action: "toggleSound",
              valueId: "sfx",
              inputAttr: "data-sfx-volume",
            })}
            ${this.settingsAudioCardHtml({
              title: "背景音乐",
              enabled: this.sound.isMusicEnabled,
              percent: this.sound.musicVolumePercent,
              action: "toggleMusic",
              valueId: "music",
              inputAttr: "data-music-volume",
            })}
            ${this.settingsCosmeticEffectHtml()}
            <button class="setting-row" type="button" data-menu="guide">
              <span>游戏引导</span><strong>查看</strong>
            </button>
            <div class="setting-static-row"><span>震动</span><strong>开启</strong></div>
            <div class="setting-static-row"><span>画质</span><strong>标准</strong></div>
          </div>
          ${this.redeemCodeHtml()}
        </div>
      `;
    }

    if (view === "collection") {
      return this.collectionPageHtml();
    }

    if (view === "cosmetics") {
      return this.cosmeticPageHtml();
    }

    if (view === "protocols") {
      return `
        <div class="panel main-panel menu-page protocol-page">
          ${this.menuPageTitleHtml("基地中枢")}
          ${this.noticeHtml()}
          ${this.protocolTabsHtml()}
          <div class="protocol-tab-content">
            ${this.protocolTabContentHtml()}
          </div>
        </div>
      `;
    }

    return this.warehousePageHtml();
  }

function rankingPageHtml(this: any) {
    const state = this.leaderboardState || {};
    const activeBoard = state.catalog?.boards?.find((item: any) => item.id === this.leaderboardTab);
    const actionsDisabled = state.loading || (activeBoard && !activeBoard.enabled);
    return `
      <div class="panel main-panel menu-page leaderboard-page">
        ${this.menuPageTitleHtml("排行榜", this.leaderboardSeasonMeta(state))}
        ${this.leaderboardTabsHtml(state)}
        ${this.leaderboardMineHtml(state)}
        <div class="leaderboard-actions">
          <button class="secondary-button" type="button" data-action="refreshLeaderboard" ${actionsDisabled ? "disabled" : ""}>刷新</button>
          <button class="secondary-button" type="button" data-action="locateLeaderboardMe" ${actionsDisabled ? "disabled" : ""}>定位到我</button>
        </div>
        ${this.leaderboardBodyHtml(state)}
      </div>
    `;
  }

function leaderboardTabsHtml(this: any, state: any) {
    const boards =
      state.catalog?.boards || [
        { id: "pvp_duel_season", title: "竞技榜", enabled: true, mode: "duel", period: "season" },
        { id: "base_power_all_time", title: "基地榜", enabled: true, mode: "base", period: "all_time" },
        { id: "character_power_all_time", title: "角色榜", enabled: true, mode: "character", period: "all_time" },
        { id: "cosmetic_score_all_time", title: "幻化榜", enabled: true, mode: "cosmetic", period: "all_time" },
        { id: "campaign_progress_all_time", title: "主线榜", enabled: true, mode: "campaign", period: "all_time" },
        { id: "wealth_coins_all_time", title: "财富榜", enabled: true, mode: "wealth", period: "all_time" },
        { id: "achievement_count_all_time", title: "成就榜", enabled: true, mode: "achievement", period: "all_time" },
        { id: "endless_wave_season", title: "无尽榜", enabled: false, mode: "endless", period: "season" },
        { id: "pvp_battle_royale_season", title: "吃鸡榜", enabled: false, mode: "battle_royale", period: "season" },
      ];
    return `
      <div class="leaderboard-tabs" role="tablist" aria-label="排行榜类型">
        ${boards
          .map(
            (board: any) => `
              <button
                class="${this.leaderboardTab === board.id ? "active" : ""} ${board.enabled ? "" : "locked"} board-${this.escapeText(board.mode || "default")}"
                type="button"
                data-leaderboard-tab="${board.id}"
                role="tab"
                aria-selected="${this.leaderboardTab === board.id ? "true" : "false"}"
              >
                <i aria-hidden="true">${this.leaderboardBoardIconHtml(board)}</i>
                <span>
                  <strong>${this.escapeText(board.title)}</strong>
                  <em>${board.enabled ? this.leaderboardBoardPeriodText(board) : "未开放"}</em>
                </span>
              </button>
            `,
          )
          .join("")}
      </div>
    `;
  }

function leaderboardMineHtml(this: any, state: any) {
    const me = state.me;
    const boardId = this.leaderboardTab;
    const duelRank = this.save.pvpRanks.duel;
    const placementLeft = boardId === "pvp_duel_season" ? Math.max(0, Math.floor(duelRank.placementMatchesLeft || 0)) : 0;
    const rankText = me ? `#${me.rank}` : placementLeft > 0 ? "定级中" : "未入榜";
    const scoreText = me?.displayScore || this.localLeaderboardDisplayScore(boardId);
    const recordText = me ? this.leaderboardRecordText(me) : this.localLeaderboardRecordText(boardId);
    const deltaText = me
      ? me.rank <= 1
        ? "当前榜首"
        : `距上一名 ${Math.floor(me.deltaToPrevious || 0)} 分`
      : placementLeft > 0
        ? `还需 ${placementLeft} 场`
        : "完成对局后更新";
    return `
      <section class="leaderboard-me" aria-label="我的排名">
        <div>
          <span>我的排名</span>
          <strong>${rankText}</strong>
          <em>${deltaText}</em>
        </div>
        <div>
          <span>${this.leaderboardScoreLabel(boardId)}</span>
          <strong>${scoreText}</strong>
          <em>${recordText}</em>
        </div>
        <div>
          <span>本地摘要</span>
          <strong>${this.localLeaderboardSummaryValue(boardId)}</strong>
          <em>${this.localLeaderboardSummaryHint(boardId)}</em>
        </div>
      </section>
    `;
  }

function leaderboardBodyHtml(this: any, state: any) {
    const board = state.catalog?.boards?.find((item: any) => item.id === this.leaderboardTab);
    if (state.loading) {
      return `<div class="leaderboard-empty"><strong>同步排行榜...</strong><span>正在读取赛季榜单</span></div>`;
    }
    if (state.error) {
      return `
        <div class="leaderboard-empty warning"><strong>${this.escapeText(state.error)}</strong><span>服务器数据不可用时会保留本地统计</span></div>
        ${this.localRankingFallbackHtml()}
      `;
    }
    if (board && !board.enabled) {
      return `<div class="leaderboard-empty"><strong>${this.escapeText(board.title)}即将开放</strong><span>当前版本先开放 1v1 赛季榜</span></div>`;
    }
    if (!state.entries?.length) {
      const placementLeft = Math.max(0, Math.floor(this.save.pvpRanks.duel.placementMatchesLeft || 0));
      const isPvpBoard = this.leaderboardTab === "pvp_duel_season";
      const text = isPvpBoard && placementLeft > 0 ? "完成 5 场定级赛后进入赛季榜" : "暂无上榜玩家";
      const hint = isPvpBoard ? "参与 1v1 匹配后会自动更新排名" : "保存账号进度后会自动同步排名";
      return `<div class="leaderboard-empty"><strong>${text}</strong><span>${hint}</span></div>`;
    }
    return `
      <section class="leaderboard-list" aria-label="赛季排行榜">
        <div class="leaderboard-list-head">
          <span>排名</span>
          <span>玩家</span>
          <span>${this.leaderboardScoreLabel(this.leaderboardTab)}</span>
          <span>${this.leaderboardRecordLabel(this.leaderboardTab)}</span>
        </div>
        ${state.entries.map((entry: any) => this.leaderboardEntryHtml(entry)).join("")}
      </section>
    `;
  }

function leaderboardEntryHtml(this: any, entry: any) {
    const account = this.backend.accountInfo;
    const mine = account.userId && entry.userId === account.userId;
    const rank = Math.max(0, Math.floor(Number(entry.rank) || 0));
    const avatarId = this.accountAvatarCharacter(entry.avatar || "engineer").id;
    const podium = rank >= 1 && rank <= 3 ? `top-${rank}` : "";
    return `
      <article class="leaderboard-row ${podium} ${mine ? "mine" : ""}">
        <strong class="leaderboard-rank">#${rank}</strong>
        <div class="leaderboard-player">
          <span class="leaderboard-avatar" style="${this.accountAvatarStyle(avatarId)}">
            ${this.accountAvatarImageHtml(avatarId, "leaderboard-avatar-img")}
          </span>
          <div>
            <strong>${this.escapeText(entry.nickname || "玩家")}</strong>
            <em>${mine ? "我" : `更新 ${this.leaderboardUpdatedText(entry.updatedAt)}`}</em>
          </div>
        </div>
        <div class="leaderboard-score">
          <strong>${this.escapeText(entry.displayScore || "-")}</strong>
          <em>${Math.floor(entry.score || 0)} 分</em>
        </div>
        <div class="leaderboard-record">
          <strong>${this.leaderboardRecordText(entry)}</strong>
          <em>${this.leaderboardRecordSubText(entry)}</em>
        </div>
      </article>
    `;
  }

function localRankingFallbackHtml(this: any) {
    const stats = this.localLeaderboardFallbackStats(this.leaderboardTab);
    return `
      <div class="stat-strip ranking-stat-grid">
        ${stats.map((item: any) => `<div class="stat-box"><span>${item.label}</span><strong>${item.value}</strong></div>`).join("")}
      </div>
    `;
  }

function leaderboardRecordText(this: any, entry: any) {
    const boardId = this.leaderboardTab;
    if (boardId === "base_power_all_time") {
      return `协议 ${this.leaderboardMetric(entry, "activeProtocols")} · 宝石Lv.${this.leaderboardMetric(entry, "gemLevelSum")}`;
    }
    if (boardId === "character_power_all_time") {
      return `角色 ${this.leaderboardMetric(entry, "ownedCharacters")} · 最强 ${this.leaderboardMetric(entry, "topPower")}`;
    }
    if (boardId === "cosmetic_score_all_time") {
      return `传说 ${this.leaderboardMetric(entry, "legendary")} · 史诗 ${this.leaderboardMetric(entry, "epic")}`;
    }
    if (boardId === "campaign_progress_all_time") {
      return `通关 ${this.leaderboardMetric(entry, "clearedStages")} · 星 ${this.leaderboardMetric(entry, "totalStars")}`;
    }
    if (boardId === "wealth_coins_all_time") {
      return `持有 ${this.leaderboardMetric(entry, "currentCoins")} · 投入 ${this.leaderboardMetric(entry, "investedCoins")}`;
    }
    if (boardId === "achievement_count_all_time") {
      return `达成 ${this.leaderboardMetric(entry, "achieved")} / ${this.leaderboardMetric(entry, "total")}`;
    }
    const wins = this.leaderboardMetric(entry, "wins");
    const losses = this.leaderboardMetric(entry, "losses");
    const winRate = this.leaderboardMetric(entry, "winRate");
    return `${wins}胜 ${losses}负 · ${winRate}%`;
  }

function leaderboardRecordSubText(this: any, entry: any) {
    const boardId = this.leaderboardTab;
    if (boardId === "base_power_all_time") return `装备 ${this.leaderboardMetric(entry, "equippedGems")} 颗宝石`;
    if (boardId === "character_power_all_time") return `${this.escapeText(String(entry?.metrics?.topCharacter || "最强角色"))}`;
    if (boardId === "cosmetic_score_all_time") return `已拥有 ${this.leaderboardMetric(entry, "ownedCosmetics")} 件`;
    if (boardId === "campaign_progress_all_time") return `最高第 ${this.leaderboardMetric(entry, "highestStage")} 关`;
    if (boardId === "wealth_coins_all_time") return "累计金币财富";
    if (boardId === "achievement_count_all_time") return `总进度 ${this.leaderboardMetric(entry, "progressScore")}%`;
    return `最高 ${this.leaderboardMetric(entry, "bestWinStreak")} 连胜`;
  }

function leaderboardScoreLabel(this: any, boardId: string) {
    if (boardId === "pvp_duel_season") return "段位";
    if (boardId === "base_power_all_time") return "基地评分";
    if (boardId === "character_power_all_time") return "角色战力";
    if (boardId === "cosmetic_score_all_time") return "幻化分";
    if (boardId === "campaign_progress_all_time") return "主线进度";
    if (boardId === "wealth_coins_all_time") return "金币财富";
    if (boardId === "achievement_count_all_time") return "成就数";
    return "分数";
  }

function leaderboardRecordLabel(this: any, boardId: string) {
    if (boardId === "base_power_all_time") return "协议/宝石";
    if (boardId === "character_power_all_time") return "阵容";
    if (boardId === "cosmetic_score_all_time") return "稀有度";
    if (boardId === "campaign_progress_all_time") return "通关";
    if (boardId === "wealth_coins_all_time") return "财富构成";
    if (boardId === "achievement_count_all_time") return "完成度";
    return "战绩";
  }

function leaderboardBoardPeriodText(this: any, board: any) {
    return board?.period === "all_time" ? "总榜" : "赛季";
  }

function leaderboardBoardIconHtml(this: any, board: any) {
    const mode = String(board?.mode || "duel");
    const src = leaderboardIconSources[mode] || leaderboardIconSources.duel;
    return `<img src="${src}" alt="" draggable="false" />`;
  }

function localLeaderboardDisplayScore(this: any, boardId: string) {
    if (boardId === "base_power_all_time") return `评分 ${this.localBaseLeaderboardScore().score}`;
    if (boardId === "character_power_all_time") return `战力 ${this.localCharacterLeaderboardScore().score}`;
    if (boardId === "cosmetic_score_all_time") return `幻化 ${this.localCosmeticLeaderboardScore().score}`;
    if (boardId === "campaign_progress_all_time") return this.localCampaignLeaderboardScore().displayScore;
    if (boardId === "wealth_coins_all_time") return `金币 ${this.localWealthLeaderboardScore().score}`;
    if (boardId === "achievement_count_all_time") {
      const score = this.localAchievementLeaderboardScore();
      return `${score.score}/${score.total} 成就`;
    }
    return pvpRankDisplayLabel(this.save.pvpRanks.duel);
  }

function localLeaderboardRecordText(this: any, boardId: string) {
    if (boardId === "base_power_all_time") {
      const score = this.localBaseLeaderboardScore();
      return `协议 ${score.activeProtocols} · 宝石Lv.${score.gemLevelSum}`;
    }
    if (boardId === "character_power_all_time") {
      const score = this.localCharacterLeaderboardScore();
      return `角色 ${score.ownedCharacters} · 最强 ${score.topPower}`;
    }
    if (boardId === "cosmetic_score_all_time") {
      const score = this.localCosmeticLeaderboardScore();
      return `传说 ${score.legendary} · 史诗 ${score.epic}`;
    }
    if (boardId === "campaign_progress_all_time") {
      const score = this.localCampaignLeaderboardScore();
      return `通关 ${score.clearedStages} · 星 ${score.totalStars}`;
    }
    if (boardId === "wealth_coins_all_time") {
      const score = this.localWealthLeaderboardScore();
      return `持有 ${score.currentCoins} · 投入 ${score.investedCoins}`;
    }
    if (boardId === "achievement_count_all_time") {
      const score = this.localAchievementLeaderboardScore();
      return `达成 ${score.score} / ${score.total}`;
    }
    return pvpRankRecordText(this.save.pvpRanks.duel);
  }

function localLeaderboardSummaryValue(this: any, boardId: string) {
    if (boardId === "base_power_all_time") return `${this.localBaseLeaderboardScore().gemLevelSum} 宝石等级`;
    if (boardId === "character_power_all_time") return `${this.localCharacterLeaderboardScore().topCharacter || "角色"} ${this.localCharacterLeaderboardScore().topPower}`;
    if (boardId === "cosmetic_score_all_time") return `${this.localCosmeticLeaderboardScore().ownedCosmetics} 件`;
    if (boardId === "campaign_progress_all_time") return this.localCampaignLeaderboardScore().displayScore;
    if (boardId === "wealth_coins_all_time") return `${this.localWealthLeaderboardScore().currentCoins} 持有`;
    if (boardId === "achievement_count_all_time") return `${this.localAchievementLeaderboardScore().score} 达成`;
    return `第 ${Math.max(this.save.bestWave, this.save.bestEndlessWave || 0)} 波`;
  }

function localLeaderboardSummaryHint(this: any, boardId: string) {
    if (boardId === "base_power_all_time") return "基地强化 + 宝石";
    if (boardId === "character_power_all_time") return "总角色战力";
    if (boardId === "cosmetic_score_all_time") return "幻化总得分";
    if (boardId === "campaign_progress_all_time") return "主线推进";
    if (boardId === "wealth_coins_all_time") return "金币财富";
    if (boardId === "achievement_count_all_time") return "解锁成就";
    return `无尽 ${this.save.bestEndlessWave || 0}`;
  }

function localLeaderboardFallbackStats(this: any, boardId: string) {
    if (boardId === "base_power_all_time") {
      const score = this.localBaseLeaderboardScore();
      return [
        { label: "评分", value: score.score },
        { label: "协议", value: score.activeProtocols },
        { label: "协议等级", value: score.protocolLevelSum },
        { label: "宝石等级", value: score.gemLevelSum },
      ];
    }
    if (boardId === "character_power_all_time") {
      const score = this.localCharacterLeaderboardScore();
      return [
        { label: "总战力", value: score.score },
        { label: "角色", value: score.ownedCharacters },
        { label: "最强", value: score.topPower },
        { label: "等级", value: score.totalLevel },
      ];
    }
    if (boardId === "cosmetic_score_all_time") {
      const score = this.localCosmeticLeaderboardScore();
      return [
        { label: "幻化分", value: score.score },
        { label: "拥有", value: score.ownedCosmetics },
        { label: "传说", value: score.legendary },
        { label: "史诗", value: score.epic },
      ];
    }
    if (boardId === "campaign_progress_all_time") {
      const score = this.localCampaignLeaderboardScore();
      return [
        { label: "进度", value: score.displayScore },
        { label: "通关", value: score.clearedStages },
        { label: "星数", value: score.totalStars },
        { label: "最高关", value: score.highestStage },
      ];
    }
    if (boardId === "wealth_coins_all_time") {
      const score = this.localWealthLeaderboardScore();
      return [
        { label: "财富", value: score.score },
        { label: "持有", value: score.currentCoins },
        { label: "投入", value: score.investedCoins },
        { label: "出战", value: this.save.runs },
      ];
    }
    if (boardId === "achievement_count_all_time") {
      const score = this.localAchievementLeaderboardScore();
      return [
        { label: "达成", value: score.score },
        { label: "总数", value: score.total },
        { label: "待领", value: this.collectionPendingRewardCount?.() || 0 },
        { label: "进度", value: `${score.progressScore}%` },
      ];
    }
    const winRate = this.save.runs > 0 ? Math.round((this.save.wins / this.save.runs) * 100) : 0;
    return [
      { label: "出战", value: this.save.runs },
      { label: "通关", value: this.save.wins },
      { label: "无尽", value: this.save.bestEndlessWave || 0 },
      { label: "胜率", value: `${winRate}%` },
    ];
  }

function localBaseLeaderboardScore(this: any) {
    let protocolScore = 0;
    let protocolLevelSum = 0;
    let activeProtocols = 0;
    for (const item of metaUpgrades) {
      const level = Math.max(0, Math.floor(upgradeLevel(this.save.upgrades, item.id) || 0));
      protocolLevelSum += level;
      if (level > 0) activeProtocols += 1;
      protocolScore += level * 120 + level * level * 8;
    }
    let gemLevelSum = 0;
    let equippedGems = 0;
    for (const key of normalizeBaseGems(this.save.baseGems)) {
      const gem = key ? parseGemKey(key) : null;
      if (!gem) continue;
      equippedGems += 1;
      gemLevelSum += gem.level;
    }
    const score = Math.floor(protocolScore + gemLevelSum * 95 + equippedGems * 60);
    return { score, protocolLevelSum, activeProtocols, gemLevelSum, equippedGems };
  }

function localCharacterLeaderboardScore(this: any) {
    let score = 0;
    let topPower = 0;
    let topCharacter = "";
    let ownedCharacters = 0;
    let totalLevel = 0;
    for (const character of characters) {
      const progress = this.characterProgress(character.id);
      if (!progress.owned) continue;
      const stats = this.characterUiStats(character);
      score += stats.power;
      ownedCharacters += 1;
      totalLevel += progress.level || 1;
      if (stats.power > topPower) {
        topPower = stats.power;
        topCharacter = character.name;
      }
    }
    return { score, topPower, topCharacter, ownedCharacters, totalLevel };
  }

function localCosmeticLeaderboardScore(this: any) {
    const weights = { rare: 10, epic: 35, legendary: 120 };
    let score = 0;
    let ownedCosmetics = 0;
    let rare = 0;
    let epic = 0;
    let legendary = 0;
    for (const [id, countValue] of Object.entries(this.save.cosmetics.owned || {})) {
      const item = cosmeticConfigs[id];
      if (!item) continue;
      const count = Math.max(1, Math.floor(Number(countValue) || 1));
      score += weights[item.rarity] * count;
      ownedCosmetics += 1;
      if (item.rarity === "legendary") legendary += 1;
      else if (item.rarity === "epic") epic += 1;
      else rare += 1;
    }
    return { score, ownedCosmetics, rare, epic, legendary };
  }

function localCampaignLeaderboardScore(this: any) {
    const cleared = Object.entries(this.save.progress.clearedStages || {}).filter(([, record]: any) => record?.cleared);
    const highestStage = cleared.reduce((max: number, [stageId]: any) => {
      const stage = getStageById(stageId);
      return stage ? Math.max(max, stage.index) : max;
    }, 0);
    const progressStage = Math.max(highestStage, Math.max(0, (this.save.progress.unlockedStage || 1) - 1));
    const totalStars = Object.values(this.save.progress.clearedStages || {}).reduce((sum: number, record: any) => sum + Math.max(0, Math.floor(record?.stars || 0)), 0);
    const stage = progressStage > 0 ? getStageByIndex(progressStage) : getStageByIndex(1);
    return {
      score: Math.max(0, progressStage * 1000 + totalStars),
      displayScore: progressStage > 0 ? `主线 ${stage.chapter}-${stage.stage}` : "主线未通关",
      clearedStages: cleared.length,
      highestStage: progressStage,
      totalStars,
    };
  }

function localWealthLeaderboardScore(this: any) {
    const currentCoins = Math.max(0, Math.floor(Number(this.save.coins || 0)));
    let investedCoins = 0;
    for (const item of metaUpgrades) {
      const level = Math.max(0, Math.floor(upgradeLevel(this.save.upgrades, item.id) || 0));
      for (let current = 0; current < level; current += 1) investedCoins += metaCost(item, current);
    }
    for (const character of characters) {
      const progress = this.characterProgress(character.id);
      if (!progress.owned) continue;
      for (let level = 1; level < (progress.level || 1); level += 1) investedCoins += characterLevelCost(level);
      for (let skillLevel = 1; skillLevel < (progress.skillLevel || 1); skillLevel += 1) investedCoins += characterSkillCost(skillLevel);
      for (const route of character.routes) {
        const routeLevel = Math.max(0, Math.floor(progress.routes?.[route.id] || 0));
        for (let level = 0; level < routeLevel; level += 1) investedCoins += characterRouteCost(route, level);
      }
    }
    return { score: currentCoins + investedCoins, currentCoins, investedCoins };
  }

function localAchievementLeaderboardScore(this: any) {
    const achievements = this.collectionAchievementEntries?.() || [];
    const total = achievements.length || 0;
    const achieved = achievements.filter((entry: any) => entry.state === "known").length;
    const progressScore = total > 0 ? Math.round((achieved / total) * 100) : 0;
    return { score: achieved, total, progressScore };
  }

function leaderboardMetric(this: any, entry: any, key: string) {
    const value = Number(entry?.metrics?.[key]);
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  }

function leaderboardUpdatedText(this: any, updatedAt: number) {
    const diff = Math.max(0, Date.now() - Math.floor(Number(updatedAt) || Date.now()));
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    return `${Math.floor(hours / 24)}天前`;
  }

function leaderboardSeasonMeta(this: any, state: any) {
    const board = state.catalog?.boards?.find((item: any) => item.id === this.leaderboardTab);
    if (board?.period === "all_time") return "总榜";
    const season = state.catalog?.season;
    const serverTime = Math.floor(state.catalog?.serverTime || state.response?.serverTime || Date.now());
    if (!season?.endsAt) return "赛季榜";
    const daysLeft = Math.max(0, Math.ceil((season.endsAt - serverTime) / 86400000));
    return `赛季剩余 ${daysLeft} 天`;
  }

function settingsAudioCardHtml(this: any, options: {
    title: string;
    enabled: boolean;
    percent: number;
    action: "toggleSound" | "toggleMusic";
    valueId: "sfx" | "music";
    inputAttr: "data-sfx-volume" | "data-music-volume";
  }) {
    return `
      <section class="setting-audio-card ${options.enabled ? "enabled" : "disabled"}">
        <button class="setting-audio-toggle" type="button" data-action="${options.action}">
          <span>${options.title}</span>
          <strong>${options.enabled ? "开启" : "关闭"}</strong>
        </button>
        ${
          options.enabled
            ? `<label class="setting-slider-row setting-audio-slider">
                <div class="setting-slider-head">
                  <strong data-volume-value="${options.valueId}">${options.percent}%</strong>
                </div>
                <input type="range" min="0" max="100" step="5" value="${options.percent}" ${options.inputAttr} />
              </label>`
            : ""
        }
      </section>
    `;
  }

function settingsCosmeticEffectHtml(this: any) {
    const active = this.save.preferences.cosmeticEffectIntensity || "medium";
    const options = [
      { id: "low", label: "低" },
      { id: "medium", label: "中" },
      { id: "high", label: "高" },
    ];
    return `
      <section class="setting-cosmetic-card">
        <div class="setting-slider-head">
          <span>战斗特效强度</span>
          <strong>${options.find((item) => item.id === active)?.label || "中"}</strong>
        </div>
        <div class="setting-segment-row" aria-label="战斗特效强度">
          ${options
            .map(
              (item) => `
                <button
                  type="button"
                  class="${active === item.id ? "active" : ""}"
                  data-cosmetic-effect-intensity="${item.id}"
                >${item.label}</button>
              `,
            )
            .join("")}
        </div>
      </section>
    `;
  }

function redeemCodeHtml(this: any) {
    const disabled = !this.canPlay() || this.redeemBusy;
    const helper = this.redeemNotice || (this.backend.isLoggedIn ? "每个账号同一兑换码只能领取一次" : "登录账号后可兑换礼包");

    return `
      <section class="redeem-card">
        <div class="redeem-card-head">
          <strong>兑换码</strong>
          <span>${this.backend.isLoggedIn ? "账号礼包" : "未登录"}</span>
        </div>
        <div class="redeem-form">
          <input data-redeem-code type="text" maxlength="32" autocomplete="off" placeholder="输入兑换码" ${disabled ? "disabled" : ""} />
          <button class="small-button" type="button" data-action="redeemCode" ${disabled ? "disabled" : ""}>
            ${this.redeemBusy ? "兑换中" : "兑换"}
          </button>
        </div>
        <p class="redeem-helper">${this.escapeText(helper)}</p>
      </section>
    `;
  }

function pvpPageHtml(this: any) {
    const match = this.pvpMatchState;
    const matching = match && (match.status === "starting" || match.status === "queued");
    const canStart = this.canPlay() && !matching;
    const duelRank = this.save.pvpRanks.duel;
    const duelRankLabel = pvpRankDisplayLabel(duelRank);
    const duelFormalRankLabel = pvpRankLabel(duelRank);
    const duelProgressText = pvpRankProgressText(duelRank);
    const duelProgress = Math.round(pvpRankProgressRatio(duelRank) * 100);
    return `
      <div class="panel main-panel menu-page pvp-page">
        ${this.menuPageTitleHtml("竞技大厅", `PVP · ${duelRankLabel} · 竞技币 ${Math.floor(this.save.pvpCoins || 0)}`)}
        <section class="pvp-shop-strip">
          <div>
            <span>竞技奖励</span>
            <strong>胜利 +24 段位分 · 120+ 竞技币</strong>
          </div>
          <button class="small-button" type="button" data-menu="ranking">赛季榜</button>
          <button class="small-button" type="button" data-action="openPvpShop">竞技商店</button>
        </section>
        <section class="pvp-rank-overview" aria-label="竞技段位">
          <div>
            <span>当前段位</span>
            <strong>${duelRankLabel}</strong>
            <em>${duelFormalRankLabel}</em>
          </div>
          <div>
            <span>段位分</span>
            <strong>${duelProgressText}</strong>
            <em>${duelProgress}%</em>
          </div>
          <div>
            <span>赛季战绩</span>
            <strong>${pvpRankRecordText(duelRank)}</strong>
            <em>${pvpRankSeasonText(duelRank)}</em>
          </div>
        </section>
        <section class="pvp-mode-grid" aria-label="PVP 模式">
          ${this.pvpModeCardHtml({
            title: "1v1 匹配",
            tag: "公平竞技",
            desc: "先进入匹配队列，匹配成功后自动开战。战斗自动推进并自动选择 3 张升级卡。",
            rank: duelRankLabel,
            rankProgress: duelProgressText,
            progress: duelProgress,
            action: "startPvp",
            disabled: !canStart,
            status: matching ? "匹配中" : "可匹配",
            buttonText: matching ? "匹配中" : "开始匹配",
            rewards: ["胜利 +24分", "失败 -12分", "竞技商店"],
          })}
          ${this.pvpModeCardHtml({
            title: "吃鸡模式",
            tag: "大逃杀",
            desc: "多人同局搜打撤，击败或避开其他玩家，带着高价值战利品撤离。",
            rank: "新兵 I",
            rankProgress: "未开放",
            progress: 0,
            action: "",
            disabled: true,
            status: "开发中",
            buttonText: "即将开放",
            rewards: ["撤离徽章", "赛季补给箱", "限定称号"],
          })}
        </section>
        ${match ? this.pvpMatchPanelHtml(match) : ""}
      </div>
    `;
  }

function pvpModeCardHtml(this: any, mode: {
    title: string;
    tag: string;
    desc: string;
    rank: string;
    rankProgress?: string;
    progress?: number;
    action: string;
    disabled: boolean;
    status: string;
    buttonText?: string;
    rewards: string[];
  }) {
    const locked = mode.disabled && !mode.action;
    return `
      <article class="pvp-mode-card ${locked ? "locked" : "ready"}">
        <div class="pvp-mode-head">
          <div>
            <span>${mode.tag}</span>
            <strong>${mode.title}</strong>
          </div>
          <em>${mode.status}</em>
        </div>
        <p>${mode.desc}</p>
        <div class="pvp-rank-row">
          <div><span>当前段位</span><strong>${mode.rank}</strong></div>
          <div><span>段位分</span><strong>${mode.rankProgress || mode.rewards[0] || "赛季奖励"}</strong></div>
        </div>
        <div class="pvp-level-bar" aria-label="段位进度">
          <span style="width:${clamp(Math.floor(mode.progress || 0), 0, 100)}%"></span>
        </div>
        <div class="pvp-reward-list">
          ${mode.rewards.map((reward) => `<span>${reward}</span>`).join("")}
        </div>
        <button class="${locked ? "secondary-button" : "primary-button"} pvp-mode-action" type="button" ${
          mode.action ? `data-action="${mode.action}"` : ""
        } ${mode.disabled ? "disabled" : ""}>
          ${mode.buttonText || (locked ? "即将开放" : "开始匹配")}
        </button>
      </article>
    `;
  }

function pvpMatchPanelHtml(this: any, match: any) {
    const waitMs = Math.max(0, Number(match.waitMs) || 0);
    const timeoutMs = Math.max(1, Number(match.timeoutMs) || 5000);
    const progress = clamp(waitMs / timeoutMs, 0, 1);
    const title = match.status === "failed" ? "匹配异常" : match.status === "cancelled" ? "匹配已取消" : "1v1 匹配中";
    const status = match.status === "starting" ? "准备匹配" : match.status === "queued" ? "寻找对手" : match.status === "failed" ? "请重试" : "已取消";
    return `
      <section class="pvp-match-panel" aria-label="PVP 匹配状态">
        <div class="pvp-match-head">
          <strong>${title}</strong>
          <span>${status}</span>
        </div>
        <div class="pvp-match-progress" aria-label="匹配进度">
          <span style="width:${Math.round(progress * 100)}%"></span>
        </div>
        <div class="pvp-match-time">
          <span>匹配时间</span>
          <strong>${Math.floor(waitMs / 1000)}s</strong>
        </div>
        <p>${this.escapeText(match.message || "正在匹配对手。")}</p>
        <button class="secondary-button pvp-match-cancel" type="button" data-action="cancelPvpMatch">
          ${match.status === "failed" || match.status === "cancelled" ? "关闭" : "取消匹配"}
        </button>
      </section>
    `;
  }

function menuPageTitleHtml(this: any, title: string, meta = "") {
    return `
      <div class="menu-page-title">
        <h2>${title}</h2>
        ${meta ? `<span class="menu-page-meta">${meta}</span>` : ""}
      </div>
    `;
  }

function menuNavHtml(this: any, view: MenuView) {
    return `
      <nav class="home-nav" aria-label="主菜单">
        ${this.menuNavButton("inventory", "仓库", view)}
        ${this.menuNavButton("roulette", "商店", view)}
        ${this.menuNavButton("home", "基地", view)}
        ${this.menuNavButton("heroes", "角色", view)}
        ${this.menuNavButton("marbles", "弹珠", view)}
      </nav>
    `;
  }

function menuNavButton(this: any, target: MenuView, label: string, view: MenuView) {
    const active = target === "home" ? view === "home" || view === "challenges" || view === "stagePicker" : view === target;
    const baseClass = target === "home" ? "nav-base" : "";
    return `
      <button class="nav-${target} ${baseClass} ${active ? "active" : ""}" type="button" data-menu="${target}">
        <span class="nav-icon">${this.menuNavIconHtml(target)}</span>
        <span class="nav-label">${label}</span>
      </button>
    `;
  }

function menuNavIconHtml(this: any, target: MenuView) {
    const src = navIconSources[target];
    return src ? `<img src="${src}" alt="" draggable="false" />` : "";
  }

function homeToolButtonHtml(this: any, target: MenuView, label: string, icon: string) {
    return `
      <button class="home-tool-button" type="button" data-menu="${target}" aria-label="${label}" title="${label}">
        ${icon}
      </button>
    `;
  }

function challengeModalHtml(this: any) {
    const stage = this.currentStage();
    const canStart = this.canPlay();
    return `
      <div class="challenge-modal" role="dialog" aria-label="更多挑战">
        <div class="challenge-panel">
          ${this.menuPageTitleHtml("更多挑战")}
          <div class="challenge-summary">
            <div><span>基准关卡</span><strong>${stage.chapter}-${stage.stage}</strong></div>
            <div><span>无尽最高</span><strong>${this.save.bestEndlessWave || 0}</strong></div>
          </div>
          <div class="challenge-list">
            <button type="button" data-action="startEndless" ${canStart ? "" : "disabled"}>
              <strong>无尽挑战</strong>
              <span>第 20 波后继续推进，每 5 波可撤离，用于测试卡片构筑</span>
            </button>
            <button type="button" data-action="startTest" ${canStart ? "" : "disabled"}>
              <strong>测试模式</strong>
              <span>无限波次，无掉落收益；战斗中可随时撤离、切换角色、弹珠和战术升级</span>
            </button>
            <button type="button" data-menu="home">
              <strong>首领挑战</strong>
              <span>强化首领、限定时间、专属奖励</span>
            </button>
            <button type="button" data-menu="home">
              <strong>限时挑战</strong>
              <span>每日词缀、固定阵容、后续开放</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

function pageReturnHtml(this: any) {
    return `
      <button class="return-button page-return-button" type="button" data-menu="home" aria-label="返回">
        ${this.backIconHtml()}
      </button>
    `;
  }

function settingsIconHtml(this: any) {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z"></path>
        <path d="M19.2 13.1a7.7 7.7 0 0 0 .1-1.1 7.7 7.7 0 0 0-.1-1.1l2-1.5-1.9-3.2-2.4 1a8.4 8.4 0 0 0-1.9-1.1L14.6 3h-5.2L9 6.1a8.4 8.4 0 0 0-1.9 1.1l-2.4-1-1.9 3.2 2 1.5a7.7 7.7 0 0 0-.1 1.1 7.7 7.7 0 0 0 .1 1.1l-2 1.5 1.9 3.2 2.4-1a8.4 8.4 0 0 0 1.9 1.1l.4 3.1h5.2l.4-3.1a8.4 8.4 0 0 0 1.9-1.1l2.4 1 1.9-3.2-2-1.5Z"></path>
      </svg>
    `;
  }

function shopIconHtml(this: any) {
    return `<img class="tool-image-icon" src="${navIconSources.roulette}" alt="" draggable="false" />`;
  }

function rankIconHtml(this: any) {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 21h8"></path>
        <path d="M12 17v4"></path>
        <path d="M7 4h10v5a5 5 0 0 1-10 0Z"></path>
        <path d="M7 7H4a3 3 0 0 0 3 4"></path>
        <path d="M17 7h3a3 3 0 0 1-3 4"></path>
        <path d="M10 9.5 11.3 11 14 8"></path>
      </svg>
    `;
  }

function guideIconHtml(this: any) {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v18H7.5A2.5 2.5 0 0 0 5 22Z"></path>
        <path d="M5 4.5V22"></path>
        <path d="M9 6h6"></path>
        <path d="M9 10h5"></path>
        <path d="M9 14h4"></path>
      </svg>
    `;
  }

function saveIconHtml(this: any) {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 3h12l2 2v16H5z"></path>
        <path d="M8 3v6h8V3"></path>
        <path d="M8 15h8v6H8z"></path>
      </svg>
    `;
  }

function backIconHtml(this: any) {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15 6 9 12l6 6"></path>
        <path d="M10 12h10"></path>
      </svg>
    `;
  }

function metaUpgradeHtml(this: any, item: MetaUpgrade) {
    const level = upgradeLevel(this.save.upgrades, item.id);
    const capped = level >= item.max;
    const cost = metaCost(item, level);
    const disabled = capped || this.save.coins < cost;
    return `
      <div class="upgrade-row">
        <div>
          <strong>${item.name} Lv.${level}/${item.max}</strong>
          <p>${item.desc}</p>
        </div>
        <button class="small-button" type="button" data-buy="${item.id}" ${disabled ? "disabled" : ""}>
          ${capped ? "满级" : cost}
        </button>
      </div>
    `;
  }

function noticeHtml(this: any) {
    return this.menuNotice ? `<div class="menu-notice">${this.menuNotice}</div>` : "";
  }

function updateAudioVolumeLabel(this: any, kind: "sfx" | "music", value: number) {
    const label = this.menuScreen.querySelector<HTMLElement>(`[data-volume-value="${kind}"]`);
    if (label) label.textContent = `${value}%`;
  }

function hideScreens(this: any) {
    this.menuScreen.classList.add("hidden");
    this.upgradeScreen.classList.add("hidden");
    this.extractionScreen.classList.add("hidden");
    this.resultScreen.classList.add("hidden");
    this.pauseScreen.classList.add("hidden");
    this.lootScreen.classList.add("hidden");
    this.quickExtractionButton?.classList.add("hidden");
    this.testToolsToggle?.classList.add("hidden");
    this.testPanel?.classList.add("hidden");
  }

export const gameUiShellMethods = {
  renderMenu,
  homeMenuHtml,
  homeResourceStripHtml,
  homeBattleTerminalHtml,
  battleStartModalHtml,
  battleLoadoutStartSelectHtml,
  battleBuildPreviewHtml,
  customDeckEditorHtml,
  copyCurrentDeckToCustom,
  resetCustomTacticalDeck,
  toggleCustomDeckCard,
  activeBondPreview,
  homeFacilitySceneHtml,
  homeFacilityEntryHtml,
  stageRewardText,
  stagePickerModalHtml,
  stageSelectorHtml,
  stageChipHtml,
  canPlay,
  accountPanelHtml,
  accountModalHtml,
  accountSaveCardHtml,
  loginModalHtml,
  accountAvatarCharacter,
  accountAvatarChoices,
  accountAvatarStyle,
  accountAvatarImageHtml,
  escapeText,
  menuPageHtml,
  rankingPageHtml,
  leaderboardTabsHtml,
  leaderboardMineHtml,
  leaderboardBodyHtml,
  leaderboardEntryHtml,
  localRankingFallbackHtml,
  leaderboardRecordText,
  leaderboardRecordSubText,
  leaderboardScoreLabel,
  leaderboardRecordLabel,
  leaderboardBoardPeriodText,
  leaderboardBoardIconHtml,
  localLeaderboardDisplayScore,
  localLeaderboardRecordText,
  localLeaderboardSummaryValue,
  localLeaderboardSummaryHint,
  localLeaderboardFallbackStats,
  localBaseLeaderboardScore,
  localCharacterLeaderboardScore,
  localCosmeticLeaderboardScore,
  localCampaignLeaderboardScore,
  localWealthLeaderboardScore,
  localAchievementLeaderboardScore,
  leaderboardMetric,
  leaderboardUpdatedText,
  leaderboardSeasonMeta,
  settingsAudioCardHtml,
  settingsCosmeticEffectHtml,
  redeemCodeHtml,
  pvpPageHtml,
  pvpModeCardHtml,
  pvpMatchPanelHtml,
  menuPageTitleHtml,
  menuNavHtml,
  menuNavButton,
  menuNavIconHtml,
  homeToolButtonHtml,
  challengeModalHtml,
  pageReturnHtml,
  settingsIconHtml,
  shopIconHtml,
  rankIconHtml,
  guideIconHtml,
  saveIconHtml,
  backIconHtml,
  metaUpgradeHtml,
  noticeHtml,
  updateAudioVolumeLabel,
  hideScreens,
} satisfies Record<string, GameMethod>;
