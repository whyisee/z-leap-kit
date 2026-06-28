import type { PvpRankDivision, PvpRankMode, PvpRankProfile, PvpRankTier } from "../../core/types";

export const PVP_RANK_POINTS_PER_DIVISION = 100;
export const PVP_PLACEMENT_MATCHES = 5;

export const pvpRankModes: PvpRankMode[] = ["duel", "power_duel", "battle_royale"];
export const pvpRankTierOrder: PvpRankTier[] = ["bronze", "silver", "gold", "platinum", "diamond", "master", "legend"];

const PVP_SEASON_LENGTH_MS = 28 * 24 * 60 * 60 * 1000;
const PVP_SEASON_ZERO = Date.UTC(2026, 0, 5, 0, 0, 0);
const MASTER_TO_LEGEND_POINTS = 500;

const pvpRankTierLabels: Record<PvpRankTier, string> = {
  bronze: "青铜",
  silver: "白银",
  gold: "黄金",
  platinum: "铂金",
  diamond: "钻石",
  master: "大师",
  legend: "传说",
};

const pvpRankDivisionLabels: Record<Exclude<PvpRankDivision, null>, string> = {
  1: "I",
  2: "II",
  3: "III",
};

export type PvpSeasonInfo = {
  id: string;
  index: number;
  startsAt: number;
  endsAt: number;
};

export type PvpRankResultContext = {
  now?: number;
  mode?: PvpRankMode;
  opponentRating?: number;
  disconnected?: boolean;
  abnormal?: boolean;
  repeatedOpponent?: boolean;
  wave?: number;
  kills?: number;
  pressureSent?: number;
  pressureTaken?: number;
  baseHp?: number;
  maxBaseHp?: number;
  placementRank?: number;
  playerCount?: number;
  extracted?: boolean;
  lootValue?: number;
};

export type PvpRankApplyResult = {
  before: PvpRankProfile;
  profile: PvpRankProfile;
  delta: number;
  ratingDelta: number;
  reasons: string[];
  rankUp: boolean;
  rankDown: boolean;
  protectionUsed: boolean;
  placementActive: boolean;
  placementResolved: boolean;
  seasonChanged: boolean;
  abnormal: boolean;
};

export function currentPvpSeason(now = Date.now()): PvpSeasonInfo {
  const index = Math.max(0, Math.floor((now - PVP_SEASON_ZERO) / PVP_SEASON_LENGTH_MS));
  const startsAt = PVP_SEASON_ZERO + index * PVP_SEASON_LENGTH_MS;
  const endsAt = startsAt + PVP_SEASON_LENGTH_MS;
  const start = new Date(startsAt);
  const year = start.getUTCFullYear();
  const month = `${start.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${start.getUTCDate()}`.padStart(2, "0");
  return {
    id: `arena-${year}${month}${day}-${index + 1}`,
    index,
    startsAt,
    endsAt,
  };
}

export function defaultPvpRankProfile(now = Date.now()): PvpRankProfile {
  const season = currentPvpSeason(now);
  return {
    seasonId: season.id,
    seasonStartedAt: season.startsAt,
    seasonEndsAt: season.endsAt,
    tier: "bronze",
    division: 3,
    points: 0,
    masterPoints: 0,
    rating: 1000,
    peakTier: "bronze",
    peakDivision: 3,
    wins: 0,
    losses: 0,
    seasonMatches: 0,
    winStreak: 0,
    bestWinStreak: 0,
    placementMatchesLeft: PVP_PLACEMENT_MATCHES,
    placementWins: 0,
    lossProtection: 0,
  };
}

export function defaultPvpRanks(now = Date.now()): Record<PvpRankMode, PvpRankProfile> {
  return {
    duel: defaultPvpRankProfile(now),
    power_duel: defaultPvpRankProfile(now),
    battle_royale: defaultPvpRankProfile(now),
  };
}

export function normalizePvpRanks(
  value: Partial<Record<PvpRankMode, Partial<PvpRankProfile>>> = {},
  now = Date.now(),
): Record<PvpRankMode, PvpRankProfile> {
  const defaults = defaultPvpRanks(now);
  return {
    duel: normalizePvpRankProfile(value.duel || defaults.duel, now),
    power_duel: normalizePvpRankProfile(value.power_duel || defaults.power_duel, now),
    battle_royale: normalizePvpRankProfile(value.battle_royale || defaults.battle_royale, now),
  };
}

