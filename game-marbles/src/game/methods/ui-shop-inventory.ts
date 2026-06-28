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
  pvpRankDisplayLabel,
  pvpRankLabel,
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

function shopPageHtml(this: any) {
    this.shop();
    const inventory = this.inventory();
    const shardCount = Object.values(inventory.marbleShards).reduce((sum, amount) => sum + (amount || 0), 0);
    const freeLeft = shopItemsForCategory(this.save, "daily").reduce((sum, item) => sum + shopStockLeft(this.save, item), 0);
    const currentCategory = shopCategories.some((category) => category.id === this.shopTab) ? this.shopTab : "recommended";
    this.shopTab = currentCategory;

    return `
      <div class="panel main-panel menu-page shop-page">
        ${this.menuPageTitleHtml(
          "补给商场",
          `金币 ${Math.floor(this.save.coins)} · 竞技币 ${Math.floor(this.save.pvpCoins || 0)} · 晶体 ${Math.floor(this.save.energyCrystals)}`,
        )}
        ${this.noticeHtml()}

        <section class="shop-summary">
          <div>
            <span>今日补给</span>
            <strong>${freeLeft > 0 ? "可领取" : "已领取"}</strong>
          </div>
          <div>
            <span>碎片</span>
            <strong>${shardCount}</strong>
          </div>
          <div>
            <span>能源晶体</span>
            <strong>${Math.floor(this.save.energyCrystals)}</strong>
          </div>
          <div>
            <span>竞技币</span>
            <strong>${Math.floor(this.save.pvpCoins || 0)}</strong>
          </div>
        </section>

        ${this.shopCrystalRedeemHintHtml()}
        ${this.shopTabsHtml(currentCategory)}

        <div class="shop-tab-content">
          ${this.shopTabContentHtml(currentCategory)}
        </div>
      </div>
    `;
  }

