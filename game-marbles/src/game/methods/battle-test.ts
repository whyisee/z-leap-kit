// @ts-nocheck

import {
  CHARACTER_BASE_OFFSET,
  FIELD,
  FIELD_BOTTOM,
  WIDTH,
  characters,
  clamp,
  compactSelectedUpgrades,
  createDefaultTacticalState,
  isUpgradeCardAvailable,
  marbleConfigs,
  rarityColor,
  rarityName,
  updateCoreProgressForCard,
  upgradeCardTypeLabel,
  upgradeCards,
  upgradeLevel,
  type CharacterConfig,
  type CharacterRuntime,
  type GameMethod,
  type MarbleId,
  type Session,
  type UpgradeCard,
} from "./shared";

function testSession(this: any): Session | null {
  const session = this.session;
  return session?.mode === "test" ? session : null;
}

function testSkillHaste(this: any) {
  const gemModifiers = this.baseGemModifiers();
  return clamp(1 - upgradeLevel(this.save.upgrades, "skillHaste") * 0.02 - gemModifiers.skillHaste, 0.55, 1.3);
}

function testMaxBaseHp(this: any, session: Session) {
  const upgrades = this.save.upgrades;
  const gemModifiers = this.baseGemModifiers();
  const hasTeamPassive = (passiveId: string) => session.characters.some((character: CharacterRuntime) => this.passiveUnlocked(character.id, passiveId));
  return 10 + Math.floor(upgradeLevel(upgrades, "baseHealth") / 3) + gemModifiers.baseHp + (hasTeamPassive("sentinel_wall") ? 1 : 0);
}

function testBaseModifiers(this: any, session: Session) {
  const upgrades = this.save.upgrades;
  const gemModifiers = this.baseGemModifiers();
  const hasTeamPassive = (passiveId: string) => session.characters.some((character: CharacterRuntime) => this.passiveUnlocked(character.id, passiveId));

  return {
    damageMul: (1 + upgradeLevel(upgrades, "teamDamage") * 0.03) * (1 + gemModifiers.damage),
    fireRateMul: (1 + upgradeLevel(upgrades, "fireRate") * 0.02) * (1 + gemModifiers.fireRate),
    marbleSpeedMul: 1,
    critChance: clamp(0.05 + upgradeLevel(upgrades, "critCore") * 0.008 + gemModifiers.critChance, 0.05, 0.85),
    critDamage: 1.5 + gemModifiers.critDamage,
    coinMul: (1 + upgradeLevel(upgrades, "coinGain") * 0.03) * (1 + gemModifiers.coin + (hasTeamPassive("treasurer_circuit") ? 0.08 : 0)),
    expMul: 1 + gemModifiers.exp,
    blastRadiusMul: 1,
    burnMul: 1,
    chainBonus: 0,
    slowBonus: 0,
    globalPierce: 0,
    bounceDamage: 0,
    baseRegen: hasTeamPassive("sentinel_repair") ? 1 : 0,
    revive: false,
    magnetic: 0,
    dropLuck: gemModifiers.drop + (hasTeamPassive("treasurer_instinct") ? 0.05 : 0),
    tagDamage: {},
    marbleDamage: {},
    cardStacks: {},
  };
}

function testRuntimeCharacter(this: any, character: CharacterConfig, slot: number): CharacterRuntime {
  const x = FIELD.x + FIELD.w * ([0.32, 0.5, 0.68][slot] || 0.5);
  const marbles = [...this.characterMarbles(character)] as MarbleId[];
  const cooldowns = Object.fromEntries(marbles.map((id) => [id, 0])) as Record<MarbleId, number>;
  const battleStats = this.characterBattleStats(character);
  return {
    ...character,
    marbles,
    x,
    y: FIELD_BOTTOM - CHARACTER_BASE_OFFSET,
    cooldowns,
    skillTimer: character.skillCooldown * testSkillHaste.call(this) * battleStats.skillCooldownMul * 0.55,
    skillActive: 0,
  };
}

