import type pg from "pg";
import { characters } from "../../src/config/characters";
import { cosmeticConfigs } from "../../src/config/cosmetics";
import { collectibleConfigs } from "../../src/config/loot";
import { marbleConfigs } from "../../src/config/marbles";
import { metaUpgrades } from "../../src/config/meta-upgrades";
import { stages } from "../../src/config/stages";
import { CHARACTER_SKILL_MAX_LEVEL, HERO_MAX_LEVEL, MARBLE_MAX_LEVEL } from "../../src/core/constants";
import type { CharacterConfig, CharacterRouteId, MarbleId, PvpRankMode, PvpRankProfile, SaveData } from "../../src/core/types";
import { parseGemKey } from "../../src/systems/loot/gems";
import { characterLevelCost, characterRouteCost, characterSkillCost } from "../../src/systems/meta/characters";
import { metaCost, upgradeLevel } from "../../src/systems/meta/base-upgrades";
import {
  currentPvpSeason,
  normalizePvpRankProfile,
  pvpRankDisplayLabel,
  pvpRankStep,
} from "../../src/systems/pvp/rank";
import { pool, q } from "./db";

const LEADERBOARD_LIMIT_MAX = 100;
const PVP_DUEL_BOARD_ID = "pvp_duel_season";
const BASE_POWER_BOARD_ID = "base_power_all_time";
const CHARACTER_POWER_BOARD_ID = "character_power_all_time";
const COSMETIC_SCORE_BOARD_ID = "cosmetic_score_all_time";
const CAMPAIGN_PROGRESS_BOARD_ID = "campaign_progress_all_time";
const WEALTH_COINS_BOARD_ID = "wealth_coins_all_time";
const ACHIEVEMENT_COUNT_BOARD_ID = "achievement_count_all_time";
const ALL_TIME_SEASON_ID = "all_time";

const BOARD_CONFIGS = [
  {
    id: PVP_DUEL_BOARD_ID,
    title: "1v1 赛季榜",
    enabled: true,
    mode: "duel",
    period: "season",
  },
  {
    id: BASE_POWER_BOARD_ID,
    title: "基地榜",
    enabled: true,
    mode: "base",
    period: "all_time",
  },
  {
    id: CHARACTER_POWER_BOARD_ID,
    title: "角色榜",
    enabled: true,
    mode: "character",
    period: "all_time",
  },
  {
    id: COSMETIC_SCORE_BOARD_ID,
    title: "幻化榜",
    enabled: true,
    mode: "cosmetic",
    period: "all_time",
  },
  {
    id: CAMPAIGN_PROGRESS_BOARD_ID,
    title: "主线榜",
    enabled: true,
    mode: "campaign",
    period: "all_time",
  },
  {
    id: WEALTH_COINS_BOARD_ID,
    title: "财富榜",
    enabled: true,
    mode: "wealth",
    period: "all_time",
  },
  {
    id: ACHIEVEMENT_COUNT_BOARD_ID,
    title: "成就榜",
    enabled: true,
    mode: "achievement",
    period: "all_time",
  },
  {
    id: "endless_wave_season",
    title: "无尽最高波",
    enabled: false,
    mode: "endless",
    period: "season",
  },
  {
    id: "pvp_battle_royale_season",
    title: "吃鸡赛季榜",
    enabled: false,
    mode: "battle_royale",
    period: "season",
  },
] as const;

type AuthContext = {
  userId: string;
};

type Queryable = Pick<pg.PoolClient, "query">;

type LeaderboardEntryRow = {
  rank: string | number;
  user_id: string;
  nickname: string;
  avatar: string;
  display_score: string;
  metrics: Record<string, unknown>;
  updated_at: Date | string | number;
  score: string | number;
  sort_score: string | number;
};

export function leaderboardCatalog() {
  const season = currentPvpSeason();
  return {
    season: {
      id: season.id,
      startsAt: season.startsAt,
      endsAt: season.endsAt,
    },
    boards: BOARD_CONFIGS.map((board) => ({ ...board })),
    serverTime: Date.now(),
  };
}

export async function handleLeaderboardCatalog(_auth: AuthContext) {
  return leaderboardCatalog();
}