export function normalizePvpRankProfile(value: Partial<PvpRankProfile> = {}, now = Date.now()): PvpRankProfile {
  const season = currentPvpSeason(now);
  const defaults = defaultPvpRankProfile(now);
  const tier = normalizePvpRankTier(value.tier, defaults.tier);
  const division = isMasterLikeTier(tier) ? null : normalizePvpRankDivision(value.division, defaults.division);
  const peakTier = normalizePvpRankTier(value.peakTier, tier);
  const peakDivision = isMasterLikeTier(peakTier) ? null : normalizePvpRankDivision(value.peakDivision, division || 3);
  const profile: PvpRankProfile = {
    seasonId: typeof value.seasonId === "string" && value.seasonId ? value.seasonId : season.id,
    seasonStartedAt: clampInteger(value.seasonStartedAt, 0, Number.MAX_SAFE_INTEGER, season.startsAt),
    seasonEndsAt: clampInteger(value.seasonEndsAt, 0, Number.MAX_SAFE_INTEGER, season.endsAt),
    tier,
    division,
    points: clampInteger(value.points, 0, PVP_RANK_POINTS_PER_DIVISION - 1, defaults.points),
    masterPoints: clampInteger(value.masterPoints, 0, 999999, defaults.masterPoints),
    rating: clampInteger(value.rating, 1, 999999, defaults.rating),
    peakTier,
    peakDivision,
    wins: clampInteger(value.wins, 0, 999999, defaults.wins),
    losses: clampInteger(value.losses, 0, 999999, defaults.losses),
    seasonMatches: clampInteger(value.seasonMatches, 0, 999999, defaults.seasonMatches),
    winStreak: clampInteger(value.winStreak, 0, 999999, defaults.winStreak),
    bestWinStreak: clampInteger(value.bestWinStreak, 0, 999999, defaults.bestWinStreak),
    placementMatchesLeft: clampInteger(value.placementMatchesLeft, 0, PVP_PLACEMENT_MATCHES, defaults.placementMatchesLeft),
    placementWins: clampInteger(value.placementWins, 0, PVP_PLACEMENT_MATCHES, defaults.placementWins),
    lossProtection: clampInteger(value.lossProtection, 0, 9, defaults.lossProtection),
  };

  if (value.seasonId && value.seasonId !== season.id) return resetPvpRankForSeason(profile, season);
  if (pvpRankStep(profile) > pvpRankStep({ tier: profile.peakTier, division: profile.peakDivision })) {
    profile.peakTier = profile.tier;
    profile.peakDivision = profile.division;
  }
  if (profile.tier === "legend" && profile.masterPoints < MASTER_TO_LEGEND_POINTS) profile.masterPoints = MASTER_TO_LEGEND_POINTS;
  return profile;
}

export function pvpRankLabel(profile: PvpRankProfile) {
  const normalized = normalizePvpRankProfile(profile);
  const label = pvpRankTierLabels[normalized.tier];
  if (!normalized.division) return label;
  return `${label} ${pvpRankDivisionLabels[normalized.division]}`;
}

export function pvpRankDisplayLabel(profile: PvpRankProfile) {
  const normalized = normalizePvpRankProfile(profile);
  if (normalized.placementMatchesLeft > 0) return `定级中 ${PVP_PLACEMENT_MATCHES - normalized.placementMatchesLeft}/${PVP_PLACEMENT_MATCHES}`;
  return pvpRankLabel(normalized);
}

export function pvpRankRequirementLabel(tier: PvpRankTier, division: PvpRankDivision = 3) {
  return pvpRankLabel({
    ...defaultPvpRankProfile(),
    placementMatchesLeft: 0,
    tier,
    division: isMasterLikeTier(tier) ? null : division || 3,
  });
}

export function pvpRankProgressText(profile: PvpRankProfile) {
  const normalized = normalizePvpRankProfile(profile);
  if (normalized.placementMatchesLeft > 0) return `定级 ${PVP_PLACEMENT_MATCHES - normalized.placementMatchesLeft}/${PVP_PLACEMENT_MATCHES}`;
  if (isMasterLikeTier(normalized.tier)) return `${normalized.masterPoints} 大师分`;
  return `${normalized.points}/${PVP_RANK_POINTS_PER_DIVISION}`;
}

