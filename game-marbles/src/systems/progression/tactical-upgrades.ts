import { upgradeCards } from "../../config/upgrades";
import type { RarityRollBoost } from "../../core/rarity";
import type { Session, TacticalState, TacticalTier, UpgradeCard } from "../../core/types";

const tierOrder: TacticalTier[] = ["basic", "middle", "high"];

export function compactSelectedUpgrades(ids: string[]) {
  const order: string[] = [];
  const counts = new Map<string, number>();

  for (const id of ids) {
    if (!counts.has(id)) order.push(id);
    counts.set(id, (counts.get(id) || 0) + 1);
  }

  return order
    .map((id) => {
      const card = upgradeCards.find((item) => item.id === id);
      return card ? { card, count: counts.get(id) || 1 } : null;
    })
    .filter((item): item is { card: UpgradeCard; count: number } => !!item);
}

export function createDefaultTacticalState(): TacticalState {
  return {
    refreshCharges: 0,
    refreshChargesMax: 3,
    nextAttributeMultiplier: 1,
    nextAttributeMultiplierUses: 0,
    rarityBoosts: [],
    familyBiases: {},
    tagBiases: {},
    coreProgress: {},
    coreReady: {},
    lockedChoiceId: null,
    lockedChoiceSource: null,
    bannedTags: {},
    focusedTag: null,
    focusCharges: 0,
  };
}

export function ensureTacticalState(session: Session) {
  session.tacticState ||= createDefaultTacticalState();
  session.tacticState.refreshCharges = Math.max(0, Math.floor(session.tacticState.refreshCharges || 0));
  session.tacticState.refreshChargesMax = Math.max(1, Math.floor(session.tacticState.refreshChargesMax || 3));
  session.tacticState.nextAttributeMultiplier = Math.max(1, session.tacticState.nextAttributeMultiplier || 1);
  session.tacticState.nextAttributeMultiplierUses = Math.max(0, Math.floor(session.tacticState.nextAttributeMultiplierUses || 0));
  session.tacticState.rarityBoosts = (session.tacticState.rarityBoosts || []).filter((boost) => boost.uses > 0);
  session.tacticState.familyBiases ||= {};
  session.tacticState.tagBiases ||= {};
  session.tacticState.coreProgress ||= {};
  session.tacticState.coreReady ||= {};
  session.tacticState.lockedChoiceId ||= null;
  session.tacticState.lockedChoiceSource ||= null;
  session.tacticState.bannedTags ||= {};
  session.tacticState.focusedTag ||= null;
  session.tacticState.focusCharges = Math.max(0, Math.floor(session.tacticState.focusCharges || 0));
  for (const [tag, turns] of Object.entries(session.tacticState.bannedTags)) {
    const value = Math.max(0, Math.floor(Number(turns) || 0));
    if (value > 0) session.tacticState.bannedTags[tag] = value;
    else delete session.tacticState.bannedTags[tag];
  }
  return session.tacticState;
}

function cardStacks(session: Session, id: string) {
  return session.modifiers.cardStacks[id] || 0;
}

function familyCards(familyId: string) {
  return upgradeCards.filter((card) => card.familyId === familyId);
}

function familyTierStacks(session: Session, familyId: string, tier: TacticalTier) {
  return familyCards(familyId)
    .filter((card) => card.tier === tier)
    .reduce((total, card) => total + cardStacks(session, card.id), 0);
}

function selectedFamilyStacks(session: Session, familyId: string) {
  return familyCards(familyId).reduce((total, card) => total + cardStacks(session, card.id), 0);
}

function isStackLimitReached(card: UpgradeCard, session: Session) {
  const stacks = cardStacks(session, card.id);
  if (card.kind === "unique" && stacks > 0) return true;
  if (card.maxStacks === "infinite" || card.maxStacks === undefined) return false;
  return stacks >= card.maxStacks;
}

export function isUpgradeCardAvailable(card: UpgradeCard, session: Session) {
  ensureTacticalState(session);
  if (isStackLimitReached(card, session)) return false;
  if (card.requires && !card.requires(session)) return false;
  if (card.core?.type === "main" && session.battleBuild?.mainCoreId && session.battleBuild.mainCoreId !== card.core.coreId) return false;

  const unlock = card.unlock;
  if (unlock?.characters?.length) {
    const lineupIds = new Set(session.characters.map((character) => character.id));
    if (!unlock.characters.some((id) => lineupIds.has(id))) return false;
  }
  if (unlock?.cards?.length && !unlock.cards.every((id) => cardStacks(session, id) > 0)) return false;
  if (unlock?.families?.length && !unlock.families.every((familyId) => selectedFamilyStacks(session, familyId) > 0)) return false;

  if (card.kind === "tiered" && card.familyId && card.tier && card.tier !== "basic") {
    const previousTier = tierOrder[tierOrder.indexOf(card.tier) - 1];
    if (!previousTier || familyTierStacks(session, card.familyId, previousTier) <= 0) return false;
  }

  return true;
}

export function tacticalCardWeight(card: UpgradeCard, session: Session) {
  const state = ensureTacticalState(session);
  const stacks = cardStacks(session, card.id);
  let weight = Math.max(0.05, card.weight ?? 1);

  if (card.kind === "stackable" && stacks > 0) weight *= Math.pow(0.82, stacks);

  if (card.kind === "tiered" && card.familyId && card.tier) {
    const basicStacks = familyTierStacks(session, card.familyId, "basic");
    const middleStacks = familyTierStacks(session, card.familyId, "middle");
    if (card.tier === "basic" && middleStacks > 0) weight *= 0.62;
    if (card.tier === "middle") weight *= 1.45 + Math.min(1.1, basicStacks * 0.22);
    if (card.tier === "high") weight *= 1.65 + Math.min(1.35, middleStacks * 0.32);
    weight *= 1 + (state.familyBiases[card.familyId] || 0);
  }

  if (card.kind === "character") weight *= 1.22;
  if (card.kind === "utility") weight *= 0.92;
  if (card.core) weight *= card.core.type === "main" ? 2.6 : 1.8;
  if (card.source === "bond") weight *= 1.55;
  if (state.focusedTag && state.focusCharges > 0 && card.tag === state.focusedTag) weight *= 2.2;
  weight *= 1 + (state.tagBiases[card.tag] || 0);

  return Math.max(0.01, weight);
}

export function combinedRarityBoost(session: Session): RarityRollBoost {
  const state = ensureTacticalState(session);
  return state.rarityBoosts.reduce<RarityRollBoost>(
    (total, boost) => ({
      rare: (total.rare || 0) + (boost.rare || 0),
      epic: (total.epic || 0) + (boost.epic || 0),
      legendary: (total.legendary || 0) + (boost.legendary || 0),
    }),
    {},
  );
}

export function consumeRarityBoostUse(session: Session) {
  const state = ensureTacticalState(session);
  state.rarityBoosts = state.rarityBoosts
    .map((boost) => ({ ...boost, uses: boost.uses - 1 }))
    .filter((boost) => boost.uses > 0);
}

export function upgradeCardTypeLabel(card: UpgradeCard) {
  if (card.kind === "stackable") return "叠加";
  if (card.kind === "tiered") return "升级";
  if (card.kind === "character") return "角色";
  if (card.kind === "utility") return "功能";
  if (card.kind === "unique") return "唯一";
  return "战术";
}

export function upgradeCardTierLabel(card: UpgradeCard) {
  if (card.tier === "basic") return "初";
  if (card.tier === "middle") return "中";
  if (card.tier === "high") return "高";
  return "";
}