export async function handleLeaderboardList(auth: AuthContext, boardId: string, query: URLSearchParams) {
  const board = normalizeBoardId(boardId);
  const seasonId = sanitizeSeasonId(query.get("seasonId")) || defaultSeasonIdForBoard(board);
  const offset = clampInteger(query.get("offset"), 0, 100_000, 0);
  const limit = clampInteger(query.get("limit"), 1, LEADERBOARD_LIMIT_MAX, 50);

  const [entriesResult, totalResult, me] = await Promise.all([
    pool.query(
      `
        with ranked as (
          ${rankedLeaderboardSql()}
        )
        select *
        from ranked
        order by rank asc
        offset $3
        limit $4
      `,
      [board, seasonId, offset, limit],
    ),
    pool.query(
      `
        select count(*)::int as total
        from ${q("gm_leaderboard_entries")}
        where board_id = $1
          and season_id = $2
          and risk_state = 'normal'
          and (hidden_until is null or hidden_until <= now())
      `,
      [board, seasonId],
    ),
    leaderboardMe(auth.userId, board, seasonId),
  ]);

  return {
    boardId: board,
    seasonId,
    offset,
    limit,
    totalEstimate: Number(totalResult.rows[0]?.total || 0),
    entries: entriesResult.rows.map(formatLeaderboardEntry),
    me,
    serverTime: Date.now(),
  };
}

export async function handleLeaderboardMe(auth: AuthContext, boardId: string, query: URLSearchParams) {
  const board = normalizeBoardId(boardId);
  const seasonId = sanitizeSeasonId(query.get("seasonId")) || defaultSeasonIdForBoard(board);
  const radius = clampInteger(query.get("radius"), 1, 20, 5);
  const me = await leaderboardMe(auth.userId, board, seasonId);
  if (!me?.rank) {
    return {
      boardId: board,
      seasonId,
      entries: [],
      me,
      serverTime: Date.now(),
    };
  }

  const offset = Math.max(0, me.rank - radius - 1);
  const result = await pool.query(
    `
      with ranked as (
        ${rankedLeaderboardSql()}
      )
      select *
      from ranked
      order by rank asc
      offset $3
      limit $4
    `,
    [board, seasonId, offset, radius * 2 + 1],
  );

  return {
    boardId: board,
    seasonId,
    entries: result.rows.map(formatLeaderboardEntry),
    me,
    serverTime: Date.now(),
  };
}

export async function upsertPvpLeaderboardEntry(
  client: pg.PoolClient,
  userId: string,
  mode: PvpRankMode,
  profile: PvpRankProfile,
) {
  if (mode !== "duel") return;
  const normalized = normalizePvpRankProfile(profile);
  if (normalized.placementMatchesLeft > 0) return;

  const boardId = PVP_DUEL_BOARD_ID;
  const seasonId = normalized.seasonId || currentPvpSeason().id;
  const score = leaderboardScore(normalized);
  const sortScore = leaderboardSortScore(normalized);
  const metrics = {
    mode,
    tier: normalized.tier,
    division: normalized.division,
    points: normalized.points,
    masterPoints: normalized.masterPoints,
    wins: normalized.wins,
    losses: normalized.losses,
    winRate: winRate(normalized),
    seasonMatches: normalized.seasonMatches,
    bestWinStreak: normalized.bestWinStreak,
    tie1: normalized.wins,
    tie2: winRate(normalized),
  };

  await upsertLeaderboardEntry(client, userId, {
    boardId,
    seasonId,
    score,
    sortScore,
    displayScore: pvpRankDisplayLabel(normalized),
    metrics,
  });
}

export async function upsertSnapshotLeaderboardEntries(client: Queryable, userId: string, save: SaveData) {
  const entries = snapshotLeaderboardEntries(save);
  for (const entry of entries) {
    await upsertLeaderboardEntry(client, userId, entry);
  }
}

function rankedLeaderboardSql() {
  return `
    select
      rank() over (order by sort_score desc, score desc, tie1_metric desc, tie2_metric desc, updated_at asc) as rank,
      user_id,
      nickname,
      avatar,
      display_score,
      metrics,
      updated_at,
      score,
      sort_score
    from (
      select
        user_id,
        nickname,
        avatar,
        display_score,
        metrics,
        updated_at,
        score,
        sort_score,
        coalesce((metrics->>'tie1')::numeric, (metrics->>'wins')::numeric, 0) as tie1_metric,
        coalesce((metrics->>'tie2')::numeric, (metrics->>'winRate')::numeric, 0) as tie2_metric
      from ${q("gm_leaderboard_entries")}
      where board_id = $1
        and season_id = $2
        and risk_state = 'normal'
        and (hidden_until is null or hidden_until <= now())
    ) entries
  `;
}

