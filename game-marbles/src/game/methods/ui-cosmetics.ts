// @ts-nocheck

import {
  characters,
  cosmeticAssetSources,
  cosmeticById,
  cosmeticConfigs,
  cosmeticPools,
  cosmeticsForPool,
  marbleConfigs,
  randomChoice,
  type CosmeticConfig,
  type CosmeticDrawResult,
  type CosmeticPoolId,
  type CosmeticRarity,
  type GameMethod,
  type MarbleId,
} from "./shared";

const rarityRank: Record<CosmeticRarity, number> = { rare: 1, epic: 2, legendary: 3 };

const baseMarbleVisuals: Record<MarbleId, { accentColor: string; trailStyle: string; hitStyle: string; defeatStyle: string }> = {
  basic: { accentColor: "#ffffff", trailStyle: "stardust", hitStyle: "galaxy", defeatStyle: "galaxy" },
  split: { accentColor: "#b8ffd7", trailStyle: "leaf", hitStyle: "petal", defeatStyle: "petal" },
  blast: { accentColor: "#ffe58f", trailStyle: "firework", hitStyle: "flare", defeatStyle: "flare" },
  burn: { accentColor: "#ffcf6b", trailStyle: "flame", hitStyle: "flare", defeatStyle: "flare" },
  lightning: { accentColor: "#eadcff", trailStyle: "electric", hitStyle: "electric", defeatStyle: "electric" },
  slow: { accentColor: "#d5fbff", trailStyle: "frost", hitStyle: "frost", defeatStyle: "frost" },
};

function sortedCosmeticsByRarity(this: any, items: CosmeticConfig[], options: { ownedLast?: boolean } = {}) {
  return [...items].sort((a, b) => {
    const rarityDelta = (rarityRank[b.rarity] || 0) - (rarityRank[a.rarity] || 0);
    if (rarityDelta !== 0) return rarityDelta;
    if (options.ownedLast) {
      const ownedDelta = Number(Boolean(this.save.cosmetics.owned[a.id])) - Number(Boolean(this.save.cosmetics.owned[b.id]));
      if (ownedDelta !== 0) return ownedDelta;
    }
    const targetDelta = String(a.targetId || "").localeCompare(String(b.targetId || ""), "zh-Hans");
    if (targetDelta !== 0) return targetDelta;
    return a.name.localeCompare(b.name, "zh-Hans");
  });
}

function cosmeticPageHtml(this: any) {
  const poolId = this.currentCosmeticPoolId();
  const pool = cosmeticPools[poolId];
  const ownedCount = Object.keys(this.save.cosmetics.owned).length;
  const mode = this.currentCosmeticMode();

  return `
    <div class="panel main-panel menu-page cosmetic-page cosmetic-page-v2 ${poolId} ${mode}">
      ${this.menuPageTitleHtml("幻化舱", `${ownedCount}/${Object.keys(cosmeticConfigs).length} 已收集`)}
      ${this.noticeHtml()}
      ${this.cosmeticModeTabsHtml(mode)}
      ${
        mode === "shop"
          ? this.cosmeticShopHtml(poolId)
          : `
            <section class="cosmetic-command-deck">
              <aside class="cosmetic-rail cosmetic-left-rail">
                ${this.cosmeticResourceStripHtml()}
                ${this.cosmeticPoolTabsHtml(poolId)}
                ${this.cosmeticPityPanelHtml(pool)}
              </aside>
              ${this.cosmeticDrawMachineHtml(pool)}
              <aside class="cosmetic-rail cosmetic-right-rail">
                ${this.cosmeticManagementPanelHtml()}
                ${this.cosmeticLastResultsHtml()}
              </aside>
            </section>
            ${this.cosmeticInventoryHtml(poolId)}
          `
      }
      ${this.cosmeticRevealOverlayHtml()}
    </div>
  `;
}

function cosmeticModeTabsHtml(this: any, active: "draw" | "shop") {
  const missing = Object.values(cosmeticConfigs).filter((item) => !this.save.cosmetics.owned[item.id]).length;
  const affordable = Object.values(cosmeticConfigs).filter(
    (item) => !this.save.cosmetics.owned[item.id] && this.save.cosmetics.prismDust >= this.cosmeticExchangeCost(item.rarity),
  ).length;
  return `
    <nav class="cosmetic-mode-tabs" aria-label="幻化功能">
      <button class="${active === "draw" ? "active" : ""}" type="button" data-cosmetic-mode="draw">
        <span>抽取</span>
        <strong>幻化共振</strong>
        <em>券 / 晶体</em>
      </button>
      <button class="${active === "shop" ? "active" : ""}" type="button" data-cosmetic-mode="shop">
        <span>商店</span>
        <strong>幻彩兑换</strong>
        <em>${affordable}/${missing} 可换</em>
      </button>
    </nav>
  `;
}

function cosmeticResourceStripHtml(this: any) {
  return `
    <section class="cosmetic-resource-strip" aria-label="幻化资源">
      <div>
        <img src="${cosmeticAssetSources.resources.characterCosmetic}" alt="" draggable="false" />
        <span>角色券</span><strong>${this.save.cosmetics.tickets.characterCosmetic || 0}</strong>
      </div>
      <div>
        <img src="${cosmeticAssetSources.resources.marbleCosmetic}" alt="" draggable="false" />
        <span>弹珠券</span><strong>${this.save.cosmetics.tickets.marbleCosmetic || 0}</strong>
      </div>
      <div>
        <img src="${cosmeticAssetSources.resources.prismDust}" alt="" draggable="false" />
        <span>幻彩尘</span><strong>${this.save.cosmetics.prismDust || 0}</strong>
      </div>
      <div>
        <img src="${cosmeticAssetSources.resources.energyCrystal}" alt="" draggable="false" />
        <span>能源晶体</span><strong>${Math.floor(this.save.energyCrystals)}</strong>
      </div>
    </section>
  `;
}

