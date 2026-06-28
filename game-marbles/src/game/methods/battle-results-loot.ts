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
  applyPvpRankResult,
  pvpRankDeltaText,
  pvpRankLabel,
  pvpRankProgressText,
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

function openPause(this: any) {
    this.phase = "paused";
    this.pauseScreen.classList.remove("hidden");
    this.pauseScreen.classList.add("pause-layout");
    this.pauseScreen.innerHTML = `
      <div class="panel main-panel">
        <p class="eyebrow">暂停</p>
        <h2>战斗暂停</h2>
        <p class="subcopy">当前局会保留在内存中。回主界面将放弃本局。</p>
        <div class="two-actions">
          <button class="secondary-button" type="button" data-action="resume">继续</button>
          <button class="secondary-button" type="button" data-action="restart">重开</button>
        </div>
        <button class="danger-button" type="button" data-action="menu" style="width: 100%; margin-top: 10px;">回主界面</button>
      </div>
    `;
  }

function closePause(this: any) {
    if (!this.session) return;
    this.phase = "playing";
    this.pauseScreen.classList.add("hidden");
  }

function endGame(this: any, result: "win" | "lose", reason: string, extractionResult: ExtractionResult = result === "win" ? "cleared" : "failed") {
    const session = this.requireSession();
    if (this.phase === "result") return;

    const stage = getStageById(session.stageId);
    const isEndless = isEndlessMode(session.mode);
    const isPvp = session.mode === "pvp";
    const isTest = session.mode === "test";
    const clearedStage = !isEndless && !isPvp && !isTest && extractionResult === "cleared";
    const stageStars = clearedStage ? calculateStageStars(session, stage) : 0;
    this.ensureAutoInsuredDrops();
    session.result = result;
    session.resultReason = reason;
    session.extractionResult = extractionResult;
    this.sound.play(result === "win" ? "win" : "lose");
    this.sound.setMusicMode("menu");
    const finalCoins = isPvp || isTest ? 0 : battleCoinReward(session, stage, result, extractionResult);
    const shards = isPvp || isTest ? 0 : battleShardReward(session, extractionResult);
    const pvpCoinReward = isPvp ? pvpCoinRewardForSession(session, result) : 0;
    const pvpRankContext = isPvp ? pvpRankContextForSession.call(this, session) : null;
    const pvpRankResult = isPvp ? applyPvpRankResult(this.save.pvpRanks.duel, result, pvpRankContext) : null;
    const { kept, lost } = isPvp || isTest ? { kept: [], lost: [] } : splitDropsForExtraction(session.drops, extractionResult, session.insuredDropKeys);
    session.lostDrops = lost;
    const keptSummary = compactDropSummaryRows(dropSummaryRows(kept, session.insuredDropKeys));
    const lostSummary = compactDropSummaryRows(dropSummaryRows(lost, session.insuredDropKeys));

    if (!isTest) {
      this.save.coins += finalCoins;
      this.save.pvpCoins = Math.max(0, Math.floor(this.save.pvpCoins || 0)) + pvpCoinReward;
      if (pvpRankResult) this.save.pvpRanks.duel = pvpRankResult.profile;
      this.save.shards += shards;
      if (!isPvp) {
        applyBattleProgressToSave(this.save, session, extractionResult, stage, stageStars, clearedStage);
        applyDropsToInventory(this.inventory(), kept);
      }
    }
    const unlockedCharacters = isPvp || isTest ? [] : this.unlockReadyCharacters();
    if (isPvp) {
      saveGame(this.save);
      void syncPvpRankSettlement.call(this, session, result, pvpRankContext, pvpRankResult);
    } else if (!isTest) {
      this.persistSave("battle-finish");
    }
    const battleId = this.activeBattleId;
    this.activeBattleId = null;
    if (!isPvp && !isTest) {
      void this.backend.finishBattle({
        battleId,
        result,
        wave: session.wave,
        durationMs: Math.floor(session.elapsed * 1000),
        kills: session.kills,
        selectedUpgrades: session.selectedUpgradeIds,
        acceptedRewards: {
          coins: finalCoins,
          shards,
          drops: kept,
        },
        clientSummary: {
          mode: session.mode,
          stageId: stage.id,
          stageIndex: stage.index,
          stageStars,
          level: session.level,
          baseHp: session.baseHp,
          maxBaseHp: session.maxBaseHp,
          resultReason: reason,
          extractionResult,
          heat: session.heat,
          maxHeat: session.maxHeat,
          continueCount: session.continueCount,
          extractedAtWave: session.extractedAtWave,
          bestEndlessWave: this.save.bestEndlessWave,
          lostDrops: lost,
        },
      });
    }

    if (isPvp) clearPvpBattlefieldForResult(session);

    this.phase = "result";
    session.phase = "result";
    this.hideScreens();
    this.battleHud.classList.add("hidden");
    this.bottomHud.classList.add("hidden");
    this.tacticPanel.classList.add("hidden");
    this.lootBag.classList.add("hidden");
    this.lootScreen.classList.add("hidden");
    this.resultScreen.classList.remove("hidden");
    this.resultScreen.classList.add("result-layout");
    this.resultScreen.innerHTML = isPvp
      ? pvpResultPanelHtml.call(this, session, result, reason, pvpCoinReward, pvpRankResult, extractionResult, stage)
      : `
      <div class="panel main-panel result-panel">
        <div class="result-scroll">
          <p class="eyebrow">${extractionResultEyebrowForMode(session.mode, extractionResult)}</p>
          <h2>${extractionResultTitleForMode(session.mode, extractionResult)}</h2>
          <p class="subcopy">${reason}</p>
          <div class="result-grid">
            <div class="stat-box"><span>${isPvp || isTest ? "模式" : isEndless ? "模式" : "关卡"}</span><strong>${isPvp ? "PVP" : isTest ? "测试" : isEndless ? "无尽" : `${stage.chapter}-${stage.stage}`}</strong></div>
            <div class="stat-box"><span>${isPvp || isTest ? "结果" : isEndless ? "最高" : "星级"}</span><strong>${isPvp || isTest ? (result === "win" ? "胜利" : "失败") : isEndless ? this.save.bestEndlessWave : stageStars > 0 ? "★".repeat(stageStars) : "-"}</strong></div>
            <div class="stat-box"><span>波次</span><strong>${formatSessionWaveText(session)}</strong></div>
            <div class="stat-box"><span>用时</span><strong>${formatTime(session.elapsed)}</strong></div>
            <div class="stat-box"><span>击杀</span><strong>${session.kills}</strong></div>
            <div class="stat-box"><span>${isPvp ? "战术" : "等级"}</span><strong>Lv.${session.level}</strong></div>
            <div class="stat-box"><span>${isPvp ? "施压" : "金币"}</span><strong>${isPvp ? Math.floor(session.pvp?.pressureSent || 0) : finalCoins}</strong></div>
            <div class="stat-box"><span>${isPvp ? "承压" : "碎片"}</span><strong>${isPvp ? Math.floor(session.pvp?.pressureTaken || 0) : shards}</strong></div>
            <div class="stat-box"><span>${isPvp ? "对手" : "热度"}</span><strong>${isPvp ? this.selectedPvpOpponent?.()?.name || "-" : session.maxHeat}</strong></div>
            <div class="stat-box" ${isPvp ? "data-pvp-coin-reward" : ""}><span>${isPvp ? "竞技币" : "货值"}</span><strong>${isPvp ? `+${pvpCoinReward}` : dropTotalValue(kept)}</strong></div>
            ${isPvp ? `<div class="stat-box" data-pvp-rank-current><span>段位</span><strong>${pvpRankLabel(pvpRankResult.profile)}</strong></div>` : ""}
            ${isPvp ? `<div class="stat-box" data-pvp-rank-delta><span>段位分</span><strong>${pvpRankDeltaText(pvpRankResult)}</strong></div>` : ""}
          </div>
          ${isPvp ? pvpRankResultHtml(pvpRankResult) : ""}
          ${this.characterUnlockResultHtml(unlockedCharacters)}
          ${isPvp || isTest ? "" : this.dropSummaryHtml(keptSummary, "带回战利品", "没有带回额外掉落")}
          ${!isPvp && !isTest && lost.length > 0 ? this.dropSummaryHtml(lostSummary, "损失战利品", "没有损失掉落") : ""}
        </div>
        ${this.resultActionsHtml(extractionResult, stage)}
      </div>
    `;
    this.scheduleAutoResultAction(extractionResult, stage);
  }

