import type pg from "pg";
import type { PvpRankMode, PvpRankProfile } from "../../src/core/types";
import {
  currentPvpSeason,
  normalizePvpRankProfile,
  pvpRankDisplayLabel,
  pvpRankStep,
} from "../../src/systems/pvp/rank";
import { pool, q } from "./db";

const LEADERBOARD_LIMIT_MAX = 100;
const PVP_DUEL_BOARD_ID = "pvp_duel_season";

type AuthContext = {
  userId: string;
};

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
    boards: [
      {
        id: PVP_DUEL_BOARD_ID,
        title: "1v1 赛季榜",
        enabled: true,
        mode: "duel",
      },
      {
        id: "endless_wave_season",
        title: "无尽最高波",
        enabled: false,
        mode: "endless",
      },
      {
        id: "pvp_battle_royale_season",
        title: "吃鸡赛季榜",
        enabled: false,
        mode: "battle_royale",
      },
    ],
    serverTime: Date.now(),
  };
}

export async function handleLeaderboardCatalog(_auth: AuthContext) {
  return leaderboardCatalog();
}

export async function handleLeaderboardList(auth: AuthContext, boardId: string, query: URLSearchParams) {
  const board = normalizeBoardId(boardId);
  const season = currentPvpSeason();
  const seasonId = sanitizeSeasonId(query.get("seasonId")) || season.id;
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
  const season = currentPvpSeason();
  const seasonId = sanitizeSeasonId(query.get("seasonId")) || season.id;
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
  };

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
      boardId,
      seasonId,
      userId,
      score,
      sortScore,
      pvpRankDisplayLabel(normalized),
      JSON.stringify(metrics),
      sanitizeNickname(row.nickname, userId),
      sanitizeAvatar(row.avatar),
    ],
  );
}

function rankedLeaderboardSql() {
  return `
    select
      rank() over (order by sort_score desc, wins_metric desc, win_rate_metric desc, updated_at asc) as rank,
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
        coalesce((metrics->>'wins')::int, 0) as wins_metric,
        coalesce((metrics->>'winRate')::int, 0) as win_rate_metric
      from ${q("gm_leaderboard_entries")}
      where board_id = $1
        and season_id = $2
        and risk_state = 'normal'
        and (hidden_until is null or hidden_until <= now())
    ) entries
  `;
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
  if (value === PVP_DUEL_BOARD_ID) return value;
  throw Object.assign(new Error("排行榜不存在或未开放。"), {
    code: "LEADERBOARD_NOT_FOUND",
    status: 404,
  });
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
