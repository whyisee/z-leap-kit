import { characters } from "../config/characters";
import { cosmeticConfigs, cosmeticPools } from "../config/cosmetics";
import { collectibleConfigs } from "../config/loot";
import { marbleConfigs } from "../config/marbles";
import { getStageById, getStageByIndex, stages } from "../config/stages";
import { BASE_GEM_SLOTS, CHARACTER_SKILL_MAX_LEVEL, HERO_MAX_LEVEL, MARBLE_MAX_LEVEL, STORAGE_KEY } from "../core/constants";
import { clamp } from "../core/math";
import type {
  AutoExtractionMode,
  AutoRunMode,
  AutoUpgradeMode,
  CharacterConfig,
  CharacterMarbleLoadout,
  CharacterProgress,
  CharacterSortMode,
  CosmeticEffectIntensity,
  CosmeticSaveState,
  CosmeticTicketId,
  GamePreferences,
  InventoryData,
  MarbleId,
  SaveData,
  ShopTicketId,
  Speed,
  StageProgress,
  ShopState,
} from "../core/types";
import { parseGemKey } from "../systems/loot/gems";
import { defaultPvpRanks, normalizePvpRanks } from "../systems/pvp/rank";

export function defaultSave(): SaveData {
  const firstStage = stages[0]?.id || "c1s1";
  return {
    coins: 180,
    energyCrystals: 0,
    pvpCoins: 0,
    pvpRanks: defaultPvpRanks(),
    shards: 0,
    runs: 0,
    wins: 0,
    bestWave: 0,
    bestEndlessWave: 0,
    selectedStage: firstStage,
    progress: defaultStageProgress(),
    upgrades: {},
    characters: defaultCharacterProgressMap(),
    lineup: defaultLineup(),
    inventory: defaultInventory(),
    marbleLevels: defaultMarbleLevels(),
    characterMarbles: defaultCharacterMarbles(),
    baseGems: Array.from({ length: BASE_GEM_SLOTS }, () => null),
    tickets: defaultTickets(),
    preferences: defaultPreferences(),
    shop: defaultShopState(),
    collectionRewards: {},
    cosmetics: defaultCosmetics(),
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSave();
    return normalizeSave({ ...defaultSave(), ...JSON.parse(raw) });
  } catch {
    return defaultSave();
  }
}

export function saveGame(save: SaveData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
}