async function upsertLeaderboardEntry(
  client: Queryable,
  userId: string,
  entry: {
    boardId: string;
    seasonId: string;
    score: number;
    sortScore: number;
    displayScore: string;
    metrics: Record<string, unknown>;
  },
) {
  if (!Number.isFinite(entry.score) || entry.score <= 0) return;

  const user = await client.query(`select nickname, avatar, status from ${q("gm_users")} where id = $1`, [userId]);
  const row = user.rows[0] || {};
  if (row.status && row.status !== "active") return;

  await client.query(
    `
      insert into ${q("gm_leaderboard_entries")} (
        board_id,
        season_id,
        user_id,
        score,
        sort_score,
        display_score,
        metrics,
        nickname,
        avatar,
        risk_state,
        updated_at
      )
      values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, 'normal', now())
      on conflict (board_id, season_id, user_id) do update
      set score = excluded.score,
          sort_score = excluded.sort_score,
          display_score = excluded.display_score,
          metrics = excluded.metrics,
          nickname = excluded.nickname,
          avatar = excluded.avatar,
          risk_state = 'normal',
          hidden_until = null,
          updated_at = now()
    `,
    [
      entry.boardId,
      entry.seasonId,
      userId,
      Math.floor(entry.score),
      Math.floor(entry.sortScore),
      entry.displayScore.slice(0, 48),
      JSON.stringify(entry.metrics),
      sanitizeNickname(row.nickname, userId),
      sanitizeAvatar(row.avatar),
    ],
  );
}

function snapshotLeaderboardEntries(save: SaveData) {
  const base = baseLeaderboardScore(save);
  const character = characterLeaderboardScore(save);
  const cosmetic = cosmeticLeaderboardScore(save);
  const campaign = campaignLeaderboardScore(save);
  const wealth = wealthLeaderboardScore(save);
  const achievements = achievementLeaderboardScore(save);

  return [
    {
      boardId: BASE_POWER_BOARD_ID,
      seasonId: ALL_TIME_SEASON_ID,
      score: base.score,
      sortScore: base.sortScore,
      displayScore: `评分 ${base.score}`,
      metrics: base.metrics,
    },
    {
      boardId: CHARACTER_POWER_BOARD_ID,
      seasonId: ALL_TIME_SEASON_ID,
      score: character.score,
      sortScore: character.sortScore,
      displayScore: `战力 ${character.score}`,
      metrics: character.metrics,
    },
    {
      boardId: COSMETIC_SCORE_BOARD_ID,
      seasonId: ALL_TIME_SEASON_ID,
      score: cosmetic.score,
      sortScore: cosmetic.sortScore,
      displayScore: `幻化 ${cosmetic.score}`,
      metrics: cosmetic.metrics,
    },
    {
      boardId: CAMPAIGN_PROGRESS_BOARD_ID,
      seasonId: ALL_TIME_SEASON_ID,
      score: campaign.score,
      sortScore: campaign.sortScore,
      displayScore: campaign.displayScore,
      metrics: campaign.metrics,
    },
    {
      boardId: WEALTH_COINS_BOARD_ID,
      seasonId: ALL_TIME_SEASON_ID,
      score: wealth.score,
      sortScore: wealth.sortScore,
      displayScore: `金币 ${wealth.score}`,
      metrics: wealth.metrics,
    },
    {
      boardId: ACHIEVEMENT_COUNT_BOARD_ID,
      seasonId: ALL_TIME_SEASON_ID,
      score: achievements.score,
      sortScore: achievements.sortScore,
      displayScore: `${achievements.score}/${achievements.total} 成就`,
      metrics: achievements.metrics,
    },
  ];
}

