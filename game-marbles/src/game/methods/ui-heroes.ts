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
  cosmeticById,
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

function characterPortraitHtml(this: any, character: CharacterConfig, className: string) {
    const src = characterPortraitSources[character.id];
    const visual = this.characterVisualConfig?.(character.id);
    const cosmetic = visual?.cosmetic;
    if (!src) return `<span class="${className}">${this.escapeText(character.name.slice(0, 1))}</span>`;
    if (cosmetic) {
      return `
        <span
          class="${className} character-cosmetic-portrait ${cosmetic.rarity}"
          style="--cosmetic-color: ${cosmetic.color}; --cosmetic-accent: ${cosmetic.accentColor}"
          title="${this.escapeText(cosmetic.name)}"
        >
          <img class="character-cosmetic-image" src="${src}" alt="${this.escapeText(character.name)}">
          <em>${this.escapeText(cosmetic.visualLabel || "幻")}</em>
        </span>
      `;
    }
    return `<img class="${className}" src="${src}" alt="${this.escapeText(character.name)}">`;
  }

function characterUnlockText(this: any, character: CharacterConfig) {
    return character.unlock?.desc || "初始角色";
  }

function characterCardHtml(this: any, character: CharacterConfig) {
    const stats = this.characterUiStats(character);
    return `
      <article class="hero-card" style="--hero-color: ${character.color}" data-hero-select="${character.id}">
        <div class="hero-emblem">${this.characterPortraitHtml(character, "hero-card-portrait")}</div>
        <div class="hero-copy">
          <div>
            <h2>${character.name}</h2>
            <strong>Lv.${stats.level}</strong>
          </div>
          <p>${character.role}</p>
          <div class="hero-stats">
            <span class="hero-power-stat">战力 ${stats.power}</span>
          </div>
        </div>
      </article>
    `;
  }

function sortedHeroCharacters(this: any) {
    return characters
      .map((character, index) => ({
        character,
        index,
        progress: this.characterProgress(character.id),
        stats: this.characterUiStats(character),
        teamSlot: this.save.lineup.indexOf(character.id),
      }))
      .sort((a, b) => {
        const deployed = Number(b.teamSlot >= 0) - Number(a.teamSlot >= 0);
        if (deployed !== 0) return deployed;

        const sortValue = this.characterSortValue(b.character, b.stats) - this.characterSortValue(a.character, a.stats);
        if (sortValue !== 0) return sortValue;

        const owned = Number(b.progress.owned) - Number(a.progress.owned);
        if (owned !== 0) return owned;

        const power = b.stats.power - a.stats.power;
        if (power !== 0) return power;

        return a.index - b.index;
      })
      .map((entry) => entry.character);
  }

function characterSortValue(this: any, 
    character: CharacterConfig,
    stats = this.characterUiStats(character),
    mode: CharacterSortMode = this.characterSortMode,
  ) {
    if (mode === "level") return stats.level;
    if (mode === "rarity") return rarityAutoScore(character.rarity);
    if (mode === "attack") return stats.attack;
    return stats.power;
  }

function heroSortButtonHtml(this: any, mode: CharacterSortMode) {
    return `
      <button
        class="${this.characterSortMode === mode ? "active" : ""}"
        type="button"
        data-hero-sort="${mode}"
      >${characterSortLabels[mode]}</button>
    `;
  }

function heroListMetricText(this: any, character: CharacterConfig, stats = this.characterUiStats(character)) {
    if (this.characterSortMode === "level") return `等级 Lv.${stats.level}`;
    if (this.characterSortMode === "rarity") return `稀有度 ${rarityName(character.rarity)}`;
    if (this.characterSortMode === "attack") return `攻击 ${stats.attack}`;
    return `战力 ${stats.power}`;
  }