export function pvpRankProgressRatio(profile: PvpRankProfile) {
  const normalized = normalizePvpRankProfile(profile);
  if (normalized.placementMatchesLeft > 0) return (PVP_PLACEMENT_MATCHES - normalized.placementMatchesLeft) / PVP_PLACEMENT_MATCHES;
  if (isMasterLikeTier(normalized.tier)) return 1;
  return normalized.points / PVP_RANK_POINTS_PER_DIVISION;
}

export function pvpRankRecordText(profile: PvpRankProfile) {
  const normalized = normalizePvpRankProfile(profile);
  const total = normalized.wins + normalized.losses;
  if (total <= 0) return "0胜 0负";
  const rate = Math.round((normalized.wins / total) * 100);
  return `${normalized.wins}胜 ${normalized.losses}负 · ${rate}%`;
}

export function pvpRankSeasonText(profile: PvpRankProfile, now = Date.now()) {
  const normalized = normalizePvpRankProfile(profile, now);
  const daysLeft = Math.max(0, Math.ceil((normalized.seasonEndsAt - now) / 86400000));
  return `赛季剩余 ${daysLeft} 天`;
}

export function pvpRankStep(profile: Pick<PvpRankProfile, "tier" | "division">) {
  const tierIndex = pvpRankTierOrder.indexOf(profile.tier);
  if (tierIndex < 0) return 0;
  if (profile.tier === "master") return 15;
  if (profile.tier === "legend") return 16;
  const division = normalizePvpRankDivision(profile.division, 3) || 3;
  return tierIndex * 3 + (3 - division);
}

export function pvpRankMeetsRequirement(profile: PvpRankProfile, tier: PvpRankTier, division: PvpRankDivision = 3) {
  const normalized = normalizePvpRankProfile(profile);
  if (normalized.placementMatchesLeft > 0) return false;
  return pvpRankStep(normalized) >= pvpRankStep({ tier, division: isMasterLikeTier(tier) ? null : division || 3 });
}

export function pvpRankMatchScore(profile: PvpRankProfile) {
  const normalized = normalizePvpRankProfile(profile);
  const visibleScore = pvpRankStep(normalized) * 100 + (isMasterLikeTier(normalized.tier) ? normalized.masterPoints : normalized.points);
  return Math.round(visibleScore * 0.55 + normalized.rating * 0.45);
}

export function applyPvpRankResult(input: PvpRankProfile, result: "win" | "lose", context: PvpRankResultContext = {}): PvpRankApplyResult {
  const before = normalizePvpRankProfile(input, context.now);
  const profile = clonePvpRankProfile(before);
  const reasons: string[] = [];
  let delta = 0;
  let rankUp = false;
  let rankDown = false;
  let protectionUsed = false;
  let placementResolved = false;
  let seasonChanged = false;
  const placementActive = profile.placementMatchesLeft > 0;

  if (context.abnormal) {
    reasons.push("异常对局，段位延迟结算");
    return {
      before,
      profile,
      delta: 0,
      ratingDelta: 0,
      reasons,
      rankUp: false,
      rankDown: false,
      protectionUsed: false,
      placementActive,
      placementResolved: false,
      seasonChanged,
      abnormal: true,
    };
  }

  const currentSeason = currentPvpSeason(context.now);
  if (profile.seasonId !== currentSeason.id) {
    Object.assign(profile, resetPvpRankForSeason(profile, currentSeason));
    seasonChanged = true;
    reasons.push("新赛季重置");
  }

  const ratingDelta = eloRatingDelta(profile.rating, context.opponentRating, result);
  profile.rating = clampInteger(profile.rating + ratingDelta, 1, 999999, profile.rating);
  profile.seasonMatches += 1;

  if (result === "win") {
    profile.wins += 1;
    profile.winStreak += 1;
    profile.bestWinStreak = Math.max(profile.bestWinStreak, profile.winStreak);
  } else {
    profile.losses += 1;
    profile.winStreak = 0;
  }

  if (profile.placementMatchesLeft > 0) {
    if (result === "win") profile.placementWins += 1;
    profile.placementMatchesLeft -= 1;
    reasons.push(`定级赛 ${PVP_PLACEMENT_MATCHES - profile.placementMatchesLeft}/${PVP_PLACEMENT_MATCHES}`);
    if (profile.placementMatchesLeft <= 0) {
      const placed = placementRankForWins(profile.placementWins);
      const beforeStep = pvpRankStep(before);
      profile.tier = placed.tier;
      profile.division = placed.division;
      profile.points = 0;
      profile.masterPoints = 0;
      profile.lossProtection = placed.tier !== "bronze" ? 3 : 0;
      updatePvpPeakRank(profile);
      placementResolved = true;
      rankUp = pvpRankStep(profile) > beforeStep;
      reasons.push(`定级完成：${pvpRankLabel(profile)}`);
    }
    return {
      before,
      profile,
      delta,
      ratingDelta,
      reasons,
      rankUp,
      rankDown,
      protectionUsed,
      placementActive: true,
      placementResolved,
      seasonChanged,
      abnormal: false,
    };
  }

  delta = context.mode === "battle_royale" ? battleRoyaleRankDelta(result, context, reasons) : duelRankDelta(before, profile, result, context, reasons);

  if (result === "win") {
    rankUp = applyPvpRankWin(profile, delta);
  } else {
    const lossResult = applyPvpRankLoss(profile, delta);
    rankDown = lossResult.rankDown;
    protectionUsed = lossResult.protectionUsed;
    if (protectionUsed) reasons.push("大段保护");
  }

  updateLegendState(profile);
  updatePvpPeakRank(profile);
  if (reasons.length === 0) reasons.push(result === "win" ? "胜利基础" : "失败基础");

  return {
    before,
    profile,
    delta,
    ratingDelta,
    reasons,
    rankUp,
    rankDown,
    protectionUsed,
    placementActive: false,
    placementResolved,
    seasonChanged,
    abnormal: false,
  };
}