export function normalizeSave(save: SaveData): SaveData {
  const defaults = defaultSave();
  const progress = normalizeStageProgress(save.progress || defaults.progress);
  const selectedStage = normalizeSelectedStage(save.selectedStage || defaults.selectedStage, progress);
  const normalized: SaveData = {
    ...defaults,
    ...save,
    coins: Math.max(0, Math.floor(Number(save.coins ?? defaults.coins))),
    energyCrystals: Math.max(0, Math.floor(Number(save.energyCrystals ?? defaults.energyCrystals))),
    pvpCoins: Math.max(0, Math.floor(Number(save.pvpCoins ?? defaults.pvpCoins))),
    pvpRanks: normalizePvpRanks(save.pvpRanks || defaults.pvpRanks),
    bestWave: Math.max(0, Math.floor(Number(save.bestWave ?? defaults.bestWave))),
    bestEndlessWave: Math.max(0, Math.floor(Number(save.bestEndlessWave ?? defaults.bestEndlessWave))),
    selectedStage,
    progress,
    upgrades: save.upgrades || {},
    characters: {
      ...defaults.characters,
      ...(save.characters || {}),
    },
    inventory: normalizeInventory(save.inventory || defaults.inventory),
    marbleLevels: {
      ...defaults.marbleLevels,
      ...(save.marbleLevels || {}),
    },
    characterMarbles: normalizeCharacterMarbles(save.characterMarbles || defaults.characterMarbles),
    baseGems: normalizeBaseGems(save.baseGems || defaults.baseGems),
    tickets: normalizeTickets(save.tickets || defaults.tickets),
    lineup: normalizeLineup(save.lineup || defaults.lineup, save.characters || defaults.characters),
    preferences: normalizePreferences(save.preferences || defaults.preferences),
    shop: normalizeShopState(save.shop || defaults.shop),
    collectionRewards: normalizeCollectionRewards(save.collectionRewards || defaults.collectionRewards),
    cosmetics: normalizeCosmetics(save.cosmetics || defaults.cosmetics),
  };

  for (const character of characters) {
    const defaultProgress = defaultCharacterProgress(!character.unlock);
    const current = normalized.characters[character.id] || defaultProgress;
    normalized.characters[character.id] = {
      owned: current.owned ?? defaultProgress.owned,
      level: clamp(Math.floor(current.level || 1), 1, HERO_MAX_LEVEL),
      skillLevel: clamp(Math.floor(current.skillLevel || 1), 1, CHARACTER_SKILL_MAX_LEVEL),
      routes: current.routes || {},
    };

    for (const route of character.routes) {
      const value = normalized.characters[character.id].routes[route.id] || 0;
      normalized.characters[character.id].routes[route.id] = clamp(Math.floor(value), 0, route.max);
    }
  }

  syncCharacterUnlocks(normalized);
  normalized.lineup = normalizeLineup(normalized.lineup, normalized.characters);
  normalized.marbleLevels = normalizeMarbleLevels(normalized.marbleLevels);
  normalized.characterMarbles = normalizeCharacterMarbles(normalized.characterMarbles);
  normalized.baseGems = normalizeBaseGems(normalized.baseGems);
  return normalized;
}

function normalizeCollectionRewards(rewards: Record<string, boolean> = {}) {
  return Object.fromEntries(
    Object.entries(rewards)
      .filter(([id]) => typeof id === "string" && id.length > 0)
      .map(([id, claimed]) => [id, Boolean(claimed)]),
  );
}

export function defaultInventory(): InventoryData {
  return {
    collectibles: {},
    marbleShards: {},
    gems: {},
  };
}

export function defaultTickets(): Partial<Record<ShopTicketId, number>> {
  return {
    insurance: 0,
    scan: 0,
    refresh: 0,
  };
}

export function normalizeTickets(tickets: Partial<Record<ShopTicketId, number>> = {}) {
  const normalized = defaultTickets();
  for (const id of Object.keys(normalized) as ShopTicketId[]) {
    normalized[id] = Math.max(0, Math.floor(Number(tickets[id] || 0)));
  }
  return normalized;
}

export function defaultCosmetics(): CosmeticSaveState {
  return {
    owned: {},
    equippedCharacters: {},
    equippedMarbles: {},
    tickets: {
      characterCosmetic: 3,
      marbleCosmetic: 3,
    },
    prismDust: 0,
    pity: Object.fromEntries(Object.keys(cosmeticPools).map((id) => [id, { sinceEpic: 0, sinceLegendary: 0 }])),
    history: [],
  };
}

