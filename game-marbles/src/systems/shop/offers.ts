import { characters } from "../../config/characters";
import { collectibleConfigs, gemConfigs } from "../../config/loot";
import { marbleConfigs } from "../../config/marbles";
import { arenaShopItems, bundleShopItems, crystalShopItems, dailyShopItems, gemShopItems, shardShopItems, shopItems } from "../../config/shop";
import { MARBLE_MAX_LEVEL } from "../../core/constants";
import type { CurrencyId, MarbleId, SaveData, ShopCategory, ShopItemConfig, ShopPrice, ShopReward, ShopTicketId } from "../../core/types";
import { defaultCharacterProgress, shopDateKey, shopWeekKey } from "../../state/save";
import { gemKey } from "../loot/gems";
import { pvpRankMeetsRequirement, pvpRankRequirementLabel } from "../pvp/rank";

const MAX_DAILY_SHARD_REFRESHES = 3;
const BASE_SHARD_REFRESH_COST = 12;
const SHARD_REFRESH_COST_STEP = 8;

export type ShopPurchaseResult = {
  ok: boolean;
  message: string;
};

export function ensureShopState(save: SaveData) {
  const dailyKey = shopDateKey();
  const weeklyKey = shopWeekKey();
  const dayChanged = !save.shop || save.shop.dailyKey !== dailyKey;

  if (!save.shop) {
    save.shop = {
      dailyKey,
      weeklyKey,
      purchased: {},
      manualRefreshCount: 0,
      shardOfferIds: [],
    };
  }

  save.shop.dailyKey = dailyKey;
  save.shop.weeklyKey = weeklyKey;
  save.shop.purchased ||= {};
  save.shop.manualRefreshCount = dayChanged ? 0 : Math.max(0, Math.min(MAX_DAILY_SHARD_REFRESHES, Math.floor(save.shop.manualRefreshCount || 0)));
  save.shop.shardOfferIds = dayChanged ? [] : save.shop.shardOfferIds || [];
  save.shop.shardOfferIds = normalizeShardOfferIds(save);
  save.tickets ||= {};
  return save.shop;
}

export function shopItemsForCategory(save: SaveData, category: ShopCategory) {
  ensureShopState(save);
  if (category === "recommended") return recommendedShopItems(save);
  if (category === "daily") return dailyShopItems;
  if (category === "growth") {
    const shardOffers = save.shop.shardOfferIds
      .map((id) => shopItemById(id))
      .filter((item): item is ShopItemConfig => Boolean(item));
    return [...shardOffers, ...gemShopItems];
  }
  if (category === "arena") return arenaShopItems;
  if (category === "crystal") return crystalShopItems;
  if (category === "bundles") return bundleShopItems;
  return [];
}

export function shopItemById(id: string) {
  return shopItems.find((item) => item.id === id);
}

export function shopItemPrice(save: SaveData, item: ShopItemConfig): ShopPrice {
  if (item.category !== "growth") return item.price;
  const marbleId = shopItemMarbleId(item);
  if (!marbleId) return item.price;
  const level = Math.max(1, Math.floor(save.marbleLevels?.[marbleId] || 1));
  const priceStep = item.price.currency === "coins" ? 20 : 1;
  return {
    ...item.price,
    amount: item.price.amount + Math.max(0, Math.floor((level - 1) / 4)) * priceStep,
  };
}

export function shopStockLeft(save: SaveData, item: ShopItemConfig) {
  ensureShopState(save);
  return Math.max(0, item.stock - (save.shop.purchased[purchaseKey(save, item)] || 0));
}

export function shopItemLocked(save: SaveData, item: ShopItemConfig) {
  const unlock = item.unlock;
  if (!unlock) return "";
  if (unlock.type === "pvpRank") {
    const profile = save.pvpRanks?.[unlock.mode];
    const division = unlock.division ?? 3;
    if (profile && pvpRankMeetsRequirement(profile, unlock.tier, division)) return "";
    return unlock.desc || `达到${pvpRankRequirementLabel(unlock.tier, division)}解锁`;
  }
  if (unlock.type === "stage") return save.progress.unlockedStage >= unlock.value ? "" : unlock.desc;
  return save.wins >= unlock.value ? "" : unlock.desc;
}