export function pvpRankDeltaText(result: PvpRankApplyResult | null | undefined) {
  if (!result) return "-";
  if (result.abnormal) return "延迟";
  if (result.placementActive && !result.placementResolved) return "定级";
  if (result.placementResolved) return "定级完成";
  const prefix = result.delta > 0 ? "+" : "";
  return `${prefix}${result.delta}`;
}

function duelRankDelta(before: PvpRankProfile, profile: PvpRankProfile, result: "win" | "lose", context: PvpRankResultContext, reasons: string[]) {
  if (result === "win") {
    let delta = 24;
    const opponent = opponentStrengthAdjustment(before.rating, context.opponentRating);
    if (opponent !== 0) {
      delta += opponent;
      reasons.push(`对手强度 ${signed(opponent)}`);
    }
    const streak = winStreakBonus(profile, before);
    if (streak > 0) {
      delta += streak;
      reasons.push(`连胜 ${signed(streak)}`);
    }
    const performance = performanceBonus(context);
    if (performance > 0) {
      delta += performance;
      reasons.push(`表现 ${signed(performance)}`);
    }
    if (context.repeatedOpponent) {
      delta -= 6;
      reasons.push("重复匹配 -6");
    }
    return clampInteger(delta, 12, 40, 24);
  }

  let delta = context.disconnected ? -24 : -16;
  if (context.disconnected) reasons.push("掉线惩罚");
  const opponent = opponentStrengthAdjustment(before.rating, context.opponentRating);
  if (opponent > 0) {
    delta += Math.min(6, opponent);
    reasons.push(`强敌减损 +${Math.min(6, opponent)}`);
  } else if (opponent < 0) {
    delta += Math.max(-8, opponent);
    reasons.push(`低分失利 ${Math.max(-8, opponent)}`);
  }
  if (before.tier === "bronze" && delta < -8) {
    delta = -8;
    reasons.push("青铜保护");
  } else if (before.seasonMatches < 10 && delta < -10) {
    delta = -10;
    reasons.push("新手保护");
  }
  return clampInteger(delta, -30, -4, -16);
}

function battleRoyaleRankDelta(result: "win" | "lose", context: PvpRankResultContext, reasons: string[]) {
  const playerCount = Math.max(2, Math.floor(Number(context.playerCount) || 4));
  const rank = clampInteger(context.placementRank, 1, playerCount, result === "win" ? 1 : playerCount);
  const placementScore = Math.round(((playerCount - rank) / Math.max(1, playerCount - 1)) * 28) - 12;
  const extraction = context.extracted ? 8 : -4;
  const loot = Math.min(8, Math.floor((context.lootValue || 0) / 120));
  const pressure = Math.min(4, Math.floor((context.pressureSent || 0) / 50));
  reasons.push(`名次 ${rank}/${playerCount}`);
  if (context.extracted) reasons.push("成功撤离 +8");
  return clampInteger(placementScore + extraction + loot + pressure, -24, 36, result === "win" ? 24 : -12);
}