export function normalizeCosmetics(cosmetics: Partial<CosmeticSaveState> = {}): CosmeticSaveState {
  const defaults = defaultCosmetics();
  const owned: Record<string, number> = {};
  for (const [id, count] of Object.entries(cosmetics.owned || {})) {
    if (!cosmeticConfigs[id]) continue;
    owned[id] = Math.max(1, Math.floor(Number(count || 1)));
  }

  const equippedCharacters: Record<string, string> = {};
  for (const [characterId, cosmeticId] of Object.entries(cosmetics.equippedCharacters || {})) {
    const cosmetic = cosmeticConfigs[cosmeticId];
    if (cosmetic?.type === "character" && cosmetic.targetId === characterId && owned[cosmeticId]) {
      equippedCharacters[characterId] = cosmeticId;
    }
  }

  const equippedMarbles: CosmeticSaveState["equippedMarbles"] = {};
  for (const [marbleId, cosmeticId] of Object.entries(cosmetics.equippedMarbles || {})) {
    const cosmetic = cosmeticConfigs[cosmeticId];
    if (cosmetic?.type === "marble" && cosmetic.targetId === marbleId && owned[cosmeticId] && marbleId in marbleConfigs) {
      equippedMarbles[marbleId as MarbleId] = cosmeticId;
    }
  }

  const tickets = { ...defaults.tickets };
  for (const id of Object.keys(tickets) as CosmeticTicketId[]) {
    tickets[id] = Math.max(0, Math.floor(Number(cosmetics.tickets?.[id] ?? defaults.tickets[id])));
  }

  const pity = { ...defaults.pity };
  for (const poolId of Object.keys(cosmeticPools)) {
    const current = cosmetics.pity?.[poolId];
    pity[poolId] = {
      sinceEpic: Math.max(0, Math.floor(Number(current?.sinceEpic || 0))),
      sinceLegendary: Math.max(0, Math.floor(Number(current?.sinceLegendary || 0))),
    };
  }

  const history = (cosmetics.history || [])
    .filter((entry) => cosmeticConfigs[entry.itemId] && cosmeticPools[entry.poolId])
    .slice(-50)
    .map((entry) => ({
      poolId: entry.poolId,
      itemId: entry.itemId,
      rarity: cosmeticConfigs[entry.itemId].rarity,
      duplicate: Boolean(entry.duplicate),
      at: Math.max(0, Math.floor(Number(entry.at || Date.now()))),
    }));

  return {
    owned,
    equippedCharacters,
    equippedMarbles,
    tickets,
    prismDust: Math.max(0, Math.floor(Number(cosmetics.prismDust || 0))),
    pity,
    history,
  };
}

export function defaultShopState(date = new Date()): ShopState {
  return {
    dailyKey: shopDateKey(date),
    weeklyKey: shopWeekKey(date),
    purchased: {},
    manualRefreshCount: 0,
    shardOfferIds: [],
  };
}

export function normalizeShopState(shop: Partial<ShopState> = {}, date = new Date()): ShopState {
  const dailyKey = shopDateKey(date);
  const weeklyKey = shopWeekKey(date);
  const sameDay = shop.dailyKey === dailyKey;

  return {
    dailyKey,
    weeklyKey,
    purchased: normalizePurchasedMap(shop.purchased),
    manualRefreshCount: sameDay ? clamp(Math.floor(shop.manualRefreshCount || 0), 0, 3) : 0,
    shardOfferIds: sameDay ? [...(shop.shardOfferIds || [])].filter((id) => typeof id === "string").slice(0, 3) : [],
  };
}

export function shopDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shopWeekKey(date = new Date()) {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const dayOffset = Math.floor((date.getTime() - firstDay.getTime()) / 86400000);
  const week = Math.floor((dayOffset + firstDay.getDay()) / 7) + 1;
  return `${date.getFullYear()}-${`${week}`.padStart(2, "0")}`;
}

function normalizePurchasedMap(purchased: Partial<Record<string, number>> = {}) {
  return Object.fromEntries(
    Object.entries(purchased)
      .filter(([id]) => typeof id === "string" && id.length > 0)
      .map(([id, count]) => [id, Math.max(0, Math.floor(Number(count) || 0))]),
  );
}

export function defaultStageProgress(): StageProgress {
  return {
    unlockedStage: 1,
    clearedStages: {},
  };
}

export function defaultPreferences(): GamePreferences {
  return {
    autoBattleEnabled: false,
    autoUpgradeMode: "defense",
    autoExtractionMode: "balanced",
    autoRunMode: "manual",
    autoSkillEnabled: true,
    battleSpeed: 1,
    characterSortMode: "power",
    cosmeticEffectIntensity: "medium",
  };
}