function clearPvpBattlefieldForResult(session: Session) {
    session.enemies = [];
    session.marbles = [];
    session.particles = [];
    session.effects = [];
    session.dropVisuals = [];
    session.spawnQueue = [];
    session.waveConfig = null;
    session.spawnTimer = 0;
    if (session.pvp) {
      for (const opponent of session.pvp.opponents || []) {
        opponent.miniEnemies = [];
        opponent.miniMarbles = [];
        opponent.miniEntities = 0;
        opponent.lastEvent = session.result === "win" ? "对战结束" : "战场清理";
        opponent.eventTimer = 0;
      }
    }
  }

function pvpResultPanelHtml(
    this: any,
    session: Session,
    result: "win" | "lose",
    reason: string,
    pvpCoinReward: number,
    pvpRankResult: any,
    extractionResult: ExtractionResult,
    stage: StageConfig,
  ) {
    const won = result === "win";
    const opponentName = this.selectedPvpOpponent?.()?.name || "对手";
    return `
      <div class="panel main-panel result-panel pvp-result-panel ${won ? "win" : "lose"}">
        <div class="pvp-result-hero">
          <span>PVP 对战</span>
          <h2>${won ? "胜利" : "失败"}</h2>
          <p>${reason || (won ? `已击败 ${opponentName}` : `${opponentName} 获胜`)}</p>
        </div>
        <div class="pvp-result-keygrid">
          <div><span>波次</span><strong>${formatSessionWaveText(session)}</strong></div>
          <div><span>用时</span><strong>${formatTime(session.elapsed)}</strong></div>
          <div><span>击杀</span><strong>${session.kills}</strong></div>
          <div data-pvp-coin-reward><span>竞技币</span><strong>+${pvpCoinReward}</strong></div>
          <div data-pvp-rank-current><span>段位</span><strong>${pvpRankLabel(pvpRankResult.profile)}</strong></div>
          <div data-pvp-rank-delta><span>段位分</span><strong>${pvpRankDeltaText(pvpRankResult)}</strong></div>
        </div>
        ${pvpRankResultHtml(pvpRankResult)}
        ${this.resultActionsHtml(extractionResult, stage)}
      </div>
    `;
  }

