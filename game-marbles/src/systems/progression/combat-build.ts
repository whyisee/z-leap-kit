import { activeBondsForLoadout, bondById } from "../../config/bonds";
import { formationById } from "../../config/formations";
import { tacticalDeckById, tacticalDecks } from "../../config/tactical-decks";
import { upgradeCards } from "../../config/upgrades";
import { marbleConfigs } from "../../config/marbles";
import type {
  BattleBuild,
  BondId,
  CharacterRuntime,
  FormationConfig,
  FormationId,
  SaveData,
  Session,
  TacticalDeckConfig,
  TacticalDeckId,
  UpgradeCard,
} from "../../core/types";
import { ensureTacticalState } from "./tactical-upgrades";

const fallbackDeckCards = [
  "damage_up",
  "fire_rate",
  "marble_speed",
  "crit",
  "base_hp",
  "utility_refresh_charge",
  "global_pierce",
  "boss_killer",
  "last_line",
];

export function createBattleBuild(save: SaveData, characters: CharacterRuntime[]): BattleBuild {
  const formation = formationById(save.preferences.formationId);
  const deck = deckForSavePreference(save, formation, characters);
  const bonds = activeBondsForLoadout(characters, formation.id);
  const buildTags = collectBuildTags(formation, deck, characters, bonds.map((bond) => bond.id as BondId));
  const deckCardIds = dedupeCardIds([
    ...deck.cardIds,
    ...bonds.flatMap((bond) => bond.unlockedCardIds || []),
    ...fallbackDeckCards,
  ]);

  return {
    formationId: formation.id,
    deckId: deck.id,
    deckCardIds,
    activeBondIds: bonds.map((bond) => bond.id as BondId),
    buildTags,
    mainCoreId: null,
    subCoreIds: [],
  };
}

export function applyBattleBuildStart(session: Session) {
  const build = session.battleBuild;
  const formation = formationById(build.formationId);
  const state = ensureTacticalState(session);

  state.refreshCharges = Math.min(
    state.refreshChargesMax,
    state.refreshCharges + Math.max(0, formation.initialRefreshCharges || 0),
  );

  for (const [tag, bias] of Object.entries(formation.tagBiases || {})) {
    state.tagBiases[tag] = (state.tagBiases[tag] || 0) + bias;
  }

  for (const [familyId, bias] of Object.entries(formation.familyBiases || {})) {
    state.familyBiases[familyId] = (state.familyBiases[familyId] || 0) + bias;
  }

  formation.applyStart?.(session);

  for (const bondId of build.activeBondIds) {
    bondById(bondId)?.applyStart?.(session);
  }
}

export function cardsForDeck(build: BattleBuild) {
  return cardsByIds(build.deckCardIds);
}

export function cardsForFormation(build: BattleBuild) {
  const formation = formationById(build.formationId);
  const tags = new Set(formation.tags);
  for (const bondId of build.activeBondIds) {
    const bond = bondById(bondId);
    for (const cardId of bond?.unlockedCardIds || []) {
      const card = upgradeCards.find((item) => item.id === cardId);
      if (card) tags.add(card.tag);
    }
  }

  return upgradeCards.filter((card) => tags.has(card.tag) || build.deckCardIds.includes(card.id));
}

export function coreCandidateCards(session: Session) {
  const state = ensureTacticalState(session);
  return upgradeCards.filter((card) => card.core && state.coreReady[card.core.coreId]);
}