async function leaderboardMe(userId: string, boardId: string, seasonId: string) {
  const result = await pool.query(
    `
      with ranked as (
        ${rankedLeaderboardSql()}
      )
      select *
      from ranked
      where user_id = $3
      limit 1
    `,
    [boardId, seasonId, userId],
  );
  const row = result.rows[0];
  if (!row) return null;
  const entry = formatLeaderboardEntry(row);
  const previous = await pool.query(
    `
      with ranked as (
        ${rankedLeaderboardSql()}
      )
      select score
      from ranked
      where rank < $3
      order by rank desc
      limit 1
    `,
    [boardId, seasonId, entry.rank],
  );
  const previousScore = Number(previous.rows[0]?.score || 0);
  return {
    ...entry,
    deltaToPrevious: previousScore > 0 ? Math.max(0, previousScore - entry.score) : 0,
  };
}

function formatLeaderboardEntry(row: LeaderboardEntryRow) {
  const metrics = row.metrics && typeof row.metrics === "object" ? row.metrics : {};
  return {
    rank: Number(row.rank || 0),
    userId: String(row.user_id || ""),
    nickname: String(row.nickname || ""),
    avatar: String(row.avatar || "avatar_green"),
    displayScore: String(row.display_score || ""),
    score: Number(row.score || 0),
    metrics,
    updatedAt: new Date(row.updated_at).getTime() || Date.now(),
  };
}

function leaderboardScore(profile: PvpRankProfile) {
  const step = pvpRankStep(profile);
  const rankPoints = profile.tier === "master" || profile.tier === "legend" ? profile.masterPoints : profile.points;
  return Math.max(0, step * 100 + Math.max(0, Math.floor(rankPoints || 0)));
}

function leaderboardSortScore(profile: PvpRankProfile) {
  const step = pvpRankStep(profile);
  const rankPoints = profile.tier === "master" || profile.tier === "legend" ? profile.masterPoints : profile.points;
  const ratingBonus = Math.max(0, Math.min(999, Math.round((profile.rating || 1000) / 2)));
  return step * 1_000_000 + Math.max(0, Math.floor(rankPoints || 0)) * 1_000 + ratingBonus;
}

function winRate(profile: PvpRankProfile) {
  const total = Math.max(0, Math.floor(profile.wins || 0) + Math.floor(profile.losses || 0));
  return total > 0 ? Math.round((Math.floor(profile.wins || 0) / total) * 100) : 0;
}

function normalizeBoardId(value: string) {
  const board = BOARD_CONFIGS.find((item) => item.id === value);
  if (board?.enabled) return board.id;
  throw Object.assign(new Error("排行榜不存在或未开放。"), {
    code: "LEADERBOARD_NOT_FOUND",
    status: 404,
  });
}

function defaultSeasonIdForBoard(boardId: string) {
  const board = BOARD_CONFIGS.find((item) => item.id === boardId);
  return board?.period === "all_time" ? ALL_TIME_SEASON_ID : currentPvpSeason().id;
}

function baseLeaderboardScore(save: SaveData) {
  let protocolScore = 0;
  let protocolLevelSum = 0;
  let activeProtocols = 0;
  for (const item of metaUpgrades) {
    const level = clampInteger((save.upgrades || {})[item.id], 0, item.max, 0);
    protocolLevelSum += level;
    if (level > 0) activeProtocols += 1;
    protocolScore += level * 120 + level * level * 8;
  }

  let gemLevelSum = 0;
  let equippedGems = 0;
  for (const key of save.baseGems || []) {
    if (!key) continue;
    const gem = parseGemKey(key);
    if (!gem) continue;
    equippedGems += 1;
    gemLevelSum += gem.level;
  }
  const gemScore = gemLevelSum * 95 + equippedGems * 60;
  const score = Math.floor(protocolScore + gemScore);
  return {
    score,
    sortScore: score * 1_000 + gemLevelSum * 10 + protocolLevelSum,
    metrics: {
      protocolLevelSum,
      activeProtocols,
      gemLevelSum,
      equippedGems,
      tie1: gemLevelSum,
      tie2: protocolLevelSum,
    },
  };
}

function characterLeaderboardScore(save: SaveData) {
  let totalPower = 0;
  let topPower = 0;
  let topCharacter = "";
  let ownedCharacters = 0;
  let totalLevel = 0;

  for (const character of characters) {
    const progress = characterProgress(save, character);
    if (!progress.owned) continue;
    const power = characterPower(save, character);
    totalPower += power;
    ownedCharacters += 1;
    totalLevel += progress.level;
    if (power > topPower) {
      topPower = power;
      topCharacter = character.name;
    }
  }

  const score = Math.floor(totalPower);
  return {
    score,
    sortScore: score * 1_000 + topPower,
    metrics: {
      ownedCharacters,
      totalLevel,
      topPower,
      topCharacter,
      tie1: topPower,
      tie2: totalLevel,
    },
  };
}

