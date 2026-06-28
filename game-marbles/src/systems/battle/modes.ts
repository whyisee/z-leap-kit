import type { BattleMode, ExtractionResult, Session } from "../../core/types";

export const NORMAL_WAVE_LIMIT = 20;
export const PVP_WAVE_LIMIT = 10;

export function isEndlessMode(mode: BattleMode) {
  return mode === "endless";
}

export function isPvpMode(mode: BattleMode) {
  return mode === "pvp";
}

export function isRunComplete(session: Pick<Session, "mode" | "wave">) {
  if (session.mode === "pvp") return session.wave >= PVP_WAVE_LIMIT;
  return session.mode === "normal" && session.wave >= NORMAL_WAVE_LIMIT;
}

export function shouldOpenExtractionWindowForSession(
  session: Pick<Session, "mode" | "extractionWindowsSeen">,
  wave: number,
) {
  if (session.mode === "pvp") return false;
  if (session.mode === "endless") return wave >= 5 && wave % 5 === 0 && !session.extractionWindowsSeen.includes(wave);
  return [5, 10, 15].includes(wave) && !session.extractionWindowsSeen.includes(wave);
}

export function maxHeatForMode(mode: BattleMode) {
  if (mode === "pvp") return 0;
  return mode === "endless" ? 12 : 6;
}

export function continuePreviewForSession(session: Pick<Session, "mode">, wave: number) {
  if (session.mode === "endless" && wave >= NORMAL_WAVE_LIMIT) {
    const tier = Math.floor((wave - NORMAL_WAVE_LIMIT) / 10);
    return { bonus: Math.min(0.75, 0.35 + tier * 0.08), heat: wave % 10 === 0 ? 3 : 2 };
  }
  if (wave >= 15) return { bonus: 0.35, heat: 3 };
  if (wave >= 10) return { bonus: 0.2, heat: 2 };
  return { bonus: 0.1, heat: 1 };
}

export function extractionDepthNameForSession(session: Pick<Session, "mode">, wave: number) {
  if (session.mode === "endless" && wave >= NORMAL_WAVE_LIMIT) return `无尽第 ${wave} 波`;
  if (wave >= 15) return "深层撤离";
  if (wave >= 10) return "中层撤离";
  return "浅层回收";
}

export function extractionResultEyebrowForMode(mode: BattleMode, result: ExtractionResult) {
  if (mode === "pvp") return result === "failed" ? "PVP 失利" : "PVP 对战";
  if (mode === "endless") return result === "failed" ? "无尽挑战结束" : "无尽挑战";
  if (result === "cleared") return "完美撤离";
  if (result === "extracted") return "撤离成功";
  return "战斗结束";
}

export function extractionResultTitleForMode(mode: BattleMode, result: ExtractionResult) {
  if (mode === "pvp") {
    if (result === "failed") return "PVP 对战失败";
    return "PVP 对战获胜";
  }
  if (mode === "endless") {
    if (result === "extracted") return "无尽撤离成功";
    if (result === "failed") return "无尽防线被突破";
  }
  if (result === "cleared") return "第 20 波已清除";
  if (result === "extracted") return "战利品已带回";
  return "防线被突破";
}

export function formatSessionWaveText(session: Pick<Session, "mode" | "wave">) {
  if (session.mode === "pvp") return `${session.wave || 1} / ${PVP_WAVE_LIMIT}`;
  return session.mode === "endless" ? `${session.wave || 1} / ∞` : `${session.wave || 1} / ${NORMAL_WAVE_LIMIT}`;
}

export function battleWaveBannerText(session: Pick<Session, "mode" | "wave" | "waveConfig">) {
  const isBossWave = session.waveConfig?.type === "boss";
  if (session.mode === "pvp") return `第 ${session.wave} 波`;
  if (isBossWave && session.mode === "normal") return "最终 Boss";
  if (isBossWave) return `第 ${session.wave} 波 Boss`;
  return `第 ${session.wave} 波`;
}