function applyPvpRankWin(profile: PvpRankProfile, delta: number) {
  if (isMasterLikeTier(profile.tier)) {
    profile.masterPoints += delta;
    return updateLegendState(profile);
  }

  profile.points += delta;
  if (profile.points < PVP_RANK_POINTS_PER_DIVISION) return false;

  const beforeTier = profile.tier;
  const next = nextPvpRank(profile);
  if (!next) {
    profile.points = PVP_RANK_POINTS_PER_DIVISION - 1;
    return false;
  }

  profile.tier = next.tier;
  profile.division = next.division;
  profile.points = 0;
  if (profile.tier !== beforeTier) profile.lossProtection = 3;
  return true;
}

function applyPvpRankLoss(profile: PvpRankProfile, delta: number) {
  if (isMasterLikeTier(profile.tier)) {
    profile.masterPoints = Math.max(0, profile.masterPoints + delta);
    if (profile.tier === "legend" && profile.masterPoints < MASTER_TO_LEGEND_POINTS) {
      profile.tier = "master";
      return { rankDown: true, protectionUsed: false };
    }
    if (profile.masterPoints > 0) return { rankDown: false, protectionUsed: false };
    profile.tier = "diamond";
    profile.division = 1;
    profile.points = 75;
    return { rankDown: true, protectionUsed: false };
  }

  const nextPoints = profile.points + delta;
  if (nextPoints >= 0) {
    profile.points = nextPoints;
    return { rankDown: false, protectionUsed: false };
  }

  const previous = previousPvpRank(profile);
  if (!previous) {
    profile.points = 0;
    return { rankDown: false, protectionUsed: false };
  }

  if (previous.tier !== profile.tier && profile.lossProtection > 0) {
    profile.lossProtection -= 1;
    profile.points = 0;
    return { rankDown: false, protectionUsed: true };
  }

  profile.tier = previous.tier;
  profile.division = previous.division;
  profile.points = 75;
  return { rankDown: true, protectionUsed: false };
}

function nextPvpRank(profile: PvpRankProfile): Pick<PvpRankProfile, "tier" | "division"> | null {
  if (profile.tier === "legend") return null;
  if (profile.tier === "master") return { tier: "legend", division: null };
  if (profile.division && profile.division > 1) return { tier: profile.tier, division: (profile.division - 1) as Exclude<PvpRankDivision, null> };
  const tierIndex = pvpRankTierOrder.indexOf(profile.tier);
  const nextTier = pvpRankTierOrder[tierIndex + 1];
  if (!nextTier) return null;
  return { tier: nextTier, division: isMasterLikeTier(nextTier) ? null : 3 };
}

function previousPvpRank(profile: PvpRankProfile): Pick<PvpRankProfile, "tier" | "division"> | null {
  if (profile.tier === "bronze" && profile.division === 3) return null;
  if (profile.tier === "master") return { tier: "diamond", division: 1 };
  if (profile.tier === "legend") return { tier: "master", division: null };
  if (profile.division && profile.division < 3) return { tier: profile.tier, division: (profile.division + 1) as Exclude<PvpRankDivision, null> };
  const tierIndex = pvpRankTierOrder.indexOf(profile.tier);
  const previousTier = pvpRankTierOrder[tierIndex - 1];
  if (!previousTier) return null;
  return { tier: previousTier, division: isMasterLikeTier(previousTier) ? null : 1 };
}

function updatePvpPeakRank(profile: PvpRankProfile) {
  if (pvpRankStep(profile) > pvpRankStep({ tier: profile.peakTier, division: profile.peakDivision })) {
    profile.peakTier = profile.tier;
    profile.peakDivision = profile.division;
  }
}