function cosmeticLeaderboardScore(save: SaveData) {
  const rarityWeights = {
    rare: 10,
    epic: 35,
    legendary: 120,
  } as const;
  let score = 0;
  let rare = 0;
  let epic = 0;
  let legendary = 0;
  let ownedCosmetics = 0;

  for (const [id, countValue] of Object.entries(save.cosmetics?.owned || {})) {
    const cosmetic = cosmeticConfigs[id];
    if (!cosmetic) continue;
    const count = Math.max(1, Math.floor(Number(countValue) || 1));
    ownedCosmetics += 1;
    score += rarityWeights[cosmetic.rarity] * count;
    if (cosmetic.rarity === "legendary") legendary += 1;
    else if (cosmetic.rarity === "epic") epic += 1;
    else rare += 1;
  }

  const equippedCharacters = Object.keys(save.cosmetics?.equippedCharacters || {}).length;
  const equippedMarbles = Object.keys(save.cosmetics?.equippedMarbles || {}).length;
  return {
    score,
    sortScore: score * 1_000 + legendary * 100 + epic * 10 + rare,
    metrics: {
      ownedCosmetics,
      rare,
      epic,
      legendary,
      equipped: equippedCharacters + equippedMarbles,
      tie1: legendary,
      tie2: epic,
    },
  };
}

function campaignLeaderboardScore(save: SaveData) {
  const cleared = Object.entries(save.progress?.clearedStages || {}).filter(([, record]) => record?.cleared);
  const highestStage = cleared.reduce((max, [stageId]) => {
    const stage = stages.find((item) => item.id === stageId);
    return stage ? Math.max(max, stage.index) : max;
  }, 0);
  const fallbackStage = clampInteger(save.progress?.unlockedStage, 1, stages.length, 1);
  const progressStage = Math.max(highestStage, fallbackStage - 1);
  const totalStars = Object.values(save.progress?.clearedStages || {}).reduce(
    (sum, record) => sum + clampInteger(record?.stars, 0, 3, 0),
    0,
  );
  const bestStage = stages[Math.max(0, Math.min(stages.length - 1, progressStage - 1))] || stages[0];
  const stageRecord = bestStage ? save.progress?.clearedStages?.[bestStage.id] : null;
  const bestTime = Math.max(0, Math.floor(Number(stageRecord?.bestTime || 0)));
  const timeBonus = bestTime > 0 ? Math.max(0, 100_000 - Math.min(100_000, bestTime)) : 0;
  const score = Math.max(0, progressStage * 1_000 + totalStars);
  return {
    score,
    sortScore: progressStage * 1_000_000 + totalStars * 1_000 + timeBonus,
    displayScore: progressStage > 0 ? `主线 ${bestStage.chapter}-${bestStage.stage}` : "主线未通关",
    metrics: {
      clearedStages: cleared.length,
      highestStage: progressStage,
      totalStars,
      bestTime,
      tie1: totalStars,
      tie2: timeBonus,
    },
  };
}

function wealthLeaderboardScore(save: SaveData) {
  const currentCoins = Math.max(0, Math.floor(Number(save.coins || 0)));
  const investedCoins = investedCoinScore(save);
  const score = currentCoins + investedCoins;
  return {
    score,
    sortScore: score,
    metrics: {
      currentCoins,
      investedCoins,
      tie1: investedCoins,
      tie2: currentCoins,
    },
  };
}

function achievementLeaderboardScore(save: SaveData) {
  const stats = achievementStats(save);
  let achieved = 0;
  let progressScore = 0;
  for (const item of stats) {
    if (item.current >= item.target) achieved += 1;
    progressScore += Math.min(item.current, item.target) / item.target;
  }
  return {
    score: achieved,
    total: stats.length,
    sortScore: achieved * 1_000_000 + Math.round(progressScore * 10_000),
    metrics: {
      achieved,
      total: stats.length,
      progressScore: Math.round(progressScore * 100),
      tie1: progressScore,
      tie2: achieved,
    },
  };
}