function pvpCoinRewardForSession(session: Session, result: "win" | "lose") {
    const base = result === "win" ? 120 : 45;
    const waveBonus = Math.min(72, Math.max(0, (session.wave || 1) - 1) * 7);
    const killBonus = Math.min(80, Math.floor((session.kills || 0) / 6));
    const pressureBonus = Math.min(36, Math.floor((session.pvp?.pressureSent || 0) / 18));
    return base + waveBonus + killBonus + pressureBonus;
  }

function pvpRankContextForSession(this: any, session: Session) {
    const pvp = session.pvp;
    const opponent = this.selectedPvpOpponent?.();
    const opponentRating = Number(opponent?.rankScore);
    return {
      mode: "duel",
      opponentRating: Number.isFinite(opponentRating) && opponentRating > 0 ? opponentRating : undefined,
      wave: session.wave || 1,
      kills: session.kills || 0,
      pressureSent: Math.floor(pvp?.pressureSent || 0),
      pressureTaken: Math.floor(pvp?.pressureTaken || 0),
      baseHp: Math.max(0, Math.floor(session.baseHp || 0)),
      maxBaseHp: Math.max(1, Math.floor(session.maxBaseHp || 1)),
      lootValue: dropTotalValue(session.drops || []),
    };
  }

async function syncPvpRankSettlement(this: any, session: Session, result: "win" | "lose", context: any, localRankResult: any) {
    const pvp = session.pvp;
    const response = await this.backend.finishPvpRank({
      mode: "duel",
      result,
      summary: {
        ...context,
        matchId: pvp?.matchId || pvp?.serverSessionId || null,
        ticketId: pvp?.matchTicketId || null,
        opponentType: pvp?.opponentSource || null,
      },
    });
    if (!response) return;

    this.save = response.save;
    saveGame(this.save);
    if (this.leaderboardState) this.leaderboardState.fetchedAt = 0;

    if (this.phase !== "result" || !this.resultScreen) return;
    const coinBox = this.resultScreen.querySelector("[data-pvp-coin-reward] strong");
    if (coinBox) coinBox.textContent = `+${response.pvpCoins}`;
    const rankBox = this.resultScreen.querySelector("[data-pvp-rank-current] strong");
    if (rankBox) rankBox.textContent = pvpRankLabel(response.rankResult.profile);
    const deltaBox = this.resultScreen.querySelector("[data-pvp-rank-delta] strong");
    if (deltaBox) deltaBox.textContent = pvpRankDeltaText(response.rankResult);
    const resultBlock = this.resultScreen.querySelector("[data-pvp-rank-result]");
    if (resultBlock) resultBlock.outerHTML = pvpRankResultHtml(response.rankResult);

    if (localRankResult && response.rankResult.delta !== localRankResult.delta) {
      console.info("[pvp] server rank settlement adjusted", {
        local: localRankResult.delta,
        server: response.rankResult.delta,
      });
    }
  }