export function shopItemDisabledReason(save: SaveData, item: ShopItemConfig) {
  const locked = shopItemLocked(save, item);
  if (locked) return locked;
  if (shopStockLeft(save, item) <= 0) return item.refresh === "once" ? "已拥有或已购买" : "库存已售罄";
  if (item.rewards.some((reward) => reward.type === "characterUnlock" && characterOwned(save, reward.characterId))) return "角色已拥有";

  const price = shopItemPrice(save, item);
  if (currencyAmount(save, price.currency) < price.amount) return `${currencyName(price.currency)}不足`;

  const marbleId = shopItemMarbleId(item);
  if (marbleId && (save.marbleLevels?.[marbleId] || 1) >= MARBLE_MAX_LEVEL) return "该弹珠已满级";

  return "";
}

export function shopRefreshCost(save: SaveData) {
  ensureShopState(save);
  return BASE_SHARD_REFRESH_COST + save.shop.manualRefreshCount * SHARD_REFRESH_COST_STEP;
}

export function shopRefreshLeft(save: SaveData) {
  ensureShopState(save);
  return Math.max(0, MAX_DAILY_SHARD_REFRESHES - save.shop.manualRefreshCount);
}

export function refreshShardShop(save: SaveData): ShopPurchaseResult {
  ensureShopState(save);
  if (save.shop.manualRefreshCount >= MAX_DAILY_SHARD_REFRESHES) {
    return { ok: false, message: "今日刷新次数已用完" };
  }

  const cost = shopRefreshCost(save);
  if (save.energyCrystals < cost) return { ok: false, message: "能源晶体不足，无法刷新成长货架" };

  save.energyCrystals -= cost;
  save.shop.manualRefreshCount += 1;
  save.shop.shardOfferIds = buildShardOfferIds(save);
  return { ok: true, message: `成长货架已刷新，消耗 ${cost} 能源晶体` };
}

export function purchaseShopItem(save: SaveData, id: string): ShopPurchaseResult {
  const item = shopItemById(id);
  if (!item) return { ok: false, message: "商品不存在" };
  ensureShopState(save);

  const disabledReason = shopItemDisabledReason(save, item);
  if (disabledReason) return { ok: false, message: disabledReason };

  const price = shopItemPrice(save, item);
  spendCurrency(save, price);
  const labels = grantShopRewards(save, item.rewards);
  const key = purchaseKey(save, item);
  save.shop.purchased[key] = (save.shop.purchased[key] || 0) + 1;

  const rewardText = labels.length ? `：${labels.join("、")}` : "";
  return {
    ok: true,
    message: `${price.amount > 0 ? "购买" : "领取"} ${item.name}${rewardText}`,
  };
}

export function shopRewardSummary(rewards: ShopReward[]) {
  return rewards.map((reward) => shopRewardLabel(reward)).join(" · ");
}

export function shopItemColor(item: ShopItemConfig) {
  const price = item.price;
  if (price.currency === "energyCrystals" && price.amount > 0) return "#9f79ff";
  if (price.currency === "pvpCoins") return "#54c7ff";
  const reward = item.rewards[0];
  if (!reward) return "#54c7ff";
  if (reward.type === "marbleShard") return marbleConfigs[reward.marbleId].color;
  if (reward.type === "gem") return gemConfigs[reward.gemType].color;
  if (reward.type === "collectible") return collectibleConfigs[reward.collectibleId].rarity === "rare" ? "#54c7ff" : "#f6c95f";
  if (reward.type === "coins") return "#f6c95f";
  if (reward.type === "characterUnlock") return characters.find((character) => character.id === reward.characterId)?.color || "#b68cff";
  return "#61e6a8";
}

export function shopItemBadge(item: ShopItemConfig) {
  if (item.price.amount <= 0) return "免费";
  if (item.category === "arena") return "竞技";
  if (item.category === "growth") return "成长";
  if (item.category === "crystal") return "晶体";
  if (item.category === "bundles") return item.refresh === "once" ? "一次" : "限购";
  return "补给";
}

