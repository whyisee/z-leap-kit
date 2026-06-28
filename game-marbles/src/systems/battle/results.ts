import { getStageByIndex, stages } from "../../config/stages";
import { clamp } from "../../core/math";
import type { ExtractionResult, SaveData, Session, StageConfig } from "../../core/types";
import { NORMAL_WAVE_LIMIT } from "./modes";

export function stageParSeconds(stage: StageConfig) {
  return clamp(255 + stage.chapter * 14 + stage.stage * 4, 270, 360);
}

export function calculateStageStars(session: Session, stage: StageConfig) {
  let stars = 1;
  if (session.baseHp / Math.max(1, session.maxBaseHp) >= 0.5) stars += 1;
  if (session.elapsed <= stageParSeconds(stage)) stars += 1;
  return clamp(stars, 1, 3);
}

export function extractionCoinMultiplierForSession(session: Session, result: ExtractionResult) {
  if (result === "cleared") return 1.35 + session.continueBonus;
  if (result === "extracted") {
    const base = session.wave >= 15 ? 1.15 : session.wave >= 10 ? 0.9 : 0.65;
    return base + session.continueBonus * 0.5;
  }
  return 0.25 + Math.min(0.3, (session.wave / NORMAL_WAVE_LIMIT) * 0.3);
}

export function battleCoinReward(session: Session, stage: StageConfig, result: "win" | "lose", extractionResult: ExtractionResult) {
  const baseReward = session.coins + session.wave * 8 + session.kills * 0.4;
  const hpBonus = result === "win" ? (session.baseHp / session.maxBaseHp) * 0.18 : 0;
  const stageCoinBonus = stage.rewardBias.coins || 1;
  return Math.max(result === "win" ? 12 : 8, Math.floor(baseReward * stageCoinBonus * extractionCoinMultiplierForSession(session, extractionResult) * (1 + hpBonus)));
}

export function battleShardReward(session: Session, extractionResult: ExtractionResult) {
  if (extractionResult === "cleared") return 2;
  if (extractionResult === "extracted" && session.wave >= 10) return 1;
  if (extractionResult === "failed" && session.wave >= 15) return 1;
  return 0;
}

export function applyBattleProgressToSave(
  save: SaveData,
  session: Session,
  extractionResult: ExtractionResult,
  stage: StageConfig,
  stageStars: number,
  clearedStage: boolean,
) {
  save.runs += 1;
  save.wins += extractionResult === "cleared" ? 1 : 0;

  if (session.mode === "endless") {
    save.bestEndlessWave = Math.max(save.bestEndlessWave, session.wave);
    return;
  }

  save.bestWave = Math.max(save.bestWave, session.wave);
  updateStageProgress(save, stage, session, stageStars, clearedStage);
}

function updateStageProgress(save: SaveData, stage: StageConfig, session: Session, stars: number, cleared: boolean) {
  const current = save.progress.clearedStages[stage.id];
  const next = {
    bestWave: Math.max(current?.bestWave || 0, session.wave),
    cleared: current?.cleared || cleared,
    bestTime: current?.bestTime || 0,
    stars: current?.stars || 0,
  };

  if (cleared) {
    next.bestTime = current?.cleared && current.bestTime > 0 ? Math.min(current.bestTime, session.elapsed) : session.elapsed;
    next.stars = Math.max(next.stars, stars);
    save.progress.unlockedStage = Math.max(save.progress.unlockedStage, Math.min(stages.length, stage.index + 1));
    if (stage.index < stages.length && save.selectedStage === stage.id) {
      save.selectedStage = getStageByIndex(stage.index + 1).id;
    }
  }

  save.progress.clearedStages[stage.id] = next;
}
