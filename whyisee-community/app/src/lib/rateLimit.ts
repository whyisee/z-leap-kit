/**
 * 进程内令牌桶限流。
 *
 * 注意：单实例（@astrojs/node standalone）够用；一旦多实例部署，这里必须换成 Redis，
 * 否则每个实例各算一份，限流形同虚设。
 */
interface Bucket {
  tokens: number;
  updatedAt: number;
}

const buckets = new Map<string, Bucket>();
const maxBuckets = 5000;
const idleTtlMs = 10 * 60 * 1000;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * @param key      维度键，如 `login:1.2.3.4`、`write:42`
 * @param limit    窗口内允许的次数
 * @param windowMs 窗口长度
 */
export function takeToken(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  prune(now);

  const bucket = buckets.get(key);

  if (!bucket) {
    buckets.set(key, { tokens: limit - 1, updatedAt: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const refilled = Math.min(limit, bucket.tokens + ((now - bucket.updatedAt) / windowMs) * limit);
  bucket.updatedAt = now;

  if (refilled < 1) {
    bucket.tokens = refilled;
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(((1 - refilled) * windowMs) / limit / 1000)) };
  }

  bucket.tokens = refilled - 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** 来自反代时取 X-Forwarded-For 的第一段，否则退回连接地址 */
export function clientIpOf(request: Request, fallback = "unknown") {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") || fallback;
}

function prune(now: number) {
  if (buckets.size < maxBuckets) {
    for (const [key, bucket] of buckets) {
      if (now - bucket.updatedAt > idleTtlMs) buckets.delete(key);
    }
    return;
  }

  // 超过上限时清掉最旧的一半，避免内存被刷爆
  const entries = [...buckets.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt);
  for (const [key] of entries.slice(0, Math.floor(entries.length / 2))) {
    buckets.delete(key);
  }
}