export function shopPriceText(price: ShopPrice) {
  if (price.amount <= 0) return "领取";
  return `${price.amount} ${currencyName(price.currency)}`;
}

export function currencyName(currency: CurrencyId) {
  if (currency === "energyCrystals") return "能源晶体";
  if (currency === "pvpCoins") return "竞技币";
  return "金币";
}

function recommendedShopItems(save: SaveData) {
  const items: ShopItemConfig[] = [];
  const push = (item: ShopItemConfig | undefined) => {
    if (item && !items.some((current) => current.id === item.id)) items.push(item);
  };

  push(dailyShopItems.find((item) => shopStockLeft(save, item) > 0) || dailyShopItems[0]);
  push(dailyShopItems.find((item) => item.price.currency === "coins" && shopStockLeft(save, item) > 0));
  const growthItems = shopItemsForCategory(save, "growth");
  push(growthItems.find((item) => item.rewards.some((reward) => reward.type === "marbleShard") && shopStockLeft(save, item) > 0));
  push(growthItems.find((item) => item.rewards.some((reward) => reward.type === "gem") && shopStockLeft(save, item) > 0));
  push(crystalShopItems.find((item) => item.rewards.some((reward) => reward.type === "characterUnlock" && !characterOwned(save, reward.characterId))));
  if (items.length < 5) push(bundleShopItems.find((item) => shopStockLeft(save, item) > 0));
  if (items.length < 5) push(crystalShopItems.find((item) => item.rewards.some((reward) => reward.type === "ticket") && shopStockLeft(save, item) > 0));

  return items.slice(0, 5);
}

function normalizeShardOfferIds(save: SaveData) {
  const validIds = new Set(eligibleShardItems(save).map((item) => item.id));
  const current = (save.shop?.shardOfferIds || []).filter((id, index, list) => validIds.has(id) && list.indexOf(id) === index);
  if (current.length >= Math.min(3, validIds.size)) return current.slice(0, 3);
  return buildShardOfferIds(save);
}