export function normalizePreferences(preferences: Partial<GamePreferences> = {}): GamePreferences {
  const defaults = defaultPreferences();
  const autoUpgradeModes: AutoUpgradeMode[] = ["rarity", "attack", "defense", "income"];
  const autoExtractionModes: AutoExtractionMode[] = ["safe", "balanced", "deep", "clear"];
  const autoRunModes: AutoRunMode[] = ["manual", "advance", "repeat"];
  const characterSortModes: CharacterSortMode[] = ["level", "rarity", "power", "attack"];
  const cosmeticEffectIntensities: CosmeticEffectIntensity[] = ["low", "medium", "high"];
  const speeds: Speed[] = [1, 2, 4];

  return {
    autoBattleEnabled: Boolean(preferences.autoBattleEnabled ?? defaults.autoBattleEnabled),
    autoUpgradeMode: autoUpgradeModes.includes(preferences.autoUpgradeMode as AutoUpgradeMode) ? (preferences.autoUpgradeMode as AutoUpgradeMode) : defaults.autoUpgradeMode,
    autoExtractionMode: autoExtractionModes.includes(preferences.autoExtractionMode as AutoExtractionMode)
      ? (preferences.autoExtractionMode as AutoExtractionMode)
      : defaults.autoExtractionMode,
    autoRunMode: autoRunModes.includes(preferences.autoRunMode as AutoRunMode) ? (preferences.autoRunMode as AutoRunMode) : defaults.autoRunMode,
    autoSkillEnabled: Boolean(preferences.autoSkillEnabled ?? defaults.autoSkillEnabled),
    battleSpeed: speeds.includes(preferences.battleSpeed as Speed) ? (preferences.battleSpeed as Speed) : defaults.battleSpeed,
    characterSortMode: characterSortModes.includes(preferences.characterSortMode as CharacterSortMode)
      ? (preferences.characterSortMode as CharacterSortMode)
      : defaults.characterSortMode,
    cosmeticEffectIntensity: cosmeticEffectIntensities.includes(preferences.cosmeticEffectIntensity as CosmeticEffectIntensity)
      ? (preferences.cosmeticEffectIntensity as CosmeticEffectIntensity)
      : defaults.cosmeticEffectIntensity,
  };
}

export function normalizeStageProgress(progress: StageProgress): StageProgress {
  const unlockedStage = clamp(Math.floor(progress.unlockedStage || 1), 1, stages.length);
  const clearedStages: StageProgress["clearedStages"] = {};

  for (const stage of stages) {
    const record = progress.clearedStages?.[stage.id];
    if (!record) continue;
    clearedStages[stage.id] = {
      bestWave: clamp(Math.floor(record.bestWave || 0), 0, 20),
      cleared: Boolean(record.cleared),
      bestTime: Math.max(0, Number(record.bestTime || 0)),
      stars: clamp(Math.floor(record.stars || 0), 0, 3),
    };
  }

  return { unlockedStage, clearedStages };
}

function normalizeSelectedStage(stageId: string, progress: StageProgress) {
  const candidate = getStageById(stageId);
  if (candidate.index <= progress.unlockedStage) return candidate.id;
  return getStageByIndex(progress.unlockedStage).id;
}

export function defaultMarbleLevels(): Partial<Record<MarbleId, number>> {
  return Object.fromEntries(Object.keys(marbleConfigs).map((id) => [id, 1])) as Partial<Record<MarbleId, number>>;
}

export function normalizeInventory(inventory: InventoryData): InventoryData {
  const normalized = defaultInventory();

  for (const id of Object.keys(collectibleConfigs)) {
    normalized.collectibles[id as keyof typeof collectibleConfigs] = Math.max(0, Math.floor(inventory.collectibles?.[id as keyof typeof collectibleConfigs] || 0));
  }

  for (const id of Object.keys(marbleConfigs) as MarbleId[]) {
    normalized.marbleShards[id] = Math.max(0, Math.floor(inventory.marbleShards?.[id] || 0));
  }

  for (const [key, count] of Object.entries(inventory.gems || {})) {
    if (!parseGemKey(key)) continue;
    normalized.gems[key] = Math.max(0, Math.floor(count || 0));
  }

  return normalized;
}