function investedCoinScore(save: SaveData) {
  let total = 0;
  for (const item of metaUpgrades) {
    const level = clampInteger((save.upgrades || {})[item.id], 0, item.max, 0);
    for (let current = 0; current < level; current += 1) total += metaCost(item, current);
  }

  for (const character of characters) {
    const progress = characterProgress(save, character);
    if (!progress.owned) continue;
    for (let level = 1; level < progress.level; level += 1) total += characterLevelCost(level);
    for (let skillLevel = 1; skillLevel < progress.skillLevel; skillLevel += 1) total += characterSkillCost(skillLevel);
    for (const route of character.routes) {
      const routeLevel = clampInteger(progress.routes?.[route.id], 0, route.max, 0);
      for (let level = 0; level < routeLevel; level += 1) total += characterRouteCost(route, level);
    }
  }

  return Math.max(0, Math.floor(total));
}

function achievementStats(save: SaveData) {
  const clearedCount = Object.values(save.progress?.clearedStages || {}).filter((record) => record?.cleared).length;
  const totalStars = Object.values(save.progress?.clearedStages || {}).reduce(
    (sum, record) => sum + clampInteger(record?.stars, 0, 3, 0),
    0,
  );
  const ownedCharacters = characters.filter((character) => characterProgress(save, character).owned).length;
  const highestHeroLevel = characters.reduce((max, character) => Math.max(max, characterProgress(save, character).level), 1);
  const maxMarbleLevel = (Object.keys(marbleConfigs) as MarbleId[]).reduce((max, id) => Math.max(max, marbleLevel(save, id)), 1);
  const ownedGemTypes = new Set(
    Object.entries(save.inventory?.gems || {})
      .filter(([, count]) => Number(count) > 0)
      .map(([key]) => parseGemKey(key)?.type)
      .filter(Boolean),
  ).size;
  const ownedLootTypes = Object.keys(collectibleConfigs).filter((id) => Number(save.inventory?.collectibles?.[id as keyof typeof collectibleConfigs] || 0) > 0).length;
  const activeProtocols = metaUpgrades.filter((item) => upgradeLevel(save.upgrades || {}, item.id) > 0).length;
  const bestWave = Math.max(save.bestWave || 0, save.bestEndlessWave || 0);

  return [
    { current: save.runs || 0, target: 1 },
    { current: save.runs || 0, target: 10 },
    { current: save.wins || 0, target: 1 },
    { current: save.wins || 0, target: 5 },
    { current: clearedCount, target: 10 },
    { current: clearedCount, target: 30 },
    { current: totalStars, target: 18 },
    { current: bestWave, target: 20 },
    { current: ownedCharacters, target: 3 },
    { current: ownedCharacters, target: 6 },
    { current: highestHeroLevel, target: 10 },
    { current: maxMarbleLevel, target: 5 },
    { current: ownedGemTypes, target: 3 },
    { current: ownedLootTypes, target: 3 },
    { current: activeProtocols, target: 3 },
  ];
}