function rebuildTestCombatState(this: any, selectedUpgradeIds: string[] = []) {
  const session = testSession.call(this);
  if (!session) return;

  session.maxBaseHp = testMaxBaseHp.call(this, session);
  session.baseHp = session.maxBaseHp;
  session.modifiers = testBaseModifiers.call(this, session);
  session.tacticState = createDefaultTacticalState();
  session.pendingChoices = [];
  session.selectedUpgradeIds = [];

  for (const id of selectedUpgradeIds) {
    const card = upgradeCards.find((item) => item.id === id);
    if (card) applyTestUpgradeCard.call(this, card, false);
  }

  this.tacticPanelSignature = "";
  this.updateTacticPanel();
  this.updateHud();
}

function applyTestUpgradeCard(this: any, card: UpgradeCard, announce = true) {
  const session = testSession.call(this);
  if (!session) return false;

  const multiplier = this.applyUpgradeCard(card);
  session.modifiers.cardStacks[card.id] = (session.modifiers.cardStacks[card.id] || 0) + 1;
  session.selectedUpgradeIds.push(card.id);
  updateCoreProgressForCard(session, card);
  session.pendingChoices = [];
  this.tacticPanelSignature = "";
  this.updateTacticPanel();

  if (announce) {
    this.addFloatingText(WIDTH / 2, FIELD.y + 42, `${card.name}${multiplier > 1 ? ` ×${multiplier}` : ""}`, rarityColor(card.rarity));
  }
  return true;
}

function updateTestToolsUi(this: any) {
  const session = testSession.call(this);
  const visible = Boolean(session && this.phase === "playing");
  this.testToolsToggle?.classList.toggle("hidden", !visible);
  this.testPanel?.classList.toggle("hidden", !visible || !this.testToolsOpen);
  if (!visible) {
    this.testToolsSignature = "";
    return;
  }

  this.testToolsToggle?.classList.toggle("active", this.testToolsOpen);
  if (!this.testToolsOpen) return;

  const signature = [
    this.testCharacterSlot,
    this.testMarbleSlot,
    session.characters.map((character: CharacterRuntime) => `${character.id}:${character.marbles.join(",")}`).join("|"),
    session.selectedUpgradeIds.join(","),
  ].join("::");
  if (this.testToolsSignature === signature) return;

  this.testToolsSignature = signature;
  renderTestPanel.call(this);
}

function toggleTestTools(this: any) {
  if (!testSession.call(this)) return;
  this.testToolsOpen = !this.testToolsOpen;
  this.testToolsSignature = "";
  updateTestToolsUi.call(this);
}

function selectTestCharacterSlot(this: any, slot: number) {
  const session = testSession.call(this);
  if (!session) return;
  this.testCharacterSlot = clamp(Math.floor(slot), 0, Math.max(0, session.characters.length - 1));
  this.testMarbleSlot = 0;
  updateTestToolsUi.call(this);
}

function selectTestMarbleSlot(this: any, slot: number) {
  const session = testSession.call(this);
  if (!session) return;
  this.testMarbleSlot = clamp(Math.floor(slot), 0, 1);
  updateTestToolsUi.call(this);
}

function applyTestCharacter(this: any, characterId: string) {
  const session = testSession.call(this);
  const character = characters.find((item) => item.id === characterId);
  if (!session || !character) return;

  const slot = clamp(Math.floor(this.testCharacterSlot || 0), 0, Math.max(0, session.characters.length - 1));
  const previous = session.characters[slot];
  if (previous?.id === character.id) return;
  const duplicateSlot = session.characters.findIndex((item: CharacterRuntime, index: number) => index !== slot && item.id === character.id);

  if (duplicateSlot >= 0 && previous) {
    const previousConfig = characters.find((item) => item.id === previous.id);
    if (previousConfig) session.characters[duplicateSlot] = testRuntimeCharacter.call(this, previousConfig, duplicateSlot);
  }

  session.characters[slot] = testRuntimeCharacter.call(this, character, slot);
  session.marbles = session.marbles.filter((marble: any) => marble.ownerId !== previous?.id && marble.ownerId !== character.id);
  rebuildTestCombatState.call(this, [...session.selectedUpgradeIds]);
  this.addFloatingText(session.characters[slot].x, session.characters[slot].y - 54, `切换 ${character.name}`, character.color);
  updateTestToolsUi.call(this);
}