export function normalizeMarbleLevels(levels: Partial<Record<MarbleId, number>>) {
  const normalized = defaultMarbleLevels();
  for (const id of Object.keys(marbleConfigs) as MarbleId[]) {
    normalized[id] = clamp(Math.floor(levels[id] || 1), 1, MARBLE_MAX_LEVEL);
  }
  return normalized;
}

export function defaultCharacterMarbles(): Record<string, CharacterMarbleLoadout> {
  return Object.fromEntries(characters.map((character) => [character.id, [...character.marbles] as CharacterMarbleLoadout]));
}

export function normalizeCharacterMarbles(
  loadouts: Partial<Record<string, MarbleId[] | CharacterMarbleLoadout>> = {},
): Record<string, CharacterMarbleLoadout> {
  const marbleIds = Object.keys(marbleConfigs) as MarbleId[];
  const normalized: Record<string, CharacterMarbleLoadout> = {};

  for (const character of characters) {
    const candidate = Array.isArray(loadouts[character.id]) ? loadouts[character.id] : character.marbles;
    const first = validMarbleId(candidate?.[0]) ? candidate[0] : character.marbles[0];
    const fallbackSecond = character.marbles.find((id) => id !== first) || marbleIds.find((id) => id !== first) || character.marbles[1];
    const second = validMarbleId(candidate?.[1]) && candidate[1] !== first ? candidate[1] : fallbackSecond;
    normalized[character.id] = [first, second];
  }

  return normalized;
}

function validMarbleId(id: unknown): id is MarbleId {
  return typeof id === "string" && id in marbleConfigs;
}

export function normalizeBaseGems(gems: Array<string | null> = []) {
  return Array.from({ length: BASE_GEM_SLOTS }, (_, index) => {
    const key = gems[index];
    return key && parseGemKey(key) ? key : null;
  });
}

export function defaultCharacterProgressMap() {
  return Object.fromEntries(characters.map((character) => [character.id, defaultCharacterProgress(!character.unlock)]));
}

export function defaultCharacterProgress(owned: boolean): CharacterProgress {
  return {
    owned,
    level: 1,
    skillLevel: 1,
    routes: {},
  };
}

export function defaultLineup() {
  return characters
    .filter((character) => !character.unlock)
    .slice(0, 3)
    .map((character) => character.id);
}

export function normalizeLineup(lineup: string[] = defaultLineup(), progressMap: Record<string, CharacterProgress> = {}) {
  const ownedIds = characters
    .filter((character) => progressMap[character.id]?.owned ?? !character.unlock)
    .map((character) => character.id);
  const valid = lineup.filter((id, index) => ownedIds.includes(id) && lineup.indexOf(id) === index);

  return valid.length > 0 ? valid.slice(0, 3) : defaultLineup();
}

export function characterUnlockMet(character: CharacterConfig, save: SaveData) {
  if (!character.unlock) return true;

  if (character.unlock.type === "stage") {
    return save.progress.unlockedStage >= character.unlock.stage;
  }

  if (character.unlock.type === "wins") {
    return save.wins >= character.unlock.wins;
  }

  return (save.inventory.collectibles[character.unlock.collectible] || 0) >= character.unlock.amount;
}

export function syncCharacterUnlocks(save: SaveData) {
  const unlocked: CharacterConfig[] = [];

  for (const character of characters) {
    save.characters[character.id] ||= defaultCharacterProgress(!character.unlock);
    if (!save.characters[character.id].owned && characterUnlockMet(character, save)) {
      save.characters[character.id].owned = true;
      unlocked.push(character);
    }
  }

  return unlocked;
}