function pvpRankResultHtml(result: any) {
    if (!result) return "";
    const before = pvpRankLabel(result.before);
    const after = pvpRankLabel(result.profile);
    const status = result.rankUp ? "段位提升" : result.rankDown ? "段位下降" : result.protectionUsed ? "保护触发" : "段位结算";
    const reasons = (result.reasons || []).slice(0, 2);
    return `
      <section class="pvp-rank-result" data-pvp-rank-result>
        <div>
          <span>${status}</span>
          <strong>${before} -> ${after}</strong>
          <em>${pvpRankProgressText(result.profile)}</em>
        </div>
        ${reasons.length > 0 ? `<p>${reasons.map((reason: string) => `<b>${reason}</b>`).join("")}</p>` : ""}
      </section>
    `;
  }

function resultActionsHtml(this: any, result: ExtractionResult, stage: StageConfig) {
    const isEndless = this.session ? isEndlessMode(this.session.mode) : false;
    const isPvp = this.session?.mode === "pvp";
    const isTest = this.session?.mode === "test";
    if (isPvp) {
      return `
        <div class="pvp-rematch-control">
          <label>
            <input type="checkbox" data-pvp-auto-rematch />
            <span>继续匹配</span>
          </label>
        </div>
        <div class="result-actions extracted pvp-result-actions">
          <button class="primary-button" type="button" data-action="retry" data-pvp-rematch-button>再次匹配</button>
          <button class="secondary-button" type="button" data-action="menu">回基地</button>
        </div>
      `;
    }
    if (result === "failed") {
      return `
        <div class="result-actions failure">
          <button class="primary-button" type="button" data-action="retry">${isTest ? "再测一局" : isEndless ? "再战无尽" : "重试"}</button>
          <button class="secondary-button" type="button" data-action="${isTest ? "menu" : "upgrade"}">${isTest ? "回基地" : "去升级"}</button>
        </div>
      `;
    }

    if (!isEndless && result === "cleared") {
      const hasNextStage = stage.index < stages.length;
      return `
        <div class="result-actions clear">
          <button class="primary-button" type="button" data-action="next" ${hasNextStage ? "" : "disabled"}>${hasNextStage ? "下一关" : "已通关"}</button>
          <button class="secondary-button" type="button" data-action="retry">重试</button>
          <button class="secondary-button" type="button" data-action="menu">回基地</button>
        </div>
      `;
    }

    return `
      <div class="result-actions extracted">
        <button class="primary-button" type="button" data-action="retry">${isTest ? "再测一局" : isEndless ? "再来一局" : "继续挑战"}</button>
        <button class="secondary-button" type="button" data-action="menu">回基地</button>
      </div>
    `;
  }

function scheduleAutoResultAction(this: any, result: ExtractionResult, stage: StageConfig) {
    if (this.session?.mode === "pvp" || this.session?.mode === "test") return;
    if (!this.autoBattleEnabled || this.autoRunMode === "manual") return;

    window.setTimeout(() => {
      const session = this.session;
      if (!session || this.phase !== "result" || session.stageId !== stage.id) return;
      if (!this.autoBattleEnabled || this.autoRunMode === "manual") return;

      if (this.autoRunMode === "repeat") {
        this.retryResultStage();
        return;
      }

      if (result === "cleared") {
        if (stage.index < stages.length) this.startNextResultStage();
        return;
      }

      this.retryResultStage();
    }, 900);
  }

function insuredSlots(this: any) {
    return 1;
  }