function characterPower(save: SaveData, character: CharacterConfig) {
  const progress = characterProgress(save, character);
  const levelBonus = Math.max(0, progress.level - 1);
  const routes = progress.routes || {};
  let damageMul = 1 + levelBonus * 0.025;
  let fireRateMul = 1 + levelBonus * 0.012;
  let skillCooldownMul = 1 - levelBonus * 0.006;

  if (character.id === "engineer") {
    fireRateMul += (routes.engineer_overclock || 0) * 0.04;
    skillCooldownMul -= (routes.engineer_field || 0) * 0.03;
    if (passiveUnlocked(save, character, "engineer_maintenance")) fireRateMul += 0.08;
  }
  if (character.id === "bomber") {
    fireRateMul += (routes.bomber_supply || 0) * 0.03;
    skillCooldownMul -= (routes.bomber_supply || 0) * 0.025;
  }
  if (character.id === "magnetist") {
    fireRateMul += (routes.magnetist_focus || 0) * 0.02;
    skillCooldownMul -= (routes.magnetist_focus || 0) * 0.025;
  }
  if (character.id === "sentinel") {
    fireRateMul += (routes.sentinel_suppress || 0) * 0.018;
    skillCooldownMul -= (routes.sentinel_barrier || 0) * 0.03;
  }
  if (character.id === "prism") {
    fireRateMul += (routes.prism_burst || 0) * 0.02;
    skillCooldownMul -= (routes.prism_burst || 0) * 0.025;
  }
  if (character.id === "alchemist") {
    fireRateMul += (routes.alchemist_gold || 0) * 0.02;
    skillCooldownMul -= (routes.alchemist_reactor || 0) * 0.025;
  }
  if (character.id === "frostseer") {
    fireRateMul += (routes.frostseer_stasis || 0) * 0.012;
    skillCooldownMul -= (routes.frostseer_stasis || 0) * 0.025;
  }
  if (character.id === "voidbinder") {
    fireRateMul += (routes.voidbinder_split || 0) * 0.012;
    skillCooldownMul -= (routes.voidbinder_core || 0) * 0.025;
  }
  if (character.id === "treasurer") {
    fireRateMul += (routes.treasurer_basic || 0) * 0.015 + (routes.treasurer_luck || 0) * 0.02;
    skillCooldownMul -= (routes.treasurer_luck || 0) * 0.015;
  }

  skillCooldownMul -= (progress.skillLevel - 1) * 0.018;
  const marbles = characterMarbles(save, character);
  const averageDamage =
    marbles.reduce((sum, id) => sum + marbleConfigs[id].damage * marbleDamageLevelMul(save, id), 0) / marbles.length;
  const routeDamage = marbles.reduce((sum, id) => sum + characterDamageMulForConfig(save, character, id), 0) / marbles.length;
  const attack = Math.round(averageDamage * damageMul * routeDamage * 10);
  const speed = Math.round(fireRateMul * 100);
  const skill = Math.round((1 - clampNumber(skillCooldownMul, 0.55, 1.3)) * 100);
  return Math.max(0, Math.round(attack * (speed / 100) * (1 + Math.max(0, skill) / 180)));
}

function characterDamageMulForConfig(save: SaveData, character: CharacterConfig, marbleId: MarbleId) {
  const routeLevel = (routeId: CharacterRouteId) => characterRouteLevel(save, character, routeId);
  let mul = characterPassiveDamageMul(save, character, marbleId);
  if (character.id === "engineer" && (marbleId === "basic" || marbleId === "split")) mul *= 1 + routeLevel("engineer_rebound") * 0.04;
  if (character.id === "bomber" && marbleId === "blast") mul *= 1 + routeLevel("bomber_blast") * 0.05;
  if (character.id === "bomber" && marbleId === "burn") mul *= 1 + routeLevel("bomber_burn") * 0.04;
  if (character.id === "magnetist" && marbleId === "lightning") mul *= 1 + routeLevel("magnetist_chain") * 0.04;
  if (character.id === "magnetist" && marbleId === "slow") mul *= 1 + routeLevel("magnetist_control") * 0.04;
  if (character.id === "sentinel" && (marbleId === "basic" || marbleId === "slow")) mul *= 1 + routeLevel("sentinel_pierce") * 0.04;
  if (character.id === "sentinel" && marbleId === "slow") mul *= 1 + routeLevel("sentinel_suppress") * 0.04;
  if (character.id === "prism" && marbleId === "lightning") mul *= 1 + routeLevel("prism_chain") * 0.04;
  if (character.id === "prism" && marbleId === "split") mul *= 1 + routeLevel("prism_split") * 0.04;
  if (character.id === "alchemist" && marbleId === "burn") mul *= 1 + routeLevel("alchemist_burn") * 0.05;
  if (character.id === "alchemist" && marbleId === "blast") mul *= 1 + routeLevel("alchemist_reactor") * 0.05;
  if (character.id === "frostseer" && marbleId === "slow") mul *= 1 + routeLevel("frostseer_slow") * 0.05;
  if (character.id === "frostseer" && marbleId === "lightning") mul *= 1 + routeLevel("frostseer_chain") * 0.04;
  if (character.id === "voidbinder" && marbleId === "split") mul *= 1 + routeLevel("voidbinder_split") * 0.04;
  if (character.id === "voidbinder" && marbleId === "blast") mul *= 1 + routeLevel("voidbinder_blast") * 0.05;
  if (character.id === "treasurer" && marbleId === "basic") mul *= 1 + routeLevel("treasurer_basic") * 0.04;
  if (character.id === "treasurer" && marbleId === "burn") mul *= 1 + routeLevel("treasurer_burn") * 0.05;
  return mul;
}

