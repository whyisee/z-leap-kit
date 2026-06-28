import { collectibleConfigs } from "../../config/loot";
import { rarityAutoScore } from "../../core/rarity";
import type { DropEntry, ExtractionResult, InventoryData, Rarity } from "../../core/types";
import { dropFullLabel, dropIconText } from "./drops";
import { gemKey } from "./gems";

export type DropSummaryItem = {
  key?: string;
  label: string;
  amount: number;
  rarity: Rarity;
  icon?: string;
  value?: number;
  insured?: boolean;
};

export function splitDropsForExtraction(drops: DropEntry[], result: ExtractionResult, insuredDropKeys: string[] = []) {
  if (result !== "failed") return { kept: [...drops], lost: [] as DropEntry[] };

  const insured = new Set(insuredDropKeys);
  const kept: DropEntry[] = [];
  const lost: DropEntry[] = [];
  for (const drop of drops) {
    if (insured.has(dropKey(drop))) kept.push(drop);
    else lost.push(drop);
  }
  return { kept, lost };
}

export function dropSummaryRows(drops: DropEntry[], insuredDropKeys: string[] = []) {
  const insured = new Set(insuredDropKeys);
  const map = new Map<string, Required<Pick<DropSummaryItem, "key" | "label" | "amount" | "rarity" | "icon" | "value" | "insured">>>();

  for (const drop of drops) {
    const key = dropKey(drop);
    const current = map.get(key);
    if (current) {
      current.amount += drop.amount;
      current.value += dropValue(drop);
      current.insured = current.insured || insured.has(key);
    } else {
      map.set(key, {
        key,
        label: dropFullLabel(drop),
        amount: drop.amount,
        rarity: drop.rarity,
        icon: dropIconText(drop),
        value: dropValue(drop),
        insured: insured.has(key),
      });
    }
  }

  return [...map.values()].sort((a, b) => Number(b.insured) - Number(a.insured) || b.value - a.value || rarityAutoScore(b.rarity) - rarityAutoScore(a.rarity));
}

export function compactDropSummaryRows(rows: DropSummaryItem[]) {
  const map = new Map<string, DropSummaryItem>();

  for (const row of rows) {
    const key = `${row.label}:${row.insured ? "insured" : "plain"}`;
    const current = map.get(key);
    if (current) {
      current.amount += row.amount;
      current.value = (current.value || 0) + (row.value || 0);
      if (rarityAutoScore(row.rarity) > rarityAutoScore(current.rarity)) current.rarity = row.rarity;
    } else {
      map.set(key, { ...row, key });
    }
  }

  return [...map.values()].sort(
    (a, b) =>
      Number(b.insured) - Number(a.insured) ||
      (b.value || 0) - (a.value || 0) ||
      rarityAutoScore(b.rarity) - rarityAutoScore(a.rarity),
  );
}

export function dropKey(drop: DropEntry) {
  if (drop.type === "collectible") return `c:${drop.id}:${drop.rarity}`;
  if (drop.type === "marbleShard") return `m:${drop.marbleId}:${drop.rarity}`;
  return `g:${drop.gemType}:${drop.level}:${drop.rarity}`;
}

export function dropValue(drop: DropEntry) {
  const rarityMul = {
    common: 1,
    rare: 1.7,
    epic: 3,
    legendary: 5,
  }[drop.rarity];

  if (drop.type === "collectible") return Math.round(collectibleConfigs[drop.id].value * drop.amount * rarityMul);
  if (drop.type === "marbleShard") return Math.round(drop.amount * 6 * rarityMul);
  return Math.round(drop.amount * (42 + drop.level * 34) * rarityMul);
}

export function dropTotalValue(drops: DropEntry[]) {
  return drops.reduce((sum, drop) => sum + dropValue(drop), 0);
}

export function insuredDropCount(drops: DropEntry[], insuredDropKeys: string[]) {
  const validKeys = new Set(dropSummaryRows(drops).map((item) => item.key));
  return insuredDropKeys.filter((key) => validKeys.has(key)).length;
}

export function autoInsuredDropKeys(drops: DropEntry[], slots: number) {
  return dropSummaryRows(drops)
    .slice(0, slots)
    .map((item) => item.key)
    .filter((key): key is string => Boolean(key));
}

export function toggleInsuredDropKey(drops: DropEntry[], insuredDropKeys: string[], key: string, slots: number) {
  const rows = dropSummaryRows(drops, insuredDropKeys);
  const row = rows.find((item) => item.key === key);
  if (!row) return insuredDropKeys;

  const selected = new Set(insuredDropKeys);
  if (selected.has(key)) {
    selected.delete(key);
  } else if (selected.size < slots) {
    selected.add(key);
  } else {
    const selectedRows = rows.filter((item) => item.key && selected.has(item.key)).sort((a, b) => (a.value || 0) - (b.value || 0));
    const lowest = selectedRows[0];
    if (lowest?.key) selected.delete(lowest.key);
    selected.add(key);
  }

  return rows
    .map((item) => item.key)
    .filter((itemKey): itemKey is string => Boolean(itemKey) && selected.has(itemKey))
    .slice(0, slots);
}

export function boostDropRarityForContinue(rarity: Rarity, continueBonus: number, random = Math.random) {
  if (continueBonus <= 0) return rarity;
  if (random() > Math.min(0.28, continueBonus * 0.55)) return rarity;
  return {
    common: "rare",
    rare: "epic",
    epic: "legendary",
    legendary: "legendary",
  }[rarity] as Rarity;
}

export function applyDropsToInventory(inventory: InventoryData, drops: DropEntry[]) {
  for (const drop of drops) {
    if (drop.type === "collectible") {
      inventory.collectibles[drop.id] = (inventory.collectibles[drop.id] || 0) + drop.amount;
    }

    if (drop.type === "marbleShard") {
      inventory.marbleShards[drop.marbleId] = (inventory.marbleShards[drop.marbleId] || 0) + drop.amount;
    }

    if (drop.type === "gem") {
      const key = gemKey(drop.gemType, drop.level);
      inventory.gems[key] = (inventory.gems[key] || 0) + drop.amount;
    }
  }
}