function buildShardOfferIds(save: SaveData) {
  const seed = `${save.shop.dailyKey}:${save.shop.manualRefreshCount}:${save.runs}:${save.progress.unlockedStage}`;
  return eligibleShardItems(save)
    .map((item) => {
      const marbleId = shopItemMarbleId(item);
      const level = marbleId ? save.marbleLevels?.[marbleId] || 1 : 1;
      return {
        item,
        score: level * 100000 + stableHash(`${seed}:${item.id}`),
      };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map(({ item }) => item.id);
}

function eligibleShardItems(save: SaveData) {
  return shardShopItems.filter((item) => {
    const marbleId = shopItemMarbleId(item);
    return marbleId ? (save.marbleLevels?.[marbleId] || 1) < MARBLE_MAX_LEVEL : true;
  });
}

function shopItemMarbleId(item: ShopItemConfig) {
  return item.rewards.find((reward): reward is Extract<ShopReward, { type: "marbleShard" }> => reward.type === "marbleShard")?.marbleId;
}

function purchaseKey(save: SaveData, item: ShopItemConfig) {
  if (item.refresh === "once") return `once:${item.id}`;
  if (item.refresh === "weekly") return `weekly:${save.shop.weeklyKey}:${item.id}`;
  return `daily:${save.shop.dailyKey}:${item.id}`;
}

function currencyAmount(save: SaveData, currency: CurrencyId) {
  if (currency === "pvpCoins") return Math.max(0, Math.floor(Number(save.pvpCoins) || 0));
  return currency === "energyCrystals" ? save.energyCrystals : save.coins;
}

function spendCurrency(save: SaveData, price: ShopPrice) {
  if (price.currency === "pvpCoins") {
    save.pvpCoins = Math.max(0, Math.floor(Number(save.pvpCoins) || 0)) - price.amount;
  } else if (price.currency === "energyCrystals") {
    save.energyCrystals -= price.amount;
  } else {
    save.coins -= price.amount;
  }
}

function grantShopRewards(save: SaveData, rewards: ShopReward[]) {
  const labels: string[] = [];
  save.inventory.collectibles ||= {};
  save.inventory.marbleShards ||= {};
  save.inventory.gems ||= {};
  save.tickets ||= {};

  for (const reward of rewards) {
    if (reward.type === "coins") {
      save.coins += reward.amount;
      labels.push(`金币 ${reward.amount}`);
    }

    if (reward.type === "pvpCoins") {
      save.pvpCoins = Math.max(0, Math.floor(Number(save.pvpCoins) || 0)) + reward.amount;
      labels.push(`竞技币 ${reward.amount}`);
    }

    if (reward.type === "energyCrystals") {
      save.energyCrystals += reward.amount;
      labels.push(`能源晶体 ${reward.amount}`);
    }

    if (reward.type === "marbleShard") {
      save.inventory.marbleShards[reward.marbleId] = (save.inventory.marbleShards[reward.marbleId] || 0) + reward.amount;
      labels.push(`${marbleConfigs[reward.marbleId].name}碎片 ${reward.amount}`);
    }

    if (reward.type === "randomMarbleShard") {
      const marbleId = randomRewardMarbleId(save);
      save.inventory.marbleShards[marbleId] = (save.inventory.marbleShards[marbleId] || 0) + reward.amount;
      labels.push(`${marbleConfigs[marbleId].name}碎片 ${reward.amount}`);
    }

    if (reward.type === "gem") {
      const key = gemKey(reward.gemType, reward.level);
      save.inventory.gems[key] = (save.inventory.gems[key] || 0) + reward.amount;
      labels.push(`${gemConfigs[reward.gemType].name} Lv.${reward.level}`);
    }

    if (reward.type === "collectible") {
      save.inventory.collectibles[reward.collectibleId] = (save.inventory.collectibles[reward.collectibleId] || 0) + reward.amount;
      labels.push(`${collectibleConfigs[reward.collectibleId].name} ${reward.amount}`);
    }

    if (reward.type === "characterUnlock") {
      const character = characters.find((item) => item.id === reward.characterId);
      if (!character) continue;
      save.characters[reward.characterId] ||= defaultCharacterProgress(false);
      save.characters[reward.characterId].owned = true;
      labels.push(`${character.name} 解锁`);
    }

    if (reward.type === "ticket") {
      save.tickets[reward.ticketId] = (save.tickets[reward.ticketId] || 0) + reward.amount;
      labels.push(`${ticketName(reward.ticketId)} ${reward.amount}`);
    }
  }

  return labels;
}

function characterOwned(save: SaveData, id: string) {
  return Boolean(save.characters[id]?.owned);
}

function randomRewardMarbleId(save: SaveData): MarbleId {
  const candidates = (Object.keys(marbleConfigs) as MarbleId[]).filter((id) => (save.marbleLevels?.[id] || 1) < MARBLE_MAX_LEVEL);
  const pool = candidates.length > 0 ? candidates : (Object.keys(marbleConfigs) as MarbleId[]);
  return pool[Math.floor(Math.random() * pool.length)];
}

function shopRewardLabel(reward: ShopReward) {
  if (reward.type === "coins") return `金币 ${reward.amount}`;
  if (reward.type === "pvpCoins") return `竞技币 ${reward.amount}`;
  if (reward.type === "energyCrystals") return `能源晶体 ${reward.amount}`;
  if (reward.type === "marbleShard") return `${marbleConfigs[reward.marbleId].name}碎片 x${reward.amount}`;
  if (reward.type === "randomMarbleShard") return `随机弹珠碎片 x${reward.amount}`;
  if (reward.type === "gem") return `${gemConfigs[reward.gemType].name} Lv.${reward.level} x${reward.amount}`;
  if (reward.type === "characterUnlock") return `${characters.find((item) => item.id === reward.characterId)?.name || "角色"}解锁`;
  if (reward.type === "ticket") return `${ticketName(reward.ticketId)} x${reward.amount}`;
  return `${collectibleConfigs[reward.collectibleId].name} x${reward.amount}`;
}

function ticketName(id: ShopTicketId) {
  return {
    insurance: "保险券",
    scan: "扫描券",
    refresh: "刷新券",
  }[id];
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