function cosmeticPoolTabsHtml(this: any, active: CosmeticPoolId) {
  return `
    <div class="cosmetic-pool-tabs" role="tablist" aria-label="幻化卡池">
      ${Object.values(cosmeticPools)
        .map((pool) => {
          const owned = cosmeticsForPool(pool.id).filter((item) => this.save.cosmetics.owned[item.id]).length;
          return `
            <button
              type="button"
              class="cosmetic-pool-tab ${active === pool.id ? "active" : ""}"
              data-cosmetic-pool="${pool.id}"
              role="tab"
              aria-selected="${active === pool.id ? "true" : "false"}"
            >
              <img class="cosmetic-pool-tab-icon" src="${this.cosmeticPoolIcon(pool.id)}" alt="" draggable="false" />
              <span>${pool.kind === "character" ? "服装" : "弹珠"}</span>
              <strong>${pool.name}</strong>
              <em>${owned}/${pool.itemIds.length}</em>
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}

function cosmeticPityPanelHtml(this: any, pool: any) {
  const pity = this.save.cosmetics.pity[pool.id] || { sinceEpic: 0, sinceLegendary: 0 };
  const epicRemain = Math.max(0, pool.pity.epic - pity.sinceEpic);
  const legendaryRemain = Math.max(0, pool.pity.legendary - pity.sinceLegendary);
  return `
    <section class="cosmetic-pity-panel">
      <div>
        <span>史诗校准</span>
        <strong>${epicRemain} 抽</strong>
      </div>
      <div>
        <span>传说共振</span>
        <strong>${legendaryRemain} 抽</strong>
      </div>
    </section>
  `;
}

function cosmeticDrawMachineHtml(this: any, pool: any) {
  const singleCost = this.cosmeticDrawCost(pool.id, 1);
  const tenCost = this.cosmeticDrawCost(pool.id, 10);
  const featured = this.sortedCosmeticsByRarity(cosmeticsForPool(pool.id).filter((item) => item.rarity !== "rare")).slice(0, 5);
  const headline = pool.id === "character" ? "角色投影同步" : "弹珠粒子调谐";

  return `
    <section class="cosmetic-draw-machine ${pool.id}" style="--pool-art: url('${this.cosmeticPoolArt(pool.id)}')">
      <div class="cosmetic-machine-copy">
        <span>${headline}</span>
        <h2>${pool.name}</h2>
        <p>${pool.desc}</p>
      </div>
      <div class="cosmetic-machine-window" aria-hidden="true">
        <img class="cosmetic-pool-art" src="${this.cosmeticPoolArt(pool.id)}" alt="" draggable="false" />
        <span class="cosmetic-machine-beam"></span>
        ${this.cosmeticMachineOrbHtml(pool.id)}
      </div>
      <div class="cosmetic-feature-track">
        ${featured.map((item) => this.cosmeticMiniCardHtml(item)).join("")}
      </div>
      <div class="cosmetic-draw-actions">
        <button class="cosmetic-draw-button single" type="button" data-cosmetic-draw="single" ${singleCost.disabled ? "disabled" : ""}>
          <span>启动一次</span>
          <strong>${singleCost.text}</strong>
        </button>
        <button class="cosmetic-draw-button ten" type="button" data-cosmetic-draw="ten" ${tenCost.disabled ? "disabled" : ""}>
          <span>十连展开</span>
          <strong>${tenCost.text}</strong>
        </button>
      </div>
    </section>
  `;
}

function cosmeticMachineOrbHtml(this: any, poolId: CosmeticPoolId) {
  return `
    <span class="cosmetic-machine-orb">
      <img src="${this.cosmeticPoolIcon(poolId)}" alt="" draggable="false" />
    </span>
  `;
}

function cosmeticMiniCardHtml(this: any, cosmetic: CosmeticConfig) {
  return `
    <article class="cosmetic-mini-card ${cosmetic.rarity}" style="--cosmetic-color: ${cosmetic.color}; --cosmetic-accent: ${cosmetic.accentColor}">
      ${this.cosmeticIconHtml(cosmetic)}
      <strong>${this.escapeText(cosmetic.name)}</strong>
      <em>${this.cosmeticRarityName(cosmetic.rarity)}</em>
    </article>
  `;
}

function cosmeticManagementPanelHtml(this: any) {
  const characterOwned = cosmeticsForPool("character").filter((item) => this.save.cosmetics.owned[item.id]).length;
  const marbleOwned = cosmeticsForPool("marble").filter((item) => this.save.cosmetics.owned[item.id]).length;
  return `
    <section class="cosmetic-management-panel">
      <div class="cosmetic-section-head"><span>外观管理</span><em>装备入口分离</em></div>
      <button class="cosmetic-manage-link character" type="button" data-menu="heroes">
        <span>角色幻化</span>
        <strong>${characterOwned} 件</strong>
        <em>在角色详情中装备</em>
      </button>
      <button class="cosmetic-manage-link marble" type="button" data-menu="marbles">
        <span>弹珠幻化</span>
        <strong>${marbleOwned} 件</strong>
        <em>在弹珠工坊中配置</em>
      </button>
    </section>
  `;
}