function updateLegendState(profile: PvpRankProfile) {
  const before = profile.tier;
  if (profile.tier === "master" && profile.masterPoints >= MASTER_TO_LEGEND_POINTS) profile.tier = "legend";
  if (profile.tier === "legend" && profile.masterPoints < MASTER_TO_LEGEND_POINTS) profile.tier = "master";
  profile.division = isMasterLikeTier(profile.tier) ? null : profile.division;
  return before !== profile.tier;
}

function resetPvpRankForSeason(previous: PvpRankProfile, season: PvpSeasonInfo): PvpRankProfile {
  const peak = pvpRankStep({ tier: previous.peakTier, division: previous.peakDivision });
  const seeded =
    peak >= pvpRankStep({ tier: "legend", division: null })
      ? { tier: "platinum" as const, division: 3 as const }
      : peak >= pvpRankStep({ tier: "master", division: null })
        ? { tier: "gold" as const, division: 1 as const }
        : peak >= pvpRankStep({ tier: "diamond", division: 3 })
          ? { tier: "gold" as const, division: 3 as const }
          : peak >= pvpRankStep({ tier: "platinum", division: 3 })
            ? { tier: "silver" as const, division: 1 as const }
            : peak >= pvpRankStep({ tier: "gold", division: 3 })
              ? { tier: "silver" as const, division: 3 as const }
              : peak >= pvpRankStep({ tier: "silver", division: 3 })
                ? { tier: "bronze" as const, division: 1 as const }
                : { tier: "bronze" as const, division: 3 as const };

  return {
    ...defaultPvpRankProfile(season.startsAt),
    seasonId: season.id,
    seasonStartedAt: season.startsAt,
    seasonEndsAt: season.endsAt,
    tier: seeded.tier,
    division: seeded.division,
    peakTier: seeded.tier,
    peakDivision: seeded.division,
    rating: Math.max(800, Math.round(previous.rating * 0.72 + 280)),
  };
}

function placementRankForWins(wins: number): Pick<PvpRankProfile, "tier" | "division"> {
  if (wins >= 5) return { tier: "silver", division: 2 };
  if (wins === 4) return { tier: "silver", division: 3 };
  if (wins === 3) return { tier: "bronze", division: 1 };
  if (wins === 2) return { tier: "bronze", division: 2 };
  return { tier: "bronze", division: 3 };
}

function eloRatingDelta(rating: number, opponentRating: unknown, result: "win" | "lose") {
  const opponent = Number.isFinite(Number(opponentRating)) ? Number(opponentRating) : rating;
  const expected = 1 / (1 + 10 ** ((opponent - rating) / 400));
  const score = result === "win" ? 1 : 0;
  return clampInteger(Math.round(32 * (score - expected)), -32, 32, 0);
}

function opponentStrengthAdjustment(rating: number, opponentRating: unknown) {
  if (!Number.isFinite(Number(opponentRating))) return 0;
  return clampInteger(Math.round((Number(opponentRating) - rating) / 80), -8, 8, 0);
}

function winStreakBonus(profile: PvpRankProfile, before: PvpRankProfile) {
  if (profile.winStreak < 3) return 0;
  if (pvpRankStep(before) > pvpRankStep({ tier: "gold", division: 1 })) return 0;
  return Math.min(8, 2 + (profile.winStreak - 3) * 2);
}

function performanceBonus(context: PvpRankResultContext) {
  let bonus = 0;
  if ((context.wave || 0) >= 10) bonus += 1;
  if ((context.kills || 0) >= 180) bonus += 1;
  if ((context.pressureSent || 0) >= 120) bonus += 1;
  const hpRatio = context.maxBaseHp ? (context.baseHp || 0) / context.maxBaseHp : 0;
  if (hpRatio >= 0.6) bonus += 1;
  return Math.min(4, bonus);
}

function clonePvpRankProfile(profile: PvpRankProfile): PvpRankProfile {
  return { ...profile };
}

function normalizePvpRankTier(value: unknown, fallback: PvpRankTier): PvpRankTier {
  return pvpRankTierOrder.includes(value as PvpRankTier) ? (value as PvpRankTier) : fallback;
}

function normalizePvpRankDivision(value: unknown, fallback: PvpRankDivision): PvpRankDivision {
  const division = Math.floor(Number(value || fallback));
  return division === 1 || division === 2 || division === 3 ? division : fallback;
}

function isMasterLikeTier(tier: PvpRankTier) {
  return tier === "master" || tier === "legend";
}

function signed(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}