function insuredDropCount(this: any) {
    const session = this.session;
    if (!session) return 0;
    return countInsuredDrops(session.drops, session.insuredDropKeys);
  }

function ensureAutoInsuredDrops(this: any) {
    const session = this.session;
    if (!session) return;
    session.insuredDropKeys = autoInsuredDropKeys(session.drops, this.insuredSlots());
  }

function toggleInsuredDrop(this: any, key: string) {
    const session = this.session;
    if (!session) return;
    session.insuredDropKeys = toggleInsuredDropKey(session.drops, session.insuredDropKeys, key, this.insuredSlots());
    this.openLootScreen();
  }

function characterUnlockResultHtml(this: any, unlockedCharacters: CharacterConfig[]) {
    if (unlockedCharacters.length === 0) return "";

    return `
      <div class="character-unlock-summary">
        <div class="hero-section-title">
          <span>新角色解锁</span>
          <em>${unlockedCharacters.length} 名</em>
        </div>
        <div class="character-unlock-grid">
          ${unlockedCharacters
            .map(
              (character) => `
                <div class="character-unlock-card" style="--hero-color: ${character.color}">
                  ${this.characterPortraitHtml(character, "character-unlock-icon")}
                  <span>
                    <strong>${character.name}</strong>
                    <em>${character.role}</em>
                  </span>
                </div>
              `,
            )
            .join("")}
        </div>
      </div>
    `;
  }

function dropSummaryHtml(this: any, drops: DropSummaryItem[], title = "本局掉落", emptyText = "本局没有额外掉落") {
    if (drops.length === 0) {
      return `<div class="drop-summary empty">${emptyText}</div>`;
    }

    return `
      <div class="drop-summary">
        <div class="hero-section-title">
          <span>${title}</span>
          <em>${drops.reduce((sum, item) => sum + item.amount, 0)} 件</em>
        </div>
        <div class="drop-summary-grid">
          ${drops
            .map(
              (item) => `
                <div class="drop-pill ${item.rarity} ${item.insured ? "insured" : ""}">
                  <span>${item.label}${item.insured ? " · 保险" : ""}</span>
                  <strong>×${item.amount}</strong>
                </div>
              `,
            )
            .join("")}
        </div>
      </div>
    `;
  }

function openLootScreen(this: any) {
    const session = this.session;
    if (!session) return;

    const drops = dropSummaryRows(session.drops, session.insuredDropKeys);
    const value = dropTotalValue(session.drops);
    const insured = this.insuredDropCount();
    const slots = this.insuredSlots();
    this.lootScreen.classList.remove("hidden");
    this.lootScreen.innerHTML = `
      <div class="loot-panel" role="dialog" aria-label="本局掉落">
        <div class="loot-panel-head">
          <div>
            <h2>本局掉落</h2>
            <span>${dropTotalAmount(session.drops)} 件 · 货值 ${value} · 保险 ${insured}/${slots} · 热度 ${session.heat}</span>
          </div>
          <button type="button" data-loot-close aria-label="关闭">×</button>
        </div>
        ${
          drops.length === 0
            ? `<div class="inventory-empty">还没有获得掉落物，击败精英和首领更容易掉落。</div>`
            : `<div class="loot-list">
                ${drops
                  .map(
                    (item) => `
                      <button class="loot-row ${item.rarity} ${item.insured ? "insured" : ""}" type="button" data-insure-drop="${item.key}">
                        <span class="loot-item-icon ${item.rarity}">${item.icon}</span>
                        <span>
                          <strong>${item.label}</strong>
                          <em>${rarityName(item.rarity)} · 估值 ${item.value}${item.insured ? " · 已保险" : ""}</em>
                        </span>
                        <b>${item.insured ? "保险" : `×${item.amount}`}</b>
                      </button>
                    `,
                  )
                  .join("")}
              </div>`
        }
      </div>
    `;
  }

function closeLootScreen(this: any) {
    this.lootScreen.classList.add("hidden");
  }

function pulseLootBag(this: any) {
    this.lootBag.classList.remove("pop");
    void this.lootBag.offsetWidth;
    this.lootBag.classList.add("pop");
  }