function cosmeticLastResultsHtml(this: any) {
  const results = this.cosmeticLastResults || [];
  if (!results.length) {
    const history = this.save.cosmetics.history.slice(-5).reverse();
    return `
      <section class="cosmetic-result-panel history">
        <div class="cosmetic-section-head"><span>最近记录</span><em>${history.length ? `最近 ${history.length} 次` : "暂无抽取"}</em></div>
        <div class="cosmetic-result-list">
          ${
            history.length
              ? history
                  .map((entry) => {
                    const item = cosmeticById(entry.itemId);
                    return item ? this.cosmeticResultItemHtml({ itemId: item.id, rarity: item.rarity, duplicate: entry.duplicate, dust: 0 }) : "";
                  })
                  .join("")
              : `<div class="cosmetic-empty-record">启动幻化舱后会记录最近获得</div>`
          }
        </div>
      </section>
    `;
  }

  const dust = results.reduce((sum, item) => sum + item.dust, 0);
  return `
    <section class="cosmetic-result-panel">
      <div class="cosmetic-section-head"><span>本次获得</span><em>${dust > 0 ? `重复转化 ${dust} 幻彩尘` : "全部为新幻化"}</em></div>
      <div class="cosmetic-result-list">
        ${results.slice(0, 5).map((result) => this.cosmeticResultItemHtml(result)).join("")}
      </div>
    </section>
  `;
}

function cosmeticResultItemHtml(this: any, result: CosmeticDrawResult) {
  const item = cosmeticById(result.itemId);
  if (!item) return "";
  return `
    <article class="cosmetic-result-item ${item.rarity} ${result.duplicate ? "duplicate" : ""}" style="--cosmetic-color: ${item.color}; --cosmetic-accent: ${item.accentColor}">
      ${this.cosmeticIconHtml(item)}
      <span>
        <strong>${this.escapeText(item.name)}</strong>
        <em>${result.duplicate ? `重复 +${result.dust || this.cosmeticDuplicateDust(item.rarity)} 幻彩尘` : this.cosmeticRarityName(item.rarity)}</em>
      </span>
    </article>
  `;
}

function cosmeticInventoryHtml(this: any, poolId: CosmeticPoolId) {
  const items = this.sortedCosmeticsByRarity(cosmeticsForPool(poolId));
  const owned = items.filter((item) => this.save.cosmetics.owned[item.id]).length;
  return `
    <section class="cosmetic-catalog-preview">
      <div class="cosmetic-section-head">
        <span>${poolId === "character" ? "角色卡池预览" : "弹珠卡池预览"}</span>
        <em>${owned}/${items.length} 已拥有 · 商店可定向兑换</em>
      </div>
      <div class="cosmetic-grid">
        ${items.map((item) => this.cosmeticInventoryCardHtml(item)).join("")}
      </div>
    </section>
  `;
}

function cosmeticInventoryCardHtml(this: any, item: CosmeticConfig) {
  const owned = Boolean(this.save.cosmetics.owned[item.id]);
  const equipped = this.cosmeticEquipped(item);
  const targetName = this.cosmeticTargetName(item);
  const exchangeCost = this.cosmeticExchangeCost(item.rarity);
  const actionHtml = owned
    ? item.type === "character"
      ? `<button class="small-button" type="button" data-hero-cosmetic="${item.targetId}">${equipped ? "查看已装备" : "去角色详情"}</button>`
      : `<button class="small-button" type="button" data-menu="marbles">${equipped ? "查看已配置" : "去工坊配置"}</button>`
    : `<button class="small-button" type="button" data-cosmetic-mode="shop">${exchangeCost} 幻彩尘</button>`;
  return `
    <article class="cosmetic-card ${item.rarity} ${owned ? "owned" : "locked"} ${equipped ? "equipped" : ""}" style="--cosmetic-color: ${item.color}; --cosmetic-accent: ${item.accentColor}">
      <div class="cosmetic-card-head">
        ${this.cosmeticIconHtml(item)}
        <div>
          <span>${this.cosmeticRarityName(item.rarity)} · ${this.escapeText(item.theme || "常驻")}</span>
          <strong>${this.escapeText(item.name)}</strong>
        </div>
      </div>
      <p>${this.escapeText(item.desc)}</p>
      <div class="cosmetic-card-meta">
        <span>${targetName}</span>
        <em>${owned ? `拥有 ${this.save.cosmetics.owned[item.id]}` : "未拥有"}</em>
      </div>
      ${actionHtml}
    </article>
  `;
}