function applyTestMarble(this: any, marbleId: MarbleId) {
  const session = testSession.call(this);
  if (!session || !(marbleId in marbleConfigs)) return;

  const character = session.characters[clamp(Math.floor(this.testCharacterSlot || 0), 0, Math.max(0, session.characters.length - 1))];
  if (!character) return;

  const slot = clamp(Math.floor(this.testMarbleSlot || 0), 0, 1);
  const loadout = [...character.marbles] as MarbleId[];
  const previous = loadout[slot];
  if (previous === marbleId) return;

  const duplicateSlot = loadout.findIndex((id, index) => index !== slot && id === marbleId);
  if (duplicateSlot >= 0) loadout[duplicateSlot] = previous;
  loadout[slot] = marbleId;
  character.marbles = loadout;
  delete character.cooldowns[previous];
  character.cooldowns[marbleId] = 0;
  if (duplicateSlot >= 0) character.cooldowns[previous] = 0;
  session.marbles = session.marbles.filter((marble: any) => !(marble.ownerId === character.id && (marble.marbleId === previous || marble.marbleId === marbleId)));

  rebuildTestCombatState.call(this, [...session.selectedUpgradeIds]);
  this.addFloatingText(character.x, character.y - 34, marbleConfigs[marbleId].name, marbleConfigs[marbleId].color);
  updateTestToolsUi.call(this);
}

function addSelectedTestUpgrade(this: any) {
  const session = testSession.call(this);
  if (!session) return;

  const select = this.testPanel?.querySelector<HTMLSelectElement>("[data-test-upgrade-select]");
  const card = upgradeCards.find((item) => item.id === select?.value);
  if (!card) return;

  applyTestUpgradeCard.call(this, card);
  updateTestToolsUi.call(this);
}

function addRandomTestUpgrades(this: any) {
  const session = testSession.call(this);
  if (!session) return;

  const choices = this.generateChoices({ consumeBoost: false }).slice(0, 3);
  if (choices.length === 0) return;
  for (const card of choices) applyTestUpgradeCard.call(this, card);
  this.addFloatingText(WIDTH / 2, FIELD.y + 66, `随机战术 ×${choices.length}`, "#d58cff");
  updateTestToolsUi.call(this);
}

function resetTestUpgrades(this: any) {
  const session = testSession.call(this);
  if (!session) return;

  rebuildTestCombatState.call(this, []);
  this.addFloatingText(WIDTH / 2, FIELD.y + 42, "战术已清空", "#61e6a8");
  updateTestToolsUi.call(this);
}