export function updateCoreProgressForCard(session: Session, card: UpgradeCard) {
  const state = ensureTacticalState(session);
  const build = session.battleBuild;
  const tags = new Set<string>([card.tag]);
  if (card.familyId) tags.add(card.familyId);

  const coreMap: Record<string, { tags: string[]; threshold: number }> = {
    rebound_fracture: { tags: ["反弹", "多弹", "弹珠", "rebound_core", "split_swarm"], threshold: 4 },
    pyro_chain_core: { tags: ["燃烧", "爆炸", "经济", "pyro_chain"], threshold: 4 },
    static_frost_core: { tags: ["连锁", "控制", "暴击", "static_control"], threshold: 4 },
    swarm_growth: { tags: ["多弹", "弹珠", "split_swarm"], threshold: 3 },
    boss_hunter_core: { tags: ["Boss", "暴击", "角色", "critical_math"], threshold: 3 },
    last_line_core: { tags: ["生存", "控制"], threshold: 3 },
  };

  for (const [coreId, config] of Object.entries(coreMap)) {
    const bondUnlock = build.activeBondIds.some((bondId) => bondById(bondId)?.unlockedCoreIds?.includes(coreId));
    const formationBias = formationById(build.formationId).coreBiases?.[coreId] !== undefined;
    const relevant = config.tags.some((tag) => tags.has(tag)) || bondUnlock || formationBias;
    if (!relevant) continue;
    state.coreProgress[coreId] = Math.min(config.threshold, (state.coreProgress[coreId] || 0) + 1);
    if (state.coreProgress[coreId] >= config.threshold) state.coreReady[coreId] = true;
  }

  if (card.core?.type === "main") {
    build.mainCoreId = card.core.coreId;
    for (const key of Object.keys(state.coreReady)) {
      if (key !== card.core.coreId) state.coreReady[key] = false;
    }
  }

  if (card.core?.type === "sub" && !build.subCoreIds.includes(card.core.coreId)) {
    build.subCoreIds = [...build.subCoreIds, card.core.coreId].slice(0, 2);
  }
}

export function combatBuildSummary(build: BattleBuild) {
  const formation = formationById(build.formationId);
  const deck = tacticalDeckById(build.deckId);
  const bondNames = build.activeBondIds.map((id) => bondById(id)?.name).filter(Boolean);
  return {
    formation,
    deck,
    bondNames,
    tags: build.buildTags,
  };
}

function recommendedDeckForBuild(deckId: TacticalDeckId, formation: FormationConfig, characters: CharacterRuntime[]): TacticalDeckConfig {
  const explicit = tacticalDeckById(deckId);
  if (explicit.id !== "auto" && explicit.cardIds.length > 0) return explicit;

  const formationDeck = tacticalDeckById(formation.recommendedDeckId);
  if (formationDeck.id !== "auto") return formationDeck;

  const marbleTags = new Set(characters.flatMap((character) => character.marbles.flatMap((id) => marbleConfigs[id].tags)));
  if (marbleTags.has("explosive") || marbleTags.has("elemental")) return tacticalDeckById("pyro");
  if (marbleTags.has("control") || marbleTags.has("chain")) return tacticalDeckById("magnetic");
  return tacticalDecks.find((deck) => deck.id === "rebound") || tacticalDecks[0];
}

function deckForSavePreference(save: SaveData, formation: FormationConfig, characters: CharacterRuntime[]): TacticalDeckConfig {
  if (save.preferences.tacticalDeckId === "custom" && save.customTacticalDeck.cardIds.length > 0) {
    return save.customTacticalDeck;
  }
  return recommendedDeckForBuild(save.preferences.tacticalDeckId, formation, characters);
}

function collectBuildTags(formation: FormationConfig, deck: TacticalDeckConfig, characters: CharacterRuntime[], bondIds: BondId[]) {
  const tags = new Set<string>([...formation.tags, ...deck.tagHints]);
  for (const character of characters) {
    tags.add(character.role);
    for (const marbleId of character.marbles) {
      for (const tag of marbleConfigs[marbleId].tags) tags.add(tag);
      tags.add(marbleConfigs[marbleId].name.replace("弹珠", ""));
    }
  }
  for (const bondId of bondIds) {
    const bond = bondById(bondId);
    if (bond) tags.add(bond.name);
  }
  return [...tags].slice(0, 9);
}

function dedupeCardIds(ids: string[]) {
  const known = new Set(upgradeCards.map((card) => card.id));
  const seen = new Set<string>();
  return ids.filter((id) => {
    if (!known.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function cardsByIds(ids: string[]) {
  const order = new Map(ids.map((id, index) => [id, index]));
  return upgradeCards
    .filter((card) => order.has(card.id))
    .sort((a, b) => (order.get(a.id) || 0) - (order.get(b.id) || 0));
}