function cosmeticShopHtml(this: any, poolId: CosmeticPoolId) {
  const items = this.sortedCosmeticsByRarity(cosmeticsForPool(poolId), { ownedLast: true });
  const owned = items.filter((item) => this.save.cosmetics.owned[item.id]).length;
  const missing = items.length - owned;
  const affordable = items.filter((item) => !this.save.cosmetics.owned[item.id] && this.save.cosmetics.prismDust >= this.cosmeticExchangeCost(item.rarity)).length;
  const headline = poolId === "character" ? "服装外观货架" : "弹珠外观货架";
  return `
    <section class="cosmetic-shop">
      <aside class="cosmetic-rail cosmetic-shop-sidebar">
        ${this.cosmeticResourceStripHtml()}
        ${this.cosmeticPoolTabsHtml(poolId)}
        <section class="cosmetic-shop-rate-card">
          <div><span>稀有</span><strong>${this.cosmeticExchangeCost("rare")}</strong></div>
          <div><span>史诗</span><strong>${this.cosmeticExchangeCost("epic")}</strong></div>
          <div><span>传说</span><strong>${this.cosmeticExchangeCost("legendary")}</strong></div>
        </section>
      </aside>
      <section class="cosmetic-shop-main">
        <div class="cosmetic-shop-hero">
          <span class="cosmetic-shop-dust">
            <img src="${cosmeticAssetSources.resources.prismDust}" alt="" draggable="false" />
          </span>
          <div>
            <span>幻化商店</span>
            <strong>${headline}</strong>
            <p>用重复幻化转化的幻彩尘定向兑换，只影响外观和战斗特效，不影响属性平衡。</p>
          </div>
          <em>${affordable} 个可兑换 · ${missing} 个未拥有</em>
        </div>
        <div class="cosmetic-shop-grid">
          ${items.map((item) => this.cosmeticShopCardHtml(item)).join("")}
        </div>
      </section>
    </section>
  `;
}

function cosmeticShopCardHtml(this: any, item: CosmeticConfig) {
  const owned = Boolean(this.save.cosmetics.owned[item.id]);
  const equipped = this.cosmeticEquipped(item);
  const cost = this.cosmeticExchangeCost(item.rarity);
  const affordable = !owned && this.save.cosmetics.prismDust >= cost;
  const targetName = this.cosmeticTargetName(item);
  const buttonText = owned ? (equipped ? "已装备" : "已拥有") : affordable ? "兑换" : "幻彩尘不足";
  return `
    <article class="cosmetic-shop-card ${item.rarity} ${owned ? "owned" : "locked"} ${affordable ? "affordable" : ""}" style="--cosmetic-color: ${item.color}; --cosmetic-accent: ${item.accentColor}">
      <div class="cosmetic-shop-card-head">
        ${this.cosmeticIconHtml(item)}
        <div>
          <span>${this.cosmeticRarityName(item.rarity)} · ${this.escapeText(item.theme || "常驻")}</span>
          <strong>${this.escapeText(item.name)}</strong>
          <em>${targetName}</em>
        </div>
      </div>
      <p>${this.escapeText(item.desc)}</p>
      <div class="cosmetic-shop-card-foot">
        <span class="cosmetic-shop-price">
          <img src="${cosmeticAssetSources.resources.prismDust}" alt="" draggable="false" />
          <strong>${cost}</strong>
        </span>
        <button class="small-button" type="button" data-cosmetic-exchange="${item.id}" ${owned || !affordable ? "disabled" : ""}>
          ${buttonText}
        </button>
      </div>
    </article>
  `;
}

function cosmeticRevealOverlayHtml(this: any) {
  const results = this.cosmeticRevealResults || [];
  if (!results.length) return "";
  const revealSteps = this.cosmeticRevealSteps(results);
  const topResult = results.reduce((best, result) => (rarityRank[result.rarity] > rarityRank[best.rarity] ? result : best), results[0]);
  const topItem = cosmeticById(topResult.itemId);
  const rarity = topItem?.rarity || "rare";
  const hasLegendary = revealSteps.some((step) => step.rarity === "legendary");
  const poolName = this.cosmeticRevealPoolId === "marble" ? "弹珠幻化" : "角色幻化";
  return `
    <div class="cosmetic-reveal-overlay ${rarity} ${hasLegendary ? "has-legendary" : ""}" role="dialog" aria-label="幻化抽取结果">
      <div class="cosmetic-reveal-stage">
        <button class="cosmetic-reveal-skip" type="button" data-cosmetic-reveal-close>跳过</button>
        <div class="cosmetic-reveal-machine">
          <span class="reveal-beam"></span>
          <span class="reveal-core">${topItem ? `<img src="${this.cosmeticItemAsset(topItem)}" alt="" draggable="false" />` : ""}</span>
          ${revealSteps
            .filter((step) => step.rarity !== "rare")
            .map(
              (step) => `
                <span
                  class="reveal-rarity-flare ${step.rarity}"
                  style="--flare-delay: ${Math.max(0, step.delay - step.preDelay)}ms; --cosmetic-color: ${step.color}; --cosmetic-accent: ${step.accent}"
                ></span>
              `,
            )
            .join("")}
        </div>
        <div class="cosmetic-reveal-title">
          <span>${poolName}</span>
          <strong>${this.cosmeticRarityName(rarity)}共振</strong>
        </div>
        <div class="cosmetic-reveal-flow" aria-label="揭示进度">
          ${revealSteps
            .map(
              (step, index) => `
                <span
                  class="${step.rarity}"
                  style="--step-delay: ${step.delay}ms; --cosmetic-color: ${step.color}; --cosmetic-accent: ${step.accent}"
                >${index + 1}</span>
              `,
            )
            .join("")}
        </div>
        <div class="cosmetic-reveal-results ${results.length > 1 ? "multi" : "single"}">
          ${revealSteps
            .map((step, index) => {
              const { result, item } = step;
              if (!item) return "";
              return `
                <article
                  class="cosmetic-reveal-card ${item.rarity} ${result.duplicate ? "duplicate" : ""} ${item.rarity !== "rare" ? "spotlight" : ""} ${step.quickPass ? "quick-pass" : ""}"
                  style="--cosmetic-color: ${item.color}; --cosmetic-accent: ${item.accentColor}; --reveal-delay: ${step.delay}ms; --impact-delay: ${Math.max(0, step.delay - step.preDelay)}ms"
                >
                  <span class="cosmetic-reveal-index">${index + 1}</span>
                  <span class="cosmetic-reveal-impact"></span>
                  ${this.cosmeticIconHtml(item)}
                  <strong>${this.escapeText(item.name)}</strong>
                  <em>${result.duplicate ? `重复 +${result.dust} 幻彩尘` : this.cosmeticRarityName(item.rarity)}</em>
                </article>
              `;
            })
            .join("")}
        </div>
        <button class="primary-button cosmetic-reveal-confirm" type="button" data-cosmetic-reveal-close>收纳入库</button>
      </div>
    </div>
  `;
}

