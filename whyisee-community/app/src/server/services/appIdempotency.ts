import { execute, queryOne } from "@server/db/client";

const retentionDays = 7;

/**
 * 写操作幂等。
 *
 * 客户端每次提交带一个 clientRequestId（UUID），重试时沿用同一个 id，
 * 服务端返回第一次的结果，不会产生第二条回复。
 * 不传 id 时退化成非幂等（老客户端兼容）。
 */
export async function withIdempotency<T>(input: {
  key?: string | null;
  userId: number;
  scope: string;
  run: () => Promise<T>;
}): Promise<{ result: T; replayed: boolean }> {
  const raw = (input.key || "").trim();

  if (!raw) {
    return { result: await input.run(), replayed: false };
  }

  const key = `${input.userId}:${raw}`;
  const cached = await queryOne<{ response_json: string }>(
    "SELECT response_json FROM app_idempotency_keys WHERE key = $1 LIMIT 1",
    [key],
  );

  if (cached) {
    try {
      return { result: JSON.parse(cached.response_json) as T, replayed: true };
    } catch {
      // 记录损坏就当没命中，直接重跑
    }
  }

  const result = await input.run();

  await execute(
    `
    INSERT INTO app_idempotency_keys (key, user_id, scope, response_json, created_at)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (key) DO NOTHING
    `,
    [key, input.userId, input.scope, JSON.stringify(result), new Date().toISOString()],
  );

  return { result, replayed: false };
}

/** 清理过期幂等记录，由 bot worker 定时调用 */
export async function pruneExpiredIdempotencyKeys() {
  const before = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  await execute("DELETE FROM app_idempotency_keys WHERE created_at < $1", [before]);
}