function updateHud(this: any) {
    const session = this.session;
    if (!session || this.phase === "menu") return;

    this.baseText.textContent = session.mode === "test" ? "∞ / ∞" : `${Math.max(0, Math.ceil(session.baseHp))} / ${session.maxBaseHp}`;
    this.waveText.textContent = formatSessionWaveText(session);
    this.levelText.textContent = `Lv.${session.level}`;
    this.coinText.textContent = String(Math.floor(session.coins));
    this.lootValueText.textContent = String(dropTotalValue(session.drops));
    this.heatText.textContent = String(session.heat);
    this.xpFill.style.width = `${clamp((session.xp / session.xpNeed) * 100, 0, 100)}%`;
    this.xpText.textContent = `经验 ${Math.floor(session.xp)} / ${session.xpNeed}`;
    this.lootCountText.textContent = String(dropTotalAmount(session.drops));
    this.lootBag.classList.toggle("has-loot", session.drops.length > 0);
    this.updateQuickExtractionButton();
    this.updateTacticPanel();
    this.updateTestToolsUi?.();
  }

function updateQuickExtractionButton(this: any) {
    const session = this.session;
    const button = this.quickExtractionButton;
    if (!button) return;

    const active = Boolean(session && this.phase === "playing" && session.extractionWindowWave !== null && session.mode !== "pvp");
    button.classList.toggle("hidden", !active);
    if (!active) return;

    const isTest = session.mode === "test";
    const duration = Math.max(0.1, session.extractionWindowDuration || 5);
    const remaining = isTest ? duration : Math.max(0, session.extractionWindowTimer || 0);
    const seconds = isTest ? "测" : Math.max(1, Math.ceil(remaining));
    const progress = clamp((remaining / duration) * 100, 0, 100);
    button.style.setProperty("--extract-progress", `${progress}%`);
    button.innerHTML = `
      <svg class="quick-extraction-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12.8 4.2a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"></path>
        <path d="m11.7 7.3-3 3.3 3.2 2.2 1.8 4.5"></path>
        <path d="m8.7 10.6-2.1 3-3.2 1.1"></path>
        <path d="m12 12.8 3.2-1 2.4-3.2"></path>
        <path d="m13.7 17.3 3.2 2.5"></path>
        <path d="m9.8 14.9-2.2 4.7"></path>
      </svg>
      <span>撤离</span>
      <strong>${seconds}</strong>
    `;
  }

function updateTacticPanel(this: any) {
    const session = this.session;
    if (!session || this.phase === "menu") return;

    const signature = session.selectedUpgradeIds.join("|");
    if (this.tacticPanelSignature === signature) return;
    this.tacticPanelSignature = signature;

    this.tacticCountText.textContent = String(session.selectedUpgradeIds.length);

    if (session.selectedUpgradeIds.length === 0) {
      this.tacticList.innerHTML = `<span class="tactic-empty">暂无升级</span>`;
      return;
    }

    const ordered = compactSelectedUpgrades(session.selectedUpgradeIds);
    this.tacticList.innerHTML = ordered
      .map(({ card, count }) => {
        const countText = count > 1 ? `<em>×${count}</em>` : "";
        return `
          <div class="tactic-chip ${card.rarity}">
            <span>${card.name}</span>
            ${countText}
          </div>
        `;
      })
      .join("");
  }

function updateTacticPanelState(this: any) {
    this.tacticPanel.classList.toggle("expanded", this.tacticPanelExpanded);
    this.tacticPanel.classList.toggle("collapsed", !this.tacticPanelExpanded);
    this.tacticToggle.checked = this.tacticPanelExpanded;
    this.tacticToggle.setAttribute("aria-expanded", String(this.tacticPanelExpanded));
    this.tacticToggle.setAttribute("aria-label", this.tacticPanelExpanded ? "收起已选择战术升级" : "展开已选择战术升级");
    this.tacticToggle.closest<HTMLElement>(".battle-check-row")?.classList.toggle("active", this.tacticPanelExpanded);
  }

export const gameBattleResultLootMethods = {
  openPause,
  closePause,
  endGame,
  resultActionsHtml,
  scheduleAutoResultAction,
  insuredSlots,
  insuredDropCount,
  ensureAutoInsuredDrops,
  toggleInsuredDrop,
  characterUnlockResultHtml,
  dropSummaryHtml,
  openLootScreen,
  closeLootScreen,
  pulseLootBag,
  updateHud,
  updateQuickExtractionButton,
  updateTacticPanel,
  updateTacticPanelState,
} satisfies Record<string, GameMethod>;