function cosmeticRevealSteps(this: any, results: CosmeticDrawResult[]) {
  const hasLegendary = results.some((result) => result.rarity === "legendary");
  let cursor = results.length > 1 ? (hasLegendary ? 320 : 720) : 520;
  return results.map((result) => {
    const item = cosmeticById(result.itemId);
    const rarity = item?.rarity || result.rarity || "rare";
    const quickPass = hasLegendary && rarity !== "legendary" && results.length > 1;
    const preDelay = quickPass ? 30 : rarity === "legendary" ? 1380 : rarity === "epic" ? 520 : 120;
    const revealDuration = quickPass ? 150 : rarity === "legendary" ? 1280 : rarity === "epic" ? 640 : 360;
    cursor += preDelay;
    const step = {
      result,
      item,
      rarity,
      color: item?.color || "#54c7ff",
      accent: item?.accentColor || "#f6c95f",
      delay: cursor,
      preDelay,
      revealDuration,
      quickPass,
    };
    cursor += quickPass ? 35 : revealDuration + (rarity === "rare" ? 120 : 280);
    return step;
  });
}

function marbleCosmeticLoadoutHtml(this: any) {
  return `
    <section class="marble-cosmetic-section">
      <div class="hero-section-title">
        <span>弹珠幻化</span>
        <em>只改变弹珠外观和战斗特效</em>
      </div>
      <div class="marble-cosmetic-grid">
        ${Object.values(marbleConfigs)
          .map((marble) => {
            const equipped = this.equippedMarbleCosmetic(marble.id);
            const skins = this.sortedCosmeticsByRarity(cosmeticsForPool("marble").filter((item) => item.targetId === marble.id && this.save.cosmetics.owned[item.id]));
            return `
              <article class="marble-cosmetic-card ${equipped?.rarity || "base"}" style="--marble-color: ${(equipped || marble).color}; --cosmetic-accent: ${equipped?.accentColor || marble.color}">
                <div class="marble-cosmetic-head">
                  ${
                    equipped
                      ? this.marblePreviewIconHtml(this.marbleCosmeticPreview(equipped), "cosmetic-icon marble")
                      : this.marblePreviewIconHtml(this.marbleVisualConfig(marble.id), "cosmetic-icon marble")
                  }
                  <div>
                    <strong>${marble.name}</strong>
                    <em>${equipped ? equipped.name : "默认外观"}</em>
                  </div>
                </div>
                <div class="marble-cosmetic-options">
                  ${
                    skins.length
                      ? skins
                          .map(
                            (item) => `
                              <button
                                type="button"
                                class="${item.rarity} ${equipped?.id === item.id ? "active" : ""}"
                                data-cosmetic-equip="${item.id}"
                                style="--cosmetic-color: ${item.color}"
                              >
                                ${this.marblePreviewIconHtml(this.marbleCosmeticPreview(item), "marble-cosmetic-option-icon")}
                              </button>
                            `,
                          )
                          .join("")
                      : `<span>暂无已拥有幻化</span>`
                  }
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
      <button class="secondary-button" type="button" data-menu="cosmetics">去幻化舱获取</button>
    </section>
  `;
}

function cosmeticIconHtml(this: any, item: CosmeticConfig) {
  if (item.type === "marble") return this.marblePreviewIconHtml(this.marbleCosmeticPreview(item), "cosmetic-icon marble");
  return `
    <span class="cosmetic-icon ${item.type}" style="--cosmetic-color: ${item.color}; --cosmetic-accent: ${item.accentColor}">
      <img src="${this.cosmeticItemAsset(item)}" alt="" draggable="false" />
    </span>
  `;
}

function marbleCosmeticPreview(this: any, item: CosmeticConfig) {
  return {
    cosmetic: item,
    color: item.color,
    accentColor: item.accentColor || item.color,
    trail: this.hexToRgba(item.marbleTrailAccentColor || item.accentColor || item.color, 0.34),
    shape: item.marbleShape || "orb",
    trailStyle: item.marbleTrailStyle || "soft",
    trailColor: item.marbleTrailColor || item.color,
    trailAccentColor: item.marbleTrailAccentColor || item.accentColor || item.color,
    trailHighlightColor: item.marbleTrailHighlightColor || item.marbleTrailAccentColor || item.accentColor || item.color,
    trailLength: item.marbleTrailLength || 1,
    trailWidth: item.marbleTrailWidth || 1,
    trailAnimation: item.marbleTrailAnimation || "steady",
    trailDensity: item.marbleTrailDensity || 1,
    hitStyle: item.marbleHitEffect || marbleImpactStyleFromVisual(item.marbleTrailStyle || "soft", item.marbleShape || "orb"),
    defeatStyle: item.marbleDefeatEffect || marbleImpactStyleFromVisual(item.marbleTrailStyle || "soft", item.marbleShape || "orb"),
    label: item.visualLabel || "",
    rarity: item.rarity || null,
  };
}

function marblePreviewIconHtml(this: any, visual: any, className = "") {
  const color = visual?.color || "#54c7ff";
  const accent = visual?.accentColor || color;
  const trail = visual?.trail || this.hexToRgba(accent, 0.34);
  const shape = visual?.shape || "orb";
  const trailStyle = visual?.trailStyle || "soft";
  const impactStyle = visual?.hitStyle || visual?.defeatStyle || "spark";
  const rarity = visual?.rarity || "base";
  return `
    <span
      class="marble-preview-icon ${className} marble-shape-${shape} marble-trail-${trailStyle} marble-impact-${impactStyle} marble-rarity-${rarity}"
      style="--marble-color: ${color}; --marble-accent: ${accent}; --marble-trail: ${trail}; --cosmetic-color: ${color}; --cosmetic-accent: ${accent}"
      aria-hidden="true"
    >
      <i></i>
      <b></b>
      <em></em>
    </span>
  `;
}

function cosmeticPoolArt(this: any, poolId: CosmeticPoolId) {
  return cosmeticAssetSources.pools[poolId] || cosmeticAssetSources.pools.character;
}

function cosmeticPoolIcon(this: any, poolId: CosmeticPoolId) {
  return cosmeticAssetSources.tabs[poolId] || cosmeticAssetSources.tabs.character;
}

function cosmeticItemAsset(this: any, item: CosmeticConfig) {
  const type = item.type === "marble" ? "marble" : "character";
  return cosmeticAssetSources.items[type][item.rarity] || cosmeticAssetSources.items[type].rare;
}

function currentCosmeticPoolId(this: any): CosmeticPoolId {
  if (this.cosmeticPoolId === "marble") return "marble";
  return "character";
}

function currentCosmeticMode(this: any): "draw" | "shop" {
  return this.cosmeticMode === "shop" ? "shop" : "draw";
}

function setCosmeticMode(this: any, mode: string) {
  this.cosmeticMode = mode === "shop" ? "shop" : "draw";
  if (this.cosmeticMode === "shop") {
    this.cosmeticRevealResults = [];
    this.cosmeticRevealPoolId = null;
  }
  this.renderMenu("cosmetics");
}

function setCosmeticPool(this: any, poolId: CosmeticPoolId) {
  this.cosmeticPoolId = poolId in cosmeticPools ? poolId : "character";
  this.cosmeticLastResults = [];
  this.cosmeticRevealResults = [];
  this.cosmeticRevealPoolId = null;
  this.renderMenu("cosmetics");
}

function cosmeticDrawCost(this: any, poolId: CosmeticPoolId, count: number) {
  const pool = cosmeticPools[poolId];
  const ticketCount = this.save.cosmetics.tickets[pool.ticket] || 0;
  const tickets = Math.min(ticketCount, count);
  const crystalDraws = Math.max(0, count - tickets);
  const crystals = pool.singleCrystalCost * crystalDraws;
  const parts = [];
  if (tickets) parts.push(`${tickets} 张券`);
  if (crystals) parts.push(`${crystals} 晶体`);
  return {
    disabled: this.save.energyCrystals < crystals,
    tickets,
    crystals,
    text: parts.join(" + ") || "免费",
  };
}

function drawCosmetics(this: any, count: number) {
  const poolId = this.currentCosmeticPoolId();
  const pool = cosmeticPools[poolId];
  const cost = this.cosmeticDrawCost(poolId, count);
  if (cost.disabled) {
    this.menuNotice = "幻化券或能源晶体不足";
    this.renderMenu("cosmetics");
    return;
  }

  if (cost.tickets) this.save.cosmetics.tickets[pool.ticket] -= cost.tickets;
  if (cost.crystals) this.save.energyCrystals -= cost.crystals;

  const results: CosmeticDrawResult[] = [];
  for (let i = 0; i < count; i += 1) {
    results.push(this.rollCosmetic(poolId));
  }

  this.cosmeticLastResults = results;
  this.cosmeticRevealResults = results;
  this.cosmeticRevealPoolId = poolId;
  this.menuNotice = `获得 ${results.length} 个幻化${results.some((item) => item.duplicate) ? "，重复已转为幻彩尘" : ""}`;
  this.persistSave("cosmetic-draw");
  this.renderMenu("cosmetics");
}

function rollCosmetic(this: any, poolId: CosmeticPoolId): CosmeticDrawResult {
  const pool = cosmeticPools[poolId];
  const pity = this.save.cosmetics.pity[poolId] || { sinceEpic: 0, sinceLegendary: 0 };
  const rarity = this.rollCosmeticRarity(poolId);
  const candidates = pool.itemIds.map((id) => cosmeticConfigs[id]).filter((item) => item?.rarity === rarity);
  const fallback = pool.itemIds.map((id) => cosmeticConfigs[id]).filter(Boolean);
  const item = randomChoice(candidates.length ? candidates : fallback);
  const duplicate = Boolean(this.save.cosmetics.owned[item.id]);
  const dust = duplicate ? this.cosmeticDuplicateDust(item.rarity) : 0;

  this.save.cosmetics.owned[item.id] = (this.save.cosmetics.owned[item.id] || 0) + 1;
  if (dust) this.save.cosmetics.prismDust += dust;

  pity.sinceEpic += 1;
  pity.sinceLegendary += 1;
  if (item.rarity === "epic" || item.rarity === "legendary") pity.sinceEpic = 0;
  if (item.rarity === "legendary") pity.sinceLegendary = 0;
  this.save.cosmetics.pity[poolId] = pity;

  this.save.cosmetics.history.push({
    poolId,
    itemId: item.id,
    rarity: item.rarity,
    duplicate,
    at: Date.now(),
  });
  this.save.cosmetics.history = this.save.cosmetics.history.slice(-50);

  return { itemId: item.id, rarity: item.rarity, duplicate, dust };
}

function rollCosmeticRarity(this: any, poolId: CosmeticPoolId): CosmeticRarity {
  const pool = cosmeticPools[poolId];
  const pity = this.save.cosmetics.pity[poolId] || { sinceEpic: 0, sinceLegendary: 0 };
  if (pity.sinceLegendary + 1 >= pool.pity.legendary) return "legendary";
  if (pity.sinceEpic + 1 >= pool.pity.epic) return "epic";

  const roll = Math.random();
  if (roll < 0.03) return "legendary";
  if (roll < 0.18) return "epic";
  return "rare";
}

function equipCosmetic(this: any, cosmeticId: string) {
  const item = cosmeticById(cosmeticId);
  if (!item || !this.save.cosmetics.owned[cosmeticId]) return;
  if (item.type === "character" && item.targetId) {
    this.save.cosmetics.equippedCharacters[item.targetId] = item.id;
    this.menuNotice = `已装备 ${item.name}`;
  }
  if (item.type === "marble" && item.targetId) {
    this.save.cosmetics.equippedMarbles[item.targetId as MarbleId] = item.id;
    this.menuNotice = `已装备 ${item.name}`;
  }
  this.persistSave("cosmetic-equip");
  this.renderMenu(this.menuView === "heroes" ? "heroes" : this.menuView === "marbles" ? "marbles" : "cosmetics");
}

function exchangeCosmetic(this: any, cosmeticId: string) {
  const item = cosmeticById(cosmeticId);
  if (!item) return;
  if (this.save.cosmetics.owned[cosmeticId]) {
    this.menuNotice = "该幻化已经拥有";
    this.renderMenu("cosmetics");
    return;
  }
  const cost = this.cosmeticExchangeCost(item.rarity);
  if ((this.save.cosmetics.prismDust || 0) < cost) {
    this.menuNotice = "幻彩尘不足";
    this.renderMenu("cosmetics");
    return;
  }
  this.save.cosmetics.prismDust -= cost;
  this.save.cosmetics.owned[item.id] = 1;
  this.cosmeticMode = "shop";
  this.menuNotice = `已兑换 ${item.name}`;
  this.persistSave("cosmetic-exchange");
  this.renderMenu("cosmetics");
}

function cosmeticExchangeCost(this: any, rarity: CosmeticRarity) {
  return { rare: 80, epic: 240, legendary: 900 }[rarity];
}

function cosmeticEquipped(this: any, item: CosmeticConfig) {
  if (item.type === "character") return this.save.cosmetics.equippedCharacters[item.targetId || ""] === item.id;
  if (item.type === "marble") return this.save.cosmetics.equippedMarbles[item.targetId as MarbleId] === item.id;
  return false;
}

function cosmeticTargetName(this: any, item: CosmeticConfig) {
  if (item.type === "character") {
    const character = characters.find((entry) => entry.id === item.targetId);
    return character ? character.name : "角色";
  }
  if (item.type === "marble") {
    const marble = marbleConfigs[item.targetId as MarbleId];
    return marble ? marble.name : "弹珠";
  }
  return "展示外观";
}

function cosmeticRarityName(this: any, rarity: CosmeticRarity) {
  return { rare: "稀有", epic: "史诗", legendary: "传说" }[rarity];
}

function cosmeticDuplicateDust(this: any, rarity: CosmeticRarity) {
  return { rare: 10, epic: 40, legendary: 160 }[rarity];
}

function characterVisualConfig(this: any, characterId: string) {
  const character = characters.find((entry) => entry.id === characterId);
  const cosmetic = this.equippedCharacterCosmetic(characterId);
  const color = cosmetic?.color || character?.color || "#54c7ff";
  const accentColor = cosmetic?.accentColor || character?.color || "#f6c95f";
  return {
    cosmetic,
    color,
    accentColor,
    label: cosmetic?.visualLabel || "",
    rarity: cosmetic?.rarity || null,
  };
}

function characterVisualColor(this: any, characterId: string) {
  return this.characterVisualConfig(characterId).color;
}

function characterVisualAccent(this: any, characterId: string) {
  return this.characterVisualConfig(characterId).accentColor;
}

function equippedCharacterCosmetic(this: any, characterId: string) {
  return cosmeticById(this.save.cosmetics.equippedCharacters[characterId] || "");
}

function equippedMarbleCosmetic(this: any, marbleId: MarbleId) {
  return cosmeticById(this.save.cosmetics.equippedMarbles[marbleId] || "");
}

function marbleVisualConfig(this: any, marbleId: MarbleId) {
  const base = marbleConfigs[marbleId];
  const cosmetic = this.equippedMarbleCosmetic(marbleId);
  const baseVisual = baseMarbleVisuals[marbleId];
  const defaultVisual = {
    cosmetic: null,
    color: base.color,
    accentColor: baseVisual.accentColor,
    trail: base.trail,
    shape: "orb",
    trailStyle: baseVisual.trailStyle,
    trailColor: base.color,
    trailAccentColor: baseVisual.accentColor,
    trailHighlightColor: baseVisual.accentColor,
    trailLength: 1,
    trailWidth: 1,
    trailAnimation: "steady",
    trailDensity: 1,
    hitStyle: baseVisual.hitStyle,
    defeatStyle: baseVisual.defeatStyle,
    label: "",
    rarity: null,
  };
  if (!cosmetic) return defaultVisual;

  const intensity = this.save.preferences.cosmeticEffectIntensity || "medium";
  const alpha = intensity === "low" ? 0.18 : intensity === "high" ? 0.5 : 0.34;
  return {
    cosmetic,
    color: cosmetic.color,
    accentColor: cosmetic.accentColor || cosmetic.color,
    trail: this.hexToRgba(cosmetic.marbleTrailAccentColor || cosmetic.accentColor || cosmetic.color, alpha),
    shape: cosmetic.marbleShape || "orb",
    trailStyle: cosmetic.marbleTrailStyle || "soft",
    trailColor: cosmetic.marbleTrailColor || cosmetic.color,
    trailAccentColor: cosmetic.marbleTrailAccentColor || cosmetic.accentColor || cosmetic.color,
    trailHighlightColor: cosmetic.marbleTrailHighlightColor || cosmetic.marbleTrailAccentColor || cosmetic.accentColor || cosmetic.color,
    trailLength: cosmetic.marbleTrailLength || 1,
    trailWidth: cosmetic.marbleTrailWidth || 1,
    trailAnimation: cosmetic.marbleTrailAnimation || "steady",
    trailDensity: cosmetic.marbleTrailDensity || 1,
    hitStyle: cosmetic.marbleHitEffect || marbleImpactStyleFromVisual(cosmetic.marbleTrailStyle || "soft", cosmetic.marbleShape || "orb"),
    defeatStyle: cosmetic.marbleDefeatEffect || marbleImpactStyleFromVisual(cosmetic.marbleTrailStyle || "soft", cosmetic.marbleShape || "orb"),
    label: cosmetic.visualLabel || "",
    rarity: cosmetic.rarity || null,
  };
}

function marbleVisualColor(this: any, marbleId: MarbleId) {
  return this.marbleVisualConfig(marbleId).color;
}

function marbleImpactStyleFromVisual(trailStyle: string, shape: string) {
  if (trailStyle === "electric" || shape === "bolt") return "electric";
  if (trailStyle === "flame" || trailStyle === "firework" || shape === "bomb" || shape === "flame" || shape === "comet") return "flare";
  if (trailStyle === "frost" || shape === "snowflake") return "frost";
  if (trailStyle === "petal" || trailStyle === "leaf" || shape === "leaf" || shape === "flower") return "petal";
  if (trailStyle === "ribbon") return "ribbon";
  if (trailStyle === "galaxy" || trailStyle === "aurora" || trailStyle === "stardust" || shape === "ring") return "galaxy";
  if (shape === "crystal") return "crystal";
  return "spark";
}

function hexToRgba(this: any, color: string, alpha = 0.2) {
  const normalized = color.replace("#", "");
  if (normalized.length !== 6) return `rgba(84,199,255,${alpha})`;
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export const gameCosmeticUiMethods = {
  cosmeticPageHtml,
  cosmeticModeTabsHtml,
  cosmeticResourceStripHtml,
  cosmeticPoolTabsHtml,
  cosmeticPityPanelHtml,
  cosmeticDrawMachineHtml,
  cosmeticMachineOrbHtml,
  cosmeticMiniCardHtml,
  cosmeticManagementPanelHtml,
  cosmeticLastResultsHtml,
  cosmeticResultItemHtml,
  cosmeticInventoryHtml,
  cosmeticInventoryCardHtml,
  cosmeticShopHtml,
  cosmeticShopCardHtml,
  cosmeticRevealOverlayHtml,
  cosmeticRevealSteps,
  marbleCosmeticLoadoutHtml,
  sortedCosmeticsByRarity,
  cosmeticIconHtml,
  marbleCosmeticPreview,
  marblePreviewIconHtml,
  cosmeticPoolArt,
  cosmeticPoolIcon,
  cosmeticItemAsset,
  currentCosmeticPoolId,
  currentCosmeticMode,
  setCosmeticMode,
  setCosmeticPool,
  cosmeticDrawCost,
  drawCosmetics,
  rollCosmetic,
  rollCosmeticRarity,
  equipCosmetic,
  exchangeCosmetic,
  cosmeticExchangeCost,
  cosmeticEquipped,
  cosmeticTargetName,
  cosmeticRarityName,
  cosmeticDuplicateDust,
  characterVisualConfig,
  characterVisualColor,
  characterVisualAccent,
  equippedCharacterCosmetic,
  equippedMarbleCosmetic,
  marbleVisualConfig,
  marbleVisualColor,
  hexToRgba,
} satisfies Record<string, GameMethod>;