function renderTestPanel(this: any) {
  const session = testSession.call(this);
  if (!session || !this.testPanel) return;

  const characterSlot = clamp(Math.floor(this.testCharacterSlot || 0), 0, Math.max(0, session.characters.length - 1));
  const selectedCharacter = session.characters[characterSlot];
  const marbleSlot = clamp(Math.floor(this.testMarbleSlot || 0), 0, 1);
  const availableUpgrades = upgradeCards.filter((card) => isUpgradeCardAvailable(card, session));
  const upgradeOptions = availableUpgrades.length > 0 ? availableUpgrades : upgradeCards;
  const selectedTactics = compactSelectedUpgrades(session.selectedUpgradeIds).slice(0, 5);

  this.testPanel.innerHTML = `
    <div class="test-panel-head">
      <strong>测试工具</strong>
      <span>无收益</span>
    </div>
    <div class="test-panel-section">
      <div class="test-panel-title"><span>角色槽位</span><em>${selectedCharacter ? this.escapeText(selectedCharacter.name) : "-"}</em></div>
      <div class="test-slot-row">
        ${session.characters
          .map(
            (character: CharacterRuntime, index: number) => `
              <button class="test-slot ${index === characterSlot ? "active" : ""}" type="button" data-test-character-slot="${index}" style="--test-color: ${character.color}">
                ${this.characterPortraitHtml(character, "test-slot-portrait")}
                <span>${index + 1}</span>
              </button>
            `,
          )
          .join("")}
      </div>
      <div class="test-character-grid">
        ${characters
          .map(
            (character) => `
              <button
                class="test-character-card ${selectedCharacter?.id === character.id ? "active" : ""}"
                type="button"
                data-test-character="${character.id}"
                style="--test-color: ${character.color}"
              >
                ${this.characterPortraitHtml(character, "test-character-portrait")}
                <span>
                  <strong>${this.escapeText(character.name)}</strong>
                  <em>${rarityName(character.rarity)} · ${this.escapeText(character.role)}</em>
                </span>
              </button>
            `,
          )
          .join("")}
      </div>
    </div>
    <div class="test-panel-section">
      <div class="test-panel-title"><span>弹珠装配</span><em>槽位 ${marbleSlot + 1}</em></div>
      <div class="test-slot-row">
        ${(selectedCharacter?.marbles || [])
          .map((id: MarbleId, index: number) => {
            const marble = marbleConfigs[id];
            const visual = this.marbleVisualConfig?.(id) || marble;
            return `
              <button class="test-marble-slot ${index === marbleSlot ? "active" : ""}" type="button" data-test-marble-slot="${index}" style="--test-color: ${visual.color || marble.color}">
                ${this.marblePreviewIconHtml?.(visual, "test-marble-icon") || `<i style="background:${marble.color}"></i>`}
                <span>${this.escapeText(marble.name)}</span>
              </button>
            `;
          })
          .join("")}
      </div>
      <div class="test-marble-grid">
        ${Object.values(marbleConfigs)
          .map((marble) => {
            const visual = this.marbleVisualConfig?.(marble.id) || marble;
            const active = selectedCharacter?.marbles?.[marbleSlot] === marble.id;
            return `
              <button class="test-marble-card ${active ? "active" : ""}" type="button" data-test-marble="${marble.id}" style="--test-color: ${visual.color || marble.color}">
                ${this.marblePreviewIconHtml?.(visual, "test-marble-icon") || `<i style="background:${marble.color}"></i>`}
                <strong>${this.escapeText(marble.name.replace("弹珠", ""))}</strong>
              </button>
            `;
          })
          .join("")}
      </div>
    </div>
    <div class="test-panel-section">
      <div class="test-panel-title"><span>战术升级</span><em>${session.selectedUpgradeIds.length} 项</em></div>
      <select class="test-upgrade-select" data-test-upgrade-select>
        ${upgradeOptions
          .map(
            (card) => `
              <option value="${card.id}">${this.escapeText(card.name)} · ${upgradeCardTypeLabel(card)}</option>
            `,
          )
          .join("")}
      </select>
      <div class="test-action-row">
        <button type="button" data-test-add-upgrade ${upgradeOptions.length === 0 ? "disabled" : ""}>添加</button>
        <button type="button" data-test-random-upgrades>随机3张</button>
        <button type="button" data-test-reset-upgrades>清空</button>
      </div>
      <div class="test-tactic-preview">
        ${
          selectedTactics.length === 0
            ? `<span>暂无战术</span>`
            : selectedTactics
                .map(
                  ({ card, count }) => `
                    <em class="${card.rarity}" style="--test-color: ${rarityColor(card.rarity)}">${this.escapeText(card.name)}${count > 1 ? ` ×${count}` : ""}</em>
                  `,
                )
                .join("")
        }
      </div>
    </div>
  `;
}

export const gameBattleTestMethods = {
  updateTestToolsUi,
  toggleTestTools,
  selectTestCharacterSlot,
  selectTestMarbleSlot,
  applyTestCharacter,
  applyTestMarble,
  addSelectedTestUpgrade,
  addRandomTestUpgrades,
  resetTestUpgrades,
  renderTestPanel,
} satisfies Record<string, GameMethod>;
