import type { Marble } from "../../core/types";

export function reflectVelocity(marble: Marble, normalX: number, normalY: number) {
  const dot = marble.vx * normalX + marble.vy * normalY;
  marble.vx -= 2 * dot * normalX;
  marble.vy -= 2 * dot * normalY;
  marble.bounce += 1;
}

export function normalizeVelocity(marble: Marble, targetSpeed: number) {
  const speed = Math.hypot(marble.vx, marble.vy) || 1;
  marble.vx = (marble.vx / speed) * targetSpeed;
  marble.vy = (marble.vy / speed) * targetSpeed;
}