function characterPassiveDamageMul(save: SaveData, character: CharacterConfig, marbleId: MarbleId) {
  let mul = 1;
  const tags = marbleConfigs[marbleId].tags;
  if (character.id === "engineer" && passiveUnlocked(save, character, "engineer_structure") && (tags.includes("physical") || tags.includes("multi"))) mul *= 1.08;
  if (character.id === "bomber" && passiveUnlocked(save, character, "bomber_charge") && (marbleId === "blast" || marbleId === "burn")) mul *= 1.1;
  if (character.id === "magnetist" && passiveUnlocked(save, character, "magnetist_coil") && (marbleId === "lightning" || marbleId === "slow")) mul *= 1.08;
  if (character.id === "prism" && passiveUnlocked(save, character, "prism_calibration") && (marbleId === "lightning" || marbleId === "split")) mul *= 1.08;
  if (character.id === "alchemist" && passiveUnlocked(save, character, "alchemist_catalyst") && (marbleId === "burn" || marbleId === "blast")) mul *= 1.08;
  if (character.id === "frostseer" && passiveUnlocked(save, character, "frostseer_mark") && marbleId === "slow") mul *= 1.1;
  if (character.id === "voidbinder" && passiveUnlocked(save, character, "voidbinder_rift") && (marbleId === "split" || marbleId === "blast")) mul *= 1.08;
  if (character.id === "voidbinder" && passiveUnlocked(save, character, "voidbinder_singularity") && marbleId === "blast") mul *= 1.12;
  if (character.id === "treasurer" && passiveUnlocked(save, character, "treasurer_silver") && (marbleId === "basic" || marbleId === "burn")) mul *= 1.08;
  return mul;
}

function characterProgress(save: SaveData, character: CharacterConfig) {
  const progress = save.characters?.[character.id] || { owned: !character.unlock, level: 1, skillLevel: 1, routes: {} };
  return {
    owned: Boolean(progress.owned),
    level: clampInteger(progress.level, 1, HERO_MAX_LEVEL, 1),
    skillLevel: clampInteger(progress.skillLevel, 1, CHARACTER_SKILL_MAX_LEVEL, 1),
    routes: progress.routes || {},
  };
}

function characterMarbles(save: SaveData, character: CharacterConfig): [MarbleId, MarbleId] {
  const current = save.characterMarbles?.[character.id] || character.marbles;
  const first = current[0] && current[0] in marbleConfigs ? current[0] : character.marbles[0];
  const second = current[1] && current[1] in marbleConfigs && current[1] !== first ? current[1] : character.marbles[1];
  return [first, second] as [MarbleId, MarbleId];
}

function characterRouteLevel(save: SaveData, character: CharacterConfig, routeId: CharacterRouteId) {
  const route = character.routes.find((item) => item.id === routeId);
  return clampInteger(save.characters?.[character.id]?.routes?.[routeId], 0, route?.max || 0, 0);
}

function passiveUnlocked(save: SaveData, character: CharacterConfig, passiveId: string) {
  const passive = character.passives.find((item) => item.id === passiveId);
  return !!passive && characterProgress(save, character).level >= passive.unlockLevel;
}

function marbleLevel(save: SaveData, id: MarbleId) {
  return clampInteger(save.marbleLevels?.[id], 1, MARBLE_MAX_LEVEL, 1);
}

function marbleDamageLevelMul(save: SaveData, id: MarbleId) {
  return 1 + (marbleLevel(save, id) - 1) * 0.045;
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function sanitizeSeasonId(value: unknown) {
  const text = String(value || "").trim();
  return /^[a-z0-9_-]{3,48}$/i.test(text) ? text : "";
}

function sanitizeNickname(value: unknown, userId: string) {
  const text = String(value || "").trim().replace(/\s+/g, " ").slice(0, 12);
  return text || `玩家${String(userId).slice(0, 4).toUpperCase()}`;
}

function sanitizeAvatar(value: unknown) {
  const avatar = String(value || "avatar_green").trim();
  return /^[a-z0-9_-]{1,32}$/i.test(avatar) ? avatar : "avatar_green";
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}