function shopTabsHtml(this: any, active: ShopCategory) {
    return `
      <div class="shop-tabs" role="tablist" aria-label="补给分类">
        ${shopCategories
          .map((category) => {
            const count = shopItemsForCategory(this.save, category.id).reduce((sum, item) => sum + shopStockLeft(this.save, item), 0);
            return `
              <button
                class="shop-tab ${active === category.id ? "active" : ""}"
                type="button"
                data-shop-tab="${category.id}"
                role="tab"
                aria-selected="${active === category.id ? "true" : "false"}"
              >
                <span>
                  <strong>${category.label}</strong>
                  <em>${category.hint}</em>
                </span>
                <b>${count}</b>
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

function shopTabContentHtml(this: any, category: ShopCategory) {
    const items = shopItemsForCategory(this.save, category);
    const title = {
      recommended: "今日推荐",
      daily: "日常补给",
      growth: "成长材料",
      arena: "竞技商店",
      crystal: "晶体商店",
      bundles: "限购礼包",
    }[category];
    const hint = {
      recommended: "可领取、缺口补齐和高级精选",
      daily: "金币补给与每日免费资源",
      growth: `金币购买碎片与宝石 · 刷新 ${shopRefreshLeft(this.save)}/3`,
      arena: `PVP 对战获得竞技币 · 当前 ${pvpRankDisplayLabel(this.save.pvpRanks.duel)}`,
      crystal: "角色授权和搜打撤道具",
      bundles: "一次性与周限购整备",
    }[category];

    return `
      <section class="shop-section">
        <div class="shop-section-head">
          <div>
            <span>${title}</span>
            <em>${hint}</em>
          </div>
          ${
            category === "growth"
              ? `<button class="small-button shop-refresh-button" type="button" data-shop-refresh-shards ${shopRefreshLeft(this.save) <= 0 ? "disabled" : ""}>
                  刷新 ${shopRefreshCost(this.save)} 晶体
                </button>`
              : ""
          }
        </div>
        <div class="shop-grid ${category}">
          ${items.map((item) => this.shopItemCardHtml(item)).join("")}
        </div>
      </section>
    `;
  }

function shopItemCardHtml(this: any, item: ShopItemConfig) {
    const color = shopItemColor(item);
    const price = shopItemPrice(this.save, item);
    const stockLeft = shopStockLeft(this.save, item);
    const reason = shopItemDisabledReason(this.save, item);
    const disabled = Boolean(reason);
    const buttonText = stockLeft <= 0 ? "已售罄" : reason ? reason : shopPriceText(price);
    const stateText = stockLeft <= 0 ? "售罄" : price.amount <= 0 ? "免费" : `库存 ${stockLeft}/${item.stock}`;

    return `
      <article class="shop-card ${disabled ? "disabled" : ""} ${price.currency === "energyCrystals" && price.amount > 0 ? "premium" : ""}" style="--shop-color: ${color}">
        <div class="shop-card-head">
          <span class="shop-item-icon">${this.shopItemIconText(item)}</span>
          <div>
            <strong>${this.escapeText(item.name)}</strong>
            <em>${this.escapeText(item.desc)}</em>
          </div>
          <b>${shopItemBadge(item)}</b>
        </div>
        <p>${shopRewardSummary(item.rewards)}</p>
        <div class="shop-card-foot">
          <span>${reason && stockLeft > 0 ? reason : stateText}</span>
          <button class="small-button" type="button" data-shop-buy="${item.id}" ${disabled ? "disabled" : ""}>
            ${buttonText}
          </button>
        </div>
      </article>
    `;
  }

function shopItemIconText(this: any, item: ShopItemConfig) {
    const reward = item.rewards[0];
    if (!reward) return "补";
    if (reward.type === "coins") return "金";
    if (reward.type === "pvpCoins") return "竞";
    if (reward.type === "energyCrystals") return "晶";
    if (reward.type === "gem") return "宝";
    if (reward.type === "marbleShard" || reward.type === "randomMarbleShard") return "弹";
    if (reward.type === "characterUnlock") return "角";
    if (reward.type === "ticket") return "券";
    return "物";
  }

function shopCrystalRedeemHintHtml(this: any) {
    return `
      <section class="shop-redeem-strip">
        <div>
          <span>能源晶体</span>
          <strong>通过兑换码发放，只用于角色授权、保险券和高级礼包</strong>
        </div>
        <button class="small-button" type="button" data-menu="settings">兑换码</button>
      </section>
    `;
  }

function marbleUpgradeCardHtml(this: any, marble: MarbleConfig) {
    const level = this.marbleLevel(marble.id);
    const capped = level >= MARBLE_MAX_LEVEL;
    const cost = marbleShardCost(level);
    const shards = this.inventory().marbleShards[marble.id] || 0;
    const disabled = capped || shards < cost;
    const damage = Math.round(marble.damage * this.marbleDamageLevelMul(marble.id) * 10) / 10;
    const nextDamage = capped ? damage : Math.round(marble.damage * (1 + level * 0.045) * 10) / 10;

    return `
      <article class="marble-card" style="--marble-color: ${marble.color}">
        <div class="marble-card-head">
          <i></i>
          <div>
            <strong>${marble.name}</strong>
            <span>Lv.${level}/${MARBLE_MAX_LEVEL}</span>
          </div>
        </div>
        <p>伤害 ${damage}${capped ? "" : ` → ${nextDamage}`} · 冷却 ${marble.cooldown.toFixed(2)}s · 反弹 ${marble.maxBounce}</p>
        <div class="marble-card-foot">
          <span>碎片 ${shards}/${capped ? "-" : cost}</span>
          <button class="small-button" type="button" data-marble-upgrade="${marble.id}" ${disabled ? "disabled" : ""}>
            ${capped ? "满级" : "升级"}
          </button>
        </div>
      </article>
    `;
  }

function warehouseResourceStripHtml(this: any) {
    return `
      <div class="warehouse-resource-strip" aria-label="资源状态">
        <div><span>金币</span><strong>${Math.floor(this.save.coins)}</strong></div>
        <div><span>竞技币</span><strong>${Math.floor(this.save.pvpCoins || 0)}</strong></div>
        <div><span>能源晶体</span><strong>${Math.floor(this.save.energyCrystals)}</strong></div>
      </div>
    `;
  }

function protocolTabsHtml(this: any) {
    const equippedCount = normalizeBaseGems(this.save.baseGems).filter(Boolean).length;
    const tabs: Array<{ id: ProtocolTab; label: string; hint: string; icon: string }> = [
      { id: "gems", label: "基地宝石", hint: `${equippedCount}/${BASE_GEM_SLOTS} 已装备`, icon: "base-gems" },
      { id: "protocols", label: "基地协议", hint: "永久强化", icon: "protocols" },
    ];

    return `
      <div class="warehouse-tabs protocol-tabs" role="tablist" aria-label="基地中枢分类">
        ${tabs
          .map(
            (tab) => `
              <button
                class="warehouse-tab protocol-tab ${this.protocolTab === tab.id ? "active" : ""}"
                type="button"
                data-protocol-tab="${tab.id}"
                role="tab"
                aria-selected="${this.protocolTab === tab.id ? "true" : "false"}"
              >
                <i class="warehouse-tab-icon ${tab.icon}"></i>
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

function protocolTabContentHtml(this: any) {
    if (this.protocolTab === "protocols") {
      return `
        <div class="warehouse-section protocol-intro">
          <div class="warehouse-section-head">
            <div>
              <span>基地协议</span>
              <em>永久生效，适合长期成长</em>
            </div>
          </div>
          <div class="protocol-summary">
            <div><span>出战</span><strong>${this.save.runs}</strong></div>
            <div><span>通关</span><strong>${this.save.wins}</strong></div>
            <div><span>无尽最高</span><strong>${this.save.bestEndlessWave || 0}</strong></div>
          </div>
        </div>
        <div class="upgrade-list menu-upgrade-list protocol-upgrade-list">
          ${metaUpgrades.map((item) => this.metaUpgradeHtml(item)).join("")}
        </div>
      `;
    }

    const equippedCount = normalizeBaseGems(this.save.baseGems).filter(Boolean).length;
    return `
      <div class="warehouse-section warehouse-gem-section">
        <div class="warehouse-section-head">
          <div>
            <span>基地宝石</span>
            <em>${equippedCount}/${BASE_GEM_SLOTS} 已装备 · 下一局生效</em>
          </div>
        </div>
        ${this.baseGemSlotsHtml()}
      </div>
      <div class="warehouse-section">
        <div class="warehouse-section-head">
          <div>
            <span>宝石库</span>
            <em>装备、替换或合成高等级宝石</em>
          </div>
        </div>
        ${this.protocolGemInventoryHtml()}
      </div>
    `;
  }

function warehousePageHtml(this: any) {
    const inventory = this.inventory();
    const collectibleCount = Object.values(inventory.collectibles).reduce((sum, amount) => sum + (amount || 0), 0);
    const gemCount = Object.values(inventory.gems).reduce((sum, amount) => sum + amount, 0);
    const shardCount = Object.values(inventory.marbleShards).reduce((sum, amount) => sum + (amount || 0), 0);
    const itemCount = collectibleCount + gemCount + shardCount;

    return `
      <div class="panel main-panel menu-page warehouse-page">
        ${this.menuPageTitleHtml("仓库", `物品 ${itemCount}`)}
        ${this.noticeHtml()}
        ${this.warehouseResourceStripHtml()}

        ${this.warehouseTabsHtml()}

        <div class="warehouse-tab-content">
          ${this.warehouseTabContentHtml()}
        </div>
      </div>
      ${this.warehouseDetail ? this.warehouseItemDetailModalHtml() : ""}
    `;
  }

function warehouseTabsHtml(this: any) {
    const tabs: Array<{ id: WarehouseTab; label: string; hint: string }> = [
      { id: "gems", label: "宝石", hint: "详情 / 合成" },
      { id: "shards", label: "碎片", hint: "查看 / 升级" },
      { id: "collectibles", label: "战利品", hint: "查看 / 回收" },
    ];

    return `
      <div class="warehouse-tabs" role="tablist" aria-label="仓库分类">
        ${tabs
          .map(
            (tab) => `
              <button
                class="warehouse-tab ${this.warehouseTab === tab.id ? "active" : ""}"
                type="button"
                data-warehouse-tab="${tab.id}"
                role="tab"
                aria-selected="${this.warehouseTab === tab.id ? "true" : "false"}"
              >
                <i class="warehouse-tab-icon ${tab.id}"></i>
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

function warehouseTabContentHtml(this: any) {
    const inventory = this.inventory();

    if (this.warehouseTab === "shards") {
      return `
        <section class="warehouse-section">
          <div class="warehouse-section-head">
            <div>
              <span>弹珠碎片</span>
              <em>点击格子查看升级入口</em>
            </div>
          </div>
          ${this.marbleShardInventoryHtml()}
        </section>
      `;
    }

    if (this.warehouseTab === "collectibles") {
      return `
        <section class="warehouse-section">
          <div class="warehouse-section-head">
            <div>
              <span>战利品</span>
              <em>点击格子查看回收操作</em>
            </div>
          </div>
          ${this.collectibleInventoryHtml()}
        </section>
      `;
    }

    return `
      <section class="warehouse-section">
        <div class="warehouse-section-head">
          <div>
            <span>宝石原胚</span>
            <em>点击格子查看详情，装备请前往基地中枢</em>
          </div>
        </div>
        ${this.gemInventoryHtml()}
      </section>
    `;
  }

function baseGemSlotsHtml(this: any) {
    this.save.baseGems = normalizeBaseGems(this.save.baseGems);
    return `
      <div class="gem-slot-grid">
        ${this.save.baseGems
          .map((key, index) => {
            const gem = key ? parseGemKey(key) : null;
            const config = gem ? gemConfigs[gem.type] : null;
            return `
              <div class="gem-slot ${gem ? gemRarity(gem.level) : "empty"}" style="--gem-color: ${config?.color || "#54c7ff"}">
                <div class="gem-slot-orb"><i></i></div>
                <span>槽位 ${index + 1}</span>
                <strong>${gem && config ? `${config.name} Lv.${gem.level}` : "空槽"}</strong>
                <em>${gem && config ? gemEffectText(gem.type, gem.level) : "选择宝石后装备"}</em>
                ${
                  gem
                    ? `<button class="small-button" type="button" data-gem-unequip="${index}">卸下</button>`
                    : `<button class="small-button" type="button" disabled>空位</button>`
                }
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

function marbleShardInventoryHtml(this: any) {
    const shards = this.inventory().marbleShards;
    const ownedMarbles = Object.values(marbleConfigs).filter((marble) => (shards[marble.id] || 0) > 0);

    if (ownedMarbles.length === 0) {
      return `<div class="inventory-empty">还没有弹珠碎片。战斗掉落和撤离奖励会逐步补充这里。</div>`;
    }

    return `
      <div class="warehouse-item-grid shard-grid">
        ${ownedMarbles
          .map((marble) => {
            const count = shards[marble.id] || 0;
            const level = this.marbleLevel(marble.id);
            const capped = level >= MARBLE_MAX_LEVEL;
            const cost = capped ? 0 : marbleShardCost(level);
            return `
              <button
                class="warehouse-cell shard-cell"
                type="button"
                data-warehouse-item-type="shards"
                data-warehouse-item="${marble.id}"
                style="--item-color: ${marble.color}"
              >
                <i class="warehouse-cell-icon shard-card-icon"></i>
                <span class="warehouse-cell-copy">
                  <strong>${marble.name}</strong>
                  <em>${capped ? "满级" : `升级需 ${cost}`}</em>
                </span>
                <b>×${count}</b>
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

function gemInventoryHtml(this: any) {
    const gems = sortedGemEntries(this.inventory().gems);

    if (gems.length === 0) {
      return `<div class="inventory-empty">还没有宝石。击败精英和首领更容易获得宝石。</div>`;
    }

    return `
      <div class="warehouse-item-grid gem-inventory-grid">
        ${gems
          .map(([key, count]) => {
            const gem = parseGemKey(key);
            if (!gem) return "";
            const config = gemConfigs[gem.type];
            const rarity = gemRarity(gem.level);
            return `
              <button
                class="warehouse-cell gem-cell ${rarity}"
                type="button"
                data-warehouse-item-type="gems"
                data-warehouse-item="${key}"
                style="--item-color: ${config.color}; --gem-color: ${config.color}"
              >
                <i class="warehouse-cell-icon gem-card-icon"></i>
                <span class="warehouse-cell-copy">
                  <strong>${config.name}</strong>
                  <em>Lv.${gem.level} · ${rarityName(rarity)}</em>
                </span>
                <b>×${count}</b>
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

function protocolGemInventoryHtml(this: any) {
    const gems = sortedGemEntries(this.inventory().gems);

    if (gems.length === 0) {
      return `<div class="inventory-empty">还没有宝石。击败精英和首领更容易获得宝石。</div>`;
    }

    return `
      <div class="gem-inventory-grid protocol-gem-grid">
        ${gems
          .map(([key, count]) => {
            const gem = parseGemKey(key);
            if (!gem) return "";
            const config = gemConfigs[gem.type];
            const rarity = gemRarity(gem.level);
            const fuseChance = Math.round(gemFuseChance(gem.level) * 100);
            const canFuse = count >= 2 && gem.level < GEM_MAX_LEVEL;
            return `
              <article class="gem-card ${rarity}" style="--gem-color: ${config.color}">
                <div class="gem-card-main">
                  <i class="gem-card-icon"></i>
                  <span class="gem-card-copy">
                    <strong>${config.name} Lv.${gem.level}</strong>
                    <em>${rarityName(rarity)} · ${gemEffectText(gem.type, gem.level)}</em>
                  </span>
                  <b>×${count}</b>
                </div>
                <div class="gem-card-actions">
                  ${this.gemEquipActionsHtml(key)}
                  <button class="small-button" type="button" data-gem-fuse="${key}" ${canFuse ? "" : "disabled"}>
                    合成 ${gem.level >= GEM_MAX_LEVEL ? "满级" : `${fuseChance}%`}
                  </button>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  }

function gemEquipActionsHtml(this: any, key: string) {
    const firstEmpty = this.firstEmptyGemSlot();
    if (firstEmpty >= 0) {
      return `
        <button class="small-button gem-equip-primary" type="button" data-gem-equip="${key}" data-gem-slot="${firstEmpty}">
          装备到 ${firstEmpty + 1}
        </button>
      `;
    }

    return `
      <div class="gem-replace-actions" aria-label="替换槽位">
        ${this.save.baseGems
          .map(
            (_, index) => `
              <button class="small-button" type="button" data-gem-equip="${key}" data-gem-slot="${index}">
                替 ${index + 1}
              </button>
            `,
          )
          .join("")}
      </div>
    `;
  }

function collectibleInventoryHtml(this: any) {
    const inventory = this.inventory();
    const ownedItems = Object.values(collectibleConfigs).filter((item) => (inventory.collectibles[item.id] || 0) > 0);

    if (ownedItems.length === 0) {
      return `<div class="inventory-empty">还没有战利品。首领、精英和高热度撤离更容易带回高价值物品。</div>`;
    }

    return `
      <div class="warehouse-item-grid collectible-grid">
        ${ownedItems
          .map((item) => {
            const count = inventory.collectibles[item.id] || 0;
            return `
              <button
                class="warehouse-cell item-cell ${item.rarity}"
                type="button"
                data-warehouse-item-type="collectibles"
                data-warehouse-item="${item.id}"
              >
                <span class="warehouse-cell-icon item-card-icon">${dropIconText({ type: "collectible", id: item.id, amount: 1, rarity: item.rarity })}</span>
                <span class="warehouse-cell-copy">
                  <strong>${item.name}</strong>
                  <em>${rarityName(item.rarity)}</em>
                </span>
                <b>×${count}</b>
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

function warehouseItemDetailModalHtml(this: any) {
    const detail = this.warehouseDetail;
    if (!detail) return "";

    if (detail.tab === "gems") {
      const gem = parseGemKey(detail.key);
      if (!gem) return "";
      const count = this.inventory().gems[detail.key] || 0;
      const config = gemConfigs[gem.type];
      const rarity = gemRarity(gem.level);
      const canFuse = count >= 2 && gem.level < GEM_MAX_LEVEL;
      const fuseChance = Math.round(gemFuseChance(gem.level) * 100);

      return `
        <div class="warehouse-detail-modal" data-warehouse-detail-backdrop>
          <section class="warehouse-detail-panel ${rarity}" style="--item-color: ${config.color}; --gem-color: ${config.color}" aria-label="宝石详情">
            <button class="hero-modal-close" type="button" data-warehouse-detail-close aria-label="关闭">×</button>
            <div class="warehouse-detail-head">
              <i class="warehouse-detail-icon gem-card-icon"></i>
              <div>
                <span>${rarityName(rarity)}</span>
                <h2>${config.name} Lv.${gem.level}</h2>
                <p>${gemEffectText(gem.type, gem.level)}</p>
              </div>
            </div>
            <div class="warehouse-detail-stats">
              <div><span>持有</span><strong>${count}</strong></div>
              <div><span>类型</span><strong>${config.stat}</strong></div>
              <div><span>合成</span><strong>${gem.level >= GEM_MAX_LEVEL ? "满级" : `${fuseChance}%`}</strong></div>
            </div>
            <div class="warehouse-detail-actions">
              <button class="primary-button" type="button" data-menu="protocols">去基地中枢</button>
              <button class="secondary-button" type="button" data-gem-fuse="${detail.key}" ${canFuse ? "" : "disabled"}>
                ${gem.level >= GEM_MAX_LEVEL ? "已满级" : "合成"}
              </button>
            </div>
          </section>
        </div>
      `;
    }

    if (detail.tab === "shards") {
      const marble = marbleConfigs[detail.key as MarbleId];
      if (!marble) return "";
      const count = this.inventory().marbleShards[marble.id] || 0;
      const level = this.marbleLevel(marble.id);
      const capped = level >= MARBLE_MAX_LEVEL;
      const cost = capped ? 0 : marbleShardCost(level);

      return `
        <div class="warehouse-detail-modal" data-warehouse-detail-backdrop>
          <section class="warehouse-detail-panel" style="--item-color: ${marble.color}" aria-label="碎片详情">
            <button class="hero-modal-close" type="button" data-warehouse-detail-close aria-label="关闭">×</button>
            <div class="warehouse-detail-head">
              <i class="warehouse-detail-icon shard-card-icon"></i>
              <div>
                <span>弹珠碎片</span>
                <h2>${marble.name}碎片</h2>
                <p>用于提升 ${marble.name} 等级。</p>
              </div>
            </div>
            <div class="warehouse-detail-stats">
              <div><span>持有</span><strong>${count}</strong></div>
              <div><span>等级</span><strong>${level}/${MARBLE_MAX_LEVEL}</strong></div>
              <div><span>升级需</span><strong>${capped ? "满级" : cost}</strong></div>
            </div>
            <div class="warehouse-detail-actions">
              <button class="primary-button" type="button" data-menu="marbles">${capped ? "查看弹珠" : "去升级"}</button>
            </div>
          </section>
        </div>
      `;
    }

    const item = collectibleConfigs[detail.key as CollectibleId];
    if (!item) return "";
    const count = this.inventory().collectibles[item.id] || 0;
    const totalValue = count * item.value;
    const allValue = Object.values(collectibleConfigs).reduce(
      (sum, config) => sum + (this.inventory().collectibles[config.id] || 0) * config.value,
      0,
    );

    return `
      <div class="warehouse-detail-modal" data-warehouse-detail-backdrop>
        <section class="warehouse-detail-panel ${item.rarity}" aria-label="战利品详情">
          <button class="hero-modal-close" type="button" data-warehouse-detail-close aria-label="关闭">×</button>
          <div class="warehouse-detail-head">
            <span class="warehouse-detail-icon item-card-icon">${dropIconText({ type: "collectible", id: item.id, amount: 1, rarity: item.rarity })}</span>
            <div>
              <span>${rarityName(item.rarity)}</span>
              <h2>${item.name}</h2>
              <p>${item.desc}</p>
            </div>
          </div>
          <div class="warehouse-detail-stats">
            <div><span>持有</span><strong>${count}</strong></div>
            <div><span>单价</span><strong>${item.value}</strong></div>
            <div><span>估值</span><strong>${totalValue}</strong></div>
          </div>
          <div class="warehouse-detail-actions">
            <button class="primary-button" type="button" data-sell-collectible="${item.id}" ${count <= 0 ? "disabled" : ""}>出售当前</button>
            <button class="secondary-button" type="button" data-action="sellAll" ${allValue <= 0 ? "disabled" : ""}>全部回收 ${allValue}</button>
          </div>
        </section>
      </div>
    `;
  }

export const gameShopInventoryUiMethods = {
  shopPageHtml,
  shopTabsHtml,
  shopTabContentHtml,
  shopItemCardHtml,
  shopItemIconText,
  shopCrystalRedeemHintHtml,
  marbleUpgradeCardHtml,
  warehouseResourceStripHtml,
  protocolTabsHtml,
  protocolTabContentHtml,
  warehousePageHtml,
  warehouseTabsHtml,
  warehouseTabContentHtml,
  baseGemSlotsHtml,
  marbleShardInventoryHtml,
  gemInventoryHtml,
  protocolGemInventoryHtml,
  gemEquipActionsHtml,
  collectibleInventoryHtml,
  warehouseItemDetailModalHtml,
} satisfies Record<string, GameMethod>;
