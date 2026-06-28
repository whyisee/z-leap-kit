import { clamp } from "../../core/math";
import { randomChoice, shuffle } from "../../core/random";
import type { Enemy, EnemyType, StageConfig, StageWaveEvent, WaveConfig } from "../../core/types";

export function createWave(wave: number, stage?: StageConfig): WaveConfig {
  const event = stage?.waveEvents.find((item) => item.wave === wave);
  const type = event?.type || defaultWaveType(wave);
  const baseHpMultiplier = 1 + wave * 0.16 + Math.floor((wave - 1) / 5) * 0.16;
  const baseSpeedMultiplier = 1 + Math.floor((wave - 1) / 5) * 0.07;
  const hpMultiplier = baseHpMultiplier * (stage?.hpMultiplier || 1) * (event?.hpMultiplier || 1);
  const speedMultiplier = baseSpeedMultiplier * (stage?.speedMultiplier || 1) * (event?.speedMultiplier || 1);
  const targetDuration = type === "boss" ? 34 : type === "elite" ? 16 : type === "pressure" ? 12 : 10;
  const queue = buildQueue(wave, type, stage, event);
  const intervalMultiplier = event?.spawnIntervalMultiplier || 1;

  return {
    wave,
    type,
    targetDuration,
    queue: shuffle(queue),
    hpMultiplier,
    speedMultiplier,
    spawnInterval: clamp((targetDuration / Math.max(1, queue.length)) * intervalMultiplier, 0.16, 0.72),
  };
}

export function enemyThreatRank(enemy: Enemy) {
  return {
    boss: 9,
    elite: 8,
    healer: 7,
    shield: 6,
    tank: 5,
    splitter: 4,
    gold: 3,
    fast: 2,
    small: 1,
  }[enemy.type];
}

function defaultWaveType(wave: number): WaveConfig["type"] {
  if (wave > 20) {
    if (wave % 10 === 0) return "boss";
    if (wave % 5 === 0) return "elite";
    if (wave % 4 === 0 || wave % 10 >= 7) return "pressure";
    if (wave % 9 === 0) return "reward";
    return "normal";
  }
  if (wave === 20) return "boss";
  if (wave === 10 || wave === 15) return "elite";
  if (wave === 8 || wave === 14) return "reward";
  if (wave % 4 === 0 || wave >= 17) return "pressure";
  return "normal";
}

function buildQueue(wave: number, type: WaveConfig["type"], stage: StageConfig | undefined, event: StageWaveEvent | undefined) {
  const queue: EnemyType[] = [];
  const density = stage?.densityMultiplier || 1;
  const eventPool = (event?.enemies || []).filter((enemy) => enemy !== "boss");
  const countBonus = event?.countBonus || 0;

  if (type === "boss") {
    const count = Math.max(8, Math.round(16 * density) + countBonus);
    const pool = eventPool.length > 0 ? eventPool : stage?.enemyBias || ["small", "fast", "shield", "tank"];
    for (let i = 0; i < count; i += 1) queue.push(randomChoice(pool));
    return queue;
  }

  if (type === "elite") {
    const eliteCount = eventPool.includes("elite") ? 2 : 1;
    for (let i = 0; i < eliteCount; i += 1) queue.push("elite");
  }

  const baseCount = type === "reward" ? 12 + wave : type === "elite" ? 10 + wave : 9 + Math.floor(wave * 1.65);
  const count = clamp(Math.max(1, Math.round(baseCount * density) + countBonus), 1, wave > 20 ? 84 : 72);
  for (let i = 0; i < count; i += 1) {
    queue.push(weightedEnemy(wave, type, stage, eventPool));
  }

  return queue;
}

function weightedEnemy(wave: number, type: WaveConfig["type"], stage?: StageConfig, eventPool: EnemyType[] = []): EnemyType {
  if (eventPool.length > 0) return randomChoice(eventPool);
  if (type === "reward") return Math.random() < 0.55 ? "gold" : randomChoice(["small", "splitter", "fast"]);

  const pool: EnemyType[] = ["small", "small", "small", "fast"];
  if (wave >= 4) pool.push("tank", "splitter");
  if (wave >= 7) pool.push("shield");
  if (wave >= 11) pool.push("healer", "tank", "fast");
  if (type === "pressure") pool.push("fast", "tank", "shield", "splitter");
  if (stage?.enemyBias.length) pool.push(...stage.enemyBias, ...stage.enemyBias);
  return randomChoice(pool);
}