function heroCollectionHtml(this: any, selectedId: string) {
    return `
      <div class="hero-section-title hero-list-head">
        <span>角色列表</span>
        <div class="hero-sort-tabs" aria-label="角色排序">
          ${characterSortModes.map((mode) => this.heroSortButtonHtml(mode)).join("")}
        </div>
      </div>
      <div class="hero-collection" aria-label="角色列表">
        ${this.sortedHeroCharacters()
          .map((character) => {
            const progress = this.characterProgress(character.id);
            const stats = this.characterUiStats(character);
            const teamSlot = this.save.lineup.indexOf(character.id);
            return `
              <button
                class="hero-list-card ${selectedId === character.id ? "active" : ""} ${teamSlot >= 0 ? "deployed" : ""} ${progress.owned ? "" : "locked"}"
                type="button"
                data-hero-select="${character.id}"
                style="--hero-color: ${character.color}"
              >
                <span class="hero-list-icon">${this.characterPortraitHtml(character, "hero-list-portrait")}</span>
                <span class="hero-list-copy">
                  <strong>${character.name}</strong>
                  <em>${progress.owned ? `${rarityName(character.rarity)} · ${character.role}` : `${rarityName(character.rarity)} · ${this.characterUnlockText(character)}`}</em>
                  <i>${this.heroListMetricText(character, stats)}</i>
                </span>
                ${progress.owned ? "" : `<small class="hero-lock-badge">锁</small>`}
                ${teamSlot >= 0 ? `<b>${teamSlot + 1}</b>` : ""}
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

function heroTeamHtml(this: any) {
    this.save.lineup = normalizeLineup(this.save.lineup, this.save.characters);
    return `
      <div class="hero-team">
        <div class="hero-section-title">
          <span>出战阵容</span>
          <em>${this.save.lineup.length}/3</em>
        </div>
        <div class="hero-team-grid">
          ${[0, 1, 2]
            .map((index) => {
              const id = this.save.lineup[index];
              const character = id ? characters.find((item) => item.id === id) : null;
              if (!character) {
                return `
                  <div class="hero-team-slot empty">
                    <span>位 ${index + 1}</span>
                    <strong>空位</strong>
                    <em>从下方角色列表上阵</em>
                  </div>
                `;
              }
              const stats = this.characterUiStats(character);
              return `
                <button
                  class="hero-team-slot"
                  type="button"
                  data-hero-select="${character.id}"
                  style="--hero-color: ${character.color}"
                >
                  ${this.characterPortraitHtml(character, "hero-team-portrait")}
                  <span class="hero-team-copy">
                    <span>位 ${index + 1}</span>
                    <strong>${character.name}</strong>
                    <em>Lv.${stats.level} · ${character.role}</em>
                  </span>
                </button>
              `;
            })
            .join("")}
        </div>
      </div>
    `;
  }

function heroModalHtml(this: any) {
    if (!this.heroModalCharacterId) return "";
    const character = characters.find((item) => item.id === this.heroModalCharacterId);
    if (!character) return "";

    return `
      <div class="hero-modal" role="dialog" aria-label="角色属性">
        <div class="hero-modal-panel">
          <button class="hero-modal-close" type="button" data-hero-modal-close aria-label="关闭">×</button>
          ${this.heroDetailHtml(character)}
        </div>
      </div>
    `;
  }

function heroDetailHtml(this: any, character: CharacterConfig) {
    const progress = this.characterProgress(character.id);
    const teamSlot = this.save.lineup.indexOf(character.id);
    const canDeploy = progress.owned && teamSlot < 0 && this.save.lineup.length < 3;
    const canReplace = progress.owned && teamSlot < 0 && this.save.lineup.length >= 3;

    return `
      <section class="hero-detail" style="--hero-color: ${character.color}">
        <div class="hero-detail-head">
          <div class="hero-detail-icon">${this.characterPortraitHtml(character, "hero-detail-portrait")}</div>
          <div class="hero-detail-title">
            <h3>${character.name}</h3>
            <span>${progress.owned ? "已获取" : this.characterUnlockText(character)} · ${character.role} · ${character.skillName}</span>
          </div>
          ${this.heroHeaderActionHtml(character, teamSlot, canDeploy, canReplace)}
        </div>

        ${this.heroDetailTabsHtml()}
        <div class="hero-detail-tab-panel">
          ${this.heroDetailTabContentHtml(character, teamSlot)}
        </div>
      </section>
    `;
  }

function heroDetailTabsHtml(this: any) {
    const tabs: Array<{ id: HeroDetailTab; label: string }> = [
      { id: "overview", label: "基础" },
      { id: "skills", label: "技能" },
      { id: "marbles", label: "弹珠" },
      { id: "routes", label: "路线" },
      { id: "cosmetics", label: "幻化" },
    ];

    return `
      <div class="hero-detail-tabs" role="tablist" aria-label="角色详情分类">
        ${tabs
          .map(
            (tab) => `
              <button
                type="button"
                class="${this.heroDetailTab === tab.id ? "active" : ""}"
                data-hero-detail-tab="${tab.id}"
                role="tab"
                aria-selected="${this.heroDetailTab === tab.id ? "true" : "false"}"
              >
                ${tab.label}
              </button>
            `,
          )
          .join("")}
      </div>
    `;
  }

function heroDetailTabContentHtml(this: any, character: CharacterConfig, teamSlot: number) {
    const progress = this.characterProgress(character.id);
    if (this.heroDetailTab === "skills") return `${this.heroSkillHtml(character, progress.owned)}${this.heroPassiveHtml(character)}`;
    if (this.heroDetailTab === "marbles") return this.heroMarbleLoadoutHtml(character, progress.owned);
    if (this.heroDetailTab === "routes") return this.heroRoutesHtml(character);
    if (this.heroDetailTab === "cosmetics") return this.heroCosmeticsHtml(character, progress.owned);
    return this.heroOverviewHtml(character, teamSlot);
  }

function heroCosmeticsHtml(this: any, character: CharacterConfig, owned: boolean) {
    const items = cosmeticsForPool("character").filter((item) => item.targetId === character.id);
    const equipped = this.equippedCharacterCosmetic(character.id);
    return `
      <div class="hero-route-title hero-cosmetic-title">
        <span>角色幻化</span>
        <em>${equipped ? `当前 ${equipped.name}` : "只改变外观表现"}</em>
      </div>
      <div class="hero-cosmetic-grid">
        ${items
          .map((item) => {
            const hasItem = Boolean(this.save.cosmetics.owned[item.id]);
            const isEquipped = this.save.cosmetics.equippedCharacters[character.id] === item.id;
            return `
              <article class="hero-cosmetic-card ${item.rarity} ${hasItem ? "owned" : "locked"} ${isEquipped ? "equipped" : ""}" style="--cosmetic-color: ${item.color}; --cosmetic-accent: ${item.accentColor}">
                ${this.cosmeticIconHtml(item)}
                <div>
                  <span>${this.cosmeticRarityName(item.rarity)} · ${this.escapeText(item.theme || "常驻")}</span>
                  <strong>${this.escapeText(item.name)}</strong>
                  <p>${this.escapeText(item.desc)}</p>
                </div>
                <button class="small-button" type="button" data-cosmetic-equip="${item.id}" ${owned && hasItem && !isEquipped ? "" : "disabled"}>
                  ${isEquipped ? "已装备" : hasItem ? "装备" : "未获得"}
                </button>
              </article>
            `;
          })
          .join("")}
      </div>
      <button class="secondary-button" type="button" data-menu="cosmetics">去幻化舱</button>
    `;
  }

function heroOverviewHtml(this: any, character: CharacterConfig, teamSlot: number) {
    const progress = this.characterProgress(character.id);
    const stats = this.characterUiStats(character);
    const levelCapped = progress.level >= HERO_MAX_LEVEL;
    const levelCost = characterLevelCost(progress.level);
    const levelDisabled = !progress.owned || levelCapped || this.save.coins < levelCost;

    return `
      <div class="hero-detail-stats">
        <div><span>等级</span><strong>Lv.${stats.level}</strong></div>
        <div><span>攻击</span><strong>${stats.attack}</strong></div>
        <div><span>射速</span><strong>${stats.speed}%</strong></div>
        <div><span>冷却</span><strong>${stats.skill}%</strong></div>
      </div>
      <div class="hero-overview-box">
        <span>定位</span>
        <strong>${character.role}</strong>
        <p>${character.skillName} · ${character.skillDesc}</p>
      </div>
      ${progress.owned ? "" : `<div class="hero-unlock-box"><strong>解锁条件</strong><span>${this.characterUnlockText(character)}</span></div>`}
      <button class="hero-level-button" type="button" data-hero-level="${character.id}" ${levelDisabled ? "disabled" : ""}>
        ${!progress.owned ? "未解锁不可强化" : levelCapped ? "角色满级" : `强化角色 ${levelCost}`}
      </button>
      ${teamSlot >= 0 ? `<div class="hero-overview-status">当前位于出战阵容第 ${teamSlot + 1} 位</div>` : ""}
    `;
  }

function heroRoutesHtml(this: any, character: CharacterConfig) {
    return `
      <div class="hero-route-title hero-route-tab-title">
        <span>专属路线</span>
        <em>每名角色路线不同</em>
      </div>
      <div class="hero-route-grid">
        ${character.routes.map((route) => this.heroRouteHtml(character, route)).join("")}
      </div>
    `;
  }

function heroSkillHtml(this: any, character: CharacterConfig, owned: boolean) {
    const skillLevel = this.characterSkillLevel(character.id);
    const capped = skillLevel >= CHARACTER_SKILL_MAX_LEVEL;
    const cost = characterSkillCost(skillLevel);
    const disabled = !owned || capped || this.save.coins < cost;

    return `
      <div class="hero-skill-box hero-active-skill">
        <div class="hero-skill-head">
          <strong>${character.skillName}</strong>
          <em>Lv.${skillLevel}/${CHARACTER_SKILL_MAX_LEVEL}</em>
        </div>
        <span>${character.skillDesc}</span>
        <small>${this.heroSkillLevelText(character)}</small>
        <button class="hero-skill-button" type="button" data-hero-skill-level="${character.id}" ${disabled ? "disabled" : ""}>
          ${!owned ? "未解锁" : capped ? "技能满级" : `升级技能 ${cost}`}
        </button>
      </div>
    `;
  }

function heroSkillLevelText(this: any, character: CharacterConfig) {
    const text: Record<string, string> = {
      engineer: "升级提高折返板持续时间，并略微缩短冷却。",
      bomber: "升级提高高爆弹伤害与爆炸范围，并略微缩短冷却。",
      magnetist: "升级延长磁场持续时间，并略微缩短冷却。",
      sentinel: "升级提高修复量和压制强度，并略微缩短冷却。",
      prism: "升级增加齐射弹珠数量和持续时间，并略微缩短冷却。",
      alchemist: "升级提高热核伤害、范围和金币回收，并略微缩短冷却。",
      frostseer: "升级提高冰环范围、伤害和冻结效果，并略微缩短冷却。",
      voidbinder: "升级提高坍缩范围和伤害，并略微缩短冷却。",
      treasurer: "升级提高点金弹雨数量和金币收益，并略微缩短冷却。",
    };
    return text[character.id] || "升级强化主动技能，并略微缩短冷却。";
  }

function heroPassiveHtml(this: any, character: CharacterConfig) {
    const progress = this.characterProgress(character.id);
    return `
      <div class="hero-passive-panel">
        <div class="hero-route-title hero-passive-title">
          <span>被动技能</span>
          <em>随角色等级解锁</em>
        </div>
        <div class="hero-passive-grid">
          ${character.passives
            .map((passive) => {
              const unlocked = progress.level >= passive.unlockLevel;
              return `
                <article class="hero-passive-card ${unlocked ? "active" : "locked"}">
                  <div>
                    <span>Lv.${passive.unlockLevel}</span>
                    <strong>${passive.name}</strong>
                  </div>
                  <p>${unlocked ? passive.desc : `角色 Lv.${passive.unlockLevel} 解锁`}</p>
                </article>
              `;
            })
            .join("")}
        </div>
      </div>
    `;
  }

function heroMarbleLoadoutHtml(this: any, character: CharacterConfig, owned: boolean) {
    const loadout = this.characterMarbles(character);
    const activeSlot = clamp(Math.floor(this.heroMarbleSlot), 0, 1);
    const current = loadout[activeSlot];
    const recommended = new Set(character.marbles);
    const options = Object.values(marbleConfigs);
    const currentConfig = marbleConfigs[current];

    return `
      <div class="hero-route-title hero-marble-title">
        <span>弹珠装配</span>
        <em>${this.heroMarblePickerOpen ? `选择槽位 ${activeSlot + 1}` : "当前配置"}</em>
      </div>
      <div class="hero-marble-loadout" aria-label="角色弹珠装配">
        <div class="hero-marble-slots">
          ${loadout
            .map((id, index) => {
              const config = marbleConfigs[id];
              return `
                <button
                  class="hero-marble-slot ${index === activeSlot ? "active" : ""}"
                  type="button"
                  data-hero-marble-slot="${index}"
                  style="--marble-color: ${config.color}"
                  ${owned ? "" : "disabled"}
                >
                  <span>槽位 ${index + 1}</span>
                  <strong><i></i>${config.name}</strong>
                  <em>Lv.${this.marbleLevel(id)} · ${config.tags.map((tag) => this.marbleTagLabel(tag)).join("/")}</em>
                  <b>${owned ? "更换" : "锁定"}</b>
                </button>
              `;
            })
            .join("")}
        </div>
        ${
          this.heroMarblePickerOpen && owned
            ? `
              <div class="hero-marble-picker" style="--marble-color: ${currentConfig.color}">
                <div class="hero-marble-picker-head">
                  <div>
                    <span>槽位 ${activeSlot + 1}</span>
                    <strong><i></i>${currentConfig.name}</strong>
                  </div>
                  <button type="button" data-hero-marble-picker-close>收起</button>
                </div>
                <div class="hero-marble-picker-list">
                  ${options
                    .map((config) => {
                      const equippedIndex = loadout.indexOf(config.id);
                      const duplicate = equippedIndex >= 0 && equippedIndex !== activeSlot;
                      const selected = current === config.id;
                      return `
                        <button
                          class="hero-marble-picker-row ${selected ? "active" : ""}"
                          type="button"
                          data-hero-id="${character.id}"
                          data-hero-marble-equip="${config.id}"
                          style="--marble-color: ${config.color}"
                          ${duplicate ? "disabled" : ""}
                        >
                          <i></i>
                          <span>
                            <strong>${config.name}</strong>
                            <small>Lv.${this.marbleLevel(config.id)} · 伤害 ${Math.round(config.damage * this.marbleDamageLevelMul(config.id) * 10) / 10} · ${config.tags.map((tag) => this.marbleTagLabel(tag)).join("/")}</small>
                          </span>
                          <em>${selected ? "已装备" : duplicate ? "已占用" : recommended.has(config.id) ? "推荐" : "可用"}</em>
                        </button>
                      `;
                    })
                    .join("")}
                </div>
              </div>
            `
            : ""
        }
      </div>
    `;
  }

function marbleTagLabel(this: any, tag: string) {
    const labels: Record<string, string> = {
      physical: "物理",
      multi: "多弹",
      explosive: "爆破",
      elemental: "元素",
      chain: "连锁",
      control: "控制",
    };
    return labels[tag] || tag;
  }

function heroHeaderActionHtml(this: any, character: CharacterConfig, teamSlot: number, canDeploy: boolean, canReplace: boolean) {
    if (teamSlot >= 0) {
      return `
        <div class="hero-title-control deployed">
          <div class="hero-title-deployed-row">
            <div class="hero-title-rank" aria-label="出战位置">
              <span>${teamSlot + 1}</span>
            </div>
            <button class="hero-title-action small ${this.heroLineupPickerOpen ? "active" : ""}" type="button" data-hero-lineup-picker="${character.id}">
              调整
            </button>
          </div>
          ${this.heroLineupPickerOpen ? this.heroLineupSlotPickerHtml(character) : ""}
        </div>
      `;
    }

    if (canDeploy || canReplace) {
      return `
        <div class="hero-title-control">
          <button class="hero-title-action ${this.heroLineupPickerOpen ? "active" : ""}" type="button" data-hero-lineup-picker="${character.id}">
            ${canDeploy ? "上阵" : "替换"}
          </button>
          ${this.heroLineupPickerOpen ? this.heroLineupSlotPickerHtml(character) : ""}
        </div>
      `;
    }

    return `
      <button class="hero-title-action" type="button" disabled>
        未解锁
      </button>
    `;
  }

function heroLineupSlotPickerHtml(this: any, character: CharacterConfig) {
    this.save.lineup = normalizeLineup(this.save.lineup, this.save.characters);
    const currentSlot = this.save.lineup.indexOf(character.id);
    const deployed = currentSlot >= 0;
    return `
      <div class="hero-lineup-mini ${deployed ? "with-remove" : ""}" aria-label="选择出战位置">
        ${
          deployed
            ? `
              <button
                class="remove"
                type="button"
                data-hero-lineup-remove="${character.id}"
                ${this.save.lineup.length <= 1 ? "disabled" : ""}
                aria-label="下阵 ${character.name}"
              >
                下
              </button>
            `
            : ""
        }
        ${[0, 1, 2]
          .map((slot) => {
            const currentId = this.save.lineup[slot];
            const disabled = deployed ? slot >= this.save.lineup.length : slot > this.save.lineup.length;
            const current = currentId ? characters.find((item) => item.id === currentId) : null;
            return `
              <button
                class="${currentSlot === slot ? "active" : ""}"
                type="button"
                data-hero-id="${character.id}"
                data-hero-lineup-slot="${slot}"
                ${disabled ? "disabled" : ""}
                aria-label="${
                  currentSlot === slot
                    ? `保持第 ${slot + 1} 位`
                    : current
                      ? `${deployed ? "调整到" : "替换"}第 ${slot + 1} 位 ${current.name}`
                      : `上阵到第 ${slot + 1} 位`
                }"
              >
                ${slot + 1}
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

function heroRouteHtml(this: any, character: CharacterConfig, route: CharacterRoute) {
    const progress = this.characterProgress(character.id);
    const level = progress.routes[route.id] || 0;
    const capped = level >= route.max;
    const cost = characterRouteCost(route, level);
    const disabled = !progress.owned || capped || this.save.coins < cost;
    const fill = Math.round((level / route.max) * 100);

    return `
      <article class="hero-route-card">
        <div class="hero-route-card-head">
          <span>${route.focus}</span>
          <strong>Lv.${level}/${route.max}</strong>
        </div>
        <h3>${route.name}</h3>
        <p>${route.desc}</p>
        <div class="hero-route-progress"><span style="width: ${fill}%"></span></div>
        <button
          type="button"
          data-hero-id="${character.id}"
          data-hero-route="${route.id}"
          ${disabled ? "disabled" : ""}
        >
          ${capped ? "满级" : cost}
        </button>
      </article>
    `;
  }

export const gameHeroUiMethods = {
  characterPortraitHtml,
  characterUnlockText,
  characterCardHtml,
  sortedHeroCharacters,
  characterSortValue,
  heroSortButtonHtml,
  heroListMetricText,
  heroCollectionHtml,
  heroTeamHtml,
  heroModalHtml,
  heroDetailHtml,
  heroDetailTabsHtml,
  heroDetailTabContentHtml,
  heroCosmeticsHtml,
  heroOverviewHtml,
  heroRoutesHtml,
  heroSkillHtml,
  heroSkillLevelText,
  heroPassiveHtml,
  heroMarbleLoadoutHtml,
  marbleTagLabel,
  heroHeaderActionHtml,
  heroLineupSlotPickerHtml,
  heroRouteHtml,
} satisfies Record<string, GameMethod>;
